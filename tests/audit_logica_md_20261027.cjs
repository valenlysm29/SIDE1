'use strict';
// Read-only audit. Expected business rules come from the supplied Markdown,
// independently of the existing v19 workbook and its test fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'tests/output/auditoria_md_20261027');
const {catalog,state:fixture}=require('./economic_v19_fixture.cjs');
const PRO=require('../js/production_model.js'),E=require('../js/engine/cierre.js');
const CYCLE=require('../js/cycle_model.js'),REVIEW=require('../js/decision_review_model.js'),RULES=require('../js/side_rules.js');
const clone=x=>JSON.parse(JSON.stringify(x)),items=catalog.flatMap(c=>c.items||[]),cases=[];
function record(id,rule,expected,actual){const equal=typeof expected==='number'&&typeof actual==='number'?Math.abs(expected-actual)<1e-6:JSON.stringify(expected)===JSON.stringify(actual);cases.push({id,rule,expected,actual,status:equal?'CONFORME':'DIFIERE'});}
function setQuantities(s,id,q){s[id]={round:1,quantities:q,optionIds:Object.keys(q),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:q}}:{})};}
function prepare(s){return E.prepare({id:'A',state:s,catalog,round:1});}
const base=fixture();
// Single N1 worker and manual machine per area isolate days/rates from staffing mix.
const simple=clone(base);
for(const [id,q] of Object.entries({MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1},ACABADOS:{aca_basica:1},PERS_CORTE:{corte_basico:1},PERS_ENSAMBLE:{ens_personal_basico:1},PERS_ACABADO:{aca_personal_basico:1}}))setQuantities(simple,id,q);
simple.JEFATURA={round:1,optionIds:['no_jefatura']};simple.PRODUCCION_META.moldTargets={molde_1:300};
const raw=PRO.calculate({state:simple,catalog,round:1});
record('capacity_days','MD 1.2: monthly capacity uses 30 days',30,raw.days);
record('capacity_daily_cut_n1','MD 1.1: N1 cutting produces 6 bags/day',6,raw.processes[0].dailyCapacity);
record('capacity_monthly_n1','MD 1: 6 * 30 * .90 = 162 bags',162,raw.processCapacity);

// With ample staff, only the shared 2900m of thread constrains this mix.
const mix=clone(base);mix.PRODUCCION_META.moldTargets={molde_1:150,molde_2:140,molde_3:95};
setQuantities(mix,'CUERO',{cuero_sint:60,cuero_std:110,cuero_prem:30});setQuantities(mix,'ACCESORIOS',{acc_eco:200,acc_prem:190});setQuantities(mix,'HILO',{hilo_ref:1500,hilo_prem:1400});
const mixed=prepare(mix);
record('production_priority','MD 3.1: N1 -> N2 -> N3 exhausts remaining thread',[150,140,78],mixed.plan.productLines.map(l=>l.plannedUnits));
record('recipe','MD 2.3: three mold recipes',[[.3,1,6],[.4,1,7],[.7,1,13]],Object.values(PRO.constants.MOLD_REQUIREMENTS).map(r=>[r.CUERO,r.ACCESORIOS,r.HILO]));

const premium=clone(base),cheap=clone(base);
setQuantities(cheap,'CUERO',{cuero_sint:250});setQuantities(cheap,'ACCESORIOS',{acc_eco:1000});setQuantities(cheap,'HILO',{hilo_std:10000});
function mdReputation(s){const p=prepare(s),total=p.plan.producibleUnits,premiumUnits=p.plan.productLines[2].plannedUnits,workers=['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].flatMap(id=>Object.entries(s[id].quantities));const n3=workers.filter(([id])=>['corte_maestro','ens_personal_esp','aca_personal_art'].includes(id)).reduce((a,[,q])=>a+q,0),all=workers.reduce((a,[,q])=>a+q,0);let premiumFractions=0;for(const m of p.plan.materials){let need=m.consumption,used=0,high=0;const opts=items.find(i=>i.id===m.id).options;for(const o of opts){const consume=Math.min(need,(s[m.id]?.quantities?.[o.id]||0)+(s.__inventarioMP?.[o.id]||0));used+=consume;need-=consume;if(o===opts.at(-1))high=consume;}premiumFractions+=used?high/used:0;}const ad=Number(s.INV_MARKETING?.value)||0;return ((total?premiumUnits/total:0)+n3/all+premiumFractions/3+Math.min(ad,10000)/10000)*10/4;}
record('reputation_four_factors','MD 6: production + N3 staff + consumed premium MP + advertising, divided by 4',mdReputation(premium),prepare(premium).scores.reputation);
record('reputation_material_sensitivity','MD 6: consuming all premium families raises reputation by 2.5 versus basic',2.5,prepare(premium).scores.reputation-prepare(cheap).scores.reputation);
const moreStaff=clone(premium);for(const id of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']){const q=Object.keys(moreStaff[id].quantities)[0];moreStaff[id].quantities[q]=1;const basic={PERS_CORTE:'corte_basico',PERS_ENSAMBLE:'ens_personal_basico',PERS_ACABADO:'aca_personal_basico'}[id];moreStaff[id].quantities[basic]=3;}
record('reputation_staff_ratio_sensitivity','MD 6: reducing N3 ratio from 100% to 25% reduces reputation .75*10/4',1.875,prepare(premium).scores.reputation-prepare(moreStaff).scores.reputation);
record('advertising_control','MD 4: player can choose S/3000 advertising',true,items.find(i=>i.id==='INV_MARKETING').type==='number'&&items.find(i=>i.id==='INV_MARKETING').max>=3000);
const rows=[0,1,2].map(i=>({id:String(i),hasChannel:true,scores:{reputation:7},demandFactor:1,lines:[{id:'premium',price:250,quality:7,produced:1000,available:1000}]}));
const allocation=E.allocate(rows),assigned=Object.values(allocation).map(x=>x.products.premium.asignado);
record('market_conservation','MD 7.4: largest remainder must allocate exactly the 800-unit market',800,assigned.reduce((a,b)=>a+b,0));
record('equal_prices','MD 7.3: equal economic prices score 100',100,E.allocate(rows.map(r=>({...r,lines:[{...r.lines[0],id:'esencial',price:40}]})))['0'].products.esencial.puntajePrecio);
const expensive=E.allocate([{...rows[0],lines:[{...rows[0].lines[0],id:'urbano',price:300}]}]);
record('nonnegative_price_score','MD 7.3: floor the price score at zero',0,expensive['0'].products.urbano.puntajePrecio);
record('market_sizes','MD 7.1: configured real-market sizes match the reference',[3500,3500,800],E.config.products.map(id=>E.allocate(rows.map(r=>({...r,lines:[{...r.lines[0],id}]})))['0'].products[id].mercadoReal));
record('market_weights','MD 7.2: segment weights',[[.7,.2,.1],[.4,.35,.25],[.1,.5,.4]],E.config.products.map(p=>E.config.segments[p].weights));
const previous=clone(simple);previous.PRODUCCION_META.moldTargets={};previous.__finishedGoods={esencial:10};
const stockOnly=E.closeMany([{id:'A',state:previous,catalog,round:1}]).A;
record('sell_opening_stock','MD 7.5: existing finished stock remains sellable with zero current production',10,stockOnly.sales[0].sold);
const close=E.closeMany([{id:'A',state:base,catalog,round:1}]).A;
record('sales_stock_cap','MD 7.5: sales never exceed opening stock plus production',true,close.sales.every(s=>s.sold<=s.available));
record('price_revenue','MD 8: premium revenue uses player price without automatic markup',250,E.closeMany([{id:'A',state:fixture(1,{},2),catalog,round:1}]).A.sales[2].price);

const priceInfo=REVIEW.breakdown(items.find(i=>i.id==='MESA_CORTE'),{state:{},drafts:{MESA_CORTE:{quantities:{mesa:1}}},catalog,round:1,rules:RULES});
record('capitalized_setup','MD 5.2: mesa purchase includes 3% installation and 2% training',2625,priceInfo.outflow);
const closed=CYCLE.close({state:base,catalog,round:1,capital:200000});
record('annual_maintenance','MD 5.2: annual maintenance/12 is charged even without an optional policy',true,closed.financial.detalleGastos.some(x=>/mantenimiento/i.test(x.concepto)&&x.importe>0));
record('mype_payroll','MD 5.1: MYPE monthly payroll', [1690.8,2254.4,4191.36,1690.8,3104.16,4952.4,1690.8,3104.16,4952.4],['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].flatMap(id=>items.find(i=>i.id===id).options.map(o=>o.cost)));
record('discount','MD 5.3: raw-material purchase discount applied once',230,REVIEW.breakdown(items.find(i=>i.id==='CUERO'),{state:{},drafts:{CUERO:{quantities:{cuero_sint:10}}},catalog,round:1,rules:RULES}).outflow);
record('costs_and_cash','MD 5.3: retain purchased but unused MP as an asset',true,closed.financial.balanceGeneral.inventarioMP>0);
const fifo=clone(simple);fifo.PRODUCCION_META.moldTargets={molde_1:1};fifo.__inventarioMP={cuero_sint:.3,acc_eco:1,hilo_std:6};for(const id of ['CUERO','ACCESORIOS','HILO'])setQuantities(fifo,id,{});
const carried=CYCLE.close({state:fifo,catalog,round:1,capital:200000});
record('opening_mp','MD 3.2: initial MP inventory feeds actual production',1,carried.receipt.produced);
record('opening_mp_consumed','MD 3.2: debit actual consumed opening inventory',{cuero_sint:0,acc_eco:0,hilo_std:0},Object.fromEntries(['cuero_sint','acc_eco','hilo_std'].map(id=>[id,carried.state.__inventarioMP[id]])));

// Verify physical balances separately from the conformance verdict.
for(const m of mixed.plan.materials)assert.ok(m.consumption<=m.available+1e-9);
for(const s of closed.receipt.sales)assert.ok(s.sold<=s.available);
fs.mkdirSync(OUT,{recursive:true});
const result={date:'2026-10-27',source:'User Markdown sections 1-11 and attached Costos De Producción',cases,details:{mixProduced:mixed.plan.productLines.map(l=>l.plannedUnits),mixMaterials:mixed.plan.materials,sourceReputation:mdReputation(premium),runtimeReputation:prepare(premium).scores.reputation,threeCompanyAssigned:assigned,stockOnlySales:stockOnly.sales,baseFinance:closed.financial.estadoResultados},counts:{conforme:cases.filter(x=>x.status==='CONFORME').length,difiere:cases.filter(x=>x.status==='DIFIERE').length}};
fs.writeFileSync(path.join(OUT,'runtime_evidence.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({counts:result.counts,cases},null,2));
