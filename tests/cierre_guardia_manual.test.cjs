'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('manual: no avanza sin cierre persistido y permite reintento tras confirmación',async()=>{
 const db=await database();
 try{
  await db.exec('create table public.side_business_closures(partida_id uuid not null,ciclo integer not null,cierre jsonb not null,primary key(partida_id,ciclo))');
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  const g=await createGame(db,config());
  await db.query("update partidas set estado='activa',configuracion=jsonb_set(configuracion,'{runtime}', $2::jsonb) where id=$1",[g.id,JSON.stringify({round:1,phase:'decisions',status:'paused',running:false,duration:600,remaining:600})]);
  const action=()=>rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'avanzar',p_expected_round:1});
  assert.equal((await action()).code,'CIERRE_REQUERIDO');
  await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'cerrar',p_expected_round:1});
  assert.equal((await action()).code,'CIERRE_PENDIENTE');
  assert.equal((await db.query('select configuracion from partidas where id=$1',[g.id])).rows[0].configuracion.runtime.round,1);
  await db.query("insert into side_business_closures values($1,1,'{}')",[g.id]);
  assert.equal((await action()).configuracion.runtime.round,2);
 }finally{await db.close();}
});
