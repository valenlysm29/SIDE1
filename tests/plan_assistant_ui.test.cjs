const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const python='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
test('Mi Plan: real engine, stable layout, seven tabs, drafts, scope, pause and mobile',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const url=r.request().url();if(url==='http://side-plan.test/')return r.fulfill({contentType:'text/html',body:html});const font=url.match(/\/assets\/fonts\/poppins\/(Poppins-(?:Regular|SemiBold)\.ttf)$/);if(font&&fs.existsSync(path.join(root,'assets/fonts/poppins',font[1])))return r.fulfill({path:path.join(root,'assets/fonts/poppins',font[1]),contentType:'font/ttf'});return r.abort();});
 await page.goto('http://side-plan.test/');
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));openDecisionMenu();});
 const toggle=page.getByRole('button',{name:'Consultar mi plan',exact:true}),panel=page.locator('#myPlanPanel');
 await page.locator('[data-cat="DOP"]').click();await page.locator('[data-mold-target="molde_1"]').fill('200');
 assert.equal(await panel.isVisible(),false);
 await page.screenshot({path:path.join(root,'tests/output/mi-plan-cerrado.png')});
 const before=await page.locator('#decisionCards').boundingBox();
 await toggle.click();assert.equal(await panel.isVisible(),true);assert.deepEqual(await page.locator('#decisionCards').boundingBox(),before);
 assert.equal(await page.locator('[data-plan="target"]').innerText(),'Meta: 200 bolsos básicos');
 const model=await page.evaluate(()=>window.SIDE_PRODUCTION_MODEL.calculate(decisionModelContext()));
 for(const row of model.materials)assert.ok((await page.locator(`[data-plan="${row.id}"]`).innerText()).startsWith(row.shortfall.toLocaleString('es-PE')));
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(root,'tests/output/mi-plan-compacto.png')});
 const extra=await page.evaluate(()=>SIDE_PRODUCTION_MODEL.recommendResources(decisionModelContext(),SIDE_PRODUCTION_MODEL.calculate(decisionModelContext())).additions);
 for(const [id,field] of [['workers','worker'],['machines','machine']])assert.equal(await page.locator(`[data-plan="${id}"]`).innerText(),String(extra.reduce((sum,row)=>sum+(row[field]?row.quantity:0),0)));
 await page.evaluate(()=>window.planNode=document.querySelector('#myPlanPanel'));
 await page.locator('[data-mold-target="molde_1"]').fill('201');assert.equal(await page.locator('[data-plan="target"]').innerText(),'Meta: 201 bolsos básicos');
 assert.equal(await page.locator('[data-mold-target="molde_1"]').evaluate(el=>el===document.activeElement),true);
 for(const cat of ['DOP','B','C','F','D','E','A']){await page.locator(`[data-cat="${cat}"]`).click();assert.equal(await toggle.isVisible(),true);assert.equal(await panel.isVisible(),true);assert.equal(await page.evaluate(()=>window.planNode===document.querySelector('#myPlanPanel')),true);}
 const bounds=await panel.boundingBox();assert.ok(bounds.width>=280&&bounds.width<=310&&bounds.height<440);
 await page.evaluate(()=>{
   const context=decisionModelContext(),plan=SIDE_PRODUCTION_MODEL.calculate(context),r=SIDE_PRODUCTION_MODEL.recommendResources(context,plan);
   window.assistantDraftBackup=JSON.stringify(decisionDrafts);
   for(const id of ['MESA_CORTE','ENSAMBLE','ACABADOS','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'])decisionDrafts[id]=r.drafts[id];
   decisionDrafts.CUERO.quantities={cuero_sint:1000};decisionDrafts.HILO.quantities={hilo_std:100000};decisionDrafts.ACCESORIOS.quantities={acc_eco:10000};
   decisionDrafts.MOLDE.optionIds=['molde_1','molde_2','molde_3'];window.SIDE_PLAN_ASSISTANT.refresh();
 });
 assert.equal(await page.locator('[data-plan="status"]').innerText(),'✓ Tienes los recursos necesarios para tu plan.');
 assert.equal(await page.locator('[data-resource]:visible').count(),0);
 await page.evaluate(()=>{decisionDrafts.CUERO.quantities={cuero_sint:1};window.SIDE_PLAN_ASSISTANT.refresh();});
 assert.equal(await page.locator('[data-resource="HILO"]').isVisible(),false);
 const shortage=await page.evaluate(()=>SIDE_PRODUCTION_MODEL.calculate(decisionModelContext()).materials.find(row=>row.id==='CUERO').shortfall);
 assert.equal(await page.locator('[data-plan="CUERO"]').innerText(),shortage.toLocaleString('es-PE',{maximumFractionDigits:4})+' m²');
 await page.evaluate(()=>{decisionDrafts=JSON.parse(window.assistantDraftBackup);window.SIDE_PLAN_ASSISTANT.refresh();});
 const state=await page.evaluate(()=>JSON.stringify([decisionState,decisionDrafts,cashLedger]));
 await page.getByRole('button',{name:'Ir a Planificación',exact:true}).click();assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('[data-mold-target="molde_1"]').inputValue(),'201');
 assert.equal(await page.evaluate(()=>JSON.stringify([decisionState,decisionDrafts,cashLedger])),state);
 await toggle.click();await page.keyboard.press('Escape');assert.equal(await panel.isVisible(),false);await toggle.click();await page.getByRole('button',{name:'Cerrar Mi Plan',exact:true}).click();assert.equal(await panel.isVisible(),false);
 await page.setViewportSize({width:390,height:844});await toggle.click();const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await page.screenshot({path:path.join(root,'tests/output/mi-plan-compacto-movil.png')});
 for(const cycles of [3,6])for(let round=2;round<=cycles;round++){
 await page.evaluate(({round,cycles})=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...teacherConfig(),cycles}));localStorage.setItem('SIDE_ACTIVE_ROUND',String(round));loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory();},{round,cycles});
 if(!await panel.isVisible())await toggle.click();assert.equal(await page.locator('[data-plan="target"]').innerText(),'Define tu meta de producción');
 }
 await page.evaluate(()=>{currentStudent={...currentStudent,company:'Otra empresa',game:{...currentStudent.game,codigo:'OTRA-6'}};loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory();});assert.equal(await panel.isVisible(),false);await toggle.click();assert.equal(await page.locator('[data-plan="target"]').innerText(),'Define tu meta de producción');
 await page.evaluate(()=>{currentStudent.empresaId='remote-unverified';window.SIDE_PLAN_ASSISTANT.refresh();});assert.equal(await panel.isVisible(),false);await toggle.click();assert.equal(await page.locator('[data-plan="target"]').innerText(),'Meta: Por calcular');
 await page.evaluate(()=>{currentStudent.empresaId=null;lastPauseState=true;renderCyclePause(true);window.SIDE_PLAN_ASSISTANT.refresh();});assert.equal(await toggle.isVisible(),true);if(!await panel.isVisible())await toggle.click();assert.equal(await panel.isVisible(),true);
 assert.ok((await panel.boundingBox()).y>=0);await page.screenshot({path:path.join(root,'tests/output/mi-plan-pausa.png')});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
