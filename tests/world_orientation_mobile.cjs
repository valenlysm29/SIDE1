'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const out=path.join(__dirname,'output/orientation-mobile');
fs.mkdirSync(out,{recursive:true});
const before=process.argv.includes('--before');
const sizes=[[360,640],[390,844],[844,390]];
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
const box=async locator=>locator.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}});
const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const [width,height] of sizes){
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await context.newPage();page.setDefaultTimeout(120000);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
      await page.goto(base,{waitUntil:'domcontentloaded'});
      assert.equal(await page.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA MAPA',company:'QA MAPA',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);return commitReviewedSections(decisionCategories().map(c=>c.cat),true)},seed),true);
      assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
      await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>4);
      await page.screenshot({path:path.join(out,`${before?'before':'after'}-${width}x${height}.png`)});
      if(!before){
        assert.equal(await page.locator('.sim-zone-label,.sim-edge-guide,#simRouteMarker,#simZoneLabels').count(),0,'destination overlays do not exist outside the map');
        const target=await page.locator('.sim-city-zone.is-target').getAttribute('data-zone');
        assert.ok(target,'an active objective is marked on the minimap');
        assert.equal(await page.locator(`.sim-city-zone[data-zone="${target}"]`).isVisible(),true,'active objective icon remains on the minimap');
        assert.match(await page.locator('#simHubDestination').innerText(),/\d+\s*m\b/,'the current objective button keeps its distance');
        const mapBox=await box(page.locator('#simMinimap'));
        const movement=page.locator('.sim3d-touch-pad:visible, .sim3d-touch-actions:visible, .sim3d-actionbar:visible, .sim3d-missions:visible');
        for(let i=0;i<await movement.count();i++)assert.equal(overlap(mapBox,await box(movement.nth(i))),false,'compact map avoids gameplay controls and mission panel');
        const expand=page.locator('#simCityMapToggle');await expand.click();
        assert.equal(await page.locator('#simMinimap').evaluate(el=>el.classList.contains('sim-city-map-open')),true);
        await page.screenshot({path:path.join(out,`expanded-${width}x${height}.png`)});
        for(const zone of ['store','warehouse','production','office','bank','suppliers','news'])assert.equal(await page.locator(`.sim-city-zone[data-zone="${zone}"]`).isVisible(),true,`${zone} visible in expanded map`);
        await page.locator('.sim-city-zone[data-zone="bank"]').click();
        assert.equal(await page.locator('.sim-city-zone[data-zone="bank"]').evaluate(el=>el.classList.contains('is-target')),true);
        assert.equal(await page.locator('#simMinimap').evaluate(el=>el.classList.contains('sim-city-map-open')),false,'map closes after choosing a zone');
        assert.equal(await page.locator('.sim-zone-label,.sim-edge-guide,#simRouteMarker,#simZoneLabels').count(),0,'choosing an offscreen destination does not create screen markers');
        await page.screenshot({path:path.join(out,`target-${width}x${height}.png`)});
      }
      assert.deepEqual(errors,[]);
      console.log(`${before?'CAPTURE':'PASS'} ${width}x${height}`);
      await context.close();
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
