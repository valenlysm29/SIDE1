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
 ctx.SIDE_EXCEL_UI.mountEditor(container,{category,round:1,cash:100000,historial:{},motorVersion:ctx.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,getState:()=>envelope.value,save:value=>{envelope.value=JSON.parse(JSON.stringify(value));}});
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
 const expected=api.proyectarPlan(envelope.value.decisionesGuardadas,{cash:100000,historial:{},round:1,motorVersion:ctx.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL}).cashAfter;
 assert.equal(envelope.value.saldoFinalGuardado,expected);
 const balance=envelope.value.saldoFinalGuardado;
 container.oninput({target:control('data-excel-marketing','baja')});assert.equal(envelope.value.saldoFinalGuardado,balance);
});
test('El HUD usa únicamente el saldo guardado; un cambio de ciclo descarta el saldo anterior',()=>{
 const ctx={decisionState:{__excel:{habilitado:true,round:1,saldoFinalGuardado:85000,decisiones:{publicidad:12000}}},currentRound:()=>1,excelSavedResult:()=>null,cashBalance:()=>100000};vm.createContext(ctx);appFunction('excelSavedCashBalance',ctx);
 assert.equal(ctx.excelSavedCashBalance(),85000);ctx.decisionState.__excel.decisiones.publicidad=0;assert.equal(ctx.excelSavedCashBalance(),85000);
 ctx.currentRound=()=>2;assert.equal(ctx.excelSavedCashBalance(),100000);
 ctx.currentRound=()=>1;ctx.excelSavedResult=()=>({financial:{balanceCaja:{cajaFinal:91000}}});ctx.cashBalance=()=>91000;assert.equal(ctx.excelSavedCashBalance(),91000);
});
test('Navegación canónica conserva exactamente cinco pestañas y Empresa vuelve a decidir',()=>{
 const ctx={decisionState:{__excel:{habilitado:true}},DECISION_CATALOG:['A','B','C','D','E','F'].map(cat=>({cat,items:[],summaryOnly:cat==='A'}))};vm.createContext(ctx);appFunction('navigationCategories',ctx);
 const categories=ctx.navigationCategories();assert.deepEqual(Array.from(categories,c=>c.title),['Empresa','Infraestructura','Producción','Ventas','Finanzas']);assert.ok(categories.every(c=>!c.summaryOnly));
});
test('Enviar desde la barra superior utiliza la validación y el envío existente de cualquier pestaña',()=>{
 let sent=0;const ctx={decisionState:{__excel:{habilitado:true}},document:{querySelector:()=>({click(){sent++;}})}};vm.createContext(ctx);
 const start=source.indexOf('function submitAllDecisions('),end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),ctx);ctx.submitAllDecisions();assert.equal(sent,1);
});
