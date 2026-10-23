'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/company_summary.js'),'utf8');
const commit=source.slice(source.indexOf('function commitReviewedSections('),source.indexOf('function summaryStatus('));
function fixture({failedWrite=false,explorable=true}={}){
  const store=new Map(),events=[],tasks=[],cats=['B','C'].map(cat=>({cat,short:cat,items:[]}));
  const ctx={console,reviewCommitBusy:false,decisionState:{},cashLedger:{},decisionDrafts:{},currentStudent:{company:'QA',game:{codigo:'SIDE-1234'}},
    studentAccess:()=>({canOperate:true}),decisionsSubmitted:()=>store.get('all')==='1',liveCompanyReview:()=>({context:{drafts:{}}}),reviewProblems:()=>[],decisionCategories:()=>cats,
    sectionSubmitted:cat=>store.get(cat)==='1',prepareSectionSave:cat=>({cat:cat.cat,entries:{},net:-10,model:{}}),deepClone:structuredClone,readReviewReceipts:()=>({}),
    storageKey:()=> 'QA',currentRound:()=>1,localStorage:{getItem:key=>store.get(key)||null},sectionLedgerKey:cat=>cat,categoryByCat:cat=>cats.find(c=>c.cat===cat),
    sectionSubmissionKey:cat=>cat,submissionKey:()=> 'all',decisionKey:()=> 'state',ledgerKey:()=> 'ledger',receiptKey:()=> 'receipts',
    writeDecisionBatch:writes=>{if(failedWrite)return false;events.push('persist');Object.entries(writes).forEach(([k,v])=>store.set(k,v));return true;},
    ledgerTotal:()=>0,restoreDraftsForRound(){},captureCyclePlan(){},closeCompanyReview:()=>events.push('close'),syncReportToSupabase(){},syncStudentReportPreview(){},
    animateCash(){},renderTabs(){},renderDecisionCategory(){},updateHud(){},toast(){},queueMicrotask:fn=>tasks.push(fn),
    simulationSubmissionComplete:()=>cats.every(c=>store.get(c.cat)==='1'),canExploreWorld:()=>explorable,playerIsDeciding:true,
    requestWorldEntry:()=>events.push('world')};
  vm.createContext(ctx);vm.runInContext(commit,ctx);
  return {ctx,events,async drain(){tasks.splice(0).forEach(fn=>fn());await Promise.resolve();await Promise.resolve();}};
}
test('confirmed remote plan enters the durable snapshot queue even if report rendering fails',()=>{
  const f=fixture();f.ctx.currentStudent.empresaId=42;
  f.ctx.captureCyclePlan=()=>{f.ctx.decisionState.__cyclePlans={1:{state:{confirmed:true},production:{producibleUnits:10}}};};
  f.ctx.buildStudentSnapshot=()=>({decision_state:structuredClone(f.ctx.decisionState)});
  let queued;f.ctx.queueStudentSnapshot=snapshot=>{queued=snapshot;};
  f.ctx.syncStudentReportPreview=()=>{throw Error('optional report failed');};
  f.ctx.console={error(){}};
  assert.equal(f.ctx.commitReviewedSections(['B','C'],true),true);
  assert.equal(queued.decision_state.__cyclePlans[1].production.producibleUnits,10);
});
test('the final individual section enters the world after the whole batch is saved',async()=>{
  const f=fixture();assert.equal(f.ctx.commitReviewedSections(['B'],false),true);await f.drain();assert.deepEqual(f.events,['persist']);
  assert.equal(f.ctx.commitReviewedSections(['C'],false),true);await f.drain();assert.deepEqual(f.events,['persist','persist','close','world']);assert.equal(f.ctx.playerIsDeciding,false);
});
test('send all enters automatically once and duplicate confirmation cannot charge again',async()=>{
  const f=fixture();assert.equal(f.ctx.commitReviewedSections(['B','C'],true),true);await f.drain();assert.equal(f.events.at(-1),'world');
  assert.equal(f.ctx.commitReviewedSections(['B','C'],true),false);await f.drain();assert.equal(f.events.filter(e=>e==='world').length,1);assert.equal(f.events.filter(e=>e==='persist').length,1);
});
test('failed persistence and a cycle paused before entry never open the world',async()=>{
  const failed=fixture({failedWrite:true});assert.equal(failed.ctx.commitReviewedSections(['B','C'],true),false);await failed.drain();assert.deepEqual(failed.events,[]);
  const paused=fixture({explorable:false});assert.equal(paused.ctx.commitReviewedSections(['B','C'],true),true);await paused.drain();assert.equal(paused.events.includes('world'),false);
});
