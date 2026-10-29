'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../js/financial_model.js');
const view=require('../js/student_financial_view.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('teacher cash adjustments preserve closed cycles and enter equity, never profit or debt',()=>{
  const original={'1:SIM_VENTAS':2000,'2:SIM_GASTOS':-500};
  const before=model.calculate({capital:100000,ledger:original,round:2});
  const ledger={...original,'3:CAPITAL_ADJUSTMENT':40000,'4:CAPITAL_ADJUSTMENT':-20000};
  const after=model.calculate({capital:100000,ledger,round:4});
  assert.deepEqual(after.history.slice(0,2),before.history);
  const added=after.history[2];
  assert.equal(added.balanceCaja.cajaFinal,141500);
  assert.equal(added.estadoResultados.utilidad,0);
  assert.equal(added.flujoCaja.financiamiento,40000);
  assert.equal(added.balanceGeneral.capital,140000);
  assert.equal(after.balanceCaja.salidas,20000);
  assert.equal(after.balanceGeneral.capital,120000);
  assert.equal(after.balanceGeneral.deuda,0);
  assert.equal(before.history[0].estadoResultados.impuestoRenta,590);
  assert.equal(after.balanceGeneral.resultadosAcumulados,910);
  assert.equal(after.balanceGeneral.activos,after.balanceGeneral.pasivoPatrimonio);
});

test('summary retains every cycle, including quiet cycles, and reports cumulative values',()=>{
  const report=model.calculate({capital:1000,round:3,ledger:{'1:SIM_VENTAS':200,'3:SIM_GASTOS':-50}});
  assert.deepEqual(report.history.map(row=>row.round),[1,2,3]);
  assert.equal(report.history[1].balanceCaja.cajaFinal,1200);
  assert.equal(report.history[0].estadoResultados.impuestoRenta,59);
  assert.equal(report.balanceGeneral.resultadosAcumulados,91);
  const html=view.summaryHtml(report,true);
  for(const label of ['Ciclo 1','Ciclo 2','Ciclo 3','Estado de resultados','Balance de caja','Flujo de caja','Balance general','Deuda / préstamos','Pasivo + patrimonio','simulación finalizada'])assert.ok(html.includes(label),label);
  assert.equal((html.match(/class="student-cycle-report"/g)||[]).length,3);
});

test('office view uses financial model statements, including debt and assets',()=>{
  const report=model.calculate({capital:500,round:1,ledger:{'1:SIM_VENTAS':100,'1:SIM_INVERSION':-40}});
  const html=view.officeHtml(report);
  for(const label of ['Caja','Ventas Totales','Costo de Ventas','Utilidad Neta','Impuesto a la renta','Deuda / préstamos','Flujo neto','Activos','Patrimonio','Ver estados financieros e indicadores'])assert.ok(html.includes(label),label);
  assert.ok(html.includes('560'));
});

test('student financial report uses the same ledger model as the teacher summary',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const start=source.indexOf('function financialReport('),end=source.indexOf('let financialSyncTimer=',start);
  const ledger={'1:SIM_VENTAS':2000,'2:SIM_GASTOS':-500},sections={};
  const context={decisionState:{},window:{SIDE_FINANCIAL_MODEL:model},teacherConfig:()=>({interest:20}),initialCapital:()=>100000,financialLedger:()=>ledger,recordedFinancialSections:()=>sections,DECISION_CATALOG:[],currentRound:()=>2};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const report=context.financialReport();
  assert.equal(report.estadoResultados.costos,500);
  assert.equal(report.history[0].estadoResultados.ingresos,2000);
  assert.equal(report.balanceCaja.cajaFinal,101500);
  assert.equal(report.balanceGeneral.activos,report.balanceGeneral.pasivoPatrimonio);
  assert.match(view.officeHtml(report),/101,500/);
});
