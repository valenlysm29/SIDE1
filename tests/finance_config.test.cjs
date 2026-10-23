'use strict';
const assert=require('node:assert/strict'),test=require('node:test');const F=require('../services/finance_config');const {cerrarCiclo}=require('../js/engine/ciclo');const {adjuntarCaja}=require('../js/engine/caja');const {decision}=require('./escenarios_excel.cjs');
test('financial changes preserve prior cycles, replace pending target, and retain actual random assignment',()=>{
 const first={interest:20,capitalMode:'random',capitalMin:80000,capitalMax:120000,capital:100000};
 const next=F.schedule(first,{interest:30,capitalMin:100000,capitalMax:140000},3);
 assert.equal(F.resolve(next,2).interest,20);assert.equal(F.resolve(next,3).interest,30);
 assert.equal(F.adjustment(next,2,'company',90000),0);assert.equal(F.adjustment(next,3,'company',90000),20000);
 const replaced=F.schedule(next,{capitalMin:120000,capitalMax:160000},3);assert.equal(replaced.financialSchedule.length,2);assert.equal(F.adjustment(replaced,3,'company',90000),40000);
 const onlyRate=F.schedule(first,{interest:60},2);assert.equal(F.adjustment(onlyRate,2,'company',91234),0);
});
test('capital adjustment is financing, reconciles cash, and applies only once across closures',()=>{
 const d=decision({montoPrestamo:0});const first=adjuntarCaja(cerrarCiclo({ciclo:1,empresas:['A'],decisionesPorEmpresa:{A:d}}),{capitalPorEmpresa:{A:100000}});
 const h=first.historialPorEmpresa,closed=JSON.stringify(first);
 const make=(ciclo,history)=>adjuntarCaja(cerrarCiclo({ciclo,empresas:['A'],decisionesPorEmpresa:{A:d},historialPorEmpresa:history}),{capitalPorEmpresa:{A:100000},historialAnterior:history,ajustesCapitalPorEmpresa:{A:25000}});
 const next=make(2,h),f=next.resultadosPorEmpresa.A.financial;assert.equal(f.flujoCaja.aporteCapital,25000);assert.equal(f.balanceCaja.cajaInicial+f.balanceCaja.entradas-f.balanceCaja.salidas,f.balanceCaja.cajaFinal);assert.equal(next.historialPorEmpresa.A.financialAdjustment,25000);assert.equal(JSON.stringify(first),closed);
 const third=make(3,next.historialPorEmpresa);assert.equal(third.resultadosPorEmpresa.A.financial.flujoCaja.aporteCapital,0);
});
