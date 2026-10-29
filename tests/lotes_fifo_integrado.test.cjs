'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/cycle_model'),E=require('../js/engine/cierre'),F=require('./economic_v19_fixture.cjs');
const close=(state,round,prev,events=[])=>C.close({state,round,catalog:F.catalog,capital:500000,ledger:prev?.ledger||{},sectionsByRound:prev?.financialSections||{},events,financialPolicy:{cycles:4}});
const cents=x=>Math.round(x*100);
test('FIFO concilia tres ciclos, calidades y costos distintos',()=>{
 let s=F.state(1,{},2);s.CANALES.optionIds=[];s.CUERO.quantities={cuero_sint:63};s.ACCESORIOS.quantities={acc_eco:90};s.HILO.quantities={hilo_std:1170};
 const a=close(s,1);assert.equal(a.receipt.sold,0);assert.equal(a.state.__goodsLots[0].quality,7);assert.equal(a.state.__goodsLots[0].available,90);
 s=F.state(2,a.state,2);s.CUERO.quantities={cuero_prem:63};s.ACCESORIOS.quantities={acc_prem:90};s.HILO.quantities={hilo_prem:1170};
 const b=close(s,2,a,[{effect:{revenuePct:-95}}]);const sales=b.receipt.sales.find(x=>x.id==='premium');assert.ok(sales.sold>0&&sales.sold<90);assert.equal(sales.lotSales[0].id,'1-premium');assert.equal(sales.lotSales[0].units,sales.sold);assert.equal(sales.lotSales[1].units,0);
 assert.equal(b.state.__goodsLots.length,2);assert.equal(b.state.__goodsLots[1].quality,12);assert.notEqual(b.state.__goodsLots[0].unitCost,b.state.__goodsLots[1].unitCost);
 assert.equal(cents(a.financial.balanceGeneral.inventarioPT+b.financial.estadoResultados.costosProduccion-b.financial.estadoResultados.costoVentas),cents(b.financial.balanceGeneral.inventarioPT));
 s=F.state(3,b.state,2);s.PRODUCCION_META.moldTargets={};s.CUERO.quantities={};s.ACCESORIOS.quantities={};s.HILO.quantities={};const c=close(s,3,b);
 assert.equal(c.receipt.sales[2].lotSales[0].id,'1-premium');assert.equal(c.state.__goodsLots.length,0);assert.equal(cents(b.financial.balanceGeneral.inventarioPT-c.financial.estadoResultados.costoVentas),cents(c.financial.balanceGeneral.inventarioPT));
 for(const x of [a,b,c])assert.equal(x.financial.balanceGeneral.activos,x.financial.balanceGeneral.pasivoPatrimonio);
});
test('umbrales reales CONS-03 y CONS-08 distinguen puntaje y eficiencia física',()=>{
 const s=F.state();for(const [id,k] of Object.entries({ENSAMBLE:'ens_basica',ACABADOS:'aca_basica',PERS_CORTE:'corte_basico',PERS_ENSAMBLE:'ens_personal_basico',PERS_ACABADO:'aca_personal_basico'})){s[id].quantities={[k]:1};s[id].optionIds=[k];}s.MOLDE.optionIds=['molde_1'];s.JEFATURA.optionIds=['no_jefatura'];s.CANALES.optionIds=[];
 assert.equal(E.scores(s).efficiency,5);assert.equal(E.prepare({state:s,catalog:F.catalog,round:1}).messages.some(x=>x.id==='CONS-08'),false);
 s.PERS_CORTE.quantities={};s.PERS_CORTE.optionIds=[];assert.equal(E.scores(s).efficiency,4);assert.equal(E.prepare({state:s,catalog:F.catalog,round:1}).messages.some(x=>x.id==='CONS-08'),true);
 s.PERS_ENSAMBLE.quantities={};s.PERS_ENSAMBLE.optionIds=[];assert.ok(E.scores(s).efficiency<4);const p=E.prepare({state:s,catalog:F.catalog,round:1});assert.ok(p.messages.some(x=>x.id==='CONS-03'));assert.ok(p.plan.efficiency>.8);
});
test('CONS-04 con umbral real tras dos ciclos de reputación baja',()=>{
 const s=F.state();s.MOLDE.optionIds=['molde_1'];s.PRODUCCION_META.moldTargets={molde_1:90};s.CANALES.optionIds=[];s.JEFATURA.optionIds=['no_jefatura'];
 for(const id of ['ENSAMBLE','ACABADOS','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']){s[id].quantities={};s[id].optionIds=[];}assert.ok(E.scores(s).reputation<3);
 const a=close(s,1);assert.equal(a.state.__economicHistory.lowReputationCycles,1);assert.ok(!a.receipt.consequences.some(x=>x.id==='CONS-04'));
 const t=structuredClone(a.state);t.PRODUCCION_META.round=2;const b=close(t,2,a);assert.equal(b.state.__economicHistory.lowReputationCycles,2);assert.ok(b.receipt.consequences.some(x=>x.id==='CONS-04'));
});
test('dos calidades prémium conservan sus precios por unidad y FIFO',()=>{
 const s=F.state(1,{},2);s.PRODUCCION_META.moldTargets={};s.__finishedGoods={premium:12};s.__goodsLots=[{id:'old',segment:'premium',mold:'molde_3',cycle:1,produced:5,available:5,quality:3,unitCost:10},{id:'new',segment:'premium',mold:'molde_3',cycle:2,produced:7,available:7,quality:7,unitCost:20}];
 const r=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:3}]).a,line=r.sales[2];assert.equal(line.sold,12);assert.deepEqual(line.lotSales.map(x=>[x.units,x.price]),[[5,162.5],[7,350]]);assert.equal(line.revenue,3262.5);assert.equal(line.points.reduce((sum,x)=>sum+x.revenue,0),line.revenue);
});
test('varias tiendas concilian lotes FIFO, ingresos, inventario y cuentas por cobrar',()=>{
 const s=F.state(1,{},2);s.PRODUCCION_META.moldTargets={};s.CANALES={round:1,optionIds:['web','miraflores','los_olivos'],quantities:{miraflores:2,los_olivos:1}};
 s.__finishedGoods={premium:12};s.__goodsLots=[{id:'old',segment:'premium',mold:'molde_3',cycle:1,produced:5,available:5,quality:3,unitCost:10},{id:'new',segment:'premium',mold:'molde_3',cycle:2,produced:7,available:7,quality:7,unitCost:20}];
 const r=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:3}]).a,line=r.sales[2],points=line.points;
 assert.equal(points.length,4);assert.equal(points.reduce((sum,p)=>sum+p.sold,0),line.sold);assert.equal(points.reduce((sum,p)=>sum+p.revenue,0),line.revenue);
 for(const p of points){assert.equal(p.lotSales.reduce((sum,l)=>sum+l.units,0),p.sold);assert.equal(p.lotSales.reduce((sum,l)=>sum+l.revenue,0),p.revenue);}
 for(const lot of line.lotSales)assert.equal(points.flatMap(p=>p.lotSales).filter(x=>x.id===lot.id).reduce((sum,x)=>sum+x.units,0),lot.units);
 assert.equal(line.lotSales.reduce((sum,l)=>sum+l.units,0),line.sold);assert.equal(line.lots.reduce((sum,l)=>sum+l.available,0),line.available);assert.equal(r.receivable,Math.round(r.revenue*r.creditRate*100)/100);assert.equal(r.goods.premium,line.available-line.sold);
});
test('cada tienda vende solo sus lotes y conserva los saldos por ubicación',()=>{
 const s=F.state(3,{},2);s.PRODUCCION_META.moldTargets={};s.CANALES={round:3,optionIds:['los_olivos'],quantities:{los_olivos:1},transfers:{premium:{'los_olivos:1':0}}};
 s.__finishedGoods={premium:10};s.__storeInventory={premium:{'miraflores:1':5,'los_olivos:1':5}};
 s.__goodsLots=[{id:'a',segment:'premium',mold:'molde_3',cycle:1,produced:5,available:5,quality:3,unitCost:10,locations:{'miraflores:1':5}},{id:'b',segment:'premium',mold:'molde_3',cycle:2,produced:5,available:5,quality:7,unitCost:20,locations:{'los_olivos:1':5}}];
 const result=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:3}]).a,line=result.sales[2],point=line.points[0];
 assert.equal(line.sold,5);assert.deepEqual(point.lotSales.map(x=>x.id),['b']);assert.equal(line.lotSales[0].units,0);assert.equal(line.lotSales[1].units,5);assert.equal(line.revenue,1750);assert.equal(result.goods.premium,5);assert.equal(result.storeInventory.premium['miraflores:1'],5);assert.equal(line.lots[0].closingLocations['miraflores:1'],5);
});
test('transferencias manuales no pueden superar el stock central',()=>{
 const s=F.state(1,{},2);s.CANALES={round:1,optionIds:['web'],transfers:{premium:{web:10000}}};
 assert.throws(()=>E.closeMany([{id:'a',state:s,catalog:F.catalog,round:1}]),/Transferencia manual inválida/);
});
test('múltiples lotes antiguos sin ubicación verificable se bloquean',()=>{
 const s=F.state(3,{},2);s.PRODUCCION_META.moldTargets={};s.__finishedGoods={premium:2};s.__storeInventory={premium:{web:1}};s.__goodsLots=[{id:'a',segment:'premium',available:1,quality:3},{id:'b',segment:'premium',available:1,quality:9}];
 assert.throws(()=>E.closeMany([{id:'a',state:s,catalog:F.catalog,round:3}]),/sin atribución verificable/);
});
test('tres ciclos con dos tiendas mantienen FIFO por ubicación y concilian el balance',()=>{
 let s=F.state(1,{},2);s.CUERO.quantities={cuero_sint:63};s.ACCESORIOS.quantities={acc_eco:90};s.HILO.quantities={hilo_std:1170};s.CANALES={round:1,optionIds:['miraflores','los_olivos'],transfers:{premium:{'miraflores:1':30,'los_olivos:1':20}}};
 const a=close(s,1,null,[{effect:{revenuePct:-100}}]);assert.deepEqual(a.state.__goodsLots[0].locations,{'los_olivos:1':20,'miraflores:1':30});assert.equal(a.receipt.sold,0);
 s=F.state(2,a.state,2);s.CUERO.quantities={cuero_prem:63};s.ACCESORIOS.quantities={acc_prem:90};s.HILO.quantities={hilo_prem:1170};s.CANALES={round:2,optionIds:['miraflores','los_olivos'],transfers:{premium:{'miraflores:1':0,'los_olivos:1':0}}};
 const b=close(s,2,a);for(const point of b.receipt.sales[2].points){assert.equal(point.sold,point.opening);assert.deepEqual(point.lotSales.map(x=>x.id),['1-premium']);}assert.equal(b.receipt.sales[2].sold,50);assert.equal(b.state.__goodsLots.find(x=>x.id==='1-premium').available,40);assert.equal(b.state.__goodsLots.find(x=>x.id==='2-premium').available,90);
 s=F.state(3,b.state,2);s.PRODUCCION_META.moldTargets={};s.CUERO.quantities={};s.ACCESORIOS.quantities={};s.HILO.quantities={};s.CANALES={round:3,optionIds:['miraflores','los_olivos']};const c=close(s,3,b);
 assert.equal(c.receipt.sales[2].sold,130);assert.equal(c.state.__goodsLots.length,0);for(const x of [a,b,c]){assert.equal(x.financial.balanceGeneral.activos,x.financial.balanceGeneral.pasivoPatrimonio);const physical=x.state.__goodsLots.reduce((sum,l)=>sum+l.available,0);assert.equal(physical,x.receipt.goods.premium);}
 assert.equal(cents(a.financial.balanceGeneral.inventarioPT+b.financial.estadoResultados.costosProduccion-b.financial.estadoResultados.costoVentas),cents(b.financial.balanceGeneral.inventarioPT));assert.equal(cents(b.financial.balanceGeneral.inventarioPT-c.financial.estadoResultados.costoVentas),cents(c.financial.balanceGeneral.inventarioPT));
});
test('saldo agregado anterior conserva ubicación registrada y no inventa su composición',()=>{
 const s=F.state(2,{},2);s.__finishedGoods={premium:10};s.__storeInventory={premium:{web:6,'miraflores:1':4}};s.__economicHistory={goodsQuality:{premium:7}};s.CANALES={round:2,optionIds:['web','miraflores'],transfers:{premium:{web:0,'miraflores:1':0}}};
 const r=E.closeMany([{id:'a',state:s,catalog:F.catalog,round:2}]).a;const line=r.sales[2];assert.equal(line.sold,10);assert.ok(line.lotSales.find(x=>x.id==='legacy-premium'));assert.equal(line.lotSales.find(x=>x.id==='2-premium').units,0);assert.equal(line.lots[0].cycle,null);assert.equal(line.lots[0].legacy,true);
});
