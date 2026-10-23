'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repartoMercado}=require('../js/engine/mercado.js');
const {cerrarCiclo}=require('../js/engine/ciclo.js');
const {decision}=require('./escenarios_excel.cjs');

test('default quality uses original reputation proxy, independent of material score',()=>{
 const companies=[{precio:120,reputacionMercado:2,calidadEmpresaMotor:12},{precio:150,reputacionMercado:4,calidadEmpresaMotor:4}];
 const first=repartoMercado(companies,'SEG-02');
 const second=repartoMercado(companies.map(row=>({...row,calidadEmpresaMotor:0})),'SEG-02');
 assert.deepEqual(first.map(row=>row.calidadMercado),[33,67]); // Costos!E131:E134: ROUND(rep / D122 * 100,0).
 assert.deepEqual(first.map(row=>row.asignado),second.map(row=>row.asignado));
});

test('medium and premium keep the absolute economic denominator, without a 100 cap',()=>{
 for(const segment of ['SEG-02','SEG-03']){
  const rows=repartoMercado([{precio:100,reputacionMercado:2},{precio:150,reputacionMercado:30}],segment,{}, {sumaReputacionEconomico:20});
  assert.deepEqual(rows.map(row=>row.calidadMercado),[10,150]); // Original Costos!E131/E144 retains $D$122.
 }
});

test('explicit zero economic population uses the documented finite guard',()=>{
 const rows=repartoMercado([{precio:250,reputacionMercado:7}],'SEG-03',{}, {sumaReputacionEconomico:0});
 assert.equal(rows[0].calidadMercado,0);
 assert.ok(Number.isFinite(rows[0].asignado));
});

test('cycle shares the economic population across segments instead of reusing each population',()=>{
 const lot=segment=>[{segmento:segment,cantidad:10,molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',precio:100}];
 const out=cerrarCiclo({empresas:['eco','medio','premium'],decisionesPorEmpresa:{
  eco:decision({reputacionLiteral:20,lotes:lot('SEG-01')}),
  medio:decision({reputacionLiteral:2,lotes:lot('SEG-02')}),
  premium:decision({reputacionLiteral:30,lotes:lot('SEG-03')})
 }},{REPUTACION_FUENTE_MERCADO:'excel_literal'});
 const companies=out.resultadosPorEmpresa;
 assert.deepEqual(['eco','medio','premium'].map(id=>companies[id].mercado[0].calidadMercado),[100,10,150]);
});
