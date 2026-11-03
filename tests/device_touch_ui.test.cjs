const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const python='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}}).replace(/<script>\s*const fixtureData=[\s\S]*?<\/script>/,'');
test('teléfono y tablet táctiles conservan navegación, edición, guardado y revisión',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',r=>r.request().url()==='http://side-device.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
   await page.goto('http://side-device.test/');await page.waitForLoadState('networkidle');
   await page.evaluate(()=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));openDecisionMenu();});
   await page.locator('[data-cat="DOP"]').tap();
   const input=page.locator('[data-mold-target="molde_1"]');await input.fill('37');
   assert.ok(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
   await page.locator('[data-cat="C"]').tap();assert.equal(await page.evaluate(()=>currentCategory),'C',String(width));await page.locator('#saveDecisionSection').tap();
   assert.equal(await page.locator('[data-cat="C"] .tab-status').innerText(),'Borrador');
   assert.equal(await page.evaluate(()=>currentProductionTarget()),37);
   const active=await page.locator('.decision-tab.active').boundingBox(),nav=await page.locator('#decisionTabs').boundingBox();
   assert.ok(active.x>=nav.x-1&&active.x+active.width<=nav.x+nav.width+1,'pestaña activa completa '+JSON.stringify({width,active,nav}));
   await page.locator('#topSubmitAllDecisions').tap();
   assert.equal(await page.locator('#companyReviewDialog').isVisible(),true);
   const cancel=page.locator('#cancelCompanyReview'),box=await cancel.boundingBox();
   assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width&&box.y+box.height<=height);
   await cancel.tap();
   if(width<=600){
    const toggle=page.getByRole('button',{name:'Consultar mi plan',exact:true});await toggle.tap();
    const panel=await page.locator('#myPlanPanel').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height);
    await page.getByRole('button',{name:'Cerrar Mi Plan',exact:true}).tap();
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(root,`tests/output/device-touch-${width}.png`)});
   assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await browser.close();}
});
