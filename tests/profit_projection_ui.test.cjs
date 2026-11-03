'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
test('la proyección se abre desde Planificación sin guardar decisiones',async t=>{
 const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}}).replace(/<script>\s*const fixtureData=[\s\S]*?<\/script>/,'');
 const mock=fs.readFileSync(path.join(__dirname,'student_sync_ui.test.js'),'utf8').match(/const mock=`([\s\S]*?)`;/)[1].replace('configuracion:{capital:100000,round:1,cycles:6}',"configuracion:{capital:100000,round:1,cycles:6,sequentialCloseVersion:'1',economicRulesVersion:'utility-v1'}"),body=html.replace('const cfg = window.SIDE_CONFIG || {};',mock+'\nconst cfg = window.SIDE_CONFIG || {};');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});t.after(()=>browser.close());const page=await browser.newPage();
 await page.route('**/*',route=>route.abort());await page.route('http://side-profit.test/**',route=>route.request().url().includes('js/landing-progress.js')?route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'js/landing-progress.js'),'utf8')}):route.fulfill({contentType:'text/html',body}));
 await page.goto('http://side-profit.test/');await page.waitForLoadState('networkidle');
 await page.evaluate(async input=>{stopStudentSync();currentStudent={game:{id:'test-game',codigo:'SIDE-418'},company:'Marca A',legalName:'Legal A',empresaId:1,snapshotRevision:server.revision};studentConnected=true;studentProgressHydrated=true;await refreshStudentGame();stopStudentSync();Object.assign(decisionState,input);decisionDrafts={};persistGameState();currentCategory='C';openDecisionMenu();},require('./rentabilidad_plan.cjs').plan({round:1,cycles:3,scenario:'inefficient'}));
 if(await page.locator('#cycleCostsUnderstood').isVisible())await page.locator('#cycleCostsUnderstood').click();
 await page.locator('[data-cat="DOP"]').click();const before=await page.evaluate(()=>JSON.stringify(decisionState));await page.locator('[data-profit-calculate]').click();
 const text=await page.locator('[data-profit-projection]').innerText();assert.match(text,/utilidad estimada/);assert.match(text,/caja final/);assert.match(text,/No se guardó ninguna decisión/);assert.equal(await page.evaluate(()=>JSON.stringify(decisionState)),before);
 assert.match(text,/Margen neto/);assert.match(text,/Gastos operativos/);assert.match(text,/Analista de compras/);assert.match(text,/Riesgo de pérdida/);assert.match(text,/Capacidad máxima/);
 for(const width of [1365,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(root,`tests/output/rentabilidad_final/proyeccion-${width}.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.evaluate(()=>openCompanyReview());await page.waitForSelector('#companyReviewDialog[open]');
 assert.match(await page.locator('#companyReviewDialog [data-profit-projection]').innerText(),/Riesgo de pérdida/);assert.equal(await page.locator('#confirmCompanyReview').isEnabled(),true,'una pérdida no bloquea decisiones financiables');
 assert.equal(await page.evaluate(()=>JSON.stringify(decisionState)),before);
});
