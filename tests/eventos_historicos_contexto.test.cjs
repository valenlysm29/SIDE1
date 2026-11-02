'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const resolver=require('../js/engine/eventos_autorizados.js');
test('el libro autoritativo es solo para servidor y no inventa sorteos',async()=>{
 const db=await database();try{
  await db.exec('create role service_role; alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(fs.readFileSync('supabase/migrations/20261102015806_side_eventos_historicos_contexto.sql','utf8'));
  const game=await createGame(db,config({cycles:3,economicRulesVersion:'utility-v1',enabledEvents:['PE01','PE91']}));
  const company=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Prueba eventos',p_nombre_comercial:'Prueba eventos'}),id=Number(company.empresa_id);
  const args={p_partida_id:game.id,p_empresa_id:id,p_ciclo:1};
  await db.exec('set role authenticated');await assert.rejects(rpc(db,'side_legacy_event_context_v1',args),/permission denied/i);await db.exec('reset role');
  await db.exec('set role service_role');const missing=await rpc(db,'side_legacy_event_context_v1',args);assert.equal(missing.code,'EVENTOS_NO_VERIFICADOS');await db.exec('reset role');
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{eventSchedule}', $2::jsonb) where id=$1",[game.id,{1:{group:['PE01']}}]);
  await db.query('insert into side_individual_event_schedule(empresa_id,ciclo,events) values($1,1,$2)',[id,['PE91']]);
  await db.exec('set role service_role');const facts=await rpc(db,'side_legacy_event_context_v1',args);assert.equal(facts.version,'legacy-event-context-v1');assert.equal(facts.companyId,String(id));
  assert.deepEqual(facts.groupByCycle,{'1':['PE01']});assert.deepEqual(facts.individualByCycle,{'1':['PE91']});
  assert.deepEqual(resolver.resolve({round:1,...facts}),[]);assert.equal((await rpc(db,'side_legacy_event_context_v1',{...args,p_empresa_id:id+1000})).code,'EVENTOS_NO_VERIFICADOS');
  assert.equal((await rpc(db,'side_legacy_event_context_v1',{...args,p_ciclo:2})).code,'EVENTOS_NO_VERIFICADOS');
 }finally{await db.close();}
});
