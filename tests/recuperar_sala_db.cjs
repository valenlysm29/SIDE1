'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,rpc,professor}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database();
 try {
  for(const name of ['2026-10-11_fix_crear_partida.sql','2026-10-11_recuperar_salas_compatibles.sql']) {
   const sql=fs.readFileSync(require.resolve('../supabase/migrations/'+name),'utf8');await db.exec(sql);await db.exec(sql);
  }
  const legacy=async(name,c={})=>(await db.query(`insert into partidas(profesor_id,nombre,configuracion) values($1,$2,$3) returning *`,[professor,name,c])).rows[0];
  const recover=(id,c=null)=>rpc(db,'recuperar_sala_docente',{p_partida_id:id,p_config:c});
  // Regresiones: evidencia de progreso aunque estado/started_at sean antiguos.
  for(const [name,c,round] of [
   ['Round superior',{round:3},3],['Runtime superior',{round:3,runtime:{round:4}},4],
   ['Reloj anterior',{runtime:{startedAt:'2026-10-01T01:00:00Z'}},1],
   ['Eventos anteriores',{eventSchedule:{3:{group:[]}}},3]
  ]) {
   const old=await legacy(name,c),result=await recover(old.id,config({cycles:1}));
   assert.equal(result.estado,'activa',name+' no vuelve a espera');assert.equal(result.configuracion.runtime.round,round,name+' preserva ciclo');
   assert.equal(result.configuracion.runtime.phase,'decisions');
   if(c.eventSchedule)assert.deepEqual(result.configuracion.eventSchedule['3'],c.eventSchedule['3']);
  }
  const companyProgress=await legacy('Empresa con progreso');
  const priorCompany=(await db.query(`insert into empresas(nombre_legal,nombre_comercial,ciclo_actual) values('Previo','Previo',5) returning id`)).rows[0];
  await db.query(`insert into participantes(partida_id,empresa_id,nombre,empresa) values($1,$2,'Previo','Previo')`,[companyProgress.id,priorCompany.id]);
  const priorRecovered=await recover(companyProgress.id,config());assert.equal(priorRecovered.estado,'activa');assert.equal(priorRecovered.configuracion.runtime.round,5);
  for(const marker of ['finished','cancelled']) {
   const terminal=await legacy('Marcadores contradictorios',{phase:marker,runtime:{phase:'integration',round:1}});
   const read=await recover(terminal.id,config());assert.deepEqual(read.configuracion,terminal.configuracion,'no reabre '+marker);assert.equal(read.estado,'finalizada');
   assert.notEqual((await rpc(db,'obtener_sala_docente',{}))?.id,terminal.id,'sala terminal no bloquea una nueva');
  }
  const nullMarkers=await legacy('Marcadores vacíos',{cancelledAt:null,finishedAt:null});const nullRecovered=await recover(nullMarkers.id,config());assert.equal(nullRecovered.configuracion.runtime.phase,'integration','null no significa terminal');
  const misleading=await legacy('Runtime moderno incompleto');await db.query(`update partidas set configuracion=$2 where id=$1`,[misleading.id,{...config(),round:3,gameStartAt:'2099-01-01T00:00:00Z',runtime:{phase:'integration',round:1}}]);
  const modernRepair=await recover(misleading.id,config());assert.equal(modernRepair.estado,'activa');assert.equal(modernRepair.configuracion.runtime.round,3,'moderno contradictorio tampoco retrocede');
  const waiting=await legacy('Espera antigua');
  const earlier=await rpc(db,'ingresar_empresa',{p_codigo:waiting.codigo,p_nombre_legal:'Primera empresa',p_nombre_comercial:'Primera marca'});assert.equal(earlier.success,true);
  const recovered=await recover(waiting.id,config({integrationDurationMinutes:2}));
  assert.equal(recovered.id,waiting.id);assert.equal(recovered.codigo,waiting.codigo);assert.equal(recovered.estado,'esperando');assert.equal(recovered.configuracion.runtime.phase,'integration');assert.ok(recovered.serverTime);
  const second=await recover(waiting.id,config({integrationDurationMinutes:60}));
  assert.equal(second.configuracion.gameStartAt,recovered.configuracion.gameStartAt,'reintento no reinicia espera');
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:waiting.codigo,p_nombre_legal:'Empresa nueva',p_nombre_comercial:'Mi marca'});
  assert.equal(joined.success,true,'sala recuperada admite empresas');
  await recover(waiting.id);
  assert.equal((await db.query('select count(*)::int n from participantes where partida_id=$1',[waiting.id])).rows[0].n,2,'preserva participantes legacy');
  assert.equal((await rpc(db,'ingresar_empresa',{p_codigo:waiting.codigo,p_nombre_legal:'Primera empresa',p_nombre_comercial:'Primera marca'})).success,true);
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(clock_timestamp()-interval '1 second')) where id=$1`,[waiting.id]);
  const ticking=await recover(waiting.id),tickingAgain=await recover(waiting.id);assert.equal(ticking.estado,'activa');assert.equal(ticking.configuracion.runtime.startedAt,tickingAgain.configuracion.runtime.startedAt,'inicio automático una vez');
  const broken=await legacy('Inválida');const invalid=await recover(broken.id,config({cycles:0}));assert.equal(invalid.code,'CONFIG_INVALIDA');
  assert.deepEqual((await db.query('select configuracion from partidas where id=$1',[broken.id])).rows[0].configuracion,{});
  const active=await legacy('Activa antigua',{round:3,phase:'results'});
  const company=(await db.query(`insert into empresas(nombre_legal,nombre_comercial,ciclo_actual,caja_actual) values('Antigua','Marca',3,777) returning id`)).rows[0];
  await db.query(`insert into participantes(partida_id,empresa_id,nombre,empresa,nombre_legal_ingreso,nombre_comercial_ingreso) values($1,$2,'Antigua','Marca','Antigua','Marca')`,[active.id,company.id]);
  await db.query(`insert into empresas_decisiones(empresa_id,ciclo,cantidad,costo_total) values($1,3,2,123)`,[company.id]);
  await db.query(`update partidas set estado='activa',started_at='2026-10-01T01:00:00Z' where id=$1`,[active.id]);
  const started=await recover(active.id,config({cycles:1}));assert.equal(started.estado,'activa');assert.equal(started.configuracion.runtime.phase,'results');assert.equal(started.configuracion.runtime.round,3);
  assert.equal(Date.parse(started.started_at),Date.parse('2026-10-01T01:00:00Z'));
  assert.equal((await recover(active.id)).configuracion.runtime.round,3);
  assert.equal((await db.query('select count(*)::int n from empresas_decisiones where empresa_id=$1',[company.id])).rows[0].n,1);
  assert.equal((await db.query('select caja_actual from empresas where id=$1',[company.id])).rows[0].caja_actual,'777');
  const admission=await rpc(db,'ingresar_empresa',{p_codigo:active.codigo,p_nombre_legal:'Antigua',p_nombre_comercial:'Marca'});assert.equal(admission.success,true,'recuperación de identidad existente');
  const progress=await legacy('En curso',{round:2});await db.query(`update partidas set estado='activa' where id=$1`,[progress.id]);
  const paused=await recover(progress.id);assert.equal(paused.configuracion.runtime.round,2);assert.equal(paused.configuracion.runtime.phase,'decisions');assert.equal(paused.configuracion.runtime.status,'paused');
  const resumed=await rpc(db,'controlar_partida',{p_partida_id:progress.id,p_accion:'reanudar',p_expected_round:2});assert.equal(resumed.configuracion.runtime.running,true);
  const cancelled=await legacy('Cancelada',{cancelledAt:'2026-10-01',phase:'cancelled'});const cancelledRead=await recover(cancelled.id,config());assert.equal(cancelledRead.configuracion.phase,'cancelled');assert.equal(cancelledRead.configuracion.lifecycleVersion,undefined,'no reabre cancelada');assert.equal(cancelledRead.estado,'finalizada');
  const automatic=await legacy('Automática');const auto=await recover(automatic.id,config({cycleCloseMode:'automatic',integrationDurationMinutes:2}));assert.equal(auto.configuracion.runtime.mode,'automatic');assert.equal(auto.estado,'esperando');
  const other='22222222-2222-2222-2222-222222222222';await db.query(`insert into auth.users(id,raw_user_meta_data,email) values($1,'{}','other@example.invalid')`,[other]);
  await db.query(`select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)`);assert.equal((await recover(waiting.id)).code,'NO_AUTORIZADO');
  await db.query(`select set_config('test.uid',$1,false)`,[professor]);await db.exec('set role authenticated');assert.equal((await recover(waiting.id)).id,waiting.id);await db.exec('reset role');
  await db.exec('set role anon');await assert.rejects(recover(waiting.id),e=>e.code==='42501');await db.exec('reset role');
  console.log('recuperar_sala_db: PASS (SQL dos veces, espera, admisión, conservación de ciclo/datos/código, permisos, reintentos)');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
