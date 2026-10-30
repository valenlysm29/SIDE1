'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame}=require('./lifecycle_db_fixture.cjs');
test('SQL limita nuevas partidas a 1–6 y conserva configuraciones históricas',async()=>{
 const db=await database();
 try{
  const old=await createGame(db,config({cycles:7}));
  const sql=fs.readFileSync(require.resolve('../supabase/migrations/20261029221607_side_limite_seis_ciclos.sql'),'utf8');
  await db.exec(sql);await db.exec(sql);
  for(let cycles=1;cycles<=6;cycles++)assert.ok((await createGame(db,config({cycles}))).id);
  for(const cycles of [0,7,-1,1.5,null,true,'invalid'])await assert.rejects(()=>createGame(db,config({cycles})));
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('other',true) where id=$1",[old.id]);
  assert.equal((await db.query('select configuracion->>\'cycles\' as cycles from partidas where id=$1',[old.id])).rows[0].cycles,'7');
  await assert.rejects(()=>db.query("update partidas set configuracion=jsonb_set(configuracion,'{cycles}','8'::jsonb) where id=$1",[old.id]),/entre 1 y 6/);
 }finally{await db.close();}
});

