'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const CYCLE=require('../js/cycle_model.js');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('closing ignores entertainment POS counters for every product',()=>{
  const result=CYCLE.close({round:1,capital:200000,state:{CANALES:{round:1,optionIds:['web']}},ledger:{'1:SIM_VENTAS':1250},
    production:{producibleUnits:20,productLines:[{plannedUnits:10},{plannedUnits:0},{plannedUnits:10}],materials:[]},
    soldUnits:10,soldByProduct:{esencial:0,urbano:0,premium:10}});
  const essential=result.receipt.sales.find(row=>row.id==='esencial'),premium=result.receipt.sales.find(row=>row.id==='premium');
  assert.equal(essential.alreadySold,0,'premium sales must never consume essential stock');
  assert.equal(premium.alreadySold,0);
  assert.equal(premium.sold,10,'closing uses market demand only');
  assert.equal(result.state.__finishedGoods.premium,0,'premium stock is consumed once');
  assert.equal(result.ledger['1:SIM_VENTAS'],2000,'market revenue only, without an additive POS receipt');
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
  const report={empresaId:7},status={},calls=[];
  const financial={estadoResultados:{ingresos:750,costos:100,utilidad:650},balanceCaja:{cajaFinal:200650},flujoCaja:{},balanceGeneral:{}};
  let response={success:true,data:{resultadosPorEmpresa:{7:{financial}}}};
  const ctx={state:{partidaId:'qa',reports:[report]},window:{SIDE:{PartidaService:{cerrarNegocio:async()=>response}}},
    toast:text=>calls.push(text),$:()=>status,persistReports:()=>calls.push('persist'),renderResults:()=>calls.push('render')};
  vm.createContext(ctx);vm.runInContext(fn,ctx);assert.equal(await ctx.closeBusinessRemoteRound(1),true);assert.equal(report.ingresos,750);assert.equal(report.caja,200650);
  assert.deepEqual(calls,['persist','render']);calls.length=0;response={success:false,error:'Revision conflict'};
  assert.equal(await ctx.closeBusinessRemoteRound(1),false);assert.equal(calls.includes('persist'),false);assert.match(status.textContent,/pendiente/);
});
