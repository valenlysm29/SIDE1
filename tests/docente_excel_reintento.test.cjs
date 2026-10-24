'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function entorno({round=1,next=2,phase='decisions',active=true,failOnce=true}={}){
 const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8'),start=source.indexOf('async function refreshTeacherGame(){'),end=source.indexOf('\nfunction watchTeacherGame',start),calls=[];
 let failure=failOnce;
 const ctx={roomGeneration:0,state:{lifecycleVersion:2,partidaId:'p',round},gameStatus:()=>({active}),teacherBusy:false,teacherRead:Promise.resolve(),window:{SIDE:{PartidaService:{controlar:async()=>({success:true,data:{configuracion:{runtime:{round:next,phase}}}})}}},closeBusinessRemoteRound:async c=>{calls.push(c);if(failure){failure=false;return false;}return true;},applyTeacherState:p=>{ctx.state.round=p.configuracion.runtime.round;}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);return {ctx,calls};
}
test('Falla transitoria mantiene ciclo pendiente y próximo poll reintenta antes de avanzar',async()=>{
 const {ctx,calls}=entorno();await ctx.refreshTeacherGame();assert.equal(ctx.state.round,1);ctx.state.syncRetryAt=0;await ctx.refreshTeacherGame();assert.deepEqual(calls,[1,1]);assert.equal(ctx.state.round,2);
});
test('Profesor recién recargado recupera todos los ciclos pasados desde el primero',async()=>{
 const {ctx,calls}=entorno({round:3,next:3,failOnce:false});await ctx.refreshTeacherGame();assert.deepEqual(calls,[1,2]);
});
test('Fase results cierra mismo ciclo; finished inactivo permite reintentar último',async()=>{
 const results=entorno({round:2,next:2,phase:'results',failOnce:false});await results.ctx.refreshTeacherGame();assert.deepEqual(results.calls,[1,2]);
 const final=entorno({round:2,next:2,phase:'finished',active:false});await final.ctx.refreshTeacherGame();final.ctx.state.syncRetryAt=0;await final.ctx.refreshTeacherGame();assert.deepEqual(final.calls,[1,1,2]);
});
test('Cancelación no calcula nuevos cierres después de cancelar la partida',async()=>{
 const {ctx,calls}=entorno({round:2,next:2,phase:'cancelled',failOnce:false});await ctx.refreshTeacherGame();assert.deepEqual(calls,[]);
});
