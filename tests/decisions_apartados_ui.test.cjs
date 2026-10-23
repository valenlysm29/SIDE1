/* Student tabs remain editable across motor versions and capability failures. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const base=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}}).replace(/<script>\s*const fixtureData=[\s\S]*?<\/script>/,'');
const mock=fs.readFileSync(path.join(__dirname,'student_sync_ui.test.js'),'utf8').match(/const mock=`([\s\S]*?)`;/)[1];
for(const version of ['excel-16','side-lotes-2026-10-20'])test('Student edits every tab with pending or rejected capability check: '+version,async t=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const html=base.replace('const cfg = window.SIDE_CONFIG || {};',mock.replace('capital:100000,round:1,cycles:6',`capital:100000,round:1,cycles:6,motor_version:'${version}'`)+`\nSIDE.PartidaService.excelDisponible=()=>new Promise(resolve=>window.resolveCapability=resolve);\nconst cfg = window.SIDE_CONFIG || {};`);
 await page.route('**/*',route=>route.abort());
 await page.route('http://side-tabs.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://side-tabs.test/');
 await page.waitForLoadState('networkidle');
 await page.evaluate(async()=>{
  stopStudentSync();currentStudent={game:{id:'test-game',codigo:'SIDE-418'},company:'Marca A',legalName:'Legal A',empresaId:1,snapshotRevision:server.revision};
  studentConnected=true;studentProgressHydrated=true;await refreshStudentGame();stopStudentSync();
  persistGameState();currentCategory='B';openDecisionMenu();
 });
 if(await page.locator('#cycleCostsUnderstood').isVisible())await page.locator('#cycleCostsUnderstood').click();
 async function change(cat,selector,value){
  console.log('EDIT',cat,selector);
  await page.locator(`[data-cat="${cat}"]`).click();
  const input=page.locator(selector).first();
  assert.equal(await input.isVisible(),true,cat+' shows its controls');
  assert.equal(await input.isEnabled(),true,cat+' allows editing');
  await input.fill(value);await input.press('Tab');
 }
 await change('B','[data-qty="MESA_CORTE"][data-option="mesa"]','1');
 await change('C','[data-qty="PERS_CORTE"][data-option="corte_basico"]','2');
 await change('F','[data-qty="CUERO"][data-option="cuero_sint"]','3');
 await page.locator('[data-cat="D"]').click();await page.locator('label').filter({has:page.locator('[data-choice="CANALES"][data-option="los_olivos"]')}).click();
 await change('E','[data-loan-number]','125');
 assert.deepEqual(await page.evaluate(()=>[decisionDrafts.MESA_CORTE.quantities.mesa,decisionDrafts.PERS_CORTE.quantities.corte_basico,decisionDrafts.CUERO.quantities.cuero_sint,decisionDrafts.CANALES.optionIds.includes('los_olivos'),decisionDrafts.PRESTAMO.amount]),[1,2,3,true,125]);
 const loan=page.locator('[data-loan-number]');await loan.focus();
 assert.equal(await loan.evaluate(el=>el===document.activeElement),true);
 await page.locator('[data-cat="B"]').click();await page.locator('[data-cat="E"]').click();
 assert.equal(await loan.inputValue(),'125','Draft survives tab navigation');
 assert.equal(await loan.isEnabled(),true,'Editing uses internal game rules');
 await page.locator('#topSubmitAllDecisions').click();assert.equal(await page.locator('#companyReviewDialog').isVisible(),true);
 assert.equal(await page.locator('#confirmCompanyReview').isDisabled(),true,'Missing required decisions block confirmation');
 assert.doesNotMatch(await page.locator('body').innerText(),/Excel|No definido/);
 assert.deepEqual(errors,[]);
 fs.mkdirSync(path.join(root,'tests/output/decisions-editable'),{recursive:true});await page.screenshot({path:path.join(root,'tests/output/decisions-editable',version+'-editable.png')});
});
