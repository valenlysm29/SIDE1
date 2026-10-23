'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function bundle(html){const source=fs.readFileSync(path.join(root,html),'utf8');return [...source.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]).filter(p=>/\.(js|css)$/.test(p)&&!/^https?:/.test(p));}
test('student and teacher load only autonomous runtime, without workbook assets or visible source annotations',()=>{
 for(const page of ['index.html','docente.html']){
  const assets=bundle(page);assert.ok(assets.length>10);
  for(const file of [page,...assets]){
   const source=fs.readFileSync(path.join(root,file),'utf8');
   assert.doesNotMatch(source,/SIDE_EXCEL|engine\/|\.xlsx\b|Referencia del Excel|No definido en el Excel|CANTIDAD DE PRODUCCIÓN!/i,file);
   if(file!=='js/app.js')assert.doesNotMatch(source,/\bexcel\b/i,file);
  }
 }
});
test('materials use physical units and bounded affordable thread purchases',()=>{
 const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),ctx);
 const catalog=ctx.window.SIDE_DECISION_CATALOG,review=require('../js/decision_review_model'),production=require('../js/production_model');
 const hilo=catalog.flatMap(c=>c.items).find(i=>i.id==='HILO');
 assert.equal(production.yieldFor('HILO','hilo_std'),1);
 const cost=review.unitCost(hilo,hilo.options[0],{state:{},drafts:{},round:1});
 assert.ok(Math.abs(700*cost-64.4)<1e-8);
});
