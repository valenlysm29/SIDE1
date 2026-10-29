'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../js/engine/cierre.js'),cycle=require('../js/cycle_model.js');
const {state,catalog}=require('./economic_v19_fixture.cjs');
test('v19 deterministic closure uses actual stock, segment eligibility and chosen price',()=>{
 const inputs=[0,1,2,3].map(type=>({id:String(type),state:state(1,{},type),round:1,catalog})),a=E.closeMany(inputs),b=E.closeMany(inputs);assert.deepEqual(a,b);
 assert.equal(a['0'].sales[0].price,42.5);assert.equal(a['2'].sales[2].quality,10);assert.equal(a['2'].sales[2].price,250);
 for(const result of Object.values(a)){assert.ok(result.revenue>0);for(const line of result.sales){assert.ok(line.sold<=line.available);assert.ok(line.assignedDemand>=0);}}
 assert.equal(a['0'].sales[1].sold,0);assert.equal(a['0'].allocation.products.urbano,undefined);
});
test('v19 equal prices give price score 100 and preserve unserved demand',()=>{
 const inputs=[0,1,2,3].map(id=>({id:String(id),state:state(),round:1,catalog})),r=E.closeMany(inputs);
 for(const x of Object.values(r)){assert.equal(x.allocation.products.esencial.puntajePrecio,100);assert.equal(x.sales[0].sold,90);assert.ok(x.sales[0].demand>x.sales[0].sold);}
 const empty=state();empty.HILO.quantities={};const z=E.closeMany([{id:'empty',state:empty,catalog,round:1},...inputs]);assert.equal(z.empty.revenue,0);assert.equal(z.empty.allocation.products.esencial,undefined);
});
test('document quality feeds market without changing the player price',()=>{
 const s=state(1,{},2);s.CUERO.quantities={cuero_sint:250};s.ACCESORIOS.quantities={acc_eco:1000};s.HILO.quantities={hilo_std:10000};
 const r=E.closeMany([{id:'x',state:s,catalog,round:1}]).x;assert.equal(r.sales[2].quality,5);assert.equal(r.sales[2].price,250);
 s.MOLDE.optionIds=['molde_1'];s.PRODUCCION_META.moldTargets={molde_1:90};assert.equal(E.prepare({id:'x',state:s,catalog,round:1}).lines[0].quality,0);
 // A malformed source cannot choose an unowned Premium mold and invent units.
 s.PRODUCCION_META.moldTargets={molde_3:90};const missing=E.closeMany([{id:'x',state:s,catalog,round:1}]).x;assert.equal(missing.revenue,0);
 const prepared=E.prepare({id:'x',state:state(1,{},2),round:1,catalog});prepared.lines[2].quality=5;const alloc=E.allocate([prepared]);assert.equal(alloc.x.products.premium.calidadMercado,100);assert.equal(alloc.x.products.premium.simulatedCompetitors.length,0);
});
test('v19 price validation and nonnegative price score',()=>{
 const s=state();s.PRODUCCION_META.prices.esencial=-1;assert.throws(()=>E.prices(s),/Precio/);
 const r=E.closeMany([{id:'x',state:state(1,{},1),round:1,catalog}]).x;assert.ok(Number.isFinite(r.scores.efficiency));assert.ok(r.scores.reputation<=10);assert.ok(r.allocation.products.urbano.puntajePrecio>=0);
});
test('v19 three cycles four companies have sales, receivables collect next cycle, retries reuse',()=>{
 const previous={},ledgers={};for(let round=1;round<=3;round++){
 const inputs=[0,1,2,3].map(type=>({id:String(type),state:state(round,previous[type]||{},type),ledger:ledgers[type]||{},round,catalog,capital:200000}));
 const results=cycle.closeMany(inputs);for(const [id,result] of Object.entries(results)){assert.ok(result.receipt.revenue>0);assert.ok(result.financial.balanceGeneral.cuentasPorCobrar>0);assert.equal(result.receipt.modelVersion,'md-20261027');if(round>1)assert.ok(result.receipt.creditCollections>0);previous[id]=result.state;ledgers[id]=result.ledger;const retry=cycle.close({...inputs.find(i=>i.id===id),state:result.state,ledger:result.ledger});assert.equal(retry.reused,true);assert.equal(retry.receipt.revenue,result.receipt.revenue);}
 }
});
test('v19 physical resource failures report no production',()=>{
 for(const key of ['CUERO','HILO','ACCESORIOS','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']){const s=state();s[key].quantities={};const r=E.closeMany([{id:'x',state:s,catalog,round:1}]).x;assert.equal(r.revenue,0,key);assert.ok(r.sales[0].reason);}
});
module.exports={state,catalog};
test('physical capacity follows the document without catalog score penalties',()=>{
 const s=state();s.PRODUCCION_META.moldTargets={molde_1:10000};
 const config={...E.config,consequences:{...E.config.consequences,lowEfficiency:11}};
 const raw=require('../js/production_model.js').calculate({state:s,catalog,round:1});
 const prepared=E.prepare({state:s,catalog,round:1},config);
 assert.equal(prepared.plan.producibleUnits,raw.producibleUnits);
 assert.equal(prepared.messages.some(m=>m.id==='CONS-03'),false);
});
test('v19 reconstructed cost sections survive authoritative financial recalculation',()=>{
 const FIN=require('../js/financial_model.js'),input={state:state(2,state(1)),round:2,catalog,capital:200000,ledger:{},sectionsByRound:{}},r=cycle.close(input);
 assert.ok(Object.keys(r.financialSections[2]).length>0);
 const refreshed=structuredClone(r.state);delete refreshed.__financialSnapshots[2];
 const recalculated=FIN.calculate({capital:200000,round:2,catalog,state:refreshed,ledger:r.ledger,sectionsByRound:r.financialSections});
 assert.deepEqual(recalculated,r.financial);assert.ok(recalculated.balanceGeneral.inventarioMP>0);
});
test('v19 asset depreciation reads real UI purchases history without synthetic quantities',()=>{
 const s=state();for(const id of ['MESA_CORTE','ENSAMBLE','ACABADOS']){delete s[id].quantities;delete s[id].optionIds;}
 const r=cycle.close({state:s,catalog,round:1,capital:200000});
 assert.ok(r.receipt.produced>0);assert.ok(r.financial.estadoResultados.depreciacion>0);
 const accelerated=state();for(const id of ['MESA_CORTE','ENSAMBLE','ACABADOS']){delete accelerated[id].quantities;delete accelerated[id].optionIds;}accelerated.__catalogSelection=['FIN-02C'];
 const a=cycle.close({state:accelerated,catalog,round:1,capital:200000});
 assert.equal(a.financial.estadoResultados.depreciacion,r.financial.estadoResultados.depreciacion); // monthly straight line in source
 assert.equal(a.financial.balanceCaja.cajaFinal,r.financial.balanceCaja.cajaFinal);
});
