'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {calcularCostos}=require('../js/engine/costos.js');
test('Consumo físico real y valorización literal explícita mantienen separados 107 vs107.5',()=>{
 const input={compras:{'INS-02':110},consumoMP:{'INS-02':107},personal:{},limpieza:false,local:false};
 const real=calcularCostos(input);assert.equal(real.valorConsumido,107*45);assert.equal(real.valorInventario,3*45);
 const literal=calcularCostos({...input,consumoValorizado:{'INS-02':107.5}},{VALORIZACION_MP_MODO:'excel_literal'});
 assert.equal(literal.valorConsumido,107.5*45);assert.equal(literal.valorInventario,2.5*45);
 assert.equal(literal.consumoMP['INS-02'],107);assert.equal(literal.inventarioFinal['INS-02'],3);
 assert.throws(()=>calcularCostos(input,{VALORIZACION_MP_MODO:'excel_literal'}),/consumoValorizado/);
});
