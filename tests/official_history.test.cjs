'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../services/official_history');
const financial={round:1,closureStatus:'pending',estadoResultados:{ingresos:120,costos:70,utilidad:50,utilidadNeta:50},balanceCaja:{cajaInicial:1000,cajaFinal:1050},balanceGeneral:{efectivo:1050},flujoCaja:{flujoNeto:50}};
const history={partida_id:'game',cycles:[{partida_id:'game',empresa_id:1,ciclo:1,status:'confirmed',closed_at:'2026-01-01',result:{financial,receipt:{round:1,sold:2},state:{}}},{partida_id:'game',empresa_id:1,ciclo:2,status:'in_progress',result:null},{partida_id:'game',empresa_id:2,ciclo:1,status:'confirmed',result:{financial:{...financial,balanceCaja:{cajaFinal:999}},receipt:{sold:3}}}]};
test('seal status overrides the financial calculation status, and isolates company and cycle',()=>{
 const rows=H.rows(history,1);assert.equal(rows.length,2);assert.equal(rows[0].closureStatus,'confirmed');
 const r=H.report({cycleHistory:rows,utilidad:9999,ronda:2},1);assert.equal(r.utilidad,50);assert.equal(r.caja,1050);assert.equal(r.provisional,false);
 const pending=H.report({cycleHistory:rows,cycleReceipt:{sold:99}},2);assert.equal(pending.cycleReceipt,null);assert.equal(pending.provisional,true);assert.deepEqual(pending.estadoResultados,{});
 assert.equal(H.closure(history,1).resultadosPorEmpresa['2'].financial.balanceCaja.cajaFinal,999);
 assert.equal(H.closure(history,2),null);
});
test('official history rendering omits future or processing amounts and never mutates the seal',()=>{
 const before=JSON.stringify(history),rows=H.rows(history,1),view=require('../js/student_financial_view');
 const html=view.summaryHtml({history:rows},false);assert.ok(html.includes('Ciclo 1'));assert.ok(!html.includes('Ciclo 2 · utilidad'));
 H.report({cycleHistory:rows},1);assert.equal(JSON.stringify(history),before);
});
