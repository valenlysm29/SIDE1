'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 try{
  const migration=name=>fs.readFileSync(require.resolve('../supabase/migrations/'+name),'utf8');
  await db.exec(migration('2026-10-11_fix_crear_partida.sql'));
  await db.exec(migration('2026-10-11_recuperar_salas_compatibles.sql'));
  await db.exec(migration('2026-10-11_codigos_sala_no_reutilizables.sql'));
  const active=await createGame(db),student=await rpc(db,'ingresar_empresa',{p_codigo:active.codigo,p_nombre_legal:'Prueba',p_nombre_comercial:'Prueba'});
  assert.equal(student.success,true);
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()-interval '1 second'))||'{"cancelledAt":null}'::jsonb where id=$1`,[active.id]);
  assert.equal((await rpc(db,'side_sync_game',{p_id:active.id})).configuracion.runtime.phase,'integration','reproduce bloqueo por key null anterior');
  const sql=migration('2026-10-11_estado_codigo_sala.sql');await db.exec(sql);await db.exec(sql);
  for(const marker of [null,false,0,'','false','0','null','  ']){
   const c=config({cancelledAt:marker,gameStartAt:new Date(Date.now()-1000).toISOString(),runtime:{phase:'integration',round:1}});
   assert.equal((await db.query('select public.side_config_cancelada($1) cancelled',[c])).rows[0].cancelled,false);
   assert.equal((await db.query('select public.side_runtime($1) r',[c])).rows[0].r.phase,'decisions');
  }
  for(const c of [{cancelledAt:'2026-10-11T00:00:00Z'},{cancelledAt:true},{phase:'cancelled'},{runtime:{phase:'cancelled'}}])assert.equal((await db.query('select public.side_config_cancelada($1) cancelled',[c])).rows[0].cancelled,true);
  for(const marker of [null,false,0,'false','0','null','  ']){
   const legacy=await createGame(db);
   await db.query(`update partidas set configuracion=$2 where id=$1`,[legacy.id,config({lifecycleVersion:1,cancelledAt:marker})]);
   const recovered=await rpc(db,'recuperar_sala_docente',{p_partida_id:legacy.id});
   assert.equal(recovered.estado,'esperando',`recuperar legacy ${JSON.stringify(marker)} no finaliza sala`);
   assert.equal(recovered.configuracion.runtime.phase,'integration');
   assert.equal((await db.query('select estado from partidas where id=$1',[legacy.id])).rows[0].estado,'esperando');
  }
  for(const terminal of [{cancelledAt:'2026-10-11T00:00:00Z'},{finishedAt:'2026-10-11T00:00:00Z'}]){
   const legacy=await createGame(db);
   await db.query('update partidas set configuracion=$2 where id=$1',[legacy.id,config({lifecycleVersion:1,...terminal})]);
   assert.equal((await rpc(db,'recuperar_sala_docente',{p_partida_id:legacy.id})).estado,'finalizada','recuperación conserva cancelación/cierre real');
  }
  const synced=await rpc(db,'side_sync_game',{p_id:active.id});assert.equal(synced.configuracion.runtime.phase,'decisions');
  const saved=await rpc(db,'guardar_decisiones',{p_empresa_id:student.empresa_id,p_ciclo:1,p_decisiones:[]});assert.equal(saved.error,undefined,'marcador null no bloquea decisiones');
  const status=async code=>{
   const result=await rpc(db,'side_estado_codigo_sala',{p_codigo:code});
   assert.deepEqual(Object.keys(result).sort(),['code','codigo']);
   assert.equal(result.codigo,code.trim().toUpperCase(),'respuesta corresponde al código solicitado');
   return {code:result.code};
  };
  assert.deepEqual(await status(active.codigo),{code:'DISPONIBLE'});
  await db.query(`update partidas set configuracion=configuracion||'{"cancelledAt":"2026-10-11T00:00:00Z","phase":"cancelled"}'::jsonb where id=$1`,[active.id]);
  assert.deepEqual(await status(active.codigo),{code:'PARTIDA_CANCELADA'});
  assert.match((await rpc(db,'guardar_decisiones',{p_empresa_id:student.empresa_id,p_ciclo:1,p_decisiones:[]})).error,/cancelada/);
  const finished=await createGame(db);
  await db.query(`update partidas set estado='finalizada' where id=$1`,[finished.id]);
  assert.deepEqual(await status(finished.codigo),{code:'PARTIDA_FINALIZADA'});
  const waiting=await createGame(db);assert.deepEqual(await status(waiting.codigo),{code:'DISPONIBLE'});
  await db.query('delete from partidas where id=$1',[finished.id]);
  assert.deepEqual(await status(finished.codigo),{code:'CODIGO_RETIRADO'});
  assert.deepEqual(await status('SIDE-NUNCA'),{code:'PARTIDA_NO_ENCONTRADA'});
  await db.exec('set role anon');
  assert.deepEqual(await status(active.codigo.toLowerCase()),{code:'PARTIDA_CANCELADA'});
  assert.deepEqual(await status(finished.codigo),{code:'CODIGO_RETIRADO'});
  await assert.rejects(db.query('select * from side_private.codigos_sala_reservados'),e=>e.code==='42501');
  await db.exec('reset role');
  // Simula datos históricos ambiguos sin exponer ni elegir una identidad.
  await db.exec('alter table public.partidas disable trigger side_reservar_codigo_sala');
  await db.query(`insert into partidas(profesor_id,nombre,codigo) select profesor_id,'Legacy ambiguo',lower(codigo) from partidas where id=$1`,[waiting.id]);
  await db.exec('alter table public.partidas enable trigger side_reservar_codigo_sala');
  assert.deepEqual(await status(waiting.codigo),{code:'CODIGO_AMBIGUO'});
  const definition=(await db.query(`select pg_get_functiondef('public.guardar_decisiones(bigint,integer,jsonb)'::regprocedure) d`)).rows[0].d;
  assert.match(definition,/public.side_config_cancelada\(v_config\)/);assert.doesNotMatch(definition,/v_config \? 'cancelledAt'/);
  const recovery=(await db.query(`select pg_get_functiondef('public.recuperar_sala_docente(uuid,jsonb)'::regprocedure) d`)).rows[0].d;
  assert.match(recovery,/public.side_config_cancelada\(p.configuracion\)/);
  assert.match(recovery,/nullif\(p.configuracion->>'finishedAt',''\) is not null/);
  console.log('estado_codigo_sala_db: PASS (antes/después null, runtime y decisiones, categoría pública, retirados, cancelados, permisos, SQL dos veces)');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
