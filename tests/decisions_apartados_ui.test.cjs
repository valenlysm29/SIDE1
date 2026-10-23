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
  decisionState.__excel={habilitado:true,round:1,enviado:false,decisiones:SIDE_EXCEL_UI.nuevasDecisiones()};
  persistGameState();currentCategory='B';openDecisionMenu();
 });
 async function change(cat,selector,value){
  await page.locator(`[data-cat="${cat}"]`).click();
  const input=page.locator(selector).first();
  assert.equal(await input.isVisible(),true,cat+' shows its controls');
  assert.equal(await input.isEnabled(),true,cat+' allows editing');
  await input.fill(value);await input.press('Tab');
 }
 await change('B','[data-activo="mesa"]','1');
 await change('C','[data-personal="corte,0,0"]','2');
 await change('C','[data-compra="INS-01"]','3');
 await change('D','[data-excel-tienda="los_olivos"]','1');
 await change('E','[data-excel-prestamo]','125');
 assert.deepEqual(await page.evaluate(()=>{
  const d=decisionState.__excel.decisiones;
  return [d.maquinaria.mesa,d.personal.corte[0][0],d.comprasUnidades['INS-01'],d.tiendasPorDistrito.los_olivos,d.montoPrestamo];
 }),[1,2,3,1,125]);
 await page.locator('[data-excel-prestamo]').focus();
 await page.evaluate(()=>resolveCapability({available:true,motorVersion:SIDE_EXCEL_CONFIG.MOTOR_ACTUAL}));
 await page.waitForFunction(()=>!document.querySelector('[data-excel-enviar]').disabled);
 assert.equal(await page.locator('[data-excel-prestamo]').evaluate(el=>el===document.activeElement),true,'Capability response preserves focus');
 assert.equal(await page.locator('[data-excel-prestamo]').inputValue(),'125');
 await page.evaluate(()=>{SIDE.PartidaService.excelDisponible=async()=>{throw Error('offline')};});
 await change('B','[data-activo="INF-08"]','1');
 await page.locator('[data-cat="E"]').click();
 assert.equal(await page.locator('[data-excel-prestamo]').inputValue(),'125','Draft survives tab navigation');
 assert.equal(await page.locator('[data-excel-prestamo]').isEnabled(),true,'Rejected capability check preserves editing');
 assert.equal(await page.locator('[data-excel-enviar]').isDisabled(),true,'Confirmation still requires a ready server');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(root,'tests/output/decisions-editable',version+'-editable.png')});
});
