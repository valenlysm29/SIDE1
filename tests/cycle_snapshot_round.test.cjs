'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const fixture=require('./economic_v19_fixture.cjs'),CYCLE=require('../js/cycle_model.js');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const hydrate=source.slice(source.indexOf('function hydrateRemoteProgress('),source.indexOf('async function refreshStudentGame('));
const build=source.slice(source.indexOf('function buildStudentSnapshot('),source.indexOf('async function recoverStaleStudentState('));
function runtime(round=2){
 const storage=new Map(),key='SIDE-QA_Marca';
 const sandbox={console,Number,Object,Math,JSON,Date,
  currentStudent:{company:'Marca'},studentProgressHydrated:false,decisionState:{},cashLedger:{},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  remoteSnapshot:d=>d.snapshot,currentRound:()=>round,storageKey:()=>key,decisionKey:()=>`SIDE_DECISIONS_${key}`,ledgerKey:()=>`SIDE_CASH_LEDGER_${key}`,financialSectionsKey:()=>`SIDE_FINANCIAL_SECTIONS_${key}`,
  submissionKey:()=>`SIDE_DECISIONS_SUBMITTED_${key}_${round}`,decisionCategories:()=>['B','C','D','E'].map(cat=>({cat})),characterSelectionKey:()=>`SIDE_CHARACTER_${key}`,
  initialCapital:()=>200000,legacyRemoteDecisionState:()=>({}),showStudentExpulsion:()=>{},
  $:()=>({classList:{contains:()=>true}}),deepClone:v=>JSON.parse(JSON.stringify(v)),
  cycleBusinessData:()=>({events:[]}),recordedFinancialSections:()=>({}),selectedCharacterSlug:()=>null,
  sectionSubmitted:cat=>storage.get(`SIDE_DECISION_SECTION_SUBMITTED_${key}_${round}_${cat}`)==='1',
  simulationSubmissionComplete:()=>storage.get(`SIDE_DECISIONS_SUBMITTED_${key}_${round}`)==='1',
  captureCyclePlan:()=>{sandbox.decisionState.__cyclePlans={...sandbox.decisionState.__cyclePlans,[round]:{state:JSON.parse(JSON.stringify(sandbox.decisionState))}};},
  writeDecisionBatch:writes=>{for(const [k,v] of Object.entries(writes))if(v===null)storage.delete(k);else storage.set(k,v);return true;},
  loadDecisionState:()=>{sandbox.decisionState=JSON.parse(storage.get(`SIDE_DECISIONS_${key}`)||'{}');sandbox.cashLedger=JSON.parse(storage.get(`SIDE_CASH_LEDGER_${key}`)||'{}');}
 };
 const context=vm.createContext(sandbox);vm.runInContext(hydrate+'\n'+build,context);
 return {sandbox,storage,hydrate:snapshot=>sandbox.hydrateRemoteProgress({partida:{id:'qa'},empresa:{id:1,caja_actual:200000},ciclo_partida:round,snapshot})};
}
test('legacy database flags remain attached to their saved cycle when the room advances',()=>{
 const r=runtime(),state=fixture.state(1);state.__cyclePlans={1:{state:structuredClone(state)}};
 r.storage.set('SIDE_DECISIONS_SUBMITTED_SIDE-QA_Marca_2','1');
 assert.equal(r.hydrate({decision_state:state,section_submissions:{B:true,C:true,D:true,E:true},decisions_submitted:true}),true);
 assert.equal(r.storage.get('SIDE_DECISIONS_SUBMITTED_SIDE-QA_Marca_1'),'1');
 assert.equal(r.sandbox.simulationSubmissionComplete(),false,'a first-cycle confirmation must not lock the next cycle');
 for(const cat of ['B','C','D','E'])assert.equal(r.storage.has(`SIDE_DECISION_SECTION_SUBMITTED_SIDE-QA_Marca_2_${cat}`),false);
 const next=r.sandbox.buildStudentSnapshot();
 assert.equal(next.decisions_submitted,false);assert.equal(next.decision_state.__cyclePlans[2],undefined,'reading/syncing cannot invent a stale confirmed plan');
 assert.equal(next.decision_state.__snapshotRound,2,'saved marker survives older SQL whitelists');
});
test('already contaminated current plans recover their original cycle without modifying resources or historical closures',()=>{
 const r=runtime(),state=fixture.state(1),badPlan={state:fixture.state(1)};
 state.__cyclePlans={1:{state:fixture.state(1)},2:badPlan};state.__snapshotRound=2;
 state.__cycleSettlements={1:{round:1,sold:90,revenue:3825}};
 const original=structuredClone(state),ledger={'1:SIM_VENTAS':3825};
 r.hydrate({round:2,decision_state:state,cash_ledger:ledger,section_submissions:{B:true,C:true,D:true,E:true},decisions_submitted:true});
 assert.equal(r.sandbox.simulationSubmissionComplete(),false);
 assert.equal(r.sandbox.decisionState.__cyclePlans[2],undefined);
 assert.deepEqual(JSON.parse(r.storage.get('SIDE_STALE_CYCLE_PLAN_BACKUP_SIDE-QA_Marca_2')),badPlan);
 assert.deepEqual(r.sandbox.decisionState.__cycleSettlements[1],original.__cycleSettlements[1]);
 assert.deepEqual(r.sandbox.decisionState.CUERO,original.CUERO);assert.deepEqual(r.sandbox.cashLedger,ledger);
 assert.deepEqual(state,original,'the remote response is not mutated');
 assert.equal(r.sandbox.buildStudentSnapshot().decision_state.__cyclePlans[2],undefined);
});
test('valid current plans and completed historical receipts cannot be discarded as stale',()=>{
 for(const settled of [false,true]){
  const r=runtime(),state=fixture.state(settled?1:2);
  state.__cyclePlans={2:{state:structuredClone(state)}};
  if(settled)state.__cycleSettlements={2:{round:2,sold:90,revenue:3825}};
  r.hydrate({round:2,decision_state:state,decisions_submitted:true});
  assert.equal(r.sandbox.simulationSubmissionComplete(),true);
  assert.ok(r.sandbox.decisionState.__cyclePlans[2]);
  assert.equal(r.storage.has('SIDE_STALE_CYCLE_PLAN_BACKUP_SIDE-QA_Marca_2'),false);
 }
});
test('current-cycle and partial confirmations survive hydration with explicit or nested round markers',()=>{
 for(const marker of [{round:2},{decision_state:{__snapshotRound:2}}]){
  const r=runtime(),snapshot={...marker,decision_state:{...fixture.state(1),...(marker.decision_state||{})},section_submissions:{B:true,C:false},decisions_submitted:false};
  r.hydrate(snapshot);assert.equal(r.storage.get('SIDE_DECISION_SECTION_SUBMITTED_SIDE-QA_Marca_2_B'),'1');
  assert.equal(r.storage.has('SIDE_DECISION_SECTION_SUBMITTED_SIDE-QA_Marca_2_C'),false);
 }
});
test('legacy partial decisions infer the latest actual decision cycle rather than an older plan',()=>{
 const r=runtime(),state=fixture.state(1);state.CUERO.round=2;state.__cyclePlans={1:{state:fixture.state(1)}};
 r.hydrate({decision_state:state,section_submissions:{C:true},decisions_submitted:false});
 assert.equal(r.storage.get('SIDE_DECISION_SECTION_SUBMITTED_SIDE-QA_Marca_2_C'),'1');
});
test('durable queue skips a stale preview after a confirmed closure without dropping real decisions',async()=>{
 const saved=[],sandbox={console,studentOutbox:null,studentSnapshotEpoch:1,currentStudent:{snapshotRevision:2},decisionState:{__cycleSettlements:{1:{sold:90,revenue:3825}}},localStorage:{},
  studentIdentity:()=>({}),studentIdentityKey:()=> 'qa',studentConnected:true,
  defaultSegmentPrices:()=>({}),recoverStaleStudentState(){},rejectStudentSession(){},showStudentSyncStatus(){},persistStudentSession(){}};
 sandbox.window={SIDE:{StudentSync:{createQueue:options=>options},DecisionesService:{guardar:async(...args)=>{saved.push({type:'decisions',args});return {success:true};},guardarReporte:async(...args)=>{saved.push({type:'report',args});return {success:true};}},EmpresaService:{}}};
 vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('function getStudentOutbox('),source.indexOf('function retryStudentSync(')),sandbox);
 const queue=sandbox.getStudentOutbox();
 assert.equal((await queue.saveOperation({},1,{type:'report',payload:{ingresos:0}},2)).closed,true);assert.equal(saved.length,0);
 await queue.saveOperation({},1,{type:'decisions',payload:[{decision_id:'CUERO',cantidad:30}]},2);assert.equal(saved[0].type,'decisions');
 await queue.saveOperation({},2,{type:'report',payload:{ingresos:0}},2);assert.equal(saved[1].type,'report','an open-cycle preview can still synchronize');
});
test('real PostgreSQL whitelist, student snapshots and three shared closures preserve nonzero sales',async()=>{
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(fs.readFileSync(path.join(root,'docs/sql/20261023_despliegue_cierre_v19.sql'),'utf8'));
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261027_preservar_ciclo_snapshot.sql'),'utf8');
  await db.exec(migration);await db.exec(migration);
  const reportGuard=fs.readFileSync(path.join(root,'supabase/migrations/20261027_proteger_reportes_cerrados.sql'),'utf8');await db.exec(reportGuard);await db.exec(reportGuard);
  const game=await createGame(db,config({capital:200000})),identity={p_codigo:game.codigo,p_nombre_legal:'Continuidad',p_nombre_comercial:'Continuidad'};
  const id=String((await rpc(db,'ingresar_empresa',identity)).empresa_id);
  let previous={};
  for(let round=1;round<=3;round++){
   const state=fixture.state(round,previous.state||{}),plan=structuredClone(state);delete plan.__cyclePlans;
   state.__cyclePlans={...state.__cyclePlans,[round]:{state:plan}};state.__snapshotRound=round;
   const revision=Number((await db.query('select revision from side_student_state where empresa_id=$1',[id])).rows[0].revision);
   const snapshot={round,decision_state:state,cash_ledger:previous.ledger||{},financial_sections:previous.financialSections||{},section_submissions:{B:true,C:true,D:true,E:true},decisions_submitted:true};
   const saved=await rpc(db,'guardar_estado_estudiante',{...identity,p_snapshot:snapshot,p_expected_revision:revision});assert.equal(saved.success,true,JSON.stringify(saved));
   const persisted=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot;
   assert.equal(persisted.round,round);
   const reconnected=runtime(round+1);reconnected.hydrate(persisted);assert.equal(reconnected.sandbox.simulationSubmissionComplete(),false);
   const oldWhitelist=structuredClone(persisted);delete oldWhitelist.round;delete oldWhitelist.decision_state.__snapshotRound;
   const older=runtime(round+1);older.hydrate(oldWhitelist);assert.equal(older.sandbox.simulationSubmissionComplete(),false);
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);
   const ctx=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round});assert.equal(ctx.empresas.length,1);
   previous=CYCLE.close({state:ctx.empresas[0].snapshot.decision_state,catalog:fixture.catalog,round,capital:200000,ledger:persisted.cash_ledger,sectionsByRound:persisted.financial_sections});
   assert.equal(previous.receipt.sold,90);assert.equal(previous.receipt.revenue,3825);
   const closed=await rpc(db,'side_guardar_cierre_negocio',{p_partida_id:game.id,p_ciclo:round,p_token:ctx.token,p_cierre:{ciclo:round,resultadosPorEmpresa:{[id]:previous}}});assert.ok(closed.cierre,JSON.stringify(closed));
   const report=(await db.query('select ingresos,estado_resultados from reportes_ciclo where empresa_id=$1 and ciclo=$2',[id,round])).rows[0];assert.equal(Number(report.ingresos),3825);assert.equal(report.estado_resultados.cycleReceipt.sold,90);
   const currentRevision=Number((await db.query('select revision from side_student_state where empresa_id=$1',[id])).rows[0].revision);
   const delayed={...identity,p_ciclo:round,p_reporte:{capital:200000,ingresos:0,costos:0,utilidad:0,caja_final:200000,estado_resultados:{ingresos:0}},p_expected_revision:currentRevision};
   assert.equal((await rpc(db,'guardar_reporte_estudiante',{...delayed,p_nombre_legal:'Wrong identity'})).code,'CREDENCIALES_INVALIDAS');
   assert.equal((await rpc(db,'guardar_reporte_estudiante',{...delayed,p_expected_revision:currentRevision-1})).code,'ESTADO_DESACTUALIZADO');
   const ignored=await rpc(db,'guardar_reporte_estudiante',delayed);assert.equal(ignored.success,true);assert.equal(ignored.closed,true);
   const after=(await db.query('select ingresos,estado_resultados,caja_final from reportes_ciclo where empresa_id=$1 and ciclo=$2',[id,round])).rows[0];assert.equal(Number(after.ingresos),3825);assert.equal(after.estado_resultados.cycleReceipt.sold,90);
   assert.equal(Number((await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual),Number(after.caja_final));

  }
 }finally{await db.close();}
});


test('migration restores already overwritten reports from exact stored closures and preserves later company cash',async()=>{
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(fs.readFileSync(path.join(root,'docs/sql/20261023_despliegue_cierre_v19.sql'),'utf8'));
  const game=await createGame(db,config({capital:200000})),identity={p_codigo:game.codigo,p_nombre_legal:'Recover report',p_nombre_comercial:'Recover report'};
  const id=String((await rpc(db,'ingresar_empresa',identity)).empresa_id),state=fixture.state(1),result=CYCLE.close({state,catalog:fixture.catalog,round:1,capital:200000});
  await db.query('insert into side_business_closures(partida_id,ciclo,cierre) values($1,1,$2)',[game.id,{ciclo:1,resultadosPorEmpresa:{[id]:result}}]);
  await db.query('insert into reportes_ciclo(empresa_id,ciclo,ingresos,costos,utilidad,caja_final,estado_resultados) values($1,1,0,0,0,0,$2)',[id,{ingresos:0,note:'Preserve metadata'}]);
  await db.query('insert into reportes_ciclo(empresa_id,ciclo,ingresos,estado_resultados) values($1,2,123,$2)',[id,{note:'Open cycle without closure'}]);
  await db.query('update empresas set caja_actual=12345 where id=$1',[id]);
  const repair=fs.readFileSync(path.join(root,'supabase/migrations/20261027_proteger_reportes_cerrados.sql'),'utf8');await db.exec(repair);await db.exec(repair);
  const report=(await db.query('select ingresos,costos,utilidad,caja_final,estado_resultados from reportes_ciclo where empresa_id=$1 and ciclo=1',[id])).rows[0];
  assert.equal(Number(report.ingresos),3825);assert.equal(report.estado_resultados.cycleReceipt.sold,90);assert.equal(report.estado_resultados.note,'Preserve metadata');
  assert.equal(Number(report.costos),result.financial.estadoResultados.costos);assert.equal(Number(report.caja_final),result.financial.balanceCaja.cajaFinal);
  assert.equal(Number((await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual),12345,'later cash movements are never replaced by historical closure cash');
  assert.equal(Number((await db.query('select ingresos from reportes_ciclo where empresa_id=$1 and ciclo=2',[id])).rows[0].ingresos),123,'cycles without a stored closure stay unchanged');
  assert.deepEqual((await db.query('select cierre from side_business_closures where partida_id=$1',[game.id])).rows[0].cierre.resultadosPorEmpresa[id],JSON.parse(JSON.stringify(result)),'repair cannot rewrite its source closure');
 }finally{await db.close();}
});
