'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('migración: altas directas, activación desde próximo ciclo, históricos intactos e idempotencia',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create table partidas(id integer primary key,estado text,configuracion jsonb);
   create table side_business_closures(partida_id integer,ciclo integer,cierre jsonb);
   create table side_excel_cierres(partida_id integer,ciclo integer,cierre jsonb);
   insert into partidas values
    (1,'activa','{"lifecycleVersion":2,"cycles":3}'),
    (2,'esperando','{"lifecycleVersion":2,"cycles":3}'),
    (3,'finalizada','{"lifecycleVersion":2,"cycles":3}'),
    (4,'activa','{"lifecycleVersion":2,"cycles":1}'),
    (5,'activa','{"lifecycleVersion":1,"cycles":3}');
   insert into side_business_closures values(1,1,'{"oficial":true}'),(4,1,'{"oficial":true}');
  `);
  const migration=fs.readFileSync(require.resolve('../supabase/migrations/20261103153057_activar_rentabilidad_utility_v1.sql'),'utf8');
  const before=(await db.query('select * from side_business_closures order by partida_id')).rows;
  await db.exec(migration);await db.exec(migration);
  const rows=(await db.query('select * from partidas order by id')).rows;
  assert.equal(rows[0].configuracion.economicRulesEffectiveRound,2);
  assert.equal(rows[1].configuracion.economicRulesEffectiveRound,1);
  for(const row of rows.slice(2))assert.equal(row.configuracion.economicRulesVersion,undefined);
  assert.deepEqual((await db.query('select * from side_business_closures order by partida_id')).rows,before);
  await db.exec(`insert into partidas values(6,'esperando','{"lifecycleVersion":2,"cycles":3}');
   update partidas set configuracion='{"lifecycleVersion":2,"cycles":3,"capital":90000}' where id=1;`);
  const fresh=(await db.query('select configuracion from partidas where id=6')).rows[0].configuracion;
  assert.equal(fresh.economicRulesVersion,'utility-v1');assert.equal(fresh.economicRulesEffectiveRound,1);
  const stale=(await db.query('select configuracion from partidas where id=1')).rows[0].configuracion;
  assert.equal(stale.economicRulesVersion,'utility-v1');assert.equal(stale.economicRulesEffectiveRound,2);assert.equal(stale.capital,90000);
 }finally{await db.close()}
});
