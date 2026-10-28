const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../js/financial_model.js'),config=require('../services/finance_config.js');
const state={__cycleSettlements:{1:{sold:0},2:{sold:0}}};
test('tax is deferred and accumulated losses offset final-cycle profit',()=>{
 const result=F.calculate({capital:10000,round:2,ledger:{'1:SIM_GASTOS':-500,'2:SIM_GASTOS':1000},state,financialPolicy:{cycles:2}});
 assert.equal(result.history[0].estadoResultados.impuestoRenta,0);
 assert.equal(result.estadoResultados.impuestoRenta,147.5);
 assert.equal(result.balanceGeneral.impuestosPorPagar,0);
 assert.equal(result.balanceCaja.cajaFinal,10352.5);
});
test('accumulated loss has zero tax and pending final period is not liquidated',()=>{
 const result=F.calculate({capital:10000,round:2,ledger:{'1:SIM_GASTOS':-1000,'2:SIM_GASTOS':500},state,financialPolicy:{cycles:2}});
 assert.equal(result.estadoResultados.impuestoRenta,0);
 const pending=F.calculate({capital:10000,round:2,ledger:{'1:SIM_GASTOS':1000},state:{__cycleSettlements:{1:{sold:0}}},financialPolicy:{cycles:2}});
 assert.equal(pending.estadoResultados.impuestoRenta,0);assert.equal(pending.estadoResultados.impuestoDiferido,true);
});
test('financial schedule keeps total cycles for the runtime and worker',()=>{
 assert.equal(config.resolve({cycles:2,financialSchedule:[{effectiveRound:1,interest:25}]},2).cycles,2);
});
