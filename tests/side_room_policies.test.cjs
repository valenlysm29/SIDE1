const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../js/financial_model.js'),CFG=require('../services/finance_config.js'),review=require('../js/decision_review_model.js'),catalog=require('../js/decision_catalog.js'),rules=require('../js/side_rules.js'),view=require('../js/student_financial_view.js');
test('la sala elige régimen tributario y separa impuesto de costos operativos',()=>{
 const state={__cycleSettlements:{1:{regimen:'MYPE',sales:[],inventory:{},financialPolicy:{cycles:1,taxRegime:'NO_MYPE'}}}};
 const r=F.calculate({capital:0,round:1,state,ledger:{'1:SIM_VENTAS':10000,'1:SIM_GASTOS':-1000},financialPolicy:{cycles:1,taxRegime:'NO_MYPE'}}).estadoResultados;
 assert.equal(r.utilidadAntesImpuestos,9000);assert.equal(r.impuestoRenta,2655);assert.equal(r.costos,1000);assert.equal(r.utilidadNeta,6345);assert.equal(r.desgloseCostos.total,1000);
});
test('umbral de sala llega a revisión de compras y resolución financiera',()=>{
 const config=CFG.resolve({cycles:3,taxRegime:'MYPE',materials:{quantityDiscountThreshold:10}});assert.equal(config.taxRegime,'MYPE');assert.equal(config.materials.quantityDiscountThreshold,10);
 const item=catalog.flatMap(c=>c.items).find(i=>i.id==='CUERO'),opt=item.options.find(x=>x.id==='cuero_sint');
 const ctx={state:{},drafts:{CUERO:{quantities:{cuero_sint:10}}},catalog,round:1,rules,config};assert.equal(review.unitCost(item,opt,ctx),23);
 ctx.config={materials:{quantityDiscountThreshold:11}};assert.equal(review.unitCost(item,opt,ctx),25);
});
test('resultado explica demanda frente a stock aunque haya ventas',()=>{
 const text=view.salesHtml({round:1,cycleReceipt:{produced:20,sold:10,revenue:400,goods:{esencial:10},production:{target:20,productLines:[{target:20,available:true,plannedUnits:20}]},sales:[{id:'esencial',price:40,available:20,produced:20,sold:10,assignedDemand:10,revenue:400}],marketAllocation:{products:{esencial:{puntajePrecio:10}}}}});
 assert.match(text,/Por qué vendí lo que vendí/);assert.match(text,/demanda asignada fue menor/);assert.match(text,/puntaje competitivo bajo/);
});
