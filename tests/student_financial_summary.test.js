'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../financial_model.js');
const view=require('../student_financial_view.js');

test('summary retains every cycle, including quiet cycles, and reports cumulative values',()=>{
  const report=model.calculate({capital:1000,round:3,ledger:{'1:SIM_VENTAS':200,'3:SIM_GASTOS':-50}});
  assert.deepEqual(report.history.map(row=>row.round),[1,2,3]);
  assert.equal(report.history[1].balanceCaja.cajaFinal,1200);
  assert.equal(report.balanceGeneral.resultadosAcumulados,150);
  const html=view.summaryHtml(report,true);
  for(const label of ['Ciclo 1','Ciclo 2','Ciclo 3','Estado de resultados','Balance de caja','Flujo de caja','Balance general','Deuda / préstamos','Pasivo + patrimonio','simulación finalizada'])assert.ok(html.includes(label),label);
  assert.equal((html.match(/class="student-cycle-report"/g)||[]).length,3);
});

test('office view uses financial model statements, including debt and assets',()=>{
  const report=model.calculate({capital:500,round:1,ledger:{'1:SIM_VENTAS':100,'1:SIM_INVERSION':-40}});
  const html=view.officeHtml(report);
  for(const label of ['Caja','Ingresos','Costos','Utilidad','Deuda / préstamos','Flujo neto','Activos','Patrimonio','Ver estados financieros e indicadores'])assert.ok(html.includes(label),label);
  assert.ok(html.includes('560'));
});
