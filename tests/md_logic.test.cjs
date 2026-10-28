'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),scope);
const catalog=JSON.parse(JSON.stringify(scope.window.SIDE_DECISION_CATALOG)),items=catalog.flatMap(c=>c.items),item=id=>items.find(i=>i.id===id);
const PRO=require('../js/production_model'),E=require('../js/engine/cierre'),CYCLE=require('../js/cycle_model'),REVIEW=require('../js/decision_review_model'),RULES=require('../js/side_rules'),BUS=require('../js/business_rules');
const clone=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function state(){const s={};for(const [id,q] of Object.entries({MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1,ens_semi:1,ens_ind:1},ACABADOS:{aca_basica:1,aca_ind:1},PERS_CORTE:{corte_basico:1,corte_exp:1},PERS_ENSAMBLE:{ens_personal_basico:1,ens_personal_ind:1,ens_personal_esp:1},PERS_ACABADO:{aca_personal_tec:1,aca_personal_art:1},CUERO:{cuero_sint:60,cuero_std:110,cuero_prem:30},ACCESORIOS:{acc_eco:200,acc_prem:190},HILO:{hilo_ref:1500,hilo_prem:1400}}))s[id]={round:1,quantities:q,...(item(id).asset?{purchases:{1:q}}:{})};
  s.PERS_ENSAMBLE.assignments={ens_personal_basico:{ens_ind:1},ens_personal_ind:{ens_basica:1},ens_personal_esp:{ens_semi:1}};
  s.PERS_ACABADO.assignments={aca_personal_tec:{aca_ind:1},aca_personal_art:{aca_basica:1}};
  s.JEFATURA={round:1,optionIds:['no_jefatura']};s.REGIMEN_LABORAL={round:1,optionIds:['mype']};s.CANALES={round:1,optionIds:['web']};
  s.MOLDE={round:1,optionIds:['molde_1','molde_2','molde_3']};s.PRODUCCION_META={round:1,moldTargets:{molde_1:150,molde_2:140,molde_3:95},prices:{esencial:40,urbano:120,premium:250}};s.INV_MARKETING={round:1,value:3000};return s;
}
function context(s=state(),round=1){return {state:s,catalog,drafts:{},round,rules:RULES};}
test('document example: matrix, all N3 efficiency, 30 days and sequential production',()=>{
 const plan=PRO.calculate(context());assert.equal(plan.days,30);assert.deepEqual(plan.processes.map(p=>p.dailyCapacity),[14,31.4,24]);assert.equal(plan.efficiency,.92);assert.equal(plan.processCapacity,386);
 assert.deepEqual(plan.productLines.map(p=>p.plannedUnits),[150,140,78]);assert.equal(plan.producibleUnits,368);assert.deepEqual(plan.materials.map(m=>m.consumption),[155.6,368,2894]);
});
test('corrected actual consumption gives exact reputation and quality factors',()=>{
 const r=E.prepare({id:'A',...context()});near(r.reputation.factorProduccion,78/368*10);near(r.reputation.factorMO,2/7*10);near(r.reputation.factorMP,((168/368)+(1394/2894))/3*10);assert.equal(r.reputation.factorPublicidad,3);near(r.scores.reputation,2.7760170074159287);
 assert.deepEqual(r.reputation.consumo,{cuero_sint:60,cuero_std:95.6,cuero_prem:0,acc_eco:200,acc_prem:168,hilo_std:0,hilo_ref:1500,hilo_prem:1394});near(r.lines[0].quality,(r.reputation.factorProduccion+r.reputation.factorMP)/2);
});
test('advertising is capped, debited once and contributes only its reputation factor',()=>{
 const s=state();s.INV_MARKETING={round:1,optionIds:['mkt_alta']};const r=E.prepare({id:'A',...context(s)});assert.equal(r.reputation.factorPublicidad,10);assert.equal(r.demandFactor,1);assert.equal(REVIEW.breakdown(item('INV_MARKETING'),context(s)).outflow,12000);
 s.INV_MARKETING={round:1,optionIds:['mkt_alta']};assert.equal(BUS.advertising({state:s}),10000);
});
test('full closure preserves chosen prices, inventory balances and corrected MP valuation',()=>{
 const r=CYCLE.close({...context(),capital:200000});assert.equal(r.receipt.produced,368);assert.equal(r.receipt.sold,368);assert.equal(r.receipt.revenue,42300);assert.equal(r.receipt.sales[2].price,250);
 near(r.state.__inventarioMP.cuero_std,14.4);assert.equal(r.state.__inventarioMP.acc_prem,22);assert.equal(r.state.__inventarioMP.hilo_prem,6);
 near(r.financial.balanceGeneral.inventarioMP,14.4*45*.92+22*9*.92+6*7*.92+30*80);const er=r.financial.estadoResultados;near(er.costosProduccion,22082.24+21749.12+er.depreciacion);near(r.financial.balanceGeneral.activos,r.financial.balanceGeneral.pasivoPatrimonio);
 assert.match(require('../js/student_financial_view').incomeHtml(er),/Costo de Ventas/);
 assert.equal(r.receipt.modelVersion,'md-20261027');assert.equal(CYCLE.close({...context(r.state),ledger:r.ledger,capital:200000}).reused,true);
});
test('MYPE and No MYPE labor, acquisition and maintenance follow the two source columns',()=>{
 near(BUS.laborCost('corte_basico','MYPE'),1690.8);near(BUS.laborCost('corte_basico','NO_MYPE'),1856.5384615384614);near(BUS.laborCost('corte_exp','NO_MYPE'),2475.3846153846152);
 for(const [regimen,mesa,mold,maintenance] of [['mype',2625,303,10.4166666667],['no_mype',2700,306,16.6666666667]]){
  const ctx={...context({REGIMEN_LABORAL:{optionIds:[regimen]}}),drafts:{MESA_CORTE:{quantities:{mesa:1}},MOLDE:{optionIds:['molde_1']}}};near(REVIEW.breakdown(item('MESA_CORTE'),ctx).outflow,mesa);near(REVIEW.breakdown(item('MOLDE'),ctx).outflow,mold);
  near(BUS.maintenance({REGIMEN_LABORAL:{optionIds:[regimen]},MESA_CORTE:{purchases:{1:{mesa:1}}}},catalog),maintenance);
 }
});
test('base maintenance recurs in the engine while the optional decision keeps its original fee',()=>{
 const s=state(),ctx=context(s),b=REVIEW.section(catalog.find(c=>c.cat==='B'),ctx),r=CYCLE.close({...ctx,capital:200000,ledger:{'1:B':b.net},sectionsByRound:{1:{B:{...b,recordedNet:b.net}}}});
 assert.equal(b.items.find(i=>i.id==='MANTENIMIENTO').outflow,0);near(r.ledger['1:MANTENIMIENTO_AUTO'],-r.receipt.maintenanceCost);
 const optional=state();optional.MANTENIMIENTO={round:1,optionIds:['correctivo']};const second=CYCLE.close({...context(optional),capital:200000});assert.equal(REVIEW.breakdown(item('MANTENIMIENTO'),context(optional)).outflow,1500);near(second.ledger['1:MANTENIMIENTO_AUTO'],-second.receipt.maintenanceCost);
 const paid=Math.round(BUS.maintenance(s,catalog)*100)/100,old={...b,net:b.net-paid,items:b.items.map(i=>i.id==='MANTENIMIENTO'?{...i,type:'info',outflow:paid}:i)};
 const compatible=CYCLE.close({...ctx,capital:200000,ledger:{'1:B':old.net},sectionsByRound:{1:{B:{...old,recordedNet:old.net}}}});assert.equal(compatible.ledger['1:MANTENIMIENTO_AUTO'],0);
});
test('the engine retains all owned mold types without adding a multi-purchase control',()=>{
 const ctx={...context({MOLDE:{round:0,purchases:{0:{molde_1:1,molde_2:1,molde_3:1}}}}),drafts:{MOLDE:{optionIds:[]}}};assert.equal(REVIEW.breakdown(item('MOLDE'),ctx).outflow,0);near(BUS.maintenanceEstimate(ctx),5000*.05/12);
 const old={...context({MOLDE:{round:1,optionIds:['molde_1']}}),round:2,drafts:{MOLDE:{optionIds:[]}}};near(BUS.maintenanceEstimate(old),1.25);
});
const realOnly={...E.config,simulatedCompetitors:{...E.config.simulatedCompetitors,enabled:false}};
function participants(count,product='premium'){return Array.from({length:count},(_,i)=>({id:String(i),hasChannel:true,scores:{reputation:5},demandFactor:1,lines:[{id:product,price:250,quality:5,produced:0,available:10000}]}));}
test('largest remainders preserve the market and are independent of input order',()=>{
 for(const id of E.config.products)for(const count of [1,2,3,7,13,99]){const rows=participants(count,id),a=E.allocate(rows,realOnly),b=E.allocate([...rows].reverse(),realOnly);assert.ok(Math.abs(Object.values(a).reduce((sum,r)=>sum+r.products[id].asignado,0)-E.config.segments[id].totalMarket*E.config.segments[id].penetration)===0);assert.deepEqual(a,b);}
 assert.deepEqual(Object.values(E.allocate(participants(3),realOnly)).map(x=>x.products.premium.asignado),[267,267,266]);assert.deepEqual(E.allocate([]),{});
});
test('price guards support identical prices, arbitrary chosen prices and zero total scores',()=>{
 const same=participants(3,'esencial');for(const r of Object.values(E.allocate(same,realOnly)))assert.equal(r.products.esencial.puntajePrecio,100);
 const rows=participants(3,'urbano').map(r=>({...r,scores:{reputation:0},lines:[{...r.lines[0],price:500,quality:0}]}));for(const r of Object.values(E.allocate(rows,realOnly)))assert.equal(r.products.urbano.puntajePrecio,0);
 assert.equal(Object.values(E.allocate(rows,realOnly)).reduce((s,r)=>s+r.products.urbano.asignado,0),3500);
});
test('opening finished stock sells without new labor, material or production plan',()=>{
 const s={CANALES:{optionIds:['web']},__finishedGoods:{esencial:10},__economicHistory:{goodsQuality:{esencial:8}},PRODUCCION_META:{round:2,moldTargets:{}}};
 const r=E.closeMany([{id:'A',state:s,catalog,round:2}]).A;assert.equal(r.sales[0].sold,10);assert.equal(r.revenue,425);assert.equal(r.lines[0].quality,8);
});
test('unused premium purchases do not raise reputation; all thread levels form its denominator',()=>{
 const s=state();s.PRODUCCION_META.moldTargets={molde_1:1};s.HILO.quantities={hilo_std:3,hilo_prem:3};const r=E.prepare({id:'A',...context(s)});assert.equal(r.reputation.proporciones.CUERO,0);assert.equal(r.reputation.proporciones.HILO,.5);
});
test('sub-cent physical material balances survive repeated closures',()=>{
 const s=state();s.PRODUCCION_META.moldTargets={molde_1:1};s.CUERO.quantities={cuero_sint:.305};s.ACCESORIOS.quantities={acc_eco:1};s.HILO.quantities={hilo_std:6};
 const r=CYCLE.close({...context(s),capital:200000});near(r.state.__inventarioMP.cuero_sint,.005);
});
test('unsold production costs remain in inventory and sold costs are recognized once',()=>{
 const s=state();s.__finishedGoods={esencial:5000};const r=CYCLE.close({...context(s),capital:200000});assert.ok(r.receipt.sales[0].sold<r.receipt.sales[0].available);assert.equal(r.state.__finishedGoods.esencial,5150-r.receipt.sales[0].sold);assert.ok(r.financial.balanceGeneral.inventarioPT>0);near(r.financial.balanceGeneral.inventarioPT+r.financial.estadoResultados.costoVentas,r.financial.estadoResultados.costosProduccion);near(r.financial.balanceGeneral.activos,r.financial.balanceGeneral.pasivoPatrimonio);
 const saved=clone(r.state);saved.__financialSnapshots[1].estadoResultados.ingresos=123;const retry=CYCLE.close({...context(saved),capital:200000,ledger:r.ledger});assert.equal(retry.financial.estadoResultados.ingresos,123);
});
