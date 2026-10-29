const test=require('node:test');
const assert=require('node:assert/strict');
const BUS=require('../js/business_rules.js');
const config=require('../js/engine/config.js');
const PRO=require('../js/production_model.js');
const C=require('../js/engine/cierre.js');
test('descuento por cantidad se aplica al superar umbral configurable',()=>{
 const item={cost:45};
 assert.equal(BUS.materialUnitPrice(item,99,0,config),45);
 assert.equal(BUS.materialUnitPrice(item,100,0,config),45*.92);
 assert.equal(BUS.materialUnitPrice(item,100,0,{materials:{quantityDiscountThreshold:101,quantityDiscountRate:.08}}),45);
});
test('unidades de producción en el formulario no se convierten dos veces',()=>{
 assert.equal(PRO.yieldFor('CUERO','cuero_std'),1);
 assert.equal(PRO.yieldFor('HILO','hilo_prem'),1);
});
test('redondeo individual Excel',()=>{
 assert.equal(C.roundDemand(0.5,3),2);
 assert.equal(C.roundDemand(1/3,3500),1167);
});
test('reputación del ciclo por defecto; suavizado opcional',()=>{
 const state={__economicHistory:{reputation:8}};
 const a=C.prepare({id:'a',state,catalog:[],round:1});
 const b=C.prepare({id:'a',state,catalog:[],round:1},{...config,reputation:{smoothWithPrevious:true}});
 assert.equal(a.reputation.valor,0);
 assert.equal(b.reputation.valor,16); assert.equal(b.reputation.valorMercado,4);
});
test('cierre autorizado ignora precios inyectados y usa configuración interna',()=>{
 const input={id:'a',round:1,catalog:[],state:{PRODUCCION_META:{round:1,prices:{esencial:900000,urbano:1,premium:1}}},prices:{premium:900000},financialPolicy:{authoritativePrices:true}};
 const profile=C.prepare(input);
 assert.deepEqual(profile.lines.map(line=>line.price),[42.5,100,250]);
 const changed={...config,segments:{...config.segments,premium:{...config.segments.premium,defaultPrice:275}}};
 assert.equal(C.prepare(input,changed).lines[2].price,275);
});
test('participantes sintéticos configurables se registran en el reparto',()=>{
 const line={id:'esencial',price:40,available:10000};
 const p={id:'real',scores:{reputation:5},lines:[line]};
 const withSynthetic=C.allocate([p],{...config,simulatedCompetitors:{enabled:true,target:4}}).real.products.esencial;
 assert.equal(withSynthetic.asignado,875);
 assert.equal(withSynthetic.simulatedCompetitors.length,3);
 assert.equal(withSynthetic.simulatedCompetitors[0].precio,40);
 const actualOnly=C.allocate([p],{...config,simulatedCompetitors:{enabled:false,target:4}}).real.products.esencial;
 assert.equal(actualOnly.asignado,3500);
});
test('sin canal se advierte que no habrá ventas',()=>{
 const review=require('../js/decision_review_model.js');
 const messages=review.warnings({state:{},drafts:{},catalog:[],round:1});
 assert.ok(messages.some(w=>/sin canal de venta activo/i.test(w.text)));
});
