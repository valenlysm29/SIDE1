'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL;
if(!url)throw Error('Run with node tests/run_world_regression.cjs world_entry_assets.cjs');
const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8').replace('  window.SIDE3D = {',`  window.entryQA={
  pause(){cancelAnimationFrame(raf);},
  store(){const e=hubWorld.entrances.find(e=>e.id==='store');positionPlayer(e.x,e.z,0);keys={KeyW:true};for(let i=0;i<95;i++){updatePlayer(1/60);businessInteriors.tick(1/60,player,i/60);}keys={};updateGameplayCamera(1);return currentInterior;},
  move(){const z=player.z;keys={KeyW:true};updatePlayer(.04);keys={};return Math.abs(player.z-z);},
  stats(){const room=businessInteriors.rooms.find(r=>r.id==='store'),streamedCharacters=hubActors.length+animatedActors.filter(a=>a.type==='guide').length;return {scene:scene.uuid,children:scene.children.length,streamedCharacters,actors:room.actors.map(a=>({role:a.object.userData.role,kind:a.object.userData.modelKind,pending:Boolean(a.object.userData.pendingCharacterStyle),x:a.object.position.x,z:a.object.position.z})),ledger:JSON.stringify(bridge().ledger)};},
  render(){renderer.render(scene,camera);}
};\n  window.SIDE3D = {`);
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  let release;const gate=new Promise(resolve=>release=resolve),held=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const request=route.request().url();
      if(!request.startsWith(url))return route.abort();
      if(/\/js\/simulator3d\.js(?:\?|$)/.test(request))return route.fulfill({contentType:'application/javascript',body:source});
      if(/npc_realistic_(male|female)\.glb$/.test(request)){held.push(request);await gate;}
      return route.continue();
    });
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{localStorage.clear();currentStudent={name:'QA ENTRY',company:'QA ENTRY',game:DEMO_GAME};openDecisionMenu();});
    const storage=await page.evaluate(()=>JSON.stringify({...localStorage}));
    assert.equal(await page.evaluate(async()=>{const results=await Promise.all([SIDE3D.preload(),SIDE3D.preload()]);return results.every(Boolean);}),true);
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),storage,'essential preload leaves financial state untouched');
    assert.deepEqual(held,[],'essential preload does not request indoor staff');
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>0);await page.evaluate(()=>entryQA.pause());
    assert.ok(await page.evaluate(()=>entryQA.move())>0,'controls work while staff network is stalled');
    await page.evaluate(()=>{window.detailsA=SIDE3D.preloadDetails();window.detailsB=SIDE3D.preloadDetails();});
    const staffDeadline=Date.now()+60000;
    while(held.length<2&&Date.now()<staffDeadline)await page.waitForTimeout(100);
    assert.equal(held.length,2,'parallel callers share the two staff requests');
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().assets.detailsReady),false);
    assert.equal(await page.evaluate(()=>entryQA.store()),'store','door works even before indoor staff arrive');
    const before=await page.evaluate(()=>entryQA.stats());assert.equal(before.actors.length,4);
    assert.equal(before.actors.filter(a=>a.pending).length,2,'two temporary workers keep the room populated');
    release();await page.evaluate(()=>Promise.all([detailsA,detailsB]));
    const after=await page.evaluate(()=>entryQA.stats());
    assert.equal(after.scene,before.scene);
    assert.equal(after.streamedCharacters-before.streamedCharacters,4,'details stream three city pedestrians and the guide');
    assert.equal(after.children-before.children,4,'only streamed characters extend the existing scene');
    assert.equal(after.actors.length,before.actors.length);assert.equal(after.ledger,before.ledger);
    for(const role of ['cashier','salesperson']){
      const a=after.actors.find(a=>a.role===role),b=before.actors.find(a=>a.role===role);assert.equal(a.pending,false);assert.equal(a.x,b.x);assert.equal(a.z,b.z);
      assert.ok(a.kind.startsWith('city:'),`${role} upgrades to an approved city NPC`);
    }
    await page.evaluate(()=>entryQA.render());
    await page.screenshot({path:path.join(__dirname,'output/continuous/entry-streaming.png')});
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
    assert.equal(resources.some(name=>name.includes('recast')),false,'entry does not load unused recast navigation');
    assert.equal(resources.some(name=>name.includes('npc_realistic_male_casual.glb')),false,'entry does not load the legacy casual model');
    assert.deepEqual(errors,[]);console.log('PASS nonblocking entry, shared asset requests, staff upgrade in place, unchanged scene/ledger and no unused navigation/model');
  }finally{release();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
