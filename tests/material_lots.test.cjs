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
test('mezcla sin distribución registrada se marca como desconocida sin inventar lote',()=>{
 const state=F.state(1,{},3);state.CUERO.quantities={cuero_sint:30,cuero_prem:250};
 const plan=PRO.calculate({state,catalog:F.catalog,round:1}),lots=E.materialLots(state,plan,1);assert.equal(lots.length,3);
 for(const lot of lots){assert.ok(lot.unknown.includes('CUERO'));assert.equal(lot.materials.CUERO,undefined);assert.ok(lot.materials.HILO);}
});
