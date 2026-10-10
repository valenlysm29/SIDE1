'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function service(reply){
 const calls=[],window={SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>{calls.push({name,args});return reply;}})}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/partida_service.js'),'utf8'),{window});
 return {save:window.SIDE.PartidaService.guardarPuntaje,calls};
}
test('grade service acknowledges only a confirmed matching grade, including zero',async()=>{
 for(const value of [0,18.75,20]){
  const {save,calls}=service({data:{success:true,puntaje:String(value)},error:null});
  const result=await save('finished-game',7,value);
  assert.equal(result.success,true);assert.equal(result.puntaje,value);
  assert.equal(calls[0].args.p_partida_id,'finished-game');
 }
 for(const data of [null,{}, {success:false}, {success:true}, {success:true,puntaje:2}]){
  const {save}=service({data,error:null});
  assert.equal((await save('game',7,18)).success,false);
 }
});
test('grade service explains missing Supabase migration and validates before RPC',async()=>{
 const {save,calls}=service({data:null,error:{code:'PGRST202',message:'missing function'}});
 assert.match((await save('game',7,18)).error,/20260929_guardar_puntaje_docente.sql/);
 for(const value of [-1,20.01,NaN,Infinity])assert.equal((await save('game',7,value)).success,false);
 assert.equal((await save(null,7,18)).success,false);
 assert.equal((await save('game',null,18)).success,false);
 assert.equal(calls.length,1);
});
