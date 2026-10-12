'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,professor,config,rpc}=require('./lifecycle_db_fixture.cjs');
const migration=name=>fs.readFileSync(require.resolve('../supabase/migrations/'+name),'utf8');
(async()=>{
 const db=await database();
 try{
  await db.exec(migration('2026-10-11_fix_crear_partida.sql'));
  const demo=(await db.query(`insert into partidas(profesor_id,nombre,codigo) values($1,'Demo','SIDE-000') returning id`,[professor])).rows[0];
  const sql=migration('2026-10-12_salas_codigo.sql');await db.exec(sql);await db.exec(sql);
  const creationDefinition=(await db.query(`select pg_get_functiondef('public.crear_sala_docente(jsonb,text,text,text,uuid,uuid)'::regprocedure) definition`)).rows[0].definition;
  assert.equal((creationDefinition.match(/ux_side_codigo_sala_normalizado/g)||[]).length,1,'repeating migration must not duplicate retry whitelist');
  assert.equal((await db.query('select codigo from partidas where id=$1',[demo.id])).rows[0].codigo,'SIDE-000');
  // Real PostgreSQL inserts reserve every code; not merely a probabilistic JS mock.
  const generated=(await db.query(`insert into partidas(profesor_id,nombre) select $1,'Única '||n from generate_series(1,1000) n returning codigo`,[professor])).rows;
  assert.equal(new Set(generated.map(g=>g.codigo)).size,1000);
  generated.forEach(g=>assert.match(g.codigo,/^SIDE-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/));
  for(const input of [' side abc234 ','SIDEABC234','side-abc234','S I D E - A B C 2 3 4'])
   assert.equal((await db.query('select public.side_normalizar_codigo_sala($1) code',[input])).rows[0].code,'SIDE-ABC234');
  await db.exec(`update partidas set estado='finalizada'`);
  const game=await rpc(db,'crear_sala_docente',{p_config:config(),p_nombre:'Sala E2E',p_curso:'Prueba',p_segmento:'Estandar',p_request_id:'22222222-2222-2222-2222-222222222222'});
  assert.ok(game.id);assert.match(game.codigo,/^SIDE-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  await db.exec(`select set_config('test.uid','',false); set role anon`);
  await assert.rejects(db.query('select * from partidas'),e=>e.code==='42501');
  await assert.rejects(db.query('select * from participantes'),e=>e.code==='42501');
  const identity={p_codigo:game.codigo.toLowerCase().replace('-',''),p_nombre_legal:'Empresa Exacta SAC',p_nombre_comercial:'Comercial Exacto'};
  const joined=await rpc(db,'unirse_partida_por_codigo',identity);assert.equal(joined.success,true);assert.equal(joined.reingreso,false);
  assert.equal((await rpc(db,'unirse_partida_por_codigo',{...identity,p_codigo:'SIDE-ZZZZZZ'})).code,'PARTIDA_NO_ENCONTRADA');
  await assert.rejects(rpc(db,'cancelar_partida',{p_partida_id:game.id}),e=>e.code==='42501');
  await db.exec('reset role');
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 second')) where id=$1`,[game.id]);
  await db.exec('set role anon');
  const rejoined=await rpc(db,'unirse_partida_por_codigo',identity);assert.equal(rejoined.success,true);assert.equal(rejoined.reingreso,true);assert.equal(rejoined.empresa_id,joined.empresa_id);
  assert.equal((await rpc(db,'unirse_partida_por_codigo',{...identity,p_nombre_comercial:'Otro'})).code,'PARTIDA_INICIADA');
  assert.equal((await rpc(db,'unirse_partida_por_codigo',{...identity,p_nombre_legal:'Otro'})).code,'PARTIDA_INICIADA');
  await db.exec('reset role');await db.query(`select set_config('test.uid',$1,false)`,['99999999-9999-9999-9999-999999999999']);await db.exec('set role authenticated');
  assert.equal((await rpc(db,'cancelar_partida',{p_partida_id:game.id})).code,'NO_AUTORIZADO');
  assert.equal((await db.query('select * from partidas')).rows.length,0,'another teacher cannot list games');
  await db.exec('reset role');await db.query(`select set_config('test.uid',$1,false)`,[professor]);await db.exec('set role authenticated');
  const cancelled=await rpc(db,'cancelar_partida',{p_partida_id:game.id});assert.equal(cancelled.estado,'cancelada');assert.ok(cancelled.cancelled_at);assert.equal(cancelled.profesor_id,professor);
  assert.equal((await rpc(db,'cancelar_partida',{p_partida_id:game.id})).cancelled_at,cancelled.cancelled_at,'retry cancellation idempotent');
  await db.exec(`reset role; select set_config('test.uid','',false); set role anon`);
  assert.equal((await rpc(db,'unirse_partida_por_codigo',identity)).code,'PARTIDA_CANCELADA');
  assert.equal((await rpc(db,'ingresar_empresa',identity)).code,'PARTIDA_CANCELADA','legacy endpoint cannot bypass terminal admission guard');
  const terminal=await rpc(db,'obtener_estado_estudiante',identity);assert.equal(terminal.partida.estado,'cancelada','connected student receives cancellation through existing polling');
  await db.exec('reset role');
  assert.equal((await db.query('select estado from partidas where id=$1',[game.id])).rows[0].estado,'cancelada');
  await assert.rejects(db.query(`update partidas set estado='esperando' where id=$1`,[game.id]),e=>e.code==='23514');
  await db.query('delete from partidas where id=$1',[game.id]);
  await assert.rejects(db.query(`insert into partidas(profesor_id,nombre,codigo) values($1,'Reuso',$2)`,[professor,game.codigo]),e=>e.code==='23505');
  await db.exec(sql);
  await db.query(`select set_config('test.uid',$1,false)`,[professor]);
  // Sequence increments survive a failed INSERT subtransaction, like real retries.
  await db.exec(`create sequence test_sala_code_attempt;
   create or replace function public.generar_codigo_sala() returns text language plpgsql as $$
   begin if nextval('test_sala_code_attempt')=1 then return 'SIDE-000'; end if; return 'SIDE-ABC234'; end $$;`);
  const createArgs={p_config:config(),p_nombre:'Colisión',p_curso:'Prueba',p_segmento:'Estandar',p_request_id:'33333333-3333-3333-3333-333333333333'};
  const collision=await rpc(db,'crear_sala_docente',createArgs);
  assert.equal(collision.codigo,'SIDE-ABC234');
  assert.equal((await db.query('select last_value::int n from test_sala_code_attempt')).rows[0].n,2);
  await rpc(db,'cancelar_partida',{p_partida_id:collision.id});
  await db.exec(`create or replace function public.generar_codigo_sala() returns text language sql as $$select 'SIDE-ABC234'::text$$;`);
  await assert.rejects(rpc(db,'crear_sala_docente',{...createArgs,p_request_id:'44444444-4444-4444-4444-444444444444'}),e=>e.code==='23505'&&e.constraint==='ux_side_codigo_sala_normalizado');
  console.log('salas_codigo_db: PASS (SQL 3 veces, 1000 códigos únicos, normalización, E2E docente/anon, reingreso exacto, cancelación, RLS, no bypass/no reutilización)');
 }finally{await db.close();}
 const upgraded=await database();
 try{
  for(const name of ['2026-10-11_fix_crear_partida.sql','2026-10-11_recuperar_salas_compatibles.sql','2026-10-11_codigos_sala_no_reutilizables.sql','2026-10-11_estado_codigo_sala.sql'])await upgraded.exec(migration(name));
  await upgraded.exec(migration('2026-10-12_salas_codigo.sql'));await upgraded.exec(migration('2026-10-12_salas_codigo.sql'));
  console.log('salas_codigo_db: PASS (actualización sobre todas las migraciones de 11-Oct, SQL dos veces)');
 }finally{await upgraded.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
