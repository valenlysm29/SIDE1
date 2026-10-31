'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('sorteo autoritativo persiste decisiones, probabilidades, desfases y permite cero eventos',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; create table public.side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo))");
  await db.exec(fs.readFileSync('supabase/migrations/20261031025358_desafios_autoritativos_v1.sql','utf8'));
  const seed='11111111-1111-1111-1111-111111111111';
  await db.exec(fs.readFileSync('supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql','utf8').replace('gen_random_uuid()',`'${seed}'::uuid`));
  const ids=['PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77'];
  const game=await createGame(db,config({cycles:6,economicEventsVersion:'demand-share-v1',enabledEvents:ids,eventRules:{}}));
  const companies=[];for(let i=0;i<30;i++)companies.push(String((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa '+i,p_nombre_comercial:'Marca '+i})).empresa_id));
  const draw=await rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:1});assert.equal(draw.reused,false);
  const probabilities={PE23:2,PE30:2,PE68:1,PE69:3,PE71:2,PE74:4,PE75:3,PE77:3},offset=new Set(['PE69','PE71','PE74','PE75']),expected=[];
  for(const companyId of companies)for(const eventId of ids){const roll=parseInt(crypto.createHash('md5').update(`${seed}:${companyId}:${eventId}`).digest('hex').slice(0,8),16)%10000;if(roll<probabilities[eventId]*100)expected.push(`${companyId}:${eventId}:${offset.has(eventId)?2:1}`);}
  assert.ok(expected.length>0);assert.deepEqual(draw.events.map(e=>`${e.companyId}:${e.eventId}:${e.round}`),expected);
  const again=await rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:1});assert.equal(again.reused,true);assert.deepEqual(again.events,draw.events);
  assert.equal(again.rosterChanged,false);await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Ingreso posterior',p_nombre_comercial:'Marca posterior'});assert.equal((await rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:1})).rosterChanged,true);
  for(const e of draw.events){assert.ok(ids.includes(e.eventId));assert.equal(e.round,['PE69','PE71','PE74','PE75'].includes(e.eventId)?2:1);}
  const history=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.equal(history.length,draw.events.length);
  await db.query("select set_config('test.uid',$1,false)",['22222222-2222-2222-2222-222222222222']);await assert.rejects(()=>rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:2}),/No autorizado/);
  await db.query("select set_config('test.uid',$1,false)",[professor]);
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{enabledEvents}','[]'::jsonb) where id=$1",[game.id]);
  const empty=await rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:2});assert.deepEqual(empty.events,[]);assert.equal((await rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:2})).reused,true);
  await db.query("update partidas set configuracion=jsonb_set(configuracion,'{runtime}', $2::jsonb) where id=$1",[game.id,{round:3,phase:'decisions'}]);
  await assert.rejects(()=>rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:3}),/ya no admite/);
  await db.query('insert into side_business_closures values($1,4,$2)',[game.id,{}]);
  await assert.rejects(()=>rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:4}),/Ciclo cerrado/);
 }finally{await db.close();}
});

test('sorteo forzado en base aislada llega a noticia privada, cierre e historial',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid); revoke all on schema side_private from public,anon,authenticated');
  await db.exec(fs.readFileSync('supabase/migrations/20261031030035_consulta_privada_desafios.sql','utf8'));
  const game=await createGame(db,config({cycles:6,capital:1000000,economicEventsVersion:'demand-share-v1',enabledEvents:['PE68'],eventRules:{}})),companies=[];
  const fixture=require('./economic_v19_fixture.cjs');
  for(let i=0;i<3;i++){const id=Number((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Legal '+i,p_nombre_comercial:'Marca '+i})).empresa_id);companies.push(id);const state=fixture.state(1,{},0);await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);}
  let seed;for(let i=0;i<100000;i++){const candidate=`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;const hit=id=>parseInt(crypto.createHash('md5').update(`${candidate}:${id}:PE68`).digest('hex').slice(0,8),16)%10000<100;if(hit(companies[0])&&!hit(companies[1])&&!hit(companies[2])){seed=candidate;break;}}assert.ok(seed);
  await db.exec(fs.readFileSync('supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql','utf8').replace('gen_random_uuid()',`'${seed}'::uuid`));
  const draw=await rpc(db,'side_draw_events_v1',{p_partida_id:game.id,p_source_cycle:1});assert.deepEqual(draw.events.map(e=>e.companyId),[String(companies[0])]);
  const student='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await db.query('insert into side_private.student_claims values($1,$2)',[companies[0],student]);await db.query("select set_config('test.uid',$1,false)",[student]);await db.exec('set role authenticated');
  assert.equal((await rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:companies[0]}))[0].eventId,'PE68');await assert.rejects(()=>rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:companies[1]}),/No autorizado/);await db.exec('reset role');
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  const run=()=>require('../services/business_runtime.cjs').runOnce(async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}});
  assert.equal((await run())[0].success,true);const close=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa;
  assert.equal(close[companies[0]].financial.flujoCaja.eventos,-1200);assert.deepEqual(close[companies[1]].receipt.events,[]);assert.equal((await run())[0].success,true);
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);await db.exec('set role authenticated');assert.equal((await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id}))[0].status,'aplicado');
 }finally{await db.close();}
});
