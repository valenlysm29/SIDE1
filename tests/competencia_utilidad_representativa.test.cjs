'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cycle_model.js'),F=require('./economic_v19_fixture.cjs');
function run(count,price){
 const inputs=[];
 for(let i=0;i<count;i++){
  const s=F.state();s.MOLDE={round:1,optionIds:['molde_1']};s.PRODUCCION_META={round:1,moldTargets:{molde_1:250}};
  for(const [id,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])s[id]={round:1,quantities:{[opt]:2},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:{[opt]:2}}}:{})};
  for(const [id,option,q] of [['CUERO','cuero_sint',75],['ACCESORIOS','acc_eco',250],['HILO','hilo_std',1500]])s[id]={round:1,quantities:{[option]:q}};
  s.JEFATURA={round:1,optionIds:['no_jefatura']};s.CANALES={round:1,optionIds:['web']};
  inputs.push({id:String(i),state:s,catalog:F.catalog,round:1,capital:50000,prices:{esencial:price},financialPolicy:{cycles:6,economicRulesVersion:'utility-v1'}});
 }
 return Object.values(C.closeMany(inputs));
}
test('presupuesto finito y competencia: mercado, stock y balances concilian',()=>{
 for(const count of [3,6,12]){
  const rows=run(count,120);let sales=0;
  for(const r of rows){
   const b=r.financial.balanceGeneral,e=r.financial.estadoResultados;
   assert.equal(b.activos,b.pasivoPatrimonio);assert.ok(r.receipt.sold<=r.receipt.produced);assert.ok(b.efectivo>=0);
   // Conservative pre-revenue budget: charge every negative ledger item first.
   const commitments=Object.values(r.ledger).reduce((sum,v)=>sum+Math.min(0,Number(v)||0),0);
   assert.ok(50000+commitments>=0,`capital insuficiente: ${commitments}`);
   assert.ok(e.utilidadNeta>0,`resultado ${count}: ${e.utilidadNeta}`);sales+=r.receipt.sold;
  }
  assert.ok(sales<=3500);
  const r=rows[0];console.log('COMPETENCIA_UTILIDAD '+JSON.stringify({empresas:count,producido:r.receipt.produced,vendido:r.receipt.sold,demanda:r.receipt.sales[0].demand,ventas:r.receipt.revenue,utilidad:r.financial.estadoResultados.utilidadNeta,caja:r.financial.balanceGeneral.efectivo,compromisos:Object.values(r.ledger).reduce((s,v)=>s+Math.min(0,Number(v)||0),0)}));
 }
});
test('elevar todos los precios reduce demanda efectiva con los mismos competidores',()=>{
 const low=run(12,120),high=run(12,240),sum=rows=>rows.reduce((s,r)=>s+r.receipt.sales[0].demand,0);
 assert.ok(sum(high)<sum(low));assert.ok(high.every(r=>r.receipt.sold<=r.receipt.sales[0].demand));
});
