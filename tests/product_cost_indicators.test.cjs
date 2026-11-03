'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('../js/student_financial_view');
test('costos por producto conservan fabricación y lotes vendidos; equilibrio no duplica fabricación',()=>{
 const row={round:2,cycleReceipt:{sales:[{id:'esencial',produced:10,sold:6},{id:'premium',produced:0,sold:0}]},estadoResultados:{gastosOperacion:12,gastosFinancieros:6},lotMovements:[{segment:'esencial',cycle:1,produced:2,costOfSales:8,inventoryValue:0},{segment:'esencial',cycle:2,produced:10,costOfSales:12,inventoryValue:18}]};
 const before=JSON.stringify(row),[a,b]=V.productCosts(row,{esencial:12});
 assert.equal(a.manufacturing,3);assert.equal(a.salesCost,20/6);assert.equal(a.breakEven,(40+18)/12);assert.equal(a.guidePrice,(20/6)/.7);assert.equal(b.manufacturing,null);assert.equal(b.breakEven,null);assert.equal(JSON.stringify(row),before);
 assert.match(V.productCostsHtml(row),/no garantiza margen neto/);assert.throws(()=>V.productCosts(row,{},1),RangeError);
});
test('ausencia de lotes o cierre no fabrica costos; cero producción y ventas permanece no disponible',()=>{
 assert.deepEqual(V.productCosts({}),[]);
 const row={round:1,cycleReceipt:{sales:[{id:'esencial',produced:0,sold:0}]},estadoResultados:{},lotMovements:[]};
 const [r]=V.productCosts(row);for(const key of ['manufacturing','salesCost','breakEven','guidePrice'])assert.equal(r[key],null);
 assert.doesNotMatch(V.productCostsHtml(row),/NaN|Infinity/);
});
