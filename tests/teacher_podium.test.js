const test=require('node:test');
const assert=require('node:assert/strict');
const {suggestedScore,suggestedPodium,finalPodium,eligibleReports}=require('../js/teacher_podium.js');

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
test('SIDE suggestion excludes pending remote closures and uses verified zero values',()=>{
 const pending={empresa:'Pendiente',fuente:'supabase',caja:100000,estadoResultados:{},balanceGeneral:{}};
 const incomplete={empresa:'Incompleta',fuente:'supabase',cycleReceipt:{round:1},estadoResultados:{ingresos:100,utilidad:0},balanceGeneral:{activos:100,efectivo:100}};
 const closed={empresa:'Cerrada',fuente:'supabase',cycleReceipt:{round:1},estadoResultados:{ingresos:0,utilidadNeta:0},balanceGeneral:{activos:100,efectivo:100,deuda:0}};
 assert.deepEqual(suggestedPodium([pending,incomplete,closed]).map(r=>r.empresa),['Cerrada']);assert.equal(suggestedScore(closed),40);
 assert.equal(finalPodium([{...pending,teacherScore:18}],r=>r.teacherScore).length,1);
});

test('completed games grade all participants regardless of activity or presence',()=>{
  const participants=[
    {empresa:'Terminada',estado:'finalizada',teacherScore:18,conectada:false},
    {empresa:'Inactiva',estado:'eliminada',teacherScore:20,conectada:false},
    {empresa:'Nota cero',estado:'activa',teacherScore:0},
    {empresa:'Pendiente',estado:'activa',teacherScore:null}
  ];
  assert.equal(eligibleReports(participants).length,3);
  assert.equal(eligibleReports(participants,{finished:true}).length,4);
  assert.deepEqual(finalPodium(participants,r=>r.teacherScore,{finished:true}).map(r=>r.empresa),['Inactiva','Terminada','Nota cero']);
  assert.deepEqual(finalPodium(participants,r=>r.teacherScore).map(r=>r.empresa),['Terminada','Nota cero']);
});

test('podium rejects out-of-range grades and breaks ties by company name',()=>{
  const participants=[{empresa:'Zeta',teacherScore:18},{empresa:'Andina',teacherScore:'18.00'},{empresa:'Inválida',teacherScore:21}];
  assert.deepEqual(finalPodium(participants,r=>r.teacherScore).map(r=>r.empresa),['Andina','Zeta']);
});
test('published podium candidates depend only on teacher grades',()=>{
  const grades=r=>r.teacherScore;
  assert.deepEqual(finalPodium(reports,grades).map(r=>r.empresa),['Alta docente','Alta SIDE']);
  const changed=reports.map(r=>({...r,estadoResultados:{ventasNetas:100,utilidad:1000},balanceGeneral:{activos:100,efectivo:100,deuda:0}}));
  assert.deepEqual(finalPodium(changed,grades).map(r=>r.empresa),['Alta docente','Alta SIDE']);
  const regraded=reports.map(r=>({...r,teacherScore:r.empresa==='Alta SIDE'?20:r.teacherScore}));
  assert.equal(finalPodium(regraded,grades)[0].empresa,'Alta SIDE');
});
