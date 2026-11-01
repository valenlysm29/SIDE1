'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../js/engine/cierre.js'),F=require('./economic_v19_fixture.cjs');
function close(materials,version){
 const state=F.state(1,{},2);
 for(const [family,sku,qty] of materials)state[family].quantities={[sku]:qty};
 return E.closeMany([{id:'a',state,catalog:F.catalog,round:1,prices:{premium:250},financialPolicy:version?{economicRulesVersion:version}:{}}]).a;
}
const cheap=[['CUERO','cuero_sint',63],['ACCESORIOS','acc_eco',90],['HILO','hilo_std',1170]];
const premium=[['CUERO','cuero_prem',63],['ACCESORIOS','acc_prem',90],['HILO','hilo_prem',1170]];
test('la adaptación conserva el Excel antiguo y exige materiales prémium trazables para CONS-02',()=>{
 const old=close(cheap),modern=close(cheap,'utility-v1'),high=close(premium,'utility-v1');
 const sale=r=>r.sales.find(x=>x.id==='premium');
 assert.equal(sale(old).lots[0].quality,7);assert.equal(sale(old).price,350);
 assert.equal(sale(modern).lots[0].quality,7);assert.equal(sale(modern).price,250);assert.ok(!modern.messages.some(m=>m.id==='CONS-02'));
 assert.equal(sale(high).price,350);assert.ok(high.messages.some(m=>m.id==='CONS-02'));
 assert.equal(sale(modern).revenue,sale(modern).sold*250);
});
test('lote histórico sin composición no recibe nueva bonificación',()=>{
 const state=F.state(1,{},2);state.PRODUCCION_META.moldTargets={};state.__finishedGoods={premium:10};state.__economicHistory={goodsQuality:{premium:8}};
 const r=E.closeMany([{id:'a',state,catalog:F.catalog,round:1,prices:{premium:250},financialPolicy:{economicRulesVersion:'utility-v1'}}]).a;
 assert.equal(r.sales.find(x=>x.id==='premium').price,250);assert.ok(!r.messages.some(m=>m.id==='CONS-02'));
});
