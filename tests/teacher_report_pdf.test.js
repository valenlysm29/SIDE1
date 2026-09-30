'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pdf=require('../teacher_report_pdf');
const financial=require('../financial_model');

test('cycle identifies the reported period relative to the configured total',()=>{
  assert.equal(pdf.cycleLabel({ronda:1},{cycles:6}),'1/6');
  assert.equal(pdf.cycleLabel({ronda:2},{cycles:6}),'2/6');
  assert.equal(pdf.cycleLabel({ronda:6},{cycles:6}),'6/6');
  assert.equal(pdf.cycleLabel({ronda:2},{round:5,cycles:8}),'2/8');
  assert.equal(pdf.cycleLabel({},{round:3,cycles:6}),'3/6');
  assert.equal(pdf.cycleLabel({ronda:1},{}),'1/—');
});

test('PDF preserves cents, accounting signs, zero grades and absent data',()=>{
  assert.equal(pdf.money(72000.25),'S/ 72,000.25');
  assert.equal(pdf.money(-3200.5),'(S/ 3,200.50)');
  assert.equal(pdf.money(0),'S/ 0.00');
  for(const value of [undefined,null,'',NaN,Infinity])assert.equal(pdf.money(value),'Sin datos');
  const data=pdf.reportData({ingresos:200.75,costos:40.25,utilidad:160.5,caja:560.5,capital:400},0);
  assert.equal(data.grade,'0 / 20');assert.equal(data.sales,200.75);
  assert.equal(data.statements[0][1][1][1],-40.25);
  assert.equal(data.statements[0][1][3][1],null);
  assert.equal(pdf.reportData({},null).grade,'Sin calificar');
});
test('report mapping keeps the model balances and presents outflows as deductions',()=>{
  const report=financial.calculate({capital:1000,round:1,ledger:{'1:SIM_VENTAS':800.5,'1:SIM_GASTOS':-200.25,'1:SIM_INVERSION':-100}});
  const data=pdf.reportData(report,18);
  const er=data.statements[0][1],bc=data.statements[1][1],fc=data.statements[2][1],bg=data.statements[3][1];
  assert.equal(er[0][1]+er[1][1]+er[2][1]+er[3][1],er[4][1]);
  assert.equal(bc[0][1]+bc[1][1]+bc[2][1],bc[3][1]);
  assert.equal(fc[0][1]+fc[1][1]+fc[2][1],fc[3][1]);
  assert.equal(bg[2][1],bg[5][1]);
});
test('academic status uses mandatory counts and never invents completion',()=>{
  assert.equal(pdf.decisionStatus({apartados:{B:{done:3,total:3},C:{done:1,total:5}}}),'4 de 8 decisiones obligatorias completadas');
  assert.equal(pdf.decisionStatus({progreso:0}),'0% de avance de decisiones obligatorias');
  assert.equal(pdf.decisionStatus({}),'Sin datos de decisiones obligatorias');
});
test('empty and eliminated rosters cannot download a misleading blank report',()=>{
  assert.throws(()=>pdf.create({reports:[]}),/No hay empresas activas/);
  assert.throws(()=>pdf.create({reports:[{estado:'eliminada'}]}),/No hay empresas activas/);
  assert.throws(()=>pdf.create({reports:[{empresa:'A'}]}),/generador PDF/);
});
