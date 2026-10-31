'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
test('avisa una vez antes del cierre solo si hay decisiones pendientes',()=>{
 const start=source.indexOf("let studentDeadlineAlertKey='';"),end=source.indexOf('\nfunction renderStudentStatus()',start),fn=source.slice(start,end);
 const elements=Object.fromEntries(['studentRoundTimer','decisionRoundTimer','studentCycleLabel','studentTimerNote'].map(id=>[id,{textContent:''}]));let submitted=false,clock=40,notices=[];
 const ctx={readRoundRuntime:()=>({phase:'decisions',running:true,startedAt:'2026-01-01T00:00:00Z',duration:100}),teacherConfig:()=>({lifecycleVersion:2,cycles:3}),currentRound:()=>1,studentNow:()=>Date.parse('2026-01-01T00:00:00Z')+clock*1000,simulationSubmissionComplete:()=>submitted,RULES:{isCancellationMarker:()=>false},currentStudent:{game:{id:'g'}},storageKey:()=>'',formatStudentTime:n=>String(n),toast:m=>notices.push(m),$:id=>elements[id]};
 vm.createContext(ctx);vm.runInContext(fn,ctx);ctx.syncStudentTimer();ctx.syncStudentTimer();assert.equal(notices.length,1);assert.match(elements.studentTimerNote.textContent,/pendientes/);
 submitted=true;ctx.syncStudentTimer();assert.equal(notices.length,1);assert.equal(elements.studentTimerNote.textContent,'Ciclo en curso');
});
