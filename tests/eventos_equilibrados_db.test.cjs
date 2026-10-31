'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('programación experimental rota tres desafíos durante seis ciclos y respeta permisos y reintentos',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz; create table public.side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo))");
  for(const name of ['20261031025358_desafios_autoritativos_v1','20261031043153_programacion_desafios_autoritativa','20261031050037_eventos_grupales_mercado_v1','20261031055001_mercado_global_escenarios_v2','20261031055442_eventos_productivos_v2','20261031060031_eventos_atractivo_duracion_v2','20261031060810_proteger_programacion_desafios','20261031144757_programacion_equilibrada_v2'])await db.exec(fs.readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
  const game=await createGame(db,config({cycles:6,economicEventsVersion:'demand-share-v1',enabledEvents:['PE69','PE71','PE75']})),ids=[];
  for(let i=0;i<3;i++)ids.push(String((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa '+i,p_nombre_comercial:'Marca '+i})).empresa_id));
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{enabledEvents}','[\"PE69\"]'::jsonb) where id=$1",[game.id]);
  await assert.rejects(()=>rpc(db,'side_schedule_balanced_v1',{p_partida_id:game.id,p_ciclo:1}),/Habilita/);
  assert.equal(Number((await db.query('select count(*) n from side_event_assignments_v1')).rows[0].n),0);
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{enabledEvents}','[\"PE69\",\"PE71\",\"PE75\"]'::jsonb) where id=$1",[game.id]);
  const byCompany=Object.fromEntries(ids.map(id=>[id,[]]));
  for(let round=1;round<=6;round++){
   const args={p_partida_id:game.id,p_ciclo:round};const first=await rpc(db,'side_schedule_balanced_v1',args);assert.equal(first.reused,false);assert.equal(new Set(first.events.map(e=>e.eventId)).size,3);
   for(const e of first.events){assert.equal(e.intensity,round<=2?2:round<=4?4:6);byCompany[e.companyId].push(e);}
   const retry=await rpc(db,'side_schedule_balanced_v1',args);assert.equal(retry.reused,true);assert.deepEqual(retry.events,first.events);
  }
  for(const events of Object.values(byCompany))for(const id of ['PE69','PE71','PE75']){const matches=events.filter(e=>e.eventId===id);assert.equal(matches.length,2);assert.equal(matches.reduce((sum,e)=>sum+e.intensity,0),8);}
  assert.equal(Number((await db.query('select count(*) n from side_event_assignments_v1')).rows[0].n),18);
  await db.query("select set_config('test.uid',$1,false)",['22222222-2222-2222-2222-222222222222']);await assert.rejects(()=>rpc(db,'side_schedule_balanced_v1',{p_partida_id:game.id,p_ciclo:1}),/No autorizado/);
  await db.query("select set_config('test.uid',$1,false)",[professor]);
 }finally{await db.close();}
});
test('rotación programada llega a noticias privadas, cierre e historial de las tres empresas',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid)');
  for(const n of ['20261031030035_consulta_privada_desafios','20261031043153_programacion_desafios_autoritativa','20261031050037_eventos_grupales_mercado_v1','20261031055001_mercado_global_escenarios_v2','20261031055442_eventos_productivos_v2','20261031060031_eventos_atractivo_duracion_v2','20261031060810_proteger_programacion_desafios','20261031144757_programacion_equilibrada_v2'])await db.exec(fs.readFileSync(`supabase/migrations/${n}.sql`,'utf8'));
  const game=await createGame(db,config({cycles:6,capital:1000000,economicEventsVersion:'demand-share-v1',enabledEvents:['PE69','PE71','PE75']})),ids=[];
  for(let i=0;i<3;i++)ids.push(Number((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa '+i,p_nombre_comercial:'Marca '+i})).empresa_id));
  const scheduled=await rpc(db,'side_schedule_balanced_v1',{p_partida_id:game.id,p_ciclo:1});
  const student='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await db.query('insert into side_private.student_claims values($1,$2)',[ids[0],student]);await db.query("select set_config('test.uid',$1,false)",[student]);await db.exec('set role authenticated');
  const news=await rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[0]});assert.equal(news[0].eventId,scheduled.events.find(e=>e.companyId===String(ids[0])).eventId);await assert.rejects(()=>rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[1]}),/No autorizado/);await db.exec('reset role');
  const fixture=require('./economic_v19_fixture.cjs');for(const id of ids){const state=fixture.state(1,{},0);await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);}
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}};
  const run=()=>require('../services/business_runtime.cjs').runOnce(call);assert.equal((await run())[0].success,true);
  const close=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa;
  for(const id of ids){const expected=scheduled.events.find(e=>e.companyId===String(id));assert.equal(close[id].receipt.events[0].id,expected.eventId);assert.equal(close[id].receipt.events[0].intensity,2);assert.equal(close[id].financial.balanceGeneral.activos,close[id].financial.balanceGeneral.pasivoPatrimonio);}
  assert.equal((await run())[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa,close);
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);await db.exec('set role authenticated');const history=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.equal(history.length,3);assert.ok(history.every(e=>e.status==='aplicado'));
 }finally{await db.close();}
});
