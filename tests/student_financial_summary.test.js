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
  assert.equal(after.balanceGeneral.resultadosAcumulados,1500);
  assert.equal(after.balanceGeneral.activos,after.balanceGeneral.pasivoPatrimonio);
});

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

test('pending cycle preserves the complete last closed balance with debt and fixed assets',()=>{
  const balance={efectivo:700,activosFijos:900,inventarioMP:100,activos:1700,deuda:400,capital:1000,resultadosAcumulados:300,patrimonio:1300,pasivoPatrimonio:1700};
  const closed={round:1,balanceGeneral:balance};
  const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const start=source.indexOf('function financialReport(){'),end=source.indexOf('let financialSyncTimer=',start);
  const context={decisionState:{__excel:{habilitado:true,historial:{deudaPrincipal:400,financialHistory:[closed]}}},excelSavedResult:()=>null,cashBalance:()=>700,currentRound:()=>2,initialCapital:()=>1000};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const pending=context.financialReport();
  assert.equal(pending.pendiente,true);assert.equal(pending.balanceGeneralRound,1);
  assert.deepEqual({...pending.balanceGeneral},balance);
  assert.equal(pending.balanceGeneral.activos,pending.balanceGeneral.deuda+pending.balanceGeneral.patrimonio);
  pending.balanceGeneral.activosFijos=0;assert.equal(closed.balanceGeneral.activosFijos,900,'view cannot mutate the closed balance');
  const html=view.officeHtml(context.financialReport());
  assert.match(html,/Ciclo pendiente de cierre/);assert.match(html,/último cierre: ciclo 1/);
  assert.match(html,/1,700/);assert.match(html,/1,300/);assert.match(html,/400/);
});
