'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const cycle=require('../js/cycle_model.js'),fixture=require('./economic_v19_fixture.cjs');
function state(machine=true){
 const s=fixture.state(1,{},0);
 for(const [id,opt,q] of [['MESA_CORTE','mesa',10],['ENSAMBLE','ens_ind',machine?1:0],['ACABADOS','aca_ind',10],['PERS_CORTE','corte_maestro',10],['PERS_ENSAMBLE','ens_personal_esp',1],['PERS_ACABADO','aca_personal_art',10]]){
  s[id].quantities=q?{[opt]:q}:{};s[id].optionIds=q?[opt]:[];if(s[id].purchases)s[id].purchases=q?{1:{[opt]:q}}:{};
 }
 s.CUERO.quantities={cuero_prem:300};s.ACCESORIOS.quantities={acc_prem:1000};s.HILO.quantities={hilo_prem:6000};s.PRODUCCION_META.moldTargets={molde_1:1000,molde_2:0,molde_3:0};return s;
}
const event={id:'PE30',round:1,intensity:25,version:'assembly-breakdown-v1'};
test('PE30 reduce capacidad de ensamblado, consumo físico y cobra reparación una vez',()=>{
 const input={state:state(),catalog:fixture.catalog,round:1,capital:1000000};
 const baseline=cycle.close(input),affected=cycle.close({...input,events:[event]});
 const assembly=r=>r.receipt.production.processes.find(p=>p.id==='assembly');
 assert.equal(assembly(affected).dailyCapacity,assembly(baseline).dailyCapacity*.75);
 assert.ok(affected.receipt.produced<baseline.receipt.produced);
 assert.equal(affected.receipt.production.materials.find(x=>x.id==='HILO').consumption,affected.receipt.produced*6);
 assert.equal(affected.ledger['1:EVENT:PE30'],-200);assert.equal(affected.financial.flujoCaja.eventos,-200);
 assert.equal(affected.receipt.events[0].id,'PE30');assert.equal(affected.financial.balanceGeneral.activos,affected.financial.balanceGeneral.pasivoPatrimonio);
 assert.ok(affected.receipt.sold<=affected.receipt.produced);
 const retry=cycle.close({...input,state:affected.state,ledger:affected.ledger,sectionsByRound:affected.financialSections,events:[event]});
 assert.equal(retry.reused,true);assert.deepEqual(retry.receipt,affected.receipt);assert.equal(retry.ledger['1:EVENT:PE30'],-200);
});
test('sin ensambladora PE30 no cobra reparación ni se registra como aplicado',()=>{
 const input={state:state(false),catalog:fixture.catalog,round:1,capital:1000000};
 const affected=cycle.close({...input,events:[event]});assert.equal(affected.receipt.produced,0);assert.equal(affected.ledger['1:EVENT:PE30'],undefined);assert.deepEqual(affected.receipt.events,[]);
});
test('actividad recreativa no modifica el cierre con PE30 autorizado',()=>{
 const input={state:state(),catalog:fixture.catalog,round:1,capital:1000000,events:[event]};
 const expected=cycle.close(input);
 const played=cycle.close({...input,soldUnits:99999,soldByProduct:{esencial:99999},ledger:{'1:SIM_VENTAS':99999,'1:SIM_GASTOS':-9999,'1:SIM_INVERSION':-500,'1:SIM_DEVOLUCIONES':-100}});
 assert.deepEqual(played,expected);
});

test('PE30 y recepciones tardías limitan producción sin consumir órdenes en tránsito',()=>{
 const economic=require('../js/engine/cierre.js'),s=state();const events={};
 for(const [sku,q,unit] of [['cuero_prem',300,'m²'],['acc_prem',1000,'unidades'],['hilo_prem',6000,'metros']]){
  const orderId='order-'+sku,id='o-'+sku;events[id]={id,type:'order',orderId,companyId:'1',sku,quantity:q,unit,unitCost:1,orderedDay:0,leadTimeDays:7};
  const receipt='r-'+sku;events[receipt]={id:receipt,type:'receipt',orderId,companyId:'1',quantity:q,day:7};
 }
 s.__materialOrders={companyId:'1',events};
 const base=economic.prepare({state:s,catalog:fixture.catalog,round:1}),shock=economic.prepare({state:s,catalog:fixture.catalog,round:1,events:[event]});
 assert.ok(shock.plan.producibleUnits<base.plan.producibleUnits);
 assert.equal(shock.plan.temporal.windows.slice(0,7).reduce((sum,window)=>sum+window.produced,0),0);
 for(const [sku,received] of [['cuero_prem',300],['acc_prem',1000],['hilo_prem',6000]])assert.ok(Math.abs(received-(shock.plan.temporal.consumedBySku[sku]||0)-(shock.plan.temporal.stockBySku[sku]||0))<1e-7,sku);
});
