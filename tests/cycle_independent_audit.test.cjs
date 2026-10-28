'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const CYCLE=require('../js/cycle_model.js');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('closing ignores entertainment POS counters for every product',()=>{
  const {state,catalog}=require('./economic_v19_fixture.cjs');
  const input={round:1,capital:200000,state:state(1,{},3),catalog};
  const baseline=CYCLE.close(input),result=CYCLE.close({...input,ledger:{'1:SIM_VENTAS':1250},soldUnits:9999,soldByProduct:{esencial:0,urbano:0,premium:9999}});
  assert.deepEqual(result,baseline,'entertainment receipts never alter economic closure');
  assert.equal(result.receipt.sales.find(row=>row.id==='esencial').alreadySold,0);
  assert.equal(result.receipt.sales.find(row=>row.id==='premium').sold,30);
  assert.equal(result.state.__finishedGoods.premium,0);
  assert.equal(result.ledger['1:SIM_VENTAS'],result.receipt.revenue);
});
test('the last automatic cycle settles when its runtime reaches simulation-finished',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const source=app.slice(app.indexOf('function tickStudentGame(){'),app.indexOf('\nfunction resumeStudentSession('));
  const closed=[],noop=()=>{};
  const ctx={studentConnected:true,currentStudent:{empresaId:'qa'},studentAccess:()=>({}),teacherConfig:()=>({cycleCloseMode:'automatic'}),
    currentRound:()=>3,readRoundRuntime:()=>({status:'simulation-finished',phase:'finished'}),decisionState:{__cyclePlans:{3:{}}},
    settleCycle:round=>closed.push(round),lastObservedRound:3,ensureCycleFixedCosts:noop,syncStudentTimer:noop,updateIntegrationUI:noop,
    $:()=>null,renderStudentStatus:noop,renderOfficeFinances:noop};
  vm.createContext(ctx);vm.runInContext(source,ctx);ctx.tickStudentGame();assert.deepEqual(closed,[3]);
});
test('teacher closure displays persisted revenue and stops on a rejected closure',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/docente.js'),'utf8');
  const fn=source.slice(source.indexOf('async function closeBusinessRemoteRound('),source.indexOf('\nfunction renderWinnerSelect('));
  const report={empresaId:7,ronda:1},status={},calls=[];
  const financial={estadoResultados:{ingresos:750,costos:100,utilidad:650},balanceCaja:{cajaFinal:200650},flujoCaja:{},balanceGeneral:{}};
  let response={success:true,data:{resultadosPorEmpresa:{7:{financial}}}};
  const ctx={state:{partidaId:'qa',reports:[report]},roomGeneration:0,reportsRevision:0,confirmedReportClosures:new Map(),window:{SIDE:{PartidaService:{cerrarNegocio:async()=>response}}},
    toast:text=>calls.push(text),$:()=>status,persistReports:()=>calls.push('persist'),renderResults:()=>calls.push('render')};
  const apply=source.slice(source.indexOf('function applyConfirmedReportClosures('),source.indexOf("\nlet rosterSyncError="));
  vm.createContext(ctx);vm.runInContext(apply+'\n'+fn,ctx);assert.equal(await ctx.closeBusinessRemoteRound(1),true);assert.equal(report.ingresos,750);assert.equal(report.caja,200650);
  assert.deepEqual(calls,['persist','render']);calls.length=0;response={success:false,error:'Revision conflict'};
  assert.equal(await ctx.closeBusinessRemoteRound(1),false);assert.equal(calls.includes('persist'),false);assert.match(status.textContent,/pendiente/);
});
