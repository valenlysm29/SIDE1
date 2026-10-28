'use strict';
// PostgreSQL/RPC integration in a disposable database. No hosted game writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const {state,catalog}=require('./economic_v19_fixture.cjs');
const LIVE=require('../services/live_results'),CYCLE=require('../js/cycle_model'),FIN=require('../js/financial_model');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
(async()=>{
 const db=await database(),rows=[];
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(read('docs/sql/20261023_despliegue_cierre_v19.sql'));
  await db.exec(read('supabase/migrations/20261027_resultados_en_vivo.sql'));
  const game=await createGame(db,config({capital:200000}));
  const identity={p_codigo:game.codigo,p_nombre_legal:'QA VENTAS',p_nombre_comercial:'QA VENTAS'};
  const id=(await rpc(db,'ingresar_empresa',identity)).empresa_id;assert.ok(id);
  const window={SIDE_DECISION_CATALOG:catalog,SIDE_CYCLE_MODEL:CYCLE,SIDE_FINANCIAL_MODEL:FIN,SIDE_FINANCE_CONFIG:require('../services/finance_config'),SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>({data:await rpc(db,name,args)})})}}};
  vm.runInNewContext(read('services/partida_service.js'),{window});
  let prior=null;
  for(let round=1;round<=3;round++){
   await db.query("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','decisions','status','running')) where id=$1",[game.id,round]);
   const s=state(round,prior?.state||{});s.PRODUCCION_META.prices={esencial:42.5,urbano:100,premium:250};
   const plan=JSON.parse(JSON.stringify(s));delete plan.__cyclePlans;
   s.__cyclePlans={...s.__cyclePlans,[round]:{state:plan}};
   const snap={decision_state:s,cash_ledger:prior?.ledger||{},financial_sections:prior?.financialSections||{},decisions_submitted:true};
   await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot,revision=side_student_state.revision+1',[id,snap]);
   const before=JSON.stringify((await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows);
   const response=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:id,p_ciclo:null});
   const ctx=response.contexto_juego;assert.equal(ctx.partida_id,game.id);assert.equal(ctx.ciclo,round);assert.equal(ctx.phase,'decisions');
   assert.equal(Number(response.empresa.ciclo_actual),Math.max(1,round-1),'server cycle must win over stale company cycle');
   const preview=LIVE.calculate({snapshot:ctx.snapshot,round:ctx.ciclo,capital:Number(response.empresa.caja_inicial),catalog,config:ctx.configuracion,id});
   assert.equal(preview.receipt.sold,90);assert.equal(preview.receipt.revenue,3825);
   const revision=(await db.query('select revision from side_student_state where empresa_id=$1',[id])).rows[0].revision;
   const compatible={...preview,game:game.codigo,company:String(id)};
   const saved=await rpc(db,'guardar_reporte_estudiante',{...identity,p_ciclo:round,p_expected_revision:revision,
    p_reporte:{capital:200000,ingresos:0,caja_final:200000,estado_resultados:{ingresos:0,liveProjection:compatible}}});
   assert.equal(saved.success,true,JSON.stringify(saved));
   const storedReport=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:id,p_ciclo:round});
   assert.equal(Number(storedReport.reportes[0].ingresos),0,'projections never become posted revenue');
   assert.equal(Number(storedReport.empresa.caja_actual),200000,'projections never become posted cash');
   assert.equal(LIVE.fromReport(storedReport.reportes[0],{game:game.codigo,company:id,round,phase:'decisions'}).receipt.sold,90);
   assert.equal(JSON.stringify((await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows),before,'reading results never posts sales');
   assert.equal((await db.query('select count(*)::int as n from side_business_closures where partida_id=$1 and ciclo=$2',[game.id,round])).rows[0].n,0);
   await db.query("update partidas set configuracion=jsonb_set(configuracion,'{runtime,phase}','\"results\"'::jsonb) where id=$1",[game.id]);
   const closed=await window.SIDE.PartidaService.cerrarNegocio(game.id,round);assert.equal(closed.success,true,JSON.stringify(closed));
   const fresh=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:id,p_ciclo:round});
   const final=LIVE.calculate({snapshot:fresh.contexto_juego.snapshot,round,capital:200000,catalog,phase:'results'});
   assert.equal(final.provisional,false);assert.equal(final.receipt.sold,90);assert.equal(final.financial.estadoResultados.ingresos,3825);
   assert.equal(Number(fresh.reportes[0].ingresos),3825);assert.equal(fresh.reportes[0].estado_resultados.cycleReceipt.sold,90);
   assert.equal((await window.SIDE.PartidaService.cerrarNegocio(game.id,round)).reused,true);
   prior=closed.data.resultadosPorEmpresa[id];rows.push({round,liveSold:preview.receipt.sold,liveRevenue:preview.receipt.revenue,finalSold:final.receipt.sold,finalRevenue:final.receipt.revenue});
  }
  await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
  const denied=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:id,p_ciclo:null});assert.equal(denied.code,'ACCESO_DENEGADO');assert.equal(denied.contexto_juego,undefined);
  await db.query("select set_config('test.uid','',false)");
  assert.equal((await rpc(db,'obtener_reporte_empresa',{p_empresa_id:id,p_ciclo:null})).code,'ACCESO_DENEGADO');
  const permissions=(await db.query("select has_function_privilege('anon','obtener_reporte_empresa(bigint,integer)','execute') as anon,has_function_privilege('authenticated','obtener_reporte_empresa(bigint,integer)','execute') as teacher")).rows[0];
  assert.equal(permissions.anon,false);assert.equal(permissions.teacher,true);
  await db.query("select set_config('test.uid',$1,false)",[professor]);
  const other=await createGame(db,config());const otherId=(await rpc(db,'ingresar_empresa',{p_codigo:other.codigo,p_nombre_legal:'OTRA',p_nombre_comercial:'OTRA'})).empresa_id;
  const otherReport=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:otherId,p_ciclo:null});assert.equal(otherReport.contexto_juego.partida_id,other.id);assert.equal(otherReport.reportes.length,0);
  fs.writeFileSync(require('node:path').join(__dirname,'output/live-sales-db.json'),JSON.stringify({passed:true,rows,permissions},null,2));
  console.table(rows);console.log('PASS PostgreSQL: live plans, three real closures, reload, authorization, isolation and repeatable migration.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
