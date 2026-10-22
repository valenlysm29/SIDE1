'use strict';
// PostgreSQL embebido local. Nunca conecta a Supabase remoto.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,createGame,config,rpc}=require('./lifecycle_db_fixture.cjs');
const {decision}=require('./escenarios_excel.cjs'),C=require('../js/engine/config_excel.js');
const {cerrarCiclo}=require('../js/engine/ciclo.js'),{adjuntarCaja}=require('../js/engine/caja.js');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8').replaceAll('collate "es-x-icu"','collate "C"');
const cerca=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<=1e-8,`${a} != ${b}`);
(async()=>{const db=await database();try{
 for(const name of ['2026-10-11_fix_crear_partida.sql','2026-10-12_salas_codigo.sql','2026-10-12_codigo_corto.sql','2026-10-11_logica_excel.sql','2026-10-12_podio_programado.sql','2026-10-20_correcciones_docente_estudiante.sql'])await db.exec(sql(name));
 const game=await createGame(db,config({capital:100000})),joined=await rpc(db,'unirse_partida_por_codigo',{p_codigo:game.codigo,p_nombre_legal:'Ingresos tres ciclos SAC',p_nombre_comercial:'Ingresos'});
 assert.equal(joined.success,true);const id=String(joined.empresa_id),overrides=C.paraMotor(game.motor_version),rows=[];
 for(let round=1;round<=3;round++){
  await db.query("update partidas set started_at=coalesce(started_at,clock_timestamp()),estado='activa',configuracion=jsonb_set(configuracion,'{runtime}',$2) where id=$1",[game.id,{phase:'decisions',round}]);
  const d=decision({seleccion:['INF-02','INF-05','INF-08','RH-01','RH-04','RH-07','RH-10B','COM-01B','FIN-01B'],marketingNivel:null});
  await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot,revision=side_student_state.revision+1',[id,{decision_state:{__excel:{habilitado:true,motor_version:game.motor_version,round,enviado:true,decisiones:d}}}]);
  await db.exec('set role authenticated');
  const ctx=await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:round});assert.ok(ctx.empresas.some(e=>e.id===id));
  if(round>1)assert.equal(ctx.historialPorEmpresa[id].financialHistory.length,round-1,'historial recuperado de PostgreSQL');
  const calculated=cerrarCiclo({ciclo:round,empresas:[id],decisionesPorEmpresa:{[id]:d},historialPorEmpresa:ctx.historialPorEmpresa},overrides);
  const closure=adjuntarCaja(calculated,{capitalPorEmpresa:{[id]:100000},historialAnterior:ctx.historialPorEmpresa,overrides});
  const args={p_partida_id:game.id,p_ciclo:round,p_token:ctx.token,p_cierre:closure},saved=await rpc(db,'side_guardar_cierre_excel',args);assert.ok(saved.cierre,saved.error);assert.equal(saved.reused,false);
  assert.equal((await rpc(db,'side_guardar_cierre_excel',args)).reused,true);await db.exec('reset role');
  const r=closure.resultadosPorEmpresa[id],report=(await db.query('select ingresos,costos,utilidad,caja_final from reportes_ciclo where empresa_id=$1 and ciclo=$2',[id,round])).rows[0];
  assert.ok(Number(report.ingresos)>0);cerca(report.ingresos,r.ingresos);cerca(report.utilidad,r.financial.estadoResultados.utilidad);cerca(report.caja_final,r.financial.balanceCaja.cajaFinal);
  cerca((await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual,report.caja_final);
  const snapshot=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot.decision_state.__excel;
  assert.equal(snapshot.historial.financialHistory.length,round);cerca(snapshot.resultado.ingresos,report.ingresos);rows.push({ciclo:round,...report});
 }
 assert.equal(Number((await db.query('select count(*) total from side_excel_cierres where partida_id=$1',[game.id])).rows[0].total),3);
 fs.writeFileSync(path.join(__dirname,'output/ingresos-tres-ciclos-sql-20261021.json'),JSON.stringify({motor:game.motor_version,persistencia:'PostgreSQL local PGlite, migraciones reales, sin servidor remoto',filas:rows},null,2)+'\n');
 console.table(rows);console.log('PASS tres ciclos SQL actuales: ingresos, reportes, caja empresa, snapshots, historial recuperado y reintento idempotente.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
