const assert=require('node:assert/strict');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');

const STARTED_MESSAGE='La partida ya inició. Solo pueden reingresar quienes ya estaban registrados; verifica que el código, el nombre de empresa y el nombre comercial sean exactamente los registrados.';

(async()=>{
 // Ejecuta la migracion real sobre datos que ya existian antes de que fueran
 // agregadas las columnas de identidad. Reproduce SIDE-005 + demo2/demo2 y
 // comprueba que el backfill conserva el reingreso estricto tras iniciar.
 let legacy;
 const legacyDb=await database({beforeStudentAdmission:async db=>{
  for(let index=0;index<=5;index++)legacy=await createGame(db,config());
  assert.equal(legacy.codigo,'SIDE-005');
  const empresa=(await db.query(`
   insert into empresas(nombre_legal,nombre_comercial,caja_inicial,caja_actual,ciclo_actual)
   values('demo2','demo2',100000,87654,1) returning id
  `)).rows[0];
  const participante=(await db.query(`
   insert into participantes(partida_id,empresa_id,nombre,empresa)
   values($1,$2,'Jugador','demo2') returning id
  `,[legacy.id,empresa.id])).rows[0];
  legacy={...legacy,empresa_id:empresa.id,participante_id:participante.id};
 }});
 try{
  const migrated=(await legacyDb.query(`
   select nombre_legal_ingreso,nombre_comercial_ingreso
   from participantes where id=$1
  `,[legacy.participante_id])).rows[0];
  assert.deepEqual(migrated,{nombre_legal_ingreso:'demo2',nombre_comercial_ingreso:'demo2'});
  const started=await rpc(legacyDb,'controlar_partida',{
   p_partida_id:legacy.id,p_accion:'iniciar',p_config:null,p_expected_round:null
  });
  assert.equal(started.configuracion.runtime.phase,'decisions');
  await legacyDb.exec('set role anon');
  const reentry=await rpc(legacyDb,'ingresar_empresa',{
   p_codigo:' side-005 ',p_nombre_legal:' DEMO2 ',p_nombre_comercial:'demo2'
  });
  assert.equal(reentry.success,true);
  assert.equal(reentry.reingreso,true);
  assert.equal(reentry.empresa_id,legacy.empresa_id);
  assert.equal(reentry.participante_id,legacy.participante_id);
  await legacyDb.exec('reset role');
  assert.equal((await legacyDb.query('select count(*)::int total from participantes where partida_id=$1',[legacy.id])).rows[0].total,1);
 }finally{await legacyDb.close();}

 const db=await database();
 try{
  const game=await createGame(db,config({capital:135000}));
  assert.equal(game.codigo,'SIDE-000','the demo code remains available for the first game');
  const join=(codigo,nombreLegal,nombreComercial)=>rpc(db,'ingresar_empresa',{
   p_codigo:codigo,p_nombre_legal:nombreLegal,p_nombre_comercial:nombreComercial
  });
  const action=(name,extra={})=>rpc(db,'controlar_partida',{
   p_partida_id:game.id,p_accion:name,...extra
  });

  // 1. Antes del ciclo 1, la RPC crea empresa + participante una sola vez.
  const first=await join(game.codigo,'Compañía Ágil S.A.','Café del Norte');
  assert.equal(first.success,true);
  assert.equal(first.reingreso,false);
  assert.ok(first.empresa_id);
  assert.ok(first.participante_id);
  assert.equal(Number(first.empresa.caja_actual),135000);
  assert.equal(first.ciclo_partida,1);
  assert.equal((await db.query('select count(*)::int as total from participantes where partida_id=$1',[game.id])).rows[0].total,1);

  // Antes de iniciar, la identidad es la terna completa: compartir solo uno
  // de los nombres no convierte el alta en un intento de reingreso.
  const sameLegal=await join(game.codigo,'Compañía Ágil S.A.','Café Costa');
  const sameBrand=await join(game.codigo,'Compañía Pacífico S.A.','Café del Norte');
  assert.equal(sameLegal.success,true);
  assert.equal(sameBrand.success,true);
  assert.notEqual(sameLegal.empresa_id,first.empresa_id);
  assert.notEqual(sameBrand.empresa_id,first.empresa_id);

  // Persiste un estado reconocible para comprobar la restauracion completa.
  await db.query('update empresas set caja_actual=98765 where id=$1',[first.empresa_id]);
  const snapshot={
   decision_state:{PRECIO:{round:1,value:42,cost:1234}},
   cash_ledger:{'1:PRECIO':-1234},
   financial_sections:{produccion:{total:7}},
   section_submissions:{produccion:true},
   decisions_submitted:true,
   selected_character:'mona',
   ignored_by_allowlist:'secret'
  };
  const saved=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:game.codigo,
   p_nombre_legal:'COMPAÑÍA ÁGIL S.A.',
   p_nombre_comercial:'CAFÉ DEL NORTE',
   p_snapshot:snapshot,
   p_expected_revision:0
  });
  assert.equal(saved.success,true);
  assert.equal(Number(saved.snapshot_revision),1);

  // Compare-and-swap: una sesión atrasada no puede pisar el snapshot reciente.
  const staleSnapshot={...snapshot,decision_state:{PRECIO:{round:1,value:999,cost:999}}};
  const stale=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:game.codigo,
   p_nombre_legal:'Compañía Ágil S.A.',
   p_nombre_comercial:'Café del Norte',
   p_snapshot:staleSnapshot,
   p_expected_revision:0
  });
  assert.equal(stale.success,false);
  assert.equal(stale.code,'ESTADO_DESACTUALIZADO');
  assert.equal(Number(stale.snapshot_revision),1);

  const safeRead=await rpc(db,'obtener_estado_estudiante',{
   p_codigo:`  ${game.codigo.toLowerCase()}  `,
   p_nombre_legal:'  COMPANIA   AGIL S.A. ',
   p_nombre_comercial:' cafe   del norte '
  });
  assert.equal(safeRead.success,true);
  assert.equal(Number(safeRead.snapshot_revision),1);
  assert.deepEqual(safeRead.snapshot.decision_state,snapshot.decision_state);

  const started=await action('iniciar');
  assert.equal(started.estado,'activa');
  assert.equal(started.configuracion.runtime.phase,'decisions');
  assert.ok((await db.query('select started_at from partidas where id=$1',[game.id])).rows[0].started_at);

  // 2. Despues del inicio, una identidad nueva se rechaza con el codigo y mensaje requeridos.
  const late=await join(game.codigo,'Empresa Tardia S.A.','Marca Tardia');
  assert.equal(late.success,false);
  assert.equal(late.code,'PARTIDA_INICIADA');
  assert.equal(late.error,STARTED_MESSAGE);

  // 3 y 5. Reingreso con la terna normalizada: mismos IDs y estado existente.
  const normalizedCode=`  ${game.codigo.toLowerCase()}  `;
  const reentry=await join(normalizedCode,'  COMPANIA   AGIL S.A.  ',' cafe   del norte ');
  assert.equal(reentry.success,true);
  assert.equal(reentry.reingreso,true);
  assert.equal(reentry.empresa_id,first.empresa_id);
  assert.equal(reentry.participante_id,first.participante_id);
  assert.equal(Number(reentry.empresa.caja_actual),98765);
  assert.equal(reentry.ciclo_partida,1);
  assert.deepEqual(reentry.snapshot.decision_state,snapshot.decision_state);
  assert.deepEqual(reentry.snapshot.cash_ledger,snapshot.cash_ledger);
  assert.equal(reentry.snapshot.ignored_by_allowlist,undefined);
  assert.equal(Number(reentry.snapshot_revision),1);

  // 4. Tras iniciar, toda terna que no sea una coincidencia exacta recibe el
  // mismo oraculo. No distingue nombre legal, comercial ni empresa nueva.
  const deniedAttempts=[
   [game.codigo,'Compañía Equivocada S.A.','Café del Norte'],
   [game.codigo,'Compañía Ágil S.A.','Marca Equivocada'],
   [game.codigo,'Empresa Completamente Nueva S.A.','Marca Completamente Nueva']
  ];
  const deniedResults=[];
  for(const attempt of deniedAttempts){
   const denied=await join(...attempt);deniedResults.push(denied);
   assert.equal(denied.success,false);
   assert.equal(denied.code,'PARTIDA_INICIADA');
   assert.equal(denied.error,STARTED_MESSAGE);
  }
  assert.deepEqual(deniedResults,[deniedResults[0],deniedResults[0],deniedResults[0]]);

  // 6. Dos sesiones/reingresos simultaneos recuperan la misma fila, sin duplicados.
  const sessions=await Promise.all([
   join(game.codigo,'Compañía Ágil S.A.','Café del Norte'),
   join(game.codigo,'COMPANIA AGIL S.A.','CAFE DEL NORTE')
  ]);
  assert.ok(sessions.every(row=>row.success&&row.reingreso));
  assert.ok(sessions.every(row=>row.empresa_id===first.empresa_id&&row.participante_id===first.participante_id));
  const counts=(await db.query(`
   select
    (select count(*)::int from participantes where partida_id=$1 and empresa_id=$2) participantes,
    (select count(*)::int from empresas where id=$2) empresas,
    (select count(*)::int from side_student_state where empresa_id=$2) estados
  `,[game.id,first.empresa_id])).rows[0];
  assert.deepEqual(counts,{participantes:1,empresas:1,estados:1});

  // La decision del servidor tambien manda si inicio y alta compiten por la misma partida.
  const racing=await createGame(db);
  const [raceStart,raceJoin]=await Promise.all([
   rpc(db,'controlar_partida',{p_partida_id:racing.id,p_accion:'iniciar'}),
   join(racing.codigo,'Empresa Carrera S.A.','Marca Carrera')
  ]);
  assert.equal(raceStart.configuracion.runtime.phase,'decisions');
  if(raceJoin.success){
   assert.equal(raceJoin.reingreso,false);
   assert.equal((await db.query('select count(*)::int as total from participantes where partida_id=$1',[racing.id])).rows[0].total,1);
  }else{
   assert.equal(raceJoin.code,'PARTIDA_INICIADA');
   assert.equal((await db.query('select count(*)::int as total from participantes where partida_id=$1',[racing.id])).rows[0].total,0);
  }

  // Compatibilidad: SIDE-000 ya cubrio alta/reingreso seguro y el profesor conservo sus controles.
  assert.equal((await join(' side-000 ','COMPANIA AGIL S.A.','CAFE DEL NORTE')).empresa_id,first.empresa_id);

  // Las RPC seguras por terna siguen disponibles a anon. Las variantes
  // historicas por empresaId y las escrituras REST quedan cerradas.
  const anonymousGame=await createGame(db);
  const decisionKey=(await db.query(`select decision_id from decisiones_catalogo where activo=true order by id limit 1`)).rows[0].decision_id;
  const decisionPayload=[{decision_id:decisionKey,cantidad:3,costo_total:321}];
  const reportPayload={capital:135000,ingresos:1000,costos:250,utilidad:750,caja_final:87654,decisiones:[],eventos:[]};
  const beforeOperational={
   caja:Number((await db.query('select caja_actual from empresas where id=$1',[first.empresa_id])).rows[0].caja_actual),
   decisiones:(await db.query('select count(*)::int total from empresas_decisiones where empresa_id=$1',[first.empresa_id])).rows[0].total,
   reportes:(await db.query('select count(*)::int total from reportes_ciclo where empresa_id=$1',[first.empresa_id])).rows[0].total
  };
  await db.exec('set role anon');
  const anonymousFirst=await join(anonymousGame.codigo,'Anonima Legal S.A.','Anonima Comercial');
  assert.equal(anonymousFirst.success,true);
  assert.equal(anonymousFirst.reingreso,false);
  const anonymousReentry=await join(game.codigo,'Compania Agil S.A.','Cafe del Norte');
  assert.equal(anonymousReentry.empresa_id,first.empresa_id);

  const anonymousState=await rpc(db,'obtener_estado_estudiante',{
   p_codigo:' side-000 ',p_nombre_legal:'COMPANIA AGIL S.A.',p_nombre_comercial:'CAFE DEL NORTE'
  });
  assert.equal(anonymousState.success,true);
  assert.equal(Number(anonymousState.snapshot_revision),1);
  assert.deepEqual(anonymousState.snapshot.decision_state,snapshot.decision_state);

  const anonymousSnapshot={...snapshot,decision_state:{PRECIO:{round:1,value:43,cost:1234}}};
  const anonymousSave=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compania Agil S.A.',p_nombre_comercial:'Cafe del Norte',
   p_snapshot:anonymousSnapshot,p_expected_revision:1
  });
  assert.equal(anonymousSave.success,true);
  assert.equal(Number(anonymousSave.snapshot_revision),2);
  const anonymousStale=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compania Agil S.A.',p_nombre_comercial:'Cafe del Norte',
   p_snapshot:staleSnapshot,p_expected_revision:1
  });
  assert.equal(anonymousStale.code,'ESTADO_DESACTUALIZADO');
  assert.equal(Number(anonymousStale.snapshot_revision),2);
  const stateAfterStale=await rpc(db,'obtener_estado_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compania Agil S.A.',p_nombre_comercial:'Cafe del Norte'
  });
  assert.deepEqual(stateAfterStale.snapshot.decision_state,anonymousSnapshot.decision_state);

  // Una operación de una sesión atrasada no modifica decisiones, reporte ni caja.
  const staleDecisions=await rpc(db,'guardar_decisiones_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compañía Ágil S.A.',p_nombre_comercial:'Café del Norte',
   p_ciclo:1,p_decisiones:decisionPayload,p_expected_revision:1
  });
  const staleReport=await rpc(db,'guardar_reporte_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compañía Ágil S.A.',p_nombre_comercial:'Café del Norte',
   p_ciclo:1,p_reporte:reportPayload,p_expected_revision:1
  });
  assert.equal(staleDecisions.code,'ESTADO_DESACTUALIZADO');
  assert.equal(staleReport.code,'ESTADO_DESACTUALIZADO');
  await db.exec('reset role');
  assert.deepEqual({
   caja:Number((await db.query('select caja_actual from empresas where id=$1',[first.empresa_id])).rows[0].caja_actual),
   decisiones:(await db.query('select count(*)::int total from empresas_decisiones where empresa_id=$1',[first.empresa_id])).rows[0].total,
   reportes:(await db.query('select count(*)::int total from reportes_ciclo where empresa_id=$1',[first.empresa_id])).rows[0].total
  },beforeOperational);

  // La revisión vigente sí habilita ambas operaciones dentro del contrato CAS.
  await db.exec('set role anon');
  const decisions=await rpc(db,'guardar_decisiones_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compañía Ágil S.A.',p_nombre_comercial:'Café del Norte',
   p_ciclo:1,p_decisiones:decisionPayload,p_expected_revision:2
  });
  assert.equal(decisions.success,true);
  const report=await rpc(db,'guardar_reporte_estudiante',{
   p_codigo:game.codigo,p_nombre_legal:'Compañía Ágil S.A.',p_nombre_comercial:'Café del Norte',
   p_ciclo:1,p_reporte:reportPayload,p_expected_revision:2
  });
  assert.equal(report.success,true);
  await db.exec('reset role');
  assert.equal(Number((await db.query('select caja_actual from empresas where id=$1',[first.empresa_id])).rows[0].caja_actual),87654);
  assert.equal((await db.query('select count(*)::int total from empresas_decisiones where empresa_id=$1',[first.empresa_id])).rows[0].total,beforeOperational.decisiones+1);
  assert.equal((await db.query('select count(*)::int total from reportes_ciclo where empresa_id=$1',[first.empresa_id])).rows[0].total,beforeOperational.reportes+1);

  await db.exec('set role anon');
  await assert.rejects(()=>rpc(db,'obtener_estado_juego',{p_empresa_id:first.empresa_id}),/permission denied/i);
  await assert.rejects(()=>rpc(db,'guardar_decisiones',{p_empresa_id:first.empresa_id,p_ciclo:1,p_decisiones:[]}),/permission denied/i);
  await assert.rejects(()=>rpc(db,'guardar_reporte',{p_empresa_id:first.empresa_id,p_ciclo:1,p_reporte:{caja_final:1}}),/permission denied/i);
  await assert.rejects(()=>rpc(db,'crear_empresa',{
   p_partida_id:anonymousGame.id,p_nombre_estudiante:'Intruso',p_nombre_legal:'Intruso',p_nombre_comercial:'Intruso'
  }),/permission denied/i);
  await assert.rejects(()=>rpc(db,'obtener_reporte_empresa',{p_empresa_id:first.empresa_id,p_ciclo:1}),/permission denied/i);
  await assert.rejects(()=>db.query('select * from empresas_decisiones where empresa_id=$1',[first.empresa_id]),/permission denied/i);
  await assert.rejects(()=>db.query('select * from reportes_ciclo where empresa_id=$1',[first.empresa_id]),/permission denied/i);
  await assert.rejects(()=>db.query(
   `insert into empresas(nombre_legal,nombre_comercial,caja_inicial,caja_actual,ciclo_actual) values('Intrusa','Intrusa',1,1,1)`
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `insert into participantes(partida_id,empresa_id,nombre,empresa) values($1,$2,'Intruso','Intruso')`,
   [game.id,first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `insert into empresas_decisiones(empresa_id,ciclo,decision_id,cantidad,costo_total,enviada) values($1,1,1,1,1,true)`,
   [first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `insert into reportes_ciclo(empresa_id,ciclo) values($1,2)`,[first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `update empresas set caja_actual=1 where id=$1`,[first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `update empresas_decisiones set costo_total=1 where empresa_id=$1`,[first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `update reportes_ciclo set caja_final=1 where empresa_id=$1`,[first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `update participantes set empresa='Intruso' where empresa_id=$1`,[first.empresa_id]
  ),/permission denied/i);
  await assert.rejects(()=>db.query(
   `update side_student_state set revision=99 where empresa_id=$1`,[first.empresa_id]
  ),/permission denied/i);

  // El panel docente puede leer solo empresas pertenecientes a sus partidas.
  await db.exec('set role authenticated');
  await db.query(`select set_config('test.uid',$1,false)`,['11111111-1111-1111-1111-111111111111']);
  const ownerReport=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:first.empresa_id,p_ciclo:1});
  assert.equal(ownerReport.empresa.id,first.empresa_id);
  assert.equal(ownerReport.reportes.length,1);
  assert.equal(ownerReport.decisiones.length,1);
  assert.equal((await db.query('select count(*)::int total from empresas_decisiones where empresa_id=$1',[first.empresa_id])).rows[0].total,1);
  assert.equal((await db.query('select count(*)::int total from reportes_ciclo where empresa_id=$1',[first.empresa_id])).rows[0].total,1);

  await db.query(`select set_config('test.uid',$1,false)`,['22222222-2222-2222-2222-222222222222']);
  const foreignReport=await rpc(db,'obtener_reporte_empresa',{p_empresa_id:first.empresa_id,p_ciclo:1});
  assert.equal(foreignReport.success,false);
  assert.equal(foreignReport.code,'ACCESO_DENEGADO');
  assert.equal(foreignReport.empresa,undefined);
  assert.equal(foreignReport.reportes,undefined);
  assert.equal(foreignReport.decisiones,undefined);
  assert.equal((await db.query('select count(*)::int total from empresas_decisiones where empresa_id=$1',[first.empresa_id])).rows[0].total,0);
  assert.equal((await db.query('select count(*)::int total from reportes_ciclo where empresa_id=$1',[first.empresa_id])).rows[0].total,0);
  await db.exec('reset role');

  console.log('PASS student admission: normalized identity, shared names, late rejection, CAS state, secure wrappers, denied legacy RPC/REST writes, no duplicates, race, demo and professor flow');
 }finally{await db.close();}
})().catch(error=>{console.error(error.message,error.stack);process.exitCode=1;});
