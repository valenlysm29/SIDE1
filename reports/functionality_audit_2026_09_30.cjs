'use strict';
// Read-only remote probes. Fault injection uses an isolated browser fixture.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const http = require('node:http'), {execFileSync} = require('node:child_process');
const {chromium} = require('../tests/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests/output/functionality-audit-2026-09-30');
fs.mkdirSync(output, {recursive:true});
const configContext = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/config.js'),'utf8'), configContext);
const config = configContext.window.SIDE_CONFIG;
const results = {checkedAt:new Date().toISOString(),project:config.SUPABASE_URL,remote:[],browser:{},reproductions:{}};
async function probe(name, route, method='GET', payload) {
  const started = Date.now();
  try {
    const response = await fetch(config.SUPABASE_URL+route, {
      method, headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,Origin:'http://127.0.0.1:8000',
        ...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(20000)
    });
    const raw = await response.text();
    let body; try {body=JSON.parse(raw);} catch {body=raw.slice(0,500);}
    return {name,status:response.status,durationMs:Date.now()-started,
      cors:response.headers.get('access-control-allow-origin'),body};
  } catch(error) {return {name,error:error.message,cause:error.cause?.message};}
}
const emptyIdentity = {p_codigo:'',p_nombre_legal:'',p_nombre_comercial:''};
const nil = '00000000-0000-0000-0000-000000000000';
async function main() {
  results.remote = await Promise.all([
    probe('auth_health','/auth/v1/health'),
    probe('catalog','/rest/v1/decisiones_catalogo?select=id,decision_id,decision_nombre,categoria,tipo,es_obligatoria,es_recurrente&activo=eq.true'),
    probe('options','/rest/v1/decisiones_opciones?select=id,decision_id,opcion_id,etiqueta&activo=eq.true'),
    probe('roster_columns','/rest/v1/participantes?select=id,nombre,empresa,empresa_id,puntaje_docente,last_seen_at,empresas(id,nombre_legal,nombre_comercial,caja_actual,ciclo_actual,reputacion)&limit=0'),
    probe('game_columns','/rest/v1/partidas?select=id,codigo,nombre,curso,estado,configuracion&limit=0'),
    probe('features_anonymous_expected_denial','/rest/v1/rpc/side_game_features'),
    probe('history_anonymous_expected_denial','/rest/v1/rpc/obtener_ultima_partida_docente'),
    probe('report_anonymous_expected_denial','/rest/v1/rpc/obtener_reporte_empresa?p_empresa_id=0'),
    probe('control_get_readonly_method_probe','/rest/v1/rpc/controlar_partida?p_partida_id='+nil+'&p_accion=sincronizar'),
    probe('grade_anonymous_expected_denial','/rest/v1/rpc/guardar_puntaje_docente?p_partida_id='+nil+'&p_empresa_id=0&p_puntaje=0'),
    probe('lookup_invalid_code','/rest/v1/rpc/buscar_partida_por_codigo?p_codigo=SIDE-AUDIT-NONEXISTENT-20260930'),
    // Empty identity is rejected before all mutations. Never use real companies.
    probe('admission_invalid_identity','/rest/v1/rpc/ingresar_empresa','POST',emptyIdentity),
    probe('state_invalid_identity','/rest/v1/rpc/obtener_estado_estudiante','POST',emptyIdentity),
    probe('snapshot_invalid_identity','/rest/v1/rpc/guardar_estado_estudiante','POST',{...emptyIdentity,p_snapshot:{},p_expected_revision:0}),
    probe('decisions_invalid_identity','/rest/v1/rpc/guardar_decisiones_estudiante','POST',{...emptyIdentity,p_ciclo:1,p_decisiones:[],p_expected_revision:0}),
    probe('report_invalid_identity','/rest/v1/rpc/guardar_reporte_estudiante','POST',{...emptyIdentity,p_ciclo:1,p_reporte:{},p_expected_revision:0})
  ]);
  const catalogContext={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),catalogContext);
  const localItems=catalogContext.window.SIDE_DECISION_CATALOG.flatMap(c=>c.items.map(i=>({...i,category:c.cat})));
  const remoteDecisions=results.remote.find(x=>x.name==='catalog').body;
  const remoteOptions=results.remote.find(x=>x.name==='options').body;
  if(Array.isArray(remoteDecisions)&&Array.isArray(remoteOptions)) {
    const byId=new Map(remoteDecisions.map(d=>[d.decision_id,d]));
    results.catalogComparison={
      missingDecisions:localItems.filter(i=>!byId.has(i.id)).map(i=>i.id),
      missingOptions:localItems.flatMap(i=>(i.options||[]).filter(o=>!remoteOptions.some(p=>p.decision_id===byId.get(i.id)?.id&&p.opcion_id===o.id)).map(o=>i.id+':'+o.id)),
      categoryMismatches:localItems.filter(i=>byId.has(i.id)&&byId.get(i.id).categoria!==i.category).map(i=>i.id),
      typeMismatches:localItems.filter(i=>byId.has(i.id)&&byId.get(i.id).tipo!==i.type).map(i=>i.id)
    };
  }
  const localErrors=[];
  const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.glb':'model/gltf-binary'};
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) {localErrors.push(pathname);res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page=await browser.newPage({locale:'es-PE',timezoneId:'America/Lima'});
    const runtimeErrors=[],failedRequests=[];
    page.on('pageerror',e=>runtimeErrors.push(e.message));
    page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
    await page.goto(base+'/index.html',{waitUntil:'load',timeout:60000});
    results.browser.student = await page.evaluate(async()=>({sdkLoaded:typeof supabase?.createClient==='function',clientReady:SIDE.SupabaseClient.isReady(),catalog:await SIDE.DecisionesService.obtenerCatalogo(),admission:await SIDE.EmpresaService.ingresar({codigo:'SIDE-AUDIT-NONEXISTENT-20260930',nombreLegal:'Auditoria sin empresa',nombreComercial:'Auditoria sin empresa'})}));
    // Demo login redirects without requesting an authenticated Supabase session.
    await page.evaluate(()=>{$('loginEmail').value=DEMO_TEACHER.email;$('loginPassword').value=DEMO_TEACHER.password;$('loginForm').requestSubmit();});
    await page.waitForURL('**/docente.html*',{timeout:45000});
    await page.waitForLoadState('load');
    results.browser.demoTeacher=await page.evaluate(async()=>({sessionPresent:Boolean((await SIDE.SupabaseClient.get().auth.getSession()).data?.session),createResult:await SIDE.PartidaService.crear({nombre:'Auditoria sin escritura',configuracion:{lifecycleVersion:2}})}));
    results.browser.runtimeErrors=runtimeErrors;
    results.browser.failedRequests=failedRequests;
    results.browser.local404=localErrors;
    await page.close();

    const python='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
    const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});
    const fixture=await browser.newPage();
    await fixture.route('**/*',r=>r.abort());
    await fixture.route('http://side-audit.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
    await fixture.goto('http://side-audit.test/',{waitUntil:'load'});
    results.reproductions.draftSection=await fixture.evaluate(async()=>{
      window.auditCalls=[];
      currentStudent={game:{codigo:'SIDE-AUDIT',configuracion:{}},company:'Audit',legalName:'Audit',empresaId:1,snapshotRevision:0};
      studentConnected=true;studentProgressHydrated=true;
      studentAccess=()=>({canOperate:true,canExplore:true,integration:false});
      decisionEditingBlocked=()=>false;
      SIDE.EmpresaService.guardarEstado=async(_identity,_snapshot,revision)=>{auditCalls.push('snapshot');return {success:true,data:{snapshot_revision:revision+1}};};
      SIDE.DecisionesService.guardar=async()=>{auditCalls.push('decisions');return {success:true};};
      SIDE.DecisionesService.guardarReporte=async()=>{auditCalls.push('report');return {success:true};};
      currentCategory='D';loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory();
      const input=document.querySelector('[data-choice="CANALES"][data-option="web"]');
      input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
      const saved=saveCurrentSection();await studentSnapshotQueue;
      const draftCalls=[...auditCalls],toastText=$('toast').textContent;
      auditCalls.length=0;
      await syncSectionToSupabase('D');
      return {saved,toastText,draftCalls,stringSectionCalls:[...auditCalls]};
    });
    results.reproductions.failureAndReconnect=await fixture.evaluate(async()=>{
      let attempts=0;
      const logs=[];const original=console.warn;console.warn=(...args)=>logs.push(args.map(String));
      SIDE.EmpresaService.guardarEstado=async()=>{attempts++;return {success:false,error:'Failed to fetch',code:'FETCH_ERROR'};};
      const result=await queueStudentSnapshot(buildStudentSnapshot());
      const attemptsBeforeReconnect=attempts;
      SIDE.EmpresaService.obtenerEstado=async()=>({success:false,error:'Failed to fetch'});
      window.dispatchEvent(new Event('online'));
      await new Promise(resolve=>setTimeout(resolve,100));
      console.warn=original;
      return {result,attemptsBeforeReconnect,attemptsAfterReconnect:attempts,logs};
    });
    await fixture.close();
    const sessionPage=await browser.newPage();
    const seed={game:{codigo:'SIDE-AUDIT'},company:'Audit',legalName:'Audit',empresaId:1};
    const seeded=html.replace('<head>','<head><script>sessionStorage.setItem("SIDE_STUDENT_SESSION",'+JSON.stringify(JSON.stringify(seed))+');</script>')
      .replace('global.SIDE.EmpresaService = { ingresar, obtenerEstado, guardarEstado, cleanText, cleanCode };','global.SIDE.EmpresaService = { ingresar, obtenerEstado:async()=>({success:false,error:"Failed to fetch"}), guardarEstado, cleanText, cleanCode };');
    await sessionPage.route('**/*',r=>r.abort());
    await sessionPage.route('http://side-audit.test/**',r=>r.fulfill({contentType:'text/html',body:seeded}));
    await sessionPage.goto('http://side-audit.test/',{waitUntil:'load'});
    results.reproductions.sessionRestoreNetworkFailure=await sessionPage.evaluate(()=>({message:$('studentMessage').textContent,sessionKept:Boolean(sessionStorage.getItem('SIDE_STUDENT_SESSION')),studentConnected}));
    await sessionPage.close();
  } finally {
    await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  const condensed={...results,remote:results.remote.map(x=>({...x,body:Array.isArray(x.body)?{rows:x.body.length}:x.body})),browser:{...results.browser,student:{...results.browser.student,catalog:{success:results.browser.student.catalog.success,decisions:results.browser.student.catalog.data?.decisions?.length,options:results.browser.student.catalog.data?.options?.length}}}};
  console.log(JSON.stringify(condensed,null,2));
}
main().catch(error=>{fs.writeFileSync(path.join(output,'results.partial.json'),JSON.stringify({...results,fatal:error.stack},null,2));console.error(error);process.exitCode=1;});

