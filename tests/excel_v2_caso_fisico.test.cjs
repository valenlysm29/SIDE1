'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../js/production_model.js');
const {catalog} = require('./economic_v19_fixture.cjs');

function fixture(thread = 2900, returnDrafts = false) {
  const drafts = {
    MESA_CORTE:{quantities:{mesa:2}}, ENSAMBLE:{quantities:{ens_basica:2}}, ACABADOS:{quantities:{aca_basica:3}},
    PERS_CORTE:{quantities:{corte_basico:1,corte_exp:1}}, PERS_ENSAMBLE:{quantities:{ens_personal_basico:1,ens_personal_esp:1}},
    PERS_ACABADO:{quantities:{aca_personal_basico:3}}, JEFATURA:{optionIds:['no_jefatura']},
    MOLDE:{optionIds:['molde_1','molde_2','molde_3']}, PRODUCCION_META:{moldTargets:{molde_1:150,molde_2:140,molde_3:95}},
    CUERO:{quantities:{cuero_sint:60,cuero_std:110,cuero_prem:30}}, ACCESORIOS:{quantities:{acc_eco:200,acc_prem:190}},
    HILO:{quantities:{hilo_ref:Math.min(thread,1500),hilo_prem:Math.max(0,thread-1500)}}
  };
  return returnDrafts ? drafts : model.calculate({catalog, state:{}, drafts, round:1});
}

test('caso V2: capacidad, producción y saldo físico por familia',()=>{
  const p=fixture();
  assert.equal(p.processCapacity,382);
  assert.deepEqual(p.productLines.map(x=>x.target),[150,140,95]);
  assert.deepEqual(p.productLines.map(x=>x.plannedUnits),[150,140,78]);
  const totals=Object.fromEntries(p.materials.map(x=>[x.id,x]));
  for (const [key, consumed, remaining] of [['CUERO',155.6,44.4],['ACCESORIOS',368,22],['HILO',2894,6]]) {
    assert.ok(Math.abs(totals[key].consumption-consumed)<1e-9);
    assert.ok(Math.abs(totals[key].available-totals[key].consumption-remaining)<1e-9);
  }
  assert.equal(totals.HILO.neededForTarget,3115);
});

test('cierre V2: consumo por SKU concilia inventario, lotes y valoración',()=>{
  const cycle = require('../js/cycle_model.js');
  const state=fixture(2900,true);
  for (const decision of Object.values(state)) decision.round=1;
  state.CANALES={round:1,optionIds:['web']};
  const result=cycle.close({state,catalog,round:1,capital:200000});
  const receipt=result.receipt, financial=result.financial;
  assert.equal(receipt.produced,368);
  assert.deepEqual(receipt.production.productLines.map(line=>line.plannedUnits),[150,140,78]);
  const expected={cuero_sint:0,cuero_std:14.4,cuero_prem:30,acc_eco:0,acc_prem:22,hilo_std:0,hilo_ref:0,hilo_prem:6};
  for(const [sku,quantity] of Object.entries(expected)) assert.ok(Math.abs(receipt.inventory[sku]-quantity)<1e-8,sku);
  const used={};
  for(const lot of receipt.materialLots) for(const family of Object.values(lot.materials)) for(const [sku,quantity] of Object.entries(family)) used[sku]=(used[sku]||0)+quantity;
  for(const family of ['CUERO','ACCESORIOS','HILO']) for(const [sku,received] of Object.entries(state[family].quantities)) assert.ok(Math.abs(received-(used[sku]||0)-receipt.inventory[sku])<1e-8,sku);
  for(const [sku,value] of Object.entries({cuero_std:596.16,cuero_prem:2400,acc_prem:182.16,hilo_prem:38.64})) assert.ok(Math.abs(financial.inventoryValues.materials[sku]-value)<.01,sku);
  assert.equal(financial.estadoResultados.desgloseCostos.materiales,22082.24);
  assert.equal(financial.estadoResultados.costoVentas,financial.estadoResultados.costosProduccion);
  assert.equal(financial.balanceGeneral.activos,financial.balanceGeneral.pasivoPatrimonio);
  assert.deepEqual(cycle.close({state:result.state,ledger:result.ledger,catalog,round:1,capital:200000,sectionsByRound:result.financialSections}).receipt,receipt);
});

test('la prioridad de fabricación mantiene metas y no consume hilo inexistente',()=>{
  for (const [stock, expected] of [[0,[0,0,0]],[900,[150,0,0]],[1880,[150,140,0]],[2900,[150,140,78]]]) {
    const p=fixture(stock), thread=p.materials.find(x=>x.id==='HILO');
    assert.deepEqual(p.productLines.map(x=>x.target),[150,140,95]);
    assert.deepEqual(p.productLines.map(x=>x.plannedUnits),expected);
    assert.ok(thread.consumption<=stock);
  }
});
