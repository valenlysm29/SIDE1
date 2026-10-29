'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../js/engine/cierre.js');
test('Costos E118: calidad comercial es proporción de reputación, no calidad de lote',()=>{
 const prices=[40,42,43,45],reps=[7,8,9,6],qualities=[8,7,9,6];
 const prepared=prices.map((price,i)=>({id:String(i),scores:{reputation:reps[i]},demandFactor:1,lines:[{id:'esencial',price,quality:qualities[i],available:1000}]}));
 const a=E.allocate(prepared);assert.equal(a['0'].products.esencial.calidadMercado,23);
 assert.equal(a['0'].products.esencial.puntajeTotal,86.3);
 prepared[0].lines[0].quality=1;assert.equal(E.allocate(prepared)['0'].products.esencial.puntajeTotal,86.3);
});
