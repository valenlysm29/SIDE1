'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,professor}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 try{
  const insert=(code)=>db.query(`insert into partidas(profesor_id,nombre,codigo) values($1,'Código',$2) returning *`,[professor,code]);
  const removedBefore=(await insert('SIDE-QA2')).rows[0];
  await db.query('delete from partidas where id=$1',[removedBefore.id]);
  const old=(await insert('SIDE-QA2')).rows[0];
  assert.notEqual(old.id,removedBefore.id,'antes de la migración se puede reutilizar un código eliminado');
  const sql=fs.readFileSync(require.resolve('../supabase/migrations/2026-10-11_codigos_sala_no_reutilizables.sql'),'utf8');
  await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('select codigo from partidas where id=$1',[old.id])).rows[0].codigo,old.codigo);
  const games=[];
  for(let i=0;i<12;i++)games.push((await db.query(`insert into partidas(profesor_id,nombre) values($1,'Nueva') returning *`,[professor])).rows[0]);
  assert.equal(new Set(games.map(g=>g.codigo)).size,12);
  for(const game of games.slice(0,3)){
   await db.query(`update partidas set estado='finalizada',configuracion='{"runtime":{"phase":"cancelled"}}' where id=$1`,[game.id]);
   await assert.rejects(insert(game.codigo),e=>e.code==='23505');
   await db.query('delete from partidas where id=$1',[game.id]);
   await assert.rejects(insert(game.codigo.toLowerCase()),e=>e.code==='23505');
  }
  await db.query(`update partidas set estado='finalizada',configuracion='{"runtime":{"phase":"finished"}}' where id=$1`,[old.id]);
  await assert.rejects(db.query(`update partidas set estado='esperando' where id=$1`,[old.id]),e=>e.code==='23514');
  await assert.rejects(db.query(`update partidas set estado='activa' where id=$1`,[old.id]),e=>e.code==='23514');
  await db.query('update partidas set codigo=lower(codigo) where id=$1',[old.id]);
  await db.query('delete from partidas where id=$1',[old.id]);
  await assert.rejects(insert(old.codigo),e=>e.code==='23505');
  await assert.rejects(db.query(`insert into partidas(id,profesor_id,nombre,codigo) values($1,$2,'Mismo UUID',$3)`,[old.id,professor,old.codigo]),e=>e.code==='23505');
  await assert.rejects(insert(' SÍDE-QA2 '),e=>e.code==='23505','normalización coincide con la admisión');
  await assert.rejects(db.query('update partidas set codigo=$1 where id=$2',['SIDE-ZZ8',games[3].id]),e=>e.code==='23505');
  const parallel=await Promise.all(Array.from({length:6},()=>db.query(`insert into partidas(profesor_id,nombre) values($1,'Paralela') returning codigo`,[professor])));
  assert.equal(new Set(parallel.map(r=>r.rows[0].codigo)).size,6);
  // PGlite serializa las consultas: la exclusión en PostgreSQL se apoya además
  // en advisory_xact_lock compartido por generador/trigger y PK del registro.
  assert.equal((await db.query(`select count(*)::int n from side_private.codigos_sala_reservados`)).rows[0].n,19);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from side_private.codigos_sala_reservados'),e=>e.code==='42501');
  await assert.rejects(db.query('delete from side_private.codigos_sala_reservados'),e=>e.code==='42501');
  await assert.rejects(db.query('truncate side_private.codigos_sala_reservados'),e=>e.code==='42501');
  assert.match((await db.query('select public.side_next_game_code() codigo')).rows[0].codigo,/^SIDE-[A-Z0-9]{3,4}$/);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select public.side_next_game_code()'),e=>e.code==='42501');
  await db.exec('reset role');
  // Saturación del formato corto fuerza el formato de cuatro caracteres.
  await db.exec(`insert into side_private.codigos_sala_reservados(codigo,partida_id)
   select 'SIDE-'||substr('ABCDEFGHJKLMNPQRSTUVWXYZ',a,1)||substr('ABCDEFGHJKLMNPQRSTUVWXYZ',b,1)||substr('23456789',d,1),'11111111-1111-1111-1111-111111111111'::uuid
   from generate_series(1,length('ABCDEFGHJKLMNPQRSTUVWXYZ')) a cross join generate_series(1,length('ABCDEFGHJKLMNPQRSTUVWXYZ')) b cross join generate_series(1,8) d on conflict do nothing`);
  assert.match((await db.query('select public.side_next_game_code() codigo')).rows[0].codigo,/^SIDE-[A-Z0-9]{4}$/);
  await db.exec(sql);
  assert.equal((await db.query(`select partida_id from side_private.codigos_sala_reservados where codigo=$1`,[old.codigo])).rows[0].partida_id,old.id);
  console.log('codigos_sala_db: PASS (migración repetida, códigos variables, reserva tras cierre/borrado, asignación inmutable, permisos, agotamiento)');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
