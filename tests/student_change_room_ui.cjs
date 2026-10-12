'use strict';
// Delivered HTML and application; isolated backend fixture, no production traffic.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'tests/output/short_code/change_room');
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
const mock=`
window.SIDE_CONFIG={SUPABASE_URL:'http://side-change.test',SUPABASE_PUBLISHABLE_KEY:'fixture'};
window.SIDE3D={preloadBase:async()=>{}};
window.calls=[];
window.fixtureState=code=>({partida:{id:'room-'+code,codigo:code,nombre:'Prueba '+code,estado:'esperando',serverTime:new Date().toISOString(),configuracion:{lifecycleVersion:2,capital:100000,cycleCloseMode:'manual',cycles:3,roundMinutes:5,gameStartAt:new Date(Date.now()+120000).toISOString(),runtime:{round:1,phase:'integration',status:'waiting',running:false}}},empresa:{id:code==='SIDE-OLD'?7:8,nombre_legal:'demo1',nombre_comercial:'demo1',caja_actual:100000,caja_inicial:100000,ciclo_actual:1},snapshot_revision:0,snapshot:{decision_state:{},cash_ledger:{},financial_sections:{},section_submissions:{},decisions_submitted:false}});
window.fixtureCancelled=()=>{const data=fixtureState('SIDE-OLD');data.partida.configuracion.cancelledAt=new Date().toISOString();data.partida.configuracion.runtime.phase='cancelled';return {success:true,data};};
SIDE.EmpresaService.obtenerEstado=async identity=>{
 calls.push({type:'read',identity});
 if(identity.codigo==='SIDE-OLD')return new Promise(resolve=>window.releaseOldRead=()=>resolve(fixtureCancelled()));
 return {success:true,data:fixtureState(identity.codigo)};
};
SIDE.EmpresaService.ingresar=async identity=>{
 calls.push({type:'join',identity});
 if(identity.codigo==='SIDE-OLD')return {success:false,code:'PARTIDA_CANCELADA'};
 if(identity.codigo==='SIDE-USED')return {success:false,code:'CODIGO_RETIRADO'};
 return {success:true,data:fixtureState(identity.codigo)};
};
SIDE.EmpresaService.guardarEstado=async()=>({success:true,data:{snapshot_revision:0}});
SIDE.DecisionesService.guardarReporte=async()=>({success:true});
SIDE.DecisionesService.guardar=async()=>({success:true});
SIDE.SupabaseClient.get=()=>({auth:{onAuthStateChange(){}}});
`;
const document=html.replace('const cfg = window.SIDE_CONFIG || {};',mock+'\nconst cfg = window.SIDE_CONFIG || {};');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],contexts=[];fs.mkdirSync(output,{recursive:true});
 async function page(search=''){
  const context=await browser.newContext({viewport:{width:1366,height:900}});contexts.push(context);const p=await context.newPage();
  p.on('pageerror',error=>errors.push(error.message));
  await p.addInitScript(()=>sessionStorage.setItem('SIDE_STUDENT_SESSION',JSON.stringify({game:{id:'room-SIDE-OLD',codigo:'SIDE-OLD'},company:'demo1',legalName:'demo1',empresaId:7,snapshotRevision:0})));
  await p.route('**/*',route=>route.abort());await p.route('http://side-change.test/**',route=>route.fulfill({contentType:'text/html',body:document}));
  await p.goto('http://side-change.test/'+search);await p.waitForLoadState('networkidle');return p;
 }
 async function enter(p,code='SIDE-NEW'){
  await p.locator('#gameCode').fill(code);await p.locator('#companyLegalName').fill('demo1');await p.locator('#companyBrandName').fill('demo1');
  await p.locator('#studentForm button[type=submit]').click();
 }
 async function waiting(p){
  await p.waitForFunction(()=>studentConnected&&currentStudent.game.codigo==='SIDE-NEW'&&!$('studentWaiting').classList.contains('hidden'));
  assert.equal(await p.locator('#lobbyCode').textContent(),'SIDE-NEW');assert.equal(await p.locator('#studentWaiting').isVisible(),true);
  assert.equal(await p.locator('#studentLobby').evaluate(el=>el.classList.contains('game-cancelled')),false);
  assert.match(await p.locator('#waitingCountdown').textContent(),/^0[12]:[0-5][0-9]$/);
 }
 try{
  const invited=await page('?partida=SIDE-NEW');assert.equal(await invited.locator('#studentModal').isVisible(),true);
  assert.equal(await invited.evaluate(()=>calls.some(call=>call.identity.codigo==='SIDE-OLD')),false);await enter(invited);await waiting(invited);
  await invited.screenshot({path:path.join(output,'cambio_sala_invitacion.png'),fullPage:true,animations:'disabled'});
  console.log('PASS enlace de sala nueva no restaura la sesión cancelada anterior; mismo nombre de empresa');
  const manual=await page();await manual.waitForFunction(()=>typeof releaseOldRead==='function');
  await manual.evaluate(()=>showScreen('profiles'));await manual.locator('[data-profile=student]').click();
  await manual.evaluate(()=>releaseOldRead());await manual.waitForFunction(()=>studentSessionRecoveryTask===null);
  assert.equal(await manual.locator('#studentModal').isVisible(),true);assert.equal(await manual.evaluate(()=>studentConnected),false);
  await enter(manual);await waiting(manual);await manual.screenshot({path:path.join(output,'cambio_sala_manual.png'),fullPage:true,animations:'disabled'});
  console.log('PASS ingreso manual mantiene formulario aunque la recuperación cancelada vieja llegue tarde');
  const terminal=await page('?partida=SIDE-OLD');await terminal.waitForFunction(()=>typeof releaseOldRead==='function');
  await terminal.evaluate(()=>{showScreen('profiles');openStudentAdmission();releaseOldRead();});await terminal.waitForFunction(()=>studentSessionRecoveryTask===null);
  await enter(terminal,'SIDE-OLD');assert.match(await terminal.locator('#studentMessage').innerText(),/fue cancelada/);assert.equal(await terminal.locator('#studentModal').isVisible(),true);
  await enter(terminal,'SIDE-USED');assert.match(await terminal.locator('#gameCodeError').innerText(),/ya no se puede utilizar/);assert.equal(await terminal.locator('#gameCode').getAttribute('aria-invalid'),'true');
  await terminal.screenshot({path:path.join(output,'cambio_sala_codigo_retirado.png'),fullPage:true,animations:'disabled'});
  await enter(terminal);await waiting(terminal);console.log('PASS códigos cancelado y retirado muestran error; código nuevo permite ingresar sin recargar');
  assert.deepEqual(errors,[]);
 }finally{for(const context of contexts)await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
