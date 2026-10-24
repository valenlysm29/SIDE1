'use strict';
// Independent integration scenarios: real catalog + public closure adapter.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),CYCLE=require('../js/cycle_model.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG)),copy=v=>JSON.parse(JSON.stringify(v));
const products=['esencial','urbano','premium'],molds=['molde_1','molde_2','molde_3'];
function decisions(round,index,old={},scenario=1){
 const state=copy(old),counts={MESA_CORTE:{mesa:2},ENSAMBLE:{ens_ind:2},ACABADOS:{aca_ind:2},PERS_CORTE:{corte_maestro:4},PERS_ENSAMBLE:{ens_personal_esp:4},PERS_ACABADO:{aca_personal_art:4},CUERO:{cuero_prem:600},ACCESORIOS:{acc_prem:1200},HILO:{hilo_prem:12000}};
 if(scenario===2&&index===2){counts.CUERO={cuero_sint:600};counts.ACCESORIOS={acc_eco:1200};counts.HILO={hilo_std:12000};}
 for(const [key,quantities] of Object.entries(counts))state[key]={round,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(key)?{purchases:state[key]?.purchases||{1:quantities}}:{})};
 state.MOLDE={round:1,optionIds:index===3?molds:[molds[index]]};
 state.JEFATURA={round,optionIds:['si_jefatura']};state.CANALES={round,optionIds:['web']};
 const prices=scenario===2?{esencial:42.5,urbano:160,premium:250}:{esencial:40+index,urbano:120+index*20,premium:220+index*30};
 state.PRODUCCION_META={round,moldTargets:Object.fromEntries(molds.map((m,i)=>[m,index===3||index===i?100:0])),value:index===3?300:100,prices};
 if(scenario===2&&round===1&&[0,3].includes(index))state.__finishedGoods={esencial:7000};
 if(scenario===3){if(index===0)state.CUERO.quantities={};if(index===1)state.PERS_CORTE.quantities={};if(index===2)state.MOLDE.optionIds=[];}
 return state;
}
const report=[];
for(const scenario of [1,2,3]){
 let companies=Array.from({length:4},(_,i)=>({id:String(i),state:{},ledger:{},capital:10000000,sectionsByRound:{}}));
 for(let round=1;round<=3;round++){
  const inputs=companies.map((company,i)=>({...company,state:decisions(round,i,company.state,scenario),catalog,round,financialPolicy:{interest:20,creditPercentStart:20}}));
  const before=JSON.stringify(inputs),results=CYCLE.closeMany(inputs);
  assert.equal(JSON.stringify(inputs),before,'closure never mutates caller state');
  assert.deepEqual(CYCLE.closeMany(inputs),results,'same inputs produce identical output');
  for(const [i,input] of inputs.entries()){
   const result=results[input.id],receipt=result.receipt,previousReceivable=Number(input.state.__accountsReceivable||0);
   assert.equal(receipt.creditCollections,previousReceivable,'credit from previous cycle is collected once');
   assert.equal(result.state.__accountsReceivable,receipt.accountsReceivable);
   assert.ok(Number.isFinite(result.financial.balanceCaja.cajaFinal));
   for(const sale of receipt.sales){
    assert.ok(sale.sold<=sale.available&&sale.sold<=sale.demand);
    assert.equal(sale.revenue,Math.round(sale.sold*sale.price*100)/100);
    if(sale.produced>0&&sale.available>0)assert.ok(sale.sold>0,`SIM-${scenario}/${round}/${i}/${sale.id}: positive physical stock/production must sell`);
    if(!sale.sold)assert.ok(sale.reason,'zero sales always has an explicit reason');
   }
   if(scenario===3&&i<3){assert.equal(receipt.produced,0);assert.equal(receipt.sold,0);assert.equal(receipt.revenue,0);}
   else assert.ok(receipt.revenue>0,`SIM-${scenario}/${round}/${i}`);
   if(scenario===2&&i===2)assert.equal(receipt.sales.find(s=>s.id==='premium').quality,7,'Premium mold + the cheapest physical materials already reaches quality 7');
   if(scenario===2&&i===0)assert.ok(result.state.__finishedGoods.esencial>0,'unserved inventory carries to the next cycle');
   const repeated=CYCLE.close({...input,state:result.state,ledger:result.ledger});
   assert.equal(repeated.reused,true);assert.deepEqual(repeated.ledger,result.ledger);assert.equal(repeated.receipt.revenue,receipt.revenue);
   report.push({simulation:`SIM-${scenario}`,round,company:i,produced:receipt.produced,sold:receipt.sold,revenue:receipt.revenue,credit:receipt.accountsReceivable,collected:receipt.creditCollections,cash:result.financial.balanceCaja.cajaFinal,goods:result.state.__finishedGoods,reasons:receipt.sales.filter(s=>!s.sold).map(s=>s.reason)});
  }
  companies=inputs.map(input=>({...input,state:copy(results[input.id].state),ledger:copy(results[input.id].ledger)}));
 }
}
const output=path.join(root,'tests/output/simulaciones_v19.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
// Conceptual lots are a separate oracle entry point. The current UI couples
// Premium to mold_3 (4 quality points), so physical minimum quality is 7.
const ECON=require('../js/engine/cierre.js');
const lowQuality=ECON.settleMarketCompanies([{id:'A',precio:250,reputacion:5,calidad:6,producido:10,stock:10}], 'premium')[0];
assert.equal(lowQuality.precioEfectivo,162.5);assert.equal(lowQuality.reputacionFinal,3);
const reputationRow={id:'A',precio:42.5,reputacion:1,calidad:5,producido:10000,stock:10000};
assert.equal(ECON.settleMarketCompanies([{...reputationRow,bajaPrevios:0}],'esencial')[0].demanda,3500);
assert.equal(ECON.settleMarketCompanies([{...reputationRow,bajaPrevios:1}],'esencial')[0].demanda,2800);
const unserved=ECON.settleMarketCompanies([{...reputationRow,id:'A',stock:0},{...reputationRow,id:'B'}],'esencial');
assert.equal(unserved[0].vendidas,0);assert.equal(unserved[1].vendidas,1750,'unserved demand is lost, never reassigned');
console.log('PASS SIM-1/2/3: 3 cycles × 4 companies, physical production, mixed segments, prices/ties, limited stock, carryover, credit collection, missing materials/workers/mold, determinism and duplicate closure.');
console.log('PASS conceptual oracle: CONS-01, two-cycle CONS-04 and unserved demand. CONS-01 is not reachable through the current UI physical Premium minimum (quality 7).');
console.log('Evidence:',output);
