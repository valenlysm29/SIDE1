'use strict';
// The archived v11 bundle is historical evidence, not the candidate for deployment.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const node=require('../services/business_runtime.cjs');
const saved=require('./output/forense_utilidad/cierres_reales.json')[0].cierre.resultadosPorEmpresa['188'];
async function calculate(engine){let closure;const context={empresas:[{id:'188',capital:100000,snapshot:{decision_state:{__cyclePlans:{1:{state:saved.receipt.decisions}}},cash_ledger:{},financial_sections:{}}}],financialConfig:saved.receipt.financialPolicy,token:'archive-test'};
 const result=await engine.runOnce(async(name,args)=>{
  if(name==='side_cierres_pendientes')return {data:[{id:'archive-qa',cycles:[1]}]};
  if(name==='side_contexto_cierre_negocio')return {data:structuredClone(context)};
  if(name==='side_guardar_cierre_negocio'){closure=structuredClone(args.p_cierre);return {data:{cierre:closure}};}
  throw Error(name);
 });assert.equal(result[0].success,true,JSON.stringify(result));return closure.resultadosPorEmpresa['188'];
}
test('Edge v11 archivada reproduce el defecto y la candidata lo corrige sin cambiar caja',async()=>{
 const old=await import(pathToFileURL(path.resolve('tests/output/forense_utilidad/edge_desplegado.mjs')).href);
 const legacy=await calculate(old),current=await calculate(node);
 assert.equal(legacy.financial.estadoResultados.depreciacion,64.13);assert.equal(current.financial.estadoResultados.depreciacion,59.38);
 assert.equal(legacy.financial.estadoResultados.costoVentas,7091.89);assert.equal(current.financial.estadoResultados.costoVentas,7087.14);
 assert.deepEqual(current.financial.flujoCaja,legacy.financial.flujoCaja);assert.equal(current.financial.balanceGeneral.activosFijos,legacy.financial.balanceGeneral.activosFijos+4.75);
 assert.equal(current.financial.balanceGeneral.activos,current.financial.balanceGeneral.pasivoPatrimonio);
});
