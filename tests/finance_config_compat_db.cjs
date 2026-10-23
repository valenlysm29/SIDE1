'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,createGame,config,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8').replaceAll('collate "es-x-icu"','collate "C"');
(async()=>{
 for(const revision of ['2026-10-21_expulsion_empresa.sql','2026-10-22_revertir_correcciones_conversacion.sql']){
  const db=await database();try{
   for(const name of ['2026-10-11_fix_crear_partida.sql','2026-10-12_salas_codigo.sql','2026-10-12_codigo_corto.sql','2026-10-11_logica_excel.sql','2026-10-12_podio_programado.sql',revision])await db.exec(sql(name));
   const game=await createGame(db,config({capital:100000,interest:20}));
   const identity={p_codigo:game.codigo,p_nombre_legal:'Finanzas SAC',p_nombre_comercial:'Finanzas'};
   const a=await rpc(db,'unirse_partida_por_codigo',identity),b=await rpc(db,'unirse_partida_por_codigo',{...identity,p_nombre_legal:'Otra SAC',p_nombre_comercial:'Otra'});
   assert.equal(a.success,true);assert.equal(b.success,true);
   await db.query("update side_student_state set snapshot=jsonb_set(snapshot,'{decision_state}',jsonb_build_object('__excel',jsonb_build_object('habilitado',true,'cicloActivacion',1))) where empresa_id=any($1::bigint[])",[[a.empresa_id,b.empresa_id]]);
   await rpc(db,'side_expulsar_empresa',{p_partida_id:game.id,p_empresa_id:a.empresa_id,p_expulsar:true});
   const args={p_partida_id:game.id,p_ciclo:1},before=await rpc(db,'side_contexto_cierre_excel',args);
   assert.deepEqual(before.empresas.map(e=>e.id),[String(b.empresa_id)]);
   const migration=sql('2026-10-23_configuracion_financiera.sql');await db.exec(migration);await db.exec(migration);
   const after=await rpc(db,'side_contexto_cierre_excel',args);
   assert.deepEqual(after,{...before,financialConfig:game.configuracion},'preserva filtros, token, empresas e historial');
   await db.exec('set role authenticated');
   assert.deepEqual(await rpc(db,'side_contexto_cierre_excel',args),after);
   await assert.rejects(db.query('select side_private.contexto_antes_finanzas_20261023($1,$2)',[game.id,1]),/permission denied/);
   await db.exec('reset role');
   await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
   const denied=await rpc(db,'side_contexto_cierre_excel',args);assert.equal(denied.code,'NO_AUTORIZADO');assert.equal(denied.financialConfig,undefined);
   await db.query("select set_config('test.uid',$1,false)",[professor]);
   await db.exec('set role anon');await assert.rejects(rpc(db,'side_contexto_cierre_excel',args),/permission denied/);await db.exec('reset role');
   await db.query('insert into side_excel_cierres(partida_id,ciclo,cierre) values($1,1,$2)',[game.id,{ciclo:1,marker:'no recalcular'}]);
   assert.deepEqual(await rpc(db,'side_contexto_cierre_excel',args),{cierre:{ciclo:1,marker:'no recalcular'}});
   console.log('PASS compatibilidad financiera: '+revision+'; migración repetida, expulsión, token, permisos y cierre conservados');
  }finally{await db.close();}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
