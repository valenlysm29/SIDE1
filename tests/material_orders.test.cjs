'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../js/material_orders');
const order={id:'o1',type:'order',orderId:'A',companyId:'c',sku:'hilo_std',unit:'m',quantity:100,unitCost:2,orderedDay:0,leadTimeDays:7};
const receipt={id:'r1',type:'receipt',orderId:'A',companyId:'c',quantity:40,day:7};
test('pedido, recepción parcial, repetición y cancelación conservan unidades',()=>{
 const initial=L.apply({},order);assert.equal(initial.stock.hilo_std,undefined);assert.equal(initial.orders.A.expectedDay,7);
 const received=L.apply(initial,receipt);assert.equal(received.stock.hilo_std,40);assert.deepEqual(L.apply(received,receipt),received);
 const cancelled=L.apply(received,{id:'x1',type:'cancel',orderId:'A',companyId:'c',quantity:60});
 assert.equal(cancelled.orders.A.received,40);assert.equal(cancelled.orders.A.cancelled,60);assert.equal(cancelled.stock.hilo_std,40);
 assert.equal(initial.orders.A.received,0);
});
test('evita sobre recepciones, empresas ajenas e identificadores alterados',()=>{
 const state=L.apply(L.apply({},order),receipt);
 assert.throws(()=>L.apply(state,{...receipt,quantity:41}),/reutilizado/);
 assert.throws(()=>L.apply(state,{...receipt,id:'r2',quantity:61}),/pendiente/);
 assert.throws(()=>L.apply(state,{...receipt,id:'r3',companyId:'other'}),/Empresa/);
 assert.throws(()=>L.apply(state,{...receipt,id:'r4',day:-1}),/Fecha/);
});
