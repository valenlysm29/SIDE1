'use strict';
// PostgreSQL embebido solamente; no usa credenciales ni servicios remotos.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {database}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('supabase/migrations/2026-10-23_separacion_2d_3d.sql');
const count=async db=>(await db.query("select count(*)::int as n from pg_trigger where tgname in ('side_excel_snapshot_protegido','side_excel_reporte_protegido')")).rows[0].n;
(async()=>{
 const empty=new PGlite();
 try{await empty.exec(sql);await empty.exec(sql);}finally{await empty.close();}
 const db=await database();
 try{
  await db.exec(read('supabase/migrations/2026-10-11_logica_excel.sql'));
  assert.equal(await count(db),2,'fixture installs actual historical triggers and functions');
  const functionsBefore=(await db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('side_preservar_cierre_excel_snapshot','side_preservar_reporte_excel') order by proname")).rows;
  await db.exec(sql);await db.exec(sql);
  assert.equal(await count(db),0,'both interfering triggers are removed repeatably');
  assert.deepEqual((await db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('side_preservar_cierre_excel_snapshot','side_preservar_reporte_excel') order by proname")).rows,functionsBefore,'historical functions remain intact');
  const reversal=sql.slice(sql.indexOf('-- begin;',sql.indexOf('-- Reversión'))).split('\n').filter(line=>line.startsWith('-- ')&&!line.startsWith('-- ADVERTENCIA')&&!line.startsWith('-- sobrescriban')).map(line=>line.slice(3)).join('\n');
  await db.exec(reversal);
  assert.equal(await count(db),2,'documented reversal recreates both triggers using actual historical functions');
  await db.exec(sql);assert.equal(await count(db),0,'migration can be reapplied after reversal');
  console.log('PASS SQL separation: absent tables, repeated removal, preserved functions, exact documented reversal and reapplication');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
