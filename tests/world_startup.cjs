'use strict';
// Run with a local HTTP server serving the project. Test storage is isolated.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL||'http://127.0.0.1:8771/';
const output=path.join(__dirname,'output');fs.mkdirSync(output,{recursive:true});
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  for(const mode of ['all','sections']){
   const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],failedLocal=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('requestfailed',request=>{if(request.url().startsWith(url))failedLocal.push(request.url())});
   // All third-party hosts are unavailable. The 3D engine and its assets must load locally.
   await context.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA',company:'QA MUNDO',game:DEMO_GAME};openDecisionMenu();});
   assert.equal(await page.evaluate(()=>SIDE_GAME_BRIDGE.canStartSimulation()),false,'incomplete decisions must block entry');
   if(mode==='all'){
    await page.evaluate(seed=>{Object.assign(decisionDrafts,seed);renderDecisionCategory();openCompanyReview()},seed);
    assert.deepEqual(await page.evaluate(()=>reviewProblems(liveCompanyReview())),[]);
    await page.locator('#confirmCompanyReview').click();
   }else{
    const cats=await page.evaluate(()=>decisionCategories().map(c=>c.cat));
    for(let i=0;i<cats.length;i++){
     const result=await page.evaluate(({cat,seed})=>{currentCategory=cat;Object.assign(decisionDrafts,seed);renderDecisionCategory();const ok=commitReviewedSections([cat],false);return {ok,ready:SIDE_GAME_BRIDGE.canStartSimulation()}},{cat:cats[i],seed});
     assert.equal(result.ok,true,`submit section ${cats[i]}`);
     assert.equal(result.ready,i===cats.length-1,'all sections are required');
    }
    assert.equal(await page.evaluate(()=>decisionsSubmitted()),false,'regression: independent submissions do not use the global flag');
    // Reload proves readiness derives from persisted section receipts.
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{currentStudent={name:'QA',company:'QA MUNDO',game:DEMO_GAME};currentCategory='A';openDecisionMenu()});
   }
   assert.equal(await page.evaluate(()=>SIDE_GAME_BRIDGE.canStartSimulation()),true);
   await page.locator('#companyStartWorld').waitFor({state:'visible'});
   if(mode==='all'){
    // A rejected preparation returns to the summary, releases the button and preserves money.
    const before=await page.evaluate(()=>({ledger:JSON.stringify(cashLedger),state:JSON.stringify(decisionState)}));
    await page.evaluate(()=>{window.realPrepare=SIDE3D.prepare;SIDE3D.prepare=async()=>{throw new Error('QA: error controlado')};});
    assert.equal(await page.evaluate(()=>startSimulationLoading()),false);
    assert.equal(await page.locator('#companyStartWorld').isEnabled(),true);
    assert.deepEqual(await page.evaluate(()=>({ledger:JSON.stringify(cashLedger),state:JSON.stringify(decisionState)})),before);
    await page.evaluate(()=>{SIDE3D.prepare=window.realPrepare;delete window.realPrepare});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile summary overflow');
    await page.locator('#companyStartWorld').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'world-start-mobile.png')});
    await page.setViewportSize({width:1440,height:900});
   }
   const start=Date.now();
   const calls=await page.evaluate(async()=>{const first=startSimulationLoading();const duplicate=await startSimulationLoading();return {first:await first,duplicate}});
   assert.equal(calls.first,true,`world should open: ${await page.evaluate(()=>JSON.stringify({toast:$('toast').textContent,diagnostic:SIDE3D.diagnostics()}))}`);assert.equal(calls.duplicate,false,'double click is ignored');
   assert.equal(await page.locator('#simulator3d').isVisible(),true);
   assert.equal(await page.locator('#sim3dStart').isVisible(),false,'autostart must not leave another blocking overlay');
   await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);
   const diagnostic=await page.evaluate(()=>SIDE3D.diagnostics());
   assert.equal(diagnostic.running,true);assert.equal(diagnostic.navigationReady,true);
   assert.deepEqual(diagnostic.models.sort(),['casual','female','male']);
   assert.ok(diagnostic.characters.some(c=>c.kind==='male'&&Math.abs(c.x-3.8)<.3&&Math.abs(c.z-5.9)<.25),'male retains staff position including idle movement');
   assert.ok(diagnostic.characters.some(c=>c.kind==='female'&&Math.abs(c.x-6)<.3&&Math.abs(c.z-5.9)<.25),'female retains staff position including idle movement');
   await page.screenshot({path:path.join(output,`world-${mode}.png`)});
   assert.deepEqual(errors,[]);assert.deepEqual(failedLocal,[]);
   results.push({mode,passed:true,loadMs:Date.now()-start,diagnostic});
   console.log('PASS',mode,JSON.stringify(results.at(-1)));
   await context.close();
  }
  fs.writeFileSync(path.join(output,'world-startup-results.json'),JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
