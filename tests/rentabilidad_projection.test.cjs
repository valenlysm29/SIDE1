'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/profit_projection'),BUS=require('../js/business_rules'),CONFIG=require('../js/engine/config'),{catalog}=require('./economic_v19_fixture.cjs'),{plan}=require('./rentabilidad_plan.cjs');
function input(){return {state:{...plan({round:1,cycles:3}),__materialOrders:{companyId:'qa',events:{}}},catalog,round:1,capital:100000,financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',verifiedMaterialContext:true,materialPaymentMode:'cash'}};}
test('una cotización previa distingue entregas hipotéticas de recepciones registradas',()=>{
 const x=input(),before=JSON.stringify(x);assert.equal(P.analyze(x).available,false);
 const r=P.analyze({...x,projectionAssumptions:{plannedDeliveries:true,leadTimeDays:7}});
 assert.ok(r.available);assert.ok(r.assumptions[0].includes('No son órdenes ni recepciones registradas'));assert.ok(r.base.produced>0&&r.base.produced<430);assert.equal(JSON.stringify(x),before);
 const later=P.analyze({...x,projectionAssumptions:{plannedDeliveries:true,leadTimeDays:31}});assert.ok(later.available);assert.equal(later.base.produced,0);assert.equal(later.base.sold,0);
 assert.equal(r.state,undefined);assert.equal(r.receipt,undefined);assert.equal(r.ledger,undefined);
});
test('las órdenes confirmadas sin entregas no se reemplazan por entregas hipotéticas',()=>{
 const x=input();for(const item of catalog.flatMap(c=>c.items||[]).filter(i=>i.material))for(const option of item.options||[]){const q=x.state[item.id]?.quantities?.[option.id];if(!q)continue;const id='real-'+option.id;x.state.__materialOrders.events[id]={type:'order',id,orderId:id,companyId:'qa',sku:option.id,quantity:q,unit:'physical',unitCost:BUS.materialUnitPrice(option,q,0,CONFIG),orderedDay:0,leadTimeDays:7,paymentMode:'cash'};}
 const before=JSON.stringify(x),r=P.analyze({...x,projectionAssumptions:{plannedDeliveries:true,leadTimeDays:0}});assert.ok(r.available);assert.equal(r.base.produced,0);assert.equal(r.base.sold,0);assert.equal(r.assumptions,undefined);assert.equal(JSON.stringify(x),before);
});
test('los precios de margen son informativos y no cambian la versión ni precios guardados',()=>{
 const x={state:plan({round:1,cycles:3}),catalog,round:1,capital:100000,financialPolicy:{cycles:3,economicRulesVersion:'utility-v1',authoritativePrices:true}};x.state.PRODUCCION_META.prices={esencial:42.5,urbano:100,premium:250};
 const before=JSON.stringify(x),r=P.analyze(x),s=r.base.sales[0];assert.equal(s.price,120);assert.ok(s.targetPrices.every((p,i,a)=>!i||p.price>a[i-1].price));assert.equal(JSON.stringify(x),before);assert.ok(r.base.minimumSales>0);assert.ok(r.base.grossMargin>0);
 const old=P.analyze({...x,financialPolicy:{cycles:3,authoritativePrices:false}});assert.equal(old.base.sales[0].price,42.5);
 const pinned=P.analyze({...x,financialPolicy:{...x.financialPolicy,workerVersion:'0'}});assert.equal(pinned.available,false);assert.match(pinned.reason,/motor anterior/);
});
