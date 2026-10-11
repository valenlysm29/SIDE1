'use strict';
// PostgreSQL en memoria, aislado; no consulta ni modifica Supabase.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpcAfterWaiting:rpc}=require('./lifecycle_db_fixture.cjs');
const {decision}=require('./escenarios_excel.cjs');
(async()=>{const db=await database();try{
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/2026-10-11_logica_excel.sql'),'utf8'));
 const game=await createGame(db,config({capital:100000}));
 const ingreso=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa transición',p_nombre_comercial:'Transición'}),id=String(ingreso.empresa_id);
 await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[id,{decision_state:{__excel:{habilitado:true,cicloActivacion:2,enviado:true,round:2,decisiones:decision()}}}]);
 await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:null,p_expected_round:null});await db.exec('set role authenticated');
 const pasado=await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:1});assert.deepEqual(pasado.empresas,[],'Activación2 no participa ni se elimina retroactivamente en cierre1');
 await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'avanzar',p_config:null,p_expected_round:1});
 const actual=await rpc(db,'side_contexto_cierre_excel',{p_partida_id:game.id,p_ciclo:2});assert.equal(actual.empresas.length,1);assert.equal(actual.empresas[0].id,id);
 console.log('PASS Excel SQL activación: ciclo2 excluye cierre1 y participa desde2.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
