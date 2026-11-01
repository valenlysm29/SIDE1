'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cycle_model.js'),F=require('./economic_v19_fixture.cjs');
function run(mode,cycles){
 let previous=null;const rows=[];
 for(let round=1;round<=cycles;round++){
  const state=F.state(round,previous?.state||{},2),count=round===1&&mode!=='ganancia'?4:1;
  for(const [id,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica']])state[id]={round,purchases:round===1?{1:{[opt]:count}}:previous.state[id].purchases};
  for(const [id,opt] of [['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[id]={round,quantities:{[opt]:mode==='sin_recuperacion'?4:count}};
  for(const [id,opt,q] of [['CUERO','cuero_prem',63],['ACCESORIOS','acc_prem',90],['HILO','hilo_prem',1170]])state[id]={round,quantities:{[opt]:q}};
  state.CANALES={round,optionIds:mode==='sin_recuperacion'||(mode==='recupera'&&round===1)?[]:['web']};
  const result=C.close({state,catalog:F.catalog,round,capital:200000,ledger:previous?.ledger||{},sectionsByRound:previous?.financialSections||{},financialPolicy:{cycles,economicRulesVersion:'utility-v1'}}),b=result.financial.balanceGeneral,e=result.financial.estadoResultados;
  assert.equal(b.activos,b.pasivoPatrimonio);assert.equal(result.receipt.round,round);
  rows.push({round,net:e.utilidadNeta,cash:b.efectivo,inventoryMP:b.inventarioMP,inventoryPT:b.inventarioPT,assets:b.activosFijos,debt:b.deuda,tax:e.impuestoRenta,sold:result.receipt.sold});previous=result;
 }
 return rows;
}
test('seis ciclos conservan balances con pérdida inicial y recuperación, y con pérdida persistente',()=>{
 const recovery=run('recupera',6),failure=run('sin_recuperacion',6),profit=run('ganancia',6);
 assert.ok(recovery[0].net<0);assert.ok(recovery.slice(1).some(r=>r.net>0));assert.ok(recovery.reduce((s,r)=>s+r.net,0)>0);
 assert.ok(recovery.slice(0,3).reduce((s,r)=>s+r.net,0)>0);
 assert.ok(failure.every(r=>r.net<0));assert.ok(profit.every(r=>r.net>0));
 assert.ok(recovery.every(r=>r.cash>=0));assert.ok(profit.every(r=>r.cash>=0));
 assert.ok(recovery[0].inventoryPT>0);assert.ok(recovery[0].assets>0);
 console.log('RECUPERACION_UTILIDAD '+JSON.stringify({recovery,failure,profit}));
});
test('tres ciclos aplican impuesto final y permiten recuperar pérdida inicial',()=>{
 const rows=run('recupera',3);assert.ok(rows[0].net<0);assert.ok(rows.reduce((s,r)=>s+r.net,0)>0);assert.ok(rows[2].tax>0);assert.ok(rows.every(r=>r.cash>=0));
});
