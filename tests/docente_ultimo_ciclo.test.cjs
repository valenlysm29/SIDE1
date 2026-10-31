'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
test('último ciclo cerrado ofrece finalizar y deshabilita controles que ya no aplican',()=>{
 const start=src.indexOf('function refreshSetupSummary(){'),fn=src.slice(start,src.indexOf('\nlet publishedState=',start));
 const elems={};for(const id of ['cycles','roundHours','roundMinutes','configCycleCount','configReadySummary','gameStatusBanner','financeConfigHelp','taxRegime','startTimer','cutRound','advanceRound','startCycle1Btn','roundState','cancelGame','copyGameCode','copyGameLink','copyLobbyCode'])elems[id]={value:'',classList:{toggle(){}},firstChild:{nodeValue:''}};
 elems.cycles.value='3';const finance={id:'capital',name:'',disabled:false},normal={id:'gameName',disabled:false};
 const ctx={state:{round:3,lifecycleVersion:2,seconds:0,integrationMinutes:0},$:id=>elems[id],gameStatus:()=>({active:true}),runtime:()=>({phase:'results'}),cycleMode:()=> 'manual',formatStudentTime:()=>'',editableFinancialInput:i=>i.id==='capital',document:{querySelector:()=>({classList:{toggle(){}}}),querySelectorAll:()=>[finance,normal]},canCancelRoom:()=>true,sharedRoom:{},refreshStartButton(){},renderTeacherLobby(){},renderTeacherChallengeControls(){}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);ctx.refreshSetupSummary();
 assert.equal(finance.disabled,true);assert.equal(normal.disabled,true);assert.equal(elems.startTimer.disabled,true);assert.equal(elems.cutRound.disabled,true);assert.equal(elems.advanceRound.disabled,false);assert.match(elems.advanceRound.firstChild.nodeValue,/Finalizar partida/);
});
