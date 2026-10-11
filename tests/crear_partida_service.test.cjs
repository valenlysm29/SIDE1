'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function service(handler){
 const calls=[],errors=[];
 const window={crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},SIDE:{SupabaseClient:{get:()=>({auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},rpc:async(name,args)=>{calls.push({name,args});if(name==='side_admission_features')return {data:{waitingRoomVersion:3,exactIdentityVersion:2}};if(name==='side_game_features')return {data:{observationsVersion:1,gameCodeVersion:2}};if(name==='controlar_partida')return {data:{error:'No tienes permiso'}};return handler(name,args);}})}}};
 vm.runInNewContext(fs.readFileSync(process.env.SIDE_SERVICE_SOURCE||require.resolve('../services/partida_service.js'),'utf8'),{window,console:{error:(...args)=>errors.push(args)}});
 return {api:window.SIDE.PartidaService,calls,errors};
}
const sala={id:'room',codigo:'SIDE-AA2',estado:'esperando',serverTime:'2026-10-11T12:00:00Z',configuracion:{runtime:{phase:'integration'}}};
const datos={nombre:'Prueba',configuracion:{lifecycleVersion:2,enabledEvents:['PE01'],integrationDurationMinutes:2,cycles:3,roundMinutes:5,roundHours:0},requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
test('creación usa RPC atómico, conserva requestId y envía la configuración exacta',async()=>{
 const s=service(async()=>({data:sala}));const r=await s.api.crear(datos);assert.equal(r.success,true);assert.equal(r.data.id,'room');
 const call=s.calls.find(c=>c.name==='crear_sala_docente');assert.equal(call.args.p_request_id,datos.requestId);assert.equal(call.args.p_config.integrationDurationMinutes,2);assert.equal(call.args.p_config.cycles,3);assert.equal(call.args.p_config.roundMinutes,5);assert.equal(call.args.p_reemplazar_id,null);
});
test('conflicto entrega sala anterior sin anunciar éxito',async()=>{const s=service(async()=>({data:{error:'Sala anterior',code:'SALA_ACTIVA',partida:sala}}));const r=await s.api.crear(datos);assert.equal(r.success,false);assert.equal(r.code,'SALA_ACTIVA');assert.equal(r.data.id,'room');assert.equal(s.errors.length,1);});
test('reemplazo envía ID exacto y requestId del usuario',async()=>{const s=service(async()=>({data:sala}));await s.api.crear({...datos,reemplazarId:'old'});assert.equal(s.calls.at(-1).args.p_reemplazar_id,'old');});
for(const code of ['PGRST202','PGRST204','42883','42703'])test('migración ausente '+code+' identifica script y permite reintento',async()=>{let fail=true;const s=service(async()=>fail?{error:{code,message:'Missing'}}:{data:sala});const r=await s.api.crear(datos);assert.equal(r.success,false);assert.equal(r.migrationMissing,true);assert.match(r.error,/2026-10-11_fix_crear_partida.sql/);fail=false;assert.equal((await s.api.crear(datos)).success,true);});
test('recuperación servidor es explícita, admite vacío y exige reloj válido',async()=>{let current=sala;const s=service(async()=>({data:current}));assert.equal((await s.api.obtenerActiva()).data.id,'room');current=null;assert.equal((await s.api.obtenerActiva()).data,null);current={id:'room'};assert.equal((await s.api.obtenerActiva()).success,false);});
test('respuesta de creación vacía no se anuncia como sala creada',async()=>{const s=service(async()=>({data:null}));assert.equal((await s.api.crear(datos)).success,false);assert.equal(s.errors.length,1);});
test('reintento de solicitud ya cancelada o terminada exige nueva solicitud',async()=>{for(const phase of ['cancelled','finished']){const s=service(async()=>({data:{...sala,estado:'finalizada',configuracion:{runtime:{phase}}}}));const r=await s.api.crear(datos);assert.equal(r.success,false);assert.equal(r.code,'SOLICITUD_FINALIZADA');assert.match(r.error,/Reintentar/);}});
test('respuesta sin estado usable o runtime coherente no anuncia éxito',async()=>{for(const bad of [{...sala,estado:undefined},{...sala,estado:'activa'},{...sala,configuracion:{runtime:{phase:'decisions'}}}]){const s=service(async()=>({data:bad}));assert.equal((await s.api.crear(datos)).success,false);}});
