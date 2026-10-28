const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../js/financial_model.js');
const CFG=require('../services/finance_config.js');
function run(cycles, amounts, regimen='NO_MYPE', extra={}) {
  const ledger={},settlements={};
  for(let i=1;i<=cycles;i++){ledger[`${i}:SIM_VENTAS`]=amounts[i-1]||0;settlements[i]={regimen,sold:0,sales:[],inventory:{},financialPolicy:{cycles,...extra}};}
  return F.calculate({capital:10000,round:cycles,ledger,state:{__cycleSettlements:settlements},financialPolicy:{cycles,...extra}});
}
for(const cycles of [1,3,5])test(`impuesto solo en cierre ${cycles} y caja descuenta una vez`,()=>{
 const result=run(cycles,Array(cycles).fill(10000));
 for(const prior of result.history.slice(0,-1))assert.equal(prior.estadoResultados.impuestoRenta,0);
 const tax=cycles*10000*.295;
 assert.equal(result.estadoResultados.impuestoRenta,tax);
 assert.equal(result.estadoResultados.utilidadNetaFinal,cycles*10000-tax);
 assert.equal(result.balanceCaja.cajaFinal,10000+cycles*10000-tax);
 assert.equal(result.flujoCaja.impuestoRenta,-tax);
 const snapshot={...result};delete snapshot.history;
 const retried=F.calculate({capital:10000,round:cycles,state:{__financialSnapshots:{[cycles]:snapshot}},financialPolicy:{cycles}});
 assert.equal(retried.balanceCaja.cajaFinal,result.balanceCaja.cajaFinal);
});
test('SUNAT: general y tramos MYPE, incluyendo el límite',()=>{
 assert.equal(F.incomeTax(0,'MYPE'),0);assert.equal(F.incomeTax(-100,'NO_MYPE'),0);
 assert.equal(F.incomeTax(82500,'MYPE'),8250);
 assert.equal(F.incomeTax(92500,'MYPE'),11200);
 assert.equal(F.incomeTax(92500,'NO_MYPE'),27287.5);
 assert.equal(F.incomeTax(10000,'MYPE',{uit:100,mypeLimitUit:15,mypeRate:.2,generalRate:.3}),2850);
});
test('configuración de sala conserva duración y parámetros fiscales',()=>{
 const p=CFG.resolve({cycles:3,tax:{uit:6000,mypeRate:.12}});assert.equal(p.cycles,3);assert.deepEqual(p.tax,{uit:6000,mypeRate:.12});
});
test('utilidad acumulada no positiva no genera impuesto',()=>{
 const state={__cycleSettlements:{1:{regimen:'MYPE'},2:{regimen:'MYPE'}}};
 for(const amount of [0,-100]) {const f=F.calculate({capital:1000,round:2,state,financialPolicy:{cycles:2},ledger:{'1:SIM_GASTOS':-100,'2:SIM_GASTOS':100+amount}});assert.equal(f.estadoResultados.impuestoRenta,0);}
});
test('cierre calcula caja y base MYPE en ambos tramos',()=>{
 const below=run(3,[10000,10000,10000],'MYPE');assert.equal(below.estadoResultados.impuestoRenta,3000);assert.equal(below.balanceCaja.cajaFinal,37000);
 const over=run(1,[92500],'MYPE');assert.equal(over.estadoResultados.impuestoRenta,11200);assert.equal(over.balanceCaja.cajaFinal,91300);
 const general=run(1,[92500],'NO_MYPE');assert.equal(general.estadoResultados.impuestoRenta,27287.5);
});
