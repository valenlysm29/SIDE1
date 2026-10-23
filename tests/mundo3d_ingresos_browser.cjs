'use strict';
// Local WebGL audit. Network access and all remote writes are blocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/mundo3d-ingresos-20261023');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml'};
const original=fs.readFileSync(path.join(root,'js/simulator3d.js'),'utf8');
const injected=original.replace('  window.SIDE3D = {',`  window.revenueQA={
    freeze(){cancelAnimationFrame(raf);},
    resume(){clock.getDelta();raf=requestAnimationFrame(frame);},
    sale(){businessState.prices.esencial=40;saveBusinessState();return recordSale('esencial',40);},
    snapshot(){return {inventory,businessState,diagnostics:SIDE3D.diagnostics()};}
  };\n  window.SIDE3D = {`);
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    if(file===path.join(root,'js/simulator3d.js'))res.end(injected);else fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  let browser,page;const errors=[],badAssets=[];
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(90000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400&&!/\/npc\/(?:private\/)?manifest\.json$/.test(r.url()))badAssets.push([r.status(),r.url()]);});
    await page.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
    await page.goto(url,{waitUntil:'networkidle'});
    const submission=await page.evaluate(()=>{
      localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:200000,cycles:3,roundHours:8}));
      currentStudent={name:'AUDITORIA INGRESOS',company:'AUDITORIA INGRESOS',game:DEMO_GAME};openDecisionMenu();
      const quantities={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_ind:1},ACABADOS:{aca_ind:1},PERS_CORTE:{corte_maestro:1},PERS_ENSAMBLE:{ens_personal_esp:1},PERS_ACABADO:{aca_personal_art:1},CUERO:{cuero_sint:30},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:600}};
      for(const [id,counts] of Object.entries(quantities))decisionDrafts[id]={quantities:counts,optionIds:Object.keys(counts)};
      Object.assign(decisionDrafts,{MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:100,molde_2:0,molde_3:0}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['web']},JEFATURA:{optionIds:['si_jefatura']},INV_MARKETING:{optionIds:['mkt_baja']}});
      const accepted=commitReviewedSections(decisionCategories().map(c=>c.cat),true);
      return {accepted,submitted:simulationSubmissionComplete(),production:productionPlan(),plans:decisionState.__cyclePlans};
    });
    assert.equal(submission.accepted,true,JSON.stringify(submission));assert.equal(submission.submitted,true);assert.equal(submission.production.producibleUnits,100);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);
    await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>2);
    await page.evaluate(()=>revenueQA.freeze());
    assert.equal(await page.evaluate(()=>revenueQA.sale()),true);
    const pos=await page.evaluate(()=>({ledger:{...cashLedger},cash:cashBalance(),business:cycleBusinessData(),world:revenueQA.snapshot()}));
    assert.equal(pos.ledger['1:SIM_VENTAS'],40);assert.equal(pos.business.soldByProduct.esencial,1);
    await page.screenshot({path:path.join(out,'venta-3d.png')});
    await page.setViewportSize({width:390,height:844});
    const previousFrame=await page.evaluate(()=>{revenueQA.resume();return SIDE3D.diagnostics().renderedFrames;});
    await page.waitForFunction(previous=>SIDE3D.diagnostics().renderedFrames>previous+3,previousFrame);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'mundo-movil-activo.png')});
    await page.evaluate(()=>revenueQA.freeze());
    const closed=await page.evaluate(()=>{
      const first=settleCycle(1),again=settleCycle(1);
      return {first,again,ledger:{...cashLedger},receipt:decisionState.__cycleSettlements[1],cash:cashBalance(),financial:financialReport()};
    });
    assert.equal(closed.first,true);assert.equal(closed.again,false);assert.equal(closed.receipt.produced,100);assert.equal(closed.receipt.sold,100);
    assert.equal(closed.receipt.revenue,4000);assert.equal(closed.ledger['1:SIM_VENTAS'],4000);assert.equal(closed.receipt.goods.esencial,0);
    assert.equal(closed.cash,Math.round((pos.cash+3960)*100)/100);
    for(const [key,value] of Object.entries(pos.ledger))if(!key.endsWith(':SIM_VENTAS'))assert.equal(closed.ledger[key],value,'closing must preserve non-revenue movements');
    await page.reload({waitUntil:'networkidle'});
    const restored=await page.evaluate(()=>{
      currentStudent={name:'AUDITORIA INGRESOS',company:'AUDITORIA INGRESOS',game:DEMO_GAME};openDecisionMenu();
      return {ledger:cashLedger,receipt:decisionState.__cycleSettlements?.[1]};
    });
    assert.equal(restored.ledger['1:SIM_VENTAS'],4000);assert.equal(restored.receipt.revenue,4000);
    assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
    fs.writeFileSync(path.join(out,'resultados.json'),JSON.stringify({commit:'5c87bb3',passed:true,submission,pos,closed,restored,errors,badAssets},null,2));
    console.log('PASS real WebGL: submit 100 units, POS sale S/40, Excel closure S/4000, no duplicated sales, unchanged expenses, reload persistence and no JS or asset errors');
  }catch(error){
    fs.writeFileSync(path.join(out,'fallo.json'),JSON.stringify({error:error.stack,errors,badAssets},null,2));
    if(page)await page.screenshot({path:path.join(out,'fallo.png')}).catch(()=>{});throw error;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
