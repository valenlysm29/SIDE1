'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),scope);
const catalog=JSON.parse(JSON.stringify(scope.window.SIDE_DECISION_CATALOG));
const baseline=require('./fixtures/decisions_before_engine_update.json');
test('Sales and Finance retain the decisions, labels, options and prices before the engine update',()=>{
 assert.deepEqual(catalog.filter(c=>['D','E'].includes(c.cat)),baseline.categories);
});
test('engine fixes do not require a new regime or worker-assignment decision',()=>{
 const items=catalog.flatMap(c=>c.items);assert.equal(items.some(i=>i.id==='REGIMEN_LABORAL'),false);
 assert.equal(items.find(i=>i.id==='MOLDE').type,'choice');assert.equal(items.find(i=>i.id==='MANTENIMIENTO').type,'choice');
});
test('production calculator contains no editable segment prices',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),helpers=source.slice(source.indexOf('function calculatorMoldLine('),source.indexOf('function refreshProductionCalculator('));
 const context=vm.createContext({window:{SIDE_ECONOMIC_CONFIG:require('../js/engine/config')},escapeHtml:String});vm.runInContext(helpers,context);
 const plan={target:10,productLines:[{id:'molde_1',label:'Molde básico',target:10,requirements:{CUERO:3,ACCESORIOS:10,HILO:60}}]};context.plan=plan;context.draft={moldTargets:{molde_1:10}};
 const html=vm.runInContext('productionCalculatorHtml(plan,draft,false)',context);assert.doesNotMatch(html,/data-sale-price|Precio de venta por segmento/);
 assert.match(html,/data-mold-target/);
});
