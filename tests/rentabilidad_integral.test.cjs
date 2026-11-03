'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const C=require('../js/cycle_model'),P=require('../js/profit_projection'),{catalog}=require('./economic_v19_fixture.cjs'),{plan}=require('./rentabilidad_plan.cjs');
const money=x=>Math.round(x*100)/100,out='tests/output/rentabilidad_final';fs.mkdirSync(out,{recursive:true});const evidence=[];
for(const cycles of [3,6])test(`transición básico, estándar y prémium con tres competidores, ${cycles} ciclos y unas 1000 unidades`,()=>{
 let previous={},produced=0,sold=0;
 for(let round=1;round<=cycles;round++){
  const inputs=['a','b','c'].map(id=>({id,capital:100000,catalog,round,state:C.restoreState(plan({round,cycles,previous:previous[id]}),previous[id]?.state||{}),ledger:previous[id]?.ledger||{},sectionsByRound:previous[id]?.financialSections||{},financialPolicy:{cycles,economicRulesVersion:'utility-v1',authoritativePrices:true}}));
  const closed=C.closeMany(inputs);
  for(const id of ['a','b','c']){const r=closed[id],b=r.financial.balanceGeneral,f=r.financial.flujoCaja,e=r.financial.estadoResultados;
   assert.equal(money(b.activos-b.pasivoPatrimonio),0);assert.ok(b.efectivo>=0);assert.equal(b.deuda,0);assert.ok(r.receipt.sold<=r.receipt.produced+Object.values(previous[id]?.receipt.goods||{}).reduce((a,b)=>a+b,0));
   const decisionPayments=catalog.filter(c=>!c.summaryOnly).reduce((s,c)=>s+Number(r.ledger[`${round}:${c.cat}`]||0),0);assert.ok(f.cajaInicial+decisionPayments>=0,'sin financiar compras con ventas futuras');
   if(previous[id])assert.equal(f.cajaInicial,previous[id].financial.balanceGeneral.efectivo);
   if(id==='a'){produced+=r.receipt.produced;sold+=r.receipt.sold;evidence.push({cycles,round,produced:r.receipt.produced,sold:r.receipt.sold,financial:r.financial,receipt:r.receipt});}
  }
  previous=closed;
 }
 assert.ok(produced>=900&&produced<=1100,`producción total ${produced}`);assert.ok(sold>=900&&sold<=produced,`ventas reales ${sold}`);
 for(const r of Object.values(previous)){assert.ok(r.financial.balanceGeneral.resultadosAcumulados>0);assert.ok(r.financial.balanceGeneral.efectivo>100000,'recupera la inversión sin préstamos');}
 fs.writeFileSync(out+'/estrategias.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({cycles,produced,sold,profit:previous.a.financial.balanceGeneral.resultadosAcumulados,cash:previous.a.financial.balanceGeneral.efectivo}));
});
test('escala 1000 por ciclo: producción física no equivale a 1000 ventas prémium',()=>{
 let previous={},partial=false;const scale=[];
 for(let round=1;round<=3;round++){
  const inputs=['a','b','c'].map(id=>({id,capital:200000,catalog,round,state:C.restoreState(plan({round,cycles:3,previous:previous[id],scenario:'scale-1000'}),previous[id]?.state||{}),ledger:previous[id]?.ledger||{},sectionsByRound:previous[id]?.financialSections||{},financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',authoritativePrices:true}}));
  const closed=C.closeMany(inputs);for(const r of Object.values(closed)){assert.ok(r.receipt.produced<=r.receipt.production.processCapacity);assert.ok(r.receipt.sold<=r.receipt.sales.reduce((s,x)=>s+x.demand,0));assert.equal(money(r.financial.balanceGeneral.activos-r.financial.balanceGeneral.pasivoPatrimonio),0);assert.ok(r.financial.balanceGeneral.efectivo>=0);const payments=catalog.filter(c=>!c.summaryOnly).reduce((sum,c)=>sum+Number(r.ledger[`${round}:${c.cat}`]||0),0);assert.ok(r.financial.flujoCaja.cajaInicial+payments>=0);if(round===3){assert.ok(r.receipt.sold<r.receipt.produced);partial=true;}}
  scale.push({round,produced:closed.a.receipt.produced,sold:closed.a.receipt.sold,capacity:closed.a.receipt.production.processCapacity,demand:closed.a.receipt.sales.reduce((s,x)=>s+x.demand,0),inventory:closed.a.financial.balanceGeneral.inventarioPT,net:closed.a.financial.estadoResultados.utilidadNeta,cash:closed.a.financial.balanceGeneral.efectivo});
  previous=closed;
 }assert.ok(partial);fs.writeFileSync(out+'/escala1000.json',JSON.stringify(scale,null,2));
});
test('analista rentable y no rentable: diferencia del mismo plan, no ahorro inventado',()=>{
 const profitable=plan({round:1,cycles:3,scenario:'analyst-benefit'}),r=P.analyze({state:profitable,catalog,round:1,capital:200000,financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',authoritativePrices:true}});
 assert.ok(r.available);assert.ok(r.analyst.purchaseSavings>r.analyst.cost);assert.ok(r.analyst.profitEffect>0);
 const small=plan({round:1,cycles:3});small.PRODUCCION_META.moldTargets={molde_1:100};small.CUERO.quantities={cuero_sint:30};small.ACCESORIOS.quantities={acc_eco:100};small.HILO.quantities={hilo_std:600};small.ANALISTA_COMPRAS.optionIds=['si_analista'];
 const bad=P.analyze({state:small,catalog,round:1,capital:100000,financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',authoritativePrices:true}});assert.ok(bad.available);assert.ok(bad.analyst.profitEffect<0);assert.ok(bad.lossReasons.some(x=>x.includes('analista')));
 fs.writeFileSync(out+'/analista.json',JSON.stringify({profitable:r.analyst,unprofitable:bad.analyst},null,2));
});
test('malas decisiones generan pérdida y el diagnóstico no modifica las decisiones',()=>{
 const input={state:plan({round:1,cycles:3,scenario:'inefficient'}),catalog,round:1,capital:100000,financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',authoritativePrices:true}},before=JSON.stringify(input),r=P.analyze(input);
 assert.ok(r.available);assert.ok(r.base.profit<0);assert.ok(r.lossReasons.length>0);assert.equal(JSON.stringify(input),before);
 assert.equal(r.base.operatingExpenses,C.close(input).financial.estadoResultados.gastosOperacion);assert.ok(r.base.sales[0].targetPrices.every(p=>p.price>r.base.sales[0].price));
});

test('una pérdida inicial puede recuperarse con decisiones eficientes y capital suficiente',()=>{
 let previous={},rows=[];
 for(let round=1;round<=3;round++){
  const inputs=['a','b','c'].map(id=>{const state=plan({round,cycles:3,previous:previous[id]});if(round===1){state.PRODUCCION_META.moldTargets={molde_1:100};state.CUERO.quantities={cuero_sint:30};state.ACCESORIOS.quantities={acc_eco:100};state.HILO.quantities={hilo_std:600};state.ANALISTA_COMPRAS.optionIds=['si_analista'];}return {id,capital:100000,catalog,round,state:C.restoreState(state,previous[id]?.state||{}),ledger:previous[id]?.ledger||{},sectionsByRound:previous[id]?.financialSections||{},financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',authoritativePrices:true}};});
  previous=C.closeMany(inputs);for(const r of Object.values(previous)){assert.equal(money(r.financial.balanceGeneral.activos-r.financial.balanceGeneral.pasivoPatrimonio),0);assert.ok(r.financial.balanceGeneral.efectivo>=0);}rows.push({round,net:previous.a.financial.estadoResultados.utilidadNeta,accumulated:previous.a.financial.balanceGeneral.resultadosAcumulados,cash:previous.a.financial.balanceGeneral.efectivo});
 }
 assert.ok(rows[0].net<0);assert.ok(rows[2].accumulated>0);fs.writeFileSync(out+'/recuperacion.json',JSON.stringify(rows,null,2));
});
