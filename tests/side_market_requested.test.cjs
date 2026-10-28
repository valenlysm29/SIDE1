const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../js/engine/cierre.js');

test('reparto económico según ejemplo y stock real',()=>{
 const companies=[40,45,43,41].map((precio,i)=>({id:String(i),precio,reputacion:[7,8.3,10.2,9][i],calidad:0,producido:4000,stock:4000}));
 const rows=market.settleMarketCompanies(companies,'esencial');
 assert.deepEqual(rows.map(r=>r.demanda),[1292,285,772,1151]);
 assert.equal(rows.reduce((s,r)=>s+r.vendidas,0),3500);
 companies[0].stock=0;assert.equal(market.settleMarketCompanies(companies,'esencial')[0].vendidas,0);
});
test('precios iguales y precio superior al doble del ideal',()=>{
 const base=[{id:'a',precio:40,reputacion:5,stock:5000},{id:'b',precio:40,reputacion:5,stock:5000}];
 assert.deepEqual(market.settleMarketCompanies(base,'esencial').map(r=>r.precioScore),[100,100]);
 assert.equal(market.settleMarketCompanies([{...base[0],precio:250}],'urbano')[0].precioScore,0);
 assert.equal(market.settleMarketCompanies([base[0]],'esencial')[0].demanda,3500);
});
