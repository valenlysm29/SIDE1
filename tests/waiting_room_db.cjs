const assert=require('node:assert/strict');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 try{
  const game=await createGame(db,config({integrationDurationMinutes:7}));
  const action=()=>rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar'});
  const firstStart=await action();
  assert.equal(firstStart.estado,'esperando');
  assert.equal(firstStart.configuracion.runtime.phase,'integration');
  assert.equal(firstStart.configuracion.gameStartAt,game.configuracion.gameStartAt);
  assert.equal(firstStart.started_at,null);
  assert.ok(Math.abs(Date.parse(game.configuracion.gameStartAt)-Date.parse(game.configuracion.integrationStartTime)-420000)<10);
  const join=(legal='demo1',brand='demo1')=>rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:legal,p_nombre_comercial:brand});
  const student=await join();assert.equal(student.success,true);
  const deadline=Date.parse(game.configuracion.gameStartAt);
  for(const zone of ['UTC','America/Lima']){
   await db.query(`select set_config('TimeZone',$1,false)`,[zone]);
   const result=(await db.query('select side_runtime($1,$2::timestamptz) before,side_runtime($1,$3::timestamptz) at',[game.configuracion,new Date(deadline-1).toISOString(),new Date(deadline).toISOString()])).rows[0];
   assert.equal(result.before.phase,'integration');assert.equal(result.at.phase,'decisions');
   assert.equal(Date.parse(result.at.startedAt),deadline);
  }
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 second')) where id=$1`,[game.id]);
  assert.equal((await join('nueva','nueva')).code,'PARTIDA_INICIADA');
  assert.equal((await join()).empresa_id,student.empresa_id);
  for(const [legal,brand] of [['Demo1','demo1'],['demo1','Demo1'],['demó1','demo1']])assert.equal((await join(legal,brand)).code,'PARTIDA_INICIADA');
  const inconsistent=await createGame(db);
  await db.query(`update partidas set started_at=now() where id=$1`,[inconsistent.id]);
  assert.equal((await rpc(db,'ingresar_empresa',{p_codigo:inconsistent.codigo,p_nombre_legal:'new',p_nombre_comercial:'new'})).code,'PARTIDA_INICIADA');
  const crossing=await createGame(db);
  await db.exec('begin');
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()+interval '80 milliseconds')) where id=$1`,[crossing.id]);
  await new Promise(resolve=>setTimeout(resolve,120));
  const crossingJoin=await rpc(db,'ingresar_empresa',{p_codigo:crossing.codigo,p_nombre_legal:'late transaction',p_nombre_comercial:'late transaction'});
  assert.equal(crossingJoin.code,'PARTIDA_INICIADA','transaction-start now must not admit after wall-clock deadline');
  await db.exec('commit');
  await db.exec('begin');
  const advanceAnchor=(await db.query('select now() as anchor')).rows[0].anchor;
  await new Promise(resolve=>setTimeout(resolve,120));
  const advanced=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_expected_round:1});
  assert.ok(Date.parse(advanced.configuracion.runtime.startedAt)-Date.parse(advanceAnchor)>=80,'advance uses action wall-clock, not old transaction start');
  const paused=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'pausar',p_expected_round:2});
  assert.equal(paused.configuracion.runtime.status,'paused');
  await new Promise(resolve=>setTimeout(resolve,120));
  const resumed=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'reanudar',p_expected_round:2});
  assert.ok(Date.parse(resumed.configuracion.runtime.startedAt)-Date.parse(advanceAnchor)>=180,'resume uses action wall-clock, not old transaction start');
  await db.exec('commit');
  await db.exec('set role anon');
  const features=await rpc(db,'side_admission_features',{});assert.equal(features.waitingRoomVersion,3);assert.ok(Date.parse(features.serverTime));
  assert.deepEqual(Object.keys(features).sort(),['exactIdentityVersion','serverTime','waitingRoomVersion']);
  await assert.rejects(()=>db.query('insert into empresas(nombre_legal,nombre_comercial) values($1,$2)',['bypass','bypass']));
  console.log('PASS waiting room: manual early start ignored, 7-minute persisted server deadline, UTC/Lima exact boundary, late block, exact reentry, immutable started_at, anon capability and REST denial');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
