'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
test('reloj automático espera cada cierre antes de iniciar el siguiente ciclo',async()=>{
 const db=await database();
 try{
  await db.exec('create table public.side_business_closures(partida_id uuid not null,ciclo integer not null,cierre jsonb not null,primary key(partida_id,ciclo))');
  const migration=fs.readFileSync('supabase/migrations/20261102024042_cierre_automatico_secuencial.sql','utf8');await db.exec(migration);await db.exec(migration);
  const game=await createGame(db,config({cycleCloseMode:'automatic',cycles:6,scheduledStart:new Date(Date.now()-3600000).toISOString()}));
  assert.equal(game.configuracion.sequentialCloseVersion,'1');
  for(let cycle=1;cycle<=6;cycle++){
   await db.query("update partidas set configuracion=jsonb_set(jsonb_set(jsonb_set(configuracion,'{runtime,startedAt}',to_jsonb((now()-interval '11 minutes')::text)),'{runtime,phase}',to_jsonb('decisions'::text)),'{runtime,running}','true'::jsonb) where id=$1",[game.id]);
   const expired=await rpc(db,'side_sync_game',{p_id:game.id});assert.equal(expired.configuracion.runtime.round,cycle);assert.equal(expired.configuracion.runtime.phase,'results');
   const waiting=await rpc(db,'side_sync_game',{p_id:game.id});assert.equal(waiting.configuracion.runtime.round,cycle);assert.equal(waiting.configuracion.runtime.phase,'results');
   await db.query("insert into side_business_closures values($1,$2,'{}')",[game.id,cycle]);
   const next=await rpc(db,'side_sync_game',{p_id:game.id});assert.equal(next.configuracion.runtime.round,Math.min(cycle+1,6));assert.equal(next.configuracion.runtime.phase,cycle===6?'finished':'decisions');
  }
 }finally{await db.close();}
});
