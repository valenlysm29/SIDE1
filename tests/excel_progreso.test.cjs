
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
function runtime(){
 const elements=new Map(),storage=new Map(),items=[{id:'one'},{id:'two'}],done=new Set();let reviews=0,round=1;
 const categories=['B','C','D','E','F'].map(cat=>({cat,title:cat,items}));
 const element=()=>({textContent:'',innerHTML:'',disabled:false,style:{},classList:{add(){},remove(){},toggle(){}},closest:()=>({setAttribute(){}})});
 const ctx={publishWorldAtmosphere(){},localStorage:{getItem:k=>storage.get(k)||null},submissionKey:()=>`all:${round}`,sectionSubmissionKey:cat=>`${round}:${cat}`,currentRound:()=>round,decisionState:{__excel:{habilitado:true,round:1,enviado:true}},updateCashHud(){},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},decisionCategories:()=>categories,requiredDecisionItems:()=>items,itemComplete:i=>done.has(i.id),itemRequired:()=>true,currentCategory:'C',sectionDraftReady:()=>done.size===2,openCompanyReview(){reviews++;}};
 vm.createContext(ctx);
 for(const name of ['decisionsSubmitted','sectionSubmitted','simulationSubmissionComplete','decisionProgressPercent','categoryCompletionMap','updateHud','submitAllDecisions']){const start=source.indexOf('function '+name+'('),end=source.indexOf(name==='submitAllDecisions'?'\n':'\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
 return {ctx,elements,storage,done,setRound:n=>round=n,reviews:()=>reviews};
}
test('HUD and report count current-cycle section confirmations and ignore obsolete Excel envelopes',()=>{
 const r=runtime(),{ctx,storage,elements}=r;ctx.updateHud();assert.equal(ctx.decisionsSubmitted(),false);assert.equal(elements.get('decisionProgressText').textContent,'0/5 · 0%');
 storage.set('1:B','1');storage.set('1:C','1');ctx.updateHud();assert.equal(elements.get('decisionProgressText').textContent,'2/5 · 40%');assert.equal(ctx.simulationSubmissionComplete(),false);
 storage.set('all:1','1');ctx.updateHud();assert.equal(ctx.decisionsSubmitted(),true);assert.equal(elements.get('decisionProgressText').textContent,'5/5 · 100%');assert.equal(ctx.simulationSubmissionComplete(),true);
 r.setRound(2);ctx.updateHud();assert.equal(ctx.decisionsSubmitted(),false);assert.equal(elements.get('decisionProgressText').textContent,'0/5 · 0%');
 ctx.submitAllDecisions();assert.equal(r.reviews(),1);assert.equal(ctx.currentCategory,'C');
});
test('draft readiness never claims submission and the review remains accessible after confirmation',()=>{
 const r=runtime(),{ctx,storage,elements,done}=r;done.add('one');ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),50);assert.equal(ctx.categoryCompletionMap().C.complete,false);assert.equal(elements.get('decisionProgressText').textContent,'0/5 · 0%');
 done.add('two');ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),100);assert.equal(ctx.categoryCompletionMap().C.complete,true);assert.equal(elements.get('decisionProgressText').textContent,'0/5 · 0%');assert.equal(elements.get('sendDecisionSection').disabled,false);
 for(const cat of ['B','C','D','E','F'])storage.set('1:'+cat,'1');ctx.updateHud();assert.equal(ctx.simulationSubmissionComplete(),true);assert.equal(elements.get('decisionProgressText').textContent,'5/5 · 100%');assert.equal(elements.get('sendDecisionSection').disabled,true);assert.equal(elements.get('topSubmitAllDecisions').disabled,false);ctx.submitAllDecisions();assert.equal(r.reviews(),1);
});
