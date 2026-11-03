'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/docente.js','utf8');
test('clic durante lectura de cierres espera la consulta completa y avanza una sola vez',async()=>{
 let release;const writes=[];
 const ctx={state:{partidaId:'game',round:2,authoritative:{runtime:{phase:'results'}}},teacherBusy:true,teacherRead:Promise.resolve(),refreshSetupSummary(){},toast(){},applyTeacherState(){},closeBusinessRemoteRound:async()=>true,
 window:{SIDE:{PartidaService:{controlar:async(...args)=>{writes.push(args);return {success:true,data:{}};}}}}};
 ctx.teacherSyncFlight=new Promise(resolve=>release=()=>{ctx.teacherBusy=false;resolve();});
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function controlGame(action){'),source.indexOf('async function startGame(){')),ctx);
 const action=ctx.controlGame('avanzar');
 assert.equal(await ctx.controlGame('avanzar'),false,'segundo clic no duplica la operación');
 await new Promise(setImmediate);assert.equal(writes.length,0,'espera la lectura completa');
 release();assert.equal(await action,true);assert.equal(writes.length,1);
 assert.equal(writes[0][3],2,'conserva el ciclo esperado capturado al hacer clic');
 assert.equal(ctx.state.controlling,false);
});
test('modo remoto manual prevalece sobre un formulario automático desactualizado',()=>{
 const ctx={state:{partidaId:'test',authoritative:{cycleCloseMode:'manual'}},gameStatus:()=>({active:true}),document:{querySelector:()=>({value:'automatic'})}};
 vm.createContext(ctx);vm.runInContext(source.match(/function cycleMode\(\)\{[^\n]+/)[0],ctx);
 assert.equal(ctx.cycleMode(),'manual');
});
test('botón refleja confirmaciones, procesamiento, error y cierre completo sin recargar',()=>{
 const nodes=new Proxy({}, {get:(target,key)=>target[key]??=( {value:key==='cycles'?'6':'0',firstChild:{},classList:{toggle(){}}})});
 const state={round:1,partidaId:'test',lifecycleVersion:2,advanceReadiness:{round:1,total:2,missing:[{nombre:'Empresa Dos'}],complete:false,ready:false}};
 const ctx={state,$:id=>nodes[id],formatStudentTime:()=>'',gameStatus:()=>({active:true}),runtime:()=>({phase:'results'}),cycleMode:()=> 'manual',document:{querySelector(){},querySelectorAll:()=>[]},canCancelRoom:()=>false,sharedRoom:null,refreshStartButton(){},renderTeacherLobby(){},renderTeacherChallengeControls(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function refreshSetupSummary(){'),source.indexOf('\nlet publishedState=')),ctx);
 ctx.refreshSetupSummary();assert.equal(nodes.advanceRound.disabled,true);assert.match(nodes.roundState.textContent,/Empresa Dos/);
 state.advanceReadiness.missing=[];ctx.refreshSetupSummary();assert.match(nodes.roundState.textContent,/procesamiento/);
 state.advanceReadiness.processing={error:'fallo real SQL'};ctx.refreshSetupSummary();assert.match(nodes.roundState.textContent,/fallo real SQL/);
 state.advanceReadiness={round:1,total:2,missing:[],complete:true,ready:true};ctx.refreshSetupSummary();assert.equal(nodes.advanceRound.disabled,false);
 state.controlling=true;ctx.refreshSetupSummary();assert.equal(nodes.advanceRound.disabled,true);
 state.controlling=false;state.round=2;ctx.refreshSetupSummary();assert.equal(nodes.advanceRound.disabled,true,'respuesta vieja no autoriza ciclo nuevo');
 state.advanceReadiness={error:'permission denied'};ctx.refreshSetupSummary();assert.match(nodes.roundState.textContent,/permission denied/);
});
