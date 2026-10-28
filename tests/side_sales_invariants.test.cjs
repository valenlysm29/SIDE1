'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/engine/cierre.js'), config=require('../js/engine/config.js');
const noSynthetic={...config,simulatedCompetitors:{enabled:false,target:0}};
function run(stock,market=3500){
 const cfg={...noSynthetic,segments:{...config.segments,esencial:{...config.segments.esencial,totalMarket:market,penetration:1}}};
 return C.settleMarketCompanies([{id:'empresa',precio:40,reputacion:5,calidad:0,producido:0,stock}],'esencial',cfg)[0];
}
test('venta limitada por stock genera ingreso por unidades efectivas',()=>{
 const r=run(12,100);assert.equal(r.demanda,100);assert.equal(r.vendidas,12);assert.equal(r.ingresos,480);
});
test('sin demanda no se vende inventario ni se reconoce ingreso',()=>{
 const r=run(12,0);assert.equal(r.demanda,0);assert.equal(r.vendidas,0);assert.equal(r.ingresos,0);
});
test('sin stock no existe venta aunque exista mercado',()=>{
 const r=run(0,100);assert.equal(r.vendidas,0);assert.equal(r.ingresos,0);
});
