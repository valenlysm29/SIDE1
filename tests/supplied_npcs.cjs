'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const output=path.join(__dirname,'output/npcs');fs.mkdirSync(output,{recursive:true});
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
// Instrument only the test response, so production does not expose mutation/debug APIs.
const source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8');
const instrumented=source.replace('  window.SIDE3D =',`  window.__npcTest={
    manual(){cancelAnimationFrame(raf)},
    spawn(){lastSpawn=-1e9;spawnNpc(performance.now())},
    queueScenario(){
      npcs.forEach(recycleNpcPerson);npcs=[];checkoutQueue=[];
      const obj=acquireNpcPerson({execModel:'chico1'});obj.position.set(1.1,0,3);npcGroup.add(obj);
      const npc=createNpcRecord(obj,1.05,{...CUSTOMER_ARCHETYPES[0],patience:100});npc.speed=1;
      inventory.display[PRODUCTS[0].id]=2;reserveProductForNpc(npc,PRODUCTS[0]);attachBagToNpc(npc);npcs.push(npc);tryJoinQueue(npc);
      return {boneAttached:Boolean(obj.userData.heldBag.parent.isBone),revenue:gameSession.revenue};
    },
    charge(){serveNextQueuedCustomer(false);return gameSession.revenue},
    step(seconds){
      const states=new Set(),violations=[];
      for(let i=0;i<Math.round(seconds*60);i++){
        npcs.forEach(n=>{if(!n.dead)states.add(n.state);moveNpc(n,1/60);if(!n.dead)states.add(n.state)});
        npcs=npcs.filter(n=>!n.dead);animateActors(i/60,1/60);
        for(const n of npcs)for(const c of npcObstacles()){
          if(n.obj.position.x>c.minX-.28&&n.obj.position.x<c.maxX+.28&&n.obj.position.z>c.minZ-.28&&n.obj.position.z<c.maxZ+.28){if(violations.length<8)violations.push({state:n.state,x:n.obj.position.x,z:n.obj.position.z,collider:c})};
        }
      }
      renderer.render(scene,camera);return {states:[...states],violations,diag:diagnostics()};
    },
    view(){camera.position.set(0,2.2,17);camera.lookAt(0,1.3,10.8);renderer.render(scene,camera)},
    obstacleData(){return [...colliders,...dynamicColliders]},
    inspect(){return npcs.map(n=>({kind:n.obj.userData.modelKind,state:n.state,x:n.obj.position.x,z:n.obj.position.z,route:n.route,index:n.routeIndex,blocked:n.blockedFor,routeBlocked:n.routeBlocked}))}
  };
  window.SIDE3D =`);

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try {
  const context=await browser.newContext({viewport:{width:1400,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'tools/npc_preview.html?manual');await page.waitForFunction(()=>window.ready||window.previewError,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.previewError),undefined);
  const pose=await page.evaluate(()=>{
    const initial=preview.actors.map(a=>({kind:a.userData.modelKind,bones:Object.keys(a.userData.motion.bones).length,phase:a.userData.motion.phase}));
    for(let i=0;i<90;i++)preview.step(1/60,.95,false);
    const moving=preview.actors.map(a=>({kind:a.userData.modelKind,phase:a.userData.motion.phase,knee:a.userData.motion.bones.ShinL.rotation.x,blend:a.userData.motion.blend,distance:a.userData.motion.distance}));
    return {initial,moving};
  });
  assert.equal(pose.initial.length,4);assert.ok(pose.initial.every(a=>a.bones===17));
  assert.ok(pose.moving.every(a=>a.distance>1.3&&Math.abs(a.knee)>.025&&a.blend>.99));
  await page.screenshot({path:path.join(output,'four-npcs-walking.png')});
  // Same distance must produce the same gait phase at different update frequencies.
  const timing=await page.evaluate(()=>{
    const result=[];
    for(const fps of [30,60,120]){
      const a=preview.actors[0];a.position.z=0;preview.resetMotion(a);preview.animateNpc(a,1/fps,false);
      for(let i=0;i<fps*2;i++){a.position.z+=1/fps;preview.animateNpc(a,1/fps,true)}
      result.push({fps,phase:a.userData.motion.phase,distance:a.userData.motion.distance});
    }
    return result;
  });
  assert.ok(Math.max(...timing.map(a=>a.phase))-Math.min(...timing.map(a=>a.phase))<1e-6);
  const stopped=await page.evaluate(()=>{
    const a=preview.actors[0],phase=a.userData.motion.phase;
    for(let i=0;i<90;i++)preview.animateNpc(a,1/60,false);
    return {phase,after:a.userData.motion.phase,blend:a.userData.motion.blend,knee:a.userData.motion.bones.ShinL.rotation.x};
  });
  assert.equal(stopped.phase,stopped.after);assert.ok(stopped.blend<.001&&Math.abs(stopped.knee)<.001);
  const contact=await page.evaluate(()=>{
    return preview.actors.map(a=>{
      preview.resetMotion(a);a.position.z=0;preview.animateNpc(a,1/60,false);
      let slip=0,lowest=10;const previous={};
      for(let i=0;i<180;i++){
        a.position.z+=1/60;preview.animateNpc(a,1/60,true);const m=a.userData.motion;
        for(const [side,offset] of [['L',0],['R',.5]]){
          const foot=m.bones['Foot'+side],v=foot.getWorldPosition(foot.position.clone()),phase=(m.phase+offset)%1;
          if(i>60&&phase>.04&&phase<.55&&previous[side]?.phase<phase)slip=Math.max(slip,Math.hypot(v.x-previous[side].x,v.z-previous[side].z));
          previous[side]={x:v.x,z:v.z,phase};
        }
        if(i>60&&i%30===0)a.traverse(node=>{if(node.isSkinnedMesh){node.computeBoundingBox();lowest=Math.min(lowest,node.boundingBox.min.y)}});
      }
      return {kind:a.userData.modelKind,maxSupportSlipPerFrame:slip,lowestFoot:lowest};
    });
  });
  assert.ok(contact.every(a=>a.maxSupportSlipPerFrame<.001&&a.lowestFoot>-.003));
  results.push({preview:'passed',pose,timing,stopped,contact});await context.close();
  for(const fallback of [false,true]) {
    const ctx=await browser.newContext({viewport:{width:1280,height:800}}),p=await ctx.newPage(),pageErrors=[];
    p.on('pageerror',e=>pageErrors.push(e.message));
    await ctx.route('**/*',async route=>{
      const url=route.request().url();
      if(!url.startsWith(base)||(fallback&&/\/npcs\/(chico[123]|mona)\.glb$/.test(url)))return route.abort();
      if(/\/simulator3d\.js(?:\?|$)/.test(url))return route.fulfill({status:200,contentType:'application/javascript',body:instrumented});
      return route.continue();
    });
    await p.goto(base);
    await p.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA NPC',company:'QA NPC',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);renderDecisionCategory();openCompanyReview()},seed);
    await p.locator('#confirmCompanyReview').click();assert.equal(await p.evaluate(()=>startSimulationLoading()),true);
    await p.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);await p.evaluate(()=>__npcTest.manual());
    const initial=await p.evaluate(()=>SIDE3D.diagnostics());
    assert.equal(initial.suppliedNpcs.loaded.length,fallback?0:3);assert.equal(initial.mona.loaded,!fallback);
    assert.equal(initial.suppliedNpcs.actors.length,4);assert.equal(initial.mona.instances,1);
    for(const name of ['Joel','Miguel','Gonzalo','Valeria'])assert.ok(initial.characters.some(c=>c.name===name),`visible name: ${name}`);
    if(!fallback)assert.ok(initial.suppliedNpcs.actors.every(a=>a.rigged));
    for(let i=0;i<3;i++){await p.evaluate(()=>SIDE3D.rebuild());const d=await p.evaluate(()=>SIDE3D.diagnostics());assert.equal(d.suppliedNpcs.actors.length,4);assert.equal(d.mona.instances,1)}
    await p.evaluate(()=>{__npcTest.spawn();__npcTest.spawn();__npcTest.spawn()});
    const travel=await p.evaluate(()=>__npcTest.step(100));
    fs.writeFileSync(path.join(output,fallback?'fallback-travel.json':'travel.json'),JSON.stringify({travel,details:await p.evaluate(()=>__npcTest.inspect())},null,2));
    assert.deepEqual(travel.violations,[],'customers must not intersect furniture');
    assert.ok(travel.states.includes('ENTER_STORE'),'customers enter through the door');
    assert.ok(travel.states.includes('BROWSE'),'customers reach products');
    assert.ok(travel.states.includes('LEAVE_STORE')||travel.states.includes('QUEUE'),'customers complete a decision');
    if(!fallback)assert.ok(travel.diag.suppliedNpcs.actors.every(a=>a.distance>1),'all four patrol');
    const basket=await p.evaluate(()=>__npcTest.queueScenario());
    assert.equal(basket.boneAttached,!fallback);
    assert.equal(await p.evaluate(()=>__npcTest.charge()),basket.revenue,'no charge while the customer is still walking to the till');
    const queue=await p.evaluate(()=>__npcTest.step(35));
    fs.writeFileSync(path.join(output,fallback?'queue-fallback.json':'queue.json'),JSON.stringify({queue,details:await p.evaluate(()=>__npcTest.inspect())},null,2));
    assert.ok(queue.states.includes('QUEUE'),'the customer reaches the checkout queue');assert.deepEqual(queue.violations,[]);
    const revenue=await p.evaluate(()=>__npcTest.charge());assert.equal(revenue,basket.revenue+75,'the existing checkout still records the sale');
    await p.evaluate(()=>__npcTest.view());await p.screenshot({path:path.join(output,fallback?'game-fallback.png':'game-npcs.png')});
    await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(pageErrors,[]);results.push({fallback,initial,travel,queue:queue.states,basket,status:'passed'});console.log('PASS NPC world',fallback?'fallback':'four GLB');await ctx.close();
  }
  assert.deepEqual(errors,[]);
 } finally {await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
