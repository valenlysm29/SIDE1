'use strict';
// Delivered teacher UI and real PostgreSQL; no production accounts or network.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpcAfterWaiting:rpc}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/podio-programado');
(async()=>{
 const db=await database();let browser;
 try{
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260929_guardar_puntaje_docente.sql'),'utf8'));
  // PGlite has no ICU; production retains the Spanish ICU collation.
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/2026-10-12_podio_programado.sql'),'utf8').replaceAll('collate "es-x-icu"','collate "C"'));
  const game=await createGame(db,config({cycles:2}));
  for(const [name,grade] of [['Andina',18],['Costa',19]]){
   const player=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:name+' SAC',p_nombre_comercial:name});
   assert.ok(!player.error,JSON.stringify(player));
   await rpc(db,'guardar_puntaje_docente',{p_partida_id:game.id,p_empresa_id:player.empresa_id,p_puntaje:grade});
  }
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar'});
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_expected_round:1});
  const finished=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_expected_round:2});
  const html=execFileSync(process.env.PYTHON_BIN||'python',['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('docente.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}}).replace('<script>const cfg=','<script>window.SIDE_CONFIG={};const cfg=');
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:900},locale:'es-PE',timezoneId:'America/Lima'});
  const teacher=await context.newPage(),errors=[];
  teacher.on('pageerror',e=>errors.push(e.message));await teacher.route('**/*',r=>r.abort());
  await teacher.exposeFunction('podiumRpc',async(name,args)=>({data:await rpc(db,name,args),error:null}));
  await teacher.exposeFunction('podiumRoster',async()=>({success:true,data:(await db.query(`select p.*,to_jsonb(e) as empresas from participantes p join empresas e on e.id=p.empresa_id where p.partida_id=$1 order by e.id`,[game.id])).rows}));
  await teacher.setContent(html,{waitUntil:'load'});await teacher.waitForFunction(()=>!reportsBusy);
  await teacher.evaluate(async({game,finished})=>{
   [teacherPoll,teacherTick,companiesPoll].forEach(clearInterval);
   state.partidaId=game.id;state.round=2;state.authoritative=finished.configuracion;
   $('gameCode').value=game.codigo;$('cycles').value=2;
   localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:false,finishedAt:new Date().toISOString(),code:game.codigo}));
   SIDE.SupabaseClient.get=()=>({rpc:(name,args)=>podiumRpc(name,args)});SIDE.SupabaseClient.isReady=()=>true;
   SIDE.PartidaService.listarParticipantes=()=>podiumRoster();
   SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
   SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{decisiones:[],reportes:[]}});
   refreshSetupSummary();await loadReports();switchTab('podio');await loadPublished();
  },{game,finished});
  await teacher.waitForFunction(()=>!reportsBusy);
  const student=await context.newPage();
  await student.exposeFunction('studentPodium',()=>rpc(db,'side_podio_estudiante',{p_codigo:game.codigo,p_nombre_legal:'Andina SAC',p_nombre_comercial:'Andina'}));
  const studentPublication=()=>student.evaluate(async()=>await studentPodium());
  const openSchedule=async()=>{
   await teacher.locator('#publishPodium').click();await teacher.locator('#podiumDialog').waitFor({state:'visible'});
   await teacher.locator('#podiumPublishMode').selectOption('schedule');
  };
  const confirm=async()=>{
   await teacher.locator('#confirmPodiumPublish').click();await teacher.waitForFunction(()=>!podiumBusy&&!$('podiumDialog').open);
  };
  await teacher.locator('#winnerReason').fill('Se reconoce la evaluación final del docente.');
  await openSchedule();
  for(const [hours,minutes] of [[0,0],[72,1]]){
   await teacher.locator('#podiumHours').fill(String(hours));await teacher.locator('#podiumMinutes').fill(String(minutes));
   assert.match(await teacher.locator('#podiumPublishError').innerText(),/1 minuto.*72 horas/);
   await teacher.locator('#confirmPodiumPublish').click();assert.equal(await teacher.locator('#podiumDialog').isVisible(),true);
   assert.equal((await rpc(db,'side_podio_docente',{p_partida_id:game.id})).publication,null,'invalid delay must never reach persisted publication');
  }
  await teacher.locator('#podiumHours').fill('0');await teacher.locator('#podiumMinutes').fill('1');
  assert.match(await teacher.locator('#podiumPublishPreview').innerText(),/Publicación prevista:/);
  assert.match(await teacher.locator('#podiumPublishPreview').innerText(),/PET|GMT-5/,'preview uses teacher timezone America/Lima');
  fs.mkdirSync(out,{recursive:true});
  await teacher.screenshot({path:path.join(out,'schedule-dialog-1366.png'),fullPage:true});
  await teacher.setViewportSize({width:390,height:844});
  assert.ok(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await teacher.locator('#podiumDialog').evaluate(node=>{const r=node.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;}));
  await teacher.screenshot({path:path.join(out,'schedule-dialog-390.png'),fullPage:true});
  await confirm();
  assert.match(await teacher.locator('#podiumState').innerText(),/programada/i);
  assert.match(await teacher.locator('#podiumCountdown').innerText(),/0 h 0 min [0-5]?\d s|0 h 1 min 0 s/);
  assert.match(await teacher.locator('#podiumScheduledAt').innerText(),/Publicación:.*(?:PET|GMT-5)/);
  assert.equal((await studentPublication()).publication,null,'student cannot see scheduled snapshot');
  await teacher.locator('#podiumCancelSchedule').click();await teacher.waitForFunction(()=>!podiumBusy&&publishedPodium()===null);
  assert.equal((await studentPublication()).publication,null);
  await openSchedule();await confirm();
  const firstDeadline=await teacher.evaluate(()=>publishedPodium().publishedAt);
  await teacher.locator('#podiumReschedule').click();await teacher.locator('#podiumMinutes').fill('2');await confirm();
  const secondDeadline=await teacher.evaluate(()=>publishedPodium().publishedAt);
  assert.ok(Date.parse(secondDeadline)-Date.parse(firstDeadline)>=59000,'reprogramming persists a later deadline');
  await teacher.locator('#podiumPublishNow').click();await teacher.waitForFunction(()=>!podiumBusy&&publishedPodium()?.visible);
  const immediate=await studentPublication();assert.equal(immediate.publication.podium[0].empresa,'Costa');
  assert.equal(immediate.publication.reason,'Se reconoce la evaluación final del docente.');
  assert.equal(Date.parse(immediate.publication.expiresAt)-Date.parse(immediate.publication.publishedAt),86400000);
  await openSchedule();await teacher.locator('#podiumMinutes').fill('1');await confirm();
  const deadline=Date.parse(await teacher.evaluate(()=>publishedPodium().publishedAt));
  await teacher.screenshot({path:path.join(out,'scheduled-countdown-390.png'),fullPage:true});
  assert.equal((await studentPublication()).publication,null);
  assert.deepEqual(errors,[]);await teacher.close();
  console.log('Teacher browser page closed. Waiting for real one-minute server deadline:',new Date(deadline).toISOString());
  while(Date.now()<deadline+300){await new Promise(resolve=>setTimeout(resolve,Math.min(15000,deadline+300-Date.now())));console.log('Real-time wait remaining seconds:',Math.max(0,Math.ceil((deadline-Date.now())/1000)));}
  const automatic=await studentPublication();assert.ok(automatic.publication,'server publication becomes visible with teacher browser closed');
  assert.equal(automatic.publication.podium[0].empresa,'Costa');
  assert.equal(Date.parse(automatic.publication.publishedAt),deadline,'effective publication retains the scheduled instant');
  assert.equal(Date.parse(automatic.publication.expiresAt)-deadline,86400000,'24h starts at the effective deadline');
  await db.query("update podios_publicados set publicar_en=now()-interval '24 hours 1 second' where partida_id=$1",[game.id]);
  assert.equal((await studentPublication()).publication,null,'student cannot see an expired publication');
  console.log('PASS schedule modal, invalid boundaries, timezone preview, cancel, reschedule, publish-now, mobile, real 1-minute automatic publication with teacher closed, 24h expiration');
 }finally{if(browser)await browser.close();await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
