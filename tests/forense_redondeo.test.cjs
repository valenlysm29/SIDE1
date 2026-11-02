'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cycle_model'),F=require('../js/financial_model'),{catalog}=require('./economic_v19_fixture.cjs');
const initial=require('./output/forense_utilidad/cierres_reales.json')[0].cierre.resultadosPorEmpresa['188'].receipt.decisions;
const money=v=>Math.round(v*100)/100;
test('seis ciclos con ventas parciales conservan los céntimos de MP, PT y costo de ventas',()=>{
 let previous;
 for(let round=1;round<=6;round++){
  const plan=structuredClone(initial);for(const v of Object.values(plan))if(v&&typeof v==='object')v.round=round;
  plan.MANTENIMIENTO.optionIds=round%2?['correctivo']:[];plan.CANALES.transfers={esencial:{'los_olivos:1':10}};
  if(round>1)for(const id of ['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE']){plan[id].purchases=structuredClone(previous.state[id].purchases);plan[id].purchases[round]={};if(id==='MOLDE')plan[id].optionIds=[];}
  const r=C.close({capital:200000,catalog,round,state:C.restoreState(plan,previous?.state||{}),ledger:previous?.ledger||{},sectionsByRound:previous?.financialSections||{},financialPolicy:{cycles:6,economicRulesVersion:'utility-v1',authoritativePrices:true}}),f=r.financial,e=f.estadoResultados,b=f.balanceGeneral;
  assert.equal(money(b.activos-b.pasivoPatrimonio),0);
  assert.equal(money((previous?.financial.balanceGeneral.inventarioPT||0)+e.costosProduccion-e.costoVentas),b.inventarioPT);
  for(const lot of f.lotMovements)assert.equal(money(lot.inventoryValue),lot.inventoryValue);
  assert.equal(money(f.lotMovements.reduce((s,l)=>s+l.costOfSales,0)),e.costoVentas);
  assert.equal(money(f.goodsLots.reduce((s,l)=>s+l.inventoryValue,0)),b.inventarioPT);
  previous=r;
 }
 // Depreciation and COGS are accruals; the cash ledger must remain untouched.
 assert.equal(previous.financial.balanceGeneral.efectivo,85070.42);
});

for(const lots of [false,true])test(`varios productos reparten centavos sin crear ni perder valor; lotes=${lots}`,()=>{
 const cat=[{items:[{id:'CUERO',material:true,options:[{id:'mp',label:'MP',cost:2.003}]},{id:'PERS_CORTE'}]}];
 const rows=[{id:'a',produced:3,available:3,sold:1},{id:'b',produced:7,available:7,sold:2}];
 if(lots)for(const r of rows){r.lots=[{id:r.id,cycle:1,produced:r.produced,available:r.available,materials:{CUERO:{mp:r.produced}}}];r.lotSales=[{id:r.id,units:r.sold}];}
 const f=F.calculate({capital:100,catalog:cat,ledger:{'1:B':-30.04,'1:SIM_VENTAS':3},sectionsByRound:{1:{B:{recordedNet:-30.04,items:[{id:'CUERO',outflow:20.03,rows:[{label:'MP',quantity:10,outflow:20.03}]},{id:'PERS_CORTE',outflow:10.01}]}}},state:{__cycleSettlements:{1:{inventory:{mp:0},sales:rows}}}});
 const e=f.estadoResultados,b=f.balanceGeneral;assert.equal(e.costosProduccion,30.04);assert.equal(money(e.costoVentas+b.inventarioPT),30.04);assert.equal(b.activos,b.pasivoPatrimonio);
 for(const value of Object.values(f.inventoryValues.goods))assert.equal(value,money(value));
});
