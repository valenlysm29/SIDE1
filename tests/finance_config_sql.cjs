const fs=require('fs'),assert=require('node:assert/strict');const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');const F=require('../services/finance_config.js');
(async()=>{const db=await database();try{
 await db.exec(fs.readFileSync('supabase/migrations/2026-10-11_logica_excel.sql','utf8'));
 const migration=fs.readFileSync('supabase/migrations/2026-10-23_configuracion_financiera.sql','utf8');await db.exec(migration);await db.exec(migration);
 const game=await createGame(db,config({capital:100000,interest:20}));
 await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:null,p_expected_round:null});
 let saved=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'guardar',p_config:config({capital:125000,interest:30}),p_expected_round:null});
 assert.equal(saved.configuracion.capital,125000);assert.equal(F.resolve(saved.configuracion,1).capital,100000);
 const admitted=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa después del cambio',p_nombre_comercial:'Posterior'});
 assert.equal(admitted.success,true);assert.equal(Number(admitted.empresa.caja_inicial??admitted.caja_inicial),100000);
 await db.query(`update partidas set estado='activa',configuracion=configuracion||'{"round":2,"phase":"decisions","gameStartedAt":"2026-10-23T12:00:00Z","runtime":{"round":2,"phase":"decisions","running":false,"status":"paused","remaining":600}}'::jsonb where id=$1`,[game.id]);
 saved=await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'guardar',p_config:config({capital:150000,interest:35}),p_expected_round:null});
 assert.equal(F.resolve(saved.configuracion,2).capital,125000);assert.equal(F.resolve(saved.configuracion,3).capital,150000);assert.equal(F.adjustment(saved.configuracion,3,'1',100000),50000);
 assert.equal((await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:2})).financialConfig.interest,35);
 await assert.rejects(()=>rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'guardar',p_config:config({capital:-1,interest:35}),p_expected_round:null}),/inválida/);
 console.log('PASS financial schedule SQL: idempotent migration, integration save, future-cycle persistence, authoritative context, invalid values');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
