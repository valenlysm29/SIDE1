'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..');

async function main(){
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(fs.readFileSync(path.join(root,'docs/sql/20261023_despliegue_cierre_v19.sql'),'utf8'));
  const game=await createGame(db,config());
  await db.query("update partidas set codigo='SIDE-VEX4' where id=$1",[game.id]);
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:'SIDE-VEX4',p_nombre_legal:'Prueba',p_nombre_comercial:'Prueba'});
  const id=joined.empresa_id;
  const sql=fs.readFileSync(path.join(root,'docs/sql/20261026_diagnostico_ventas_SIDE_VEX4.sql'),'utf8');
  const first=(await db.query(sql)).rows;
  assert.equal(first.length,1);
  assert.equal(first[0].diagnostico,'CIERRE PENDIENTE');
  await db.query('insert into side_business_closures(partida_id,ciclo,cierre) values($1,1,$2)',[game.id,{ciclo:1,resultadosPorEmpresa:{[id]:{receipt:{produced:3,sold:2,revenue:85}}}}]);
  const second=(await db.query(sql)).rows;
  assert.equal(second[0].diagnostico,'VENTAS CALCULADAS');
  assert.equal(Number(second[0].ventas_calculadas),85);
  console.log('PASS: consulta distingue cierre pendiente y ventas calculadas.');
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
