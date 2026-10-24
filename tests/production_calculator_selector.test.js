'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
const helpers=source.slice(source.indexOf('function calculatorMoldLine('),source.indexOf('function refreshProductionCalculator('));
function calculator(){
 const context=vm.createContext({window:{SIDE_ECONOMIC_CONFIG:require('../js/engine/config.js')},escapeHtml:value=>String(value)});vm.runInContext(helpers,context);
 const specifications=[['molde_1','Molde básico',.3,6],['molde_2','Molde mejorado',.4,7],['molde_3','Molde premium',.7,13]];
 const plan={target:30,processCapacity:100,producibleUnits:30,productLines:specifications.map(([id,label,leather,thread])=>({id,label,target:10,suggested:20,available:false,requirements:{CUERO:10*leather,ACCESORIOS:10,HILO:10*thread}}))};
 return {context,plan,render(draft,locked=false){context.plan=plan;context.draft=draft;context.locked=locked;return vm.runInContext('productionCalculatorHtml(plan,draft,locked)',context)}};
}
test('one rectangular calculator renders only the selected mold while retaining every target',()=>{
 const c=calculator(),draft={moldTargets:{molde_1:10,molde_2:10,molde_3:10}};
 const before=JSON.stringify(draft.moldTargets);
 for(const [id,leather,thread] of [['molde_1',3,60],['molde_2',4,70],['molde_3',7,130]]){
  draft.viewMoldId=id;const html=c.render(draft);
  assert.equal((html.match(/<select[^>]*data-production-mold(?:\s|>)/g)||[]).length,1);
  assert.equal((html.match(/data-mold-target=/g)||[]).length,1);
  assert.equal((html.match(/<option value=/g)||[]).length,3);
  assert.ok(html.includes(`data-mold-target="${id}"`));
  assert.ok(html.includes(`Cuero: ${leather} m²`));assert.ok(html.includes(`Hilo: ${thread} m`));
  assert.equal(JSON.stringify(draft.moldTargets),before);
 }
});
test('calculator respects the submitted lock and distinguishes comparison from acquisition',()=>{
 const c=calculator(),html=c.render({viewMoldId:'molde_3',moldTargets:{molde_1:10,molde_2:10,molde_3:10}},true);
 assert.match(html,/data-production-mold disabled/);assert.match(html,/data-mold-target="molde_3"[^>]*disabled/);
 assert.doesNotMatch(html,/data-mold-suggest|Usar sugerencia SIDE/);assert.match(html,/no realiza compras/);
 assert.ok(html.indexOf('data-mold-target')<html.indexOf('data-production-mold'));assert.doesNotMatch(html,/Capacidad de la línea|Producción posible con tus insumos/);
});

test('production target input normalizes negatives and fractions immediately in the visible field',()=>{
 const c=calculator();
 for(const [raw,expected] of [['-5','0'],['−5','0'],['3.9','3'],['25','25']]){
  c.context.input={value:raw};vm.runInContext('normalizeProductionTargetInput(input)',c.context);assert.equal(c.context.input.value,expected);
 }
});
