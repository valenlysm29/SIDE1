const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function service(rpc){
 const c={console:{error(){}},setTimeout,clearTimeout,window:{SIDE:{SupabaseClient:{get:()=>({rpc})}}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/partida_service.js'),'utf8'),c);
 return c.window.SIDE.PartidaService;
}
test('cancelar llama RPC y exige confirmación de la misma partida cancelada',async()=>{
 const calls=[],s=service(async(name,args)=>{calls.push({name,args});return {data:{id:'sala',estado:'cancelada',cancelled_at:'2026-10-12T00:00:00Z'}};});
 assert.equal((await s.cancelar('sala')).success,true);
 assert.equal(calls[0].name,'cancelar_partida');assert.equal(calls[0].args.p_partida_id,'sala');
 for(const data of [null,{id:'otra',estado:'cancelada'},{id:'sala',estado:'activa'}])assert.equal((await service(async()=>({data})).cancelar('sala')).success,false);
});
test('cancelar informa migración pendiente y rechazo de propietario sin falso éxito',async()=>{
 const missing=await service(async()=>({error:{code:'PGRST202',message:'missing'}})).cancelar('sala');
 assert.equal(missing.success,false);assert.match(missing.error,/2026-10-12_salas_codigo.sql/);
 const denied=await service(async()=>({data:{success:false,code:'NO_AUTORIZADO',error:'No tienes permiso'}})).cancelar('sala');
 assert.equal(denied.success,false);assert.equal(denied.code,'NO_AUTORIZADO');assert.equal(denied.error,'No tienes permiso');
});
