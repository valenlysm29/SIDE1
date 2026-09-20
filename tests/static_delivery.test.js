'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');

function localReferences(file){
  const html=fs.readFileSync(path.join(root,file),'utf8'),refs=[];
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const value=match[1].split('?')[0];
    if(!value||value.startsWith('http')||value.startsWith('#')||value.startsWith('data:'))continue;
    refs.push(value);
  }
  return refs;
}

test('all local HTML assets exist',()=>{
  for(const file of ['index.html','docente.html','tutorial.html'])for(const reference of localReferences(file))assert.equal(fs.existsSync(path.join(root,reference)),true,`${file}: ${reference}`);
});

test('market-segment decision is absent from the active catalog',()=>{
  const catalog=fs.readFileSync(path.join(root,'decision_catalog.js'),'utf8');
  assert.doesNotMatch(catalog,/id:'SEGMENTO'|name:'Segmento de mercado'/);
});

test('production model loads before the application and review modules',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.indexOf('production_model.js')<html.indexOf('decision_review_model.js'));
  assert.ok(html.indexOf('production_model.js')<html.indexOf('app.js'));
});

test('productive catalog requires a mold and a sales channel, with calculator first',()=>{
  const source=fs.readFileSync(path.join(root,'decision_catalog.js'),'utf8'),sandbox={window:{}};
  require('node:vm').runInNewContext(source,sandbox);
  const catalog=sandbox.window.SIDE_DECISION_CATALOG,items=catalog.flatMap(category=>category.items||[]),production=catalog.find(category=>category.cat==='C'),logistics=catalog.find(category=>category.cat==='F');
  assert.ok(logistics, 'Logistics category must exist');
  assert.equal(logistics.items.filter(item=>item.material).map(item=>item.id).join(','),'CUERO,ACCESORIOS,HILO');
  assert.ok(!production.items.some(item=>['ANALISTA_COMPRAS','CUERO','ACCESORIOS','HILO','GARANTIA_PROV'].includes(item.id)));
  assert.equal(items.find(item=>item.id==='MOLDE').required,true);
  assert.equal(items.find(item=>item.id==='CANALES').minSelections,1);
  assert.equal(production.items[0].id,'PRODUCCION_META');
  assert.equal(production.items[0].type,'production-plan');
});

test('cycle zero places summary last and later cycles place it first',()=>{
  const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(source,/currentRound\(\)<=1\?\[\.\.\.decisions,\.\.\.\(summary\?\[summary\]:\[\]\)\]/);
  assert.match(source,/round>1\?'A':navigationCategories\(\)\[0\]\?\.cat/);
});

test('DOP presentation loads before the app and keeps the documented cycle',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const dop=fs.readFileSync(path.join(root,'production_dop.js'),'utf8');
  assert.ok(html.indexOf('production_dop.js')<html.indexOf('app.js'));
  for(const label of ['MATERIA PRIMA PRINCIPAL','MATERIA PRIMA SECUNDARIA','Corte de piezas','Clasificación','Preparación','Ensamblado y colocación de accesorios','Acabado final','PORCENTAJE PRODUCIDO','PRODUCCIÓN FINAL DEL CICLO','Tabla de resumen'])assert.ok(dop.includes(label),label);
  assert.doesNotMatch(dop,/Inspección final/);
  assert.match(dop,/<td>Operaciones<\/td><td>2<\/td>/);
  assert.match(dop,/<td>Inspecciones<\/td><td>1<\/td>/);
  assert.match(dop,/<td>Combinadas<\/td><td>2<\/td>/);
  assert.match(dop,/<th>Total<\/th><th>5<\/th>/);
});

test('infrastructure, production and logistics drafts remain saveable over budget',()=>{
  const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(source,/saveDecisionSection'\)\.disabled=locked;/);
  assert.match(source,/const affordable=cashBalance\(\)-old\+plan\.net>=-0\.005;/);
  assert.match(source,/const ledger=affordable\?\{\.\.\.cashLedger,\[key\]:plan\.net\}:\{\.\.\.cashLedger\};/);
  assert.match(source,/Borrador guardado\. Ajusta el presupuesto antes de enviar la decisión\./);
});
