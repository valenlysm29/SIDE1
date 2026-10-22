'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {adjuntarCaja}=require('../js/engine/caja.js');
const {cerrarCiclo}=require('../js/engine/ciclo.js');
const {decision}=require('./escenarios_excel.cjs');
const cerca=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function ejecutar(d,h={},base=100000){const c=cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:d},historialPorEmpresa:h,ciclo:(h.A?.ultimoCiclo||0)+1});return adjuntarCaja(c,{capitalPorEmpresa:{A:100000},baseCajaPorEmpresa:{A:base},historialAnterior:h});}

test('Cierres conservan ingresos y estados de cada ciclo sin anidar el historial',()=>{
 const first=ejecutar(decision()),second=ejecutar(decision(),first.historialPorEmpresa);
 const history=second.historialPorEmpresa.A.financialHistory;
 assert.deepEqual(history.map(row=>row.round),[1,2]);
 assert.ok(history.every(row=>row.estadoResultados.ingresos>0));
 assert.ok(history.every(row=>!row.history));
 assert.equal(history[0].balanceCaja.cajaFinal,history[1].balanceCaja.cajaInicial);
 assert.deepEqual(second.resultadosPorEmpresa.A.financial.history,history);
 assert.equal(first.historialPorEmpresa.A.financialHistory.length,1);
});
test('Caja paga compra MP una vez, no vuelve a cobrar consumo ni depreciación',()=>{
 const d=decision({maquinaria:{mesa:1,'INF-02':1}}),one=ejecutar(d),r=one.resultadosPorEmpresa.A,f=r.financial;
 const compraActivos=r.costos.detalles.maquinaria.reduce((sum,x)=>sum+x.salidaCompra*x.cantidad,0);
 cerca(f.flujoCaja.compraActivos,compraActivos);
 cerca(f.flujoCaja.pagosOperacion,r.costosTotales-r.costos.depreciacion-r.costos.valorConsumidoNeto+r.costos.valorCompradoNeto);
 cerca(f.balanceCaja.cajaFinal,100000+r.ingresos-f.flujoCaja.pagosOperacion-compraActivos);
 const two=ejecutar({...d,compras:{}},one.historialPorEmpresa),s=two.resultadosPorEmpresa.A;
 assert.equal(s.financial.flujoCaja.compraActivos,0);cerca(s.financial.balanceCaja.cajaInicial,f.balanceCaja.cajaFinal);
 const repeated=ejecutar({...d,maquinaria:{},compras:{}},one.historialPorEmpresa);
 cerca(repeated.resultadosPorEmpresa.A.costos.depreciacion,r.costos.depreciacion);
 cerca(repeated.resultadosPorEmpresa.A.costos.costoMantenimiento,r.costos.costoMantenimiento);
 const restored=ejecutar({...d,compras:{}},repeated.historialPorEmpresa);
 assert.equal(restored.resultadosPorEmpresa.A.financial.flujoCaja.compraActivos,0,'Omitir activos no los liquida ni permite otra compra artificial');
});
test('Riesgo bancario afecta préstamo nuevo, preserva tasa de deuda anterior y pondera ampliación',()=>{
 const d=decision({seleccion:['FIN-01A'],montoPrestamo:5000,teaBase:20}),one=ejecutar(d),r=one.resultadosPorEmpresa.A;
 const tasa20=Math.pow(1.2,1/12)-1,tasa23=Math.pow(1.23,1/12)-1;
 cerca(r.financial.estadoResultados.intereses,5000*tasa20);
 const two=ejecutar({...d,montoPrestamo:0},one.historialPorEmpresa),s=two.resultadosPorEmpresa.A;
 cerca(s.financial.estadoResultados.intereses,5000*tasa20);
 const three=ejecutar(d,two.historialPorEmpresa),u=three.resultadosPorEmpresa.A;
 cerca(u.financial.estadoResultados.intereses,5000*tasa20+5000*tasa23);
 cerca(three.historialPorEmpresa.A.tasaMensualVigente,(tasa20+tasa23)/2);
 cerca(u.financial.estadoResultados.utilidad,u.utilidad-u.financial.estadoResultados.intereses);
});
test('Transición de caja declarada se usa una vez; ledger anterior no entra al cierre',()=>{
 const one=ejecutar(decision(),{},81234);cerca(one.resultadosPorEmpresa.A.financial.balanceCaja.cajaInicial,81234);
 const two=ejecutar(decision(),one.historialPorEmpresa,9);cerca(two.resultadosPorEmpresa.A.financial.balanceCaja.cajaInicial,one.historialPorEmpresa.A.cajaFinal);
});
