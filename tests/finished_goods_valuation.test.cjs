'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const FIN=require('../js/financial_model');
const catalog=[{items:[{id:'CUERO',material:true,options:[{id:'piel',label:'Piel',cost:10}]}]}];
const section={net:-100,recordedNet:-100,items:[{id:'CUERO',outflow:100,rows:[{label:'Piel',quantity:10,outflow:100}]}]};
function receipt(round,produced,available,sold,remaining){return {round,modelVersion:'md-20261027',inventory:{piel:remaining},production:{productLines:[{target:10,plannedUnits:10,requirements:{CUERO:10}}]},sales:[{id:'esencial',produced,available,sold}],decisions:{}};}
test('unsold goods remain valued; subsequent sales recognize cost once',()=>{
 const first=receipt(1,10,10,5,0),state={__cycleSettlements:{1:first}},ledger={'1:B':-100,'1:SIM_VENTAS':100};
 const one=FIN.calculate({capital:1000,ledger,catalog,round:1,state,sectionsByRound:{1:{B:section}},financialPolicy:{cycles:3}});
 assert.equal(one.estadoResultados.costoVentas,50);assert.equal(one.balanceGeneral.inventarioPT,50);assert.equal(one.estadoResultados.utilidadAntesImpuestos,50);assert.equal(one.balanceGeneral.activos,one.balanceGeneral.pasivoPatrimonio);
 const second=receipt(2,0,5,5,0);state.__cycleSettlements[2]=second;state.__financialSnapshots={1:{...one,history:undefined}};
 const two=FIN.calculate({capital:1000,ledger:{...ledger,'2:SIM_VENTAS':100},catalog,round:2,state,sectionsByRound:{1:{B:section}},financialPolicy:{cycles:3}});
 assert.equal(two.estadoResultados.costoVentas,50);assert.equal(two.balanceGeneral.inventarioPT,0);assert.equal(two.estadoResultados.utilidadAntesImpuestos,50);assert.equal(two.balanceGeneral.activos,two.balanceGeneral.pasivoPatrimonio);
});
