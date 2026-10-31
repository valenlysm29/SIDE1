'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../js/engine/cierre.js'),C=require('../js/cycle_model.js'),F=require('./economic_v19_fixture.cjs');
test('CONS-02 modifica precio e ingresos reales una sola vez',()=>{
 const s=F.state(1,{},2),r=C.close({state:s,catalog:F.catalog,round:1,capital:200000});
 const premium=r.receipt.sales.find(x=>x.id==='premium');assert.equal(premium.price,350);assert.equal(premium.revenue,premium.sold*350);assert.equal(r.receipt.consequences.filter(x=>x.id==='CONS-02').length,1);
 const again=C.close({state:r.state,ledger:r.ledger,catalog:F.catalog,round:1,capital:200000});assert.equal(again.receipt.revenue,r.receipt.revenue);
});
test('CONS-03 y CONS-08 limitan unidades y consumen solo lo fabricado',()=>{
 const s=F.state();s.JEFATURA.optionIds=['no_jefatura'];const score=E.scores(s).efficiency;
 const config={...E.config,consequences:{...E.config.consequences,lowEfficiency:score+1,noLeaderEfficiency:score+1}};
 const result=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:1}],config).a;
 assert.equal(result.plan.producibleUnits,Math.floor(Math.floor(90*.7)*.95));assert.equal(result.plan.target,90);assert.equal(result.plan.productLines[0].target,90);
 assert.deepEqual(result.messages.filter(x=>['CONS-03','CONS-08'].includes(x.id)).map(x=>x.id),['CONS-03','CONS-08']);
 assert.equal(result.plan.materials.find(x=>x.id==='ACCESORIOS').consumption,result.plan.producibleUnits);
});
test('CONS-04 usa reputación del catálogo y persiste dos ciclos',()=>{
 const s=F.state();s.__economicHistory={lowReputationCycles:1};const score=E.scores(s).reputation;
 const config={...E.config,consequences:{...E.config.consequences,lowReputation:score+1}};
 const r=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:1}],config).a;
 assert.equal(r.lowReputationCycles,2);assert.equal(r.demandFactor,.8);assert.ok(r.messages.some(x=>x.id==='CONS-04'));
 const row=r.allocation.products.esencial;assert.equal(row.demandaAjustada,Math.floor(row.asignado*.8));
});
test('CONS-01 usa calidad prémium registrada y el precio reducido',()=>{
 const s=F.state(1,{},2);s.PRODUCCION_META.moldTargets={};s.__finishedGoods={premium:10};s.__economicHistory={goodsQuality:{premium:3}};
 const r=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:1}]).a;
 const line=r.sales.find(x=>x.id==='premium');assert.equal(line.price,162.5);assert.equal(line.revenue,line.sold*162.5);assert.ok(r.messages.some(x=>x.id==='CONS-01'));
});
test('dos cierres conservan el contador de reputación y no reescriben el primero',()=>{
 let s=F.state();s.__catalogSelection=[];s.__economicHistory={lowReputationCycles:1};
 const first=C.close({state:s,catalog:F.catalog,round:1,capital:200000});
 const frozen=JSON.stringify(first.receipt);const next=F.state(2,first.state);
 const second=C.close({state:next,ledger:first.ledger,catalog:F.catalog,round:2,capital:200000,sectionsByRound:first.financialSections});
 assert.equal(JSON.stringify(second.state.__cycleSettlements[1]),frozen);assert.ok(second.receipt.sold<=second.receipt.sales.reduce((sum,x)=>sum+x.available,0));
});
test('la brecha de capacidad conserva la meta original tras una consecuencia productiva',()=>{
 const s=F.state();s.PRODUCCION_META.moldTargets={molde_1:2500,molde_2:0,molde_3:0};
 const score=E.scores(s).efficiency,config={...E.config,consequences:{...E.config.consequences,lowEfficiency:score+1}};
 const plan=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:1}],config).a.plan;
 assert.equal(plan.target,2500);
 for(const process of plan.processes)assert.equal(process.shortfall,Math.max(0,2500-process.cycleCapacity));
 assert.equal(plan.productionGap,2500-plan.producibleUnits);
});
