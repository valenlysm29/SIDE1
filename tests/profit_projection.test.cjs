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
test('la vista de estudiante muestra la proyección y advierte sus límites',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 const snippet=source.slice(source.indexOf('function showProfitProjection(){'),source.indexOf('\nfunction renderDecisionCategory(){'));
 const state=F.state(1,{},2),mount={innerHTML:'',textContent:''},ctx={
  document:{querySelector:()=>mount},window:{SIDE_PROFIT_PROJECTION:P},temporalStudentRoom:()=>false,
  decisionModelContext:()=>({state}),deepClone:x=>JSON.parse(JSON.stringify(x)),financialLedger:()=>({}),recordedFinancialSections:()=>({}),currentRound:()=>1,
  DECISION_CATALOG:F.catalog,prepareSectionSave:cat=>({entries:Object.fromEntries((cat.items||[]).filter(i=>state[i.id]).map(i=>[i.id,state[i.id]]))}),initialCapital:()=>200000,teacherConfig:()=>({cycles:6}),cycleBusinessData:()=>({events:[]}),escapeHtml:String,money:x=>`S/ ${Number(x).toFixed(2)}`,console
 };
 vm.runInNewContext(snippet+'\nshowProfitProjection();',ctx);
 assert.match(mount.innerHTML,/utilidad estimada/);assert.match(mount.innerHTML,/caja final/);assert.match(mount.innerHTML,/parejas activas/);assert.match(mount.innerHTML,/no incluye el reparto definitivo/);
});
