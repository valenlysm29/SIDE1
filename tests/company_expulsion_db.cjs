'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,createGame,config,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8').replaceAll('collate "es-x-icu"','collate "C"');
(async()=>{const db=await database();try{
 for(const name of ['2026-10-11_fix_crear_partida.sql','2026-10-12_salas_codigo.sql','2026-10-12_codigo_corto.sql','2026-10-11_logica_excel.sql','2026-10-12_podio_programado.sql'])await db.exec(sql(name));
 const migration=sql('2026-10-21_expulsion_empresa.sql');await db.exec(migration);await db.exec(migration);
 const game=await createGame(db,config({capital:100000}));
 const identity={p_codigo:game.codigo,p_nombre_legal:'Empresa Inactiva SAC',p_nombre_comercial:'Inactiva'};
 const other={...identity,p_nombre_legal:'Otra SAC',p_nombre_comercial:'Otra'};
 const join=await rpc(db,'unirse_partida_por_codigo',identity),joinOther=await rpc(db,'unirse_partida_por_codigo',other);
 assert.equal(join.success,true);assert.equal(joinOther.success,true);
 const target={p_partida_id:game.id,p_empresa_id:join.empresa_id,p_expulsar:true};
 await db.exec('set role anon');await assert.rejects(rpc(db,'side_expulsar_empresa',target),/permission denied/);await db.exec('reset role');
 await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
 assert.equal((await rpc(db,'side_expulsar_empresa',target)).code,'NO_AUTORIZADO');
 await db.query("select set_config('test.uid',$1,false)",[professor]);
 assert.equal((await rpc(db,'side_expulsar_empresa',{...target,p_empresa_id:999999})).code,'EMPRESA_AJENA');
 // El modelo anterior solo cierra empresas habilitadas explícitamente por lotes.
 await db.query("update side_student_state set snapshot=jsonb_set(snapshot,'{decision_state}',jsonb_build_object('__excel',jsonb_build_object('habilitado',true,'cicloActivacion',1))) where empresa_id=any($1::bigint[])",[[join.empresa_id,joinOther.empresa_id]]);
 const before=await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:1});assert.equal(before.empresas.length,2);
 const expelled=await rpc(db,'side_expulsar_empresa',target);assert.equal(expelled.success,true);assert.ok(expelled.expulsada_at);
 assert.equal((await rpc(db,'side_expulsar_empresa',target)).expulsada_at,expelled.expulsada_at,'idempotencia');
 const stateBefore=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[join.empresa_id])).rows[0];
 await db.exec('set role anon');
 for(const [name,extra] of [
  ['unirse_partida_por_codigo',{}],['obtener_estado_estudiante',{}],['side_podio_estudiante',{}],
  ['guardar_estado_estudiante',{p_snapshot:{decision_state:{bad:true}},p_expected_revision:0}],
  ['guardar_decisiones_estudiante',{p_ciclo:1,p_decisiones:[],p_expected_revision:0}],
  ['guardar_reporte_estudiante',{p_ciclo:1,p_reporte:{caja_final:999999},p_expected_revision:0}]
 ]){
  const result=await rpc(db,name,{...identity,...extra});assert.equal(result.code,'EMPRESA_EXPULSADA',name);assert.equal(result.success,false);
 }
 await assert.rejects(rpc(db,'obtener_estado_juego',{p_empresa_id:join.empresa_id}),/permission denied/);
 assert.equal((await rpc(db,'obtener_estado_estudiante',other)).empresas_unidas,1);
 assert.equal((await rpc(db,'obtener_estado_estudiante',{...identity,p_nombre_comercial:'inactiva'})).code,'CREDENCIALES_INVALIDAS','conserva identidad exacta');
 await db.exec('reset role');
 assert.deepEqual((await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[join.empresa_id])).rows[0],stateBefore,'sin cambios tras escrituras rechazadas');
 const context=await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:1});
 assert.deepEqual(context.empresas.map(x=>x.id),[String(joinOther.empresa_id)]);assert.notEqual(context.token,before.token);
 assert.equal((await rpc(db,'side_guardar_cierre_excel',{p_partida_id:game.id,p_ciclo:1,p_token:before.token,p_cierre:{}})).code,'ESTADO_DESACTUALIZADO');
 const {cerrarCiclo}=require('../js/engine/ciclo.js'),{adjuntarCaja}=require('../js/engine/caja.js');
 const overrides=context.overrides||{},id=String(joinOther.empresa_id);
 const closure=adjuntarCaja(cerrarCiclo({ciclo:1,empresas:[id]},overrides),{capitalPorEmpresa:{[id]:100000},overrides});
 assert.ok((await rpc(db,'side_guardar_cierre_excel',{p_partida_id:game.id,p_ciclo:1,p_token:context.token,p_cierre:closure})).cierre);
 assert.equal((await db.query('select count(*)::int n from reportes_ciclo where empresa_id=$1',[join.empresa_id])).rows[0].n,0,'expulsada no participa ni recibe nuevos costos');
 assert.equal((await db.query('select count(*)::int n from empresas where id=$1',[join.empresa_id])).rows[0].n,1,'preserva empresa y progreso');
 await db.query('update participantes set puntaje_docente=18 where empresa_id=$1',[joinOther.empresa_id]);
 const podium=await rpc(db,'side_podio_docente',{p_partida_id:game.id,p_accion:'publicar',p_minutos:0,p_justificacion:'Prueba'});
 assert.equal(podium.success,true,'expulsada sin nota no bloquea publicación');
 assert.deepEqual(podium.publication.podium.map(x=>x.empresaId),[joinOther.empresa_id],'expulsada no compite en el podio');
 assert.equal((await rpc(db,'side_expulsar_empresa',{...target,p_expulsar:false})).expulsada_at,null);
 await db.exec('set role anon');
 const rejoin=await rpc(db,'unirse_partida_por_codigo',identity);assert.equal(rejoin.success,true);assert.equal(rejoin.empresa_id,join.empresa_id);
 await db.exec('reset role');
 await db.query("update partidas set estado='finalizada' where id=$1",[game.id]);
 assert.equal((await rpc(db,'side_expulsar_empresa',target)).code,'PARTIDA_TERMINADA');
 console.log('PASS expulsión SQL: migración repetible, permisos, identidad, seis RPC bloqueadas, contador activo, CAS sin cambios, cierre sin costos, token invalidado, conservación y reactivación.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
