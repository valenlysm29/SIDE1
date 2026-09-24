const assert=require('node:assert/strict');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 try{
  const manual=await createGame(db);
  assert.equal(manual.configuracion.phase,'integration');
  const join=(game,name)=>rpc(db,'crear_empresa',{p_partida_id:game.id,p_nombre_estudiante:name,p_nombre_legal:name,p_nombre_comercial:name});
  const a=await join(manual,'A'),b=await join(manual,'B');assert.ok(a.empresa_id);assert.ok(b.empresa_id);
  const status=id=>rpc(db,'obtener_estado_juego',{p_empresa_id:id});
  const action=(game,name,extra={})=>rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:name,...extra});
  assert.equal((await status(a.empresa_id)).partida.configuracion.phase,'integration');
  assert.ok((await rpc(db,'guardar_decisiones',{p_empresa_id:a.empresa_id,p_ciclo:1,p_decisiones:[]})).error);
  const started=await action(manual,'iniciar');assert.equal(started.configuracion.phase,'decisions');
  const again=await Promise.all([action(manual,'iniciar'),action(manual,'iniciar')]);
  assert.ok(again.every(p=>p.configuracion.gameStartedAt===started.configuracion.gameStartedAt));
  for(const id of [a.empresa_id,b.empresa_id])assert.equal((await status(id)).partida.configuracion.runtime.round,1);
  assert.equal((await rpc(db,'guardar_decisiones',{p_empresa_id:a.empresa_id,p_ciclo:1,p_decisiones:[]})).success,true);
  const late=await join(manual,'Late');assert.equal(late.ciclo_inicial,1);
  assert.ok((await db.query(`select * from buscar_partida_por_codigo($1)`,[manual.codigo])).rows.length);
  await action(manual,'avanzar',{p_expected_round:1});await action(manual,'avanzar',{p_expected_round:1});
  assert.equal((await status(a.empresa_id)).partida.configuracion.round,2);
  console.log('PASS manual: admission, Cycle 1 decisions, repeated start/advance, multiple students, late join');

  const auto=await createGame(db,config({cycleCloseMode:'automatic',integrationDurationMinutes:2}));
  const c=await join(auto,'Auto');
  assert.ok(Math.abs(Date.parse(auto.configuracion.gameStartAt)-Date.parse(auto.configuracion.integrationStartTime)-120000)<20);
  const initial=await status(c.empresa_id);assert.equal(initial.partida.configuracion.phase,'integration');
  assert.equal((await status(c.empresa_id)).partida.configuracion.gameStartAt,initial.partida.configuracion.gameStartAt);
  // Server clock boundaries without waiting minutes: put the persisted deadline in the past.
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 minute')) where id=$1`,[auto.id]);
  const after=await status(c.empresa_id);assert.equal(after.partida.configuracion.phase,'decisions');assert.equal(after.partida.configuracion.round,1);
  const d=await join(auto,'After');assert.equal(d.ciclo_inicial,1);
  assert.equal((await status(d.empresa_id)).partida.configuracion.gameStartedAt,after.partida.configuracion.gameStartedAt);
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '11 minutes')) where id=$1`,[auto.id]);
  assert.equal((await status(c.empresa_id)).partida.configuracion.round,2);
  assert.equal((await join(auto,'Cycle2')).ciclo_inicial,2);
  console.log('PASS automatic: persistent 2-minute deadline, repeat reads/reload, no teacher, catch-up, late admission');

  for(const value of [-1,0,61,1.5,'bad','',null])await assert.rejects(()=>createGame(db,config({cycleCloseMode:'automatic',integrationDurationMinutes:value})));
  // Force probability=100 in fixture to make exclusions a deterministic assertion.
  await db.exec(`update side_event_catalog set probability=100`);
  const events=await createGame(db,config({enabledEvents:['PE01','PE02','PE03']}));
  const saved=await action(events,'guardar',{p_config:{enabledEvents:['PE01'],eventSelectionMode:'manual'}});
  assert.deepEqual(saved.configuracion.enabledEvents,['PE01']);
  assert.ok((await action(events,'guardar',{p_config:{enabledEvents:['UNKNOWN']}})).error);
  const ev=await action(events,'iniciar');
  assert.ok(ev.configuracion.eventSchedule['1'].group.every(id=>id==='PE01'));
  const e=await join(events,'Events');
  const data=await status(e.empresa_id);assert.ok(Object.values(data.individualEvents).flat().every(id=>id==='PE01'));
  await assert.rejects(()=>db.query(`insert into eventos_estudiante(empresa_id,evento_id,ciclo) values($1,'PE02',1)`,[e.empresa_id]));
  const report=await db.query(`insert into reportes_ciclo(empresa_id,ciclo,eventos) values($1,1,'[{"id":"PE01"},{"id":"PE02"}]') returning eventos`,[e.empresa_id]);
  assert.deepEqual(report.rows[0].eventos,[{id:'PE01'}]);
  await action(events,'guardar',{p_config:{enabledEvents:[]}});await action(events,'avanzar',{p_expected_round:1});
  assert.deepEqual((await status(e.empresa_id)).partida.configuracion.eventSchedule['2'].group,[]);
  assert.deepEqual(Object.values((await status(e.empresa_id)).individualEvents).flat(),[]);
  console.log('PASS validation: invalid durations, enabled-only events in backend, direct REST guard, empty selection');
  await db.exec('set role authenticated');
  const secured=await createGame(db,config({enabledEvents:['PE01']}));
  assert.equal((await action(secured,'iniciar')).configuracion.phase,'decisions');
  await db.exec('set role anon');
  assert.equal((await status(a.empresa_id)).partida.configuracion.round,2);
  await assert.rejects(()=>db.query('select side_sync_game($1)',[manual.id]));
  await assert.rejects(()=>db.query('select * from side_event_catalog'));
  await db.exec('reset role');
  const paused=await action(secured,'pausar',{p_expected_round:1});assert.equal(paused.configuracion.runtime.running,false);
  const resumed=await action(secured,'reanudar',{p_expected_round:1});assert.equal(resumed.configuracion.runtime.running,true);
  await action(secured,'cerrar',{p_expected_round:1});assert.equal((await action(secured,'sincronizar')).configuracion.phase,'results');
  const deadline=Date.parse(auto.configuracion.gameStartAt);
  const boundary=await db.query('select side_runtime($1,$2) as before,side_runtime($1,$3) as after',[auto.configuracion,new Date(deadline-1).toISOString(),new Date(deadline).toISOString()]);
  assert.equal(boundary.rows[0].before.phase,'integration');assert.equal(boundary.rows[0].after.phase,'decisions');assert.equal(boundary.rows[0].after.round,1);
  console.log('PASS database roles, internal RPC permissions, pause/resume/close and exact deadline boundary');
  await db.exec("update partidas set estado='finalizada'; create unique index test_one_active_game on partidas(profesor_id) where estado='activa';");
  const unique=await createGame(db);const once=await action(unique,'iniciar'),twice=await action(unique,'iniciar');
  assert.equal(once.configuracion.gameStartedAt,twice.configuracion.gameStartedAt);
  console.log('PASS existing one-active-game constraint');
 }finally{await db.close();}
})().catch(error=>{console.error(error.message,error.stack);process.exitCode=1;});
