'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('HUD y reporte de modo Excel reconocen exclusivamente confirmación del plan actual',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),elements=new Map();
 function element(){return {textContent:'',innerHTML:'',disabled:false,style:{},classList:{add(){},toggle(){}},closest:()=>({setAttribute(){}})};}
 const ctx={decisionState:{__excel:{habilitado:true,round:1,enviado:true}},localStorage:{getItem:()=>null},currentRound:()=>1,updateCashHud(){},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},currentCategory:'C',renderTabs(){},renderDecisionCategory(){},scrollDecisionContentToTop(){},requestAnimationFrame:f=>f(),document:{querySelector:()=>({focus(){}})},openCompanyReview(){throw Error('No debe abrir revisión legacy');}};
 vm.createContext(ctx);
 for(const name of ['decisionsSubmitted','decisionProgressPercent','categoryCompletionMap','updateHud','submitAllDecisions']){const start=source.indexOf('function '+name+'('),end=source.indexOf(name==='submitAllDecisions'?'\n':'\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
 ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),100);assert.equal(ctx.decisionsSubmitted(),true);assert.equal(elements.get('decisionProgressText').textContent,'1/1 · 100%');assert.equal(elements.get('topSubmitAllDecisions').disabled,true);assert.equal(ctx.categoryCompletionMap().C.complete,true);
 ctx.decisionState.__excel.round=2;ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),0);assert.equal(elements.get('decisionProgressText').textContent,'0/1 · 0%');assert.equal(elements.get('topSubmitAllDecisions').disabled,false);assert.equal(elements.get('topSubmitAllDecisions').textContent,'Revisar plan');
 ctx.submitAllDecisions();assert.equal(ctx.currentCategory,'C');
});
