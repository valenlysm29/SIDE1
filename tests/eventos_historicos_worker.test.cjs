'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runOnce}=require('../services/business_runtime.cjs'),fixture=require('./economic_v19_fixture.cjs');
async function run(facts,enabledEvents=['PE07']){
 let written;const state=fixture.state(1,{},0);
 const rpc=async(name,args)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'game',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'1',capital:100000,snapshot:{decision_state:{__cyclePlans:{1:{state}},__cycleBusiness:{1:{events:[{id:'tampered',effect:{revenuePct:9999}}]}}}}}],financialConfig:{cycles:3,economicRulesVersion:'utility-v1',enabledEvents},token:'token'}};
  if(name==='side_legacy_event_context_v1')return {data:facts};
  if(name==='side_guardar_cierre_negocio'){written=args.p_cierre;return {data:{cierre:written}};}
  throw Error(name);
 };
 return {result:(await runOnce(rpc))[0],get written(){return written;}};
}
test('eventos históricos se obtienen del servidor y no del cliente',async()=>{
 const runResult=await run({version:'legacy-event-context-v1',companyId:'1',cycle:1,enabledEvents:['PE07'],groupByCycle:{1:['PE07']},individualByCycle:{1:[]}});
 assert.equal(runResult.result.success,true,JSON.stringify(runResult.result));
 assert.equal(runResult.written.resultadosPorEmpresa['1'].receipt.events[0].id,'PE07');
 assert.equal(runResult.written.resultadosPorEmpresa['1'].receipt.events[0].effect.revenuePct,12);
});
test('eventos históricos sin contexto verificable no se guardan',async()=>{
 const outcome=await run({error:'Sorteo no verificado'});assert.equal(outcome.result.code,'EVENTOS_NO_VERIFICADOS');assert.equal(outcome.written,undefined);
});
test('efectos históricos de costos no se omiten silenciosamente',async()=>{
 const outcome=await run({version:'legacy-event-context-v1',companyId:'1',cycle:1,enabledEvents:['PE15'],groupByCycle:{1:['PE15']},individualByCycle:{1:[]}},['PE15']);
 assert.equal(outcome.result.code,'EFECTO_HISTORICO_NO_DISPONIBLE');assert.equal(outcome.written,undefined);
});
