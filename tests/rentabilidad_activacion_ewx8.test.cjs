'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/cycle_model'),F=require('./economic_v19_fixture.cjs'),policy=require('../services/finance_config');
const cases=require('./fixtures/rentabilidad_ewx8.json');
const modern={cycles:3,authoritativePrices:true,economicRulesVersion:'utility-v1'};
const close=(state,financialPolicy=modern)=>C.close({state:structuredClone(state),catalog:F.catalog,round:1,capital:100000,financialPolicy});
const money=n=>Math.round(n*100)/100;
function reconcile(r){
 const f=r.financial,b=f.balanceGeneral,e=f.estadoResultados,c=f.balanceCaja;
 assert.equal(b.activos,b.pasivoPatrimonio);
 assert.equal(b.patrimonio,money(b.capital+b.resultadosAcumulados));
 assert.equal(c.cajaFinal,money(c.cajaInicial+c.entradas-c.salidas));
 assert.equal(e.utilidadNeta,money(e.utilidadAntesImpuestos-e.impuestoRenta));
 assert.equal(r.receipt.revenue,money(r.receipt.sales.reduce((s,x)=>s+x.sold*x.price,0)));
 for(const row of r.receipt.sales)assert.ok(row.sold<=row.available&&row.sold<=row.demand);
}
test('EWX8: reproduce ambos resultados oficiales sin modificar el fixture',()=>{
 const before=JSON.stringify(cases);
 for(const [id,x] of Object.entries(cases)){
  const r=close(x.state,{cycles:3,authoritativePrices:true});
  assert.equal(r.financial.estadoResultados.utilidadNeta,x.official.utilidadNeta);
  assert.equal(r.financial.estadoResultados.costoVentas,x.official.costoVentas);reconcile(r);
 }
 assert.equal(close(cases['204'].state,{cycles:3,authoritativePrices:true}).receipt.produced,66);
 assert.equal(JSON.stringify(cases),before);
});
test('Demo1: compras de máquinas puntúan, meta física 100, ventas 100; no regala utilidad',()=>{
 const r=close(cases['204'].state);reconcile(r);
 assert.equal(r.receipt.produced,100);assert.equal(r.receipt.sold,100);assert.equal(r.receipt.scores.efficiency,5);
 assert.ok(!r.receipt.consequences.some(x=>['CONS-03','CONS-08'].includes(x.id)));
 assert.equal(r.financial.estadoResultados.utilidadNeta,-2017.35);
 assert.equal(close(cases['203'].state).financial.estadoResultados.utilidadNeta,-8140.99);
});
test('decisión eficiente C1 positiva; sobredotar, carecer de insumos o canal conserva pérdidas',()=>{
 const state=structuredClone(cases['204'].state);
 state.CANALES={round:1,optionIds:['web']};state.INV_MARKETING={round:1,value:0};
 const efficient=close(state);reconcile(efficient);
 assert.equal(efficient.financial.estadoResultados.utilidadNeta,782.65);
 assert.ok(efficient.financial.balanceGeneral.efectivo>0);
 for(const change of [s=>{s.HILO={round:1,quantities:{}}},s=>{s.CANALES={round:1,optionIds:[]}},s=>{
  for(const id of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'])for(const k in s[id].quantities)s[id].quantities[k]*=4;
 }]){
  const bad=structuredClone(state);change(bad);const r=close(bad);reconcile(r);
  assert.ok(r.financial.estadoResultados.utilidadNeta<0);
 }
 console.log('DEMO1_EFICIENTE '+JSON.stringify({producido:efficient.receipt.produced,vendido:efficient.receipt.sold,precio:120,utilidad:efficient.financial.estadoResultados.utilidadNeta,caja:efficient.financial.balanceGeneral.efectivo}));
});
test('frontend y backend respetan ciclo efectivo y precios internos',()=>{
 const config={...modern,economicRulesEffectiveRound:2};
 const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../services/finance_config'),'utf8'),ctx);
 for(const round of [1,2,3]){
  const local=policy.resolve(config,round),front=JSON.parse(JSON.stringify(ctx.SIDE_FINANCE_CONFIG.resolve(config,round)));
  assert.deepEqual(front,local);assert.equal(local.economicRulesVersion,round===1?undefined:'utility-v1');
 }
 assert.throws(()=>policy.resolve({...config,economicRulesEffectiveRound:0},2),/activación/);
});
test('Node y las dos rutas Edge coinciden con las decisiones reales y la activación diferida',async()=>{
 const engines=[require('../services/business_runtime.cjs').runOnce,
  (await import('../supabase/functions/side-business-close/runtime.mjs')).runOnce,
  (await import('../supabase/functions/side-business-close/legacy-runtime.mjs')).runOnce];
 for(const effective of [1,2]){
  const results=[];
  for(const engine of engines){
   let written;
   const rpc=async(name,args)=>{
    if(name==='side_cierres_pendientes')return {data:[{id:'EWX8-fixture',cycles:[1]}]};
    if(name==='side_contexto_cierre_negocio')return {data:{empresas:Object.entries(cases).map(([id,x])=>({id,capital:100000,snapshot:{decision_state:{__cyclePlans:{1:{state:structuredClone(x.state)}}}}})),financialConfig:{...modern,economicRulesEffectiveRound:effective},token:'fixture'}};
    if(name==='side_guardar_cierre_negocio'){written=args.p_cierre;return {data:{cierre:written}}}
    throw Error(name);
   };
   const run=await engine(rpc);assert.equal(run[0].success,true,JSON.stringify(run));results.push(written);
  }
  assert.deepEqual(results[1],results[0]);
  // Worker 0 retains its historical mold depreciation; commercial activation
  // must agree without silently migrating that accounting engine to worker 1.
  for(const id of Object.keys(cases)){
   const old=results[2].resultadosPorEmpresa[id],current=results[0].resultadosPorEmpresa[id];
   assert.equal(old.receipt.produced,current.receipt.produced);assert.equal(old.receipt.sold,current.receipt.sold);
   assert.deepEqual(old.receipt.sales.map(x=>x.price),current.receipt.sales.map(x=>x.price));
   assert.equal(old.financial.balanceCaja.cajaFinal,current.financial.balanceCaja.cajaFinal);reconcile(old);
  }
  for(const r of Object.values(results[0].resultadosPorEmpresa))reconcile(r);
  assert.equal(results[0].resultadosPorEmpresa['204'].receipt.produced,effective===1?100:66);
 }
});
