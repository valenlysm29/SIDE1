'use strict';
// Functional checks with a minimal DOM double. These do not measure browser layout.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const rules=require('../side_rules');
const root=path.resolve(__dirname,'..');
function runtime(){
  const elements=new Map(),inputs=[],storage=new Map(),errors=[];
  function element(){return {innerHTML:'',textContent:'',dataset:{},style:{setProperty(){}},offsetHeight:82,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},handlers:{},
    addEventListener(type,fn){this.handlers[type]=fn},setAttribute(){},querySelector(){return element()},querySelectorAll(){return []},focus(){}};}
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    querySelector(){return null},querySelectorAll(selector){return selector==='[data-choice]'?inputs:[]},addEventListener(){}};
  const context=vm.createContext({document,console:{log(){},warn(){},error(...args){errors.push(args)}},
    setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame(){},
    ResizeObserver:class{observe(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size}}});
  context.window=context;context.addEventListener=()=>{};context.scrollTo=()=>{};
  for(const name of ['side_rules.js','decision_catalog.js','production_model.js','decision_review_model.js','app.js','company_summary.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
  const run=code=>vm.runInContext(code,context);
  // Peripheral effects are outside these tests; all selection/save/calculation handlers are real.
  run('updateHud=()=>{};updateSectionCost=()=>{};syncStudentReportPreview=()=>{};animateCash=()=>{};syncStudentTimer=()=>{};');
  for(const id of ['web',...rules.STORE_IDS]){const input=element();input.dataset={choice:'CANALES',option:id};input.checked=true;inputs.push(input);}
  run("currentCategory='D';bindDecisionControls();");
  return {run,elements,errors,select(id){inputs.find(i=>i.dataset.option===id).handlers.change();},json:code=>JSON.parse(JSON.stringify(run(code)))};
}
test('current store selection normalizes duplicates without mutating legacy data',()=>{
  const legacy={optionIds:['web','los_olivos','miraflores'],quantities:{los_olivos:4,miraflores:2},storeContracts:{los_olivos:[{round:1,quantity:4}],miraflores:[{round:2,quantity:2}]}};
  const before=JSON.stringify(legacy),single=rules.singleStoreSelection(legacy,3);
  assert.deepEqual(single.optionIds,['web','los_olivos']);assert.equal(rules.storeCount(single),1);
  assert.deepEqual(single.storeContracts.los_olivos,[{round:1,quantity:1}]);assert.equal(JSON.stringify(legacy),before);
});
test('selectable store options replace one another, keep web, and update prices',()=>{
  const r=runtime();r.select('web');
  for(const [id,cost] of [['los_olivos',1800],['miraflores',3500],['sjl',2200]]){
    r.select(id);assert.deepEqual(r.json('channelDraft().optionIds'),['web',id]);
    assert.equal(r.run('RULES.storeCount(channelDraft())'),1);
    assert.equal(r.run("computeItemCost(findDecisionItem('CANALES'))"),cost+500);
  }
  const html=r.run("renderChannelChoices(findDecisionItem('CANALES'),false)");
  assert.equal((html.match(/type="radio"/g)||[]).length,3);
  assert.doesNotMatch(html,/data-store-qty|data-store-step|type="number"/);
  assert.deepEqual(r.errors,[]);
});
test('single-store draft saves and reloads with one charge and one basic seller',()=>{
  const r=runtime();r.select('miraflores');
  assert.equal(r.run('saveCurrentSection()'),true);
  assert.equal(r.run('cashBalance()'),96500);
  assert.equal(r.run('saveCurrentSection()'),true);assert.equal(r.run('cashBalance()'),96500);
  r.run('loadDecisionState();restoreDraftsForRound();');
  assert.deepEqual(r.json('channelDraft().quantities'),{miraflores:1});
  assert.match(r.run("renderDecisionRow(findDecisionItem('PERSONAL_VENTAS'))"),/1 vendedor/);
  assert.deepEqual(r.errors,[]);
});
test('existing contract prevents switching district in a later cycle',()=>{
  const r=runtime();r.select('los_olivos');r.run('saveCurrentSection();');
  r.run("localStorage.setItem('SIDE_ACTIVE_ROUND','2');loadDecisionState();restoreDraftsForRound();");
  r.select('sjl');assert.deepEqual(r.json('channelDraft().optionIds'),['los_olivos']);
  assert.equal(r.run('validateChannelQuantities()'),true);
});
test('DOP renders once in Production and nowhere in the other categories or summary',()=>{
  const r=runtime();
  for(const cat of ['B','C','F','D','E','A']){
    r.run(`currentCategory='${cat}';renderDecisionCategory();`);
    const html=r.elements.get('decisionCards').innerHTML;
    assert.equal((html.match(/class="production-dop /g)||[]).length,cat==='C'?1:0,cat);
  }
  assert.doesNotMatch(r.run('productionSummaryHtml(liveCompanyReview())'),/class="production-dop /);
  assert.deepEqual(r.errors,[]);
});
test('original DOP handles empty, zero and valid targets and updates from active drafts',()=>{
  const r=runtime();
  assert.match(r.run('productionDopHtml()'),/Aún no hay producción para mostrar/);
  r.run(`decisionDrafts={MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_ind:1}},ACABADOS:{quantities:{aca_ind:1}},PERS_CORTE:{quantities:{corte_maestro:1}},PERS_ENSAMBLE:{quantities:{ens_personal_esp:1}},PERS_ACABADO:{quantities:{aca_personal_art:1}},JEFATURA:{optionIds:['si_jefatura']},MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:100}},CUERO:{quantities:{cuero_sint:30}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:3}}};`);
  assert.equal(r.run('productionPlan().producibleUnits'),100);
  assert.match(r.run('productionDopHtml()'),/<strong>100%<\/strong>/);
  r.run('decisionDrafts.CUERO.quantities.cuero_sint=15;');
  assert.equal(r.run('productionPlan().producibleUnits'),50);
  assert.match(r.run('productionDopHtml()'),/<strong>50%<\/strong>/);
  r.run('decisionDrafts.PRODUCCION_META.moldTargets.molde_1=0;');
  assert.doesNotMatch(r.run('productionDopHtml()'),/NaN|Infinity/);
  assert.match(r.run('productionDopHtml()'),/Aún no hay producción para mostrar/);
  r.run("localStorage.setItem('SIDE_ACTIVE_ROUND','2');decisionDrafts={};");
  assert.equal(r.run('productionPlan().target'),0);
});
