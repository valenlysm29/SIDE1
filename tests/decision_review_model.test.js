'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../js/decision_review_model'),rules=require('../js/side_rules');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/decision_catalog.js'),'utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));
const item=id=>catalog.flatMap(c=>c.items).find(i=>i.id===id);
function context(patch={}){return {catalog,state:{},drafts:{},round:1,config:{interest:20,cycles:6},rules,capital:100000,ledger:{},...patch};}
test('empty scenario includes mandatory local and cleaning only',()=>{
 const ctx=context(),sections=catalog.map(c=>model.section(c,ctx));
 assert.equal(model.finances(sections,ctx).outflow,2600);assert.equal(model.finances(sections,ctx).projectedCash,97400);
});
test('all three districts retain their quantities and cost',()=>{
 const ctx=context({drafts:{CANALES:{optionIds:['web','los_olivos','miraflores','sjl'],quantities:{los_olivos:2,miraflores:3,sjl:4}}}});
 const result=model.breakdown(item('CANALES'),ctx);assert.equal(result.outflow,23400);
 assert.deepEqual(result.rows.map(r=>r.quantity),[1,2,3,4]);
 assert.equal(model.breakdown(item('PERSONAL_VENTAS'),ctx).rows[0].quantity,9);
});
test('asset acquisitions and disposals have separate gross flows',()=>{
 const ctx=context({round:2,state:{ENSAMBLE:{purchases:{1:{ens_basica:2}}}},drafts:{ENSAMBLE:{quantities:{ens_basica:-1,ens_semi:1}}}});
 const result=model.breakdown(item('ENSAMBLE'),ctx);assert.equal(result.outflow,7500);assert.equal(result.assetIncome,1400);assert.equal(result.net,-6100);
 assert.match(result.rows[0].detail,/Total disponible: 1/);
});
test('same-round submitted mold still costs money; later cycles do not charge again',()=>{
 const state={MOLDE:{optionIds:['molde_2'],round:1}};
 assert.equal(model.breakdown(item('MOLDE'),context({state})).outflow,1200);
 assert.equal(model.breakdown(item('MOLDE'),context({state,round:2})).outflow,0);
});
test('staff severance survives repeated saves in the same round',()=>{
 const ctx=context({round:2,state:{PERS_CORTE:{round:2,quantities:{corte_basico:1},previousQuantities:{corte_basico:3}}},drafts:{PERS_CORTE:{quantities:{corte_basico:1}}}});
 const result=model.breakdown(item('PERS_CORTE'),ctx);assert.equal(result.outflow,3000);assert.equal(result.recurring,1500);
});
test('analyst discount affects material prices, not wages',()=>{
 const ctx=context({drafts:{ANALISTA_COMPRAS:{optionIds:['si_analista']},CUERO:{quantities:{cuero_std:100}},PERS_CORTE:{quantities:{corte_basico:2}}}});
 assert.ok(Math.abs(model.breakdown(item('CUERO'),ctx).outflow-7286.4)<1e-9);assert.equal(model.breakdown(item('PERS_CORTE'),ctx).outflow,3000);
});

test('material purchases use physical units and the retained quantity discount',()=>{
 const ctx=context({drafts:{CUERO:{quantities:{cuero_sint:60,cuero_std:55,cuero_prem:15}},ACCESORIOS:{quantities:{acc_eco:200,acc_prem:190}},HILO:{quantities:{hilo_ref:6,hilo_prem:7}}}});
 const total=['CUERO','ACCESORIOS','HILO'].reduce((sum,id)=>sum+model.breakdown(item(id),ctx).outflow,0);
 assert.ok(Math.abs(total-(60*25+55*90+15*140+200*2+190*5+6*.15+7*.22)*.92)<1e-9);
});

test('review uses the nine wages defined by the restored game catalog',()=>{
 const expected={PERS_CORTE:[1500,2500,4000],PERS_ENSAMBLE:[1500,2800,4500],PERS_ACABADO:[1500,2800,4500]};
 for(const [id,monthly] of Object.entries(expected))for(const [index,amount] of monthly.entries())assert.equal(model.unitCost(item(id),item(id).options[index],context()),amount);
 assert.equal(model.unitCost(item('JEFATURA'),item('JEFATURA').options[1],context()),3000);
 assert.equal(model.unitCost(item('JEFATURA'),item('JEFATURA').options[0],context()),0);
});

test('asset purchases use their displayed price and persist across later cycles',()=>{
 const drafts={MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_basica:1}},ACABADOS:{quantities:{aca_basica:1}},MOLDE:{optionIds:['molde_1']}};
 const ctx=context({drafts});
 assert.equal(model.breakdown(item('MESA_CORTE'),ctx).outflow,2500);
 assert.equal(model.breakdown(item('ENSAMBLE'),ctx).outflow,3500);
 assert.equal(model.breakdown(item('ACABADOS'),ctx).outflow,1200);
 assert.equal(model.breakdown(item('MOLDE'),ctx).outflow,300);
 assert.equal(model.breakdown(item('MESA_CORTE'),context({round:2,state:{MESA_CORTE:{purchases:{1:{mesa:1}}}}})).outflow,0);
});
test('loan is financing, never sales or a reduction of gross expenses; zero TEA is preserved',()=>{
 const ctx=context({config:{interest:0,cycles:6},drafts:{PRESTAMO:{amount:15000}}});
 const result=model.breakdown(item('PRESTAMO'),ctx);assert.equal(result.financing,15000);assert.equal(result.outflow,0);assert.equal(result.assetIncome,0);assert.match(result.rows[0].detail,/TEA: 0%/);
});
test('saved ledger is reconciled instead of charged twice',()=>{
 const ctx=context({drafts:{CANALES:{optionIds:['los_olivos'],quantities:{los_olivos:2}}},ledger:{'1:D':-3600}});
 const s=model.section(catalog.find(c=>c.cat==='D'),ctx),f=model.finances([s],ctx);
 assert.equal(f.outflow,3600);assert.equal(f.pendingDelta,0);assert.equal(f.projectedCash,96400);
});
test('additional drafts apply only the difference',()=>{
 const ctx=context({drafts:{CANALES:{optionIds:['los_olivos'],quantities:{los_olivos:3}}},ledger:{'1:D':-3600}});
 const f=model.finances([model.section(catalog.find(c=>c.cat==='D'),ctx)],ctx);
 assert.equal(f.pendingDelta,-1800);assert.equal(f.projectedCash,94600);
});
test('contract calculation excludes current cycle and shows obligations beyond game',()=>{
 const ctx=context({drafts:{CANALES:{optionIds:['los_olivos'],quantities:{los_olivos:2}}}}),f=model.future(ctx);
 assert.equal(f.total,2*1800*11);assert.equal(f.beyondGame,2*1800*6);assert.equal(f.contracts[0].lastRound,12);
});
test('contract batches preserve different opening cycles',()=>{
 const entry={optionIds:['los_olivos'],quantities:{los_olivos:3},storeContracts:{los_olivos:[{round:1,quantity:2},{round:3,quantity:1}]}},ctx=context({round:4,state:{CANALES:entry},drafts:{CANALES:{optionIds:['los_olivos'],quantities:{los_olivos:3}}}});
 assert.equal(model.future(ctx).total,(2*8+1*10)*1800);
});
test('pure model never mutates its context',()=>{
 const ctx=context({state:{MOLDE:{optionIds:['molde_1'],round:1}},drafts:{CUERO:{quantities:{cuero_sint:5}},PRODUCCION_META:{value:10}}}),before=JSON.stringify(ctx);
 const sections=catalog.map(c=>model.section(c,ctx));model.finances(sections,ctx);model.warnings(ctx);
 assert.equal(JSON.stringify(ctx),before);
});
test('all catalog items, including zero-cost guarantees and automatic rules, appear',()=>{
 const ctx=context({drafts:{GARANTIA_PROV:{optionIds:['gar_80']},GARANTIA_PT:{optionIds:['pt_90']}}});
 const sections=catalog.map(c=>model.section(c,ctx));assert.equal(sections.flatMap(s=>s.items).length,catalog.flatMap(c=>c.items).length);
 assert.equal(model.breakdown(item('GARANTIA_PROV'),ctx).rows[0].label,'80% de devoluci\u00f3n');
});
test('production review lists the desired quantity for every planned mold',()=>{
 const ctx=context({drafts:{PRODUCCION_META:{moldTargets:{molde_1:20,molde_2:30,molde_3:10}}}}),result=model.breakdown(item('PRODUCCION_META'),ctx);
 assert.deepEqual(result.rows.map(row=>[row.label,row.quantity]),[['Molde básico',20],['Molde mejorado',30],['Molde premium',10]]);
 assert.equal(result.outflow,0);
});
