'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const PRO=require('../js/production_model'),CYCLE=require('../js/cycle_model'),BUS=require('../js/business_rules'),REVIEW=require('../js/decision_review_model');
const {state,catalog}=require('./economic_v19_fixture.cjs');
const assetIds=['MESA_CORTE','ENSAMBLE','ACABADOS'];
function legacyState(round=1){
  const s=state(round);
  for(const id of assetIds){delete s[id].purchases;s[id].round=1;}
  return s;
}
function input(s,round=1){return {state:s,catalog,round,capital:200000};}

test('legacy physical holdings generate production and sales in their acquisition cycle and later cycles',()=>{
  for(const round of [1,2,3]){
    const s=legacyState(round),before=JSON.stringify(s),r=CYCLE.close(input(s,round));
    assert.equal(r.receipt.produced,90);assert.equal(r.receipt.sold,90);assert.equal(r.receipt.revenue,3825);
    assert.ok(r.receipt.production.processes.every(p=>p.machines>0));
    for(const [id,process] of assetIds.map((id,index)=>[id,r.receipt.production.processes[index]])){
      const definition=catalog.flatMap(c=>c.items).find(i=>i.id===id);
      assert.equal(process.machines,definition.options.reduce((sum,option)=>sum+BUS.quantity(s,id,option.id,round),0));
    }
    assert.equal(JSON.stringify(s),before);
  }
});

test('legacy option selections are recovered only without a purchase ledger and actual holdings remain authoritative',()=>{
  const s=legacyState();
  for(const id of assetIds)delete s[id].quantities;
  assert.equal(CYCLE.close(input(s)).receipt.sold,90);
  for(const id of assetIds){
    const empty=legacyState();empty[id]={round:1,quantities:{},optionIds:[]};
    assert.equal(CYCLE.close(input(empty)).receipt.sold,0,id);
    const ledger=legacyState();ledger[id].purchases={};
    assert.equal(CYCLE.close(input(ledger)).receipt.sold,0,id+' empty authoritative ledger');
  }
});

test('holdings from future cycles never supply current equipment or sales',()=>{
  for(const id of assetIds){
    const s=legacyState();s[id].round=2;
    assert.equal(CYCLE.close(input(s)).receipt.sold,0,id);
    s[id].purchases={2:{...s[id].quantities}};
    assert.equal(CYCLE.close(input(s)).receipt.sold,0,id+' future purchase ledger');
  }
});

test('purchase history overrides duplicate holdings and sums purchases and liquidations exactly once',()=>{
  const s=legacyState(3);
  s.MESA_CORTE={round:3,quantities:{mesa:999},optionIds:['mesa'],purchases:{1:{mesa:3},2:{mesa:-1},3:{mesa:2},4:{mesa:100}}};
  const plan=PRO.calculate(input(s,3));
  assert.equal(plan.processes[0].machines,4);
  assert.equal(plan.producibleUnits,90);
  const draft=PRO.calculate({...input(s,3),drafts:{MESA_CORTE:{quantities:{mesa:0}}}});
  assert.equal(draft.processes[0].machines,2);
});

test('current draft purchases add to prior legacy holdings while replacing same-cycle saved purchases',()=>{
  const s=legacyState(2);
  let plan=PRO.calculate({...input(s,2),drafts:{MESA_CORTE:{quantities:{mesa:2}}}});
  assert.equal(plan.processes[0].machines,s.MESA_CORTE.quantities.mesa+2);
  s.MESA_CORTE.round=2;
  plan=PRO.calculate({...input(s,2),drafts:{MESA_CORTE:{quantities:{mesa:2}}}});
  assert.equal(plan.processes[0].machines,2);
});

test('invalid acquisition cycles cannot create equipment, purchases, maintenance or investment costs',()=>{
  const definition=catalog.flatMap(c=>c.items).find(i=>i.id==='MESA_CORTE');
  for(const round of [undefined,null,0,-1,1.5,'bad',Infinity]){
    const s={MESA_CORTE:{round,quantities:{mesa:2},optionIds:['mesa']}};
    assert.deepEqual(PRO.assetPurchaseHistory(s.MESA_CORTE,definition),{});
    assert.equal(PRO.calculate(input(s)).processes[0].machines,0);
    assert.equal(BUS.maintenance(s,catalog,1),0);
    assert.equal(REVIEW.breakdown(definition,input(s)).outflow,0);
  }
});

test('legacy equipment review and maintenance preserve the same acquisition costs and holdings as canonical history',()=>{
  const definitions=catalog.flatMap(c=>c.items).filter(i=>i.asset);
  for(const round of [1,2]){
    const s=legacyState(round),ctx=input(s,round),canonical=JSON.parse(JSON.stringify(s));
    for(const definition of definitions)canonical[definition.id].purchases=PRO.assetPurchaseHistory(s[definition.id],definition);
    const drafts=Object.fromEntries(definitions.map(definition=>[definition.id,REVIEW.draft(definition,ctx)]));
    for(const definition of definitions){
      const before=REVIEW.breakdown(definition,ctx),expected=REVIEW.breakdown(definition,input(canonical,round));
      assert.deepEqual(before,expected);
      assert.equal(before.outflow,round===1?Object.entries(s[definition.id].quantities).reduce((sum,[id,q])=>sum+q*BUS.assetCost(definition,definition.options.find(o=>o.id===id)),0):0);
    }
    assert.equal(BUS.maintenanceEstimate({...ctx,drafts}),BUS.maintenance(s,catalog,round));
    assert.deepEqual(CYCLE.close(ctx).financial,CYCLE.close(input(canonical,round)).financial);
  }
});
