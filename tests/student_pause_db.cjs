const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,createGame,config,rpc}=require('./lifecycle_db_fixture.cjs');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8').replaceAll('collate "es-x-icu"','collate "C"');
(async()=>{const db=await database();try{
 for(const name of ['2026-10-11_fix_crear_partida.sql','2026-10-12_salas_codigo.sql','2026-10-12_codigo_corto.sql','2026-10-11_logica_excel.sql','2026-10-12_podio_programado.sql','2026-10-21_expulsion_empresa.sql'])await db.exec(sql(name));
 const migration=sql('2026-10-21_pausa_escrituras_estudiante.sql');await db.exec(migration);await db.exec(migration);
 const game=await createGame(db,config({capital:100000})),identity={p_codigo:game.codigo,p_nombre_legal:'Empresa Pausa SAC',p_nombre_comercial:'Pausa'};
 const join=await rpc(db,'unirse_partida_por_codigo',identity);assert.equal(join.success,true);
 await db.query("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','paused','running',false,'remaining',137)) where id=$1",[game.id]);
 const before=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[join.empresa_id])).rows[0];
 await db.exec('set role anon');
 for(const [name,extra] of [
  ['guardar_estado_estudiante',{p_snapshot:{round:1,decision_state:{test:true}},p_expected_revision:0}],
  ['guardar_decisiones_estudiante',{p_ciclo:1,p_decisiones:[],p_expected_revision:0}],
  ['guardar_reporte_estudiante',{p_ciclo:1,p_reporte:{caja_final:999999},p_expected_revision:0}]
 ]){const result=await rpc(db,name,{...identity,...extra});assert.equal(result.code,'CICLO_PAUSADO',name);assert.equal(result.success,false);}
 assert.ok((await rpc(db,'obtener_estado_estudiante',identity)).partida,'lectura y heartbeat siguen disponibles');
 assert.equal((await rpc(db,'guardar_estado_estudiante',{...identity,p_nombre_comercial:'otra',p_snapshot:{round:1,decision_state:{}},p_expected_revision:0})).code,'CREDENCIALES_INVALIDAS');
 await db.exec('reset role');
 assert.deepEqual((await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[join.empresa_id])).rows[0],before,'pausa no cambia snapshot ni CAS');
 await db.query("update partidas set configuracion=jsonb_set(jsonb_set(configuracion,'{runtime,status}','\"running\"'),'{runtime,running}','true') where id=$1",[game.id]);
 await db.exec('set role anon');
 const result=await rpc(db,'guardar_estado_estudiante',{...identity,p_snapshot:{round:1,decision_state:{},cash_ledger:{},financial_sections:{},section_submissions:{},decisions_submitted:false,selected_character:null},p_expected_revision:0});assert.equal(result.success,true,JSON.stringify(result));
 console.log('PASS pausa SQL: migración repetible, 3 RPC bloqueadas, identidad exacta, lectura/heartbeat activo, snapshot/CAS intacto, guardado permitido al reanudar.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
