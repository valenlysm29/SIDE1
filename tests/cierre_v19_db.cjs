'use strict';
// Disposable PostgreSQL only; never contacts the configured Supabase project.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..');
const load=name=>fs.readFileSync(path.join(root,name),'utf8');
async function main(){
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec("create function side_test_legacy_v19() returns trigger language plpgsql as 'begin return new; end'; create trigger side_excel_snapshot_protegido before update on side_student_state for each row execute function side_test_legacy_v19(); create trigger side_excel_reporte_protegido before insert on reportes_ciclo for each row execute function side_test_legacy_v19();");
  await db.exec(load('docs/sql/20261023_despliegue_cierre_v19.sql'));
  await db.exec(load('docs/sql/20261023_despliegue_cierre_v19.sql'));
  const game=await createGame(db,config({capital:200000}));
  await db.query("update partidas set codigo='SIDE-000' where id=$1",[game.id]);game.codigo='SIDE-000';
  const join=async name=>(await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:name,p_nombre_comercial:name})).empresa_id;
  const a=await join('Confirmada'),b=await join('Replicada'),c=await join('Primera sin decidir'),d=await join('Confirmación recuperada');
  assert.ok(a&&b&&c&&d);
  const counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_ind:1},ACABADOS:{aca_ind:1},PERS_CORTE:{corte_maestro:1},PERS_ENSAMBLE:{ens_personal_esp:1},PERS_ACABADO:{aca_personal_art:1},CUERO:{cuero_sint:30},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:600}};
  function state(round){const result={};for(const [key,quantities] of Object.entries(counts))result[key]={round,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(key)?{purchases:{1:quantities}}:{})};return {...result,MOLDE:{round:1,optionIds:['molde_1']},JEFATURA:{round,optionIds:['si_jefatura']},CANALES:{round,optionIds:['web']},PRODUCCION_META:{round,value:100,moldTargets:{molde_1:100},prices:{esencial:42.5}}};}
  const write=async(id,ds,submitted=false)=>db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[id,{decision_state:ds,cash_ledger:{},financial_sections:{},decisions_submitted:submitted}]);
  await write(a,{...state(2),__cyclePlans:{2:{state:state(2)}}},true);
  await write(b,{...state(1),__inventarioMP:{cuero_sint:2},__cyclePlans:{1:{state:state(1)}}});
  await write(d,state(2),true);
  const closeRuntime=async(mode='manual')=>db.query("update partidas set configuracion=configuracion||jsonb_build_object('cycleCloseMode',$2::text,'runtime',jsonb_build_object('round',2,'phase','results','status','finished')) where id=$1",[game.id,mode]);
  await closeRuntime();
  const args={p_partida_id:game.id,p_ciclo:2};
  const ctx=await rpc(db,'side_contexto_cierre_negocio',args);
  assert.equal(ctx.error,undefined,JSON.stringify(ctx));assert.equal(ctx.empresas.length,3,'all eligible companies resolved before freezing a market');
  assert.ok((await db.query('select expulsada_at from participantes where empresa_id=$1',[c])).rows[0].expulsada_at);
  const replica=ctx.empresas.find(x=>String(x.id)===String(b)).snapshot.decision_state.__cyclePlans[2];
  assert.equal(replica.source,'replicated');assert.equal(replica.state.CUERO.round,2);assert.deepEqual(replica.state.MESA_CORTE.purchases,{1:{mesa:1}});assert.equal(replica.state.__inventarioMP.cuero_sint,2);
  assert.equal(ctx.empresas.find(x=>String(x.id)===String(d)).snapshot.decision_state.__cyclePlans[2].source,'recovered-confirmation');
  assert.equal((await rpc(db,'side_contexto_cierre_negocio',args)).token,ctx.token,'resolving twice is stable');
  await assert.rejects(write(a,{...state(2),PRODUCCION_META:{prices:{esencial:75}}}),/PRECIO_INVALIDO/);
  await assert.rejects(write(a,{...state(2),PRODUCCION_META:{prices:{urbano:'150'}}}),/PRECIO_INVALIDO/);
  const sandbox={window:{}};vm.runInNewContext(load('js/decision_catalog.js'),sandbox);
  const CYCLE=require('../js/cycle_model.js'),catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));
  const results=CYCLE.closeMany(ctx.empresas.map(company=>{const s=company.snapshot,plan=s.decision_state.__cyclePlans[2];return {id:String(company.id),state:CYCLE.restoreState(plan.state,s.decision_state),catalog,round:2,capital:company.capital,ledger:s.cash_ledger,planSource:plan.source,fromRound:plan.fromRound};}));
  for(const result of Object.values(results))assert.ok(result.receipt.revenue>0,'valid physical decisions generate sales in SIDE-000');
  const saveArgs={...args,p_token:ctx.token,p_cierre:{ciclo:2,resultadosPorEmpresa:results}};
  assert.equal((await rpc(db,'side_guardar_cierre_negocio',{...saveArgs,p_token:'stale-token'})).code,'ESTADO_DESACTUALIZADO');
  assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),0,'stale result cannot persist a partial closure');
  const window={SIDE_CYCLE_MODEL:CYCLE,SIDE_FINANCIAL_MODEL:require('../js/financial_model.js'),SIDE_FINANCE_CONFIG:require('../services/finance_config.js'),SIDE_DECISION_CATALOG:catalog,SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>({data:await rpc(db,name,args),error:null})})}}};
  vm.runInNewContext(load('services/partida_service.js'),{window,console,setTimeout,clearTimeout});
  const saved=await window.SIDE.PartidaService.cerrarNegocio(game.id,2);assert.equal(saved.success,true,JSON.stringify(saved));assert.equal(saved.reused,false);
  for(const company of ctx.empresas){
   const expected=results[company.id],remote=saved.data.resultadosPorEmpresa[company.id];
   assert.equal(remote.financial.estadoResultados.costos,expected.financial.estadoResultados.costos,'service must retain reconstructed section accounting');
   assert.equal(remote.financial.balanceGeneral.inventarioMP,expected.financial.balanceGeneral.inventarioMP,'service must not expense unused materials');
   const persisted=(await db.query('select snapshot from side_student_state where empresa_id=$1',[company.id])).rows[0].snapshot;
   assert.deepEqual(persisted.financial_sections,expected.financialSections,'reconstructed sections survive reconnection');
   assert.deepEqual(persisted.cash_ledger,remote.ledger);
   const live=copySnapshot(persisted.decision_state);delete live.__financialSnapshots[2];
   const recalculated=window.SIDE_FINANCIAL_MODEL.calculate({state:live,ledger:persisted.cash_ledger,sectionsByRound:persisted.financial_sections,catalog,round:2,capital:company.capital,financialPolicy:remote.receipt.financialPolicy});
   assert.equal(recalculated.estadoResultados.costos,remote.financial.estadoResultados.costos);
   assert.equal(recalculated.balanceGeneral.inventarioMP,remote.financial.balanceGeneral.inventarioMP);
  }
  const again=await rpc(db,'side_guardar_cierre_negocio',saveArgs);assert.equal(again.reused,true);
  const stored=(await db.query('select snapshot from side_student_state where empresa_id=$1',[a])).rows[0].snapshot.decision_state;
  assert.ok(stored.__economicHistory);assert.equal(typeof stored.__accountsReceivable,'number');
  await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
  assert.equal((await rpc(db,'side_contexto_cierre_negocio',args)).code,'NO_AUTORIZADO');
  await db.query("select set_config('test.uid',$1,false)",[professor]);
  const automatic=await createGame(db,config({cycleCloseMode:'automatic',planSyncGraceSeconds:30}));
  const autoJoin=async name=>(await rpc(db,'ingresar_empresa',{p_codigo:automatic.codigo,p_nombre_legal:name,p_nombre_comercial:name})).empresa_id;
  const earlyId=await autoJoin('Auto early'),lateId=await autoJoin('Auto late');
  await write(earlyId,{...state(1),__cyclePlans:{1:{state:state(1)}}},true);
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('gameStartAt',clock_timestamp()-interval '600 seconds','runtime',jsonb_build_object('round',2,'phase','decisions')) where id=$1",[automatic.id]);
  assert.equal((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:automatic.id,p_ciclo:1})).code,'PLANES_EN_GRACIA');
  assert.equal((await db.query('select expulsada_at from participantes where empresa_id=$1',[lateId])).rows[0].expulsada_at,null,'grace never eliminates a late company prematurely');
  await write(lateId,{...state(1),__cyclePlans:{1:{state:state(1)}}},true);
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()-interval '640 seconds')) where id=$1",[automatic.id]);
  const lateContext=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:automatic.id,p_ciclo:1});
  assert.equal(lateContext.empresas.length,2,'a plan arriving in grace competes with the previously confirmed company');
  const diagnostic=await rpc(db,'side_diagnostico_v19',{});assert.equal(diagnostic.version,'excel-v19');assert.deepEqual(diagnostic.legacyTriggers,[]);assert.equal(diagnostic.functions.configurationCAS,true);assert.equal(diagnostic.columns.config_revision,true);
  console.log('PASS SQL v19: repeat deployment, all-company resolution, first elimination, replication, recovered plan, invalid prices, auth, CAS, idempotence, automatic grace, economic state persistence.');
  console.log('SIDE-000 disposable local demo:',JSON.stringify(Object.fromEntries(Object.entries(results).map(([id,r])=>[id,{sales:r.receipt.sold,revenue:r.receipt.revenue}]))));
 }finally{await db.close();}
}
function copySnapshot(value){return JSON.parse(JSON.stringify(value));}
main().catch(error=>{console.error(error);process.exitCode=1;});
