'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function bundle(html){const source=fs.readFileSync(path.join(root,html),'utf8');return [...source.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]).filter(p=>/\.(js|css)$/.test(p)&&!/^https?:/.test(p));}
test('student and teacher load the current UI with explicit shared calculation dependencies',()=>{
 for(const page of ['index.html','docente.html']){
  const assets=bundle(page);assert.ok(assets.length>10);
  for(const file of assets)assert.ok(fs.existsSync(path.join(root,file)),file+' exists');
  assert.ok(assets.includes('js/cycle_model.js'));assert.ok(assets.includes('js/revenue_model.js'));
  assert.ok(assets.includes('js/engine/mercado.js'),'shared demand calculation is delivered');
  assert.ok(assets.includes('js/engine/costos.js'),'shared operating reputation calculation is delivered');
  assert.ok(!assets.includes('js/engine/ui_excel.js'),'legacy editor is not loaded');
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.doesNotMatch(html,/excelProductionMount|Referencia del Excel|No definido en el Excel|CANTIDAD DE PRODUCCIÓN!/i);
 }
 const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),ctx);
 assert.doesNotMatch(JSON.stringify(ctx.window.SIDE_DECISION_CATALOG),/SIDE_EXCEL|\.xlsx\b|Referencia del Excel|No definido en el Excel|CANTIDAD DE PRODUCCIÓN!/i,'visible catalog has no workbook source annotations');
});

test('materials use physical units and bounded affordable thread purchases',()=>{
 const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),ctx);
 const catalog=ctx.window.SIDE_DECISION_CATALOG,review=require('../js/decision_review_model'),production=require('../js/production_model');
 const hilo=catalog.flatMap(c=>c.items).find(i=>i.id==='HILO');
 assert.equal(production.yieldFor('HILO','hilo_std'),1);
 const noVolume={state:{},drafts:{HILO:{quantities:{hilo_std:10}}},round:1},volume={state:{},drafts:{HILO:{quantities:{hilo_std:700}}},round:1};
 assert.equal(review.breakdown(hilo,noVolume).outflow,20);
 assert.ok(Math.abs(review.breakdown(hilo,volume).outflow-1288)<1e-8);
});
