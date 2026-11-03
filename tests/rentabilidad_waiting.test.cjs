'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),snippet=source.slice(source.indexOf('async function refreshStudentMaterialBook(){'),source.indexOf('let materialViewRefreshPending=false;'));
test('la sala de espera no consulta un contexto material fuera de fase',async()=>{
 let calls=0,phase='integration';const ctx={studentMaterialSequence:0,currentStudent:{game:{id:'qa'},empresaId:1},currentRound:()=>1,studentMaterialPhase:()=>phase,validStudentMaterialBook:()=>null,temporalStudentRoom:()=>true,requestMaterialViewRefresh:()=>{},studentConnected:true,window:{SIDE:{DecisionesService:{obtenerContextoMaterial:async()=>{calls++;return {success:true,data:{revision:'r',cutoffDay:29}};}}}}};
 vm.runInNewContext(snippet,ctx);assert.equal(await ctx.refreshStudentMaterialBook(),true);assert.equal(calls,0);assert.match(ctx.studentMaterialStatus,/cuando comience/);
 phase='decisions';assert.equal(await ctx.refreshStudentMaterialBook(),true);assert.equal(calls,1);assert.equal(ctx.studentMaterialBook.book.revision,'r');
});
