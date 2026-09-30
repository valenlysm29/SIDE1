const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.svg':'image/svg+xml'};
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
const server=http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))}catch{res.writeHead(400).end();return}
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  if(file===root)file=path.join(root,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(90000);
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+'?side3dDebug=1',{waitUntil:'domcontentloaded'});
    await page.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA FPS',company:'QA FPS',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);commitReviewedSections(decisionCategories().map(c=>c.cat),true)},seed);
    await page.evaluate(()=>startSimulationLoading());await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>10);
    await page.waitForFunction(()=>SIDE3D.diagnostics().assets.detailsReady,undefined,{timeout:120000});
    const tiers={};
    for(const tier of ['low','medium','high']){
      await page.evaluate(mode=>document.querySelector(`[data-quality="${mode}"]`)?.click(),tier);
      if(tier==='high')await page.waitForFunction(()=>SIDE3D.diagnostics().cityNpcModels.loaded>=16,undefined,{timeout:120000});
      await page.waitForTimeout(1800);
      const fps=[];
      for(let i=0;i<4;i++){
        await page.waitForTimeout(1200);
        const sample=await page.evaluate(()=>({monitor:document.querySelector('#simPerfMonitor')?.textContent,diag:SIDE3D.diagnostics()}));
        const value=Number(sample.monitor?.match(/(\d+) FPS/)?.[1]);if(Number.isFinite(value))fps.push(value);
      }
      fps.sort((a,b)=>a-b);
      tiers[tier]={samples:fps,median:fps[Math.floor(fps.length/2)]||null,cityNpcModels:await page.evaluate(()=>SIDE3D.diagnostics().cityNpcModels)};
    }
    console.log(JSON.stringify({renderer:'headless Chromium SwiftShader',tiers},null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
