'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const LIVE=require('../services/live_results'),CYCLE=require('../js/cycle_model');
const {state,catalog}=require('./economic_v19_fixture.cjs');
const teacherSource=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
function snapshot(round=1,previous={}){
 const s=state(round,previous);s.PRODUCCION_META.prices={esencial:42.5,urbano:100,premium:250};
 const saved=JSON.parse(JSON.stringify(s));delete saved.__cyclePlans;
 s.__cyclePlans={...s.__cyclePlans,[round]:{state:saved}};
 return {decision_state:s,cash_ledger:{},financial_sections:{},decisions_submitted:true};
}
test('teacher preview matches the student economic projection without posting sales',()=>{
 const snap=snapshot(),original=JSON.stringify(snap);
 const p=LIVE.calculate({snapshot:snap,round:1,capital:200000,catalog});
 const student=CYCLE.project({state:CYCLE.restoreState(snap.decision_state.__cyclePlans[1].state,snap.decision_state),round:1,capital:200000,catalog,financialPolicy:require('../services/finance_config').resolve({})});
 assert.equal(p.provisional,true);assert.equal(p.receipt.sold,90);assert.equal(p.receipt.revenue,3825);
 assert.deepEqual(p.financial,student.financial);assert.equal(JSON.stringify(snap),original);
 const row=LIVE.apply({ronda:1},p);assert.equal(row.unidadesVendidas,90);assert.equal(row.ingresos,3825);
 assert.equal(LIVE.apply({ronda:2},p).ingresos,undefined);
});
test('unconfirmed plans, other cycles and integration do not create live sales',()=>{
 const snap=snapshot();
 assert.equal(LIVE.calculate({snapshot:snap,round:2,catalog}),null);
 assert.equal(LIVE.calculate({snapshot:snap,phase:'integration',catalog}),null);
 assert.equal(LIVE.calculate({snapshot:snap,phase:'results',catalog}),null);
 delete snap.decision_state.__cyclePlans;assert.equal(LIVE.calculate({snapshot:snap,catalog}),null);
});
test('compatible report transport requires the exact game, company, cycle and an open phase',()=>{
 const estimate=LIVE.calculate({snapshot:snapshot(),capital:200000,catalog});
 const report={estado_resultados:{liveProjection:{...estimate,game:'SIDE-QA',company:'5'}}};
 const scope={game:'SIDE-QA',company:5,round:1,phase:'decisions'};
 assert.equal(LIVE.fromReport(report,scope).receipt.sold,90);
 for(const change of [{game:'OTHER'},{company:6},{round:2},{phase:'results'},{phase:'integration'}])assert.equal(LIVE.fromReport(report,{...scope,...change}),null);
 report.estado_resultados.cycleReceipt={sold:1};assert.equal(LIVE.fromReport(report,scope),null);
});
test('no materials means no sale and financial schedule is identical to student ledger',()=>{
 const snap=snapshot();snap.decision_state.__cyclePlans[1].state.CANALES.optionIds=[];
 assert.equal(LIVE.calculate({snapshot:snap,capital:200000,catalog}).receipt.sold,90);
 const empty=snapshot();empty.decision_state.__cyclePlans[1].state.CUERO.quantities={};
 assert.equal(LIVE.calculate({snapshot:empty,capital:200000,catalog}).receipt.sold,0);
 const config={financialSchedule:[{effectiveRound:1,capital:200000},{effectiveRound:2,capital:225000}]};
 const next=snapshot(2),p=LIVE.calculate({snapshot:next,round:2,capital:200000,catalog,config});
 const base=LIVE.calculate({snapshot:next,round:2,capital:200000,catalog});
 assert.equal(p.financial.balanceCaja.cajaFinal-base.financial.balanceCaja.cajaFinal,25000);
 assert.equal(p.receipt.revenue,base.receipt.revenue);
});
test('shared final closure replaces individual preview, survives reload and remains idempotent',()=>{
 const snap=snapshot();snap.decision_state.__finishedGoods={esencial:5000};
 const input={state:snap.decision_state,catalog,capital:200000};
 const final=CYCLE.closeMany([{id:'A',...input},{id:'B',...input}]);
 const closed={decision_state:final.A.state,cash_ledger:final.A.ledger,financial_sections:final.A.financialSections};
 const p=LIVE.calculate({snapshot:closed,catalog,capital:200000,phase:'results'});
 assert.equal(p.provisional,false);assert.equal(p.receipt.sold,875);assert.equal(p.financial.estadoResultados.ingresos,37187.5);assert.equal(p.receipt.marketAllocation.products.esencial.simulatedCompetitors.length,2);
 assert.deepEqual(LIVE.calculate({snapshot:closed,catalog,capital:200000,phase:'finished'}),p);
 assert.equal(CYCLE.close({...input,state:closed.decision_state,ledger:closed.cash_ledger}).reused,true);
});
function teacher(context,report={}){
 const ctx={state:{partidaId:'room',reports:[]},roomGeneration:1,$:()=>({value:'SIDE-QA'}),presenceTracker:{observe(){}},supabaseCatalog:async()=>null,runtime:()=>({}),remoteProgress:()=>({total:0}),
 window:{SIDE_LIVE_RESULTS:LIVE,SIDE_DECISION_CATALOG:catalog,SIDE:{SupabaseClient:{isReady:()=>true},PartidaService:{listarParticipantes:async()=>({success:true,data:[{empresa_id:5,empresas:{ciclo_actual:1,caja_inicial:200000}}]})},DecisionesService:{obtenerReporte:async()=>({success:true,data:{empresa:{ciclo_actual:1,caja_inicial:200000},reportes:[report],contexto_juego:context}})}}}};
 vm.createContext(ctx);vm.runInContext(teacherSource.slice(teacherSource.indexOf('async function supabaseReports('),teacherSource.indexOf("let rosterSyncError='',reportsBusy")),ctx);return ctx;
}
test('teacher follows server room cycle even when company report still names the previous cycle',async()=>{
 const c={partida_id:'room',codigo:'SIDE-QA',ciclo:2,estado:'activa',phase:'decisions',configuracion:{},snapshot:snapshot(2)};
 const [r]=await teacher(c,{ciclo:1,ingresos:0}).supabaseReports();
 assert.equal(r.ronda,2);assert.equal(r.provisional,false);assert.equal(r.unidadesVendidas,null);assert.equal(r.ingresos,0);
 const [foreign]=await teacher({...c,partida_id:'other'}).supabaseReports();assert.equal(foreign.ingresos,0);assert.equal(foreign.unidadesVendidas,null);
});
test('definitive report is never replaced by a provisional snapshot',async()=>{
 const c={partida_id:'room',codigo:'SIDE-QA',ciclo:1,estado:'activa',phase:'decisions',configuracion:{},snapshot:snapshot()};
 const [r]=await teacher(c,{ciclo:1,ingresos:850,estado_resultados:{cycleReceipt:{round:1,sold:20,revenue:850}}}).supabaseReports();
 assert.equal(r.provisional,false);assert.equal(r.ingresos,850);assert.equal(r.unidadesVendidas,20);
});
test('a closure arriving during a roster read also replaces its cached sold units',async()=>{
 const c={partida_id:'room',codigo:'SIDE-QA',ciclo:1,estado:'activa',phase:'decisions',configuracion:{},snapshot:snapshot()};
 const ctx=teacher(c);const [r]=await ctx.supabaseReports();assert.equal(r.provisional,false);assert.equal(r.unidadesVendidas,null);
 ctx.rows=[r];ctx.final={...LIVE.calculate({snapshot:snapshot(),capital:200000,catalog}).financial,cycleReceipt:{round:1,sold:12,revenue:510}};
 ctx.final.estadoResultados.ingresos=510;
 vm.runInContext("confirmedReportClosures.set(JSON.stringify([roomGeneration,state.partidaId,1,'5']),final);applyConfirmedReportClosures(rows)",ctx);
 assert.equal(r.provisional,false);assert.equal(r.ingresos,510);assert.equal(r.unidadesVendidas,12);
});
