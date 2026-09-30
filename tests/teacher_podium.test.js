const test=require('node:test');
const assert=require('node:assert/strict');
const {suggestedScore,suggestedPodium,finalPodium}=require('../js/teacher_podium.js');

const reports=[
  {empresa:'Alta SIDE',estadoResultados:{ventasNetas:100,utilidad:30},balanceGeneral:{activos:100,efectivo:40,deuda:0},teacherScore:8},
  {empresa:'Alta docente',estadoResultados:{ventasNetas:100,utilidad:2},balanceGeneral:{activos:100,efectivo:3,deuda:80},teacherScore:19},
  {empresa:'Sin calificar',estadoResultados:{ventasNetas:100,utilidad:10},balanceGeneral:{activos:100,efectivo:10,deuda:40},teacherScore:null}
];
test('SIDE suggestion uses financial statements and remains separate from grades',()=>{
  assert.equal(suggestedScore(reports[0]),100);
  assert.equal(suggestedPodium(reports)[0].empresa,'Alta SIDE');
  assert.equal(suggestedScore({...reports[0],teacherScore:0}),100);
});
test('published podium candidates depend only on teacher grades',()=>{
  const grades=r=>r.teacherScore;
  assert.deepEqual(finalPodium(reports,grades).map(r=>r.empresa),['Alta docente','Alta SIDE']);
  const changed=reports.map(r=>({...r,estadoResultados:{ventasNetas:100,utilidad:1000},balanceGeneral:{activos:100,efectivo:100,deuda:0}}));
  assert.deepEqual(finalPodium(changed,grades).map(r=>r.empresa),['Alta docente','Alta SIDE']);
  const regraded=reports.map(r=>({...r,teacherScore:r.empresa==='Alta SIDE'?20:r.teacherScore}));
  assert.equal(finalPodium(regraded,grades)[0].empresa,'Alta SIDE');
});
