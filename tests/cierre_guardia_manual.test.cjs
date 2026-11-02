'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('manual: no avanza sin cierre persistido y permite reintento tras confirmación',async()=>{
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz; create table public.side_business_closures(partida_id uuid not null,ciclo integer not null,cierre jsonb not null,primary key(partida_id,ciclo))');
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  const g=await createGame(db,config({sequentialCloseVersion:'1'}));
  const company=await rpc(db,'ingresar_empresa',{p_codigo:g.codigo,p_nombre_legal:'Empresa prueba',p_nombre_comercial:'Empresa prueba'});
  const other=await rpc(db,'ingresar_empresa',{p_codigo:g.codigo,p_nombre_legal:'Empresa dos',p_nombre_comercial:'Empresa dos'});
  await db.query("update partidas set estado='activa',configuracion=jsonb_set(configuracion,'{runtime}', $2::jsonb) where id=$1",[g.id,JSON.stringify({round:1,phase:'decisions',status:'paused',running:false,duration:600,remaining:600})]);
  const action=()=>rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'avanzar',p_expected_round:1});
  assert.equal((await action()).code,'CIERRE_REQUERIDO');
  await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'cerrar',p_expected_round:1});
  assert.equal((await action()).code,'CIERRE_PENDIENTE');
  assert.equal((await db.query('select configuracion from partidas where id=$1',[g.id])).rows[0].configuracion.runtime.round,1);
  await db.query("insert into side_business_closures values($1,1,'{}')",[g.id]);
  assert.equal((await action()).code,'CIERRE_PENDIENTE');
  await db.query('update side_business_closures set cierre=$2 where partida_id=$1',[g.id,{resultadosPorEmpresa:{[company.empresa_id]:{receipt:{},financial:{},state:{}}}}]);
  assert.equal((await action()).code,'CIERRE_PENDIENTE');
  await db.query('update side_business_closures set cierre=$2 where partida_id=$1',[g.id,{resultadosPorEmpresa:{[company.empresa_id]:{receipt:{},financial:{},state:{}},[other.empresa_id]:{receipt:{},financial:{},state:{}}}}]);
  assert.equal((await action()).configuracion.runtime.round,2);
 }finally{await db.close();}
});
test('manual: partidas anteriores conservan su transición',async()=>{
 const db=await database();try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz; create table public.side_business_closures(partida_id uuid not null,ciclo integer not null,cierre jsonb not null,primary key(partida_id,ciclo))');
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  const g=await createGame(db,config());
  await db.query("update partidas set estado='activa',configuracion=jsonb_set(configuracion,'{runtime}', $2::jsonb) where id=$1",[g.id,JSON.stringify({round:1,phase:'results',status:'finished',running:false,duration:600,remaining:0})]);
  assert.equal((await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'avanzar',p_expected_round:1})).configuracion.runtime.round,2);
 }finally{await db.close();}
});
