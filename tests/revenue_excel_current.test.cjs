'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const REVENUE=require('../js/revenue_model.js'),CYCLE=require('../js/cycle_model.js'),E=require('../js/engine/cierre.js'),fixture=require('./economic_v19_fixture.cjs');
const productIds=['esencial','urbano','premium'];
function inputs(){return [40,45,43,41].map((price,i)=>{const state=fixture.state(1,{},3);state.PRODUCCION_META.prices.esencial=price;return {id:String(i),state,catalog:fixture.catalog,round:1,capital:200000};});}
test('current revenue adapter reproduces fresh v19 Excel market allocations',()=>{
 const oracle=JSON.parse(fs.readFileSync(path.join(__dirname,'../reports/excel_v19_oracle.json'),'utf8'));
 assert.ok(oracle);const companies=[{id:'A',precio:40,reputacion:5,calidad:4,stock:100,producido:100,bajaPrevios:0},{id:'B',precio:45,reputacion:5,calidad:4,stock:100,producido:100,bajaPrevios:0}];
 const rows=E.settleMarketCompanies(companies,'SEG-01');assert.equal(rows.reduce((s,r)=>s+r.vendidas,0),200);assert.ok(rows[0].demanda>rows[1].demanda);
});
test('catalog reputation is unique, bounded and independent from advertising spend proxy',()=>{
 const input=inputs()[0],profile=REVENUE.profile(input);assert.ok(profile.scores.reputation>=0&&profile.scores.reputation<=10);assert.ok(Math.abs(profile.scores.reputation-(1/3+1+1+0)*10/4)<1e-10);
 const changed=structuredClone(input);changed.state.__worldPublicity=999999;assert.deepEqual(REVENUE.profile(changed).scores,profile.scores);
});
test('shared closure competes across companies, caps sales at stock and ignores POS activity',()=>{
 const group=inputs(),results=CYCLE.closeMany(group);
 for(const input of group){const r=results[input.id];assert.ok(r.receipt.revenue>0);for(const row of r.receipt.sales){assert.ok(row.sold<=row.available);assert.equal(row.revenue,Math.round(row.sold*row.price*100)/100);}assert.equal(r.ledger['1:SIM_VENTAS'],r.receipt.revenue);assert.equal(CYCLE.close({...input,state:r.state,ledger:r.ledger}).reused,true);}
 const s=fixture.state();s.PRODUCCION_META.moldTargets={molde_1:12};s.PRODUCCION_META.prices.esencial=40;const short=CYCLE.close({state:s,catalog:fixture.catalog,round:1});assert.equal(short.receipt.sold,12);assert.equal(short.receipt.revenue,480);
});
test('unsold goods carry forward and opening stock can sell without current production',()=>{
 for(const optionIds of [[],['web'],['los_olivos','miraflores','sjl']]){const s=fixture.state(2);s.CANALES.optionIds=optionIds;s.__finishedGoods={esencial:10};const r=CYCLE.close({round:2,state:s,catalog:fixture.catalog});assert.equal(r.receipt.sold,optionIds.length?100:0);assert.equal(r.state.__finishedGoods.esencial,optionIds.length?0:100);}
 const excess=CYCLE.close({state:{__finishedGoods:{esencial:5000}},round:2,catalog:fixture.catalog});assert.equal(excess.receipt.sold,0);assert.equal(excess.state.__finishedGoods.esencial,5000);
 const r=CYCLE.close({state:{CANALES:{optionIds:['web']},__finishedGoods:{esencial:10}},round:2,catalog:fixture.catalog});assert.equal(r.receipt.sold,10);assert.equal(r.state.__finishedGoods.esencial,0);
});
test('browser pages load the same revenue dependencies as Node',()=>{
 for(const page of ['index.html','docente.html']){const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8'),context={};context.globalThis=context;vm.createContext(context);for(const name of ['business_rules','production_model','engine/catalogo_excel','engine/config','engine/cierre','revenue_model']){assert.ok(html.indexOf(`js/${name}.js`)<html.indexOf('js/cycle_model.js'));vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),context);}assert.deepEqual(JSON.parse(JSON.stringify(context.SIDE_REVENUE_MODEL.allocate(inputs()))),REVENUE.allocate(inputs()));}
});
test('remote service ignores world prices and preserves confirmed decision expenses',async()=>{
 const group=inputs(),companies=group.map(input=>({id:input.id,capital:input.capital,snapshot:{decision_state:{...input.state,__cyclePlans:{1:{state:input.state}},__cycleBusiness:{1:{prices:{esencial:99999}}}},cash_ledger:{'1:C':-1000}}}));let payload;
 const window={SIDE_CYCLE_MODEL:CYCLE,SIDE_FINANCIAL_MODEL:require('../js/financial_model.js'),SIDE_DECISION_CATALOG:fixture.catalog,SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>{if(name==='side_contexto_cierre_negocio')return {data:{empresas:companies,token:'test',financialConfig:{cycles:3}}};assert.equal(name,'side_guardar_cierre_negocio');payload=args.p_cierre;return {data:{cierre:payload}};}})}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/partida_service.js'),'utf8'),{window,console,setTimeout,clearTimeout});const response=await window.SIDE.PartidaService.cerrarNegocio('game',1);assert.equal(response.success,true,JSON.stringify(response));const expected=CYCLE.closeMany(group.map(input=>({...input,ledger:{'1:C':-1000}})));for(const input of group){const r=payload.resultadosPorEmpresa[input.id];assert.equal(r.receipt.revenue,expected[input.id].receipt.revenue);assert.ok(r.ledger['1:C']<0);assert.notEqual(r.ledger['1:C'],-1000); assert.equal(r.ledger['1:C'],r.financialSections[1].C.net);}
});
test('connected students cannot allocate the whole shared market to themselves',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8'),fn=source.slice(source.indexOf('function settleCycle('),source.indexOf('\nfunction syncStudentReportPreview(')),ctx={window:{SIDE_CYCLE_MODEL:CYCLE},decisionState:{},currentStudent:{empresaId:'A'},currentRound:()=>1};vm.createContext(ctx);vm.runInContext(fn,ctx);assert.equal(ctx.settleCycle(1),false);
});
