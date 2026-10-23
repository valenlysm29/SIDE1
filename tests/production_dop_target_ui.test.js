'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const dop=require('../js/production_dop.js');
function plan(available){
 return {target:40,producibleUnits:available?40:0,days:24,productLines:[{id:'molde_1',label:'Molde básico',target:40}],requirements:{target:40,materials:[{id:'CUERO',label:'Cuero',unit:'m²',needs:12,excelSource:'Excel producción',options:[{id:'cuero_sint',label:'Sintético',quantity:12,unit:'m²',unitPrice:25,amount:276,excelSource:'Excel costos'}]},{id:'ACCESORIOS',label:'Accesorios',unit:'unidades',needs:40},{id:'HILO',label:'Hilo',unit:'m',needs:240}],processes:['cut','assembly','finish'].map(id=>({id,label:id,units:40,workersNeeded:null,machinesNeeded:null,laborDays:null,calendarDays:24,monthlyPayroll:null,unitWorkCost:null})),costs:{items:[{id:'labor',label:'Personal',amount:null}],total:null,knownSubtotal:0},unresolved:['El Excel no define una fórmula inversa de dotación.']},comparison:{items:[{id:'CUERO',label:'Cuero',unit:'m²',needs:12,available,missing:available?0:12,surplus:available?8:0,costToCover:null}],producibleUnits:available?40:0,compliancePercent:available?100:0,costToCoverTotal:null}};
}
test('DOP requirements stay tied to the desired quantity even without purchased resources',()=>{
 const empty=plan(0),stocked=plan(20),before=JSON.stringify(empty);
 const first=dop.render(empty,{round:1,producedPercent:0}),second=dop.render(stocked,{round:1,producedPercent:100});
 const requirements=html=>html.slice(html.indexOf('<div class="pd-graph"'),html.indexOf('<section class="pd-comparison"'));
 assert.equal(requirements(first),requirements(second));
 assert.match(first,/40 juegos por cortar/);assert.match(first,/40 bolsos por ensamblar/);assert.match(first,/40 bolsos por acabar/);
 assert.match(first,/12 m²/);assert.match(first,/240 m/);assert.match(first,/No definido en el Excel/);
 assert.ok(first.indexOf('Costo de realizar tu meta')<first.indexOf('Ahora compara con lo que tienes'));
 assert.match(first,/S\/ 276\.00/);assert.match(first,/No son una cotización, una compra ni un cobro/);
 assert.doesNotMatch(first,/juegos cortados|unidades totales|Usar sugerencia/);
 assert.equal(JSON.stringify(empty),before);
});
test('null requirements remain undefined rather than zero, while actual zero stock is displayed',()=>{
 const html=dop.render(plan(0),{round:1});
 assert.match(html,/<dt>Personal requerido<\/dt><dd>No definido en el Excel<\/dd>/);
 assert.match(html,/<dt>Costo total de la meta<\/dt><dd>No definido en el Excel<\/dd>/);
 assert.match(html,/<span>Posible con tus recursos actuales<\/span><strong data-pd-feasible>0 unidades<\/strong>/);
 assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});


test('shortfall shows each workbook quality cost without inventing a material selection',()=>{
 const input=plan(0);input.comparison.items[0].costToCoverOptions=[{id:'cuero_sint',label:'Sintético',amount:276},{id:'cuero_pu',label:'PU',amount:496.8}];
 const html=dop.render(input,{round:1});
 assert.match(html,/Sintético: S\/ 276\.00/);assert.match(html,/PU: S\/ 496\.80/);
});
