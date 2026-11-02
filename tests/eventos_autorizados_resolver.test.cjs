'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const catalog=require('../js/events_catalog.js'),resolver=require('../js/engine/eventos_autorizados.js');
test('los 92 eventos conservan sus efectos, ámbito y duración originales',()=>{
 assert.equal(catalog.length,92);
 for(const event of catalog){
  const input={round:1+event.cycleOffset,enabledEvents:[event.id],groupByCycle:{},individualByCycle:{}};
  input[event.scope==='group'?'groupByCycle':'individualByCycle']={1:[event.id]};
  const before=JSON.stringify(input),events=resolver.resolve(input);
  assert.equal(events.length,1,event.id);assert.deepEqual(events[0].effect,event.effect,event.id);
  assert.equal(events[0].probability,event.probability);assert.equal(events[0].scope,event.scope);assert.equal(events[0].cycles,event.cycles);
  assert.equal(JSON.stringify(input),before);
 }
});
test('mezcla ocurrencias verificables y conserva repeticiones de ciclos distintos',()=>{
 const out=resolver.resolve({round:2,enabledEvents:['PE01','PE02'],groupByCycle:{1:['PE01','PE02'],2:['PE01']},individualByCycle:{}});
 assert.deepEqual(out.map(e=>e.id),['PE01','PE02']);
 const repeats=resolver.resolve({round:3,enabledEvents:['PE91'],individualByCycle:{1:['PE91'],2:['PE91']}});
 assert.deepEqual(repeats.map(e=>e.triggerRound),[1,2]);
});
test('rechaza identificadores, ámbitos, ciclos y duplicados inconsistentes',()=>{
 const base={round:1,enabledEvents:['PE01'],groupByCycle:{1:['PE01']},individualByCycle:{}};
 assert.throws(()=>resolver.resolve({...base,groupByCycle:{1:['PE01','PE01']}}));
 assert.throws(()=>resolver.resolve({...base,groupByCycle:{1:['PE99']}}));
 assert.throws(()=>resolver.resolve({...base,groupByCycle:{},individualByCycle:{1:['PE01']}}));
 assert.throws(()=>resolver.resolve({...base,groupByCycle:{2:['PE01']}}));
});
test('agrupa multiplicadores y movimientos usando únicamente el catálogo original',()=>{
 const events=resolver.resolve({round:1,enabledEvents:['PE07','PE15','PE23'],groupByCycle:{1:['PE07','PE15']},individualByCycle:{1:['PE23']}});
 const spoofed=events.map(e=>({...e,effect:{cashDelta:999999}})),actual=resolver.summarize(spoofed,1);
 assert.equal(actual.demandFactor,1.12);assert.equal(actual.costFactor,1.2);assert.deepEqual(actual.cashMovements,[{id:'PE23',triggerRound:1,amount:-500}]);
 assert.throws(()=>resolver.summarize([...events,events[0]],1));
});
