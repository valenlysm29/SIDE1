'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../js/production_model'),dop=require('../js/production_dop');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('js/decision_catalog.js','utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));
const context=targets=>({catalog,state:{__inventarioMP:{},cash:1000},drafts:{PRODUCCION_META:{moldTargets:targets}},round:1});
test('la meta sin recursos calcula materiales y recursos suficientes sin modificar el estado',()=>{
 const c=context({molde_1:20}),before=JSON.stringify(c),p=model.calculate(c),h=dop.render(p),r=model.planResources(p.target);
 assert.equal(p.producibleUnits,0);assert.deepEqual(p.materials.map(m=>m.neededForTarget),[6,20,120]);
 assert.ok(r.processes.every(x=>x.workers===1&&x.machines===1&&x.cycleCapacity>=20));
 for(const s of ['6 m²','20 juegos de piezas','20 accesorios','20 unidades totales','1 mesas','1 máquinas básicas'])assert.ok(h.includes(s),s);
 assert.equal(JSON.stringify(c),before);
});
test('prémium, metas grandes y tres moldes comparten una línea suficiente y actualizada',()=>{
 const c=context({molde_1:20,molde_2:50,molde_3:100});let p=model.calculate(c);
 assert.deepEqual(p.materials.map(m=>m.neededForTarget),[96,170,1770]);
 let r=model.planResources(p.target);assert.ok(r.processes.every(x=>x.cycleCapacity>=170&&x.workers===2&&x.machines===2));
 c.drafts.PRODUCCION_META.moldTargets={molde_3:100};p=model.calculate(c);
 assert.deepEqual(p.materials.map(m=>m.neededForTarget),[70,100,1300]);assert.match(dop.render(p),/100 unidades totales/);
 r=model.planResources(10000);assert.ok(r.processes.every(x=>x.cycleCapacity>=10000&&x.workers>1&&x.machines===x.workers));
});


test('DOP compares recommended, available and missing resources without changing the target',()=>{
 const c=context({molde_1:2000}),p=model.calculate(c),before=JSON.stringify(p),html=dop.render(p);
 assert.match(html,/<th>Disponible<\/th><th>Faltante<\/th>/);
 assert.match(html,/<th>Cuero<\/th><td>600 m²<\/td><td>0 m²<\/td><td>600 m²<\/td>/);
 assert.match(html,/<th>Molde básico<\/th><td>1<\/td><td>0<\/td><td>1<\/td>/);
 assert.match(html,/Faltante referencial/);
 assert.match(html,/Los faltantes no impiden guardar ni enviar tu meta/);
 assert.equal(JSON.stringify(p),before);
});


test('closing keeps a 2000-unit decision and produces only the 500 supported by stock',()=>{
 const fixture=require('./economic_v19_fixture.cjs'),cycle=require('../js/cycle_model.js');
 const state=fixture.state();state.PRODUCCION_META.moldTargets={molde_1:2000};
 state.CUERO.quantities={cuero_sint:150};state.ACCESORIOS.quantities={acc_eco:500};state.HILO.quantities={hilo_std:3000};
 const before=JSON.stringify(state),result=cycle.close({state,catalog:fixture.catalog,round:1,capital:200000});
 assert.equal(result.receipt.production.target,2000);
 assert.equal(result.receipt.produced,500);
 assert.equal(result.receipt.production.productLines[0].target,2000);
 for(const material of result.receipt.production.materials){assert.ok(material.consumption<=material.available);assert.ok(material.remaining>=0);}
 assert.equal(JSON.stringify(state),before);
});
