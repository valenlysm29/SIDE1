'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/engine/cierre.js');
const P=require('../js/production_model.js');
const F=require('./economic_v19_fixture.cjs');
const C=require('../js/cycle_model.js');

// Caracterización de la versión anterior: esta prueba documenta la discrepancia,
// no expresa el comportamiento deseado de una versión económica corregida.
test('la capacidad reconoce compras que el puntaje actual omite',()=>{
  const state=F.state();
  state.ENSAMBLE={round:1,purchases:{1:{ens_ind:1}}};
  state.ACABADOS={round:1,purchases:{1:{aca_ind:1}}};
  const plan=P.calculate({state,catalog:F.catalog,round:1});
  const score=E.scores(state);
  assert.equal(plan.processes.find(p=>p.id==='assembly').machines,1);
  assert.equal(plan.processes.find(p=>p.id==='finish').machines,1);
  assert.equal(plan.processes.find(p=>p.id==='assembly').pairs,1);
  assert.equal(plan.processes.find(p=>p.id==='finish').pairs,1);
  assert.ok(!score.selected.includes('INF-04'));
  assert.ok(!score.selected.includes('INF-07'));
});

test('referencia de rentabilidad con 90 unidades y recursos distintos',()=>{
  const cases=[['basico',0,1,-14218.94],['premium',2,1,6472.51],['premium_cuatro',2,4,-9012.81]];
  for(const [name,type,count,expected] of cases){
    const state=F.state(1,{},type);
    for(const [id,option] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']]){
      state[id]={round:1,quantities:{[option]:count},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:{[option]:count}}}:{})};
    }
    const result=C.close({state,catalog:F.catalog,round:1,capital:200000,financialPolicy:{cycles:6}});
    assert.equal(result.receipt.produced,90,name);
    assert.equal(result.receipt.sold,90,name);
    assert.equal(result.financial.estadoResultados.utilidadNeta,Math.round((expected+79.16)*100)/100,name); // molds: 5-year charge 79.16 removed; same cash and decisions
  }
});
