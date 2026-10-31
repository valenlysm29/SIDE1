'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('consulta privada usa sesión del alumno y falla cerrada ante respuestas inválidas',async()=>{
 let argsSeen;const window={SIDE:{SupabaseClient:{get:()=>{throw Error('No debe usar sesión docente');},getStudent:()=>({rpc:async(name,args)=>{argsSeen={name,args};return {data:[{eventId:'PE69',status:'programado'}],error:null};}})}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../services/empresa_service.js'),'utf8'),{window});
 const api=window.SIDE.EmpresaService,result=await api.consultarDesafios('game',3);
 assert.equal(result.success,true);assert.equal(result.data[0].eventId,'PE69');assert.equal(argsSeen.name,'side_student_events_v1');assert.equal(argsSeen.args.p_empresa_id,3);
 assert.equal((await api.consultarDesafios('',3)).success,false);
});
