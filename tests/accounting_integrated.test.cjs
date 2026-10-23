'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../js/financial_model');
const catalog=[{items:[{id:'CUERO',material:true,options:[{id:'leather',label:'Cuero',cost:10}]},{id:'PERS_CORTE'},{id:'LOCAL_PROD'},{id:'CANALES'},{id:'ENSAMBLE',asset:true,options:[{id:'machine',cost:1200}]}]}];
function run({sold=4,price=100,labor=20,admin=10,round=1,state,ledger,sectionsByRound}={}){
 const items=[{id:'CUERO',outflow:100,rows:[{label:'Cuero',quantity:10,outflow:100}]},{id:'PERS_CORTE',outflow:labor},{id:'LOCAL_PROD',outflow:admin},{id:'ENSAMBLE',outflow:1200}];
 return F.calculate({capital:2000,catalog,round,ledger:ledger||{'1:B':-1320-admin,'1:SIM_VENTAS':sold*price,'1:COMISION_VENTAS':-sold*price*.01},sectionsByRound:sectionsByRound||{1:{B:{recordedNet:-1320-admin,items}}},state:state||{__cycleSettlements:{1:{financialPolicy:{tea:20},inventory:{leather:4},decisions:{ENSAMBLE:{quantities:{machine:1}}},sales:[{id:'esencial',produced:6,available:6,sold}],goods:{esencial:6-sold}}}}});
}
test('standard formulas, positive income, losses and zero sales use 29.5% only on profits',()=>{
 for(const [revenue,cost] of [[1000,100],[100,1000],[0,100]]){const e=F.buildStatement({ventasTotales:revenue,costoVentas:cost,gastosAdministrativos:10,gastosVentas:revenue*.01,gastosFinancieros:5});assert.equal(e.utilidadBruta,revenue-cost);assert.equal(e.utilidadOperativa,e.utilidadBruta-e.gastosOperacion);assert.equal(e.utilidadAntesImpuestos,e.utilidadOperativa-5);assert.equal(e.impuestoRenta,Math.round(Math.max(0,e.utilidadAntesImpuestos*.295)*100)/100);assert.equal(e.utilidadNeta,Math.round((e.utilidadAntesImpuestos-e.impuestoRenta)*100)/100);}
});
test('unused MP and unsold finished goods stay capitalized; assets do not become expenses',()=>{
 const f=run(),e=f.estadoResultados,b=f.balanceGeneral;
 assert.equal(b.inventarioMP,40);assert.equal(e.costosProduccion,89.5);assert.equal(e.costoVentas,59.67);assert.equal(b.inventarioPT,29.83);assert.equal(e.gastosAdministrativos,10);assert.equal(e.gastosVentas,4);assert.equal(e.depreciacion,9.5);assert.equal(b.activosFijos,1190.5);assert.equal(b.activos,b.pasivoPatrimonio);
});
test('no sales create no COGS, no commission, and preserve all finished goods',()=>{const f=run({sold:0});assert.equal(f.estadoResultados.costoVentas,0);assert.equal(f.estadoResultados.impuestoRenta,0);assert.equal(f.balanceGeneral.inventarioPT,89.5);assert.equal(f.estadoResultados.gastosVentas,0);});
test('TEA uses effective monthly compounding and loan principal stays outside revenue',()=>{
 const f=F.calculate({capital:1000,ledger:{'1:E':1200},sectionsByRound:{1:{E:{recordedNet:1200,items:[{id:'PRESTAMO',financing:1200}]}}},financialPolicy:{tea:20,cycleMonths:2}});
 assert.equal(f.estadoResultados.ingresos,0);assert.equal(f.balanceGeneral.deuda,1200);assert.equal(f.estadoResultados.gastosFinancieros,Math.round(1200*(Math.pow(1.2,2/12)-1)*100)/100);assert.equal(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);
});
test('restoring and reading historical receipts is deterministic and does not mutate state',()=>{const a=run(),b=run();assert.deepEqual(a,b);assert.equal(a.history.length,1);});
test('closed financial snapshots resist later ledger and policy changes',()=>{const f=run(),snapshot={...f};delete snapshot.history;const result=F.calculate({capital:2000,catalog,round:1,ledger:{'1:SIM_VENTAS':999999},financialPolicy:{interest:99},state:{__financialSnapshots:{1:snapshot}}});assert.deepEqual(result.estadoResultados,f.estadoResultados);assert.deepEqual(result.balanceGeneral,f.balanceGeneral);});
test('unconfirmed material section never creates an inventory asset',()=>{const f=F.calculate({capital:1000,catalog,sectionsByRound:{1:{F:{recordedNet:-100,items:[{id:'CUERO',outflow:100,rows:[{label:'Cuero',quantity:10,outflow:100}]}]}}}});assert.equal(f.balanceGeneral.inventarioMP,0);assert.equal(f.balanceGeneral.activos,1000);});
test('warranty uses source-backed rates and identifies missing 180-day policy',()=>{
 const full=[...catalog,{items:[{id:'GARANTIA_PT',options:[{id:'pt_30',value:30},{id:'pt_180',value:180}]}]}];
 const close=id=>F.calculate({capital:1000,catalog:full,ledger:{'1:SIM_VENTAS':200},state:{__cycleSettlements:{1:{decisions:{GARANTIA_PT:{optionIds:[id]}},sales:[{id:'esencial',sold:2,produced:2,available:2}],inventory:{}}}}});
 const covered=close('pt_30');assert.equal(covered.estadoResultados.gastoGarantias,10);assert.equal(covered.balanceGeneral.provisionGarantias,10);assert.equal(covered.balanceGeneral.activos,covered.balanceGeneral.pasivoPatrimonio);assert.equal(close('pt_180').estadoResultados.policyWarnings.length,1);
});
test('migrated MP aggregate is consumed using explicit opening quantities',()=>{const f=F.calculate({round:2,catalog,openingBalance:{round:1,cash:900,balanceGeneral:{efectivo:900,inventarioMP:100,activos:1000,capital:1000}},state:{__cycleSettlements:{2:{openingInventory:{leather:10},inventory:{leather:4},sales:[{id:'esencial',produced:6,available:6,sold:0}]}}}});assert.equal(f.balanceGeneral.inventarioMP,40);assert.equal(f.balanceGeneral.inventarioPT,60);assert.equal(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);});
