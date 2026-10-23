
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const review=require('../js/decision_review_model.js'),production=require('../js/production_model.js'),rules=require('../js/side_rules.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),sandbox);const catalog=sandbox.window.SIDE_DECISION_CATALOG;
test('Cycle 2 summary uses the current analyst discount consistently with review and production',()=>{
 const context={catalog,rules,round:2,capital:100000,state:{},drafts:{ANALISTA_COMPRAS:{optionIds:['si_analista']},CUERO:{quantities:{cuero_std:100}}}};
 const sections=catalog.map(c=>review.section(c,context)),plan=production.calculate(context);
 const summarySource=fs.readFileSync(require.resolve('../js/company_summary.js'),'utf8');
 const ctx={window:{SIDE_PRODUCTION_MODEL:production},reviewMoney:v=>'S/ '+v.toFixed(2),escapeHtml:String};vm.createContext(ctx);
 for(const name of ['productionItemOutflow','productionSummaryHtml']){const start=summarySource.indexOf('function '+name+'('),end=summarySource.indexOf('\nfunction ',start+1);vm.runInContext(summarySource.slice(start,end),ctx);}
 const material=ctx.productionItemOutflow({sections},'CUERO');assert.ok(Math.abs(material-7452)<1e-8);assert.ok(Math.abs(plan.costs.materials-material)<1e-8);
 const first=production.calculate({...context,round:1});assert.ok(Math.abs(first.costs.materials-100*90*.92*.88)<1e-8);assert.notEqual(first.costs.materials,material);
 const html=ctx.productionSummaryHtml({context,sections});assert.match(html,/<span>Materia prima comprada<\/span><strong>S\/ 7452.00<\/strong>/);
 assert.match(html,/Costo operativo por unidad posible/);
});
