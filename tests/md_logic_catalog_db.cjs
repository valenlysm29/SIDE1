'use strict';
// In-memory PostgreSQL only. No credentials or external database.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();try{
  const before=(await db.query("select id from decisiones_opciones where opcion_id='mkt_alta'")).rows[0].id;
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261027_logica_documento_costos.sql'),'utf8');
  await db.exec(sql);await db.exec(sql);
  const regime=(await db.query("select id from decisiones_catalogo where decision_id='REGIMEN_LABORAL'")).rows;
  assert.equal(regime.length,1);assert.equal((await db.query('select * from decisiones_opciones where decision_id=$1 and activo=true',[regime[0].id])).rows.length,2);
  assert.equal((await db.query("select tipo from decisiones_catalogo where decision_id='INV_MARKETING'")).rows[0].tipo,'number');
  assert.equal((await db.query('select activo from decisiones_opciones where id=$1',[before])).rows[0].activo,false);
  assert.equal((await db.query("select tipo from decisiones_catalogo where decision_id='MANTENIMIENTO'")).rows[0].tipo,'info');
  assert.equal((await db.query("select tipo from decisiones_catalogo where decision_id='MOLDE'")).rows[0].tipo,'multi-choice');
  assert.equal((await db.query('select count(*)::integer n from empresas_decisiones')).rows[0].n,0);
  console.log('PASS PostgreSQL: migración repetible, régimen y opciones únicos, publicidad numérica, mantenimiento automático, opciones históricas conservadas.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
