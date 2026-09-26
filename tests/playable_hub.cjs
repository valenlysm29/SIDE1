'use strict';
// Real WebGL checks, with third-party requests blocked. Run: node tests/playable_hub.cjs
// A private ephemeral server is used unless SIDE_TEST_URL supplies an existing one.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'output/hub');
fs.mkdirSync(output,{recursive:true});
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.svg':'image/svg+xml'};

async function serve() {
  if(process.env.SIDE_TEST_URL)return {url:process.env.SIDE_TEST_URL,close:async()=>{}};
  const server=http.createServer((request,response)=>{
    let file;
    try {file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));}
    catch {response.writeHead(400).end();return;}
    if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    if(file===root)file=path.join(root,'index.html');
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(resolve=>server.close(resolve))};
}

// These helpers exist only in the response served to the test browser.
const source=fs.readFileSync(path.join(root,'simulator3d.js'),'utf8');
assert.ok(source.includes('  window.SIDE3D = {'),'simulator diagnostics injection point');
const instrumented=source.replace(/new THREE.WebGLRenderer\(\{/g,'new THREE.WebGLRenderer({preserveDrawingBuffer:true,').replace('  window.SIDE3D = {',`  window.hubQA={
  place(x,z,heading=0){keys={};Object.assign(player,{x,z,y:player.baseY,vx:0,vz:0,vy:0,speed:0,grounded:true});yaw=targetYaw=heading;pitch=targetPitch=0;cameraSnap=true;},
  camera(){return {position:camera.position.toArray(),rotation:camera.rotation.toArray().slice(0,3)};},
  inspect(){
    let meshes=0,skinned=0;scene.traverse(n=>{if(n.isMesh)meshes++;if(n.isSkinnedMesh)skinned++});
    return {meshes,skinned,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,backgroundImage:getComputedStyle(renderer.domElement).backgroundImage};
  },
  world(){return hubWorld;},
  screenVersion(){const maps=new Set();hubWorld.group.traverse(n=>{for(const m of n.isMesh?(Array.isArray(n.material)?n.material:[n.material]):[])if(m.map)maps.add(m.map)});return [...maps].reduce((sum,map)=>sum+map.version,0);},
  actors(){return hubActors.map(a=>{const m=a.obj.userData.motion;return {kind:a.obj.userData.modelKind,x:a.obj.position.x,z:a.obj.position.z,phase:m?.phase,distance:m?.distance,knee:m?.bones.ShinL.rotation.x,bones:m?Object.keys(m.bones).length:0};});},
  state(){return {keys,visibilityPaused,running,hubDirectoryOpen,player:{...player},collision:collision(player.x,player.z-.1),actors:this.actors()};},
  pause(){cancelAnimationFrame(raf);},
  draw(){updateGameplayCamera(1/60);updateMinimap();updateHubObjective();renderer.render(scene,camera);},
  stepActors(seconds){for(let i=0;i<Math.round(seconds*60);i++)updateHubActors(1/60);renderer.render(scene,camera);},
  stepPlayer(seconds){for(let i=0;i<Math.round(seconds*60);i++){updatePlayer(1/60);updateGameplayCamera(1/60)}updateMinimap();updateHubObjective();renderer.render(scene,camera);},
  screenshotView(){cancelAnimationFrame(raf);resize();camera.position.set(204,44,63);camera.lookAt(150,1,0);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1];},
  resume(){clock.getDelta();raf=requestAnimationFrame(frame);}
};\n  window.SIDE3D = {`);

(async()=>{
  const local=await serve();
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();
    page.setDefaultTimeout(60000);
    const errors=[],failedLocal=[],checks=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().startsWith(local.url)&&response.status()>=400)failedLocal.push(`${response.status()} ${response.url()}`)});
    await context.route('**/*',route=>{
      const requested=route.request().url();
      if(!requested.startsWith(local.url))return route.abort();
      if(/\/simulator3d\.js(?:\?|$)/.test(requested))return route.fulfill({contentType:'application/javascript',body:instrumented});
      return route.continue();
    });
    await page.goto(local.url,{waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(seed=>{
      localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));
      currentStudent={name:'QA HUB',company:'QA HUB',game:DEMO_GAME};openDecisionMenu();
      Object.assign(decisionDrafts,seed);
      return commitReviewedSections(decisionCategories().map(c=>c.cat),true);
    },seed),true);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    console.log('Hub loaded');
    await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);
    const initial=await page.evaluate(()=>SIDE3D.diagnostics());
    assert.equal(initial.hub.active,true,'entry opens the playable outdoor hub');
    assert.equal(initial.hub.mode,'third','third-person is the outdoor default');
    const geometry=await page.evaluate(()=>hubQA.inspect());
    console.log('Rendered geometry',JSON.stringify(geometry));
    assert.ok(geometry.meshes>100&&geometry.triangles>10000&&geometry.drawCalls>10,'world is rendered from 3D meshes');
    assert.equal(geometry.backgroundImage,'none','canvas does not display a generated still image');
    assert.ok(geometry.skinned>0,'characters use articulated meshes');
    checks.push({entry:initial.hub,geometry});
    // Keep deterministic simulation time independent of the software WebGL GPU.
    await page.evaluate(()=>hubQA.pause());

    const before=await page.evaluate(()=>({player:SIDE3D.diagnostics().player,camera:hubQA.camera()}));
    await page.locator('#side3dCanvas').focus();
    await page.keyboard.down('KeyW');
    await page.evaluate(()=>hubQA.stepPlayer(.7));
    await page.keyboard.up('KeyW');
    const after=await page.evaluate(()=>({player:SIDE3D.diagnostics().player,camera:hubQA.camera()}));
    assert.ok(Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z)>.7,'WASD moves the player');
    assert.notDeepEqual(after.camera.position,before.camera.position,'camera follows walking');
    await page.screenshot({path:path.join(output,'hub-thirdperson.png')});
    checks.push({walking:{before,after}});

    const actorsBefore=await page.evaluate(()=>hubQA.actors());
    assert.ok(actorsBefore.length>=3&&actorsBefore.every(a=>a.bones>=15),'all outdoor pedestrians have articulated rigs');
    await page.evaluate(()=>hubQA.stepActors(5));
    const actorsAfter=await page.evaluate(()=>hubQA.actors());
    assert.ok(actorsAfter.every((actor,i)=>actor.distance-actorsBefore[i].distance>.15),'every pedestrian walks along its route');
    assert.ok(actorsAfter.some((actor,i)=>Math.abs(actor.knee-actorsBefore[i].knee)>.005),'walking changes knee pose');
    checks.push({pedestrians:{before:actorsBefore,after:actorsAfter}});

    await page.locator('#sim3dCameraBtn').click();
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.mode),'first');
    await page.keyboard.press('KeyV');
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.mode),'third');

    const building=await page.evaluate(()=>hubQA.world().colliders.find(c=>c.maxX-c.minX>10&&c.maxZ-c.minZ>6));
    assert.ok(building,'large exterior buildings have collision volumes');
    await page.evaluate(c=>hubQA.place(c.maxX+.8,(c.minZ+c.maxZ)/2,Math.PI/2),building);
    await page.keyboard.down('KeyW');
    await page.evaluate(()=>hubQA.stepPlayer(2));
    await page.keyboard.up('KeyW');
    const blocked=await page.evaluate(()=>SIDE3D.diagnostics().player);
    assert.ok(blocked.x>=building.maxX+.34,'walking cannot pass through a building wall');
    assert.ok(blocked.x<building.maxX+.8,'player approaches the wall before stopping');
    checks.push({buildingCollision:{building,blocked}});

    const entrance=await page.evaluate(()=>hubQA.world().entrances.find(e=>e.id==='store'));
    assert.ok(entrance,'store has an outdoor entrance');
    await page.evaluate(e=>hubQA.place(e.x,e.z),entrance);
    await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.active),false,'E enters the existing business interior');
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.interior),'store');
    assert.ok(await page.evaluate(()=>Math.abs(SIDE3D.diagnostics().player.x)<20),'interior remains in the existing business world');
    await page.locator('#sim3dHubBtn').click();
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.active),true,'PLAZA returns to the outdoor world');
    checks.push({storeEntrance:entrance});
    for(const id of ['production','warehouse']){
      const door=await page.evaluate(id=>hubQA.world().entrances.find(e=>e.id===id),id);
      await page.evaluate(e=>hubQA.place(e.x,e.z),door);
      await page.keyboard.press('KeyE');
      assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.interior),id);
      assert.equal(await page.evaluate(()=>hubQA.state().collision),false,'interior spawn is walkable');
      await page.locator('#sim3dHubBtn').click();
    }
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.visited.length),3,'all three destinations complete exploration');

    const kiosk=await page.evaluate(()=>hubQA.world().kiosk);
    await page.evaluate(k=>hubQA.place(k.x,k.z),kiosk);
    await page.keyboard.press('KeyE');
    await page.locator('#simHubDirectory').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-hub-district="miraflores"]').getAttribute('aria-pressed'),'true');
    const finances=await page.evaluate(()=>JSON.stringify(cashLedger));
    for(const [district,textureDistrict] of [['olivos','olivos'],['sjl','sjl']]) {
      const textureBefore=await page.evaluate(()=>hubQA.screenVersion());
      await page.locator(`[data-hub-district="${district}"]`).click();
      assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.district),district);
      assert.equal(await page.evaluate(()=>hubQA.world().group.userData.district),textureDistrict,'physical kiosk matches selected destination');
      assert.ok(await page.evaluate(()=>hubQA.screenVersion())>textureBefore,'selection refreshes the physical screen texture');
      assert.equal(await page.locator('[data-hub-district][aria-pressed="true"]').count(),1,'only one destination is active');
      assert.equal(await page.locator(`[data-hub-district="${district}"]`).getAttribute('aria-pressed'),'true');
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(cashLedger)),finances,'changing the destination does not charge business decisions');
    const stationary=await page.evaluate(()=>SIDE3D.diagnostics().player);
    await page.keyboard.down('KeyW');
    await page.evaluate(()=>hubQA.stepPlayer(1));
    await page.keyboard.up('KeyW');
    assert.deepEqual(await page.evaluate(()=>SIDE3D.diagnostics().player),stationary,'directory blocks world movement');
    await page.screenshot({path:path.join(output,'hub-directory.png')});
    await page.locator('#simHubVisitStore').click();
    assert.equal(await page.locator('#simHubDirectory').isVisible(),false);
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.active),false);
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.district),'sjl','destination persists inside the shop');
    await page.locator('#sim3dHubBtn').click();
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.district),'sjl','destination persists on return to the plaza');
    checks.push({directory:{kiosk,district:'sjl',preservedFinances:true}});

    const actorCount=await page.evaluate(()=>SIDE3D.diagnostics().hub.actors);
    for(let i=0;i<3;i++) {
      await page.evaluate(()=>SIDE3D.rebuild());
      assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.actors),actorCount,'rebuild does not duplicate pedestrians');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{const p=hubQA.world().spawn;hubQA.place(p.x,p.z)});
    await page.evaluate(()=>hubQA.draw());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile viewport has no horizontal overflow');
    assert.ok(await page.evaluate(()=>document.querySelector('.sim3d-stats').getBoundingClientRect().left>=document.querySelector('.sim-world-location').getBoundingClientRect().right),'mobile location and statistics do not overlap');
    await page.screenshot({path:path.join(output,'hub-mobile.png')});
    await page.evaluate(k=>hubQA.place(k.x,k.z),kiosk);
    await page.keyboard.press('KeyE');
    await page.locator('#simHubDirectory').waitFor({state:'visible'});
    const buttonBounds=await page.locator('[data-hub-district]').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom};}));
    assert.ok(buttonBounds.every(r=>r.x>=0&&r.right<=390&&r.bottom<=844),'all mobile destination buttons are visible');
    await page.screenshot({path:path.join(output,'hub-mobile-directory.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#simHubDirectory').isVisible(),false,'Escape closes the directory');
    await page.setViewportSize({width:1366,height:900});
    const aerial=await page.evaluate(()=>hubQA.screenshotView());
    fs.writeFileSync(path.join(output,'hub-aerial.png'),Buffer.from(aerial,'base64'));
    await page.evaluate(()=>hubQA.resume());
    assert.deepEqual(errors,[],'no browser exceptions');
    assert.deepEqual(failedLocal,[],'all local world assets load');
    fs.writeFileSync(path.join(output,'playable-hub-results.json'),JSON.stringify({passed:true,checks},null,2));
    console.log('PASS playable hub: WebGL geometry, animated pedestrians, walking camera, collision, shop entry, district selection, rebuild and mobile layout');
  } finally {await browser.close();await local.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
