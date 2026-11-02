'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame}=require('./lifecycle_db_fixture.cjs');
test('impide nuevas selecciones costPct y conserva selecciones históricas',async()=>{
 const db=await database();try{
  const old=await createGame(db,config({enabledEvents:['PE15']}));
  await db.exec(fs.readFileSync('supabase/migrations/20261102025853_bloquear_eventos_costos_no_verificados.sql','utf8'));
  await assert.rejects(createGame(db,config({enabledEvents:['PE15']})),/no está disponible/);
  const valid=await createGame(db,config({enabledEvents:['PE07'],sequentialCloseVersion:'1'}));
  await assert.rejects(db.query("update partidas set configuracion=jsonb_set(configuracion,'{enabledEvents}','[\"PE07\",\"PE15\"]') where id=$1",[valid.id]),/no está disponible/);
  await db.query("update partidas set configuracion=configuracion||'{\"name\":\"sin cambios de eventos\"}'::jsonb where id=$1",[old.id]);
  assert.deepEqual((await db.query('select configuracion->\'enabledEvents\' events from partidas where id=$1',[old.id])).rows[0].events,['PE15']);
 }finally{await db.close();}
});
