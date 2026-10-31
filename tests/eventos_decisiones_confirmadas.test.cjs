'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
test('el docente no programa eventos después de confirmar decisiones',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz; create table public.side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo))");
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid)');
  for(const f of ['20261031025358_desafios_autoritativos_v1','20261031030035_consulta_privada_desafios','20261031043153_programacion_desafios_autoritativa','20261031050037_eventos_grupales_mercado_v1','20261031055001_mercado_global_escenarios_v2','20261031055442_eventos_productivos_v2','20261031060031_eventos_atractivo_duracion_v2','20261031060810_proteger_programacion_desafios'])await db.exec(fs.readFileSync(`supabase/migrations/${f}.sql`,'utf8'));
  const game=await createGame(db,config({cycles:6,economicEventsVersion:'demand-share-v1',enabledEvents:[]}));const company=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa QA',p_nombre_comercial:'QA'}),id=Number(company.empresa_id);
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state:{}}}}}]);
  await assert.rejects(()=>rpc(db,'side_assign_event_v1',{p_partida_id:game.id,p_empresa_id:id,p_ciclo:1,p_event_id:'PE69',p_intensity:20}),/decisiones confirmadas/);
  await assert.rejects(()=>rpc(db,'side_assign_group_event_v1',{p_partida_id:game.id,p_ciclo:1,p_event_id:'PE01',p_intensity:10}),/decisiones confirmadas/);
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{3:{state:{}}}}}]);
  await assert.rejects(()=>rpc(db,'side_assign_event_v1',{p_partida_id:game.id,p_empresa_id:id,p_ciclo:2,p_event_id:'PE70',p_intensity:12}),/decisiones confirmadas/);
  const rows=await db.query('select count(*) as n from side_event_assignments_v1');assert.equal(Number(rows.rows[0].n),0);
 }finally{await db.close();}
});
