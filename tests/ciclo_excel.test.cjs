'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cerrarCiclo,prepararEmpresa}=require('../js/engine/ciclo.js');
const PRO=require('../js/engine/produccion.js');
const {decision,mercados,crearSim2,crearSim3,ejecutarEscenario}=require('./escenarios_excel.cjs');
const cerca=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('Lotes de igual material conservan sus precios distintos al venderse',()=>{
  const d=decision({seleccion:['INF-04','INF-07','RH-10A'],jefes:1,lotes:[{segmento:'SEG-01',cantidad:10,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:40},{segmento:'SEG-01',cantidad:10,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:80}]});
  const r=cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:d}},{MERCADOS:mercados(100)}).resultadosPorEmpresa.A;
  assert.equal(r.unidadesVendidas,20);assert.equal(r.ingresos,1200);
});
test('La penalización bancaria se conserva hasta el préstamo siguiente',()=>{
  let c=cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:decision({seleccion:[]})}});
  const saludable=decision({seleccion:['RH-10B','COM-01A','INS-09A','INS-10B','INS-11C','FIN-01A']});
  c=cerrarCiclo({ciclo:2,empresas:['A'],decisionesPorEmpresa:{A:saludable},historialPorEmpresa:c.historialPorEmpresa});
  assert.equal(c.historialPorEmpresa.A.tasaAdicionalPP,3);
  c=cerrarCiclo({ciclo:3,empresas:['A'],decisionesPorEmpresa:{A:{...saludable,montoPrestamo:5000}},historialPorEmpresa:c.historialPorEmpresa});
  assert.equal(c.resultadosPorEmpresa.A.financiamiento.tasaTEA,23);assert.equal(c.historialPorEmpresa.A.tasaAdicionalPP,0);
});
test('SIM-2 dispara las ocho reglas en tres ciclos; no atribuye efectos al lote calidad4',()=>{
  const escenario=crearSim2(),resultados=ejecutarEscenario(escenario,cerrarCiclo);
  const ids=new Set(resultados.flatMap(c=>Object.values(c.resultadosPorEmpresa).flatMap(r=>r.consecuencias.mensajes.map(m=>m.id))));
  for(let i=1;i<=8;i++)assert.ok(ids.has('CONS-'+String(i).padStart(2,'0')),`falta CONS-${i}`);
  const b=resultados[0].resultadosPorEmpresa.B;
  cerca(b.consecuencias.efectos.factorProduccion,0.665);
  assert.equal(b.lotes[1].calidad,4);assert.equal(b.lotes[1].resultado,'No alcanza el segmento');cerca(b.lotes[1].precioEfectivo,250);
  cerca(b.lotes[0].precioEfectivo,162.5);cerca(resultados[0].resultadosPorEmpresa.A.lotes[0].precioEfectivo,350);
  cerca(resultados[1].resultadosPorEmpresa.B.consecuencias.efectos.factorDemanda,0.8);
  cerca(resultados[1].resultadosPorEmpresa.B.financiamiento.tasaTEA,23);
  cerca(resultados[2].resultadosPorEmpresa.B.produccion.totalProducido,0);
});
test('factores productivos reducen consumo y restauran MP antes de calcular costos',()=>{
  const d=decision(),original=JSON.stringify(d),base=PRO.calcularProduccion(d),r=prepararEmpresa(d);
  assert.equal(JSON.stringify(d),original,'el motor debe ser puro');
  for(const codigo of Object.keys(base.consumoPorInsumo)){
    cerca(r.produccion.inventarioFinal[codigo]+r.produccion.consumoPorInsumo[codigo],base.inventarioInicial[codigo]+base.compras[codigo]);
    assert.ok(r.produccion.consumoPorInsumo[codigo]<=base.consumoPorInsumo[codigo]);
    cerca(r.costos.inventarioFinal[codigo],r.produccion.inventarioFinal[codigo]);
  }
  cerca(r.produccion.consumoTotal.cuero,r.produccion.totalProducido*0.3);
});
test('redondeo de consecuencia conserva 200×0.70×0.95=133 y acelerada recibe ciclo real',()=>{
  const d=decision({personal:{corte:[4,0,0],ensamble:[4,0,0],acabado:[4,0,0]}});
  assert.equal(prepararEmpresa(d).produccion.totalProducido,133);
  const acelerada=decision({seleccion:[...d.seleccion,'FIN-02C']});
  const inicial=cerrarCiclo({ciclo:1,empresas:['A'],decisionesPorEmpresa:{A:acelerada}},{MERCADOS:mercados(10)}).resultadosPorEmpresa.A;
  const posterior=cerrarCiclo({ciclo:13,empresas:['A'],decisionesPorEmpresa:{A:acelerada}},{MERCADOS:mercados(10)}).resultadosPorEmpresa.A;
  assert.ok(posterior.costos.depreciacion<inicial.costos.depreciacion);
  assert.deepEqual(posterior.decisiones,acelerada);
});
test('SIM-3 arrastra existencias, replica decisiones y mantiene eliminación inicial',()=>{
  const escenario=crearSim3(),original=JSON.stringify(escenario),resultados=ejecutarEscenario(escenario,cerrarCiclo);
  assert.equal(JSON.stringify(escenario),original);
  assert.deepEqual(resultados[0].eliminadas,['E']);assert.ok(!resultados[2].resultadosPorEmpresa.E);
  assert.deepEqual(resultados[1].replicadas,['B']);assert.deepEqual(resultados[1].resultadosPorEmpresa.B.decisiones,resultados[0].resultadosPorEmpresa.B.decisiones);
  assert.ok(resultados[0].resultadosPorEmpresa.A.inventarioSinVender>0);
  for(const [indice,ciclo] of resultados.entries())for(const [id,r] of Object.entries(ciclo.resultadosPorEmpresa)){
    const previo=indice?resultados[indice-1].historialPorEmpresa[id]:{};
    const stockPrevio=Object.values(previo.inventarioProductos||{}).reduce((total,l)=>total+l.cantidad,0);
    cerca(stockPrevio+r.produccion.totalProducido,r.unidadesVendidas+r.inventarioSinVender);
    assert.ok(Number.isFinite(r.utilidad));
  }
  const primero=resultados[0].resultadosPorEmpresa;
  cerca(primero.A.costos.factorDescuento,0.92*0.98*0.97);assert.equal(primero.B.produccion.factorCapacidad,1.08);
  assert.equal(primero.B.costos.detalles.maquinaria[0].metodo,'FIN-02B');assert.equal(primero.C.costos.detalles.maquinaria[0].metodo,'FIN-02C');
});
test('inventario anterior se vende aunque la nueva producción sea cero',()=>{
  const d=decision({compras:{},lotes:[]});
  const stock={segmento:'SEG-01',molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',precio:40,precioEfectivo:40,cantidad:20};
  const resultado=cerrarCiclo({ciclo:2,empresas:['A'],decisionesPorEmpresa:{A:d},historialPorEmpresa:{A:{inventarioProductos:{anterior:stock}}}},{MERCADOS:mercados(10)}).resultadosPorEmpresa.A;
  assert.equal(resultado.produccion.totalProducido,0);assert.equal(resultado.unidadesVendidas,10);assert.equal(resultado.inventarioSinVender,10);cerca(resultado.ingresos,400);
});
test('costo recurrente y garantía se contabilizan una vez desde catálogo; préstamo no es ingreso',()=>{
  const escenario=crearSim3(),r=ejecutarEscenario(escenario,cerrarCiclo)[0].resultadosPorEmpresa.C;
  cerca(r.costos.costoDecisionesRecurrentes,1500+6000+6000);cerca(r.costos.costoGarantia,r.unidadesVendidas*10);
  cerca(r.costosTotales,r.costos.totalCostos+r.costos.costoDecisionesRecurrentes+r.costos.costoGarantia+r.costos.costoAlmacenaje+r.consecuencias.efectos.costoHorasExtra);
  const d=decision({montoPrestamo:5000}),prestamo=cerrarCiclo({empresas:['A'],decisionesPorEmpresa:{A:d}},{MERCADOS:mercados(10)}).resultadosPorEmpresa.A;
  cerca(prestamo.financiamiento.montoPrestamo,5000);cerca(prestamo.financiamiento.deudaPrincipal,5000);
  cerca(prestamo.ingresos,prestamo.ventas.reduce((total,v)=>total+v.ingreso,0));
});
