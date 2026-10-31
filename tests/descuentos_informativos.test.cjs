'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const REVIEW=require('../js/decision_review_model'),{catalog}=require('./economic_v19_fixture.cjs'),RULES=require('../js/side_rules');
const item=catalog.flatMap(c=>c.items).find(i=>i.id==='HILO'),option=item.options.find(o=>o.id==='hilo_std');
function ctx(quantity,analyst=false,round=1,materials={}){return {catalog,rules:RULES,round,state:{},config:{materials},drafts:{HILO:{quantities:{hilo_std:quantity}},ANALISTA_COMPRAS:{optionIds:[analyst?'si_analista':'no_analista']}}};}
function close(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)}
test('commercial and analyst savings reconcile with the official decision cost',()=>{
 for(const round of [1,2,3,6,12])for(const analyst of [false,true])for(const quantity of [0,99,100,12000]){
  const c=ctx(quantity,analyst,round),b=REVIEW.materialBreakdown(item,option,c);
  close(b.gross,quantity*2);close(b.total,REVIEW.breakdown(item,c).outflow);close(b.gross-b.commercial-b.analystSaving,b.total);
  close(b.commercial,quantity>=100?b.gross*.08:0);close(b.analystRate,analyst?Math.max(2,12-2*(round-1)):0);
  close(b.analystSaving,(b.gross-b.commercial)*b.analystRate/100);
 }
});
test('quantity changes and room settings control commercial discount',()=>{
 const c=ctx(100,false,1,{quantityDiscountThreshold:200,quantityDiscountRate:.05});
 assert.equal(REVIEW.materialBreakdown(item,option,c).commercial,0);
 c.drafts.HILO.quantities.hilo_std=200;const b=REVIEW.materialBreakdown(item,option,c);close(b.commercial,20);close(b.total,380);
});
test('saved state and reloaded state preserve the same calculation',()=>{
 const c=ctx(12000,true,2);const before=REVIEW.materialBreakdown(item,option,c);
 const restored={...c,drafts:undefined,state:{HILO:{round:2,quantities:{hilo_std:12000}},ANALISTA_COMPRAS:{optionIds:['si_analista']}}};
 assert.deepEqual(REVIEW.materialBreakdown(item,option,restored),before);
});
test('confirmed cycle records the same material cost once',()=>{
 const cycle=require('../js/cycle_model.js'),{state}=require('./economic_v19_fixture.cjs');
 for(const analyst of [false,true]){
  const saved=state(1);saved.HILO={round:1,quantities:{hilo_std:12000},optionIds:['hilo_std']};saved.ANALISTA_COMPRAS={round:1,optionIds:[analyst?'si_analista':'no_analista']};
  const c={catalog,rules:RULES,round:1,state:saved,drafts:{},config:{},capital:200000,ledger:{}};
  const b=REVIEW.materialBreakdown(item,option,c),section=REVIEW.section(catalog.find(x=>x.cat==='F'),c);
  close(section.items.find(x=>x.id==='HILO').outflow,b.total);
  const sectionsByRound={1:{F:{...section,recordedNet:section.net}}},ledger={'1:F':section.net};
  const result=cycle.close({state:saved,catalog,round:1,capital:200000,sectionsByRound,ledger});
  close(result.ledger['1:F'],section.net);assert.equal(cycle.close({state:result.state,catalog,round:1,capital:200000,sectionsByRound,ledger:result.ledger}).reused,true);
 }
});
