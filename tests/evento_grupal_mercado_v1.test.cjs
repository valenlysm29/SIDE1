'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const {runOnce}=require('../services/business_runtime.cjs'),fixture=require('./economic_v19_fixture.cjs');
const crypto=require('node:crypto');
const sql=f=>fs.readFileSync(f,'utf8');
for(const [eventId,intensity] of [['PE01',10],['PE02',15],['PE03',25],['PE04',30],['PE17',10],['PE18',10]])test(`${eventId}: mercado grupal, noticia privada y cierre único`,async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(sql(f));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid); revoke all on schema side_private from public,anon,authenticated');
  await db.exec(sql('supabase/migrations/20261031030035_consulta_privada_desafios.sql'));await db.exec(sql('supabase/migrations/20261031050037_eventos_grupales_mercado_v1.sql'));
  await db.exec(sql('supabase/migrations/20261031055001_mercado_global_escenarios_v2.sql'));
  const game=await createGame(db,config({cycles:6,capital:1000000,economicEventsVersion:'demand-share-v1'})),ids=[],states=[];
  for(let i=0;i<3;i++){
   const id=Number((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Legal '+i,p_nombre_comercial:'Marca '+i})).empresa_id);ids.push(id);
   const state=fixture.state(1,{},0);for(const [key,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_ind'],['ACABADOS','aca_ind'],['PERS_CORTE','corte_maestro'],['PERS_ENSAMBLE','ens_personal_esp'],['PERS_ACABADO','aca_personal_art']]){state[key].quantities={[opt]:10};if(state[key].purchases)state[key].purchases={1:{[opt]:10}};}
   state.CUERO.quantities={cuero_prem:900};state.ACCESORIOS.quantities={acc_prem:3000};state.HILO.quantities={hilo_prem:18000};state.PRODUCCION_META.moldTargets={molde_1:3000,molde_2:0,molde_3:0};
   states.push(state);
  }
  const args={p_partida_id:game.id,p_ciclo:1,p_event_id:eventId,p_intensity:intensity},assigned=await rpc(db,'side_assign_group_event_v1',args);assert.equal(assigned.companyCount,3);assert.equal((await rpc(db,'side_assign_group_event_v1',args)).reused,true);
  for(const [index,id] of ids.entries())await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state:states[index]}}}}]);
  await assert.rejects(()=>rpc(db,'side_assign_group_event_v1',{...args,p_intensity:intensity+1}),/inválida/);
  await db.query("select set_config('test.uid',$1,false)",['22222222-2222-2222-2222-222222222222']);await assert.rejects(()=>rpc(db,'side_assign_group_event_v1',args),/No autorizado/);
  const student='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await db.query('insert into side_private.student_claims values($1,$2)',[ids[0],student]);await db.query("select set_config('test.uid',$1,false)",[student]);await db.exec('set role authenticated');
  assert.equal((await rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[0]}))[0].eventId,eventId);await assert.rejects(()=>rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[1]}),/No autorizado/);await db.exec('reset role');
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args)}}catch(e){return {error:{message:e.message}}}};
  assert.equal((await runOnce(call))[0].success,true);const results=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa;
  const total=ids.reduce((sum,id)=>sum+results[id].receipt.marketAllocation.products.esencial.asignado,0);assert.equal(total,Math.round(3500*(1+(eventId==='PE17'?-1:1)*intensity/100)));
  for(const id of ids){const r=results[id];assert.equal(r.receipt.events[0].id,eventId);for(const sale of r.receipt.sales)assert.ok(sale.sold<=sale.available);assert.equal(r.financial.balanceGeneral.activos,r.financial.balanceGeneral.pasivoPatrimonio);}
  assert.equal((await runOnce(call))[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa,results);
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);await db.exec('set role authenticated');const history=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.equal(history.length,3);assert.ok(history.every(row=>row.status==='aplicado'));
 }finally{await db.close();}
});

test('sorteo grupal ocurre una vez por partida y se recupera sin repetir',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz; create table public.side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo))");
  await db.exec(sql('supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'));await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid)');await db.exec(sql('supabase/migrations/20261031030035_consulta_privada_desafios.sql'));await db.exec(sql('supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql'));
  let seed;for(let i=0;i<100000;i++){const candidate=`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;if(parseInt(crypto.createHash('md5').update(`${candidate}:PE01`).digest('hex').slice(0,8),16)%10000<200){seed=candidate;break;}}assert.ok(seed);
  await db.exec(sql('supabase/migrations/20261031050037_eventos_grupales_mercado_v1.sql').replace('gen_random_uuid()',`'${seed}'::uuid`));
  const game=await createGame(db,config({cycles:6,economicEventsVersion:'demand-share-v1',enabledEvents:['PE01'],eventRules:{}}));for(let i=0;i<3;i++)await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Legal '+i,p_nombre_comercial:'Marca '+i});
  const args={p_partida_id:game.id,p_source_cycle:1},draw=await rpc(db,'side_draw_all_events_v1',args);assert.equal(draw.events.length,1);assert.deepEqual(draw.events[0],{eventId:'PE01',round:2,intensity:10,companyCount:3});assert.equal(draw.reused,false);
  const again=await rpc(db,'side_draw_all_events_v1',args);assert.equal(again.reused,true);assert.deepEqual(again.events,draw.events);
  const history=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.equal(history.length,3);assert.ok(history.every(e=>e.eventId==='PE01'&&e.round===2));
  await db.query("select set_config('test.uid',$1,false)",['22222222-2222-2222-2222-222222222222']);await assert.rejects(()=>rpc(db,'side_draw_all_events_v1',args),/No autorizado/);
 }finally{await db.close();}
});

test('grupo exige contexto igual para todas las empresas y Node/Edge coinciden',async()=>{
 const edge=await import(require('node:url').pathToFileURL(require('node:path').resolve('supabase/functions/side-business-close/runtime.mjs')).href);
 async function run(worker,missing=false){let posted=false;const state=fixture.state(1,{},0),snapshot={decision_state:{__cyclePlans:{1:{state}}}};
  const fn=async(name,args)=>{
   if(name==='side_cierres_pendientes')return {data:[{id:'g',cycles:[1]}]};
   if(name==='side_contexto_cierre_negocio')return {data:{empresas:['1','2','3'].map(id=>({id,capital:1000000,snapshot})),financialConfig:{cycles:6,economicEventsVersion:'demand-share-v1'},token:'t'}};
   if(name==='side_event_context_v1')return {data:{companyId:String(args.p_empresa_id),round:1,events:missing&&String(args.p_empresa_id)==='3'?[]:[{id:'PE01',round:1,intensity:10}]}};
   if(name==='side_guardar_cierre_negocio'){posted=args.p_cierre;return {data:{cierre:posted}};}throw Error(name);
  };const result=await worker(fn);return {result,posted};
 }
 assert.deepEqual(await run(edge.runOnce),await run(runOnce));const missing=await run(runOnce,true);assert.equal(missing.result[0].success,false);assert.equal(missing.posted,false);
});
