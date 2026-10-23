'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const CYCLE=require('../js/cycle_model.js');
const plan=units=>({producibleUnits:units,productLines:[{plannedUnits:units,target:units}],materials:[]});
const channel={CANALES:{round:1,optionIds:['web']}};
test('channel gate prevents fictitious revenue and commission even with finished stock',()=>{
 const result=CYCLE.close({state:{__finishedGoods:{esencial:50}},production:plan(20)});
 assert.equal(result.receipt.sold,0);assert.equal(result.receipt.revenue,0);assert.equal(result.state.__finishedGoods.esencial,70);
 assert.equal(result.ledger['1:COMISION_VENTAS'],0);
});
test('web sales earn exactly one percent commission and close is idempotent',()=>{
 const first=CYCLE.close({state:channel,production:plan(10),prices:{esencial:75}});
 assert.equal(first.receipt.sold,10);assert.equal(first.ledger['1:SIM_VENTAS'],750);assert.equal(first.ledger['1:COMISION_VENTAS'],-7.5);
 const second=CYCLE.close({...first,round:1,production:plan(99999),prices:{esencial:999}});
 assert.equal(second.reused,true);assert.deepEqual(second.receipt,first.receipt);assert.deepEqual(second.ledger,first.ledger);
});
test('unsold inventory carries forward and earlier receipt remains frozen',()=>{
 const first=CYCLE.close({state:channel,production:plan(100),allocation:{products:{esencial:{asignado:30}}}});
 const frozen=JSON.stringify(first.receipt);
 const second=CYCLE.close({state:first.state,ledger:first.ledger,round:2,production:plan(20),allocation:{products:{esencial:{asignado:500}}}});
 assert.equal(first.receipt.sold,30);assert.equal(second.receipt.sales[0].available,90);assert.equal(second.receipt.sold,90);assert.equal(second.state.__finishedGoods.esencial,0);
 assert.equal(JSON.stringify(second.state.__cycleSettlements[1]),frozen);
});
test('material inventory preserves unrelated lots and consumes only available purchased stock',()=>{
 const catalog=[{items:[{id:'CUERO',options:[{id:'cuero_sint'}]}]}];
 const state={...channel,__inventarioMP:{cuero_sint:10,hilo_std:100},CUERO:{round:1,quantities:{cuero_sint:20}}};
 const result=CYCLE.close({state,catalog,production:{...plan(10),materials:[{id:'CUERO',consumption:12}]}});
 assert.equal(result.state.__inventarioMP.cuero_sint,18);assert.equal(result.state.__inventarioMP.hilo_std,100);
 assert.equal(result.receipt.production.materials[0].consumption,12);
});
test('shared closing keeps company stock and cash isolated',()=>{
 const result=CYCLE.closeMany([{id:'A',round:1,state:channel,production:plan(10)},{id:'B',round:1,state:{CANALES:{optionIds:[]},__finishedGoods:{esencial:15}},production:plan(5)}]);
 assert.equal(result.A.receipt.sold,10);assert.equal(result.B.receipt.sold,0);assert.equal(result.B.state.__finishedGoods.esencial,20);assert.equal(result.B.ledger['1:SIM_VENTAS'],0);
});
test('POS receipts never alter assigned demand or stock',()=>{
 const result=CYCLE.close({state:channel,production:plan(10),soldByProduct:{esencial:8},allocation:{products:{esencial:{asignado:2}}}});
 assert.equal(result.receipt.sold,2);assert.equal(result.state.__finishedGoods.esencial,8);assert.equal(result.ledger['1:SIM_VENTAS'],150);
 const capped=CYCLE.close({state:channel,production:plan(10),soldByProduct:{esencial:30},allocation:{products:{esencial:{asignado:2}}}});
 assert.equal(capped.receipt.sold,2);
});
test('restoring a submitted plan preserves live material inventories and accounting seed',()=>{
 const live={CUERO:{round:3,quantities:{cuero_sint:999}},__inventarioMP:{cuero_sint:15},__openingBalance:{round:1,cash:500},__financialSnapshots:{1:{profit:100}}};
 const restored=CYCLE.restoreState({CUERO:{round:2,quantities:{cuero_sint:10}},__inventarioMP:{cuero_sint:1}},live);
 assert.equal(restored.CUERO.round,2);assert.equal(restored.__inventarioMP.cuero_sint,15);assert.deepEqual(restored.__openingBalance,live.__openingBalance);assert.deepEqual(restored.__financialSnapshots,live.__financialSnapshots);
});
test('commercial event changes demand before fulfillment, never money beyond stocked units',()=>{
 const result=CYCLE.close({state:channel,production:plan(10),events:[{id:'PE03',effect:{revenuePct:25}}],allocation:{products:{esencial:{asignado:8}}}});
 assert.equal(result.receipt.sold,10);assert.equal(result.receipt.revenue,750);assert.equal(result.receipt.demandFactor,1.25);
 assert.equal(result.receipt.events[0].id,'PE03');assert.equal(result.ledger['1:SIM_VENTAS'],750);
 const empty=CYCLE.close({state:channel,production:plan(0),events:[{effect:{revenuePct:100}}],allocation:{products:{esencial:{asignado:100}}}});
 assert.equal(empty.receipt.revenue,0);
});
