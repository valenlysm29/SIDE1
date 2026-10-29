'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./economic_v19_fixture.cjs'),PRO=require('../js/production_model'),E=require('../js/engine/cierre'),C=require('../js/cycle_model');
test('trazabilidad inequívoca reconcilia producción, consumo e inventario',()=>{
 const state=F.state(1,{},3),result=C.close({state,catalog:F.catalog,round:1,capital:200000});const lots=result.receipt.materialLots;
 assert.equal(lots.length,3);for(const lot of lots)assert.deepEqual(lot.unknown,[]);
 for(const [family,id] of [['CUERO','cuero_prem'],['ACCESORIOS','acc_prem'],['HILO','hilo_prem']]){
  const used=lots.reduce((n,l)=>n+l.materials[family][id],0),p=result.receipt.production.materials.find(x=>x.id===family);
  assert.ok(Math.abs(used-p.consumption)<1e-8);assert.ok(Math.abs(state[family].quantities[id]-result.receipt.inventory[id]-used)<1e-8);
 }
});
test('mezcla asignada según consumo real, con calidad ponderada e inventario conciliado',()=>{
 const state=F.state(1,{},3);state.CUERO.quantities={cuero_sint:30,cuero_prem:250};
 const result=C.close({state,catalog:F.catalog,round:1,capital:200000}),lots=result.receipt.materialLots;
 assert.deepEqual(lots.map(l=>l.mold),['molde_1','molde_2','molde_3']);
 assert.equal(lots[0].materials.CUERO.cuero_sint,9);assert.equal(lots[1].materials.CUERO.cuero_sint,12);
 assert.equal(lots[2].materials.CUERO.cuero_sint,9);assert.equal(lots[2].materials.CUERO.cuero_prem,12);
 assert.ok(Math.abs(lots[2].excelQuality-(4+2+3+(9+36)/21))<1e-10);
 for(const [family,id] of [['CUERO','cuero_sint'],['CUERO','cuero_prem'],['ACCESORIOS','acc_prem'],['HILO','hilo_prem']]){
  const used=lots.reduce((sum,l)=>sum+(l.materials[family][id]||0),0);assert.ok(Math.abs(state[family].quantities[id]-result.receipt.inventory[id]-used)<1e-8);
 }
 assert.equal(result.receipt.sales[2].quality,lots[2].excelQuality);
});
