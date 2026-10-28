const test=require('node:test');const assert=require('node:assert/strict');const view=require('../js/student_financial_view.js');
test('explica falta de molde y muestra ventas y stock del comprobante',()=>{
 const receipt={produced:0,sold:0,revenue:0,production:{target:10,unavailablePlannedMolds:['molde_1'],processes:[],materials:[]},sales:[{id:'esencial',price:40,demand:100,available:0,sold:0,revenue:0,reason:'Sin molde'}],goods:{esencial:0}};
 const html=view.salesHtml({round:1,cycleReceipt:receipt});
 for(const text of ['Falta el molde','Demanda 100','Vendidas','Perdidas 100','Stock final','S/ 0.00'])assert.ok(html.includes(text),text);
});
test('no inventa un resultado para un ciclo abierto',()=>{assert.match(view.salesHtml({round:2}),/cierre pendiente/);});
