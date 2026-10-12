'use strict';
// Docente y estudiante reales por HTTP; PostgreSQL PGlite local, sin producción.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {database,rpc,createGame,config,professor}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'tests/output/short_code/compartir');
const sdk=`window.SIDE_CONFIG={SUPABASE_URL:'http://localhost',SUPABASE_PUBLISHABLE_KEY:'fixture'};
window.SIDE3D={preloadBase:async()=>{}};
window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'${professor}'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>fetch('/mock',{method:'POST',body:JSON.stringify({kind:'rpc',name,args})}).then(r=>r.json()),from:name=>{const q={kind:'table',name,filters:[]};const b={select:()=>b,eq:(k,v)=>{q.filters.push([k,v]);return b},order:()=>b,limit:()=>b,in:()=>b,maybeSingle:()=>{q.single=true;return b},single:()=>{q.single=true;return b},then:(ok,fail)=>fetch('/mock',{method:'POST',body:JSON.stringify(q)}).then(r=>r.json()).then(ok,fail)};return b},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}})};`;
(async()=>{
 const db=await database();
 for(const filename of ['2026-10-11_fix_crear_partida.sql','2026-10-11_recuperar_salas_compatibles.sql','2026-10-11_codigos_sala_no_reutilizables.sql','2026-10-11_estado_codigo_sala.sql','2026-10-12_salas_codigo.sql','2026-10-12_codigo_corto.sql']){
  const migration=fs.readFileSync(path.join(root,'supabase/migrations',filename),'utf8');await db.exec(migration);await db.exec(migration);
 }
 const calls=[],pageErrors=[],consoleErrors=[];let missingRecovery=false;
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/mock'){
    let body='';for await(const chunk of req)body+=chunk;const q=JSON.parse(body);let response;
    try{
     if(q.kind==='rpc'){
      if(q.name==='recuperar_sala_docente'&&missingRecovery)response={data:null,error:{code:'PGRST202',message:'Could not find public.recuperar_sala_docente'}};
      else if(q.name==='side_excel_features')response={data:null,error:{code:'PGRST202',message:'Excel fixture no instalada'}};
      else response={data:await rpc(db,q.name,q.args||{}),error:null};
     }else if(q.name==='partidas'){
      const rows=(await db.query('select * from partidas where id=$1',[q.filters.find(x=>x[0]==='id')?.[1]])).rows;response={data:q.single?rows[0]||null:rows,error:null};
     }else if(q.name==='participantes'){
      const rows=(await db.query('select p.*,row_to_json(e) as empresas from participantes p left join empresas e on e.id=p.empresa_id where p.partida_id=$1',[q.filters.find(x=>x[0]==='partida_id')?.[1]])).rows;response={data:rows,error:null};
     }else response={data:[],error:null};
    }catch(error){response={data:null,error:{code:error.code,message:error.message}};}
    calls.push({request:q,response});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response));return;
   }
   const file=path.resolve(root,url.pathname==='/'?'docente.html':'.'+url.pathname);
   if(!file.startsWith(root+path.sep))throw new Error('Ruta fuera del proyecto');
   let body=fs.readFileSync(file);
   if(file.endsWith('docente.html')||file.endsWith('index.html')){
    body=body.toString().replace(/<script src="https:[^>]+><\/script>/g,'').replace(/<script src="js\/config.js[^>]+><\/script>/,'<script>'+sdk+'</script>');
    if(file.endsWith('index.html'))body=body.replace(/<script src="js\/simulator3d[^>]+><\/script>/g,'');
   }
   const mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff2':'font/woff2'};
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
  }catch(error){res.statusCode=404;res.end(error.message);}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 fs.mkdirSync(output,{recursive:true});const contexts=[];
 async function newPage(url='/docente.html'){
  const context=await browser.newContext({viewport:{width:1366,height:900}});contexts.push(context);
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);
  page.on('pageerror',error=>pageErrors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
  await page.goto(url.startsWith('http')?url:origin+url,{waitUntil:'domcontentloaded'});await page.waitForLoadState('networkidle');return page;
 }
 async function clipboard(page){await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__copied=value}}));}
 async function copy(page,id){await page.locator(id).click();await page.waitForFunction(()=>typeof window.__copied==='string');const value=await page.evaluate(()=>window.__copied);await page.evaluate(()=>delete window.__copied);return value;}
 async function assertRecovered(page,game){await page.waitForFunction(id=>state.partidaId===id&&runtime()?.phase==='integration',game.id);await page.evaluate(()=>switchTab('rondas'));await page.locator('#teacherLobby').waitFor({state:'visible'});assert.equal(await page.locator('#lobbyCode').innerText(),game.codigo);assert.equal(await page.locator('#cancelExistingRoom').count(),0);assert.equal(await page.locator('#creationDetails').count(),0);assert.doesNotMatch(await page.locator('body').innerText(),/Existe una partida anterior con un formato antiguo/);}
 async function screenshot(page,name){await page.screenshot({path:path.join(output,name),fullPage:true,animations:'disabled'});}
 try{
  const game=(await db.query(`insert into partidas(profesor_id,nombre,codigo,configuracion) values($1,'Anterior seis','SIDE-ABC234',$2) returning *`,[professor,config({lifecycleVersion:1,integrationDurationMinutes:60,roundMinutes:5,enabledEvents:['PE01','PE02','PE03','PE04']})])).rows[0];
  const teacher=await newPage();await teacher.evaluate(()=>switchTab('configuracion'));await assertRecovered(teacher,game);
  const repaired=(await db.query('select * from partidas where id=$1',[game.id])).rows[0];const deadline=repaired.configuracion.gameStartAt;
  assert.equal(repaired.id,game.id);assert.equal(repaired.codigo,game.codigo);assert.equal(repaired.configuracion.lifecycleVersion,2);assert.equal(repaired.configuracion.integrationDurationMinutes,60);assert.ok(deadline);
  await clipboard(teacher);
  await teacher.evaluate(()=>{$('gameCode').value='SIDE-WG2SIDE';});
  assert.equal(await copy(teacher,'#copyGameCode'),game.codigo,'copiar usa la fila confirmada, no texto manipulado de Identificación');
  const invitation=await copy(teacher,'#copyGameLink');assert.equal(new URL(invitation).searchParams.get('partida'),game.codigo);assert.equal(new URL(invitation).pathname,'/index.html');
  await teacher.evaluate(code=>{$('gameCode').value=code;},game.codigo);await screenshot(teacher,'recuperar_compartir_docente.png');
  const student=await newPage(invitation);assert.equal(await student.locator('#studentModal').isVisible(),true);assert.equal(await student.locator('#gameCode').inputValue(),game.codigo);
  await student.locator('#companyLegalName').fill('demo1');await student.locator('#companyBrandName').fill('demo1');await student.locator('#studentForm button[type=submit]').click();
  await student.waitForFunction(()=>currentStudent.empresaId&&$('studentLobby')&&!$('studentLobby').classList.contains('hidden'));
  assert.equal(await student.locator('#studentWaiting').isVisible(),true);assert.equal(await student.locator('#lobbyCode').textContent(),game.codigo);assert.match(await student.locator('#lobbyStudent').textContent(),/demo1/);
  assert.ok((await student.locator('#waitingGameName').innerText()).includes(game.codigo),'la sala de espera visible muestra el código real de la invitación');
  const participants=(await db.query('select p.partida_id,e.nombre_legal,e.nombre_comercial from participantes p join empresas e on e.id=p.empresa_id')).rows;
  assert.equal(participants.length,1);assert.deepEqual(participants[0],{partida_id:game.id,nombre_legal:'demo1',nombre_comercial:'demo1'});
  await teacher.evaluate(()=>loadReports());assert.match(await teacher.locator('#lobbyCompanies').innerText(),/demo1/);await screenshot(student,'recuperar_compartir_estudiante.png');
  await teacher.reload({waitUntil:'domcontentloaded'});await teacher.waitForLoadState('networkidle');await assertRecovered(teacher,game);assert.equal(await teacher.evaluate(()=>state.authoritative.gameStartAt),deadline);await clipboard(teacher);assert.equal(await copy(teacher,'#copyGameCode'),game.codigo);
  const second=await newPage();await assertRecovered(second,game);assert.equal(await second.evaluate(()=>state.authoritative.gameStartAt),deadline);await clipboard(second);assert.equal(await copy(second,'#copyGameLink'),invitation);
  assert.equal(Number((await db.query('select count(*) n from partidas')).rows[0].n),1);
  console.log('PASS sala heredada: recuperación conserva fila/código/plazo, copiar código/enlace, ingreso real, recarga y segunda pestaña');
  // Recorrido nuevo completo: creación confirmada, copia, ingreso y cancelación.
  await teacher.locator('#cancelGame').click();await teacher.locator('#confirmCancelGame').click();
  await teacher.waitForFunction(()=>!state.partidaId);
  await student.waitForFunction(()=>$('profiles')&&!$('profiles').classList.contains('hidden'));
  assert.equal((await db.query('select estado from partidas where id=$1',[game.id])).rows[0].estado,'cancelada');
  await teacher.evaluate(()=>switchTab('configuracion'));
  await teacher.locator('#startGame').click();await teacher.waitForFunction(()=>state.partidaId&&runtime()?.phase==='integration');
  await clipboard(teacher);const newCode=await copy(teacher,'#copyGameCode');
  assert.match(newCode,/^SIDE-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);assert.notEqual(newCode,game.codigo);
  const entrant=await newPage('/index.html?partida='+newCode);
  for(const typed of [newCode.slice(5).toLowerCase(),newCode]){await entrant.locator('#gameCode').fill('');await entrant.locator('#gameCode').pressSequentially(typed);await entrant.locator('#gameCode').blur();assert.equal(await entrant.locator('#gameCode').inputValue(),newCode);}
  await entrant.locator('#gameCode').fill(newCode.slice(5).toLowerCase());
  await entrant.locator('#companyLegalName').fill('Empresa Nueva');await entrant.locator('#companyBrandName').fill('Marca Nueva');
  await entrant.locator('#studentForm button[type=submit]').click();await entrant.waitForFunction(()=>currentStudent.empresaId&&!$('studentLobby').classList.contains('hidden'));
  await teacher.locator('#cancelGame').click();await teacher.locator('#confirmCancelGame').click();await teacher.waitForFunction(()=>!state.partidaId);
  await entrant.waitForFunction(()=>$('profiles')&&!$('profiles').classList.contains('hidden'));
  await screenshot(entrant,'estudiante_cancelacion_inicio.png');
  await entrant.evaluate(()=>showModal('studentModal'));await entrant.locator('#gameCode').fill(newCode);await entrant.locator('#studentForm button[type=submit]').click();
  await entrant.waitForFunction(()=>$('studentMessage').textContent.includes('cancelada'));
  assert.equal(await entrant.locator('#studentForm button[type=submit]').isDisabled(),false);
  console.log('PASS E2E docente crea → copia → estudiante entra sin guion/minúsculas → docente cancela → estudiante vuelve al inicio → reingreso rechazado');
  for(const context of contexts.splice(0))await context.close();await db.exec('truncate partidas cascade');
  const pending=await createGame(db,config({lifecycleVersion:1,integrationDurationMinutes:60}));missingRecovery=true;
  const blocked=await newPage();await blocked.waitForFunction(()=>$('creationMessage').textContent.includes('2026-10-11_recuperar_salas_compatibles.sql'));
  assert.match(await blocked.locator('#creationMessage').innerText(),/Falta actualizar (Supabase|la base de datos)/);assert.equal(await blocked.locator('#cancelExistingRoom').count(),0);assert.equal(await blocked.locator('#creationDetails').count(),0);
  assert.doesNotMatch(await blocked.locator('body').innerText(),/Existe una partida anterior con un formato antiguo/);
  assert.equal(await blocked.locator('#copyGameCode').isDisabled(),false);assert.equal(await blocked.locator('#copyGameLink').isDisabled(),false);await clipboard(blocked);assert.equal(await copy(blocked,'#copyGameCode'),pending.codigo);assert.equal(new URL(await copy(blocked,'#copyGameLink')).searchParams.get('partida'),pending.codigo);
  await screenshot(blocked,'recuperar_compartir_sql_pendiente.png');
  assert.equal((await db.query('select configuracion from partidas where id=$1',[pending.id])).rows[0].configuracion.lifecycleVersion,1);
  assert.deepEqual(pageErrors,[]);assert.ok(calls.some(call=>call.request.name==='recuperar_sala_docente'));assert.ok(calls.some(call=>call.request.name==='unirse_partida_por_codigo'&&call.response.data?.success));
  console.log('PASS migración pendiente: mensaje SQL específico, compartir código/enlace real sin obligar a cancelar');
 }finally{
  fs.writeFileSync(path.join(output,'recuperar_compartir_evidencia.json'),JSON.stringify({backend:'PGlite local; HTML, PartidaService y EmpresaService reales; auth fixture; red externa bloqueada',calls,pageErrors,consoleErrors},null,2));
  for(const context of contexts)await context.close();await browser.close();await new Promise(r=>server.close(r));await db.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
