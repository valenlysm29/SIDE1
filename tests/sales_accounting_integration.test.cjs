'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const CYCLE=require('../js/cycle_model.js'),{state,catalog}=require('./economic_v19_fixture.cjs');
const input=(s=state(),round=1,extra={})=>({state:s,catalog,round,capital:200000,...extra});
test('channel gate prevents fictitious revenue and commission even with finished stock',()=>{
 const s=state();s.CANALES.optionIds=[];s.__finishedGoods={esencial:50};const r=CYCLE.close(input(s));
 assert.equal(r.receipt.revenue,0);assert.equal(r.state.__finishedGoods.esencial,r.receipt.produced+50);assert.equal(r.ledger['1:COMISION_VENTAS'],0);
});
test('web sales earn exactly one percent commission and close is idempotent',()=>{
 const first=CYCLE.close(input());assert.ok(first.receipt.sold>0);assert.equal(first.ledger['1:COMISION_VENTAS'],-Math.round(first.receipt.revenue)/100);
 const second=CYCLE.close(input(first.state,1,{ledger:first.ledger,sectionsByRound:first.financialSections}));assert.equal(second.reused,true);assert.deepEqual(second.receipt,first.receipt);assert.deepEqual(second.ledger,first.ledger);
});
test('unsold inventory carries forward and earlier receipt remains frozen',()=>{
 const s=state();s.__finishedGoods={esencial:5000};const first=CYCLE.close(input(s)),frozen=JSON.stringify(first.receipt);
 assert.ok(first.state.__finishedGoods.esencial>0);const second=CYCLE.close(input(state(2,first.state),2,{ledger:first.ledger,sectionsByRound:first.financialSections}));
 assert.equal(second.receipt.sales[0].available,first.state.__finishedGoods.esencial+second.receipt.sales[0].produced);assert.equal(JSON.stringify(second.state.__cycleSettlements[1]),frozen);
});
test('material inventory preserves unrelated lots and consumes only available purchased stock',()=>{
 const s=state();s.__inventarioMP={cuero_sint:10,hilo_std:100,unrelated:123};const result=CYCLE.close(input(s));
 assert.equal(result.state.__inventarioMP.unrelated,123);for(const material of result.receipt.production.materials)assert.ok(material.consumption<=material.available);
 assert.ok(result.receipt.production.materials.some(m=>m.consumption>0));
});
test('shared closing keeps company stock and cash isolated',()=>{
 const a=state(),b=state();b.CANALES.optionIds=[];b.__finishedGoods={esencial:15};const r=CYCLE.closeMany([{id:'A',...input(a)},{id:'B',...input(b)}]);
 assert.ok(r.A.receipt.sold>0);assert.equal(r.B.receipt.sold,0);assert.equal(r.B.state.__finishedGoods.esencial,r.B.receipt.produced+15);assert.equal(r.B.ledger['1:SIM_VENTAS'],0);
});
test('POS receipts never alter assigned demand or stock',()=>{
 const base=input(),baseline=CYCLE.close(base);const played=CYCLE.close({...base,soldByProduct:{esencial:99999},ledger:{'1:SIM_VENTAS':99999}});assert.deepEqual(played,baseline);
});
test('restoring a submitted plan preserves live material inventories and accounting seed',()=>{
 const live={CUERO:{round:3,quantities:{cuero_sint:999}},__inventarioMP:{cuero_sint:15},__openingBalance:{round:1,cash:500},__financialSnapshots:{1:{profit:100}}};
 const restored=CYCLE.restoreState({CUERO:{round:2,quantities:{cuero_sint:10}},__inventarioMP:{cuero_sint:1}},live);assert.equal(restored.CUERO.round,2);assert.deepEqual(restored.__inventarioMP,live.__inventarioMP);assert.deepEqual(restored.__openingBalance,live.__openingBalance);assert.deepEqual(restored.__financialSnapshots,live.__financialSnapshots);
});
test('commercial event changes demand before fulfillment, never money beyond stocked units',()=>{
 const normal=CYCLE.close(input()),event=CYCLE.close(input(state(),1,{events:[{id:'PE03',effect:{revenuePct:25}}]}));assert.equal(event.receipt.demandFactor,1.25);assert.ok(event.receipt.sales[0].demand>=normal.receipt.sales[0].demand);assert.equal(event.receipt.revenue,normal.receipt.revenue,'stock caps sales despite positive demand event');
 const empty=state();empty.HILO.quantities={};assert.equal(CYCLE.close(input(empty,1,{events:[{effect:{revenuePct:100}}]})).receipt.revenue,0);
});
