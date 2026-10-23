'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const dop=require('../js/production_dop.js');
function plan(available){
 return {target:40,producibleUnits:available?40:0,days:24,efficiency:0.9,
 productLines:[{id:'molde_1',label:'Molde básico',target:40,plannedUnits:available?40:0}],
 materials:[{id:'CUERO',label:'Cuero',unit:'m²',neededForTarget:12,available,selections:available?[{label:'Sintético'}]:[]},{id:'ACCESORIOS',label:'Accesorios',unit:'unidades',neededForTarget:40,available:available?40:0},{id:'HILO',label:'Hilo',unit:'metros',neededForTarget:240,available:available?240:0}],
 processes:['cut','assembly','finish'].map(id=>({id,staff:available?1:0,machines:available?1:0,cycleCapacity:available?108:0}))};
}
test('DOP separates desired material requirements from actual production and stock',()=>{
 const empty=plan(0),stocked=plan(20),before=JSON.stringify(empty);
 const first=dop.render(empty,{round:1}),second=dop.render(stocked,{round:1});
 const requirements=html=>html.match(/<section class="pd-requirements-table">[\s\S]*?<\/section>/)[0];
 assert.equal(requirements(first),requirements(second));
 assert.match(first,/40 u\./);assert.match(first,/0 juegos cortados/);assert.match(first,/0 bolsos ensamblados/);assert.match(first,/0 bolsos acabados/);
 assert.match(second,/40 juegos cortados/);assert.match(second,/40 bolsos ensamblados/);assert.match(second,/40 bolsos acabados/);
 assert.match(first,/12 m²/);assert.match(first,/240 metros/);
 assert.match(second,/1 operario\(s\) · 1 mesa\(s\) · 108 u\.\/ciclo/);
 assert.equal(JSON.stringify(empty),before);
});
test('zero resources remain explicit and finite without manufacturing production',()=>{
 const html=dop.render(plan(0),{round:1});
 assert.match(html,/0 conformes ÷ 40 deseadas/);assert.match(html,/0 unidades totales/);
 assert.match(html,/0 operario\(s\) · 0 máquina\(s\)/);
 assert.match(html,/Sin compra registrada/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('persisted legacy requirements remain readable and never invent a purchase selection',()=>{
 const input=plan(0),before=JSON.stringify(input);input.requirements={materials:input.materials.map(row=>({...row,needs:row.neededForTarget}))};
 input.comparison={items:[{id:'CUERO',available:5}]};delete input.materials;
 const snapshot=JSON.stringify(input),html=dop.render(input,{round:2});
 assert.match(html,/5 m²/);assert.match(html,/12 m²/);assert.match(html,/Sin compra registrada/);
 assert.match(html,/PRODUCCIÓN FINAL DEL CICLO 2/);assert.equal(JSON.stringify(input),snapshot);
 assert.notEqual(snapshot,before);
});
