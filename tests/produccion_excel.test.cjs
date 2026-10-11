'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { calcularCapacidad, calcularProduccion } = require('../js/engine/produccion.js');
const cerca = (actual, esperado) => assert.ok(Math.abs(actual - esperado) <= 1e-9 * Math.max(1, Math.abs(esperado)), `${actual} != ${esperado}`);

function personalCantidad() {
  return { corte: [1, 1, 1], ensamble: [[0, 0, 1], [1, 0, 0], [0, 1, 0]], acabado: [[0, 1, 0], 0, 1] };
}
function ejemploCantidad() {
  return { personal: personalCantidad(), jefes: 1, lotes: [
    { cantidad: 250, molde: 'INF-08', asignacion: { cuero: [60, 10, 0], accesorios: [0, 200], hilo: [1600, 0, 0] } },
    { cantidad: 180, molde: 'INF-09', asignacion: { cuero: [0, 50, 0], accesorios: [0, 150], hilo: [0, 0, 1200] } },
    { cantidad: 90, molde: 'INF-10', asignacion: { cuero: [0, 0, 70], accesorios: [0, 50], hilo: [0, 0, 1100] } }
  ] };
}

test('Excel CANTIDAD: capacidad, eficiencia literal, reparto y límites MP', () => {
  const entrada = ejemploCantidad();
  const copia = JSON.stringify(entrada);
  const r = calcularProduccion(entrada);
  assert.equal(JSON.stringify(entrada), copia, 'La función no modifica decisiones');
  assert.deepEqual(r.capacidadPorNivel.corte, [5, 7, 9]);
  cerca(r.capacidadPorArea.corte, 21); cerca(r.capacidadPorArea.ensamble, 31.4); cerca(r.capacidadPorArea.acabado, 17.2);
  cerca(r.capacidadDiaria, 17.2); cerca(r.capacidadCiclo, 412.8); cerca(r.factorEficienciaProduccion, .96);
  assert.equal(r.produccionCapacidad, 396); assert.equal(r.totalTrabajadores, 8); assert.equal(r.trabajadoresN3, 3); cerca(r.proporcionN3, .375);
  assert.deepEqual(r.cuelloBotella, ['acabado']);
  assert.deepEqual(r.lotes.map(l => l.capacidadAsignada), [190, 137, 68]);
  assert.deepEqual(r.lotes.map(l => l.producido), [190, 125, 50]);
  assert.deepEqual(r.lotes.map(l => l.consumo.cuero), [57, 50, 35]);
  assert.deepEqual(r.lotes.map(l => l.consumo.accesorios), [190, 125, 50]);
  assert.deepEqual(r.lotes.map(l => l.consumo.hilo), [1140, 875, 650]);
  const requerimientos = [ { cuero: 75, accesorios: 250, hilo: 1500 }, { cuero: 72, accesorios: 180, hilo: 1260 }, { cuero: 63, accesorios: 90, hilo: 1170 } ];
  r.lotes.forEach((lote, i) => Object.keys(requerimientos[i]).forEach(familia => cerca(lote.requerimiento[familia], requerimientos[i][familia])));
  assert.equal(r.lotes[2].requerimiento.cuero,63);
  assert.equal(r.totalProducido, 365);
  for (const codigo of Object.keys(r.inventarioFinal)) cerca(r.inventarioFinal[codigo], r.inventarioInicial[codigo] + r.compras[codigo] - r.consumoPorInsumo[codigo]);
});

test('Excel COSTOS permite inyectar 30 días y sus productividades', () => {
  const r = calcularCapacidad({ personal: { corte: [1, 1, 0], ensamble: [[0, 0, 1], [1, 0, 0], [0, 1, 0]], acabado: [0, [0, 0, 1], 1] }, jefes: 0 },
    { DIAS_CICLO: 30, PRODUCTIVIDAD: { corte: [6, 8, 12], ensamble: [6, 8, 12], acabado: [6, 8, 12] } });
  cerca(r.capacidadPorArea.corte, 14); cerca(r.capacidadPorArea.ensamble, 31.4); cerca(r.capacidadPorArea.acabado, 24);
  cerca(r.capacidadCiclo, 420); cerca(r.factorEficienciaProduccion, .91);
  assert.equal(r.produccionCapacidad, 382); assert.equal(r.totalTrabajadores, 7); assert.equal(r.trabajadoresN3, 2); cerca(r.proporcionN3, 2 / 7);
});

test('INV-01B amplía capacidad antes de redondear; bandera N3 explícita y sin tope', () => {
  const r = calcularCapacidad({ personal: personalCantidad(), jefes: 1, seleccion: ['INV-01B'] });
  cerca(r.capacidadCiclo, 412.8 * 1.08); assert.equal(r.produccionCapacidad, 428);
  cerca(calcularCapacidad({ personal: personalCantidad(), jefes: 1 }, { EFICIENCIA_N3_LITERAL: false }).factorEficienciaProduccion, .97);
  assert.ok(calcularCapacidad({ personal: { corte: [0, 0, 50] }, jefes: 3 }).factorEficienciaProduccion > 1);
});

test('Inventario y compras se arrastran, convierten y consumen una sola vez', () => {
  const r = calcularProduccion({ personal: { corte: [10], ensamble: [10], acabado: [10] },
    inventario: { 'INS-01': .6, 'INS-04': 1, 'INS-06': 6 },
    comprasUnidades: { 'INS-01': .3, 'INS-04': 2, 'INS-06': 1 },
    lotes: [ { cantidad: 2, molde: 'INF-08' }, { cantidad: 2, molde: 'INF-08' } ] });
  assert.deepEqual(r.lotes.map(l => l.producido), [2, 1]);
  cerca(r.inventarioFinal['INS-01'], 0); cerca(r.inventarioFinal['INS-04'], 0); cerca(r.inventarioFinal['INS-06'], 258);
  cerca(r.compras['INS-06'], 270);
});

test('Asignación no crea stock; los códigos del lote limitan el material consumido', () => {
  const r = calcularProduccion({ personal: { corte: [10], ensamble: [10], acabado: [10] },
    inventario: { 'INS-01': 100, 'INS-03': .7, 'INS-05': 2, 'INS-08': 26 },
    lotes: [ { cantidad: 2, molde: 'INF-10', cuero: 'INS-03', accesorios: 'INS-05', hilo: 'INS-08' },
      { cantidad: 2, molde: 'INF-10', asignacion: { cuero: [0, 0, 100], accesorios: [0, 100], hilo: [0, 0, 100] } } ] });
  assert.deepEqual(r.lotes.map(l => l.producido), [1, 0]);
  assert.equal(r.inventarioFinal['INS-01'], 100); assert.equal(r.inventarioFinal['INS-03'], 0);
});

test('Cero personal, cero plan y MP ausente producen cero sin divisiones inválidas', () => {
  assert.equal(calcularProduccion().totalProducido, 0);
  assert.equal(calcularProduccion().proporcionN3, 0);
  const r = calcularProduccion({ personal: personalCantidad(), lotes: [{ cantidad: 0, molde: 'INF-08' }] });
  assert.equal(r.totalProducido, 0); assert.equal(r.lotes[0].capacidadAsignada, 0);
  assert.throws(() => calcularProduccion({ lotes: [{ cantidad: 1, molde: 'NO-EXISTE' }] }), /Molde/);
  assert.throws(() => calcularProduccion({ lotes: Array(4).fill({ cantidad: 1, molde: 'INF-08' }) }), /tres lotes/);
});

test('Motor UMD expone la misma API pura en navegador', () => {
  const context = vm.createContext({});
  for (const archivo of ['config_excel.js', 'produccion.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/engine', archivo), 'utf8'), context);
  assert.equal(context.SIDE_EXCEL_PRODUCCION.calcularProduccion(ejemploCantidad()).totalProducido, 365);
});
