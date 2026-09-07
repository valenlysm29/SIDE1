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
