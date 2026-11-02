'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('seguimiento conserva fencing, prioriza nuevas y aísla el fallo histórico',async()=>{
 const {runTracked}=await import('../supabase/functions/side-business-close/route.mjs'),calls=[],order=[];
 const rpc=async(name,args)=>{
  calls.push([name,args]);
  if(name==='side_cierres_pendientes')return {data:[{id:'old',cycles:[2,3]},{id:'new',cycles:[1]}]};
  if(name==='side_version_worker_cierre')return {data:args.p_partida_id==='old'?'0':'1'};
  if(name==='side_iniciar_intento_cierre')return {data:true};
  if(name==='side_finalizar_intento_cierre')return {data:null};
  if(name==='side_contexto_cierre_con_intento')return {data:{}};
  if(name==='side_guardar_cierre_con_intento')return {data:{success:true}};
  throw Error('Unfenced RPC '+name);
 };
 const engine=async scoped=>{
  const [game]=(await scoped('side_cierres_pendientes',{})).data;order.push(game.id);
  await scoped('side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:game.cycles[0]});
  await scoped('side_guardar_cierre_negocio',{p_partida_id:game.id,p_ciclo:game.cycles[0],p_token:'revision',p_cierre:{}});
  return [{game:game.id,cycle:game.cycles[0],success:true}];
 };
 const result=await runTracked(rpc,async scoped=>{const [g]=(await scoped('side_cierres_pendientes',{})).data;order.push(g.id);throw Error('network')},engine,{runId:'registered'});
 assert.deepEqual(order,['new','old']);assert.equal(result[0].success,true);assert.equal(result[1].success,false);
 assert.equal(calls.filter(([n])=>n==='side_finalizar_intento_cierre').length,2);
 assert.ok(!calls.some(([n])=>n==='side_registrar_estado_cierre'));
 assert.equal(calls.find(([n])=>n==='side_guardar_cierre_con_intento')[1].p_run,'registered');
});
test('intento ocupado no puede cerrar ni finalizar la propiedad ajena',async()=>{
 const {runTracked}=await import('../supabase/functions/side-business-close/route.mjs'),calls=[];
 const rpc=async(name)=>{calls.push(name);if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};if(name==='side_version_worker_cierre')return {data:'1'};if(name==='side_iniciar_intento_cierre')return {data:false};throw Error(name);};
 const result=await runTracked(rpc,()=>assert.fail(),()=>assert.fail(),{runId:'other'});
 assert.equal(result[0].code,'INTENTO_EN_CURSO');assert.equal(result[0].pending,true);assert.ok(!calls.includes('side_finalizar_intento_cierre'));
 await assert.rejects(runTracked(rpc,()=>{},()=>{},{}),/identificador/);
});
