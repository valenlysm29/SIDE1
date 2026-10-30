'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const CYCLE=require('../js/cycle_model'),fixture=require('./economic_v19_fixture.cjs');
const root=path.resolve(__dirname,'..');
test('fallo al guardar reporte revierte cierre y estado económico de la empresa',async()=>{
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(fs.readFileSync(path.join(root,'docs/sql/20261023_despliegue_cierre_v19.sql'),'utf8'));
  const game=await createGame(db,config({capital:200000}));
  const identity={p_codigo:game.codigo,p_nombre_legal:'Rollback QA',p_nombre_comercial:'Rollback QA'};
  const joined=await rpc(db,'ingresar_empresa',identity),id=String(joined.empresa_id);
  const state=fixture.state(1);state.__cyclePlans={1:{state:structuredClone(state)}};state.__snapshotRound=1;
  const beforeSave=(await db.query('select revision from side_student_state where empresa_id=$1',[id])).rows[0];
  const snapshot={round:1,decision_state:state,cash_ledger:{},financial_sections:{},section_submissions:{B:true,C:true,D:true,E:true},decisions_submitted:true};
  const saved=await rpc(db,'guardar_estado_estudiante',{...identity,p_snapshot:snapshot,p_expected_revision:Number(beforeSave.revision)});assert.equal(saved.success,true,JSON.stringify(saved));
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  const ctx=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1});assert.equal(ctx.empresas.length,1);
  const initial=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0];
  const cash=(await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual;
  const result=CYCLE.close({state:ctx.empresas[0].snapshot.decision_state,catalog:fixture.catalog,round:1,capital:200000});
  await db.exec("create function public.test_fail_report() returns trigger language plpgsql as $$ begin raise exception 'fallo inducido QA'; end $$; create trigger test_fail_report before insert or update on public.reportes_ciclo for each row execute function public.test_fail_report();");
  await assert.rejects(()=>rpc(db,'side_guardar_cierre_negocio',{p_partida_id:game.id,p_ciclo:1,p_token:ctx.token,p_cierre:{ciclo:1,resultadosPorEmpresa:{[id]:result}}}),/fallo inducido QA/);
  assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),0);
  assert.equal(Number((await db.query('select count(*) as n from reportes_ciclo where empresa_id=$1',[id])).rows[0].n),0);
  const after=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0];
  assert.deepEqual(after,initial);assert.equal((await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual,cash);
  await db.exec('drop trigger test_fail_report on public.reportes_ciclo');
  const retry=await rpc(db,'side_guardar_cierre_negocio',{p_partida_id:game.id,p_ciclo:1,p_token:ctx.token,p_cierre:{ciclo:1,resultadosPorEmpresa:{[id]:result}}});assert.ok(retry.cierre,JSON.stringify(retry));
 }finally{await db.close();}
});
