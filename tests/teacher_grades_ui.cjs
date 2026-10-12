'use strict';
// Real PostgreSQL grade RPC + delivered teacher UI, isolated from production.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpcAfterWaiting:rpc}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/teacher-grades');
(async()=>{
 const db=await database();let browser;
 try{
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260929_guardar_puntaje_docente.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/2026-10-12_podio_programado.sql'),'utf8').replaceAll('collate "es-x-icu"','collate "C"'));
  const game=await createGame(db,config({cycles:2})),players=[];
  for(const name of ['Andina','Costa','Sierra'])players.push(await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:name+' SAC',p_nombre_comercial:name}));
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar'});
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_expected_round:1});
  const finished=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_expected_round:2});
  assert.equal(finished.estado,'finalizada');
  const python=process.env.PYTHON_BIN||'python';
  const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('docente.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}}).replace('<script>const cfg=','<script>window.SIDE_CONFIG={};const cfg=');
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:900},locale:'es-PE',timezoneId:'America/Lima'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.exposeFunction('gradeRpc',async(name,args)=>({data:await rpc(db,name,args),error:null}));
  await page.exposeFunction('gradeRoster',async()=>({success:true,data:(await db.query(`select p.*,to_jsonb(e) as empresas from participantes p join empresas e on e.id=p.empresa_id where p.partida_id=$1 order by e.id`,[game.id])).rows}));
  const load=async(seed={})=>{
   await page.goto('about:blank');
   await page.reload();
   await page.setContent(html.replace('const fixtureData={};','const fixtureData='+JSON.stringify(seed)+';'),{waitUntil:'load'});
   await page.waitForFunction(()=>!reportsBusy);
   await page.evaluate(async({game,finished})=>{
    [teacherPoll,teacherTick,companiesPoll].forEach(clearInterval);
    state.partidaId=game.id;state.round=2;state.authoritative=finished.configuracion;
    $('gameCode').value=game.codigo;$('cycles').value=2;
    localStorage.setItem('SIDE_PARTIDA_ID',game.id);
    localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...finished.configuracion,codigo:game.codigo}));
    localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:false,finishedAt:new Date().toISOString(),code:game.codigo}));
    SIDE.SupabaseClient.get=()=>({rpc:(name,args)=>window.gradeFailure?Promise.resolve({data:null,error:gradeFailure}):gradeRpc(name,args)});
    SIDE.SupabaseClient.isReady=()=>true;
    SIDE.PartidaService.listarParticipantes=()=>gradeRoster();
    SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
    SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{decisiones:[],reportes:[]}});
    refreshSetupSummary();await loadReports();switchTab('empresas');await loadReports();
   },{game,finished});
   await page.waitForFunction(()=>!reportsBusy);
  };
  const save=async(index,value)=>{
   await page.locator('[data-tab="empresas"]').click();await page.waitForFunction(()=>!reportsBusy);
   const form=page.locator('[data-grade-form]').nth(index);
   await form.locator('input').fill(String(value));await form.locator('button[type="submit"]').click();
   await page.waitForFunction(()=>gradeQueue.pending()===0);
   assert.match(await form.locator('[data-grade-status]').innerText(),/Guardado/);
  };
  const publish=async()=>{
   await page.locator('#publishPodium').click();
   await page.locator('#podiumDialog').waitFor({state:'visible'});
   await page.locator('#podiumPublishMode').selectOption('now');
   await page.locator('#confirmPodiumPublish').click();
   await page.waitForFunction(()=>!podiumBusy&&!$('podiumDialog').open);
  };
  await load();
  assert.equal(await page.locator('[data-grade-form]').count(),3);
  assert.match(await page.locator('[data-field="presence"]').first().innerText(),/finalizada/i);
  await page.evaluate(()=>{state.reports[1].estado='eliminada';persistReports();renderCompanies();renderPodium();});
  await save(0,18.75);await save(1,0);await save(2,19);
  await page.locator('[data-tab="podio"]').click();await page.waitForFunction(()=>!reportsBusy);
  assert.deepEqual(await page.locator('#podiumPreview strong').allTextContents(),['Sierra','Andina','Costa']);
  assert.match(await page.locator('#podiumPreview').innerText(),/0 \/ 20/);
  await publish();
  assert.match(await page.locator('#podiumState').innerText(),/Publicado/i);
  await save(0,20);await page.locator('[data-tab="podio"]').click();await page.waitForFunction(()=>!reportsBusy);
  assert.equal(await page.locator('#podiumPreview strong').first().innerText(),'Andina','editing a grade must refresh the podium even after publication');
  assert.match(await page.locator('#publishStatus').innerText(),/notas cambiaron/i);
  assert.equal(await page.evaluate(()=>publishedPodium().winner),'Sierra','previous publication stays frozen until republished');
  await publish();
  assert.equal(await page.evaluate(()=>publishedPodium().winner),'Andina');
  await db.query("update podios_publicados set publicar_en=now()-interval '24 hours 1 second' where partida_id=$1",[game.id]);
  await page.evaluate(()=>loadPublished());
  assert.equal(await page.locator('#podiumPreview .podium-place').count(),3,'publication expiry must not hide current grades');
  assert.match(await page.locator('#podiumState').innerText(),/vencida/i);
  const seed=await page.evaluate(()=>({...fixtureData}));await load(seed);
  assert.equal(Number(await page.locator('[data-grade-form] input').first().inputValue()),20);
  // A fresh browser with no grade cache reads the persisted final marks too.
  await load();assert.equal(Number(await page.locator('[data-grade-form] input').first().inputValue()),20);
  assert.match(await page.locator('[data-grade-status]').first().innerText(),/Supabase/,'persisted remote grades must not say ungraded on a fresh browser');
  await page.evaluate(()=>loadPublished());
  assert.equal(await page.evaluate(()=>publishedPodium()?.winner),'Andina','fresh browser recovers server publication without local storage');
  assert.equal(await page.evaluate(()=>publishedPodium()?.visible),false,'server expiration survives a fresh browser');
  assert.equal(await page.evaluate(()=>localStorage.getItem('SIDE_PUBLISHED_PODIUM')),null,'publication is never persisted as local source of truth');
  await page.evaluate(()=>{window.gradeFailure={code:'PGRST202',message:'guardar_puntaje_docente missing from schema cache'};});
  const form=page.locator('[data-grade-form]').first();await form.locator('input').fill('17');await form.locator('button').click();
  await page.waitForFunction(()=>gradeUiStatus.get(gradeKey(state.reports[0]))==='retrying');
  assert.doesNotMatch(await form.locator('[data-grade-status]').innerText(),/Guardado/);
  assert.match(await form.locator('[data-grade-status]').innerText(),/Supabase/);
  await page.locator('[data-tab="podio"]').click();await page.waitForFunction(()=>!reportsBusy);
  await page.locator('#publishPodium').click();
  assert.equal(await page.locator('#podiumDialog').isVisible(),false,'pending remote grades cannot open publication confirmation');
  assert.equal((await rpc(db,'side_podio_docente',{p_partida_id:game.id})).publication.winner,'Andina','pending grade must not change previous server publication');
  assert.match(await page.locator('#toast').innerText(),/sincroni/i);
  await page.evaluate(async()=>{window.gradeFailure=null;await gradeQueue.flush();});
  await page.waitForFunction(()=>gradeQueue.pending()===0);
  await publish();assert.ok(await page.evaluate(()=>publishedPodium()?.visible));
  const rows=(await db.query('select puntaje_docente from participantes where partida_id=$1 order by empresa_id',[game.id])).rows;
  assert.deepEqual(rows.map(r=>Number(r.puntaje_docente)),[17,0,19]);
  assert.equal(await page.evaluate(()=>saveCompanyGrade(state.reports[0].id,20.01)),false);
  assert.equal(await page.evaluate(()=>saveCompanyGrade(state.reports[0].id,'')),false);
  fs.mkdirSync(out,{recursive:true});
  for(const [width,height] of [[1366,900],[390,844]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>{clearTimeout(window.__toast);$('toast').classList.remove('show');window.scrollTo(0,0);});
   await page.screenshot({path:path.join(out,`completed-podium-${width}.png`),fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
  console.log('PASS completed game: real grade RPC, decimals/zero, refresh/reload, edited and expired podium, blocked publication on failed save, retry and input validation');
 }finally{if(browser)await browser.close();await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
