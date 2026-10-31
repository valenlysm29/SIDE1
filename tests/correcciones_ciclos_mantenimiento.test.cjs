'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../js/financial_model'),B=require('../js/business_rules'),C=require('../js/cycle_model'),catalog=require('../js/decision_catalog');
const items=[{items:[{id:'ENSAMBLE',asset:true,options:[{id:'machine',cost:1200}]}]}];
test('depreciación de cada adquisición se distribuye entre los ciclos restantes',()=>{
 for(const cycles of [3,6]){
  const settlements={},sections={},ledger={};
  for(let r=1;r<=cycles;r++){
   const purchases={1:{machine:1},...(r>=2?{2:{machine:1}}:{})};
   settlements[r]={round:r,modelVersion:'md-20261027',regimen:'MYPE',decisions:{ENSAMBLE:{purchases}},inventory:{},sales:[],financialPolicy:{cycles}};
   if(r<=2){ledger[`${r}:B`]=-1200;sections[r]={B:{recordedNet:-1200,items:[{id:'ENSAMBLE',outflow:1200}]}};}
  }
  const result=F.calculate({capital:10000,catalog:items,round:cycles,ledger,sectionsByRound:sections,state:{__cycleSettlements:settlements},financialPolicy:{cycles}});
  assert.equal(result.history[0].estadoResultados.depreciacion,Math.round(1140/cycles*100)/100);
  assert.equal(result.history[1].estadoResultados.depreciacion,Math.round((1140/cycles+1140/(cycles-1))*100)/100);
  assert.ok(Math.abs(result.balanceGeneral.activosFijos-120)<0.05);
 }
});
test('mantenimiento por modalidad, ciclo y presencia de maquinaria',()=>{
 const state={ENSAMBLE:{purchases:{1:{ens_basica:1}}}};
 assert.equal(B.maintenance({},catalog,1),0);
 assert.equal(B.maintenance(state,catalog,1),1000);
 for(const [mode,cost] of [['correctivo',1000],['preventivo_basico',1500],['preventivo_integral',3000]])assert.equal(B.maintenance({...state,MANTENIMIENTO:{round:2,optionIds:[mode]}},catalog,2),cost);
 assert.throws(()=>B.maintenance({...state,MANTENIMIENTO:{round:1,optionIds:['preventivo_basico']}},catalog,1));
 assert.throws(()=>B.maintenance({...state,MANTENIMIENTO:{round:2,optionIds:['correctivo','preventivo_basico']}},catalog,2));
});
test('cierre registra mantenimiento una sola vez y reutiliza el cierre',()=>{
 const state={ENSAMBLE:{round:1,purchases:{1:{ens_basica:1}}}};
 const first=C.close({state,catalog,round:1,capital:100000,financialPolicy:{cycles:3}});
 const section=first.financialSections[1]?.B?.items.find(x=>x.id==='MANTENIMIENTO');
 assert.equal((section?.outflow||0)-first.ledger['1:MANTENIMIENTO_AUTO'],1000);
 const second=C.close({state:first.state,ledger:first.ledger,sectionsByRound:first.financialSections,catalog,round:1,capital:100000,financialPolicy:{cycles:3}});
 assert.equal(second.reused,true);assert.equal(second.receipt.maintenanceCost,1000);
});
