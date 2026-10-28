const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const serviceSource=fs.readFileSync(path.join(root,'services/empresa_service.js'),'utf8');
const decisionsServiceSource=fs.readFileSync(path.join(root,'services/decisiones_service.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'js/app.js'),'utf8');

function loadService(source,rpc,serviceName,logger=console){
 const window={SIDE:{SupabaseClient:{get:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}}),signInAnonymously:async()=>{throw Error('sesión existente');}},rpc:(name,args)=>name==='side_admission_features'?Promise.resolve({data:{waitingRoomVersion:3,exactIdentityVersion:2},error:null}):rpc(name,args)})}}};
 vm.runInNewContext(source,{window,console:logger},{filename:serviceName});
 return window.SIDE[serviceName];
}

test('student service normalizes the three admission fields and preserves server codes',async()=>{
 const calls=[];
 const service=loadService(serviceSource,async(name,args)=>{
  calls.push({name,args});
  return {data:{success:false,code:'PARTIDA_INICIADA',error:'server detail'},error:null};
 },'EmpresaService');
 const result=await service.ingresar({
  codigo:'  side-000  ',
  nombreLegal:'  Compañía   Ágil  ',
  nombreComercial:'  Café   Norte '
 });
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(call=>call.name==='side_ingresar_empresa_segura'))),{
  name:'side_ingresar_empresa_segura',
  args:{p_codigo:'SIDE-000',p_nombre_legal:'Compañía Ágil',p_nombre_comercial:'Café Norte',p_clave:null}
 });
 assert.equal(result.success,false);
 assert.equal(result.code,'PARTIDA_INICIADA');
});

test('admission creates an anonymous session before submitting the key',async()=>{
 const calls=[];let sessions=0;
 const window={SIDE:{SupabaseClient:{get:()=>({auth:{getSession:async()=>({data:{session:null}}),signInAnonymously:async()=>{sessions++;return {data:{session:{user:{id:'test'}}},error:null};}},rpc:async(name,args)=>{if(name==='side_admission_features')return {data:{waitingRoomVersion:3,exactIdentityVersion:2}};calls.push({name,args});return {data:{success:false,code:'CLAVE_INVALIDA',error:'Clave inválida'}};}})}}};
 vm.runInNewContext(serviceSource,{window,console});
 const result=await window.SIDE.EmpresaService.ingresar({codigo:'SIDE-000',nombreLegal:'Legal',nombreComercial:'Marca',claveEmpresa:'ABC12345'});
 assert.equal(sessions,1);assert.equal(calls[0].name,'side_ingresar_empresa_segura');assert.equal(calls[0].args.p_clave,'ABC12345');assert.equal(result.code,'CLAVE_INVALIDA');assert.equal(result.technical,false);
});

test('student service does not call the server with any missing identity field',async()=>{
 let calls=0;
 const service=loadService(serviceSource,async()=>{calls++;return {data:{success:true},error:null};},'EmpresaService');
 for(const input of [
  {codigo:'',nombreLegal:'Legal',nombreComercial:'Marca'},
  {codigo:'SIDE-000',nombreLegal:' ',nombreComercial:'Marca'},
  {codigo:'SIDE-000',nombreLegal:'Legal',nombreComercial:' '}
 ])assert.equal((await service.ingresar(input)).code,'DATOS_INCOMPLETOS');
 assert.equal(calls,0);
});

test('student service preserves technical Supabase errors for any game and company',async()=>{
 const logged=[];
 const service=loadService(serviceSource,async()=>({
  data:null,
  error:{code:'PGRST202',message:'Could not find the function',details:'Searched for public.unirse_partida_por_codigo',hint:'Reload the schema cache',status:404}
 }),'EmpresaService',{error:(...args)=>logged.push(args)});
 const result=await service.ingresar({codigo:'SIDE-137',nombreLegal:'Grupo Quilla S.A.C.',nombreComercial:'Quilla'});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{
  success:false,
  technical:true,
  code:'PGRST202',
  error:'Could not find the function',
  details:'Searched for public.unirse_partida_por_codigo',
  hint:'Reload the schema cache',
  status:404
 });
 assert.equal(logged.length,1);
 assert.equal(logged[0][0],'SIDE EmpresaService: fallo tecnico en unirse_partida_por_codigo');
 assert.equal(logged[0][1].code,'PGRST202');
});

test('student service logs permission and network failures without relabeling them as identity rejection',async()=>{
 const permissionLogs=[];
 const permissionService=loadService(serviceSource,async()=>({
  data:null,error:{code:'42501',message:'permission denied for function unirse_partida_por_codigo',status:403}
 }),'EmpresaService',{error:(...args)=>permissionLogs.push(args)});
 const permission=await permissionService.ingresar({codigo:'SIDE-208',nombreLegal:'Servicios Misti',nombreComercial:'Misti'});
 assert.equal(permission.success,false);
 assert.equal(permission.technical,true);
 assert.equal(permission.code,'42501');
 assert.equal(permission.error,'permission denied for function unirse_partida_por_codigo');
 assert.equal(permissionLogs[0][1].code,'42501');

 const networkLogs=[];
 const networkError=Object.assign(new Error('Network request failed'),{name:'TypeError'});
 const networkService=loadService(serviceSource,async()=>{throw networkError;},'EmpresaService',{error:(...args)=>networkLogs.push(args)});
 const network=await networkService.ingresar({codigo:'SIDE-309',nombreLegal:'Industria Pacífico',nombreComercial:'Pacífico'});
 assert.equal(network.success,false);
 assert.equal(network.technical,true);
 assert.equal(network.code,'RPC_INGRESAR_EMPRESA_EXCEPCION');
 assert.equal(network.error,'Network request failed');
 assert.equal(networkLogs[0][0],'SIDE EmpresaService: excepcion en unirse_partida_por_codigo');
 assert.equal(networkLogs[0][1],networkError);
});

test('real student form shows the server message for technical failures and business messages only for safe rejections',async()=>{
 const python=process.env.PYTHON_BIN||'python';
 let html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{
  cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}
 });
 const bootstrap=`
 window.__rpcResult={data:null,error:null};
 window.__rpcThrow=null;
 window.__rpcCalls=[];
 window.__consoleErrors=[];
 const __originalConsoleError=console.error.bind(console);
 console.error=(...args)=>{
  window.__consoleErrors.push(args.map(value=>value instanceof Error?{name:value.name,message:value.message,code:value.code}:value));
  __originalConsoleError(...args);
 };
 window.supabase={createClient:()=>({
  rpc:async(name)=>{window.__rpcCalls.push(name);if(name==='side_admission_features')return {data:{waitingRoomVersion:3,exactIdentityVersion:2},error:null};if(window.__rpcThrow)throw window.__rpcThrow;return window.__rpcResult},
  auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}}),signInAnonymously:async()=>{throw Error('sesión existente');},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}
 })};
 `;
 html=html.replace('window.SIDE_CONFIG = {',bootstrap+'window.SIDE_CONFIG = {');
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage();
  await page.setContent(html,{waitUntil:'load'});
  async function submit({response,throwError=null,expected,identity={}}){
   await page.evaluate(({response,throwError,identity})=>{
    window.__consoleErrors=[];
    window.__rpcResult=response;
    window.__rpcThrow=throwError?Object.assign(new Error(throwError.message),throwError):null;
    $('gameCode').value=identity.codigo||'SIDE-418';
    $('companyLegalName').value=identity.nombreLegal||'Cooperativa Ñawi';
    $('companyBrandName').value=identity.nombreComercial||'Ñawi';
    $('studentForm').requestSubmit();
   },{response,throwError,identity});
   await page.waitForFunction(text=>$('studentMessage').textContent===text,expected);
   return {
    message:await page.locator('#studentMessage').textContent(),
    errors:await page.evaluate(()=>window.__consoleErrors)
   };
  }

  const serverMessage='No se pudo conectar con el servidor. Intenta nuevamente en unos minutos.';
  const invalidCodeMessage='Usa un código como SIDE-PTV6 o PTV6. También se aceptan los códigos anteriores de 6 caracteres y SIDE-000. Copia solo el código de la sala del docente.';
  const callsBefore=await page.evaluate(()=>window.__rpcCalls.length);
  await submit({response:{data:{success:false,code:'CREDENCIALES_INVALIDAS'},error:null},identity:{codigo:'SIDE-WG2SIDE',nombreLegal:'demo1',nombreComercial:'demo1'},expected:invalidCodeMessage});
  assert.equal(await page.evaluate(()=>window.__rpcCalls.length),callsBefore);
  assert.equal(await page.locator('#gameCodeError').textContent(),invalidCodeMessage);
  assert.equal(await page.locator('#gameCode').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#gameCode').inputValue(),'SIDE-WG2SIDE');
  await page.evaluate(()=>{showScreen('profiles');showModal('studentModal');});
  const evidenceDir=path.join(root,'tests/output/short_code/admission');
  fs.mkdirSync(evidenceDir,{recursive:true});
  await page.screenshot({path:path.join(evidenceDir,'ingreso_codigo_invalido_despues.png'),fullPage:true});
  const genericMessage='No se pudo validar el ingreso. Comprueba el código de la sala con tu docente. Si ya participaste, usa los nombres registrados, respetando mayúsculas y tildes.';
  const startedMessage='La partida ya inició. Solo pueden reingresar quienes ya estaban registrados; verifica que el código, el nombre de empresa y el nombre comercial sean exactamente los registrados.';
  for(const technical of [
   {data:null,error:{code:'PGRST202',message:'Could not find public.unirse_partida_por_codigo',status:404}},
   {data:null,error:{code:'42501',message:'permission denied for function unirse_partida_por_codigo',status:403}},
   {data:null,error:{code:'PGRST205',message:'Could not find public.side_student_state',status:404}}
  ]){
   const result=await submit({response:technical,expected:technical.error.code==='PGRST202'?'La sala requiere actualizar Supabase. El docente debe ejecutar 2026-10-12_salas_codigo.sql.':technical.error.code==='42501'?'Supabase rechazó el permiso de ingreso. Pide al docente revisar la migración de salas.':serverMessage});
   assert.match(result.message,/Supabase|No se pudo conectar/);
   assert.notEqual(result.message,genericMessage);
   assert.ok(result.errors.some(args=>args.some(value=>value&&value.code===technical.error.code)),`console.error debe conservar ${technical.error.code}`);
  }

  const network=await submit({
   response:{data:null,error:null},
   throwError:{name:'TypeError',message:'Network request failed',code:'FETCH_ERROR'},
   expected:serverMessage
  });
  assert.equal(network.message,serverMessage);
  assert.notEqual(network.message,genericMessage);
  assert.ok(network.errors.some(args=>args.some(value=>value&&value.message==='Network request failed')));

  const timeout=await submit({
   response:{data:null,error:null},
   throwError:{name:'AbortError',message:'Request timed out',code:'ETIMEDOUT'},
   expected:serverMessage
  });
  assert.equal(timeout.message,serverMessage);
  assert.notEqual(timeout.message,genericMessage);
  assert.ok(timeout.errors.some(args=>args.some(value=>value&&value.code==='ETIMEDOUT')));

  const wrongCode=await submit({
   response:{data:{success:false,code:'CREDENCIALES_INVALIDAS',error:'safe'},error:null},
   expected:genericMessage,
   identity:{codigo:'SIDE-999',nombreLegal:'Cooperativa Ñawi',nombreComercial:'Ñawi'}
  });
  assert.equal(wrongCode.message,genericMessage);
  assert.equal(wrongCode.errors.length,0);

  // [6,7] Con código válido y partida iniciada, legal/comercial incorrectos o
  // intercambiados conservan el texto exacto de PARTIDA_INICIADA.
  for(const identity of [
   {codigo:'SIDE-418',nombreLegal:'Legal Incorrecta',nombreComercial:'Ñawi'},
   {codigo:'SIDE-418',nombreLegal:'Cooperativa Ñawi',nombreComercial:'Marca Incorrecta'},
   {codigo:'SIDE-418',nombreLegal:'Ñawi',nombreComercial:'Cooperativa Ñawi'}
  ]){
   const rejected=await submit({
    response:{data:{success:false,code:'PARTIDA_INICIADA',error:'safe'},error:null},
    expected:startedMessage,
    identity
   });
   assert.equal(rejected.message,startedMessage);
   assert.equal(rejected.errors.length,0);
  }
  const started=await submit({response:{data:{success:false,code:'PARTIDA_INICIADA',error:'safe'},error:null},expected:startedMessage});
  assert.equal(started.message,startedMessage);
  assert.equal(started.errors.length,0);

  assert.deepEqual(await page.evaluate(()=>({
   code:$('gameCode').maxLength,
   legal:$('companyLegalName').maxLength,
   brand:$('companyBrandName').maxLength
  })),{code:64,legal:60,brand:40});
 }finally{await browser.close();}
});

test('student state service always uses normalized identity and compare-and-swap revision',async()=>{
 const calls=[];
 const service=loadService(serviceSource,async(name,args)=>{
  calls.push({name,args});
  if(name==='obtener_estado_estudiante')return {data:{success:true,snapshot_revision:7,partida:{serverTime:'2026-10-09T00:00:00Z'}},error:null};
  return {data:{success:true,snapshot_revision:8},error:null};
 },'EmpresaService');
 const identity={codigo:' side 000 ',nombreLegal:' Compañía   Ágil ',nombreComercial:' Café   Norte '};
 assert.equal((await service.obtenerEstado(identity)).data.snapshot_revision,7);
 assert.equal((await service.guardarEstado(identity,{decision_state:{}},7)).data.snapshot_revision,8);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {name:'obtener_estado_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Compañía Ágil',p_nombre_comercial:'Café Norte'}},
  {name:'side_podio_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Compañía Ágil',p_nombre_comercial:'Café Norte'}},
  {name:'guardar_estado_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Compañía Ágil',p_nombre_comercial:'Café Norte',p_snapshot:{decision_state:{}},p_expected_revision:7}}
 ]);
});

test('student decision/report writes use identity wrappers, never empresaId RPCs',async()=>{
 const calls=[];
 const service=loadService(decisionsServiceSource,async(name,args)=>{
  calls.push({name,args});return {data:{success:true},error:null};
 },'DecisionesService');
 const identity={codigo:' side-000 ',nombreLegal:' Legal ',nombreComercial:' Marca '};
 assert.equal((await service.guardar(identity,1,[{decision_id:'PRECIO',cantidad:1}],4)).success,true);
 assert.equal((await service.guardarReporte(identity,1,{caja_final:100},4)).success,true);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {name:'guardar_decisiones_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Legal',p_nombre_comercial:'Marca',p_ciclo:1,p_decisiones:[{decision_id:'PRECIO',cantidad:1}],p_expected_revision:4}}
 ]);
});

test('state reads and writes preserve technical error codes instead of rejecting the saved identity',async()=>{
 const service=loadService(serviceSource,async()=>({data:null,error:{code:'FETCH_ERROR',message:'Failed to fetch',details:'network interrupted'}}),'EmpresaService');
 const identity={codigo:'SIDE-418',nombreLegal:'Legal A',nombreComercial:'Marca A'};
 for(const result of [await service.obtenerEstado(identity),await service.guardarEstado(identity,{},0)]){
  assert.equal(result.success,false);assert.equal(result.technical,true);assert.equal(result.code,'FETCH_ERROR');assert.equal(result.details,'network interrupted');
 }
});

test('frontend maps safe errors, hydrates by identity and recovers stale revisions',()=>{
 assert.match(appSource,/JOIN_STARTED_MESSAGE\s*=\s*'La partida ya inició\. Solo pueden reingresar quienes ya estaban registrados; verifica que el código, el nombre de empresa y el nombre comercial sean exactamente los registrados\.'/);
 assert.match(appSource,/JOIN_INVALID_MESSAGE\s*=\s*'No se pudo validar el ingreso\./);
 assert.match(appSource,/JOIN_SERVER_MESSAGE\s*=\s*'No se pudo conectar con el servidor\. Intenta nuevamente en unos minutos\.'/);
 assert.match(appSource,/ingreso\?\.code==='PARTIDA_INICIADA'/);
 assert.match(appSource,/ingreso\?\.code==='CREDENCIALES_INVALIDAS'/);
 assert.match(appSource,/console\.error\('SIDE: error técnico al validar el ingreso',ingreso\)/);
 assert.match(appSource,/EmpresaService\.obtenerEstado\(identity\)/);
 assert.match(appSource,/EmpresaService\.guardarEstado\(identity,snapshot,expectedRevision\)/);
 assert.match(appSource,/S\.DecisionesService\.guardar\(identity,round,operation\.payload,newRevision\)/);
 assert.match(appSource,/S\.DecisionesService\.guardarReporte\(identity,round,operation\.payload,newRevision\)/);
 assert.match(appSource,/StudentSync\.createQueue/);
 assert.match(appSource,/onConflict:recoverStaleStudentState/);
 assert.match(appSource,/refreshStudentGame\(\{forceHydrate:true\}\)/);
 assert.match(appSource,/snapshotRevision:.*serverRevision/);
 assert.doesNotMatch(appSource,/EmpresaService\.obtenerEstado\([^)]*empresaId/);
 assert.doesNotMatch(appSource,/EmpresaService\.guardarEstado\([^)]*empresaId/);
 assert.doesNotMatch(appSource,/DecisionesService\.guardar(?:Reporte)?\([^)]*empresaId/);
 assert.doesNotMatch(serviceSource,/rpc\(['"]obtener_estado_juego['"]/);
 assert.doesNotMatch(decisionsServiceSource,/rpc\(['"]guardar_(?:decisiones|reporte)['"]/);
 assert.match(serviceSource,/p_expected_revision:\s*revision/);
 assert.doesNotMatch(serviceSource,/session[_A-Z-]*token|token[_A-Z-]*session|p_token/i);
});


test('missing capability and missing server time require explicit migration, network remains technical',async()=>{
 const make=rpc=>{const window={SIDE:{SupabaseClient:{get:()=>({rpc,auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}}),signInAnonymously:async()=>{throw Error('sesión existente');}}})}}};vm.runInNewContext(serviceSource,{window,console});return window.SIDE.EmpresaService;};
 const identity={codigo:'SIDE-SD7',nombreLegal:'demo1',nombreComercial:'demo1'};
 const missing=make(async()=>({data:null,error:{code:'PGRST202',message:'missing function'}}));
 assert.equal((await missing.ingresar(identity)).code,'MIGRACION_PENDIENTE');
 assert.equal((await missing.obtenerEstado(identity)).code,'MIGRACION_PENDIENTE');
 const noClock=make(async(name)=>({data:name==='side_admission_features'?{waitingRoomVersion:3,exactIdentityVersion:2}:{success:true,partida:{configuracion:{lifecycleVersion:2}}},error:null}));
 assert.equal((await noClock.ingresar(identity)).code,'MIGRACION_PENDIENTE');
 assert.equal((await noClock.obtenerEstado(identity)).code,'MIGRACION_PENDIENTE');
 const network=make(async()=>({data:null,error:{code:'NETWORK',message:'Failed to fetch'}}));
 assert.equal((await network.ingresar(identity)).code,'NETWORK');
});
