'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function runtime({blocked=false,locked=false,canOperate=true,cycleLocked=false,storageReadFailure=false,failure=false,missingCategory=false}={}){
  const store=new Map(),feedback={textContent:'',dataset:{}},handlers={};
  const item={id:'MOLDE'},other={id:'LOCAL'};
  const button={dataset:{saveItemDraft:'MOLDE'},addEventListener:(event,handler)=>handlers[event]=handler,closest:()=>({querySelector:()=>feedback})};
  const financial={decisions:{MOLDE:{optionIds:[]}},ledger:{initial:100000},purchases:[],submitted:[]};
  let writes=0;
  const context=vm.createContext({
    document:{querySelectorAll:selector=>selector==='[data-save-item-draft]'?[button]:[]},
    findDecisionItem:id=>id==='MOLDE'?item:null,
    decisionEditingBlocked:()=>blocked,isLocked:()=>locked,studentAccess:()=>({canOperate}),cycleDecisionsLocked:()=>{if(storageReadFailure)throw new Error('SecurityError');return cycleLocked;},
    categoryByCat:()=>missingCategory?null:{items:[item,other]},currentCategory:'A',currentRound:()=>1,
    storageKey:()=> 'QA_LOCAL',deepClone:value=>JSON.parse(JSON.stringify(value)),
    decisionDrafts:{MOLDE:{optionIds:['molde_1']},LOCAL:{optionIds:['local_1']}},financial,
    localStorage:{getItem:key=>store.get(key)||null,setItem(key,value){if(failure)throw new Error('QuotaExceededError');writes++;store.set(key,value)}},
    saveCurrentSection(){throw new Error('El borrador por ítem no debe comprar ni debitar');},
    submitAllDecisions(){throw new Error('El borrador por ítem no debe enviar');}
  });
  vm.runInContext(source.slice(source.indexOf('function persistCurrentDraftOnly(){'),source.indexOf('function restoreDraftsForRound(){')),context);
  vm.runInContext(source.slice(source.indexOf('function bindDecisionControls(){'),source.indexOf('function changeQty(')),context);
  vm.runInContext('bindDecisionControls()',context);
  return {click:()=>handlers.click(),feedback,store,context,writes:()=>writes,financial};
}
test('guardar por ítem conserva el borrador de la sección sin compras, débitos o envío',()=>{
  const r=runtime(),before=JSON.stringify(r.financial);
  r.click();
  assert.deepEqual(JSON.parse(r.store.get('SIDE_DECISION_DRAFTS_QA_LOCAL_1')),{A:{MOLDE:{optionIds:['molde_1']},LOCAL:{optionIds:['local_1']}}});
  assert.equal(JSON.stringify(r.financial),before);
  assert.equal(r.writes(),1);
  assert.match(r.feedback.textContent,/Borrador local guardado; pendiente de envío/);
  assert.equal(r.feedback.dataset.state,'saved');
});
test('quota fallida mantiene la edición y muestra error sin afirmar un recibo',()=>{
  const r=runtime({failure:true}),drafts=JSON.stringify(r.context.decisionDrafts),before=JSON.stringify(r.financial);
  assert.doesNotThrow(r.click);
  assert.equal(r.writes(),0);assert.equal(JSON.stringify(r.context.decisionDrafts),drafts);assert.equal(JSON.stringify(r.financial),before);
  assert.equal(r.feedback.dataset.state,'error');assert.match(r.feedback.textContent,/No se pudo guardar/);assert.doesNotMatch(r.feedback.textContent,/guardado; pendiente/);
});
test('falta de sección no se presenta como guardado correcto',()=>{
  const r=runtime({missingCategory:true});r.click();assert.equal(r.writes(),0);assert.equal(r.feedback.dataset.state,'error');
});
test('error de lectura de almacenamiento en las guardas da feedback sin lanzar al navegador',()=>{
  const r=runtime({storageReadFailure:true}),before=JSON.stringify(r.financial);
  assert.doesNotThrow(r.click);assert.equal(r.writes(),0);assert.equal(JSON.stringify(r.financial),before);assert.equal(r.feedback.dataset.state,'error');
});
test('sección enviada, ciclo bloqueado, falta de acceso o ítem bloqueado no escriben el borrador',()=>{
  for(const condition of [{blocked:true},{locked:true},{cycleLocked:true},{canOperate:false}]){
    const r=runtime(condition),before=JSON.stringify(r.financial);r.click();assert.equal(r.writes(),0);assert.equal(JSON.stringify(r.financial),before);assert.equal(r.feedback.textContent,'');
  }
});
