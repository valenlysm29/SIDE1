const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');

const INVALID='CREDENCIALES_INVALIDAS';
const STARTED='PARTIDA_INICIADA';
const root=path.resolve(__dirname,'..');

function admission(db,codigo,nombreLegal,nombreComercial){
 return rpc(db,'ingresar_empresa',{
  p_codigo:codigo,
  p_nombre_legal:nombreLegal,
  p_nombre_comercial:nombreComercial
 });
}

function control(db,game,accion,extra={}){
 return rpc(db,'controlar_partida',{
  p_partida_id:game.id,
  p_accion:accion,
  ...extra
 });
}

function assertBusinessRejection(result,code){
 assert.equal(result.success,false);
 assert.equal(result.code,code);
 assert.equal(result.empresa_id,undefined);
 assert.equal(result.participante_id,undefined);
 assert.equal(result.technical,undefined);
}

async function insertLegacy(db,game,legal,brand,cash=100000){
 const company=(await db.query(`
  insert into empresas(nombre_legal,nombre_comercial,caja_inicial,caja_actual,ciclo_actual)
  values($1,$2,100000,$3,1) returning id
 `,[legal,brand,cash])).rows[0];
 const participant=(await db.query(`
  insert into participantes(partida_id,empresa_id,nombre,empresa)
  values($1,$2,'Jugador',$3) returning id
 `,[game.id,company.id,brand])).rows[0];
 return {companyId:company.id,participantId:participant.id};
}

async function staleUniqueIndexUpgrade(){
 let seeded;
 const db=await database({beforeStudentAdmission:async legacyDb=>{
  // Reproduce una instalacion anterior: btrim ocurria antes de colapsar tabs,
  // por lo que tabs a izquierda/derecha producian tres claves distintas y el
  // indice unico podia existir. Con la normalizacion corregida todas son "acme".
  await legacyDb.exec(`
   create or replace function public.side_normalizar_ingreso(p_valor text)
   returns text language sql immutable parallel safe set search_path=public as $$
    select regexp_replace(
     translate(lower(btrim(coalesce(p_valor,''))),
      'áéíóúüñ' || chr(769) || chr(776) || chr(771),'aeiouun'),
     '[[:space:]]+',' ','g'
    )
   $$;
   alter table public.participantes add column if not exists nombre_legal_ingreso text;
   alter table public.participantes add column if not exists nombre_comercial_ingreso text;
  `);
  const game=await createGame(legacyDb,config());
  const first=await insertLegacy(legacyDb,game,'\tAcme\t','Marca');
  const second=await insertLegacy(legacyDb,game,'Acme','Marca');
  const third=await insertLegacy(legacyDb,game,'Acme\t','Marca');
  await legacyDb.query(`
   update participantes pt set
    nombre_legal_ingreso=e.nombre_legal,
    nombre_comercial_ingreso=e.nombre_comercial
   from empresas e where e.id=pt.empresa_id and pt.partida_id=$1
  `,[game.id]);
  await legacyDb.exec(`
   create unique index ux_side_identidad_ingreso
   on public.participantes(
    partida_id,
    public.side_normalizar_ingreso(nombre_legal_ingreso),
    public.side_normalizar_ingreso(nombre_comercial_ingreso)
   ) where empresa_id is not null
    and public.side_normalizar_ingreso(nombre_legal_ingreso) <> ''
      and public.side_normalizar_ingreso(nombre_comercial_ingreso) <> '';
   set enable_seqscan = off;
  `);
  seeded={game,first,second,third};
 }});
 try{
  assert.equal(
   (await db.query("select to_regclass('public.ux_side_identidad_ingreso') is null absent")).rows[0].absent,
   true
  );
  const survivorIds=(await db.query(
   'select id from participantes where partida_id=$1 order by id',[seeded.game.id]
  )).rows.map(row=>row.id).sort();
  assert.deepEqual(survivorIds,[
   seeded.first.participantId,
   seeded.second.participantId,
   seeded.third.participantId
  ].sort());
  assertBusinessRejection(await admission(db,seeded.game.codigo,'Acme','Marca'),INVALID);
 }finally{await db.close();}
}

async function legacyMatrix(){
 const seeded={};
 const db=await database({beforeStudentAdmission:async legacyDb=>{
  seeded.equalGame=await createGame(legacyDb,config());
  seeded.equal=await insertLegacy(legacyDb,seeded.equalGame,'Nexo Norte','Nexo Norte',91234);

  seeded.distinctGame=await createGame(legacyDb,config());
  seeded.distinct=await insertLegacy(legacyDb,seeded.distinctGame,'Textiles del Sur S.A.C.','Hilando',82345);

  seeded.longLegal='L'.repeat(61);
  seeded.longBrand='M'.repeat(41);
  seeded.longGame=await createGame(legacyDb,config());
  seeded.long=await insertLegacy(
   legacyDb,seeded.longGame,seeded.longLegal,seeded.longBrand,73456
  );

  seeded.nullLegalGame=await createGame(legacyDb,config());
  seeded.nullLegal=await insertLegacy(
   legacyDb,seeded.nullLegalGame,null,'Marca con legal nulo',64567
  );
  seeded.emptyLegalGame=await createGame(legacyDb,config());
  seeded.emptyLegal=await insertLegacy(
   legacyDb,seeded.emptyLegalGame,'','Marca con legal vacío',65678
  );

  seeded.collisionGame=await createGame(legacyDb,config());
  seeded.collisionA=await insertLegacy(legacyDb,seeded.collisionGame,'Órbita  SAC','Marca Ñ');
  seeded.collisionB=await insertLegacy(legacyDb,seeded.collisionGame,'orbita sac','MARCA N');
 }});
 try{
  // [13] El backfill usa los nombres reales, tanto si son iguales como distintos.
  for(const expected of [
   {...seeded.equal,legal:'Nexo Norte',brand:'Nexo Norte'},
   {...seeded.distinct,legal:'Textiles del Sur S.A.C.',brand:'Hilando'}
  ]){
   const row=(await db.query(`
    select nombre_legal_ingreso,nombre_comercial_ingreso
    from participantes where id=$1
   `,[expected.participantId])).rows[0];
   assert.deepEqual(row,{
    nombre_legal_ingreso:expected.legal,
    nombre_comercial_ingreso:expected.brand
   });
  }
  await control(db,seeded.equalGame,'iniciar');
  await control(db,seeded.distinctGame,'iniciar');
  await control(db,seeded.longGame,'iniciar');
  await control(db,seeded.nullLegalGame,'iniciar');
  await control(db,seeded.emptyLegalGame,'iniciar');
  const equalReentry=await admission(db,seeded.equalGame.codigo,' nexo   norte ','NEXO NORTE');
  const distinctReentry=await admission(db,seeded.distinctGame.codigo,'textiles del sur s.a.c.','HILANDO');
  assert.equal(equalReentry.empresa_id,seeded.equal.companyId);
  assert.equal(distinctReentry.empresa_id,seeded.distinct.companyId);
  // Los límites aplican únicamente a altas nuevas. Un registro histórico ya
  // identificado por la terna completa sigue pudiendo recuperar su progreso.
  const longReentry=await admission(
   db,seeded.longGame.codigo,seeded.longLegal,seeded.longBrand
  );
  assert.equal(longReentry.success,true);
  assert.equal(longReentry.reingreso,true);
  assert.equal(longReentry.empresa_id,seeded.long.companyId);
  assert.equal(longReentry.participante_id,seeded.long.participantId);
  assert.equal(Number(longReentry.empresa.caja_actual),73456);

  // Una identidad histórica incompleta nunca se convierte en una terna válida
  // usando whitespace. No se asigna el progreso de la marca conocida.
  for(const legacyMissingLegal of [
   {game:seeded.nullLegalGame,brand:'Marca con legal nulo'},
   {game:seeded.emptyLegalGame,brand:'Marca con legal vacío'}
  ]){
   const countBefore=(await db.query(
    'select count(*)::int total from participantes where partida_id=$1',
    [legacyMissingLegal.game.id]
   )).rows[0].total;
   const rejected=await admission(
    db,legacyMissingLegal.game.codigo,' \t\r\n ',legacyMissingLegal.brand
   );
   assertBusinessRejection(rejected,INVALID);
   assert.equal((await db.query(
    'select count(*)::int total from participantes where partida_id=$1',
    [legacyMissingLegal.game.id]
   )).rows[0].total,countBefore);
  }

  // [14] Dos filas legacy que colisionan se conservan, pero nunca se elige una
  // de forma arbitraria. La respuesta es el mismo rechazo opaco de credenciales.
  const collision=await admission(db,seeded.collisionGame.codigo,'orbita sac','marca n');
  assertBusinessRejection(collision,INVALID);
  assert.equal((await db.query(
   'select count(*)::int total from participantes where partida_id=$1',
   [seeded.collisionGame.id]
  )).rows[0].total,2);

  // [15] La instalación ya ejecutó la migración dos veces. Una ejecución
  // adicional tampoco duplica estados ni modifica identidades o progreso.
  const savedLegacyState=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:seeded.distinctGame.codigo,
   p_nombre_legal:'Textiles del Sur S.A.C.',
   p_nombre_comercial:'Hilando',
   p_snapshot:{decision_state:{PRECIO:{round:1,value:31}},cash_ledger:{'1:PRECIO':-310}},
   p_expected_revision:0
  });
  assert.equal(savedLegacyState.success,true);
  const decisionId=(await db.query(
   'select id from decisiones_catalogo where activo=true order by id limit 1'
  )).rows[0].id;
  await db.query(`
   insert into empresas_decisiones(empresa_id,ciclo,decision_id,cantidad,costo_total,enviada)
   values($1,1,$2,2,310,true)
  `,[seeded.distinct.companyId,decisionId]);
  await db.query(`
   insert into reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final)
   values($1,1,100000,900,310,590,82345)
  `,[seeded.distinct.companyId]);
  const readMigrationState=async()=>({
   identities:(await db.query(`
    select pt.id,pt.empresa_id,pt.nombre_legal_ingreso,pt.nombre_comercial_ingreso,
           e.caja_actual,coalesce(s.revision,0) revision
    from participantes pt
    join empresas e on e.id=pt.empresa_id
    left join side_student_state s on s.empresa_id=e.id
    order by pt.id
   `)).rows,
   snapshot:(await db.query(
    'select snapshot,revision from side_student_state where empresa_id=$1',
    [seeded.distinct.companyId]
   )).rows[0],
   counts:(await db.query(`
    select
     (select count(*)::int from side_student_state) estados,
     (select count(*)::int from empresas_decisiones) decisiones,
     (select count(*)::int from reportes_ciclo) reportes
   `)).rows[0]
  });
  const before=await readMigrationState();
  const migration=fs.readFileSync(path.join(root,'docs/supabase_student_admission.sql'),'utf8');
  await db.exec(migration);
  const after=await readMigrationState();
  assert.deepEqual(after,before);
 }finally{await db.close();}
}

async function phaseMatrix(db){
 // [1] Cualquier empresa nueva puede registrarse durante integration.
 const game=await createGame(db,config({capital:147500,cycles:3}));
 const initial=await admission(db,game.codigo,'Comercial Andina S.A.C.','Puna Azul');
 assert.equal(initial.success,true);
 assert.equal(initial.reingreso,false);
 assert.equal(Number(initial.empresa.caja_actual),147500);

 // [2] decisions/results de ciclos 1, 2 y 3 nunca admiten altas nuevas.
 let state=await control(db,game,'iniciar');
 for(let round=1;round<=3;round++){
  assert.equal(state.configuracion.runtime.phase,'decisions');
  assert.equal(Number(state.configuracion.runtime.round),round);
  assertBusinessRejection(
   await admission(db,game.codigo,`Empresa Nueva Decisiones ${round}`,`Marca D${round}`),
   STARTED
  );
  state=await control(db,game,'cerrar',{p_expected_round:round});
  assert.equal(state.configuracion.runtime.phase,'results');
  assertBusinessRejection(
   await admission(db,game.codigo,`Empresa Nueva Resultados ${round}`,`Marca R${round}`),
   STARTED
  );
  if(round<3)state=await control(db,game,'avanzar',{p_expected_round:round});
 }

 // [4] Al finalizar no hay alta nueva. La recuperación exacta sigue siendo
 // segura y no representa una alta ni crea filas.
  state=await control(db,game,'avanzar',{p_expected_round:3});
  assert.equal(state.estado,'finalizada');
  assert.equal(state.configuracion.runtime.phase,'finished');
  const finishedCountBefore=(await db.query(
   'select count(*)::int total from participantes where partida_id=$1',[game.id]
  )).rows[0].total;
  assertBusinessRejection(await admission(db,game.codigo,'Empresa Post Final','Post Final'),STARTED);
 const finishedReentry=await admission(db,game.codigo,'Comercial Andina S.A.C.','Puna Azul');
 assert.equal(finishedReentry.success,true);
  assert.equal(finishedReentry.reingreso,true);
  assert.equal(finishedReentry.empresa_id,initial.empresa_id);
  assert.equal((await db.query(
   'select count(*)::int total from participantes where partida_id=$1',[game.id]
  )).rows[0].total,finishedCountBefore);

  const cancelled=await createGame(db);
  const beforeCancel=await admission(db,cancelled.codigo,'Empresa Persistente','Persistente');
  const cancelledCountBefore=(await db.query(
   'select count(*)::int total from participantes where partida_id=$1',[cancelled.id]
  )).rows[0].total;
  await control(db,cancelled,'cancelar');
  assertBusinessRejection(await admission(db,cancelled.codigo,'Empresa Post Cierre','Post Cierre'),STARTED);
  const cancelledReentry=await admission(db,cancelled.codigo,'Empresa Persistente','Persistente');
  assert.equal(cancelledReentry.success,true);
  assert.equal(cancelledReentry.reingreso,true);
  assert.equal(cancelledReentry.empresa_id,beforeCancel.empresa_id);
  assert.equal((await db.query(
   'select count(*)::int total from participantes where partida_id=$1',[cancelled.id]
  )).rows[0].total,cancelledCountBefore);
}

async function identityMatrix(db){
 const game=await createGame(db,config({capital:160000,cycles:3}));
 const equal=await admission(db,game.codigo,'Sol y Mar','Sol y Mar');
 const distinct=await admission(db,game.codigo,'Grupo Boreal S.A.C.','Boreal');
 assert.equal(equal.success,true);
 assert.equal(distinct.success,true);

 const snapshot={
  decision_state:{PRECIO:{round:1,value:77,cost:700}},
  cash_ledger:{'1:PRECIO':-700},
  financial_sections:{produccion:{total:11}},
  section_submissions:{produccion:true},
  decisions_submitted:true,
  selected_character:'chico1'
 };
 await db.query('update empresas set caja_actual=123456,ciclo_actual=2 where id=$1',[distinct.empresa_id]);
 const saved=await rpc(db,'guardar_estado_estudiante',{
  p_codigo:game.codigo,p_nombre_legal:'Grupo Boreal S.A.C.',p_nombre_comercial:'Boreal',
  p_snapshot:snapshot,p_expected_revision:0
 });
 assert.equal(saved.success,true);
 await control(db,game,'iniciar');
 await control(db,game,'cerrar',{p_expected_round:1});
 await control(db,game,'avanzar',{p_expected_round:1});

 // [5,8,9] La terna normalizada recupera IDs, caja, ciclo y decisiones para
  // nombres iguales o distintos. Puntuación y guiones no se eliminan.
  const restored=await admission(db,`  ${game.codigo.toLowerCase()}  `,'  GRUPO   BOREAL S.A.C. ',' boreal ');
  assert.equal(restored.success,true);
  assert.equal(restored.reingreso,true);
 assert.equal(restored.empresa_id,distinct.empresa_id);
 assert.equal(restored.participante_id,distinct.participante_id);
 assert.equal(Number(restored.empresa.caja_actual),123456);
 assert.equal(Number(restored.ciclo_partida),2);
  assert.deepEqual(restored.snapshot.decision_state,snapshot.decision_state);
  assert.deepEqual(restored.snapshot.cash_ledger,snapshot.cash_ledger);
  assert.equal(Number(restored.snapshot_revision),1);
 const equalRestored=await admission(db,game.codigo,' SOL Y  MAR ','sol y mar');
 assert.equal(equalRestored.empresa_id,equal.empresa_id);

 // [6] El código erróneo produce rechazo genérico. Con código válido y una
 // partida iniciada, legal/comercial erróneos comparten el oráculo uniforme de
 // partida iniciada con cualquier alta nueva. No hay IDs ni dato sensible.
 const wrongCode=await admission(db,'SIDE-999999','Grupo Boreal S.A.C.','Boreal');
 assertBusinessRejection(wrongCode,INVALID);
 const startedOracle=[];
 for(const fields of [
  [game.codigo,'Grupo Boreal INCORRECTA','Boreal'],
  [game.codigo,'Grupo Boreal S.A.C.','Boreal INCORRECTA'],
  [game.codigo,'Empresa Totalmente Nueva','Marca Totalmente Nueva']
 ]){
  const result=await admission(db,...fields);
  assertBusinessRejection(result,STARTED);
  startedOracle.push(result);
 }
 assert.deepEqual(startedOracle,[startedOracle[0],startedOracle[0],startedOracle[0]]);

 // [7] Intercambiar legal y comercial jamás autentica ni asigna una empresa.
 assertBusinessRejection(await admission(db,game.codigo,'Boreal','Grupo Boreal S.A.C.'),STARTED);

 // [8] Tildes, eñe, caja, espacios y variante del código sí normalizan.
 const accentsGame=await createGame(db);
 const accents=await admission(db,accentsGame.codigo,'  Peña   Muñoz Ágil  ','  Café-Ñandú  ');
 await control(db,accentsGame,'iniciar');
 const normalized=await admission(
  db,` ${accentsGame.codigo.toLowerCase()} `,'PENA MUNOZ AGIL','cafe-nandu'
 );
 assert.equal(normalized.empresa_id,accents.empresa_id);

 // [10] Una marca compartida en la misma partida se desambigua por el legal.
 const sharedGame=await createGame(db);
 const sharedA=await admission(db,sharedGame.codigo,'Inversiones Alba','Mercado Uno');
 const sharedB=await admission(db,sharedGame.codigo,'Inversiones Brisa','Mercado Uno');
 await control(db,sharedGame,'iniciar');
 assert.equal((await admission(db,sharedGame.codigo,'Inversiones Alba','Mercado Uno')).empresa_id,sharedA.empresa_id);
 assert.equal((await admission(db,sharedGame.codigo,'Inversiones Brisa','Mercado Uno')).empresa_id,sharedB.empresa_id);
 assert.notEqual(sharedA.empresa_id,sharedB.empresa_id);

 // [11] La misma identidad en partidas diferentes nunca cruza progreso.
 const otherGame=await createGame(db);
  const other=await admission(db,otherGame.codigo,'Grupo Boreal S.A.C.','Boreal');
  await db.query('update empresas set caja_actual=44444 where id=$1',[other.empresa_id]);
  const otherSaved=await rpc(db,'guardar_estado_estudiante',{
   p_codigo:otherGame.codigo,p_nombre_legal:'Grupo Boreal S.A.C.',p_nombre_comercial:'Boreal',
   p_snapshot:{decision_state:{PRECIO:{round:1,value:22}},cash_ledger:{'1:PRECIO':-220}},
   p_expected_revision:0
  });
  assert.equal(otherSaved.success,true);
 await control(db,otherGame,'iniciar');
 const otherRestored=await admission(db,otherGame.codigo,'Grupo Boreal S.A.C.','Boreal');
 assert.equal(otherRestored.empresa_id,other.empresa_id);
  assert.equal(Number(otherRestored.empresa.caja_actual),44444);
  assert.notEqual(otherRestored.empresa_id,distinct.empresa_id);
  assert.equal(otherRestored.snapshot.decision_state.PRECIO.value,22);
  assert.equal(Number(otherRestored.snapshot_revision),1);
  const originalAgain=await admission(db,game.codigo,'Grupo Boreal S.A.C.','Boreal');
  assert.equal(originalAgain.empresa_id,distinct.empresa_id);
  assert.equal(Number(originalAgain.empresa.caja_actual),123456);
  assert.equal(originalAgain.snapshot.decision_state.PRECIO.value,77);
  assert.equal(Number(originalAgain.snapshot_revision),1);
  const otherAgain=await admission(db,otherGame.codigo,'Grupo Boreal S.A.C.','Boreal');
  assert.equal(otherAgain.empresa_id,other.empresa_id);
  assert.equal(Number(otherAgain.empresa.caja_actual),44444);
  assert.equal(otherAgain.snapshot.decision_state.PRECIO.value,22);

 // [12] La normalización no borra puntuación: ambos nombres parecidos son IDs
 // distintos y cada terna exacta vuelve a su propia empresa.
 const similarGame=await createGame(db);
 const similarA=await admission(db,similarGame.codigo,'Andina SAC','Andina Uno');
 const similarB=await admission(db,similarGame.codigo,'Andina S.A.C.','Andina Uno');
 await control(db,similarGame,'iniciar');
 assert.equal((await admission(db,similarGame.codigo,'Andina SAC','Andina Uno')).empresa_id,similarA.empresa_id);
 assert.equal((await admission(db,similarGame.codigo,'Andina S.A.C.','Andina Uno')).empresa_id,similarB.empresa_id);
 assert.notEqual(similarA.empresa_id,similarB.empresa_id);
}

async function robustnessMatrix(db){
 // [16] Entradas vacías y hostiles terminan como rechazos de negocio, nunca
 // como excepción SQL/técnica. Se prueban tras el inicio para que tampoco
 // puedan crear una empresa con cadenas que el formulario no permite.
 const game=await createGame(db);
 await control(db,game,'iniciar');
 const hostile=[
  {fields:['', 'Legal', 'Marca'],code:INVALID},
  {fields:[game.codigo, '   ', 'Marca'],code:INVALID},
  // Una terna incompleta se rechaza antes del lookup incluso si la partida ya
  // inició; así tampoco autentica identidades legacy NULL/vacías.
  {fields:[game.codigo, 'Legal', '\t\r\n'],code:INVALID},
  {fields:['x'.repeat(5000), 'Legal', 'Marca'],code:INVALID},
  {fields:[game.codigo, 'L'.repeat(10000), 'M'.repeat(10000)],code:STARTED},
  {fields:[game.codigo, `O'Reilly % _ ; --`, `Marca "doble"`],code:STARTED},
  {fields:[game.codigo, `'; drop table empresas; --`, `%_'; select pg_sleep(10); --`],code:STARTED}
 ];
 for(const attempt of hostile){
  const result=await admission(db,...attempt.fields);
  assertBusinessRejection(result,attempt.code);
 }
 assert.equal((await db.query('select count(*)::int total from participantes where partida_id=$1',[game.id])).rows[0].total,0);
 assert.equal((await db.query("select to_regclass('public.empresas') is not null intact")).rows[0].intact,true);

 // [3,17] La fila de partida serializa la carrera alta/inicio. Dos sesiones
 // válidas comparten IDs y CAS impide que la escritura atrasada sobrescriba.
 const racing=await createGame(db);
 const [startResult,joinResult]=await Promise.all([
  control(db,racing,'iniciar'),
  admission(db,racing.codigo,'Empresa Carrera General','Carrera General')
 ]);
 assert.equal(startResult.configuracion.runtime.phase,'decisions');
 const raceCount=(await db.query(
  'select count(*)::int total from participantes where partida_id=$1',[racing.id]
 )).rows[0].total;
 if(joinResult.success){
  assert.equal(joinResult.reingreso,false);
  assert.ok(joinResult.empresa_id);
  assert.ok(joinResult.participante_id);
  assert.equal(raceCount,1);
 }else{
  assertBusinessRejection(joinResult,STARTED);
  assert.equal(raceCount,0);
 }

 const sessionGame=await createGame(db);
 const session=await admission(db,sessionGame.codigo,'Sesiones Paralelas S.A.C.','Paralelas');
 const simultaneous=await Promise.all([
  admission(db,sessionGame.codigo,'Sesiones Paralelas S.A.C.','Paralelas'),
  admission(db,sessionGame.codigo,'SESIONES PARALELAS S.A.C.','PARALELAS')
 ]);
 assert.ok(simultaneous.every(value=>value.empresa_id===session.empresa_id));
 assert.equal((await db.query(
  'select count(*)::int total from participantes where partida_id=$1',[sessionGame.id]
 )).rows[0].total,1);
 const identity={
  p_codigo:sessionGame.codigo,
  p_nombre_legal:'Sesiones Paralelas S.A.C.',
  p_nombre_comercial:'Paralelas'
 };
 const competingSnapshots=[
  {decision_state:{PRECIO:{value:1}}},
  {decision_state:{PRECIO:{value:999}}}
 ];
 const writes=await Promise.all(competingSnapshots.map(p_snapshot=>
  rpc(db,'guardar_estado_estudiante',{...identity,p_snapshot,p_expected_revision:0})
 ));
 const winners=writes.map((result,index)=>({result,index})).filter(entry=>entry.result.success);
 const stale=writes.filter(result=>result.code==='ESTADO_DESACTUALIZADO');
 assert.equal(winners.length,1);
 assert.equal(stale.length,1);
 assert.equal(Number(winners[0].result.snapshot_revision),1);
  const state=await rpc(db,'obtener_estado_estudiante',identity);
 assert.equal(
  state.snapshot.decision_state.PRECIO.value,
  competingSnapshots[winners[0].index].decision_state.PRECIO.value
 );
}

async function deploymentContract(db){
 // [18,19] Regresión general de despliegue para el fallo observado en SIDE-009:
 // no usa su partida ni su empresa; reproduce el contrato ausente que causó
 // PGRST202/PGRST205/42703 para cualquier código y cualquier terna.
 const columns=(await db.query(`
  select table_name,column_name
  from information_schema.columns
  where table_schema='public' and (
    (table_name='partidas' and column_name='started_at') or
    (table_name='participantes' and column_name in ('nombre_legal_ingreso','nombre_comercial_ingreso')) or
    (table_name='side_student_state' and column_name in ('empresa_id','snapshot','revision'))
  )
  order by table_name,column_name
 `)).rows.map(row=>`${row.table_name}.${row.column_name}`);
 assert.deepEqual(columns,[
  'participantes.nombre_comercial_ingreso',
  'participantes.nombre_legal_ingreso',
  'partidas.started_at',
  'side_student_state.empresa_id',
  'side_student_state.revision',
  'side_student_state.snapshot'
 ]);
 const signatures=(await db.query(`
  select
   to_regprocedure('public.side_normalizar_ingreso(text)') is not null normalizar,
   to_regprocedure('public.ingresar_empresa(text,text,text)') is not null ingresar,
   to_regprocedure('public.obtener_estado_estudiante(text,text,text)') is not null estado,
   to_regprocedure('public.guardar_estado_estudiante(text,text,text,jsonb,bigint)') is not null guardar,
   to_regprocedure('public.guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint)') is not null decisiones,
   to_regprocedure('public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)') is not null reporte,
   has_function_privilege('anon','public.ingresar_empresa(text,text,text)','EXECUTE') anon_ingresar,
   has_function_privilege('anon','public.obtener_estado_estudiante(text,text,text)','EXECUTE') anon_estado,
   has_function_privilege('anon','public.guardar_estado_estudiante(text,text,text,jsonb,bigint)','EXECUTE') anon_guardar,
   has_function_privilege('anon','public.guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint)','EXECUTE') anon_decisiones,
   has_function_privilege('anon','public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)','EXECUTE') anon_reporte,
   has_function_privilege('authenticated','public.ingresar_empresa(text,text,text)','EXECUTE') auth_ingresar,
   has_function_privilege('authenticated','public.obtener_estado_estudiante(text,text,text)','EXECUTE') auth_estado,
   has_function_privilege('authenticated','public.guardar_estado_estudiante(text,text,text,jsonb,bigint)','EXECUTE') auth_guardar,
   has_function_privilege('authenticated','public.guardar_decisiones_estudiante(text,text,text,integer,jsonb,bigint)','EXECUTE') auth_decisiones,
   has_function_privilege('authenticated','public.guardar_reporte_estudiante(text,text,text,integer,jsonb,bigint)','EXECUTE') auth_reporte,
   has_function_privilege('anon','public.crear_empresa(uuid,text,text,text,numeric)','EXECUTE') anon_crear_legacy,
   has_function_privilege('authenticated','public.crear_empresa(uuid,text,text,text,numeric)','EXECUTE') auth_crear_legacy,
   has_function_privilege('anon','public.obtener_estado_juego(bigint)','EXECUTE') anon_estado_legacy,
   has_function_privilege('anon','public.guardar_decisiones(bigint,integer,jsonb)','EXECUTE') anon_decisiones_legacy,
   has_function_privilege('anon','public.guardar_reporte(bigint,integer,jsonb)','EXECUTE') anon_reporte_legacy,
   has_function_privilege('authenticated','public.obtener_estado_juego(bigint)','EXECUTE') auth_estado_legacy,
   has_function_privilege('authenticated','public.guardar_decisiones(bigint,integer,jsonb)','EXECUTE') auth_decisiones_legacy,
   has_function_privilege('authenticated','public.guardar_reporte(bigint,integer,jsonb)','EXECUTE') auth_reporte_legacy,
   has_table_privilege('anon','public.empresas','INSERT') anon_insert_empresas,
   has_table_privilege('authenticated','public.empresas','INSERT') auth_insert_empresas,
   has_table_privilege('anon','public.participantes','INSERT') anon_insert_participantes,
   has_table_privilege('authenticated','public.participantes','INSERT') auth_insert_participantes,
   has_table_privilege('anon','public.empresas_decisiones','INSERT,UPDATE') anon_write_decisiones,
   has_table_privilege('authenticated','public.empresas_decisiones','INSERT,UPDATE') auth_write_decisiones,
   has_table_privilege('anon','public.reportes_ciclo','INSERT,UPDATE') anon_write_reportes,
   has_table_privilege('authenticated','public.reportes_ciclo','INSERT,UPDATE') auth_write_reportes
 `)).rows[0];
 assert.deepEqual(signatures,{
  normalizar:true,
  ingresar:true,
  estado:true,
  guardar:true,
  decisiones:true,
  reporte:true,
  anon_ingresar:true,
  anon_estado:true,
  anon_guardar:true,
  anon_decisiones:true,
  anon_reporte:true,
  auth_ingresar:true,
  auth_estado:true,
  auth_guardar:true,
  auth_decisiones:true,
  auth_reporte:true,
  anon_crear_legacy:false,
  auth_crear_legacy:false,
  anon_estado_legacy:false,
  anon_decisiones_legacy:false,
  anon_reporte_legacy:false,
  auth_estado_legacy:false,
  auth_decisiones_legacy:false,
  auth_reporte_legacy:false,
  anon_insert_empresas:false,
  auth_insert_empresas:false,
  anon_insert_participantes:false,
  auth_insert_participantes:false,
  anon_write_decisiones:false,
  auth_write_decisiones:false,
  anon_write_reportes:false,
  auth_write_reportes:false
 });
}

(async()=>{
 await staleUniqueIndexUpgrade();
 await legacyMatrix();
 const db=await database();
 try{
  await deploymentContract(db);
  await phaseMatrix(db);
  await identityMatrix(db);
  await robustnessMatrix(db);
  console.log('PASS student admission matrix DB: cases 1-19 with real repeatable migration');
 }finally{await db.close();}
})().catch(error=>{
 console.error(error.message,error.stack);
 process.exitCode=1;
});
