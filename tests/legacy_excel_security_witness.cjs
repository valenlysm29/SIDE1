'use strict';
// Regression: an authenticated teacher must not submit arbitrary legacy financial results.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
(async()=>{const db=await database();try{
 await db.exec(fs.readFileSync('supabase/migrations/2026-10-11_logica_excel.sql','utf8'));
 const game=await createGame(db,config()),joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'TEST witness',p_nombre_comercial:'TEST witness'}),id=String(joined.empresa_id);
 assert.ok(joined.success,JSON.stringify(joined));
 await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[id,{decision_state:{__excel:{habilitado:true,enviado:true,round:1,decisiones:{}}}}]);
 await db.exec(fs.readFileSync('supabase/migrations/20261028201422_bloquear_escritura_resultados_legacy.sql','utf8'));
 await db.exec('set role authenticated');
 const ctx=await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:1});assert.equal(ctx.empresas.length,1);
 const out={ciclo:1,resultadosPorEmpresa:{[id]:{financial:{estadoResultados:{ingresos:900000,costos:0,utilidad:900000},balanceCaja:{cajaFinal:900000},flujoCaja:{}}}},historialPorEmpresa:{},eliminadas:[]};
 await assert.rejects(()=>rpc(db,'side_guardar_cierre_excel',{p_partida_id:game.id,p_ciclo:1,p_token:ctx.token,p_cierre:out}),/permission denied/i);
 await assert.rejects(()=>rpc(db,'guardar_reporte',{p_empresa_id:Number(id),p_ciclo:1,p_reporte:{ingresos:900000,caja_final:900000}}),/permission denied/i);
 await db.exec('reset role');
 await db.exec('set role anon');
 await assert.rejects(()=>rpc(db,'side_guardar_cierre_excel',{p_partida_id:game.id,p_ciclo:1,p_token:ctx.token,p_cierre:out}),/permission denied/i);
 await assert.rejects(()=>rpc(db,'guardar_reporte',{p_empresa_id:Number(id),p_ciclo:1,p_reporte:{ingresos:900000,caja_final:900000}}),/permission denied/i);
 await db.exec('reset role');
 const report=(await db.query('select ingresos,caja_final from reportes_ciclo where empresa_id=$1 and ciclo=1',[id])).rows;assert.equal(report.length,0);
 const company=(await db.query('select caja_actual,caja_inicial from empresas where id=$1',[id])).rows[0];assert.equal(Number(company.caja_actual),Number(company.caja_inicial));
 console.log('PASS: legacy closure and direct report reject forged S/900000; report and cash unchanged.');
 }finally{await db.close()}})().catch(error=>{console.error(error);process.exitCode=1});
