'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const output=path.join(__dirname,'output/mona');fs.mkdirSync(output,{recursive:true});
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  const context=await browser.newContext({viewport:{width:1100,height:850}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'tools/mona_preview.html');
  await page.waitForFunction(()=>window.ready||window.previewError,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.previewError),undefined);
  const bounds=await page.evaluate(()=>({height:preview.bounds.max.y-preview.bounds.min.y,feet:preview.bounds.min.y,animations:preview.template.animations,triangles:preview.renderer.info.render.triangles}));
  assert.ok(Math.abs(bounds.height-1.68)<.0001);assert.ok(Math.abs(bounds.feet)<.0001);assert.equal(bounds.animations,0);
  await page.screenshot({path:path.join(output,'mona-front.png')});
  await page.locator('#turn').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(output,'mona-back.png')});
  assert.deepEqual(errors,[]);results.push({preview:'passed',bounds});
  if(process.env.MONA_ORIGINAL_PREVIEW==='1'){
   await page.goto(base+'tools/mona_preview.html?original');await page.waitForFunction(()=>window.ready,null,{timeout:60000});
   await page.screenshot({path:path.join(output,'mona-original.png')});
  }
  await context.close();
  if(process.env.MONA_PREVIEW_ONLY==='1')return;
  for(const fallback of [false,true]){
   const ctx=await browser.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage(),pageErrors=[];
   p.on('pageerror',e=>pageErrors.push(e.message));
   await ctx.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(base)||(fallback&&url.endsWith('/npcs/mona.glb')))return route.abort();return route.continue()});
   await p.goto(base,{waitUntil:'domcontentloaded'});
   await p.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA MONA',company:'QA MONA',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);renderDecisionCategory();openCompanyReview()},seed);
   await p.locator('#confirmCompanyReview').click();
   assert.equal(await p.evaluate(()=>startSimulationLoading()),true);
   await p.waitForFunction(()=>SIDE3D.diagnostics().renderedFrames>3);
   let diag=await p.evaluate(()=>SIDE3D.diagnostics());
   assert.equal(diag.mona.loaded,!fallback);assert.equal(diag.mona.instances,1);assert.equal(diag.running,true);
   for(let i=0;i<3;i++){await p.evaluate(()=>SIDE3D.rebuild());assert.equal((await p.evaluate(()=>SIDE3D.diagnostics())).mona.instances,1);}
   await p.keyboard.down('KeyA');
   try{await p.waitForFunction(()=>SIDE3D.diagnostics().player.x < -1.4,null,{timeout:15000});}finally{await p.keyboard.up('KeyA');}
   await p.waitForFunction(()=>document.querySelector('#sim3dPrompt').textContent.includes('Valeria'));
   await p.keyboard.press('KeyE');
   await p.waitForFunction(()=>document.querySelector('#sim3dMessage').textContent.startsWith('Valeria:'));
   await p.locator('#side3dCanvas').click({position:{x:600,y:400}});
   await p.waitForFunction(()=>document.pointerLockElement?.id==='side3dCanvas');
   await p.mouse.move(80,560);
   await p.waitForTimeout(300);
   await p.screenshot({path:path.join(output,fallback?'mona-fallback.png':'mona-in-game.png')});
   if(!fallback){await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);await p.screenshot({path:path.join(output,'mona-mobile.png')});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   assert.deepEqual(pageErrors,[]);results.push({fallback,status:'passed',diagnostics:diag});console.log('PASS Mona world',fallback?'fallback':'GLB');
   await ctx.close();
  }
 }finally{await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});
