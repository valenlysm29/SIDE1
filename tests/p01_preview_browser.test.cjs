'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const fixture=require('./economic_v19_fixture.cjs'),orders=require('../js/material_orders');
function html(name){return execFileSync('python',['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}})}
test('DOM alumno: libro verificado disponible y bloqueo sin datos',async()=>{
 const state=fixture.state(1,{},2);state.__inventarioMP={cuero_prem:70,acc_prem:100};state.CUERO.quantities={};state.ACCESORIOS.quantities={};state.HILO.quantities={hilo_std:1300};state.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:100};
 let book=orders.apply({}, {id:'o',type:'order',orderId:'a',companyId:'7',sku:'hilo_std',unit:'metros',quantity:1300,unitCost:2,orderedDay:0,leadTimeDays:7,paymentMode:'cash'});book.companyId='7';book.revision='a'.repeat(32);book.cutoffDay=29;
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});try{
  const page=await browser.newPage();await page.setContent(html('index.html'),{waitUntil:'load'});
  await page.evaluate(({state,book})=>{currentStudent={company:'A',legalName:'A',empresaId:7,game:{id:'game',codigo:'SIDE-123'}};studentConnected=true;authoritativeStudentState={empresaId:7,gameId:'game',code:'SIDE-123',config:{materialRulesVersion:'receipts-v1',cycles:1},runtime:{round:1,phase:'decisions'}};decisionState=state;decisionDrafts={};currentCategory='C';studentMaterialBook={gameId:'game',companyId:7,cycle:1,phase:'decisions',book};renderDecisionCategory();},{state,book});
  assert.match(await page.locator('#decisionCards').innerText(),/producción factible 0/i);assert.match(await page.locator('#decisionCards').innerText(),/Pendiente/i);
  await page.evaluate(()=>{authoritativeStudentState.runtime.phase='results';renderDecisionCategory()});
  assert.doesNotMatch(await page.locator('#decisionCards').innerText(),/producción factible/i);
  await page.evaluate(()=>{studentMaterialBook=null;studentMaterialStatus='Datos de recepción no verificados / proyección no disponible.';renderDecisionCategory()});
  assert.match(await page.locator('#decisionCards').innerText(),/no verificados/i);assert.doesNotMatch(await page.locator('#decisionCards').innerText(),/producción factible/i);
 }finally{await browser.close();}
});
test('DOM docente: consulta de empresa y render de proyección, luego fallo de lectura',async()=>{
 const plan=fixture.state(1,{},2);plan.__inventarioMP={cuero_prem:70,acc_prem:100};plan.CUERO.quantities={};plan.ACCESORIOS.quantities={};plan.HILO.quantities={hilo_std:1300};plan.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:100};
 let book=orders.apply({}, {id:'o',type:'order',orderId:'a',companyId:'7',sku:'hilo_std',unit:'metros',quantity:1300,unitCost:2,orderedDay:0,leadTimeDays:7,paymentMode:'cash'});book.companyId='7';book.revision='a'.repeat(32);book.cutoffDay=29;book.cycle=1;book.version='receipts-v1';
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});try{
  const page=await browser.newPage();await page.setContent(html('docente.html'),{waitUntil:'load'});
  const text=await page.evaluate(async({plan,book})=>{
   state.partidaId='game';state.authoritative={materialRulesVersion:'receipts-v1'};$('gameCode').value='SIDE-123';
   window.SIDE.SupabaseClient={isReady:()=>true};
   window.SIDE.PartidaService={listarParticipantes:async()=>({success:true,data:[{empresa_id:7,empresa:'A',empresas:{nombre_comercial:'A',ciclo_actual:1,caja_inicial:200000}}]})};
   window.SIDE.DecisionesService={obtenerCatalogo:async()=>({success:true,data:{decisions:[],options:[]}}),obtenerReporte:async()=>({success:true,data:{empresa:{nombre_comercial:'A',ciclo_actual:1},decisiones:[],reportes:[],contexto_juego:{partida_id:'game',codigo:'SIDE-123',ciclo:1,estado:'activa',phase:'decisions',configuracion:{materialRulesVersion:'receipts-v1'},snapshot:{decisions_submitted:true,decision_state:{...plan,__cyclePlans:{1:{state:plan}}}}}}}),obtenerContextoMaterial:async()=>({success:true,data:book})};
   state.reports=await supabaseReports([]);renderResults();const first=$('detailReports').innerText;
   window.SIDE.DecisionesService.obtenerContextoMaterial=async()=>({success:false});state.reports=await supabaseReports([]);renderResults();return [first,$('detailReports').innerText];
  },{plan,book});
  assert.match(text[0],/producción factible 0/i);assert.match(text[0],/Pendiente/i);assert.match(text[1],/no verificados/i);assert.doesNotMatch(text[1],/producción factible/i);
 }finally{await browser.close();}
});
