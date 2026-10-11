'use strict';
// PostgreSQL local en memoria: jamás conecta con Supabase.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpcAfterWaiting:rpc,professor}=require('./lifecycle_db_fixture.cjs');
const {decision}=require('./escenarios_excel.cjs');
const {cerrarCiclo}=require('../js/engine/ciclo.js'),{adjuntarCaja}=require('../js/engine/caja.js');
(async()=>{
 const db=await database();
 try{
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/2026-10-11_logica_excel.sql'),'utf8');
  await db.exec(sql);await db.exec(sql);
  const game=await createGame(db,config({capital:100000}));
  const entrada=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa Excel',p_nombre_comercial:'Excel'});
  assert.equal(entrada.success,true);const id=String(entrada.empresa_id),d=decision({montoPrestamo:5000});
  await db.query(`insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot`,[id,{decision_state:{__excel:{habilitado:true,enviado:true,round:1,decisiones:d}}}]);
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:null,p_expected_round:null});
  await db.exec('set role authenticated');
  const contexto=()=>rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:1});
  const ctx=await contexto();assert.equal(ctx.empresas.length,1);assert.equal(ctx.empresas[0].envelope.decisiones.montoPrestamo,5000);
  const fabricar=c=>adjuntarCaja(cerrarCiclo({ciclo:1,empresas:[id],decisionesPorEmpresa:{[id]:d},historialPorEmpresa:c.historialPorEmpresa}),{capitalPorEmpresa:{[id]:100000},historialAnterior:c.historialPorEmpresa});
  const guardar=(c,out)=>rpc(db,'side_guardar_cierre_excel',{p_partida_id:game.id,p_ciclo:1,p_token:c.token,p_cierre:out});
  await db.exec('reset role');await db.query('update side_student_state set revision=revision+1 where empresa_id=$1',[id]);await db.exec('set role authenticated');
  assert.equal((await guardar(ctx,fabricar(ctx))).code,'ESTADO_DESACTUALIZADO');
  const actual=await contexto(),out=fabricar(actual),saved=await guardar(actual,out);assert.ok(saved.cierre);assert.equal(saved.reused,false);
  const again=await guardar(actual,{...out,resultadosPorEmpresa:{}});assert.equal(again.reused,true);assert.deepEqual(again.cierre,saved.cierre);
  await db.exec('reset role');
  const report=(await db.query('select * from reportes_ciclo where empresa_id=$1 and ciclo=1',[id])).rows[0];
  assert.equal(Number(report.caja_final),out.resultadosPorEmpresa[id].financial.balanceCaja.cajaFinal);
  assert.equal(Number(report.utilidad),out.resultadosPorEmpresa[id].financial.estadoResultados.utilidad);
  await db.query(`update reportes_ciclo set caja_final=1,utilidad=1,estado_resultados='{}' where empresa_id=$1 and ciclo=1`,[id]);
  assert.equal(Number((await db.query('select caja_final from reportes_ciclo where empresa_id=$1',[id])).rows[0].caja_final),Number(report.caja_final));
  await db.query(`update side_student_state set snapshot=$2 where empresa_id=$1`,[id,{decision_state:{__excel:{habilitado:false,planesPorCiclo:{1:{lotes:[]}}}}}]);
  const snapshot=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot.decision_state.__excel;
  assert.equal(snapshot.habilitado,true);assert.deepEqual(snapshot.planesPorCiclo['1'],d);assert.equal(snapshot.resultado.financial.balanceCaja.cajaFinal,Number(report.caja_final));
  await db.query(`select set_config('test.uid',$1,false)`,['22222222-2222-2222-2222-222222222222']);await db.exec('set role authenticated');
  assert.equal((await contexto()).code,'NO_AUTORIZADO');
  await db.exec('reset role');await db.query(`select set_config('test.uid',$1,false)`,[professor]);await db.exec('set role anon');
  await assert.rejects(contexto(),/permission denied/);
  console.log('PASS Excel SQL: idempotencia, mismo motor/caja, CAS, aislamiento docente, anon denegado y protección de reportes/snapshots tardíos.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
