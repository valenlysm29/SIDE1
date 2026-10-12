const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../services/empresa_service.js'),'utf8');
const identity={codigo:'SIDE-PTV6',nombreLegal:'Legal',nombreComercial:'Marca'};
function service(rpc){const window={SIDE:{SupabaseClient:{get:()=>({rpc})}}};vm.runInNewContext(source,{window,setTimeout,clearTimeout,AbortController,console:{error(){},warn(){}}});return window.SIDE.EmpresaService;}
for(const failure of ['error','throw','denied'])test(`student podium ${failure} fails closed without losing game state`,async()=>{
 const api=service(async(name,args)=>{
  if(name==='side_admission_features')return {data:{waitingRoomVersion:3,exactIdentityVersion:2}};
  if(name==='obtener_estado_estudiante')return {data:{success:true,empresa:{id:'company'},partida:{id:'game',serverTime:'2026-10-12T12:00:00Z'},snapshot:{revision:42},podio:{reason:'stale unsafe legacy podium'}}};
  assert.equal(name,'side_podio_estudiante');assert.equal(args.p_codigo,identity.codigo);
  if(failure==='throw')throw Error('network interrupted');
  if(failure==='denied')return {data:{success:false,publication:{reason:'must not render'}}};
  return {error:{message:'missing migration'}};
 });
 const result=await api.obtenerEstado(identity);
 assert.equal(result.success,true);assert.equal(result.data.podio,null);
 assert.equal(result.data.empresa.id,'company');assert.equal(result.data.partida.id,'game');assert.equal(result.data.snapshot.revision,42);
});
test('student podium accepts only the publication explicitly returned by the server',async()=>{
 const publication={reason:'Justificación',podium:[{empresa:'Marca',grade:18}]};
 const api=service(async name=>({data:name==='side_admission_features'?{waitingRoomVersion:3,exactIdentityVersion:2}:name==='obtener_estado_estudiante'?{success:true,partida:{serverTime:'2026-10-12T12:00:00Z'}}:{success:true,publication}}));
 assert.deepEqual((await api.obtenerEstado(identity)).data.podio,publication);
});
