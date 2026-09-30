const assert=require('node:assert/strict');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 const action=(game,name,extra={})=>rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:name,...extra});
 const identity=(game,name)=>({p_codigo:game.codigo,p_nombre_legal:name,p_nombre_comercial:name});
 const join=(game,name)=>rpc(db,'ingresar_empresa',identity(game,name));
 const read=(game,name)=>rpc(db,'obtener_estado_estudiante',identity(game,name));
 try{
  const first=await createGame(db),second=await createGame(db);
  assert.match(first.codigo,/^SIDE-[A-HJ-NP-Z]{2}[2-9]$/);assert.match(second.codigo,/^SIDE-[A-HJ-NP-Z]{2}[2-9]$/);assert.notEqual(first.codigo,second.codigo);
  await assert.rejects(()=>db.query('insert into partidas(profesor_id,nombre,codigo) values($1,$2,$3)',[professor,'Duplicada',first.codigo]));
  // Deploy the focused migration twice over historical games without renaming them.
  await db.query("insert into partidas(profesor_id,nombre,codigo,estado) values($1,'Histórica','SIDE-025','finalizada')",[professor]);
  const before=(await db.query('select id,codigo from partidas order by id')).rows;
  const migration=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supabase/migrations/supabase_game_codes.sql'),'utf8');
  await db.exec(migration);await db.exec(migration);
  assert.deepEqual((await db.query('select id,codigo from partidas order by id')).rows,before);
  assert.equal((await rpc(db,'side_game_features',{})).gameCodeVersion,2);
  const student=await join(first,'Presencia');
  await read(first,'Presencia');
  const seen=()=>db.query('select last_seen_at from participantes where empresa_id=$1',[student.empresa_id]);
  const seenAt=(await seen()).rows[0].last_seen_at;assert.ok(seenAt);
  await read(first,'Presencia');assert.ok((await seen()).rows[0].last_seen_at>=seenAt);
  await db.query("update participantes set last_seen_at=now()-interval '2 minutes' where empresa_id=$1",[student.empresa_id]);
  await read(first,'Presencia');assert.ok(Date.now()-Date.parse((await seen()).rows[0].last_seen_at)<5000);
  console.log('PASS unique alphanumeric codes, collision rejection and server presence heartbeat');

  for(const game of [first,await createGame(db,config({cycleCloseMode:'automatic'}))]){
   const s=await join(game,'Cancelación');
   const cancelled=await action(game,'cancelar');
   assert.equal(cancelled.estado,'finalizada');assert.equal(cancelled.configuracion.runtime.phase,'cancelled');
   const stamp=cancelled.configuracion.cancelledAt;
   assert.equal((await action(game,'cancelar')).configuracion.cancelledAt,stamp);
   await db.query("update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 hour')) where id=$1",[game.id]);
   assert.equal((await read(game,'Cancelación')).partida.configuracion.runtime.phase,'cancelled');
   assert.ok((await join(game,'Tarde')).error);
   assert.match((await rpc(db,'guardar_decisiones_estudiante',{...identity(game,'Cancelación'),p_ciclo:1,p_decisiones:[],p_expected_revision:0})).error,/cancelada/);
   assert.equal((await db.query('select * from buscar_partida_por_codigo($1)',[game.codigo])).rows.length,0);
   assert.equal((await action(game,'iniciar')).configuracion.runtime.phase,'cancelled');
  }
  await action(second,'iniciar');
  await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
  assert.ok((await action(second,'cancelar')).error);
  await db.query("select set_config('test.uid',$1,false)",[professor]);
  assert.equal((await action(second,'sincronizar')).estado,'activa');
  assert.equal((await action(second,'cancelar')).configuracion.runtime.phase,'cancelled');
  console.log('PASS cancellation in waiting/running/automatic games, persistence, admission/decision guards, owner permission and idempotency');

  await db.exec('update side_event_catalog set probability=100');
  const group=(await db.query("select id from side_event_catalog where scope='group' order by id limit 1")).rows[0].id;
  const individual=(await db.query("select id from side_event_catalog where scope='individual' order by id limit 1")).rows[0].id;
  const game=await createGame(db,config({cycles:4,enabledEvents:[group,individual],eventRules:{[group]:{firstRound:2,repeat:false},[individual]:{firstRound:2,repeat:false}}}));
  const player=await join(game,'Eventos');
  await action(game,'iniciar');
  let data=await read(game,'Eventos');
  assert.deepEqual(data.partida.configuracion.eventSchedule['1'].group,[]);assert.deepEqual(data.individualEvents['1'],[]);
  await action(game,'avanzar',{p_expected_round:1});data=await read(game,'Eventos');
  assert.deepEqual(data.partida.configuracion.eventSchedule['2'].group,[group]);assert.deepEqual(data.individualEvents['2'],[individual]);
  await action(game,'avanzar',{p_expected_round:2});data=await read(game,'Eventos');
  assert.deepEqual(data.partida.configuracion.eventSchedule['3'].group,[]);assert.deepEqual(data.individualEvents['3'],[]);
  await action(game,'guardar',{p_config:{enabledEvents:[group,individual],eventRules:{[group]:{firstRound:1,repeat:true},[individual]:{firstRound:1,repeat:true}}}});
  data=await read(game,'Eventos');assert.deepEqual(data.individualEvents['1'],[]);assert.deepEqual(data.individualEvents['3'],[]);
  await action(game,'avanzar',{p_expected_round:3});data=await read(game,'Eventos');
  assert.deepEqual(data.partida.configuracion.eventSchedule['4'].group,[group]);assert.deepEqual(data.individualEvents['4'],[individual]);
  await action(game,'cancelar');data=await read(game,'Eventos');
  assert.deepEqual(data.individualEvents['2'],[individual]);assert.deepEqual(data.individualEvents['4'],[individual]);
  const invalid=await action(game,'guardar',{p_config:{enabledEvents:[group],eventRules:{[group]:{firstRound:0,repeat:'no'}}}});assert.ok(invalid.error);
  console.log('PASS manual event rules: first cycle, single occurrence, repeat, immutable past draws, cancellation preserves history, server validation');

  // Exhaustion is explicit; finalizing a game never reuses its code and history.
  await db.query(`insert into partidas(profesor_id,nombre,codigo,estado)
    select $1,'Ocupada',candidate,'finalizada' from (
      select 'SIDE-'||substr('ABCDEFGHJKLMNPQRSTUVWXYZ',a,1)||substr('ABCDEFGHJKLMNPQRSTUVWXYZ',b,1)||d::text candidate
      from generate_series(1,24) a cross join generate_series(1,24) b cross join generate_series(2,9) d
    ) codes where not exists(select 1 from partidas where codigo=codes.candidate)`,[professor]);
  await db.query("delete from partidas where codigo='SIDE-WG2'");
  assert.equal((await createGame(db)).codigo,'SIDE-WG2','find the last free code even when the rest are occupied');
  await assert.rejects(()=>createGame(db),/agotaron/);
  console.log('PASS 4608-code exhaustion reports an error instead of duplicating a code');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
