const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..');
function fixture(name){return execFileSync(process.env.PYTHON_BIN||'python',['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});}
(async()=>{
 const db=await database(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const filename of ['2026-10-11_fix_crear_partida.sql','2026-10-11_recuperar_salas_compatibles.sql'])await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',filename),'utf8'));
 const salasSQL=fs.readFileSync(path.join(root,'supabase/migrations/2026-10-12_salas_codigo.sql'),'utf8');await db.exec(salasSQL);await db.exec(salasSQL);
 const shortSQL=fs.readFileSync(path.join(root,'supabase/migrations/2026-10-12_codigo_corto.sql'),'utf8');await db.exec(shortSQL);await db.exec(shortSQL);
 const errors=[],teacherHTML=fixture('docente.html'),studentHTML=fixture('index.html').replace('const cfg = window.SIDE_CONFIG || {};',`
 window.worldCalls={preload:0,prepare:0,enter:0,suspend:0};
 window.SIDE3D={preload:async()=>{worldCalls.preload++;return true},prepare:async()=>{worldCalls.prepare++;return !window.rejectWorld},enter:async()=>{worldCalls.enter++;showScreen('simulator3d');return true},suspend:()=>{worldCalls.suspend++},getLastError:()=> 'Carga no disponible'};
 const cfg = window.SIDE_CONFIG || {};`);
 const output=path.join(__dirname,'output/short_code/lifecycle');fs.mkdirSync(output,{recursive:true});
 async function page(html){const p=await browser.newPage({viewport:{width:1366,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.abort());await p.route('http://side.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await p.goto('http://side.test/');return p;}
 async function teacher(){
  const p=await page(teacherHTML);
  await p.exposeFunction('dbCreate',async c=>{
    // Este escenario prueba el ciclo heredado; el motor nuevo dispone de las
    // simulaciones canónicas independientes y necesita confirmar su plan.
    const created=await createGame(db,{...c,motor_version:'excel-16'});
    return rpc(db,'controlar_partida',{p_partida_id:created.id,p_accion:'sincronizar',p_config:null,p_expected_round:null});
  });
  await p.exposeFunction('dbCancel',id=>rpc(db,'cancelar_partida',{p_partida_id:id}));
  await p.exposeFunction('dbControl',(id,action,c,round)=>rpc(db,'controlar_partida',{p_partida_id:id,p_accion:action,p_config:c,p_expected_round:round}));
  await p.evaluate(()=>{
   SIDE.SupabaseClient.isReady=()=>true;
   localStorage.setItem('SIDE_PROFESOR_ID','11111111-1111-1111-1111-111111111111');
   SIDE.PartidaService.cancelar=async id=>{const data=await dbCancel(id);return {success:!data.error,data,error:data.error};};
   SIDE.PartidaService.obtenerActiva=async()=>({success:true,data:null});
   SIDE.PartidaService.crear=async data=>({success:true,data:await dbCreate(data.configuracion)});
   SIDE.PartidaService.controlar=async(...args)=>{const data=await dbControl(...args);return {success:!data.error,data,error:data.error};};
   SIDE.PartidaService.actualizarConfiguracion=(id,c)=>SIDE.PartidaService.controlar(id,'guardar',c,null);
   SIDE.PartidaService.listarParticipantes=async()=>({success:true,data:[]});
  });return p;
 }
 async function student(game,name){
  const identity={p_codigo:game.codigo,p_nombre_legal:name,p_nombre_comercial:name};
  const joined=await rpc(db,'ingresar_empresa',identity);assert.ok(joined.empresa_id);
  const p=await page(studentHTML);
  await p.exposeFunction('dbState',studentIdentity=>rpc(db,'obtener_estado_estudiante',{
   p_codigo:studentIdentity.codigo,p_nombre_legal:studentIdentity.nombreLegal,p_nombre_comercial:studentIdentity.nombreComercial
  }));
  await p.evaluate(async({game,joined,name})=>{
   SIDE.EmpresaService.obtenerEstado=async identity=>({success:true,data:await dbState(identity)});
   currentStudent={game,company:name,legalName:name,name,empresaId:joined.empresa_id,participantId:joined.participante_id,snapshotRevision:joined.snapshot_revision||0};
   studentConnected=true;loadDecisionState();startStudentSync();await refreshStudentGame();await prepareLobby();
  },{game,joined,name});return p;
 }
 try{
  const t=await teacher();
  assert.equal(await t.locator('#gameCode').inputValue(),'');
  // An old unsaved numeric draft upgrades; an existing active game's code stays valid.
  await t.evaluate(()=>{
   localStorage.setItem('SIDE_ASSIGNED_GAME_CODE','SIDE-025');
   localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-025'}));
   loadConfig();
  });
  const draftCode=await t.locator('#gameCode').inputValue();
  assert.equal(draftCode,'');
  await t.evaluate(()=>loadConfig());assert.equal(await t.locator('#gameCode').inputValue(),draftCode);
  await t.evaluate(()=>{localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));loadConfig();});
  assert.equal(await t.locator('#gameCode').inputValue(),'SIDE-025');
  await t.evaluate(()=>{localStorage.removeItem('SIDE_GAME_STATUS');localStorage.removeItem('SIDE_TEACHER_CONFIG');localStorage.removeItem('SIDE_ASSIGNED_GAME_CODE');loadConfig();});
  assert.equal(await t.locator('#integrationDurationMinutes').isVisible(),true);
  assert.equal(await t.locator('#copyGameCode').isDisabled(),true);
  await t.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedText=value;}}}));
  await t.locator('#integrationDurationMinutes').fill('3');
  await t.locator('#startGame').click();
  await t.waitForFunction(()=>runtime()?.phase==='integration').catch(async error=>{console.error('waiting start diagnostic',await t.evaluate(()=>({toast:$('toast')?.textContent,partidaId:state.partidaId,authoritative:state.authoritative,status:gameStatus()})));throw error;});
  const game=await t.evaluate(()=>({id:state.partidaId,codigo:$('gameCode').value,nombre:'Prueba'}));
  assert.match(game.codigo,/^SIDE-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  const initialWaiting=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'sincronizar',p_config:{},p_expected_round:null});
  assert.equal(initialWaiting.configuracion.runtime.phase,'integration');
  const waitingDeadline=initialWaiting.configuracion.gameStartAt;
  assert.ok(waitingDeadline,'first start click persists the waiting deadline');
  await t.locator('#copyGameCode').click();assert.equal(await t.evaluate(()=>window.copiedText),game.codigo);
  await t.locator('#copyGameLink').click();assert.equal(await t.evaluate(()=>window.copiedText),'http://side.test/index.html?partida='+game.codigo);
  const invitation=await page(studentHTML);await invitation.goto('http://side.test/index.html?partida='+game.codigo);
  assert.equal(await invitation.locator('#studentModal').isVisible(),true);assert.equal(await invitation.locator('#gameCode').inputValue(),game.codigo);await invitation.close();
  const s1=await student(game,'First'),s2=await student(game,'Second');
  await s1.evaluate(()=>refreshStudentGame());
  assert.equal(await s1.locator('#studentWaiting').isVisible(),true);
  assert.match(await s1.locator('#waitingCompanies').innerText(),/2 empresas unidas/);
  assert.match(await s1.locator('#studentIntegrationNotice').innerText(),/Sala de espera/);
  for(const p of [s1,s2])assert.match(await p.locator('#integrationCountdown').innerText(),/0[23]:/);
  assert.equal(await s1.locator('#enterDecisionsBtn').isDisabled(),true);
  assert.equal(await s1.evaluate(()=>{showScreen('decisionMenu');return openDecisionMenu()}),false);
  assert.equal(await s1.locator('#decisionMenu').isVisible(),false);
  assert.equal(await s1.evaluate(()=>worldCalls.prepare),0,'waiting preloads assets without initializing business');
  assert.ok(await s1.evaluate(()=>worldCalls.preload)>0);
  await s1.evaluate(()=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({lifecycleVersion:2,phase:'decisions'}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions'}));showScreen('simulator3d');});
  assert.equal(await s1.locator('#simulator3d').isVisible(),false,'cached state cannot bypass authoritative waiting');
  await s1.evaluate(()=>refreshStudentGame());
  assert.equal(await t.locator('#startGame').isDisabled(),true,'primero debe cancelar partida');
  const earlyStart=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:{},p_expected_round:null});
  assert.equal(earlyStart.configuracion.runtime.phase,'integration','server rejects skipping the configured waiting time');
  assert.equal(earlyStart.configuracion.gameStartAt,waitingDeadline);
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 second')) where id=$1`,[game.id]);
  await Promise.all([s1,s2].map(p=>p.evaluate(()=>refreshStudentGame())));
  await s1.waitForFunction(()=>!$('decisionMenu').classList.contains('hidden'));await s2.waitForFunction(()=>!$('decisionMenu').classList.contains('hidden'));
  assert.equal(await s1.locator('#studentWaiting').isVisible(),false);
  assert.equal(await s1.evaluate(()=>worldCalls.enter),0,'waiting room must open decisions before the 3D world');
  await s1.evaluate(()=>{setDecisionsSubmitted(true);localStorage.setItem(characterSelectionKey(),'miguel');characterSelectionConfirmed=true;return requestWorldEntry();});
  await s1.waitForFunction(()=>!$('simulator3d').classList.contains('hidden'));
  assert.equal(await s1.evaluate(()=>currentRound()),1);assert.equal(await s2.evaluate(()=>studentAccess().canOperate),true);
  assert.equal(await s1.evaluate(()=>SIDE_GAME_BRIDGE.canExplore()),true);
  assert.equal(await s1.evaluate(()=>SIDE_GAME_BRIDGE.canOperate()),true,'submitted decisions enable business operations in the 3D world');
  await s1.evaluate(()=>{window.rejectWorld=true;return startSimulationLoading()});
  assert.equal(await s1.locator('#simulationLoading').isVisible(),true);
  assert.equal(await s1.locator('#decisionMenu').isVisible(),false);
  assert.equal(await s1.locator('#tutorial').isVisible(),false);
  await s1.evaluate(()=>{window.rejectWorld=false});await s1.locator('#retryWorldBtn').click();
  await s1.waitForFunction(()=>!$('simulator3d').classList.contains('hidden'));
  assert.equal(await t.locator('#startCycle1Btn').isVisible(),false);
  await t.evaluate(()=>switchTab('configuracion'));
  assert.equal(await t.locator('#startGame').isDisabled(),true,'primero debe cancelar partida');
  const selectedBefore=await t.evaluate(()=>[...state.enabledEvents]);
  await t.locator('#openEventPicker').click();await t.locator('#eventSearch').fill('crisis');
  for(const selector of ['#eventSelectAll','#eventRandomize','.event-repeat','.event-first-round'])assert.equal(await t.locator(selector).first().isDisabled(),true,'eventos bloqueados tras inicio: '+selector);
  await t.locator('#closeEventPicker').click();
  assert.deepEqual(await t.evaluate(()=>[...state.enabledEvents]),selectedBefore);
  await t.screenshot({path:path.join(output,'lifecycle-teacher.png')});
  console.log('PASS UI manual: two live students reach decisions and world; events remain read-only after start');
  await t.locator('#cancelGame').click();await t.locator('#keepGame').click();assert.equal(await t.evaluate(()=>gameStatus().active),true);
  await t.evaluate(()=>{window.originalCancel=SIDE.PartidaService.cancelar;SIDE.PartidaService.cancelar=async()=>({success:false,error:'Fallo simulado de conexión'});});
  await t.locator('#cancelGame').click();await t.locator('#confirmCancelGame').click();
  assert.equal(await t.locator('#cancelGameDialog').isVisible(),true);assert.equal(await t.evaluate(()=>gameStatus().active),true);
  await t.evaluate(()=>{SIDE.PartidaService.cancelar=window.originalCancel;});
  await t.locator('#confirmCancelGame').click();await t.waitForFunction(()=>Boolean(gameStatus()?.cancelledAt));
  await Promise.all([s1,s2].map(p=>p.evaluate(()=>refreshStudentGame())));
  for(const p of [s1,s2]){
   assert.equal(await p.locator('#profiles').isVisible(),true);assert.equal(await p.locator('#studentLobby').isVisible(),false);
   assert.match(await p.locator('#roomCancellationNotice').innerText(),/cancelada por el profesor/);
   assert.equal(await p.evaluate(()=>openDecisionMenu()),false);
   assert.ok(await p.evaluate(()=>worldCalls.suspend)>0);
   assert.equal(await p.evaluate(()=>studentPoll===null&&studentTick===null),true);
  }
  await s1.setViewportSize({width:390,height:844});await s1.evaluate(()=>$('toast').classList.remove('show'));assert.match(await s1.locator('#roomCancellationNotice').innerText(),/cancelada por el profesor/);await s1.screenshot({path:path.join(output,'observations-student-cancelled.png')});
  await t.evaluate(()=>{clearInterval(teacherPoll);teacherPoll=null;clearInterval(companiesPoll);companiesPoll=null;switchTab('empresas');});await t.waitForFunction(()=>!reportsBusy);await t.evaluate(()=>{state.reports=[{id:'sample',empresa:'Demo',nombre:'Jugador',partida:$('gameCode').value,fuente:'supabase',conectada:true,lastSeenAt:new Date(teacherNow()).toISOString(),caja:300000,progreso:0}];renderCompanies();});
  await t.setViewportSize({width:390,height:844});await t.evaluate(()=>$('toast').classList.remove('show'));await t.locator('.company-card').screenshot({path:path.join(output,'observations-company-mobile.png')});
  assert.match(await t.locator('.company-status-line').innerText(),/PRESENCIA SIN CONFIRMAR/);
  await t.evaluate(()=>{const r=state.reports[0];presenceTracker.clear(companyPresenceKey(r));presenceTracker.observe(companyPresenceKey(r),r.lastSeenAt);renderCompanies();});
  assert.match(await t.locator('.company-status-line').innerText(),/CONECTADA/);
  await t.evaluate(()=>{const r=state.reports[0];presenceTracker.observe(companyPresenceKey(r),r.lastSeenAt);renderCompanies();});
  assert.match(await t.locator('.company-status-line').innerText(),/CONECTADA/);
  await t.evaluate(()=>{const r=state.reports[0];teacherClock={time:teacherNow()+121000,at:performance.now()};presenceTracker.get(companyPresenceKey(r));renderCompanies();});
  assert.match(await t.locator('.company-status-line').innerText(),/CONECTADA/);
  await t.evaluate(()=>{teacherClock={time:teacherNow()+15001,at:performance.now()};renderCompanies();});
  assert.match(await t.locator('.company-status-line').innerText(),/SIN ACTIVIDAD RECIENTE/);
  await t.evaluate(()=>{rosterSyncError='Offline';renderCompanies();});assert.match(await t.locator('#companiesLiveStatus').innerText(),/últimos datos/);
  console.log('PASS UI share code/link, invitation, event rules, cancellation failure/retry and feedback on both students, presence and mobile grade layout');
  await Promise.all([t.close(),s1.close(),s2.close()]);

  const autoTeacher=await teacher();await autoTeacher.locator('#cycleModeAutomatic').check();
  assert.equal(await autoTeacher.locator('#integrationDurationMinutes').isVisible(),true);
  await autoTeacher.locator('#integrationDurationMinutes').fill('0');
  await autoTeacher.locator('#startGame').click();assert.equal(await autoTeacher.evaluate(()=>gameStatus()?.active||false),false);
  await autoTeacher.locator('#integrationDurationMinutes').fill('2');await autoTeacher.locator('#startGame').click();await autoTeacher.waitForFunction(()=>runtime()?.phase==='integration');
  const autoGame=await autoTeacher.evaluate(()=>({id:state.partidaId,codigo:$('gameCode').value,nombre:'AutomÃ¡tico'}));
  const auto=await student(autoGame,'Auto UI');
  assert.match(await auto.locator('#integrationCountdown').innerText(),/0[12]:/);
  await autoTeacher.close();
  // 4 of 5 minutes elapsed: joining and repeated server reads retain the remaining minute.
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()+interval '1 minute')) where id=$1`,[autoGame.id]);
  const late=await student(autoGame,'Late UI');assert.match(await late.locator('#integrationCountdown').innerText(),/0[01]:/);
  const before=await late.evaluate(()=>teacherConfig().gameStartAt);
  await late.evaluate(()=>refreshStudentGame());assert.equal(await late.evaluate(()=>teacherConfig().gameStartAt),before);
  const savedRemote=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:autoGame.codigo,p_nombre_legal:'Late UI',p_nombre_comercial:'Late UI',p_expected_revision:0,
   p_snapshot:{decision_state:{PRECIO:{round:1,label:'Precio',value:77,cost:0}},cash_ledger:{'1:REMOTE':-50},financial_sections:{},section_submissions:{},decisions_submitted:false,selected_character:'valeria'}
  });
  assert.equal(Number(savedRemote.snapshot_revision),1);
  // A real browser reload retains sessionStorage and recovers state via the RPC.
  const reload=await browser.newPage();reload.on('pageerror',e=>errors.push(e.message));
  await reload.exposeFunction('dbState',studentIdentity=>rpc(db,'obtener_estado_estudiante',{
   p_codigo:studentIdentity.codigo,p_nombre_legal:studentIdentity.nombreLegal,p_nombre_comercial:studentIdentity.nombreComercial
  }));
  const reloadHTML=studentHTML.replace('const cfg = window.SIDE_CONFIG || {};',"SIDE.EmpresaService.obtenerEstado=async identity=>({success:true,data:await dbState(identity)});\nconst cfg = window.SIDE_CONFIG || {};");
  await reload.route('**/*',r=>r.abort());await reload.route('http://side.test/',r=>r.fulfill({contentType:'text/html',body:reloadHTML}));
  await reload.goto('http://side.test/');
  const savedSession=await late.evaluate(()=>JSON.stringify(currentStudent));
  await reload.evaluate(value=>sessionStorage.setItem('SIDE_STUDENT_SESSION',value),savedSession);
  await reload.reload();await reload.waitForFunction(()=>$('integrationCountdown'));
  assert.equal(await reload.evaluate(()=>teacherConfig().gameStartAt),before);
  assert.match(await reload.locator('#integrationCountdown').innerText(),/0[01]:/);
  assert.deepEqual(await reload.evaluate(()=>({revision:currentStudent.snapshotRevision,price:decisionState.PRECIO?.value,character:selectedCharacterSlug()})),{revision:1,price:77,character:'valeria'});
  // A clock five hours wrong must not affect the countdown (server-time anchor).
  await reload.evaluate(()=>{const old=Date.now;Date.now=()=>old()+5*3600000;updateIntegrationUI();});
  assert.match(await reload.locator('#integrationCountdown').innerText(),/0[01]:/);
  await late.setViewportSize({width:390,height:844});await late.screenshot({path:path.join(output,'lifecycle-student-countdown.png')});
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()+interval '2 seconds')) where id=$1`,[autoGame.id]);
  await Promise.all([auto,late,reload].map(p=>p.evaluate(()=>refreshStudentGame())));
  for(const p of [auto,late,reload])await p.waitForFunction(()=>!$('decisionMenu').classList.contains('hidden'));
  const after=await rpc(db,'ingresar_empresa',{p_codigo:autoGame.codigo,p_nombre_legal:'After UI',p_nombre_comercial:'After UI'});
  assert.equal(after.code,'PARTIDA_INICIADA');
  // A fresh browser context models another device after the waiting deadline.
  const original=await rpc(db,'ingresar_empresa',{p_codigo:autoGame.codigo,p_nombre_legal:'Late UI',p_nombre_comercial:'Late UI'});
  const otherDevice=await student(autoGame,'Late UI');
  assert.equal(String(await otherDevice.evaluate(()=>currentStudent.empresaId)),String(original.empresa_id));
  assert.equal(await otherDevice.locator('#studentWaiting').isVisible(),false);
  for(const identity of [
    {p_codigo:autoGame.codigo,p_nombre_legal:'late UI',p_nombre_comercial:'Late UI'},
    {p_codigo:autoGame.codigo,p_nombre_legal:'Late UI',p_nombre_comercial:'late UI'}
  ]){
    const mismatch=await rpc(db,'ingresar_empresa',identity);
    assert.equal(mismatch.code,'PARTIDA_INICIADA');
    assert.match(mismatch.error,/exactamente los registrados/);
  }
  await otherDevice.close();
  await late.evaluate(()=>$('backToProfiles').click());
  assert.equal(await late.evaluate(()=>studentPoll===null&&studentTick===null&&!studentConnected),true);
  console.log('PASS UI automatic: server countdown, reload, clock skew, multiple clients, late rejection and exact reentry on another device');
  assert.deepEqual(errors,[]);console.log('PASS no browser JavaScript errors');
 }finally{await browser.close();await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
