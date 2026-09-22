'use strict';
// Real WebGL lifecycle regression. Run against the local server with SIDE_TEST_URL.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.SIDE_TEST_URL || 'http://127.0.0.1:8772/';
const seed = {
  MOLDE:{optionIds:['molde_1']},
  PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},
  CUERO:{quantities:{cuero_sint:3}}, ACCESORIOS:{quantities:{acc_eco:10}},
  HILO:{quantities:{hilo_std:1}}, GARANTIA_PT:{optionIds:['pt_30']},
  CANALES:{optionIds:['sjl'],quantities:{sjl:2}}, INV_MARKETING:{optionIds:['mkt_baja']}
};

(async () => {
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless:true, args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  try {
    const context = await browser.newContext({viewport:{width:1100,height:760}});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    // Accelerate only the end of a shift; keep the production entry/replay handlers intact.
    const source = fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8');
    await page.route('**/simulator3d.js?*', route => route.fulfill({contentType:'application/javascript',
      body:source.replace('  window.SIDE3D = {', `  window.cycleQA = {
        finish(success=false) { if(success) gameSession.revenue=gameSession.targetRevenue; endShift(); },
        openAdmin, openDecisionsFrom3D,
        inventoryKey, businessKey, session:()=>gameSession
      };\n  window.SIDE3D = {`)}));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));
      currentStudent={name:'QA',company:'QA REINICIO',game:DEMO_GAME};
      openDecisionMenu();
    });
    async function submit(round, sections=false) {
      return page.evaluate(({seed,round,sections}) => {
        if(round>1)delete seed.MOLDE;
        Object.assign(decisionDrafts,seed);
        const cats=decisionCategories().map(c=>c.cat);
        return sections ? cats.every(cat=>{
          Object.assign(decisionDrafts,seed);
          return commitReviewedSections([cat],false);
        }) : commitReviewedSections(cats,true);
      },{seed,round,sections});
    }
    async function active() {
      await page.waitForFunction(() => {
        const d=SIDE3D.diagnostics();
        return !document.getElementById('simulator3d').classList.contains('hidden') &&
          d.running && d.session && !d.session.shiftEnded;
      });
      for(const id of ['sim3dSummary','simAdmin','simCheckout','simNewsPanel','simProductInspect','sim3dStart']) {
        assert.equal(await page.locator('#'+id).isVisible(),false,`${id} must not block entry`);
      }
      const frame=await page.evaluate(()=>SIDE3D.diagnostics().renderedFrames);
      await page.waitForFunction(frame=>SIDE3D.diagnostics().renderedFrames>frame+2,frame);
    }
    assert.equal(await submit(1),true);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await active();

    // Returning to the same active shift must preserve its clock and mission state.
    const before=await page.evaluate(()=>{cycleQA.openDecisionsFrom3D();return cycleQA.session().timeLeft});
    await page.locator('#exitDecisions').click();
    await active();
    assert.ok(await page.evaluate(before=>cycleQA.session().timeLeft<=before,before));

    await page.evaluate(()=>{cycleQA.finish();cycleQA.openDecisionsFrom3D()});
    await page.locator('#exitDecisions').click();
    await active();
    console.log('PASS return after finished shift');

    await page.evaluate(()=>{cycleQA.openAdmin();cycleQA.openDecisionsFrom3D()});
    const finances=await page.evaluate(()=>JSON.stringify(cashLedger));
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await active();
    assert.equal(await page.evaluate(()=>JSON.stringify(cashLedger)),finances);
    console.log('PASS restart clears previous panels without charging decisions again');

    for(const round of [2,3]) {
      if(round===3)await page.evaluate(()=>{
        cycleQA.finish();cycleQA.openDecisionsFrom3D();
        companySummaryRound='1';renderDecisionCategory();
      });
      const oldData=await page.evaluate(()=>({key:cycleQA.inventoryKey(),data:localStorage.getItem(cycleQA.inventoryKey())}));
      await page.evaluate(round=>localStorage.setItem('SIDE_ACTIVE_ROUND',String(round)),round);
      await page.waitForFunction(round=>lastObservedRound===round && SIDE3D.diagnostics().session===null,round);
      assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().running),false);
      assert.equal(await page.locator('#decisionMenu').isVisible(),true);
      assert.equal(await page.evaluate(()=>startSimulationLoading()),false,'new cycle requires its own decisions');
      assert.equal(await page.evaluate(()=>localStorage.getItem(cycleQA.inventoryKey())),null,'old stock must not leak into new cycle');
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),oldData.key),oldData.data);
      assert.equal(await submit(round,round===2),true);
      assert.equal(await page.evaluate(()=>companySummaryRound),'current');
      await page.locator('#companyStartWorld').waitFor({state:'visible'});
      const ledger=await page.evaluate(()=>JSON.stringify(cashLedger));
      await page.locator('#companyStartWorld').click();
      await active();
      const session=await page.evaluate(()=>SIDE3D.diagnostics().session);
      assert.ok(session.context.endsWith('_'+round));
      assert.equal(session.day,1);
      assert.equal(await page.evaluate(()=>JSON.stringify(cashLedger)),ledger);
      console.log(`PASS cycle ${round}: independent session and world entry`);
    }

    for(const success of [false,true]) {
      await page.evaluate(success=>cycleQA.finish(success),success);
      await page.locator('#sim3dReplayBtn').click();
      await active();
      assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().session.day),success?2:1);
    }
    const names=await page.evaluate(()=>SIDE3D.diagnostics().characters.map(c=>c.name));
    for(const name of ['Joel','Miguel','Gonzalo','Valeria'])assert.ok(names.includes(name),name);
    assert.deepEqual(errors,[]);
    console.log('PASS retry day, next day, NPC names, no browser errors');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
