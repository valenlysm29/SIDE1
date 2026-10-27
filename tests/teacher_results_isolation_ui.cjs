'use strict';
const {chromium}=require('playwright'),{execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/teacher-results-isolation');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const html=execFileSync('python',['-B','-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('docente.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
 await page.setContent(html,{waitUntil:'load'});await page.waitForFunction(()=>!reportsBusy);
 await page.evaluate(()=>{
  [teacherPoll,teacherTick,companiesPoll].forEach(clearInterval);clearTimeout(companiesRefresh);
  state.partidaId='room';$('gameCode').value='SIDE-TEST';state.reports=[{id:'a',empresaId:'a',empresa:'Andina',partida:'SIDE-TEST',fuente:'supabase',ronda:1,utilidad:10,estadoResultados:{utilidad:10}},{id:'b',empresaId:'b',empresa:'Costa',partida:'SIDE-TEST',fuente:'supabase',ronda:1,utilidad:20,estadoResultados:{utilidad:20}}];
  supabaseReports=()=>new Promise(resolve=>window.resolveRead=resolve);
  switchTab('resultados');renderResults();
 });
 await page.locator('#resultCompanySelect').selectOption('b');
 assert.match(await page.locator('#detailReports h3').innerText(),/Costa/);
 await page.evaluate(async()=>{
  SIDE.PartidaService.cerrarNegocio=async()=>({success:true,data:{resultadosPorEmpresa:{b:{financial:{estadoResultados:{utilidad:700,ingresos:900,costos:200},balanceCaja:{cajaFinal:800},flujoCaja:{},balanceGeneral:{}}}}}});
  await closeBusinessRemoteRound(1);
  // Even the follow-up query returns stale financials; roster fields stay fresh.
  window.queuedReads=0;
  supabaseReports=async()=>{queuedReads++;return [{...state.reports[0]},{...state.reports[1],nombre:'Jugador actualizado',utilidad:20,estadoResultados:{utilidad:20}}];};
  resolveRead([{...state.reports[0]},{...state.reports[1],utilidad:20,estadoResultados:{utilidad:20}}]);
 });
 await page.waitForFunction(()=>window.queuedReads>0&&!reportsBusy);
 assert.equal(await page.evaluate(()=>state.reports.find(r=>r.id==='b').utilidad),700,'old read must not overwrite closure');
 assert.equal(await page.evaluate(()=>state.reports.find(r=>r.id==='b').nombre),'Jugador actualizado','roster updates must still apply');
 assert.equal(await page.locator('#resultCompanySelect').inputValue(),'b');
 assert.match(await page.locator('#detailReports').innerText(),/700/);
 await page.evaluate(async()=>{
  // Replaying an earlier closure must not replace the next cycle's figures.
  state.reports[1].ronda=2;state.reports[1].utilidad=333;state.reports[1].estadoResultados={utilidad:333};
  await closeBusinessRemoteRound(1);
 });
 assert.equal(await page.evaluate(()=>state.reports[1].utilidad),333,'cycle 1 closure must not overwrite cycle 2');
 await page.evaluate(async()=>{
  SIDE.PartidaService.cerrarNegocio=()=>new Promise(resolve=>window.resolveClosure=resolve);
  window.pendingClosure=closeBusinessRemoteRound(1);
  roomGeneration++;state.partidaId='other-room';state.reports=[{id:'b',empresaId:'b',empresa:'Nueva partida',utilidad:55}];
  resolveClosure({success:true,data:{resultadosPorEmpresa:{b:{financial:{estadoResultados:{utilidad:999},balanceCaja:{},flujoCaja:{},balanceGeneral:{}}}}}});
  await pendingClosure;
 });
 assert.equal(await page.evaluate(()=>state.reports[0].utilidad),55,'old-room closure must not touch new room');
 await page.evaluate(()=>renderResults());
 await page.screenshot({path:path.join(out,'results.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed:['selection stays on Costa while pending','old read and follow-up cannot overwrite closure','roster still refreshes','old cycle closure ignored','old room closure ignored'],pageErrors:errors},null,2));
 console.log('PASS: selection, stale read, room change; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
