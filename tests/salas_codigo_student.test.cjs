const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../services/empresa_service.js'),'utf8');
function service(rpc,extra={}){
 const window={SIDE:{SupabaseClient:{get:()=>({rpc})}}};
 vm.runInNewContext(source,{window,console:{error(){},warn(){}},...extra});
 return window.SIDE.EmpresaService;
}
const identity={codigo:'SIDE-ABCDEF',nombreLegal:'Empresa Perú',nombreComercial:'Marca Perú'};
test('normalización acepta código nuevo pegado con/sin guion y whitespace; conserva demo y legados',()=>{
 const api=service(()=>{});
 for(const [input,expected] of [[' sideabcdef ','SIDE-ABCDEF'],['s i d e - a b c d e f','SIDE-ABCDEF'],['side000','SIDE-000'],['SIDE-wg2','SIDE-WG2'],['side-abcd','SIDE-ABCD']])assert.equal(api.cleanCode(input),expected);
 assert.equal(api.cleanCode('SÍDE-ABCDEF'),'SÍDE-ABCDEF','no sustituye acentos ni puntuación ajena');
});
test('doble Supabase: ingreso/reingreso exige identidad registrada; cancelación bloquea incluso identidad coincidente',async()=>{
 const registered=new Set();let started=false,cancelled=false;
 const api=service(async(name,args)=>{
  if(name==='side_admission_features')return {data:{waitingRoomVersion:3,exactIdentityVersion:2}};
  assert.equal(name,'unirse_partida_por_codigo');
  assert.equal(args.p_codigo,identity.codigo);
  const key=JSON.stringify([args.p_nombre_legal,args.p_nombre_comercial]);
  if(cancelled)return {data:{success:false,code:'PARTIDA_CANCELADA',error:'Sala cancelada'}};
  if(started&&!registered.has(key))return {data:{success:false,code:'PARTIDA_INICIADA',error:'Solo reingreso'}};
  const returning=registered.has(key);registered.add(key);
  return {data:{success:true,reingreso:returning,partida:{estado:'esperando',serverTime:'2026-10-12T12:00:00Z',configuracion:{}}}};
 });
 assert.equal((await api.ingresar({...identity,codigo:' side abcdef '})).success,true);
 started=true;
 const returning=await api.ingresar(identity);assert.equal(returning.success,true);assert.equal(returning.data.reingreso,true);
 assert.equal((await api.ingresar({...identity,nombreComercial:'Otra marca'})).code,'PARTIDA_INICIADA');
 cancelled=true;assert.equal((await api.ingresar(identity)).code,'PARTIDA_CANCELADA');assert.equal(registered.size,1);
});
test('timeout limita una RPC pendiente y permite repetir el ingreso',async()=>{
 let stalled=true,timerCount=0;
 const api=service(async(name)=>{
  if(name==='side_admission_features')return {data:{waitingRoomVersion:3,exactIdentityVersion:2}};
  if(stalled)return new Promise(()=>{});
  return {data:{success:true,partida:{estado:'esperando',configuracion:{},serverTime:'2026-10-12T12:00:00Z'}}};
 },{setTimeout:callback=>{timerCount++;return setTimeout(callback,5);},clearTimeout});
 const result=await api.ingresar(identity);assert.equal(result.code,'CONEXION_TIMEOUT');assert.equal(result.technical,true);assert.match(result.error,/Reintentar/);
 stalled=false;assert.equal((await api.ingresar(identity)).success,true);assert.ok(timerCount>=4);
});
test('estado cancelada basta para rechazar una respuesta de admisión exitosa antigua',async()=>{
 const api=service(async name=>({data:name==='side_admission_features'?{waitingRoomVersion:3,exactIdentityVersion:2}:{success:true,partida:{estado:'cancelada',configuracion:{},serverTime:'2026-10-12T12:00:00Z'}}}));
 assert.equal((await api.ingresar(identity)).code,'PARTIDA_CANCELADA');
});
