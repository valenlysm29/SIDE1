'use strict';
// Exercise the actual frame loop with a deterministic clock. Test helpers are
// injected only into the local browser response; shipped code has no QA hooks.
// Intermediate rendering is skipped when advancing time, then the real scene
// renders once. The checkout fixture uses an existing spawned customer and
// reserves existing stock; it adds neither products nor money.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL;
if(!url)throw new Error('Run with node tests/run_world_regression.cjs world_population_flow_browser.cjs');
const output=path.join(__dirname,'output/world-population-flow');fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8');
assert.ok(source.includes('  window.SIDE3D = {'));
const instrumented=source.replace('const time = performance.now() * 0.001;', 'const time = now * 0.001;').replace('  window.SIDE3D = {',`  window.populationFlowQA={
  freeze(){cancelAnimationFrame(raf);},
  snapshot(){return {running,interior:currentInterior,rooms:businessInteriors.rooms.map(r=>({id:r.id,visible:r.detail.visible,actors:r.actors.map(a=>({id:a.object.uuid,x:a.object.position.x,z:a.object.position.z,visible:a.object.visible,stationary:!!a.route.stationary}))})),customers:npcs.map(n=>({id:n.obj.uuid,x:n.obj.position.x,z:n.obj.position.z,state:n.state})),stock:totalDisplayStock()+totalReserveStock(),cash:decisionCash()};},
  advance(seconds){cancelAnimationFrame(raf);const original=clock.getDelta,render=renderer.render;clock.getDelta=()=>1/60;renderer.render=()=>{};this.now??=performance.now();try{for(let i=0;i<Math.round(seconds*60);i++){this.now+=1000/60;frame(this.now);cancelAnimationFrame(raf);}}finally{clock.getDelta=original;renderer.render=render;}renderer.render(scene,camera);return this.snapshot();},
  visit(id){const r=businessInteriors.rooms.find(r=>r.id===id);positionPlayer(HUB_OFFSET+r.layout.x,r.layout.z,0);updateBusinessZone();},
  outside(){positionPlayer(HUB_OFFSET,0,0);updateBusinessZone();},
  pause(value){running=!value;},
  checkoutFixture(){const product=PRODUCTS.find(p=>displayStock(p.id)>0),npc=npcs.find(n=>!n.dead&&!n.productId);if(!product||!npc)return null;reserveProductForNpc(npc,product);npc.productPrice=product.price;const slot=queueSlots[0];npc.obj.position.set(slot.x,.025,slot.z);npc.route=[];setNpcState(npc,NPC_STATE.QUEUE);checkoutQueue.splice(0,checkoutQueue.length,npc);nextAutoServeAt=0;return {price:product.price,staff:salesStaff()};},
  ended(){gameSession.shiftEnded=true;}
};\n  window.SIDE3D = {`);
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:100,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:30}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:600}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['miraflores'],quantities:{miraflores:2}},INV_MARKETING:{optionIds:['mkt_baja']},MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_ind:1}},ACABADOS:{quantities:{aca_ind:1}},PERS_CORTE:{quantities:{corte_maestro:1}},PERS_ENSAMBLE:{quantities:{ens_personal_esp:1}},PERS_ACABADO:{quantities:{aca_personal_art:1}}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results={},errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(90000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.stack);});page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text());});
  await page.route('**/*',r=>!r.request().url().startsWith(url)?r.abort():/\/js\/simulator3d\.js(?:\?|$)/.test(r.request().url())?r.fulfill({contentType:'application/javascript',body:instrumented}):r.continue());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA FLUJO',company:'QA FLUJO',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);return commitReviewedSections(decisionCategories().map(c=>c.cat),true);},seed),true);
  assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
  await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);
  await page.evaluate(()=>SIDE3D.preloadDetails());
  await page.evaluate(()=>{populationFlowQA.freeze();populationFlowQA.outside();});
  console.log('Loaded real world and detailed models');
  const initial=results.initial=await page.evaluate(()=>populationFlowQA.snapshot());
  assert.equal(initial.interior,null);
  assert.equal(initial.rooms.length,6);
  assert.ok(initial.rooms.every(r=>r.visible&&r.actors.length>=2&&r.actors.every(a=>a.visible)),'six businesses populated before first visit');
  console.log('Checking remote actors and customers');
  const outside=results.outside=await page.evaluate(()=>populationFlowQA.advance(12));
  assert.equal(outside.interior,null);
  assert.ok(outside.customers.length>0,'real customer spawning runs while player remains in plaza');
  for(const room of initial.rooms){
   const current=outside.rooms.find(r=>r.id===room.id);
   assert.deepEqual(current.actors.map(a=>a.id),room.actors.map(a=>a.id));
   assert.ok(current.actors.filter(a=>!a.stationary).some(a=>{const old=room.actors.find(b=>b.id===a.id);return Math.hypot(a.x-old.x,a.z-old.z)>.05;}),room.id+' advances without entry');
  }
  const before=outside.customers;
  const later=results.later=await page.evaluate(()=>populationFlowQA.advance(4));
  assert.ok(before.some(a=>{const b=later.customers.find(b=>b.id===a.id);return b&&(Math.hypot(a.x-b.x,a.z-b.z)>.02||a.state!==b.state);}), 'existing customers move outside store');
  const preReservation=await page.evaluate(()=>populationFlowQA.snapshot());
  const saleFixture=await page.evaluate(()=>populationFlowQA.checkoutFixture());
  assert.ok(saleFixture&&saleFixture.staff>1,'real stock and two decision-defined sales staff available');
  const saleBefore=await page.evaluate(()=>populationFlowQA.snapshot());
  const saleAfter=results.remoteCheckout=await page.evaluate(()=>populationFlowQA.advance(.2));
  assert.ok(saleAfter.cash>saleBefore.cash,'existing real customer checked out while player remains in plaza');
  assert.equal(saleBefore.stock,preReservation.stock-1,'existing stock is reserved once');
  assert.equal(saleAfter.stock,saleBefore.stock,'checkout never consumes the reserved stock twice');
  await page.evaluate(()=>populationFlowQA.pause(true));
  const paused=await page.evaluate(()=>populationFlowQA.snapshot());
  assert.deepEqual(await page.evaluate(()=>populationFlowQA.advance(5)),paused,'paused frame loop freezes actors, stock and cash');
  await page.evaluate(()=>populationFlowQA.pause(false));
  for(const room of initial.rooms){await page.evaluate(id=>populationFlowQA.visit(id),room.id);await page.evaluate(()=>populationFlowQA.advance(.1));}
  await page.evaluate(()=>populationFlowQA.outside());
  const revisited=results.revisited=await page.evaluate(()=>populationFlowQA.snapshot());
  for(const room of initial.rooms)assert.deepEqual(revisited.rooms.find(r=>r.id===room.id).actors.map(a=>a.id),room.actors.map(a=>a.id),'visits preserve '+room.id+' population');
  await page.evaluate(()=>populationFlowQA.ended());
  const closed=await page.evaluate(()=>populationFlowQA.snapshot());
  const afterClosed=results.closed=await page.evaluate(()=>populationFlowQA.advance(1));
  assert.deepEqual(afterClosed.customers,closed.customers,'closed shift cannot spawn or move financial customers');
  assert.equal(afterClosed.cash,closed.cash);assert.equal(afterClosed.stock,closed.stock);
  assert.deepEqual(errors,[]);results.errors=errors;
  await page.screenshot({path:path.join(output,'world-active.png')});
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,...results},null,2));
  console.log('PASS all six businesses populated at entry; remote workers and customers advance; pause freezes simulation; visits preserve actors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
