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
