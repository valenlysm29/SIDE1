'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {state,catalog}=require('./economic_v19_fixture.cjs');
const E=require('../js/engine/cierre.js'),REVIEW=require('../js/decision_review_model.js'),RULES=require('../js/side_rules.js');
const expected=require('./fixtures/excel_v19_expected.json').valores;
const item=id=>catalog.flatMap(c=>c.items).find(i=>i.id===id);
test('active payroll prices equal independently recalculated Excel MYPE monthly costs at every level',()=>{
 for(const [id,role] of [['PERS_CORTE','corte'],['PERS_ENSAMBLE','ensamble'],['PERS_ACABADO','acabado']])item(id).options.forEach((o,i)=>assert.equal(o.cost,expected[`mo_${role}_${i+1}`]));
 const result=E.prepare({id:'A',state:state(),catalog,round:1});
 assert.ok(Math.abs(result.plan.costs.labor-56384.64)<1e-8);
});
test('active materials charge Excel physical unit cost with volume discount exactly once',()=>{
 const costs={CUERO:[25,45,80],ACCESORIOS:[4,9],HILO:[2,4,7]};
 for(const [id,prices] of Object.entries(costs))item(id).options.forEach((o,i)=>{
  assert.equal(o.cost,prices[i]);
  const amount=REVIEW.breakdown(item(id),{state:{},drafts:{[id]:{quantities:{[o.id]:10}}},round:1,rules:RULES,catalog}).outflow;
  assert.ok(Math.abs(amount-prices[i]*10*.92)<1e-8);
 });
 assert.equal(item('MANTENIMIENTO').options[0].cost,1500);
 assert.equal(item('LIMPIEZA').options[0].cost,712.32);
 assert.equal(item('JEFATURA').options.find(o=>o.id==='si_jefatura').cost,3321.6);
});
test('opening receivables are counted once in assets after a migrated balance',()=>{
 const FIN=require('../js/financial_model.js');
 const openingBalance={round:1,cash:1000,balanceGeneral:{efectivo:1000,cuentasPorCobrar:200,activos:1200,capital:1200}};
 const result=FIN.calculate({round:2,capital:1200,openingBalance,state:{},ledger:{},catalog});
 assert.equal(result.balanceGeneral.cuentasPorCobrar,200);
 assert.equal(result.balanceGeneral.activos,1200);
});
