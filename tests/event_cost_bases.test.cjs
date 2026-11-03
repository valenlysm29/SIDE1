'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),cost=require('../js/event_cost_bases'),F=require('../js/financial_model'),catalog=require('../js/events_catalog'),resolver=require('../js/engine/eventos_autorizados'),matrix=require('../docs/event_cost_bases.v1.json');
const e=(id,round=2)=>resolver.resolve({round,enabledEvents:[id],groupByCycle:{1:[id]},individualByCycle:{}}).map(e=>({...e,version:'legacy-event-context-v1'}));
test('92 matrix entries retain original amounts and pending academic approval; no global cost base',()=>{
 assert.equal(matrix.rows.length,92);assert.equal(new Set(matrix.rows.map(r=>r.event)).size,92);assert.equal(matrix.officialActivation,false);
 for(const row of matrix.rows){const source=catalog.find(e=>e.id===row.event);assert.equal(row.percentage,source.effect.costPct??source.effect.revenuePct??null);assert.equal(row.amount,source.effect.cashDelta??null);if(row.percentage&&source.effect.costPct)assert.ok(row.excludedAccounts.includes('totalCost: never used as fallback'));}
});
test('financial cost events use interest only, including duration, zero base and duplicates',()=>{
 for(const [id,factor] of [['PE53',1.06],['PE54',.96]])for(const round of [2,3]){
  const r=cost.interest({events:e(id,round),round,base:100,policy:'interest-base-proposal-v1'});assert.equal(r.amount,100*factor);assert.equal(r.applications[0].base,'interest-accrual');
  assert.equal(cost.interest({events:e(id,round),round,base:0,policy:'interest-base-proposal-v1'}).amount,0);
 }
 const events=e('PE53');assert.throws(()=>cost.interest({events,base:100,policy:'interest-base-proposal-v1'}));assert.throws(()=>cost.interest({events:[...events,...events],round:2,base:100,policy:'interest-base-proposal-v1'}));assert.throws(()=>cost.interest({events,round:4,base:100,policy:'interest-base-proposal-v1'}));assert.throws(()=>cost.interest({events,round:2,base:100}));assert.throws(()=>cost.interest({events:e('PE15',1),round:1,base:100,policy:'interest-base-proposal-v1'}));
});
test('accrual integration changes interest payable and profit, never principal/materials or a second cash charge',()=>{
 const args={capital:1000,round:2,catalog:[{items:[{id:'PRESTAMO'}]}],ledger:{'1:E':100},sectionsByRound:{1:{E:{recordedNet:100,items:[{id:'PRESTAMO',financing:100}]}}},state:{__cycleSettlements:{1:{decisions:{}},2:{events:e('PE53'),decisions:{}}}},financialPolicy:{cycles:3,interest:20}};
 const base=F.calculate(args),actual=F.calculate({...args,financialPolicy:{...args.financialPolicy,eventCostPolicy:'interest-base-proposal-v1'}});
 assert.equal(actual.balanceGeneral.deuda,base.balanceGeneral.deuda);assert.equal(actual.balanceGeneral.efectivo,base.balanceGeneral.efectivo);assert.equal(actual.estadoResultados.gastosFinancieros,Math.round(base.estadoResultados.gastosFinancieros*1.06*100)/100);assert.equal(actual.costEventApplications.length,1);assert.equal(actual.balanceGeneral.activos,actual.balanceGeneral.pasivoPatrimonio);
 assert.equal(require('../services/finance_config').resolve({cycles:3,eventCostPolicy:'interest-base-proposal-v1'}).eventCostPolicy,undefined,'proposal is deliberately not routed into official closure config');
});
