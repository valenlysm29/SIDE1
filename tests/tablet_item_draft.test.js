'use strict';
// Regression coverage for the section draft used by the tablet.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function runtime({failure=false,missingCategory=false}={}){
  const store=new Map();
  const context=vm.createContext({
    categoryByCat:()=>missingCategory?null:{items:[{id:'MOLDE'},{id:'LOCAL'}]},currentCategory:'B',currentRound:()=>1,
    storageKey:()=> 'QA_LOCAL',deepClone:value=>JSON.parse(JSON.stringify(value)),
    decisionDrafts:{MOLDE:{optionIds:['molde_1']},LOCAL:{optionIds:['local_1']}},
    localStorage:{getItem:key=>store.get(key)||null,setItem(key,value){if(failure)throw new Error('QuotaExceededError');store.set(key,value)}}
  });
  vm.runInContext(source.slice(source.indexOf('function persistCurrentDraftOnly(){'),source.indexOf('function restoreDraftsForRound(){')),context);
  return {save:()=>vm.runInContext('persistCurrentDraftOnly()',context),store,context};
}
test('el borrador conserva juntas todas las decisiones del segmento',()=>{
  const r=runtime();assert.equal(r.save(),true);
  assert.deepEqual(JSON.parse(r.store.get('SIDE_DECISION_DRAFTS_QA_LOCAL_1')),{B:{MOLDE:{optionIds:['molde_1']},LOCAL:{optionIds:['local_1']}}});
});
test('el borrador de otro segmento se conserva',()=>{
  const r=runtime();r.store.set('SIDE_DECISION_DRAFTS_QA_LOCAL_1',JSON.stringify({F:{CUERO:{quantities:{cuero:10}}}}));
  r.save();assert.deepEqual(JSON.parse(r.store.get('SIDE_DECISION_DRAFTS_QA_LOCAL_1')).F,{CUERO:{quantities:{cuero:10}}});
});
test('un error de almacenamiento conserva las decisiones editables',()=>{
  const r=runtime({failure:true}),before=JSON.stringify(r.context.decisionDrafts);
  assert.throws(r.save,/QuotaExceededError/);assert.equal(r.store.size,0);assert.equal(JSON.stringify(r.context.decisionDrafts),before);
});
test('sin segmento no se afirma un guardado correcto',()=>{
  const r=runtime({missingCategory:true});assert.equal(r.save(),false);assert.equal(r.store.size,0);
});
