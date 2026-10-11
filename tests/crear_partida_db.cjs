'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,rpc,professor}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 try{
  // schema.sql lo incluye; supabase_migration.sql no. Probar instalación estricta.
  await db.exec(`create unique index if not exists ux_side_una_partida_activa_por_profesor on public.partidas(profesor_id) where estado='activa';`);
  const sql=fs.readFileSync(require.resolve('../supabase/migrations/2026-10-11_fix_crear_partida.sql'),'utf8');await db.exec(sql);await db.exec(sql);
  let request=0;const next=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++request).padStart(12,'0')}`;
  const make=(id=next(),replace=null,c={})=>rpc(db,'crear_sala_docente',{p_config:config({integrationDurationMinutes:2,roundMinutes:5,...c}),p_nombre:'Prueba',p_curso:'Curso',p_segmento:'Estandar',p_request_id:id,p_reemplazar_id:replace});
  assert.equal(await rpc(db,'obtener_sala_docente',{}),null);
  const requestId=next(),first=await make(requestId,null,{cancelledAt:'2000-01-01',runtime:{phase:'cancelled'}});assert.equal(first.estado,'esperando');assert.equal(first.configuracion.runtime.phase,'integration');assert.equal(first.configuracion.cancelledAt,undefined);assert.ok(first.serverTime);
  assert.equal((await make(requestId)).id,first.id,'respuesta perdida: misma sala');
  assert.equal((await make()).code,'SALA_ACTIVA','dos pestañas no duplican sala');
  assert.equal((await db.query('select count(*)::int as n from partidas')).rows[0].n,1);
  assert.equal((await rpc(db,'obtener_sala_docente',{})).id,first.id,'recarga recupera servidor');
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=$1`,[first.id]);
  const started=await rpc(db,'obtener_sala_docente',{}),again=await rpc(db,'obtener_sala_docente',{});assert.equal(started.estado,'activa');assert.equal(started.configuracion.runtime.startedAt,again.configuracion.runtime.startedAt,'inicio una sola vez');
  assert.equal((await make()).code,'SALA_ACTIVA','sala en curso');
  await assert.rejects(make(next(),first.id,{cycles:0}),/Indica entre 1 y 20 ciclos/);
  assert.equal((await rpc(db,'obtener_sala_docente',{})).id,first.id,'config inválida revierte cierre anterior');
  const replacement=await make(next(),first.id);assert.notEqual(replacement.id,first.id);assert.notEqual(replacement.codigo,first.codigo);
  const old=(await db.query('select * from partidas where id=$1',[first.id])).rows[0];assert.equal(old.estado,'finalizada');assert.equal(old.configuracion.runtime.phase,'cancelled');
  await rpc(db,'controlar_partida',{p_partida_id:replacement.id,p_accion:'cancelar'});
  // Un request ya cancelado sigue apuntando a la misma fila; servicio/UI exigen request nuevo.
  const cancelledRequest=(await db.query('select creation_request_id from partidas where id=$1',[replacement.id])).rows[0].creation_request_id;
  const retriedCancelled=await make(cancelledRequest);assert.equal(retriedCancelled.id,replacement.id);assert.equal(retriedCancelled.estado,'finalizada');
  const afterCancel=await make();assert.equal(afterCancel.estado,'esperando');
  await db.query(`update partidas set estado='finalizada',configuracion=configuracion||' {"phase":"finished","runtime":{"phase":"finished"}}'::jsonb where id=$1`,[afterCancel.id]);
  const automatic=await make(next(),null,{cycleCloseMode:'automatic'});assert.equal(automatic.estado,'esperando');
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=$1`,[automatic.id]);assert.equal((await rpc(db,'obtener_sala_docente',{})).estado,'activa');
  await db.query(`select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)`);assert.equal(await rpc(db,'obtener_sala_docente',{}),null);assert.equal((await make(next(),automatic.id)).code,'NO_AUTORIZADO');
  await db.query(`select set_config('test.uid',$1,false)`,[professor]);
  const foreign='33333333-3333-4333-8333-333333333333';assert.equal((await make(next(),foreign)).code,'SALA_ACTIVA');
  // Datos legacy: una activa y varias esperando son recuperables sin violar el índice.
  const extra=(await db.query(`insert into partidas(profesor_id,nombre,configuracion) values($1,'Legacy',$2) returning id`,[professor,config()])).rows[0];
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=$1`,[extra.id]);
  assert.equal((await rpc(db,'obtener_sala_docente',{})).id,automatic.id);
  await db.query(`update partidas set estado='finalizada' where id=$1`,[extra.id]);
  await db.exec('set role authenticated');assert.equal((await rpc(db,'obtener_sala_docente',{})).id,automatic.id);
  await db.query(`select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)`);assert.equal(await rpc(db,'obtener_sala_docente',{}),null);assert.equal((await make()).code,'NO_AUTORIZADO');await db.exec('reset role');
  await db.query(`select set_config('test.uid',$1,false)`,[professor]);
  await db.exec('set role anon');await assert.rejects(rpc(db,'obtener_sala_docente',{}),error=>error.code==='42501');await db.exec('reset role');
  const grants=(await db.query(`select has_function_privilege('anon','public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)','EXECUTE') anon,has_function_privilege('authenticated','public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)','EXECUTE') teacher`)).rows[0];assert.equal(grants.anon,false);assert.equal(grants.teacher,true);
  await rpc(db,'controlar_partida',{p_partida_id:automatic.id,p_accion:'cancelar'});
  // Inyección de colisión real: el generador produce un código existente una vez.
  await db.exec(`create sequence test_code_attempt; create or replace function public.side_next_game_code() returns text language plpgsql as $$begin if nextval('test_code_attempt')=1 then return '${first.codigo}';end if;return 'SIDE-ZZ9';end $$;`);
  const collision=await make();assert.equal(collision.codigo,'SIDE-ZZ9');assert.equal((await db.query('select last_value::int as n from test_code_attempt')).rows[0].n,2);
  await rpc(db,'controlar_partida',{p_partida_id:collision.id,p_accion:'cancelar'});
  await db.exec(`create or replace function public.side_next_game_code() returns text language sql as $$select 'SIDE-ZZ9'::text$$;`);
  await assert.rejects(make(),error=>error.code==='23505','colisión permanente nunca anuncia éxito');
  await db.query(`select set_config('test.uid','',false)`);assert.equal((await rpc(db,'obtener_sala_docente',{})).code,'NO_AUTORIZADO');
  console.log('crear_partida_db: PASS (SQL dos veces, idempotencia, conflictos, reemplazo, recarga, Manual/Automático, permisos)');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
