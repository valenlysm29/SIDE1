'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const orders=require('../js/material_orders'),production=require('../js/production_model'),cycle=require('../js/cycle_model'),fixture=require('./economic_v19_fixture.cjs');
function scenario(receive){
 let ledger=orders.apply({}, {id:'o',type:'order',orderId:'a',companyId:'A',sku:'hilo_std',unit:'m',quantity:1300,unitCost:2,orderedDay:0,leadTimeDays:7});
 if(receive)ledger=orders.apply(ledger,{id:'r',type:'receipt',orderId:'a',companyId:'A',quantity:1300,day:7});
 ledger.companyId='A';
 const state=fixture.state(1,{},2);
 state.__inventarioMP={cuero_prem:70,acc_prem:100};state.__materialOrders=ledger;
 state.CUERO.quantities={};state.ACCESORIOS.quantities={};state.HILO.quantities={hilo_std:1300};
 state.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:100};return state;
}
test('preview real no usa pedido pendiente, y solo fabrica tras recepción explícita',()=>{
 const pending=production.calculate({state:scenario(false),catalog:fixture.catalog,round:1});
 assert.equal(pending.producibleUnits,0);assert.equal(pending.materials.find(m=>m.id==='HILO').available,0);
 assert.equal(pending.materials.find(m=>m.id==='HILO').pending,1300);
 const arrived=production.calculate({state:scenario(true),catalog:fixture.catalog,round:1});
 assert.equal(arrived.producibleUnits,100);assert.equal(arrived.temporal.windows.slice(0,7).reduce((n,d)=>n+d.produced,0),0);
 assert.equal(arrived.materials.find(m=>m.id==='HILO').consumption,1300);
});
test('cierre rechaza ledger temporal hasta implementar valoración y persistencia',()=>{
 assert.throws(()=>cycle.close({state:scenario(true),catalog:fixture.catalog,round:1,capital:200000}),/valoración ni persistencia/);
});

test('recepción tardía no reutiliza la capacidad de los siete días anteriores',()=>{
 const state=scenario(false);state.__inventarioMP={cuero_prem:140,acc_prem:200};
 state.PRODUCCION_META.moldTargets.molde_3=200;
 for(const [id,option] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[id]={round:1,quantities:{[option]:1},purchases:['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{1:{[option]:1}}:undefined};
 state.JEFATURA={round:1,optionIds:['no_jefatura']};
 let ledger=orders.apply({}, {id:'o2',type:'order',orderId:'b',companyId:'A',sku:'hilo_std',unit:'m',quantity:2600,unitCost:2,orderedDay:0,leadTimeDays:7});
 ledger=orders.apply(ledger,{id:'r2',type:'receipt',orderId:'b',companyId:'A',quantity:2600,day:7});ledger.companyId='A';state.__materialOrders=ledger;
 const plan=production.calculate({state,catalog:fixture.catalog,round:1});
 assert.equal(plan.processCapacity,162);assert.equal(plan.producibleUnits,125);
 assert.equal(plan.temporal.windows.slice(0,7).reduce((n,d)=>n+d.produced,0),0);
 assert.equal(plan.materials.find(m=>m.id==='HILO').consumption,1625);
});

test('preview temporal sin libro falla en vez de sumar compras inmediatamente',()=>{
 const state=scenario(false);delete state.__materialOrders;
 assert.throws(()=>production.calculate({state,catalog:fixture.catalog,round:1,config:{materialRulesVersion:'receipts-v1'}}),/requiere un libro/);
});

test('preview conserva por SKU entradas tardías y consumo de materiales',()=>{
 const state=scenario(false);state.__inventarioMP={cuero_prem:70,acc_prem:100,hilo_std:650};
 let ledger=orders.apply({}, {id:'o3',type:'order',orderId:'c',companyId:'A',sku:'hilo_prem',unit:'m',quantity:650,unitCost:7,orderedDay:0,leadTimeDays:7});
 ledger=orders.apply(ledger,{id:'r3',type:'receipt',orderId:'c',companyId:'A',quantity:650,day:7});ledger.companyId='A';state.__materialOrders=ledger;
 const plan=production.calculate({state,catalog:fixture.catalog,round:1}),t=plan.temporal;
 assert.equal(plan.producibleUnits,100);assert.equal(t.consumedBySku.hilo_std,650);assert.equal(t.consumedBySku.hilo_prem,650);
 assert.equal(t.stockBySku.hilo_std,0);assert.equal(t.stockBySku.hilo_prem,0);
 assert.equal(t.windows.slice(0,7).reduce((sum,d)=>sum+(d.consumedBySku.hilo_prem||0),0),0);
 assert.equal(t.windows.reduce((sum,d)=>sum+(d.consumedBySku.hilo_prem||0),0),650);
});

test('etapa económica usa SKU realmente consumidos por el plan temporal',()=>{
 const state=scenario(false);state.__inventarioMP={cuero_prem:70,acc_prem:100,hilo_std:650};
 let ledger=orders.apply({}, {id:'order-mix',type:'order',orderId:'mix',companyId:'A',sku:'hilo_prem',unit:'m',quantity:650,unitCost:7,orderedDay:0,leadTimeDays:7});
 ledger=orders.apply(ledger,{id:'receipt-mix',type:'receipt',orderId:'mix',companyId:'A',quantity:650,day:7});ledger.companyId='A';state.__materialOrders=ledger;
 const ECON=require('../js/engine/cierre'),prepared=ECON.prepare({id:'A',state,catalog:fixture.catalog,round:1});
 const lot=prepared.materialLots.find(row=>row.mold==='molde_3'),usage=prepared.plan.temporal.consumedBySku;
 assert.ok(lot);assert.equal(lot.materials.HILO.hilo_std||0,usage.hilo_std);assert.equal(lot.materials.HILO.hilo_prem||0,usage.hilo_prem);
 assert.equal(prepared.reputation.consumo.hilo_std,usage.hilo_std);assert.equal(prepared.reputation.consumo.hilo_prem,usage.hilo_prem);
 assert.equal((lot.materials.HILO.hilo_std||0)+(lot.materials.HILO.hilo_prem||0),prepared.plan.producibleUnits*13);
});
