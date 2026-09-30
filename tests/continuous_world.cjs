'use strict';
// Real local WebGL. Fixtures reposition only before a scenario; doors are crossed
// by the production controller and business changes use the existing handlers.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL;
if(!url)throw new Error('Run with node tests/run_world_regression.cjs continuous_world.cjs');
const output=path.join(__dirname,'output/continuous');fs.mkdirSync(output,{recursive:true});
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:1}},INV_MARKETING:{optionIds:['mkt_baja']},MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_ind:1}},ACABADOS:{quantities:{aca_ind:1}},PERS_CORTE:{quantities:{corte_maestro:1}},PERS_ENSAMBLE:{quantities:{ens_personal_esp:1}},PERS_ACABADO:{quantities:{aca_personal_art:1}}};
let source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8');
for(const name of ['buildLegacyWorld','buildRetiredStaticInterior','rebuildRetiredDynamicWorld','renderRetiredInventoryDisplays']){
  source=source.replace(new RegExp(`function ${name}\\(([^)]*)\\) \\{`),`function ${name}($1) { window.continuousCounters.legacy++;`);
}
source=source.replace('  window.SIDE3D = {',`  window.continuousQA={
  pause(){cancelAnimationFrame(raf);},
  resume(){clock.getDelta();raf=requestAnimationFrame(frame);},
  place(x,z,heading=0){positionPlayer(x,z,heading);updateBusinessZone();},
  step(seconds,forward=1,side=0){
    const samples=[];keys={KeyW:forward>0,KeyS:forward<0,KeyD:side>0,KeyA:side<0};
    for(let i=0;i<Math.round(seconds*60);i++){lastCameraInputAt=performance.now();updatePlayer(1/60);businessInteriors.tick(1/60,player,i/60);samples.push({x:player.x,z:player.z});}
    keys={};renderInventoryDisplays();updateHUD();updateHubObjective();updateGameplayCamera(1/60);renderer.render(scene,camera);return samples;
  },
  walkTo(x,z){
    let i=0;for(;i<1800;i++){
      const dx=x-player.x,dz=z-player.z;if(Math.hypot(dx,dz)<.12)break;
      yaw=targetYaw=Math.atan2(-dx,-dz);keys={KeyW:true};lastCameraInputAt=performance.now();updatePlayer(1/60);businessInteriors.tick(1/60,player,i/60);
    }keys={};player.vx=player.vz=0;updateGameplayCamera(1);renderInventoryDisplays();updateHubObjective();renderer.render(scene,camera);return {arrived:i<1800,x:player.x,z:player.z};
  },
  doors(){return hubWorld.entrances;},
  colliders(){return businessInteriors.colliders;},
  blocked:collision,
  hotspots(){return interactables.filter(p=>p.zone).map(p=>({id:p.id,type:p.type,x:p.x,z:p.z,zone:p.zone}));},
  inspect(){return {sceneId:scene.uuid,hubId:hubWorld.group.uuid,businessId:businessInteriors.group.uuid,sceneChildren:scene.children.length,hubActors:hubActors.length,routes:businessInteriors.npcRoutes.length,rooms:businessInteriors.rooms.map(r=>({id:r.id,instances:r.detail.userData.geometryInstances,actors:r.actors.length,visible:r.detail.visible})),stats:businessInteriors.stats(),geometry:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}};},
  finance(){return {cash:decisionCash(),inventory:JSON.parse(JSON.stringify(inventory)),business:JSON.parse(JSON.stringify(businessState)),stock:totalDisplayStock()+totalReserveStock(),projection:businessVisualSnapshot(),session:{context:sessionContext,timeLeft:gameSession?.timeLeft},ledger:JSON.stringify(bridge().ledger)};},
  visuals(){renderInventoryDisplays();return businessInteriors.stats();},
  due(){businessState.pendingSupplierOrder.dueAt=Date.now()-1;saveBusinessState();tickSupplier();},
  receive:tickSupplier,
  restock(){return restockDisplays(true);},
  drivingStep(seconds,input={}){keys=input;for(let i=0;i<Math.round(seconds*60);i++)updateDriving(1/60);keys={};updateGameplayCamera(1);renderer.render(scene,camera);},
  customer(){
    const product=PRODUCTS.find(p=>displayStock(p.id)>0);if(!product)return null;
    const p=acquireNpcPerson({execModel:'chico1'}),slot=queueSlots[0];p.position.set(slot.x,.025,slot.z);npcGroup.add(p);
    const npc=createNpcRecord(p,slot.x,{...CUSTOMER_ARCHETYPES[0],patience:500});
    reserveProductForNpc(npc,product);npc.productPrice=product.price;setNpcState(npc,NPC_STATE.QUEUE);npcs.push(npc);checkoutQueue.push(npc);
    return {id:product.id,price:product.price};
  },
  productionTick(){tickProduction(performance.now()+100000);return {actual:inventory.producedUnits,plan:productionSnapshot()?.producibleUnits};},
  decisions:openDecisionsFrom3D
};\n  window.SIDE3D = {`);
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[],errors=[],failures=[];
  const pass=(id,name,evidence)=>{results.push({id,name,status:'PASS',evidence});console.log(`PASS ${id} ${name}`);fs.writeFileSync(path.join(output,'functional-results.json'),JSON.stringify({results,errors,failures},null,2));};
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(90000);
    page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.url().startsWith(url)&&response.status()>=400)failures.push(response.url());});
    await page.addInitScript(()=>{
      window.continuousCounters={legacy:0,listeners:0,raf:new Set()};
      const originalAdd=EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener=function(type,...args){if(['keydown','keyup','visibilitychange','pointerlockchange','wheel'].includes(type))continuousCounters.listeners++;return originalAdd.call(this,type,...args);};
      const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
      window.requestAnimationFrame=fn=>{const id=request.call(window,time=>{continuousCounters.raf.delete(id);fn(time);});continuousCounters.raf.add(id);return id;};
      window.cancelAnimationFrame=id=>{continuousCounters.raf.delete(id);cancel.call(window,id);};
    });
    await page.route('**/*',route=>!route.request().url().startsWith(url)?route.abort():/\/simulator3d\.js(?:\?|$)/.test(route.request().url())?route.fulfill({contentType:'application/javascript',body:source}):route.continue());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA CONTINUO',company:'QA CONTINUO',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);return commitReviewedSections(decisionCategories().map(c=>c.cat),true);},seed),true);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);await page.evaluate(()=>continuousQA.pause());
    const initial=await page.evaluate(()=>({diagnostic:SIDE3D.diagnostics(),world:continuousQA.inspect(),legacy:continuousCounters.legacy,listeners:continuousCounters.listeners}));
    assert.equal(initial.legacy,0);assert.equal(initial.diagnostic.hub.active,true);assert.equal(initial.diagnostic.hub.interior,null);assert.ok(initial.diagnostic.player.x>100);assert.equal(initial.world.stats.rooms,6);
    pass(1,'Nuevo mapa único',initial);
    const doors=await page.evaluate(()=>continuousQA.doors());
    async function enter(id){
      const door=doors.find(e=>e.id===id);await page.evaluate(e=>continuousQA.place(e.x,e.z,0),door);
      const samples=await page.evaluate(()=>continuousQA.step(1.1));
      for(let i=1;i<samples.length;i++)assert.ok(Math.hypot(samples[i].x-samples[i-1].x,samples[i].z-samples[i-1].z)<.06,'door has no coordinate jump');
      assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.interior),id);assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.active),true);
      assert.ok(samples.every(p=>Math.abs(p.x-door.x)<.1));return samples.at(-1);
    }
    async function exit(id){const door=doors.find(e=>e.id===id);await page.evaluate(e=>continuousQA.place(e.x,e.portal.z-1,Math.PI),door);await page.evaluate(()=>continuousQA.step(1.1));const d=await page.evaluate(()=>SIDE3D.diagnostics());assert.equal(d.hub.interior,null);assert.equal(d.hub.active,true);assert.ok(d.player.z>door.portal.z&&Math.abs(d.player.x-door.x)<.1);assert.equal(await page.evaluate(()=>continuousQA.blocked(SIDE3D.diagnostics().player.x,SIDE3D.diagnostics().player.z)),false);return d.player;}
    async function walkRoute(points){for(const [x,z] of points){const step=await page.evaluate(({x,z})=>continuousQA.walkTo(x,z),{x,z});assert.ok(step.arrived,`connected street route reaches ${x},${z}: ${JSON.stringify(step)}`);}}
    async function interiorPhoto(name,points){
      await walkRoute(points);await page.keyboard.press('KeyV');
      await page.evaluate(()=>continuousQA.step(0));await page.screenshot({path:path.join(output,name+'-inside.png')});
      await page.keyboard.press('KeyV');await page.evaluate(()=>continuousQA.step(0));
    }
    pass(2,'Entrada física tienda',await enter('store'));
    await page.screenshot({path:path.join(output,'store.png')});
    await interiorPhoto('store',[[131,19]]);
    // A customer may wait in the direct aisle; use the clear route around the queue.
    await walkRoute([[131,20.5],[126,20.5],[126,19.15]]);const inspectBefore=await page.evaluate(()=>continuousQA.finance());await page.keyboard.press('KeyE');
    assert.equal(await page.locator('#simProductInspect').isVisible(),true);assert.equal(await page.locator('#inspectProductName').innerText(),'Bolso Básico');
    assert.deepEqual(await page.evaluate(()=>continuousQA.finance()),inspectBefore,'product inspection only reads the authoritative model');
    await page.keyboard.press('Escape');
    pass(3,'Salida física tienda',await exit('store'));
    await enter('warehouse');const warehouse=await page.evaluate(()=>continuousQA.inspect());assert.ok(warehouse.stats.activeLights>0);
    const warehouseSolids=(await page.evaluate(()=>continuousQA.colliders())).filter(c=>c.zone==='warehouse');
    assert.equal(warehouseSolids.filter(c=>c.kind==='shelf').length,4,'four industrial rack bays');
    for(const kind of ['worktable','pallet','equipment','wall'])assert.ok(warehouseSolids.some(c=>c.kind===kind),`warehouse ${kind}`);
    assert.ok(warehouse.rooms.find(r=>r.id==='warehouse').visible);await page.screenshot({path:path.join(output,'warehouse.png')});await interiorPhoto('warehouse',[[130,-18]]);await exit('warehouse');pass(4,'Almacén equipado',warehouse);
    await enter('production');const production=await page.evaluate(()=>continuousQA.inspect());assert.ok((await page.evaluate(()=>continuousQA.colliders())).filter(c=>c.zone==='production'&&c.kind==='machine').length>=3);assert.ok(production.stats.activeLights>0);await page.screenshot({path:path.join(output,'production.png')});await exit('production');pass(5,'Producción equipada',production);
    const objects=await page.evaluate(()=>continuousQA.colliders());const collisions=[];
    for(const kind of ['wall','shelf','machine','counter']){
      const obstacle=objects.find(c=>c.kind===kind&&(kind!=='wall'||(c.zone==='store'&&c.maxX-c.minX<1)));
      assert.ok(obstacle,kind);const start={x:obstacle.maxX+.75,z:(obstacle.minZ+obstacle.maxZ)/2};
      await page.evaluate(p=>continuousQA.place(p.x,p.z,Math.PI/2),start);assert.equal(await page.evaluate(p=>continuousQA.blocked(p.x,p.z),start),false,`${kind} approach is clear`);
      await page.evaluate(()=>continuousQA.step(1.6));const end=await page.evaluate(()=>SIDE3D.diagnostics().player);assert.ok(end.x>=obstacle.maxX+.34&&end.x<start.x,`${kind} blocks movement after approach`);collisions.push({kind,obstacle,start,end});
    }pass(6,'Paredes, estantes, máquinas y caja sólidos',collisions);
    const car=await page.evaluate(()=>SIDE3D.diagnostics().vehicles.find(c=>!c.traffic));await page.evaluate(c=>continuousQA.place(c.x,c.z+2.4),car);await page.keyboard.press('KeyF');await page.evaluate(()=>continuousQA.drivingStep(.65));assert.ok(await page.evaluate(()=>SIDE3D.diagnostics().driving));await page.evaluate(()=>continuousQA.drivingStep(1,{KeyW:true}));await page.evaluate(()=>continuousQA.drivingStep(1,{Space:true}));await page.keyboard.press('KeyF');await page.evaluate(()=>continuousQA.drivingStep(.65));assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().driving),null);
    const parked=await page.evaluate(()=>SIDE3D.diagnostics().vehicles.find(c=>!c.traffic));assert.ok(Math.hypot(parked.x-car.x,parked.z-car.z)>1);await enter('store');await exit('store');assert.deepEqual(await page.evaluate(()=>SIDE3D.diagnostics().vehicles.find(c=>!c.traffic)),parked);pass(7,'Vehículo conserva estacionamiento',parked);
    await enter('warehouse');
    const stockBefore=await page.evaluate(()=>continuousQA.finance());const hot=await page.evaluate(()=>continuousQA.hotspots().find(p=>p.id==='warehouse-order'));assert.ok(hot);
    await page.evaluate(p=>continuousQA.place(p.x,p.z),hot);await page.keyboard.press('KeyE');assert.equal(await page.locator('#simAdmin').isVisible(),true,'physical receiving terminal opens existing management');await page.locator('[data-admin-tab="stock"]').click();await page.locator('#orderStockBtn').click();const paid=await page.evaluate(()=>continuousQA.finance());assert.equal(paid.cash,stockBefore.cash-360);assert.equal(paid.stock,stockBefore.stock);assert.equal(paid.business.pendingSupplierOrder.units,12);await page.locator('#orderStockBtn').click();assert.equal((await page.evaluate(()=>continuousQA.finance())).cash,paid.cash);await page.locator('#adminCloseBtn').click();
    await page.evaluate(()=>continuousQA.due());const delivered=await page.evaluate(()=>continuousQA.finance());assert.equal(delivered.stock,stockBefore.stock+12);assert.equal(delivered.cash,paid.cash);assert.equal(delivered.inventory.producedUnits,stockBefore.inventory.producedUnits);assert.equal(delivered.business.pendingSupplierOrder,null);await page.evaluate(()=>{continuousQA.receive();continuousQA.receive();});assert.equal((await page.evaluate(()=>continuousQA.finance())).stock,delivered.stock);
    const visuals=await page.evaluate(()=>continuousQA.visuals());assert.equal(visuals.stockLevels.warehouse,Math.ceil(delivered.projection.warehouseFill*4));
    const restockBefore=await page.evaluate(()=>continuousQA.finance());await page.evaluate(()=>continuousQA.restock());const restocked=await page.evaluate(()=>continuousQA.finance());assert.equal(restocked.stock,restockBefore.stock);assert.equal(restocked.cash,restockBefore.cash);const tiers=await page.evaluate(()=>continuousQA.visuals());assert.equal(tiers.stockLevels.store,Math.ceil(restocked.projection.storeFill*4));await exit('warehouse');pass(8,'Inventario autoritativo y entrega única',{before:stockBefore,paid,delivered,restocked,visuals:tiers});
    // Complete business flow: actual checkout handlers; source model owns sale.
    await walkRoute([[130,-6],[150,-6],[150,27.5],[131,27.5],[131,22.7]]);
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.interior),'store','city street route leads physically into store');
    const customer=await page.evaluate(()=>continuousQA.customer());assert.ok(customer);const saleBefore=await page.evaluate(()=>continuousQA.finance());const register=await page.evaluate(()=>continuousQA.hotspots().find(p=>p.type==='register'));assert.ok(register);
    await walkRoute([[132.5,22.7],[135.2,22.7]]);
    await page.keyboard.press('KeyE');assert.equal(await page.locator('#simCheckout').isVisible(),true);await page.locator('#checkoutScanBtn').click();await page.locator('#checkoutChargeBtn').click();const sold=await page.evaluate(()=>continuousQA.finance());assert.equal(sold.cash,saleBefore.cash+customer.price*.99);assert.equal(sold.inventory.sold[customer.id],(saleBefore.inventory.sold[customer.id]||0)+1);await page.evaluate(()=>document.getElementById('checkoutChargeBtn').click());assert.equal((await page.evaluate(()=>continuousQA.finance())).cash,sold.cash);
    await walkRoute([[131,22.7],[131,27.5],[150,27.5],[150,-6],[170,-6],[170,-13.5]]);
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.interior),'production','street route connects store and production');
    await interiorPhoto('production',[[170,-17.7]]);
    await page.keyboard.press('KeyE');assert.equal(await page.locator('#simAdmin').isVisible(),true,'physical production console uses existing business dashboard');
    assert.match(await page.locator('#adminProductionText').innerText(),/Producidas hoy:.*Capacidad de almacén:/);await page.locator('#adminCloseBtn').click();
    const produced=await page.evaluate(()=>continuousQA.productionTick());assert.equal(produced.actual,produced.plan,'completed authoritative plan does not produce extra units');const stable=await page.evaluate(()=>continuousQA.inspect());const listeners=await page.evaluate(()=>continuousCounters.listeners);await exit('production');
    for(const id of ['store','warehouse','production']){await enter(id);await exit(id);}for(let i=0;i<3;i++)await page.evaluate(()=>SIDE3D.rebuild());
    const repeated=await page.evaluate(()=>continuousQA.inspect());assert.equal(repeated.sceneId,stable.sceneId);assert.equal(repeated.sceneChildren,stable.sceneChildren);assert.equal(repeated.routes,stable.routes);assert.equal(await page.evaluate(()=>continuousCounters.listeners),listeners);
    const old=await page.evaluate(()=>continuousQA.finance());await page.evaluate(()=>continuousQA.decisions());await page.locator('#exitDecisions').click();await page.waitForFunction(()=>SIDE3D.diagnostics().running);await page.evaluate(()=>continuousQA.pause());assert.equal((await page.evaluate(()=>continuousQA.finance())).cash,old.cash);
    await page.evaluate(()=>{continuousQA.resume();localStorage.setItem('SIDE_ACTIVE_ROUND','2');studentConnected=true;tickStudentGame();});await page.waitForFunction(()=>lastObservedRound===2&&SIDE3D.diagnostics().session===null);
    assert.equal(await page.evaluate(seed=>{delete seed.MOLDE;Object.assign(decisionDrafts,seed);return commitReviewedSections(decisionCategories().map(c=>c.cat),true);},seed),true);const cycleCash=await page.evaluate(()=>cashBalance());assert.equal(await page.evaluate(()=>startSimulationLoading()),true);await page.waitForFunction(()=>SIDE3D.diagnostics().running);await page.evaluate(()=>continuousQA.pause());const next=await page.evaluate(()=>({world:continuousQA.inspect(),finance:continuousQA.finance(),listeners:continuousCounters.listeners,legacy:continuousCounters.legacy,raf:continuousCounters.raf.size}));assert.equal(next.world.sceneId,stable.sceneId);assert.equal(next.world.sceneChildren,stable.sceneChildren);assert.equal(next.listeners,listeners);assert.equal(next.legacy,0);assert.ok(next.finance.session.context.endsWith('_2'));assert.equal(next.finance.cash,cycleCash);assert.equal(next.finance.business.pendingSupplierOrder??null,null);assert.equal(next.raf,0);
    for(const id of ['store','warehouse','production']){await enter(id);await exit(id);}pass(9,'Ciclo sin escenas, NPCs, listeners o RAF duplicados',next);
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.equal(await page.evaluate(()=>continuousCounters.legacy),0);pass(10,'Lobby, vehículo, pedido, caja, producción, decisiones y ciclo',{sale:sold.cash-saleBefore.cash,output:produced,cycle:next.finance.session.context,errors,failures});
    assert.equal(results.length,10);fs.writeFileSync(path.join(output,'functional-results.json'),JSON.stringify({passed:true,results,errors,failures},null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
