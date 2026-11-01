'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cycle_model.js'),E=require('../js/engine/cierre.js'),F=require('./economic_v19_fixture.cjs');
function companies(type,quantity,count){
 return Array.from({length:count},(_,i)=>{
  const state=F.state(1,{},type),machines=Math.max(1,Math.ceil(quantity/160));state.MOLDE={round:1,optionIds:[`molde_${type+1}`]};state.PRODUCCION_META={round:1,moldTargets:{[`molde_${type+1}`]:quantity},prices:{esencial:1,urbano:1,premium:1}};
  for(const [id,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[id]={round:1,quantities:{[opt]:machines},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:{[opt]:machines}}}:{})};
  const recipe=[[.3,6],[.4,7],[.7,13]][type];for(const [id,opt,q] of [['CUERO','cuero_sint',recipe[0]*quantity],['ACCESORIOS','acc_eco',quantity],['HILO','hilo_std',recipe[1]*quantity]])state[id]={round:1,quantities:{[opt]:q}};
  state.JEFATURA={round:1,optionIds:['no_jefatura']};state.CANALES={round:1,optionIds:['web']};
  return {id:String(i),state,catalog:F.catalog,round:1,capital:50000,financialPolicy:{cycles:6,economicRulesVersion:'utility-v1',authoritativePrices:true}};
 });
}
test('precios internos versionados ignoran valores guardados y conservan precios anteriores',()=>{
 const input=companies(0,250,3)[0],current=E.prepare(input),old=E.prepare({...input,financialPolicy:{authoritativePrices:true}});
 assert.deepEqual(current.lines.map(x=>x.price),[120,150,280]);assert.deepEqual(old.lines.map(x=>x.price),[42.5,100,250]);
 assert.deepEqual(E.prepare({...input,financialPolicy:{...input.financialPolicy,utilityPrices:{esencial:125}}}).lines.map(x=>x.price),[125,150,280]);
});
test('candidatos generan resultados positivos con doce competidores y presupuesto finito',()=>{
 for(const [type,qty] of [[0,250],[1,250],[2,50]]){
  const rows=Object.values(C.closeMany(companies(type,qty,12))),r=rows[0],cost=Object.values(r.ledger).reduce((sum,v)=>sum+Math.min(0,Number(v)||0),0);
  console.log('PRECIO_UTILIDAD '+JSON.stringify({segment:type,price:r.receipt.sales[type].price,sold:r.receipt.sold,profit:r.financial.estadoResultados.utilidadNeta,cash:r.financial.balanceGeneral.efectivo,commitments:cost}));
  assert.ok(r.financial.estadoResultados.utilidadNeta>0);assert.ok(50000+cost>=0);assert.ok(r.financial.balanceGeneral.efectivo>=0);
  assert.ok(rows.reduce((s,row)=>s+row.receipt.sold,0)<=E.config.segments[E.config.products[type]].totalMarket);
 }
});
