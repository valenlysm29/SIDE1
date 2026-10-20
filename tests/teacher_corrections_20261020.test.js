'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const podium=require('../js/teacher_podium.js');
const pdf=require('../js/teacher_report_pdf.js');
test('28: all-zero financial evidence cannot manufacture medal positions',()=>{
  assert.deepEqual(podium.suggestedPodium([{empresa:'Alfa',score:0},{empresa:'Beta',score:0},{empresa:'Gamma',score:0}]),[]);
  const financial={empresa:'Activa',estadoResultados:{ventasNetas:1000,utilidad:200},balanceGeneral:{activos:1000,efectivo:300,deuda:0}};
  assert.equal(podium.suggestedPodium([financial])[0].empresa,'Activa');
});
test('29: an explicitly assigned zero remains a valid teacher grade',()=>{
  assert.deepEqual(podium.finalPodium([{empresa:'Calificada',teacherScore:0},{empresa:'Pendiente',teacherScore:null}],r=>r.teacherScore).map(r=>r.empresa),['Calificada']);
});
test('26: absent and zero financial facts remain distinct in the shared report mapping',()=>{
  const empty=pdf.reportData({},null);
  assert.equal(pdf.money(empty.statements[1][1][1][1]),'Sin datos');
  const actual=pdf.reportData({balanceCaja:{cajaInicial:0,entradas:0,salidas:0,cajaFinal:0}},null);
  for(const [,value] of actual.statements[1][1])assert.equal(pdf.money(value),'S/ 0.00');
});
