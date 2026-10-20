'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cerrarCiclo}=require('../js/engine/ciclo.js');
const {adjuntarCaja,resumirLibro}=require('../js/engine/caja.js');
const {crearSim1,crearSim2,crearSim3}=require('./escenarios_excel.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const create of [crearSim1,crearSim2,crearSim3])test('ledger reconciles four statements and carries cash: '+create.name,()=>{
  const scenario=create();let history={};
  for(const [i,cycle] of scenario.ciclos.entries()){
    const out=adjuntarCaja(cerrarCiclo({ciclo:i+1,empresas:scenario.empresas,...cycle,historialPorEmpresa:history},scenario.overrides),{historialAnterior:history,capitalPorEmpresa:Object.fromEntries(scenario.empresas.map(id=>[id,1000000])),overrides:scenario.overrides});
    for(const [id,r] of Object.entries(out.resultadosPorEmpresa)){
      const f=r.financial,book=r.libroMovimientos,sum=resumirLibro(book),bc=f.balanceCaja,bg=f.balanceGeneral,fc=f.flujoCaja;
      assert.equal(new Set(book.movimientos.map(m=>m.id)).size,book.movimientos.length,'movimientos únicos');
      near(bc.cajaInicial+bc.entradas-bc.salidas,bc.cajaFinal);
      near(bg.activos,bg.deuda+bg.patrimonio);
      near(fc.operacion+fc.inversion+fc.financiamiento,bc.cajaFinal-bc.cajaInicial);
      near(sum.cajaFinal,bc.cajaFinal);near(sum.utilidad,f.estadoResultados.utilidad);
      near(f.estadoResultados.ingresos-f.estadoResultados.costos,f.estadoResultados.utilidad);
      near(bc.cajaInicial,history[id]?.cajaFinal??1000000);
      assert.equal(bg.efectivo,bc.cajaFinal);
      assert.ok(book.movimientos.some(m=>m.concepto==='Alquiler del local'));
      assert.ok(book.movimientos.some(m=>m.concepto==='Limpieza y servicios generales'));
    }
    history=out.historialPorEmpresa;
  }
});
