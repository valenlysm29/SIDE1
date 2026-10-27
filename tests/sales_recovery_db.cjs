'use strict';
// Real PostgreSQL functions in a disposable local database; no remote writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const CYCLE=require('../js/cycle_model'),FIN=require('../js/financial_model'),fixture=require('./economic_v19_fixture.cjs');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const clone=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const db=await database(),rows=[];
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  const bundle=read('docs/sql/20261023_despliegue_cierre_v19.sql');
  await db.exec(bundle.split('-- Correcciones generales de ventas (27/10/2026).')[0]);
  const oldGame=await createGame(db,config({capital:200000}));
  const oldId=(await rpc(db,'ingresar_empresa',{p_codigo:oldGame.codigo,p_nombre_legal:'Antes',p_nombre_comercial:'Antes'})).empresa_id;
  const oldState=fixture.state();oldState.PRODUCCION_META.prices={esencial:42.5,urbano:100,premium:250};
  await assert.rejects(db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[oldId,{decision_state:oldState}]),/PRECIO_INVALIDO/);
  delete oldState.PRODUCCION_META.prices;
  const preliminary=FIN.calculate({capital:200000,round:1});oldState.__financialSnapshots={1:preliminary};
  await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[oldId,{decision_state:{...oldState,__cyclePlans:{1:{state:oldState}}}}]);
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[oldGame.id]);
  const before=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:oldGame.id,p_ciclo:1});
  const oldResult=CYCLE.close({state:oldState,catalog:fixture.catalog,round:1,capital:200000});
  assert.equal(oldResult.receipt.sold,90);assert.equal(oldResult.financial.estadoResultados.ingresos,3825);
  await rpc(db,'side_guardar_cierre_negocio',{p_partida_id:oldGame.id,p_ciclo:1,p_token:before.token,p_cierre:{ciclo:1,resultadosPorEmpresa:{[oldId]:oldResult}}});
  const masked=(await db.query('select snapshot from side_student_state where empresa_id=$1',[oldId])).rows[0].snapshot;
  assert.equal(masked.decision_state.__cycleSettlements[1].sold,90);
  assert.equal(masked.decision_state.__financialSnapshots[1].estadoResultados.ingresos,0,'reproduces old SQL masking real sales');

  const patch=read('supabase/migrations/20261027_corregir_ventas_generales.sql');await db.exec(patch);await db.exec(patch);
  for(const prices of [{esencial:-1},{urbano:'100'},{premium:null},{unknown:42}]){
   assert.equal((await db.query('select side_precios_v19_validos($1) as valid',[{PRODUCCION_META:{prices}}])).rows[0].valid,false);
  }
  const historicalBefore=JSON.stringify((await db.query('select cierre from side_business_closures where partida_id=$1',[oldGame.id])).rows);
  const game=await createGame(db,config({capital:200000})),ids=[],saved={};
  for(let i=0;i<4;i++)ids.push(String((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'General '+i,p_nombre_comercial:'General '+i})).empresa_id));
  const window={SIDE_CYCLE_MODEL:CYCLE,SIDE_FINANCIAL_MODEL:FIN,SIDE_FINANCE_CONFIG:require('../services/finance_config'),SIDE_DECISION_CATALOG:fixture.catalog,SIDE:{SupabaseClient:{get:()=>({rpc:async(name,args)=>({data:await rpc(db,name,args),error:null})})}}};
  vm.runInNewContext(read('services/partida_service.js'),{window,console,setTimeout,clearTimeout});
  for(let round=1;round<=3;round++){
   for(const [type,id] of ids.entries()){
    const prior=saved[id],s=fixture.state(round,prior?.state||{},type);
    s.PERS_ENSAMBLE.assignments={ens_personal_esp:{ens_basica:4}};s.PERS_ACABADO.assignments={};
    s.PRODUCCION_META.prices={esencial:42.5,urbano:100,premium:250};
    s.__financialSnapshots={...s.__financialSnapshots,[round]:FIN.calculate({capital:200000,round})};
    const plan=clone(s);delete plan.__cyclePlans;
    s.__cyclePlans={...s.__cyclePlans,[round]:{state:plan}};
    const snapshot={round,decisions_submitted:true,decision_state:s,cash_ledger:prior?.ledger||{},financial_sections:prior?.financialSections||{}};
    await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot,revision=side_student_state.revision+1',[id,snapshot]);
   }
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);
   const closed=await window.SIDE.PartidaService.cerrarNegocio(game.id,round);assert.equal(closed.success,true,JSON.stringify(closed));
   assert.equal(Object.keys(closed.data.resultadosPorEmpresa).length,4);
   for(const id of ids){
    const r=closed.data.resultadosPorEmpresa[id],receipt=r.receipt;
    assert.equal(receipt.produced,90);assert.equal(receipt.sold,90);assert.ok(receipt.revenue>0);
    assert.equal(receipt.revenue,receipt.sales.reduce((total,line)=>total+line.sold*line.price,0));
    const stored=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot;
    assert.equal(stored.decision_state.__cycleSettlements[round].sold,90);
    assert.equal(stored.cash_ledger[round+':SIM_VENTAS'],receipt.revenue);
    assert.equal(stored.decision_state.__financialSnapshots[round].estadoResultados.ingresos,receipt.revenue);
    const reconnected=FIN.calculate({state:stored.decision_state,ledger:stored.cash_ledger,sectionsByRound:stored.financial_sections,catalog:fixture.catalog,round,capital:200000});
    assert.equal(reconnected.estadoResultados.ingresos,receipt.revenue);
    const report=(await db.query('select ingresos,estado_resultados,caja_final from reportes_ciclo where empresa_id=$1 and ciclo=$2',[id,round])).rows[0];
    assert.equal(Number(report.ingresos),receipt.revenue);assert.equal(report.estado_resultados.cycleReceipt.sold,90);
    assert.equal(Number(report.caja_final),reconnected.balanceCaja.cajaFinal);
    rows.push({company:id,round,produced:receipt.produced,sold:receipt.sold,revenue:receipt.revenue,reconnectedRevenue:reconnected.estadoResultados.ingresos});saved[id]=r;
   }
   assert.equal((await window.SIDE.PartidaService.cerrarNegocio(game.id,round)).reused,true);
  }
  assert.equal(JSON.stringify((await db.query('select cierre from side_business_closures where partida_id=$1',[oldGame.id])).rows),historicalBefore,'patch never rewrites previous closures');
  fs.writeFileSync(path.join(__dirname,'output/sales-recovery-db.json'),JSON.stringify({passed:true,companies:4,cycles:3,rows},null,2));
  console.table(rows);console.log('PASS PostgreSQL: reproduced both SQL failures, repeatable patch, four companies / three cycles, stock, revenue, reconnection and idempotence.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
