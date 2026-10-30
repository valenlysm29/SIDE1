'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cycle=require('../js/cycle_model.js'),production=require('../js/production_model.js'),review=require('../js/decision_review_model.js'),rules=require('../js/side_rules.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),sandbox);const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));
const clone=v=>JSON.parse(JSON.stringify(v));
function decisions(round,previous={}){
 const state=clone(previous),counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_ind:1},ACABADOS:{aca_ind:1},PERS_CORTE:{corte_maestro:1},PERS_ENSAMBLE:{ens_personal_esp:1},PERS_ACABADO:{aca_personal_art:1},CUERO:{cuero_sint:30},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:600}};
 for(const [id,quantities] of Object.entries(counts))state[id]={round,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:state[id]?.purchases||{1:quantities}}:{})};
 state.MOLDE={round:1,optionIds:['molde_1']};state.JEFATURA={round,optionIds:['si_jefatura']};state.PRODUCCION_META={round,value:100,moldTargets:{molde_1:100,molde_2:0,molde_3:0}};state.CANALES={round,optionIds:['web','los_olivos'],quantities:{los_olivos:1}};return state;
}
test('three complete restored cycles buy, produce, sell, persist and reconcile cash',()=>{
 let state={},ledger={},sectionsByRound={};const rows=[];
 for(let round=1;round<=3;round++){
  state=decisions(round,state);const ctx={catalog,state,drafts:{},round,config:{interest:20,cycles:6},rules,capital:200000,ledger};
  sectionsByRound[round]={};for(const category of catalog.filter(c=>!c.summaryOnly)){const section=review.section(category,ctx);sectionsByRound[round][category.cat]={...section,recordedNet:section.net};ledger[`${round}:${category.cat}`]=section.net;}
  const plan=production.calculate(ctx);assert.equal(plan.producibleUnits,100);
  const result=cycle.close({state,ledger,catalog,round,capital:200000,sectionsByRound,production:plan});state=clone(result.state);ledger=clone(result.ledger);
  assert.equal(result.receipt.sold,100);assert.equal(result.receipt.revenue,4250);assert.equal(result.financial.estadoResultados.ingresos,4250);
  const f=result.financial;assert.equal(f.balanceCaja.cajaFinal,Math.round((200000+Object.values(ledger).reduce((s,v)=>s+v,0))*100)/100);assert.equal(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);
  assert.equal(cycle.close({state,ledger,catalog,round,capital:200000,sectionsByRound}).reused,true);assert.equal(state.__inventarioMP.hilo_std,0);assert.equal(state.__finishedGoods.esencial,0);
  rows.push({round,produced:plan.producibleUnits,sold:result.receipt.sold,revenue:result.receipt.revenue,cash:f.balanceCaja.cajaFinal,profit:f.estadoResultados.utilidad});
 }
 fs.mkdirSync(require('node:path').join(__dirname,'output'),{recursive:true});fs.writeFileSync(require('node:path').join(__dirname,'output/business-three-cycles.json'),JSON.stringify(rows,null,2)+'\n');console.table(rows);
});
test('missing materials or workers never invent production or revenue',()=>{
 for(const missing of ['CUERO','ACCESORIOS','HILO','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']){const state=decisions(1);state[missing].quantities={};const r=cycle.close({state,catalog,round:1});assert.equal(r.receipt.produced,0);assert.equal(r.receipt.revenue,0);}
});
test('legacy POS counts do not change the demand-based settlement',()=>{
 const fixture=require('./economic_v19_fixture.cjs'),state=fixture.state(1,{},3);
 state.PRODUCCION_META.moldTargets={molde_1:10,molde_2:0,molde_3:10};
 const baseline=cycle.close({state,catalog:fixture.catalog,round:1});
 const r=cycle.close({state,catalog:fixture.catalog,round:1,ledger:{'1:SIM_VENTAS':1250},soldUnits:10,soldByProduct:{premium:10}});
 assert.deepEqual(r,baseline);assert.equal(r.receipt.sales[0].sold,10);assert.equal(r.receipt.sales[2].sold,10);assert.equal(r.receipt.sales[2].quality,12);assert.equal(r.receipt.sales[2].price,350);assert.equal(r.ledger['1:SIM_VENTAS'],3925);assert.equal(r.receipt.goods.premium,0);
});
test('700 metres of thread cost S/1288.00 with retained volume discount',()=>{
 const ctx={catalog,state:{},drafts:{HILO:{quantities:{hilo_std:700}}},round:1,rules};const item=catalog.flatMap(c=>c.items||[]).find(i=>i.id==='HILO');assert.ok(Math.abs(review.breakdown(item,ctx).outflow-1288)<1e-9);
});
test('migration preserves cash and closed receipts without charging a finished cycle again',()=>{
 const key='__'+'ex'+'cel',old={habilitado:true,round:2,decisiones:{personal:{corte:[1,0,0]},maquinaria:{mesa:1,'INF-02':1,'INF-08':1},comprasUnidades:{'INS-06':2},lotes:[{molde:'INF-08',cantidad:80}]},resultado:{ciclo:2,ingresos:6000,financial:{balanceCaja:{cajaFinal:175000}}}};
 const migrated=cycle.migrate({state:{[key]:old},ledger:{'1:SIM_VENTAS':1000},catalog,capital:200000,round:2});
 assert.equal(migrated.migrated,true);assert.deepEqual(migrated.archive,old);assert.equal(migrated.closedRound,2);
 assert.equal(200000+Object.values(migrated.ledger).reduce((sum,v)=>sum+v,0),175000);assert.equal(migrated.state.HILO.quantities.hilo_std,540);
 assert.equal(migrated.state.__cycleCosts[2].total,0);assert.equal(cycle.close({state:migrated.state,ledger:migrated.ledger,catalog,round:2,capital:200000}).reused,true);
 assert.equal(cycle.migrate({state:migrated.state,ledger:migrated.ledger,catalog}).migrated,false);
});
test('accounting opening seed preserves debt, assets, equity and visible past revenue',()=>{
 const finance=require('../js/financial_model.js'),balanceGeneral={efectivo:175000,activosFijos:20000,inventarioMP:5000,activos:200000,deuda:30000,capital:150000,resultadosAcumulados:20000,patrimonio:170000,pasivoPatrimonio:200000};
 const previous={round:2,estadoResultados:{ingresos:12000,costos:8000,utilidad:4000},balanceCaja:{cajaFinal:175000},balanceGeneral};
 const openingBalance={round:2,cash:175000,balanceGeneral,history:[previous]};
 const result=finance.calculate({capital:150000,round:3,openingBalance,ledger:{'2:CAPITAL_ADJUSTMENT':25000,'3:SIM_VENTAS':7500,'3:SIM_GASTOS':-1000}});
 assert.equal(result.history[0].estadoResultados.ingresos,12000);assert.equal(result.balanceCaja.cajaInicial,175000);assert.equal(result.balanceCaja.cajaFinal,181500);
 assert.equal(result.balanceGeneral.activosFijos,20000);assert.equal(result.balanceGeneral.deuda,30000);assert.equal(result.balanceGeneral.capital,150000);assert.equal(result.balanceGeneral.resultadosAcumulados,20000+result.estadoResultados.utilidadNeta);assert.equal(result.estadoResultados.gastosFinancieros,459.28);assert.equal(result.estadoResultados.impuestoRenta,1782.01);assert.equal(result.balanceGeneral.activos,result.balanceGeneral.pasivoPatrimonio);
});

test('new receipts identify capacity rules and historical receipts remain unchanged',()=>{
 const result=cycle.close({state:decisions(1),catalog,round:1,capital:200000});
 assert.equal(result.receipt.capacityRulesVersion,'one-worker-per-resource-20261029');
 const historical={round:1,produced:7,sold:0,inventory:{}};
 const reused=cycle.close({state:{__cycleSettlements:{1:historical}},catalog,round:1});
 assert.equal(reused.reused,true);assert.deepEqual(reused.receipt,historical);
});
