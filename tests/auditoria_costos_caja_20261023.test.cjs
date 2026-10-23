'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/engine/costos.js'),I=require('../js/engine/inventario.js');
const {cerrarCiclo}=require('../js/engine/ciclo.js'),{adjuntarCaja}=require('../js/engine/caja.js');
const fixture=require('./oracle/auditoria_costos_original_20261023.json');
const near=(actual,expected,label='')=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);

test('22 perfiles laborales cotejan los siete componentes con celdas originales, ambos regímenes',()=>{
  assert.equal(fixture.labor.length,22);
  for(const row of fixture.labor){
    const actual=C.costoLaboral(row.role,row.level,row.regime);
    for(const [field,source]of Object.entries(row.expected))near(actual[field],source.value,`${row.role}/${row.level}/${row.regime} ${source.sheet}!${source.cell}`);
  }
  for(const [i,regime]of ['MYPE','NO_MYPE'].entries())near(C.costoLaboral('local',1,regime).pagoMensual,fixture.local[i].value);
});

test('20 perfiles de activos cotejan cada componente con celdas originales, ambos regímenes',()=>{
  assert.equal(fixture.assets.length,20);
  for(const row of fixture.assets){
    const actual=C.costoMaquinaria(row.code,row.regime);
    for(const [field,source]of Object.entries(row.expected))near(actual[field],source.value,`${row.code}/${row.regime} ${source.cell}`);
    near(actual.salidaCompra,actual.adquisicion+actual.instalacion+actual.capacitacion,'compra sin mantenimiento/depreciación');
    near(actual.depreciacionCiclo,-actual.depreciacionAnual/12,'cuota mensual');
  }
});

test('nómina de matriz completa cuenta cada máquina y nivel con tarifa del régimen elegido',()=>{
  for(const regime of ['MYPE','NO_MYPE']){
    const personal={corte:[[1,0,0],[2,0,0],[3,0,0]],ensamble:[[1,2,3],[4,5,6],[7,8,9]],acabado:[[9,8,7],[6,5,4],[3,2,1]]};
    let expected=0;
    for(const row of fixture.labor.filter(r=>r.regime===regime)){
      const count=row.role==='jefatura'?2:row.role==='limpieza'?1:personal[row.role][row.level-1].reduce((sum,n)=>sum+n,0);
      expected+=count*row.expected.pagoMensual.value;
    }
    expected+=fixture.local[regime==='MYPE'?0:1].value;
    const actual=C.calcularCostos({regimen:regime,personal,jefes:2});
    near(actual.costoMOciclo,expected,regime+' nómina completa original');
  }
});

test('cada presentación MP concilia conversión y precio original con compra cargada',()=>{
  for(const row of fixture.materials){
    const units=row.conversion.value,charged=C.calcularCostos({compras:{[row.code]:units},limpieza:false,local:false});
    near(charged.valorComprado,row.price.value*units,row.code+' lista');
    near(charged.valorCompradoNeto,row.discounted_unit_price.value*units,row.code+' descuento original');
    near(C.precioCompraMateriaPrima(row.code),charged.valorCompradoNeto,row.code+' precio presentación');
    for(const cycle of [1,2,6,9,30]){
      const withAnalyst=C.calcularCostos({compras:{[row.code]:units},analistaCompras:true,ciclo:cycle,limpieza:false,local:false});
      near(C.precioCompraMateriaPrima(row.code,{analistaCompras:true,ciclo:cycle}),withAnalyst.valorCompradoNeto,row.code+' precio/caja analista ciclo'+cycle);
    }
  }
});

test('stock decimal exacto no crea faltantes ni rechaza consumo, y exceso real sigue rechazado',()=>{
  for(const [initial,purchase,consume]of [[.1,.7,.8],[.2,.7,.9],[.3,.6,.9],[.1,.2,.3]]){
    const args={inventarioInicial:{'INS-01':initial},compras:{'INS-01':purchase},consumoMP:{'INS-01':consume}};
    const actual=C.calcularCostos(args);assert.equal(actual.inventarioFinal['INS-01'],0);
    assert.equal(I.actualizarInventario({'INS-01':initial},{'INS-01':purchase},{'INS-01':consume})['INS-01'],0);
    const literal=C.calcularCostos({...args,consumoValorizado:{'INS-01':consume}},{VALORIZACION_MP_MODO:'excel_literal'});
    assert.equal(literal.valorInventario,0);
    const warehouse=C.consumirAlmacen({...args,necesidad:{cuero:consume}});
    assert.equal(warehouse.faltantes.cuero,0);assert.equal(warehouse.inventarioFinal['INS-01'],0);
  }
  assert.throws(()=>C.calcularCostos({inventarioInicial:{'INS-01':.1},compras:{'INS-01':.7},consumoMP:{'INS-01':.800000001}}),/Consumo superior/);
  assert.throws(()=>I.actualizarInventario({x:.1},{x:.7},{x:.800000001}),/Inventario negativo/);
});

test('compras y consumo decimal conservan valoración sin merma añadida en los ocho materiales',()=>{
  for(const row of fixture.materials){
    const code=row.code;
    const r=C.calcularCostos({inventarioInicial:{[code]:.3},compras:{[code]:.6},consumoMP:{[code]:.9}});
    assert.equal(r.inventarioFinal[code],0);near(r.valorConsumido,.9*row.price.value);assert.equal(r.valorInventario,0);
    near(r.valorConsumidoNeto,r.valorCompradoNeto+.3*row.discounted_unit_price.value);
  }
});

function close(d,history={},round=1,base=0){
  const batch=cerrarCiclo({ciclo:round,empresas:['A'],decisionesPorEmpresa:{A:d},historialPorEmpresa:history});
  return adjuntarCaja(batch,{capitalPorEmpresa:{A:999999},baseCajaPorEmpresa:{A:base},historialAnterior:history});
}
const idle=patch=>({regimen:'MYPE',personal:{},seleccion:[],maquinaria:{},compras:{},lotes:[],limpieza:false,local:false,...patch});

test('caja inicial cero se respeta y deuda sin principal cero no inventa intereses',()=>{
  const first=close(idle());const r=first.resultadosPorEmpresa.A;
  assert.equal(r.financial.balanceCaja.cajaInicial,0);assert.equal(r.financial.balanceCaja.cajaFinal,0);
  assert.equal(r.financial.estadoResultados.intereses,0);assert.equal(r.financial.balanceGeneral.deuda,0);
});

test('deuda previa a tasa cero preserva el cero; nueva deuda positiva pondera solo su interés',()=>{
  const history={A:{cajaFinal:0,deudaPrincipal:1000,tasaMensualVigente:0,teaVigente:0,inventarioMP:{},maquinariaActivos:{}}};
  const first=close(idle(),history,2,100000);
  assert.equal(first.resultadosPorEmpresa.A.financial.balanceCaja.cajaInicial,0);
  assert.equal(first.resultadosPorEmpresa.A.financial.estadoResultados.intereses,0);
  const second=close(idle({seleccion:['FIN-01A'],montoPrestamo:500,teaBase:20}),first.historialPorEmpresa,3);
  assert.equal(first.historialPorEmpresa.A.tasaAdicionalPP,3,'salud baja del ciclo anterior afecta solo el préstamo nuevo');
  const r=second.resultadosPorEmpresa.A,monthly=Math.pow(1.23,1/12)-1;
  near(r.financial.estadoResultados.intereses,500*monthly);
  near(r.financial.balanceGeneral.deuda,1500);
  near(r.financial.balanceCaja.cajaFinal,500-500*monthly);
  near(second.historialPorEmpresa.A.tasaMensualVigente,500*monthly/1500);
});

test('activos omitidos o reducidos no se recompran; ampliación cobra solo delta en ambos regímenes',()=>{
  for(const regime of ['MYPE','NO_MYPE']){
    for(const row of fixture.assets.filter(a=>a.regime===regime)){
      const code=row.code,unit=C.costoMaquinaria(code,regime),d=idle({regimen:regime,maquinaria:{[code]:1}});
      const first=close(d),second=close({...d,maquinaria:{}},first.historialPorEmpresa,2);
      const f=first.resultadosPorEmpresa.A,s=second.resultadosPorEmpresa.A;
      near(f.financial.flujoCaja.compraActivos,unit.salidaCompra);
      assert.equal(s.financial.flujoCaja.compraActivos,0);
      near(s.costos.depreciacion,f.costos.depreciacion);near(s.costos.costoMantenimiento,f.costos.costoMantenimiento);
      const third=close({...d,maquinaria:{[code]:3}},second.historialPorEmpresa,3);
      near(third.resultadosPorEmpresa.A.financial.flujoCaja.compraActivos,2*unit.salidaCompra);
      const fourth=close({...d,maquinaria:{[code]:1}},third.historialPorEmpresa,4);
      assert.equal(fourth.resultadosPorEmpresa.A.financial.flujoCaja.compraActivos,0);
      assert.equal(fourth.historialPorEmpresa.A.maquinariaActivos[code],3);
    }
  }
});

test('caja concilia compras y consumo posterior sin recompra ni intereses',()=>{
  const code='INS-01',first=close(idle({compras:{[code]:.7}}));
  const firstResult=first.resultadosPorEmpresa.A;
  near(firstResult.financial.balanceCaja.cajaFinal,-.7*25*.92);
  const h=first.historialPorEmpresa;
  const batch=cerrarCiclo({ciclo:2,empresas:['A'],decisionesPorEmpresa:{A:idle()},historialPorEmpresa:h});
  const r=batch.resultadosPorEmpresa.A;
  r.costos=C.calcularCostos({inventarioInicial:h.A.inventarioMP,consumoMP:{[code]:.7},limpieza:false,local:false});
  r.costosTotales=r.costos.totalCostos;r.utilidad=r.ingresos-r.costosTotales;
  const second=adjuntarCaja(batch,{historialAnterior:h});
  near(second.resultadosPorEmpresa.A.financial.balanceCaja.cajaFinal,firstResult.financial.balanceCaja.cajaFinal,'consumir no vuelve a cobrar compra');
  near(second.resultadosPorEmpresa.A.financial.estadoResultados.costos,.7*25*.92);
});
