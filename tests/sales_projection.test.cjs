'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),CYCLE=require('../js/cycle_model.js');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),scope);
const catalog=JSON.parse(JSON.stringify(scope.window.SIDE_DECISION_CATALOG));
function input(target=100){
  const state={};
  const counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1},ACABADOS:{aca_basica:1},
    PERS_CORTE:{corte_basico:100},PERS_ENSAMBLE:{ens_personal_basico:100},PERS_ACABADO:{aca_personal_basico:100},
    CUERO:{cuero_sint:target*.3},ACCESORIOS:{acc_eco:target},HILO:{hilo_std:target*6}};
  for(const [id,quantities]of Object.entries(counts))state[id]={round:1,quantities,...(catalog.flatMap(c=>c.items).find(i=>i.id===id).asset?{purchases:{1:quantities}}:{})};
  state.MOLDE={round:1,optionIds:['molde_1']};state.CANALES={round:1,optionIds:['web']};
  state.PRODUCCION_META={round:1,value:target,moldTargets:{molde_1:target}};
  return {state,ledger:{},catalog,round:1,capital:2000000,sectionsByRound:{}};
}
test('a live projection computes physical sales and price times units without settling or mutating input',()=>{
  const ctx=input(),original=JSON.stringify(ctx),p=CYCLE.project(ctx);
  assert.equal(p.provisional,true);assert.equal(p.marketScope,'individual');
  assert.equal(p.receipt.produced,100);assert.equal(p.receipt.sold,100);assert.equal(p.receipt.revenue,4250);
  assert.equal(p.financial.estadoResultados.ingresos,4250);
  assert.equal(p.state,undefined);assert.equal(p.ledger,undefined);
  assert.equal(JSON.stringify(ctx),original);
  assert.deepEqual(CYCLE.project(ctx),p);assert.equal(JSON.stringify(ctx),original);
});
test('the projection honors inputs and channels instead of manufacturing sales',()=>{
  const missing=input();missing.state.HILO.quantities.hilo_std=3;
  assert.equal(CYCLE.project(missing).receipt.sold,0);
  const noChannel=input();noChannel.state.CANALES.optionIds=[];
  assert.equal(CYCLE.project(noChannel).receipt.revenue,0);
});
test('the final shared market replaces the individual reference and cannot sell stock twice',()=>{
  const a={id:'A',...input(5000)},b={id:'B',...input(5000)};
  assert.equal(CYCLE.project(a).receipt.sold,3500);
  const closed=CYCLE.closeMany([a,b]);
  assert.equal(closed.A.receipt.sold,1750);assert.equal(closed.B.receipt.sold,1750);
  assert.equal(closed.A.receipt.revenue+closed.B.receipt.revenue,3500*42.5);
  assert.equal(CYCLE.project({...a,state:closed.A.state,ledger:closed.A.ledger}),null);
  const again=CYCLE.close({...a,state:closed.A.state,ledger:closed.A.ledger});
  assert.equal(again.reused,true);assert.equal(again.receipt.revenue,closed.A.receipt.revenue);
});
