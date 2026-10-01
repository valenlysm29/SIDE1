'use strict';
// Real GLBs and the production update functions. Only this browser response
// exposes QA helpers; no test hooks or substituted physics ship in the game.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const output=path.join(__dirname,'output/npc-tablet-hud-2026-09-30');fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8');
assert.ok(source.includes('  window.SIDE3D = {'));
const instrumented=source.replace('  window.SIDE3D = {',`  window.npcWorldQA={
  freeze(){cancelAnimationFrame(raf);},
  actors(){return [...hubActors,...animatedActors.filter(a=>a.obj?.userData.role==='guide')];},
  rooms(){return businessInteriors.rooms.map(r=>r.id);},
  measure(object){scene.updateMatrixWorld(true);const bounds=new THREE.Box3();object.traverse(n=>{if(n.isMesh&&n.name!=='ContactShadow'&&!n.userData.characterAccessory)bounds.expandByObject(n,true);});const p=object.getWorldPosition(new THREE.Vector3()),floor=businessInteriors?.groundHeightAt(p.x,p.z)??hubWorld.groundHeightAt(p.x,p.z);return {kind:object.userData.modelKind||object.userData.role,name:object.name,x:p.x,y:p.y,z:p.z,height:bounds.max.y-bounds.min.y,foot:bounds.min.y,ground:object.userData.groundHeight??null,floor,target:object.userData.characterGeometry?.height??null};},
  snapshot(){return {player:this.measure(playerAvatar),outdoor:this.actors().filter(a=>a.obj.visible).map(a=>this.measure(a.obj)),interior:(businessInteriors?.rooms||[]).flatMap(r=>r.actors.map(a=>({...this.measure(a.object),room:r.id,visible:a.object.visible}))) };},
  simulate(seconds){const actors=this.actors().filter(a=>a.obj.visible),travel=actors.map(()=>0),initial=actors.map(a=>({x:a.obj.position.x,z:a.obj.position.z}));let roots=0,feet=0,tallest=0,heightExcess=-Infinity;
    for(let i=0;i<Math.round(seconds*60);i++){const before=actors.map(a=>({x:a.obj.position.x,z:a.obj.position.z}));updateHubActors(1/60);businessInteriors.tick(1/60,player,i/60);updateGameplayCamera(1/60);actors.forEach((a,k)=>travel[k]+=Math.hypot(a.obj.position.x-before[k].x,a.obj.position.z-before[k].z));if(i%60===0){const playerHeight=this.measure(playerAvatar).height;for(const a of [...actors.map(a=>a.obj),...(businessInteriors.rooms.find(r=>r.id===currentInterior)?.actors||[]).map(a=>a.object)]){const m=this.measure(a);if(m.floor!==null){roots=Math.max(roots,Math.abs(m.y-m.floor));feet=Math.max(feet,Math.abs(m.foot-m.floor));}tallest=Math.max(tallest,m.height);heightExcess=Math.max(heightExcess,m.height-playerHeight);}}}
    return {travel,displacement:actors.map((a,k)=>Math.hypot(a.obj.position.x-initial[k].x,a.obj.position.z-initial[k].z)),maxRootError:roots,maxFootError:feet,maxHeightExcess:heightExcess,tallest,snapshot:this.snapshot()};},
  room(id){const room=businessInteriors.rooms.find(r=>r.id===id);businessInteriors.ensureRoom(room);positionPlayer(HUB_OFFSET+room.layout.x,room.layout.z,0);updateBusinessZone();businessInteriors.tick(1/60,player,0);updateGameplayCamera(1);return room.id;},
  clientFloorProbe(){const obj=person({cityRole:'cliente',cityScene:'store'});obj.position.set(player.x,.025,player.z);scene.add(obj);for(let i=0;i<60*60;i++)setPersonPose(obj,i/60,false,1/60,0);const measured=this.measure(obj);obj.removeFromParent();return measured;},
  plaza(){enterHub(false);positionPlayer(HUB_OFFSET+16,27,0);updateGameplayCamera(1);},
  collisions(mode){this.plaza();cameraMode=mode;const actor=this.actors()[0],old=actor.obj.position.clone(),savedCar={...hubVehicles.cruiser};actor.obj.position.set(HUB_OFFSET+16,.025,25);groundPerson(actor.obj);positionPlayer(HUB_OFFSET+16,26.1,0);keys={KeyW:true};let minimum=Infinity,maxStep=0,walls=false;
    for(let i=0;i<120;i++){const before={x:player.x,z:player.z};updatePlayer(1/60);updateGameplayCamera(1/60);minimum=Math.min(minimum,Math.hypot(player.x-actor.obj.position.x,player.z-actor.obj.position.z));maxStep=Math.max(maxStep,Math.hypot(player.x-before.x,player.z-before.z));walls ||= collision(player.x,player.z,false);}
    const contact={x:player.x,z:player.z};keys={KeyD:true};for(let i=0;i<120;i++)updatePlayer(1/60);const escaped=Math.hypot(player.x-contact.x,player.z-contact.z);keys={};
    actor.obj.position.set(HUB_OFFSET+16,.025,29.5);groundPerson(actor.obj);const car=hubVehicles.cruiser;Object.assign(car,{x:HUB_OFFSET+16,z:34,yaw:0,speed:0,steer:0});positionPlayer(car.x,car.z,0);driving=car;keys={KeyW:true};let carMinimum=Infinity;
    for(let i=0;i<240;i++){updateDriving(1/60);updateGameplayCamera(1/60);for(const circle of hubVehicles.navigationNeighbors().slice(0,3))carMinimum=Math.min(carMinimum,Math.hypot(circle.x-actor.obj.position.x,circle.z-actor.obj.position.z));}
    const stopped=Math.abs(car.speed)<.01,carTravel=Math.hypot(car.x-(HUB_OFFSET+16),car.z-34);keys={};driving=null;Object.assign(car,{x:savedCar.x,z:savedCar.z,yaw:savedCar.yaw,speed:0,steer:0});actor.obj.position.copy(old);this.plaza();return {mode,minimum,required:player.radius+npcNavigation.NPC_RADIUS,maxStep,walls,escaped,carMinimum,carRequired:.94+npcNavigation.NPC_RADIUS,stopped,carTravel};},
  hud(){let destinationObjects=[];scene.traverse(n=>{if(n.name==='Next destination')destinationObjects.push(n.name);});return {destinationObjects,overlays:document.querySelectorAll('.sim-zone-label,.sim-edge-guide,#simZoneLabels,#simRouteMarker').length,mapIcons:document.querySelectorAll('#simCityMapArea .sim-city-zone').length,objective:document.getElementById('simHubObjective')?.textContent||'',stats:!!document.querySelector('.sim3d-stats'),missions:!!document.querySelector('.sim3d-missions')};}
};\n  window.SIDE3D = {`);
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['miraflores'],quantities:{miraflores:1}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results={};
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>!r.request().url().startsWith(url)?r.abort():/\/js\/simulator3d\.js(?:\?|$)/.test(r.request().url())?r.fulfill({contentType:'application/javascript',body:instrumented}):r.continue());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA NPC',company:'QA NPC',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);return commitReviewedSections(decisionCategories().map(c=>c.cat),true);},seed),true);
  assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
  await page.evaluate(()=>SIDE3D.preloadDetails());await page.evaluate(()=>npcWorldQA.freeze());
  results.start=await page.evaluate(()=>npcWorldQA.snapshot());
  assert.equal(results.start.outdoor.length,4,'three pedestrians and the mobile guide');
  results.windows=[];
  for(let window=0;window<12;window++){
   const measurement=await page.evaluate(()=>npcWorldQA.simulate(5));results.windows.push(measurement);
   for(const [index,travel] of measurement.travel.entries())assert.ok(travel>.12,`actor ${index} moves in window ${window}: ${travel}`);
   for(const [index,distance] of measurement.displacement.entries())assert.ok(distance>.12,`actor ${index} has net progress in window ${window}: ${distance}`);
   assert.ok(measurement.maxRootError<.0001,JSON.stringify(measurement));
   assert.ok(measurement.maxFootError<.05,`animated feet within 5cm of real floor: ${measurement.maxFootError}`);
   assert.ok(measurement.tallest<=1.75+.0001,`animated NPC height ${measurement.tallest} <= player target 1.75m`);
   assert.ok(measurement.maxHeightExcess<=.0001,`actual animated NPC <= actual animated player: ${measurement.maxHeightExcess}`);
  }
  console.log('PASS all 4 outdoor NPCs: 60 seconds, 12 movement windows, actual animated mesh height/feet and ground roots');
  results.interiors=[];
  const rooms=await page.evaluate(()=>npcWorldQA.rooms());
  for(const id of rooms){
   await page.evaluate(id=>npcWorldQA.room(id),id);const measured=await page.evaluate(()=>npcWorldQA.simulate(60));results.interiors.push({id,...measured});
   // Compare against the rendered floor's world transform, which catches
   // selecting the terrain below a building or using a local Y as world Y.
   assert.ok(Number.isFinite(measured.snapshot.player.floor),`room ${id} rendered floor exists`);
   assert.ok(Math.abs(measured.snapshot.player.y-measured.snapshot.player.floor)<.01,`room ${id} player anchors to the rendered indoor floor`);
   const client=await page.evaluate(()=>npcWorldQA.clientFloorProbe());results.interiors.at(-1).clientProbe=client;
   assert.ok(Math.abs(client.y-client.floor)<.01,`room ${id} general client factory anchors to interior rather than terrain: ${JSON.stringify(client)}`);
   assert.ok(Math.abs(client.foot-client.floor)<.05,`room ${id} client feet remain on indoor floor`);
   for(const actor of measured.snapshot.interior.filter(a=>a.room===id)){
    assert.ok(actor.target&&actor.target<=measured.snapshot.player.target,JSON.stringify(actor));
    assert.ok(actor.height<=1.75+.0001,`room ${id} NPC animated height: ${actor.height}`);
    assert.ok(Number.isFinite(actor.floor),`room ${id} floor found beneath NPC`);
    assert.ok(Math.abs(actor.y-actor.floor)<.01,`room ${id} root on floor`);
    assert.ok(Math.abs(actor.foot-actor.floor)<.05,`room ${id} feet on floor: ${JSON.stringify(actor)}`);
   }
   assert.ok(measured.maxFootError<.05,`room ${id} animated feet drift ${measured.maxFootError}`);
   assert.ok(measured.maxHeightExcess<=.0001,`room ${id} actual NPC height exceeds actual player by ${measured.maxHeightExcess}`);
  }
  console.log('PASS all streamed business interiors: real NPC GLB bounds and ground after 60 simulated seconds per room');
  results.collisions=[];
  for(const mode of ['first','third']){
   const contact=await page.evaluate(mode=>npcWorldQA.collisions(mode),mode);results.collisions.push(contact);
   assert.ok(contact.minimum>=contact.required-1e-6,JSON.stringify(contact));assert.ok(contact.maxStep<.1,JSON.stringify(contact));assert.equal(contact.walls,false);assert.ok(contact.escaped>1,JSON.stringify(contact));
   assert.ok(contact.carTravel>.1,`car genuinely advances before contact: ${JSON.stringify(contact)}`);assert.ok(contact.carMinimum>=contact.carRequired-1e-6,JSON.stringify(contact));assert.equal(contact.stopped,true);
  }
  console.log('PASS production foot/car NPC contact, slide escape, walls and step budget in first/third camera');
  results.hud=await page.evaluate(()=>npcWorldQA.hud());assert.deepEqual(results.hud.destinationObjects,[]);assert.equal(results.hud.overlays,0);assert.equal(results.hud.mapIcons,7);assert.equal(results.hud.stats,true);assert.equal(results.hud.missions,true);
  assert.deepEqual(errors,[]);results.errors=errors;console.log('PASS clean scene/DOM with preserved minimap destinations and HUD');
 }finally{fs.writeFileSync(path.join(output,'npc-world-fixes-results.json'),JSON.stringify(results,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
