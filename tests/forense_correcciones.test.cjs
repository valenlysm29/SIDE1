'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../js/financial_model'),C=require('../js/cycle_model'),{catalog}=require('./economic_v19_fixture.cjs');
const original=require('./output/forense_utilidad/cierres_reales.json');
const near=(a,b)=>assert.ok(Math.abs(a-b)<.011,`${a} != ${b}`);

function mold({noDepreciation=true,produced=10,sold=10,method=[]}={}){
 const catalog=[{items:[{id:'MOLDE',noDepreciation,options:[{id:'m',cost:300}]},{id:'LOCAL_PROD'}]}];
 return F.calculate({capital:1000,catalog,ledger:{'1:B':-310,'1:SIM_VENTAS':sold*20},sectionsByRound:{1:{B:{recordedNet:-310,items:[{id:'MOLDE',outflow:300},{id:'LOCAL_PROD',outflow:10}]}}},state:{__cycleSettlements:{1:{produced,decisions:{MOLDE:{purchases:{1:{m:1}}},__catalogSelection:method},sales:[{id:'esencial',produced,available:produced,sold}]}}}});
}
for(const [produced,sold] of [[0,0],[10,0],[10,4],[10,10]])test(`molde no depreciable: producción ${produced}, ventas ${sold}`,()=>{
 const f=mold({produced,sold}),e=f.estadoResultados,b=f.balanceGeneral;
 assert.equal(e.depreciacion,0);assert.equal(e.costoVentas,0);assert.equal(e.costosProduccion,0);assert.equal(b.activosFijos,300);assert.equal(b.inventarioPT,0);assert.equal(e.gastosAdministrativos,10);assert.equal(b.activos,b.pasivoPatrimonio);assert.equal(f.flujoCaja.compraActivos,-300);assert.equal(f.flujoCaja.operacion,sold*20-10);assert.equal(f.depreciationValues.m,undefined);
});
test('la marca se respeta con métodos acelerado y por unidades; sin marca conserva depreciación',()=>{
 for(const method of [[],['FIN-02B'],['FIN-02C']])assert.equal(mold({method}).estadoResultados.depreciacion,0);
 const f=mold({noDepreciation:false});assert.equal(f.estadoResultados.depreciacion,4.75);assert.equal(f.estadoResultados.costoVentas,4.75);assert.equal(f.balanceGeneral.activosFijos,295.25);assert.equal(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);
});
test('el cierre real congelado permanece idéntico y el contrafactual solo cambia devengo',()=>{
 const r=original[1].cierre.resultadosPorEmpresa['188'],before=JSON.stringify(r);
 const args={capital:100000,catalog,round:2,state:r.state,ledger:r.ledger,sectionsByRound:r.financialSections,financialPolicy:r.receipt.financialPolicy};
 const frozen=F.calculate(args);for(const key of ['estadoResultados','balanceGeneral','flujoCaja'])assert.deepEqual(frozen[key],r.financial[key]);
 const s=structuredClone(r.state);delete s.__financialSnapshots[2];const f=F.calculate({...args,state:s});
 assert.equal(f.estadoResultados.depreciacion,59.38);assert.equal(f.estadoResultados.costoVentas,7031.59);assert.equal(f.estadoResultados.utilidadNeta,-8764.16);assert.equal(f.balanceGeneral.activosFijos,7739.49);assert.equal(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);assert.deepEqual(f.flujoCaja,r.financial.flujoCaja);assert.equal(f.depreciationValues.molde_1,4.75); // preserve C1; do not reverse history
 assert.equal(JSON.stringify(r),before);
});
test('mantenimiento opcional y automático son independientes, con deduplicación del automático antiguo',()=>{
 const r=original[0].cierre.resultadosPorEmpresa['188'],s=structuredClone(r.receipt.decisions);
 const ctx={state:s,catalog,round:1,capital:100000,financialPolicy:r.receipt.financialPolicy};
 const withOptional=C.close(ctx);assert.equal(withOptional.receipt.maintenanceCost,31.25);assert.equal(withOptional.ledger['1:MANTENIMIENTO_AUTO'],-31.25);assert.equal(withOptional.financial.estadoResultados.desgloseCostos.mantenimiento,1531.25);
 const absent=structuredClone(s);absent.MANTENIMIENTO.optionIds=[];const without=C.close({...ctx,state:absent});assert.equal(without.financial.estadoResultados.desgloseCostos.mantenimiento,31.25);near(withOptional.financial.balanceGeneral.efectivo,without.financial.balanceGeneral.efectivo-1500);
 const sections=structuredClone(without.financialSections),ledger=structuredClone(without.ledger),item=sections[1].B.items.find(x=>x.id==='MANTENIMIENTO');Object.assign(item,{type:'info',automaticMaintenance:true,outflow:31.25,net:-31.25});sections[1].B.net-=31.25;sections[1].B.recordedNet-=31.25;ledger['1:B']-=31.25;
 const old=C.close({...ctx,state:absent,ledger,sectionsByRound:sections});assert.equal(old.ledger['1:MANTENIMIENTO_AUTO'],0);assert.equal(old.financial.estadoResultados.desgloseCostos.mantenimiento,31.25);assert.equal(old.financial.balanceGeneral.efectivo,without.financial.balanceGeneral.efectivo);
});
