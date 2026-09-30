'use strict';
// Actual game/renderer regression. SwiftShader counts are not GPU FPS.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'output');
const seed = {
  MOLDE: { optionIds: ['molde_1'] }, PRODUCCION_META: { moldTargets: { molde_1: 10, molde_2: 0, molde_3: 0 } },
  CUERO: { quantities: { cuero_sint: 3 } }, ACCESORIOS: { quantities: { acc_eco: 10 } }, HILO: { quantities: { hilo_std: 1 } },
  GARANTIA_PT: { optionIds: ['pt_30'] }, CANALES: { optionIds: ['sjl'], quantities: { sjl: 2 } }, INV_MARKETING: { optionIds: ['mkt_baja'] }
};
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.svg': 'image/svg+xml' };
async function serve() {
  const server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`); } catch { res.writeHead(400).end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (file === root) file = path.join(root, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve)) };
}
const original = fs.readFileSync(path.join(root, 'simulator3d.js'), 'utf8');
assert.ok(original.includes('  window.SIDE3D = {'));
const instrumented = original.replace('  window.SIDE3D = {', `  window.decisionInteriorQA = {
    pause() { cancelAnimationFrame(raf); if(detailsTimer){clearTimeout(detailsTimer);detailsTimer=0;} },
    deferred() {return businessInteriors.rooms.filter(room=>['office','bank','suppliers'].includes(room.id)).map(room=>({id:room.id,deferred:room.deferred,children:room.detail.children.length}));},
    tick() {
      businessInteriors.tick(0,player,0);updateBusinessZone();
      for(const point of businessInteriors.hotspots)if(point.type==='decisionZone'&&!interactables.some(existing=>existing.id===point.id))interactables.push(point);
      updateGameplayCamera(1/60);renderer.render(scene,camera);
    },
    async tier(mode) {setGraphicsQuality(mode);await loadCityNpcModels();this.tick();},
    door(id, inward) {
      const room=businessInteriors.rooms.find(room=>room.id===id),l=room.layout;
      const axis=l.axis,dir=l.direction;
      const at = distance => ({x:HUB_OFFSET+l.doorX+(axis==='x'?distance*dir:0),z:l.doorZ+(axis==='z'?distance*dir:0)});
      const samples=[];
      for(let distance=-1.6;distance<=1.6;distance+=.2){const p=at(distance);samples.push({...p,blocked:collision(p.x,p.z)});}
      const p=at(inward?1.6:-1.6);positionPlayer(p.x,p.z,axis==='x'?(dir>0?-Math.PI/2:Math.PI/2):(dir>0?Math.PI:0));this.tick();
      return {zone:currentInterior,samples,position:{x:player.x,z:player.z},camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z}};
    },
    colliders(id) {
      const values=businessInteriors.colliders.filter(box=>box.zone===id);
      return values.map(box=>({kind:box.kind,blocked:collision((box.minX+box.maxX)/2,(box.minZ+box.maxZ)/2),registered:hubWorld.colliders.includes(box)}));
    },
    interaction(id) {
      const point=businessInteriors.hotspots.find(point=>point.zone===id&&point.type==='decisionZone');
      positionPlayer(point.x,point.z,0);this.tick();
      const selected=nearestInteractable();const gameBridge=bridge(),previous=gameBridge.openDecisionCategory;let opened=null;
      gameBridge.openDecisionCategory=category=>{opened=category;};
      try{running=true;interact();}finally{gameBridge.openDecisionCategory=previous;running=true;}
      return {point:point.id,nearest:selected?.id,opened,blocked:collision(point.x,point.z)};
    },
    actors(id) {
      const room=businessInteriors.rooms.find(room=>room.id===id);
      const local=room.actors.map(actor=>({role:actor.route.role,id:actor.object.userData.cityNpcId||null,visible:actor.object.visible}));
      const visibleIds=[];scene.updateMatrixWorld(true);scene.traverse(obj=>{if(!obj.userData.cityNpcId)return;for(let p=obj;p;p=p.parent)if(!p.visible)return;const p=obj.getWorldPosition(new THREE.Vector3());if(Math.hypot(p.x-HUB_OFFSET-room.layout.x,p.z-room.layout.z)<24)visibleIds.push(obj.userData.cityNpcId);});
      return {local,visibleIds,count:room.actors.length};
    },
    async navigation(id,mode) {return {ready:await businessInteriors.interiorNavigation.waitReady(id,mode),stats:businessInteriors.interiorNavigation.stats()};},
    measure(id,mode) {
      const room=businessInteriors.rooms.find(room=>room.id===id);setCameraMode('first');this.door(id,true);
      renderer.render(scene,camera);renderer.render(scene,camera);
      return {mode,room:id,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,actors:this.actors(id),camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z}};
    }
  };
  window.SIDE3D = {`);
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const local=await serve();
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[],failedLocal=[],results={measurement:'Actual scene, 1366x900, first-person at inner door; SwiftShader CPU renderer, no claim about GPU FPS',tiers:{},checks:{}};
  try {
    const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();page.setDefaultTimeout(60000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().startsWith(local.url)&&response.status()>=400)failedLocal.push(response.status()+' '+response.url());});
    await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(local.url))return route.abort();if(/\/simulator3d\.js(?:\?|$)/.test(url))return route.fulfill({contentType:'application/javascript',body:instrumented});return route.continue();});
    await page.goto(local.url,{waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(seedValue=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA INTERIORS',company:'QA INTERIORS',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seedValue);return commitReviewedSections(decisionCategories().map(category=>category.cat),true);},seed),true);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await page.evaluate(()=>decisionInteriorQA.pause());
    results.deferred=await page.evaluate(()=>decisionInteriorQA.deferred());
    assert.ok(results.deferred.every(room=>room.deferred&&room.children===0),'service interiors stay unallocated at initial spawn');
    for(const tier of ['low','medium','high','auto']) {
      await page.evaluate(mode=>decisionInteriorQA.tier(mode),tier);results.tiers[tier]={};
      for(const [id,category] of Object.entries({office:'B',bank:'E',suppliers:'F'})) {
        const entered=await page.evaluate(id=>decisionInteriorQA.door(id,true),id);
        assert.equal(entered.zone,id,`${tier} ${id} enter`);
        assert.ok(entered.samples.every(point=>!point.blocked),`${tier} ${id} continuous doorway collision`);
        assert.ok(Object.values(entered.camera).every(Number.isFinite),`${id} camera finite`);
        const collisions=await page.evaluate(id=>decisionInteriorQA.colliders(id),id);
        assert.ok(collisions.length>3&&collisions.every(box=>box.blocked&&box.registered),`${id} furniture collision in real world`);
        const interaction=await page.evaluate(id=>decisionInteriorQA.interaction(id),id);
        assert.equal(interaction.opened,category,`${tier} ${id} category interaction`);
        const nav=await page.evaluate(({id,tier})=>decisionInteriorQA.navigation(id,tier),{id,tier});
        assert.equal(nav.ready,tier!=='low',`${tier} ${id} navmesh tier`);
        const count=(await page.evaluate(id=>decisionInteriorQA.actors(id),id)).count;
        for(let visit=0;visit<3;visit++) {
          assert.equal((await page.evaluate(id=>decisionInteriorQA.door(id,false),id)).zone,null,`${id} exit`);
          await page.evaluate(id=>decisionInteriorQA.door(id,true),id);
          const actors=await page.evaluate(id=>decisionInteriorQA.actors(id),id);
          assert.equal(actors.count,count,`${id} actor count stable`);
          assert.equal(new Set(actors.visibleIds).size,actors.visibleIds.length,`${tier} ${id} unique active CC0 actors`);
        }
        const measure=await page.evaluate(({id,tier})=>decisionInteriorQA.measure(id,tier),{id,tier});
        assert.ok(measure.calls>0&&measure.calls<300,`${id} draw call budget`);
        assert.ok(measure.triangles>0&&measure.triangles<200000,`${id} triangle budget`);
        results.tiers[tier][id]=measure;results.checks[`${tier}-${id}`]={entered:true,exited:true,category:interaction.opened,colliders:collisions.length,navigationReady:nav.ready,actors:count};
        console.log(`${tier} ${id}: ${measure.calls} calls, ${measure.triangles} triangles; entry/exit, decision, collision, actors passed`);
        if(tier==='high')await page.screenshot({path:path.join(output,`decision-interiors-${id}.png`)});
        await page.evaluate(id=>decisionInteriorQA.door(id,false),id);
      }
    }
    assert.deepEqual(errors,[],'browser exceptions');assert.deepEqual(failedLocal,[],'local asset failures');
    fs.writeFileSync(path.join(output,'decision-interiors-performance.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));await context.close();
  } finally {await browser.close();await local.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
