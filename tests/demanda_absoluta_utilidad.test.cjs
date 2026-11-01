'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../js/engine/cierre.js'),F=require('./economic_v19_fixture.cjs');
function market(prices,version='utility-v1'){
 const inputs=prices.map((price,i)=>{const state=F.state();state.PRODUCCION_META.moldTargets={molde_1:90};return {id:String(i),state,catalog:F.catalog,round:1,prices:{esencial:price},financialPolicy:version?{economicRulesVersion:version}: {}};});
 return Object.values(E.closeMany(inputs)).map(r=>r.allocation.products.esencial);
}
test('si todos elevan el precio, cae la demanda; la versión anterior se conserva',()=>{
 const low=market([95,95,95]),high=market([190,190,190]);
 assert.ok(high.reduce((s,r)=>s+r.demandaAjustada,0)<low.reduce((s,r)=>s+r.demandaAjustada,0));
 assert.ok(high.every(r=>r.demandaAjustada<=r.asignado&&r.factorPrecioAbsoluto<1));
 const old=market([95,95,95],null),oldHigh=market([190,190,190],null);
 assert.deepEqual(old.map(r=>r.demandaAjustada),oldHigh.map(r=>r.demandaAjustada));
});
test('la competencia conserva el reparto relativo y la demanda está acotada',()=>{
 const rows=market([95,140,190]);assert.ok(rows[0].asignado>rows[2].asignado);
 assert.equal(rows.reduce((s,r)=>s+r.asignado,0),3500);
 assert.ok(rows.reduce((s,r)=>s+r.demandaAjustada,0)<=3500);
});
test('parámetros explícitos inválidos no se aceptan',()=>{
 const s=F.state();assert.throws(()=>E.closeMany([{id:'a',state:s,catalog:F.catalog,round:1,financialPolicy:{economicRulesVersion:'utility-v1',utilityDemand:{esencial:{reference:0}}}}]),/Parámetros de demanda inválidos/);
});
