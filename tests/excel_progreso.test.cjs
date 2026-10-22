'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('HUD y reporte de modo Excel reconocen exclusivamente confirmación del plan actual',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),elements=new Map();
 function element(){return {textContent:'',innerHTML:'',disabled:false,style:{},classList:{add(){},toggle(){}},closest:()=>({setAttribute(){}})};}
 const ctx={decisionState:{__excel:{habilitado:true,round:1,enviado:true}},localStorage:{getItem:()=>null},currentRound:()=>1,studentAccess:()=>({canOperate:true}),excelEditorRemoteReady:true,updateCashHud(){},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},navigationCategories:()=>['A','B','C','D','E'].map(cat=>({cat,title:cat})),excelCategoryReadiness:()=>({A:false,B:false,C:false,D:false,E:false}),currentCategory:'C',renderTabs(){},renderDecisionCategory(){},scrollDecisionContentToTop(){},requestAnimationFrame:f=>f(),document:{querySelector:()=>({focus(){}})},openCompanyReview(){throw Error('No debe abrir revisión legacy');}};
 vm.createContext(ctx);
 for(const name of ['decisionsSubmitted','decisionProgressPercent','categoryCompletionMap','updateHud','submitAllDecisions']){const start=source.indexOf('function '+name+'('),end=source.indexOf(name==='submitAllDecisions'?'\n':'\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
 ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),100);assert.equal(ctx.decisionsSubmitted(),true);assert.equal(elements.get('decisionProgressText').textContent,'5/5 · 100%');assert.equal(elements.get('topSubmitAllDecisions').disabled,true);assert.equal(ctx.categoryCompletionMap().C.complete,true);
 ctx.decisionState.__excel.round=2;ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),0);assert.equal(elements.get('decisionProgressText').textContent,'0/5 · 0%');assert.equal(elements.get('topSubmitAllDecisions').disabled,false);assert.equal(elements.get('topSubmitAllDecisions').textContent,'ENVIAR DECISIÓN');
 ctx.submitAllDecisions();assert.equal(ctx.currentCategory,'C');
 ctx.studentAccess=()=>({canOperate:false});ctx.updateHud();assert.equal(elements.get('topSubmitAllDecisions').disabled,true);
 ctx.studentAccess=()=>({canOperate:true});ctx.excelEditorRemoteReady=false;ctx.updateHud();assert.equal(elements.get('topSubmitAllDecisions').disabled,true);
});

test('La preparación del borrador actualiza porcentaje sin afirmar que el plan fue confirmado',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),elements=new Map();
 const element=()=>({textContent:'',disabled:false,style:{},classList:{add(){}},closest:()=>({setAttribute(){}})});
 const ctx={decisionState:{__excel:{habilitado:true,round:1,enviado:false,decisiones:{maquinaria:{mesa:1,'INF-08':1},personal:{},lotes:[],seleccion:[],montoPrestamo:0}}},localStorage:{getItem:()=>null},currentRound:()=>1,creditAvailable:()=>10000,excelDraftProjection:()=>({cashAfter:50000}),studentAccess:()=>({canOperate:true}),excelEditorRemoteReady:true,updateCashHud(){},$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)}};
 vm.createContext(ctx);
 for(const name of ['decisionsSubmitted','excelCategoryReadiness','excelDraftProgress','decisionProgressPercent','updateHud']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
 ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),60);assert.equal(elements.get('decisionProgressText').textContent,'3/5 · 60%');assert.match(elements.get('decisionProgressHint').textContent,/falta confirmar/);
 const d=ctx.decisionState.__excel.decisiones;d.lotes=[{cantidad:10,precio:40,segmento:'SEG-01',molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06'}];d.personal={corte:[[1]],ensamble:[[1]],acabado:[[1]]};d.seleccion=['COM-01B'];ctx.updateHud();assert.equal(ctx.decisionProgressPercent(),100);assert.equal(elements.get('decisionProgressText').textContent,'5/5 · 100%');assert.equal(elements.get('topSubmitAllDecisions').disabled,false);
 ctx.excelDraftProjection=()=>({cashAfter:-1});assert.equal(ctx.decisionProgressPercent(),80);
 d.montoPrestamo=20000;ctx.excelDraftProjection=()=>({cashAfter:50000});assert.equal(ctx.decisionProgressPercent(),80);
 ctx.decisionState.__excel.enviado=true;ctx.updateHud();assert.equal(elements.get('decisionProgressText').textContent,'5/5 · 100%');assert.equal(elements.get('decisionProgressHint').textContent,'Plan confirmado');
});
