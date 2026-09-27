'use strict';
// Cold and lobby-preloaded entry measured in a fresh Chromium context, without network mocks for local assets.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const label=process.env.SIDE_LOADING_LABEL||'current';
const source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8');
const instrumented=source.replace('  window.SIDE3D = {',`  window.loadingQA={
  stages:{}, snapshot(){return {inventory,gameSession,businessState,initialized}},
  move(){const before={x:player.x,z:player.z};keys.KeyW=true;updatePlayer(.04);keys={};return Math.hypot(player.x-before.x,player.z-before.z);}
};
  for(const name of ['loadThree','loadExecModelTemplates','loadSuppliedNpcs','loadMonaModel','initNavigation','buildPlayableHub']){
    const original=eval(name);eval(name+' = async function(...args){ const start=performance.now();try{return await original(...args)}finally{loadingQA.stages["'+name+'"]=performance.now()-start} }');
  }
  window.SIDE3D = {`);
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:1}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  for(const warm of [false,true]){
   const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>!r.request().url().startsWith(url)?r.abort():/\/simulator3d\.js(?:\?|$)/.test(r.request().url())?r.fulfill({contentType:'application/javascript',body:instrumented}):r.continue());
   const nav=Date.now();await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SIDE3D&&window.loadingQA);
   const navigationMs=Date.now()-nav;
   if(warm&&!await page.evaluate(()=>typeof SIDE3D.preload==='function')){await context.close();continue;}
   await page.evaluate(seed=>{
    localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));
    currentStudent={name:'QA LOAD',company:'QA LOAD',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);commitReviewedSections(decisionCategories().map(c=>c.cat),true);
   },seed);
   let preloadMs=0;
   if(warm){
    const state=await page.evaluate(()=>({storage:JSON.stringify({...localStorage}),runtime:loadingQA.snapshot()}));
    preloadMs=await page.evaluate(async()=>{const t=performance.now();await Promise.all([SIDE3D.preload(),SIDE3D.preload()]);return performance.now()-t;});
    assert.deepEqual(await page.evaluate(()=>({storage:JSON.stringify({...localStorage}),runtime:loadingQA.snapshot()})),state,'lobby preload cannot write financial storage, build world or create a business session');
   }
   const result=await page.evaluate(async()=>{
    const t=performance.now();assertUnused=undefined;
    const ready=await SIDE3D.prepare(),prepareMs=performance.now()-t;
    const entered=await SIDE3D.enter({autoStart:true});
    return {ready,entered,prepareMs,entryMs:performance.now()-t,startedAt:t};
   });
   assert.equal(result.ready,true);assert.equal(result.entered,true);
   await page.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>0);
   result.firstRenderMs=await page.evaluate(t=>performance.now()-t,result.startedAt);
   assert.ok(await page.evaluate(()=>loadingQA.move())>0,'first world frame accepts movement');
   result.movableMs=await page.evaluate(t=>performance.now()-t,result.startedAt);
   const data=await page.evaluate(()=>({stages:loadingQA.stages,resources:performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,bytes:e.decodedBodySize,ms:e.duration,start:e.startTime})),diagnostics:SIDE3D.diagnostics()}));
   assert.deepEqual(errors,[]);assert.equal(data.diagnostics.hub.active,true);
   results.push({label,warm,navigationMs,preloadMs,...result,stages:data.stages,requests:data.resources.length,bytes:data.resources.reduce((s,e)=>s+e.bytes,0),assets:data.resources.filter(e=>/glb$|wasm$/.test(e.name)).sort((a,b)=>b.bytes-a.bytes)});
   console.log('PASS',JSON.stringify(results.at(-1)));
   await context.close();
  }
  const output=path.join(__dirname,'output/loading');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`${label}.json`),JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
