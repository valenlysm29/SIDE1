'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../js/production_model'),dop=require('../js/production_dop');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('js/decision_catalog.js','utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));
const ctx=targets=>({catalog,state:{__inventarioMP:{},cash:1000},drafts:{PRODUCCION_META:{moldTargets:targets}},round:1});
const render=c=>dop.render(model.calculate(c),{round:1});
test('10 básicos sin recursos',()=>{const c=ctx({molde_1:10}),p=model.calculate(c),h=dop.render(p);assert.equal(p.producibleUnits,0);for(const text of ['3 m²','10 unidades','60 metros','10 juegos de piezas','10 bolsos','PRODUCCIÓN FINAL PROYECTADA'])assert.ok(h.includes(text),text);assert.doesNotMatch(h,/Sin compra registrada|operario\(s\)|PORCENTAJE PRODUCIDO|EFICIENCIA DE LA LÍNEA/)});
test('100 prémium y receta',()=>{const h=render(ctx({molde_3:100}));for(const t of ['70 m²','100 unidades','1,300 metros'])assert.ok(h.includes(t),t)});
test('metas combinadas y cambio de cantidad',()=>{const c=ctx({molde_1:10,molde_3:100});let h=render(c);assert.match(h,/Molde básico: 10 u\./);assert.match(h,/Molde premium: 100 u\./);c.drafts.PRODUCCION_META.moldTargets.molde_3=20;h=render(c);assert.match(h,/Molde básico: 10 u\./);assert.match(h,/Molde premium: 20 u\./);assert.match(h,/30 unidades totales/)});
test('la representación no altera estado ni resultados reales',()=>{const c=ctx({molde_1:10}),before=JSON.stringify(c),p=model.calculate(c),snapshot=JSON.stringify(p);dop.render(p);assert.equal(JSON.stringify(c),before);assert.equal(JSON.stringify(p),snapshot);assert.deepEqual(model.calculate(c),p)});

