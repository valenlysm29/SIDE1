'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/profit_projection.js'),C=require('../js/cycle_model.js'),F=require('./economic_v19_fixture.cjs');
test('proyección y alternativas usan el cierre sin modificar decisiones ni contabilidad',()=>{
 const state=F.state(1,{},2);state.CANALES.optionIds=['sjl'];
 const input={state,catalog:F.catalog,round:1,capital:200000,ledger:{},sectionsByRound:{},financialPolicy:{cycles:6,authoritativePrices:true}};
 const before=JSON.stringify(input),actual=C.project(input),result=P.analyze(input);
 assert.equal(result.available,true);assert.equal(result.base.profit,actual.financial.estadoResultados.utilidadNeta);
 assert.equal(result.base.cash,actual.financial.balanceGeneral.efectivo);assert.equal(result.base.sold,actual.receipt.sold);
 assert.equal(JSON.stringify(input),before);assert.ok(result.alternatives.some(a=>a.label.startsWith('Personal')));
 assert.ok(result.alternatives.some(a=>a.label.startsWith('Maquinaria')));assert.ok(result.alternatives.some(a=>a.label.startsWith('Insumos')));
 assert.ok(result.alternatives.some(a=>a.label.startsWith('Canales')));
});
test('recepciones no verificadas no se presentan como proyección',()=>{
 const state=F.state();state.__materialOrders={};assert.equal(P.analyze({state,round:1}).available,false);
});
