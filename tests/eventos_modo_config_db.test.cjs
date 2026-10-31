'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('modo docente se guarda y recupera por partida y rechaza usuarios y modos inválidos',async()=>{
 const db=await database();try{
  const sql=fs.readFileSync('supabase/migrations/20261031150049_modo_desafios_v1.sql','utf8');await db.exec(sql);await db.exec(sql);
  const game=await createGame(db,config({cycles:6}));
  for(const mode of ['manual','random','balanced']){
   const saved=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'guardar',p_config:config({cycles:6,challengeModeV1:mode}),p_expected_round:null});assert.equal(saved.configuracion.challengeModeV1,mode);
   assert.equal((await db.query('select configuracion from partidas where id=$1',[game.id])).rows[0].configuracion.challengeModeV1,mode);
  }
  const invalid=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'guardar',p_config:config({cycles:6,challengeModeV1:'fake'}),p_expected_round:null});assert.match(invalid.error,/inválido/);
  await db.query("select set_config('test.uid',$1,false)",['22222222-2222-2222-2222-222222222222']);const rejected=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'guardar',p_config:config({cycles:6,challengeModeV1:'manual'}),p_expected_round:null});assert.match(rejected.error,/permiso/);await db.query("select set_config('test.uid',$1,false)",[professor]);
 }finally{await db.close();}
});
