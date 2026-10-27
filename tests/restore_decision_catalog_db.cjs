'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database}=require('./lifecycle_db_fixture.cjs');
const sql=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
(async()=>{
 for(const previousMigration of [false,true]){
  const db=await database();try{
   const id=(await db.query("select id from decisiones_opciones where opcion_id='mkt_alta'")).rows[0].id;
   const company=(await db.query("insert into empresas(nombre_legal,nombre_comercial,caja_inicial,caja_actual) values('QA','QA',0,0) returning id")).rows[0].id;
   await db.query('insert into empresas_decisiones(empresa_id,ciclo,decision_id,opcion_id,cantidad,costo_total,enviada) select $1,1,decision_id,id,1,12000,true from decisiones_opciones where id=$2',[company,id]);
   const history=(await db.query('select * from empresas_decisiones')).rows;
   if(previousMigration)await db.exec(sql('20261027_logica_documento_costos.sql'));
   await db.exec(sql('20261027_restaurar_decisiones_interfaz.sql'));
   await db.exec(sql('20261027_restaurar_decisiones_interfaz.sql'));
   for(const code of ['INV_MARKETING','MANTENIMIENTO','MOLDE'])assert.equal((await db.query('select tipo from decisiones_catalogo where decision_id=$1',[code])).rows[0].tipo,'choice');
   const options=(await db.query("select o.id,o.costo,o.activo from decisiones_opciones o join decisiones_catalogo d on d.id=o.decision_id where d.decision_id='INV_MARKETING' order by o.costo")).rows;
   assert.deepEqual(options.map(o=>Number(o.costo)),[1500,6000,12000]);assert.ok(options.every(o=>o.activo));assert.equal(options[2].id,id);
   assert.deepEqual((await db.query('select * from empresas_decisiones')).rows,history);
   assert.equal((await db.query("select count(*)::integer n from decisiones_catalogo where decision_id='REGIMEN_LABORAL' and activo=true")).rows[0].n,0);
  }finally{await db.close();}
 }
 console.log('PASS PostgreSQL: catálogo anterior restaurado con y sin migración previa, aplicación repetible e históricos intactos.');
})().catch(error=>{console.error(error);process.exitCode=1;});
