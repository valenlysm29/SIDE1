'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const PRO=require('../js/production_model'),CYCLE=require('../js/cycle_model'),REVIEW=require('../js/decision_review_model');
const {state,catalog}=require('./economic_v19_fixture.cjs');
const item=catalog.flatMap(c=>c.items).find(i=>i.id==='PRODUCCION_META');
const context=s=>({state:s,catalog,round:1,capital:200000});

test('saved numeric production targets use the chosen mold and generate sales in every segment',()=>{
  for(const [index,mold] of ['molde_1','molde_2','molde_3'].entries()){
    const s=state();s.MOLDE={round:1,optionIds:[mold]};s.PRODUCCION_META={round:1,value:90};
    const ctx=context(s),before=JSON.stringify(s),result=CYCLE.close(ctx);
    assert.equal(result.receipt.produced,90,mold);assert.equal(result.receipt.sold,90,mold);
    assert.equal(result.receipt.sales[index].sold,90);
    assert.equal(result.receipt.revenue,90*[42.5,100,250][index]);
    assert.deepEqual(REVIEW.draft(item,ctx).moldTargets,PRO.resolveProductionTargets(ctx));
    assert.equal(JSON.stringify(s),before);
  }
});

test('numeric plans honor an explicit mold, recover previous purchases, and ignore invalid mold ids',()=>{
  const s=state();s.MOLDE={round:1,optionIds:['molde_3']};s.PRODUCCION_META={round:1,value:90,moldId:'molde_2'};
  assert.equal(PRO.resolveProductionTargets(context(s)).molde_2,90);
  s.PRODUCCION_META.moldId='unknown';assert.equal(PRO.resolveProductionTargets(context(s)).molde_3,90);
  s.MOLDE={round:1,optionIds:[],purchases:{1:{molde_2:1}}};s.PRODUCCION_META={round:2,value:90};
  const ctx={...context(s),round:2};assert.equal(PRO.resolveProductionTargets(ctx).molde_2,90);
  s.PRODUCCION_META.round=1;assert.equal(Object.values(PRO.resolveProductionTargets(ctx)).reduce((a,b)=>a+b,0),0);
});

test('current drafts and explicit per-mold zero plans take precedence over legacy values',()=>{
  const s=state();s.PRODUCCION_META={round:1,value:90,moldTargets:{molde_1:0,molde_2:0,molde_3:0}};
  assert.deepEqual(PRO.resolveProductionTargets(context(s)),{molde_1:0,molde_2:0,molde_3:0});
  const ctx={...context(s),drafts:{PRODUCCION_META:{value:20},MOLDE:{optionIds:['molde_2']}}};
  assert.deepEqual(PRO.resolveProductionTargets(ctx),{molde_1:0,molde_2:20,molde_3:0});
  assert.deepEqual(REVIEW.draft(item,ctx).moldTargets,PRO.resolveProductionTargets(ctx));
  assert.equal(PRO.calculate(ctx).producibleUnits,20);
});

test('numeric and text cycle identifiers preserve identical material consumption, sales and remaining stock',()=>{
  const numeric=state(),text=JSON.parse(JSON.stringify(numeric));
  for(const entry of Object.values(text))if(entry&&typeof entry==='object'&&entry.round)entry.round=String(entry.round);
  const a=CYCLE.close(context(numeric)),b=CYCLE.close(context(text));
  assert.equal(b.receipt.sold,a.receipt.sold);
  assert.equal(b.receipt.revenue,a.receipt.revenue);
  assert.deepEqual(b.receipt.reputation,a.receipt.reputation);
  assert.deepEqual(b.state.__inventarioMP,a.state.__inventarioMP);
  assert.deepEqual(b.financial,a.financial);
});

test('a current-cycle mold purchase remains available when synchronized optionIds are missing',()=>{
  const s=state();
  s.MOLDE={round:1,optionIds:[],purchases:{1:{molde_1:1}}};
  const result=CYCLE.close(context(s));
  assert.equal(result.receipt.produced,90);
  assert.equal(result.receipt.sold,90);
  assert.equal(result.receipt.revenue,3825);
  assert.deepEqual(result.receipt.production.unavailablePlannedMolds,[]);
  const draftPlan=PRO.calculate({...context(s),drafts:{MOLDE:{optionIds:[]}}});
  assert.equal(draftPlan.producibleUnits,0);
});
