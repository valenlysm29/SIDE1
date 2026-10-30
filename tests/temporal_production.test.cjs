'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../js/temporal_production');
test('material recibido el día siete solo habilita capacidad posterior',()=>{
 const receipts=[['leather',30],['accessories',100],['thread',600]].map(([material,quantity])=>({id:material,day:7,material,quantity}));
 const r=P.calculate({receipts,targets:{basic:100},molds:{basic:true},dailyCapacity:3,days:30});
 assert.equal(r.produced.basic,69);assert.equal(r.windows.slice(0,7).reduce((s,x)=>s+x.produced,0),0);
 assert.equal(r.stock.thread,186);assert.equal(r.consumed.thread,414);
});
test('recepción posterior, molde ausente y días con inventario limitado',()=>{
 const r=P.calculate({opening:{leather:3,accessories:10,thread:60},receipts:[{id:'future',day:31,material:'thread',quantity:100}],targets:{basic:100,premium:10},molds:{basic:true,premium:false},dailyCapacity:10,days:30});
 assert.equal(r.produced.basic,10);assert.equal(r.produced.premium,0);assert.equal(r.pending.length,1);assert.equal(r.stock.thread,0);
});
