'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,createGame,config,rpc}=require('./lifecycle_db_fixture.cjs');
const {state,catalog}=require('./economic_v19_fixture.cjs'),CYCLE=require('../js/cycle_model');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('room diagnosis distinguishes a late zero report from a genuinely zero closure and a pending cycle',async()=>{
 const db=await database();
 try{
  await db.exec('alter table participantes add column if not exists expulsada_at timestamptz');
  await db.exec(read('docs/sql/20261023_despliegue_cierre_v19.sql'));
  const game=await createGame(db,config({capital:200000}));
  await db.query("update partidas set codigo='SIDE-7DFR' where id=$1",[game.id]);
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:'SIDE-7DFR',p_nombre_legal:'Diagnostico',p_nombre_comercial:'Diagnostico'});
  assert.equal(joined.success,true);const id=String(joined.empresa_id);
  await db.query("update partidas set configuracion=configuracion||'{\"runtime\":{\"round\":3}}'::jsonb where id=$1",[game.id]);
  const result=CYCLE.close({state:state(),catalog,round:1,capital:200000});
  await db.query('insert into side_business_closures(partida_id,ciclo,cierre) values($1,1,$2),($1,2,$3)',[game.id,
   {resultadosPorEmpresa:{[id]:result}},
   {resultadosPorEmpresa:{[id]:{receipt:{round:2,sold:0,revenue:0,produced:0}}}}
  ]);
  await db.query('insert into reportes_ciclo(empresa_id,ciclo,ingresos,estado_resultados) values($1,1,0,$2)',[id,{ingresos:0}]);
  const rows=(await db.query(read('docs/sql/20261027_diagnostico_ventas_SIDE_7DFR.sql'))).rows;
  assert.equal(rows.length,3);
  assert.equal(rows[0].vendidas,90);assert.equal(rows[0].ingresos_cierre,3825);
  assert.match(rows[0].diagnostico,/REPORTE DISTINTO DEL CIERRE/);
  assert.match(rows[1].diagnostico,/CIERRE GUARDADO CON CERO/);
  assert.equal(rows[2].diagnostico,'CIERRE PENDIENTE');
 }finally{await db.close();}
});
