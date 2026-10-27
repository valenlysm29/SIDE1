'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..');
const load=name=>fs.readFileSync(path.join(root,name),'utf8');

async function main(){
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(load('docs/sql/20261023_despliegue_cierre_v19.sql'));
  const migration=load('supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql');
  await db.exec(migration);
  await db.exec(migration);
  const game=await createGame(db,config());
  const join=async name=>(await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:name,p_nombre_comercial:name})).empresa_id;
  const confirmed=await join('Confirmada');
  const pending=await join('Pendiente');
  await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[confirmed,{decision_state:{__cyclePlans:{1:{state:{}}}}}]);
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{runtime}', $2::jsonb) where id=$1",[game.id,{round:1,phase:'results'}]);
  const args={p_partida_id:game.id,p_ciclo:1};
  const first=await rpc(db,'side_contexto_cierre_negocio',args);
  assert.equal(first.code,'PLANES_PENDIENTES');
  assert.equal(Number(first.empresa_id),Number(pending));
  const second=await rpc(db,'side_contexto_cierre_negocio',args);
  assert.equal(second.code,'PLANES_PENDIENTES');
  assert.equal((await db.query('select expulsada_at from participantes where empresa_id=$1',[pending])).rows[0].expulsada_at,null);
  assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),0);
  await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[pending,{decision_state:{__cyclePlans:{1:{state:{}}}}}]);
  const ready=await rpc(db,'side_contexto_cierre_negocio',args);
  assert.equal(ready.error,undefined,JSON.stringify(ready));
  assert.equal(ready.empresas.length,2);
  console.log('PASS: missing first plan remains pending; retry is safe; later confirmation includes both companies.');
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
