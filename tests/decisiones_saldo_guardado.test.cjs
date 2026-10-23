'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function appFunction(name,ctx){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end<0?undefined:end),ctx);}
function engine(){
 const context={localStorage:{getItem:()=>null,setItem(){}}};vm.createContext(context);
 for(const file of ['config_excel','catalogo_excel','puntajes','produccion','costos','consecuencias','mercado','ciclo','caja','ui_excel'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/engine',file+'.js'),'utf8'),context);
 return context;
}
function control(attribute,value){return {dataset:{},value,matches:s=>s==='['+attribute+']',hasAttribute:s=>s===attribute};}
function editor(ctx,envelope,category='D'){
 const status={textContent:''},container={innerHTML:'',querySelectorAll:()=>[],querySelector:s=>s==='[data-excel-status]'?status:null};
 ctx.SIDE_EXCEL_UI.mountEditor(container,{category,round:1,cash:100000,historial:{},motorVersion:'excel-16',getState:()=>envelope.value,save:value=>{envelope.value=JSON.parse(JSON.stringify(value));}});
 return container;
}
test('Guardar un ítem conserva el otro cambio como borrador, incluso al cambiar de pestaña',()=>{
 const ctx=engine(),api=ctx.SIDE_EXCEL_UI,envelope={value:{habilitado:true,round:1,decisiones:api.nuevasDecisiones()}},marketing=control('data-excel-marketing','alta'),analyst=control('data-excel-analista','');analyst.checked=true;
 let container=editor(ctx,envelope);
 container.oninput({target:marketing});container.oninput({target:analyst});
 assert.equal(envelope.value.decisiones.marketingNivel,'alta');assert.equal(envelope.value.decisiones.analistaCompras,true);
 assert.equal(envelope.value.decisionesGuardadas.marketingNivel,null);assert.equal(envelope.value.decisionesGuardadas.analistaCompras,false);
 container=editor(ctx,envelope); // A tab switch creates a new editor from persisted state.
 const button={disabled:false,dataset:{},_decisionControl:marketing,hasAttribute:s=>s==='data-excel-guardar-item'};
 container.onclick({target:{closest:()=>button}});
 assert.equal(envelope.value.decisionesGuardadas.marketingNivel,'alta');assert.equal(envelope.value.decisionesGuardadas.analistaCompras,false);
 assert.equal(envelope.value.decisiones.analistaCompras,true);assert.equal(envelope.value.enviado,false);
 const expected=api.proyectarPlan(envelope.value.decisionesGuardadas,{cash:100000,historial:{},round:1,motorVersion:'excel-16'}).cashAfter;
 assert.equal(envelope.value.saldoFinalGuardado,expected);
 const balance=envelope.value.saldoFinalGuardado;
 container.oninput({target:control('data-excel-marketing','baja')});assert.equal(envelope.value.saldoFinalGuardado,balance);
});
test('HUD muestra la caja guardada y no cobra borradores',()=>{
 let cash=85000;const nodes={};const node=id=>nodes[id]||(nodes[id]={textContent:'',classList:{toggle(){}}});
 const ctx={cashBalance:()=>cash,initialCapital:()=>100000,money:v=>'S/ '+v,$:node,document:{querySelectorAll:()=>[]}};vm.createContext(ctx);appFunction('updateCashHud',ctx);
 ctx.updateCashHud();assert.equal(nodes.cashBalance.textContent,'S/ 85000');
 ctx.pendingDraft={amount:12000};ctx.updateCashHud();assert.equal(nodes.cashBalance.textContent,'S/ 85000');
 cash=73000;ctx.updateCashHud();assert.equal(nodes.cashBalance.textContent,'S/ 73000');
});
test('Navegación conserva cinco decisiones y el resumen según ciclo',()=>{
 let round=1;const catalog=['A','B','C','D','E','F'].map(cat=>({cat,items:[],summaryOnly:cat==='A'}));
 const ctx={DECISION_CATALOG:catalog,currentRound:()=>round,decisionCategories:()=>catalog.filter(c=>!c.summaryOnly)};vm.createContext(ctx);appFunction('navigationCategories',ctx);
 assert.deepEqual(Array.from(ctx.navigationCategories(),c=>c.cat),['B','C','D','E','F','A']);round=2;
 assert.deepEqual(Array.from(ctx.navigationCategories(),c=>c.cat),['A','B','C','D','E','F']);assert.equal(ctx.navigationCategories().filter(c=>!c.summaryOnly).length,5);
});
test('Enviar todo desde cualquier pestaña abre revisión validada antes de cobrar',()=>{
 let reviews=0;const ctx={openCompanyReview(){reviews++;}};vm.createContext(ctx);
 const start=source.indexOf('function submitAllDecisions('),end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),ctx);ctx.submitAllDecisions();assert.equal(reviews,1);
});

test('Cabecera compartida conserva caja superior sin saldo duplicado',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/id="cashBalance"/);
 assert.doesNotMatch(html,/section-balance|data-saved-final-balance|id="projectedCash"/);
 assert.doesNotMatch(source,/\$\('projectedCash'\)|data-saved-final-balance/);
});
