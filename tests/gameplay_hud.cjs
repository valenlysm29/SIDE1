// Isolated read-only guidance and responsive HUD checks with real local WebGL.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'output/gameplay');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png'};
const source=fs.readFileSync(path.join(root,'simulator3d.js'),'utf8').replace('  window.SIDE3D = {',`  window.objectiveQA={
  freeze(){cancelAnimationFrame(raf);},
  update(){updateHubObjective();},
  enter(id){const e=hubWorld.entrances.find(e=>e.id===id);positionPlayer(e.x,e.z,0);keys.KeyW=true;for(let i=0;i<110;i++)updatePlayer(1/60);keys={};},
  pending(){businessState.pendingSupplierOrder={id:'qa-pending',units:12,dueAt:Date.now()+60000};updateHubObjective();},
  snapshot(){return JSON.stringify({inventory,businessState,ledger:bridge().ledger});},
  state(){return {waypoint:hubWaypoint.visible,position:hubWaypoint.position.toArray()};}
};\n  window.SIDE3D = {`);
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost');
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    if(file===path.join(root,'simulator3d.js'))response.end(source);else fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
    page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(seed=>{
      localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));
      currentStudent={name:'QA GAMEPLAY',company:'QA GAMEPLAY',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);
      commitReviewedSections(decisionCategories().map(c=>c.cat),true);
    },seed);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);
    await page.evaluate(()=>objectiveQA.freeze());
    const before=await page.evaluate(()=>objectiveQA.snapshot());
    await page.evaluate(()=>{for(let i=0;i<100;i++)objectiveQA.update();});
    assert.equal(await page.evaluate(()=>objectiveQA.snapshot()),before,'guidance never mutates inventory, business state or ledger');
    assert.match(await page.locator('#simHubCycle').innerText(),/CICLO 1/);
    await page.screenshot({path:path.join(output,'desktop.png')});
    await page.evaluate(()=>objectiveQA.enter('warehouse'));
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.active),true);
    assert.equal(await page.evaluate(()=>SIDE3D.diagnostics().hub.interior),'warehouse');
    await page.screenshot({path:path.join(output,'interior.png')});
    await page.setViewportSize({width:390,height:844});
    await page.locator('#sim3dHubBtn').click();
    assert.equal(await page.locator('#simHubDirectory').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sim3d-missions').isVisible(),true,'portrait missions remain available');
    assert.equal(await page.locator('#simHubObjective').isVisible(),true);
    assert.equal(await page.locator('#simTotalStock').isVisible(),true,'mobile keeps inventory visible');
    assert.equal(await page.locator('#simRating').isVisible(),true,'mobile keeps satisfaction visible');
    await page.evaluate(()=>objectiveQA.pending());
    assert.equal(await page.locator('#simHubOrder').isVisible(),true,'pending delivery stays visible independently of the current objective');
    const layout=await page.evaluate(()=>{
      const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
      return {missions:box('.sim3d-missions'),stats:box('.sim3d-stats'),location:box('.sim-world-location'),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(layout.overflow,false);assert.ok(layout.location.right<=layout.stats.left,'navigation and financial HUD are separate');
    assert.ok(layout.missions.top>=layout.stats.bottom,'missions sit below the financial HUD');
    await page.screenshot({path:path.join(output,'mobile.png')});
    await page.locator('#simMissionToggle').click();
    assert.equal(await page.locator('#simMissionList').isVisible(),false,'mission collapse works on mobile');
    await page.setViewportSize({width:844,height:390});
    assert.equal(await page.locator('#simTotalStock').isVisible(),true,'landscape keeps inventory visible');
    assert.equal(await page.locator('#simHubOrder').isVisible(),true);
    await page.screenshot({path:path.join(output,'landscape.png')});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,layout},null,2));
    console.log('PASS read-only objectives, local WebGL, interior access and mobile HUD');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
