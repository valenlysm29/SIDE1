'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const live=require('../services/live_results');

test('un cierre muestra la instantánea sellada aunque el libro del cliente cambie',()=>{
  const financial={estadoResultados:{ingresos:1250},balanceCaja:{cajaFinal:900}};
  const snapshot={decision_state:{__cycleSettlements:{1:{round:1,sold:5}},__financialSnapshots:{1:financial}},cash_ledger:{'1:SIM_VENTAS':999999}};
  const result=live.calculate({snapshot,round:1,capital:50,phase:'results'});
  assert.deepEqual(result.financial,financial);
  assert.equal(result.financial.estadoResultados.ingresos,1250);
  delete snapshot.decision_state.__financialSnapshots;
  assert.equal(live.calculate({snapshot,round:1,phase:'results'}),null);
});

test('los estados presentan pasivos de proveedores, anticipos e impuesto pagado',()=>{
  const view=require('../js/student_financial_view');
  const html=view.officeHtml({round:1,balanceGeneral:{cuentasPorPagarProveedores:1234,anticiposMateriales:345},flujoCaja:{impuestoRenta:-678}});
  for(const value of ['Cuentas por pagar a proveedores','1,234.00','Anticipos a proveedores','345.00','Impuesto pagado','-678.00'])assert.ok(html.includes(value),value);
});
