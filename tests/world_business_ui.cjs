'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8');
const instrumented=source.replace('  window.SIDE3D = {',`  window.businessQA={
  freeze(){cancelAnimationFrame(raf);},
  resume(){clock.getDelta();raf=requestAnimationFrame(frame);},
  open(){const e=hubWorld.entrances.find(e=>e.id==='warehouse');positionPlayer(e.x,e.z,0);keys.KeyW=true;for(let i=0;i<110;i++)updatePlayer(1/60);keys={};openAdmin();},
  due(){if(businessState.pendingSupplierOrder){businessState.pendingSupplierOrder.dueAt=Date.now()-1;saveBusinessState();}tickSupplier();},
  tick:tickSupplier,
  snapshot(){return {stock:totalDisplayStock()+totalReserveStock(),pending:businessState.pendingSupplierOrder,ledger:JSON.stringify(bridge().ledger),cash:decisionCash(),time:gameSession.timeLeft,frames:renderer.info.render.frame};}
};\n  window.SIDE3D = {`);
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:1}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>!r.request().url().startsWith(url)?r.abort():/\/simulator3d\.js(?:\?|$)/.test(r.request().url())?r.fulfill({contentType:'application/javascript',body:instrumented}):r.continue());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.evaluate(seed=>{
   localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));
   currentStudent={name:'QA BUSINESS',company:'QA BUSINESS',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);commitReviewedSections(decisionCategories().map(c=>c.cat),true);
  },seed);
  assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
  await page.evaluate(()=>{businessQA.freeze();businessQA.open();});
  const before=await page.evaluate(()=>businessQA.snapshot());
  await page.locator('[data-admin-tab="stock"]').click();await page.locator('#orderStockBtn').click();
  const paid=await page.evaluate(()=>businessQA.snapshot());
  assert.equal(paid.cash,before.cash-360);assert.equal(paid.stock,before.stock);assert.ok(paid.pending);
  await page.locator('#orderStockBtn').click();assert.equal((await page.evaluate(()=>businessQA.snapshot())).cash,paid.cash);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{currentStudent={name:'QA BUSINESS',company:'QA BUSINESS',game:DEMO_GAME};openDecisionMenu();});
  assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
  await page.evaluate(()=>{businessQA.freeze();businessQA.due();});
  const delivered=await page.evaluate(()=>businessQA.snapshot());
  assert.equal(delivered.cash,paid.cash);assert.equal(delivered.stock,before.stock+12);assert.equal(delivered.pending,null);
  await page.evaluate(()=>{businessQA.tick();businessQA.tick();});
  assert.equal((await page.evaluate(()=>businessQA.snapshot())).stock,delivered.stock);
  console.log('PASS warehouse UI: paid order survives reload, exact stock +12, no repeated debit or delivery');
  await page.evaluate(()=>SIDE3D.preloadDetails());
  await page.evaluate(()=>{SIDE3D.suspend();businessQA.resume();});
  await page.waitForTimeout(250);
  const paused=await page.evaluate(()=>businessQA.snapshot());await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>businessQA.snapshot()),paused,'paused world does not render, simulate, sell or advance shift clock');
  await page.evaluate(()=>showScreen('studentLobby'));await page.waitForTimeout(200);
  const hidden=await page.evaluate(()=>businessQA.snapshot());await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>businessQA.snapshot()),hidden,'hidden world stays idle');
  assert.equal(await page.evaluate(()=>SIDE3D.returnFromDecisions()),true);
  await page.waitForFunction(()=>SIDE3D.diagnostics().running);
  const frame=await page.evaluate(()=>SIDE3D.diagnostics().renderedFrames);
  await page.waitForFunction(f=>SIDE3D.diagnostics().renderedFrames>f,frame);
  await page.evaluate(()=>{
   Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);const inactive=await page.evaluate(()=>businessQA.snapshot());await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>businessQA.snapshot()),inactive,'inactive tab does no GPU, NPC, finance or physics work');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(f=>SIDE3D.diagnostics().renderedFrames>f,inactive.frames);
  assert.deepEqual(errors,[]);
  console.log('PASS real WebGL pause, hidden screen, tab visibility and resume; no browser exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
