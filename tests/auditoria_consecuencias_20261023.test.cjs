'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const CON=require('../js/engine/consecuencias.js'),CICLO=require('../js/engine/ciclo.js');
const base={puntajes:{puntajeEficiencia:8,reputacionMatriz:5,saludFinanciera:5},jefes:1,costoMOciclo:1000};
function evaluate(input){return CON.evaluarConsecuencias({...base,...input});}
const active=result=>result.mensajes.some(row=>row.id==='CONS-06');
test('Matriz C7 uses produced quantity, independently of a larger planned quantity',()=>{
  for(const producido of [0,60,100]){
    const r=evaluate({planeado:200,producido,capacidad:100});
    assert.equal(active(r),false);assert.equal(r.efectos.costoHorasExtra,0);
  }
});
test('Matriz C7 is strictly greater: produced quantity above capacity activates even with a smaller plan',()=>{
  const r=evaluate({planeado:10,producido:120,capacidad:100});
  assert.equal(active(r),true);
  // Existing configured surcharge retained; Matriz D7 does not prescribe a rate.
  assert.equal(r.efectos.costoHorasExtra,50);
  assert.equal(active(evaluate({planeado:100,producido:100,capacidad:100})),false);
});
test('partial demand evaluations and nonnumeric capacity never assume an installed capacity of zero',()=>{
  for(const input of [{producido:60,demanda:20},{producido:60,capacidad:null},{producido:60,capacidad:NaN},{producido:60,capacidad:Infinity},{planeado:200,capacidad:100},{producido:null,capacidad:0}]){
    const r=evaluate(input);assert.equal(active(r),false);assert.equal(r.efectos.costoHorasExtra,0);
  }
  assert.equal(active(evaluate({producido:1,capacidad:0})),true,'Explicit zero capacity differs from omitted capacity');
  assert.ok(evaluate({producido:60,demanda:20}).mensajes.some(row=>row.id==='CONS-07'));
});
test('the capped production pipeline preserves an oversized desired quantity without inventing overtime',()=>{
  const d={personal:{corte:[1,0,0],ensamble:[1,0,0],acabado:[1,0,0]},jefes:1,
    comprasUnidades:{'INS-01':1000,'INS-04':1000,'INS-06':100},
    lotes:[{cantidad:1000,molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',segmento:'SEG-01',precio:40}]};
  const r=CICLO.prepararEmpresa(d);
  assert.equal(r.produccion.totalPlaneado,1000);
  assert.ok(r.produccion.totalProducido<=r.produccion.produccionCapacidad);
  assert.equal(active(r.consecuencias),false);assert.equal(r.consecuencias.efectos.costoHorasExtra,0);
});
