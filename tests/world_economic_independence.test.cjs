'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cycle=require('../js/cycle_model.js');
test('legacy world charges are removed before closure while frozen history and decisions stay intact',()=>{
 const ledger={'1:SIM_VENTAS':75,'1:SIM_GASTOS':-10,'2:SIM_GASTOS':-20,'3:SIM_INVERSION':-100,'3:SIM_DEVOLUCIONES':-75,'3:SIM_VENTAS':999,'3:COMISION_VENTAS':-10,'3:C':-1500};
 const clean=cycle.economicLedger(ledger,{__openingBalance:{round:1},__financialSnapshots:{2:{balanceGeneral:{efectivo:500}}}});
 assert.deepEqual(clean,{'1:SIM_VENTAS':75,'1:SIM_GASTOS':-10,'2:SIM_GASTOS':-20,'3:C':-1500});
 assert.equal(ledger['3:SIM_VENTAS'],999,'the caller can archive the original ledger');
});
test('world sales cannot raise assigned demand, revenue, production, stock or cash',()=>{
 const input={state:{CANALES:{optionIds:['web']}},capital:200000,round:1,production:{producibleUnits:500,productLines:[{plannedUnits:500}],materials:[]},allocation:{products:{esencial:{asignado:7}}}};
 const baseline=cycle.close(input);
 const played=cycle.close({...input,soldUnits:999999,soldByProduct:{esencial:999999},ledger:{'1:SIM_VENTAS':999999,'1:SIM_GASTOS':-300,'1:SIM_INVERSION':-1000,'1:SIM_DEVOLUCIONES':-75}});
 assert.deepEqual(played,baseline);assert.equal(played.receipt.sold,7);assert.equal(played.receipt.revenue,525);
});
test('cycle business context never reads world inventory or prices',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 const fn=source.slice(source.indexOf('function cycleBusinessData('),source.indexOf('\nfunction captureCyclePlan('));
 const context={currentRound:()=>1,activeStudentEvents:()=>[{id:'event'}],deepClone:structuredClone,decisionState:{},localStorage:{getItem(){throw Error('economic context touched world storage');}}};
 vm.createContext(context);vm.runInContext(fn,context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.cycleBusinessData())),{events:[{id:'event'}]});
});
test('world has no financial write bridge and the bridge exposes no mutable decisions',()=>{
 const world=fs.readFileSync(require.resolve('../js/simulator3d.js'),'utf8'),app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
 assert.doesNotMatch(world,/bridge\(\)\.(?:recordOperatingExpense|recordSimulatedSale|ledger)/);
 const bridge=app.slice(app.indexOf('window.SIDE_GAME_BRIDGE='),app.indexOf('// Landing / acceso'));
 assert.doesNotMatch(bridge,/recordOperatingExpense|recordSimulatedSale|get ledger/);
 assert.match(bridge,/get decisions\(\)\{return deepClone\(decisionState\)\}/);
});
