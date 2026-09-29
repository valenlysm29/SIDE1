const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const serviceSource=fs.readFileSync(path.join(root,'services/empresa_service.js'),'utf8');
const decisionsServiceSource=fs.readFileSync(path.join(root,'services/decisiones_service.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');

function loadService(source,rpc,serviceName){
 const window={SIDE:{SupabaseClient:{get:()=>({rpc})}}};
 vm.runInNewContext(source,{window,console},{filename:serviceName});
 return window.SIDE[serviceName];
}

test('student service normalizes the three admission fields and preserves server codes',async()=>{
 let call;
 const service=loadService(serviceSource,async(name,args)=>{
  call={name,args};
  return {data:{success:false,code:'PARTIDA_INICIADA',error:'server detail'},error:null};
 },'EmpresaService');
 const result=await service.ingresar({
  codigo:'  síde-000  ',
  nombreLegal:'  Compañía   Ágil  ',
  nombreComercial:'  Café   Norte '
 });
 assert.deepEqual(JSON.parse(JSON.stringify(call)),{
  name:'ingresar_empresa',
  args:{p_codigo:'SIDE-000',p_nombre_legal:'Compañía Ágil',p_nombre_comercial:'Café Norte'}
 });
 assert.equal(result.success,false);
 assert.equal(result.code,'PARTIDA_INICIADA');
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

test('student state service always uses normalized identity and compare-and-swap revision',async()=>{
 const calls=[];
 const service=loadService(serviceSource,async(name,args)=>{
  calls.push({name,args});
  if(name==='obtener_estado_estudiante')return {data:{success:true,snapshot_revision:7},error:null};
  return {data:{success:true,snapshot_revision:8},error:null};
 },'EmpresaService');
 const identity={codigo:' síde-000 ',nombreLegal:' Compañía   Ágil ',nombreComercial:' Café   Norte '};
 assert.equal((await service.obtenerEstado(identity)).data.snapshot_revision,7);
 assert.equal((await service.guardarEstado(identity,{decision_state:{}},7)).data.snapshot_revision,8);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  {name:'obtener_estado_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Compañía Ágil',p_nombre_comercial:'Café Norte'}},
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
  {name:'guardar_decisiones_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Legal',p_nombre_comercial:'Marca',p_ciclo:1,p_decisiones:[{decision_id:'PRECIO',cantidad:1}],p_expected_revision:4}},
  {name:'guardar_reporte_estudiante',args:{p_codigo:'SIDE-000',p_nombre_legal:'Legal',p_nombre_comercial:'Marca',p_ciclo:1,p_reporte:{caja_final:100},p_expected_revision:4}}
 ]);
});

test('frontend maps safe errors, hydrates by identity and recovers stale revisions',()=>{
 assert.match(appSource,/JOIN_STARTED_MESSAGE\s*=\s*'La partida ya inició\. No se permiten nuevos ingresos\.'/);
 assert.match(appSource,/JOIN_INVALID_MESSAGE\s*=\s*'No se pudo validar el ingreso con los datos proporcionados\.'/);
 assert.match(appSource,/ingreso\.code==='PARTIDA_INICIADA'\?JOIN_STARTED_MESSAGE:JOIN_INVALID_MESSAGE/);
 assert.match(appSource,/EmpresaService\.obtenerEstado\(identity\)/);
 assert.match(appSource,/EmpresaService\.guardarEstado\(identity,snapshot,expectedRevision\)/);
 assert.match(appSource,/queueStudentSnapshot\(snapshot,newRevision=>S\.DecisionesService\.guardar\(identity,round,decisiones,newRevision\)\)/);
 assert.match(appSource,/queueStudentSnapshot\(snapshot,S\.DecisionesService\?\(newRevision=>S\.DecisionesService\.guardarReporte\(identity,round,payload,newRevision\)\):null\)/);
 assert.match(appSource,/const operation=await afterSnapshot\(newRevision\)/);
 assert.match(appSource,/result\.code==='ESTADO_DESACTUALIZADO'/);
 assert.match(appSource,/refreshStudentGame\(\{forceHydrate:true\}\)/);
 assert.match(appSource,/snapshotRevision:serverRevision/);
 assert.doesNotMatch(appSource,/EmpresaService\.obtenerEstado\([^)]*empresaId/);
 assert.doesNotMatch(appSource,/EmpresaService\.guardarEstado\([^)]*empresaId/);
 assert.doesNotMatch(appSource,/DecisionesService\.guardar(?:Reporte)?\([^)]*empresaId/);
 assert.doesNotMatch(serviceSource,/rpc\(['"]obtener_estado_juego['"]/);
 assert.doesNotMatch(decisionsServiceSource,/rpc\(['"]guardar_(?:decisiones|reporte)['"]/);
 assert.match(serviceSource,/p_expected_revision:\s*revision/);
 assert.doesNotMatch(serviceSource,/session[_A-Z-]*token|token[_A-Z-]*session|p_token/i);
});
