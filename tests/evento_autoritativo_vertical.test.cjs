'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const {runOnce}=require('../services/business_runtime.cjs');const fixture=require('./economic_v19_fixture.cjs');
const sql=name=>fs.readFileSync(name,'utf8');
for(const [eventId,intensity,direction] of [['PE23',1,0],['PE26',10,0],['PE30',25,0],['PE38',1,0],['PE39',6,0],['PE44',1,0],['PE68',1,0],['PE69',20,1],['PE70',12,-1],['PE71',15,1],['PE74',12,1],['PE75',6,-1],['PE77',1,0],['PE91',7,1],['PE92',12,-1]])test(`${eventId}: noticia y cierre persistido en PGlite con tres empresas`,async()=>{
 const db=await database();
 try {
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(sql(f));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid); revoke all on schema side_private from public,anon,authenticated');
  await db.exec(sql('supabase/migrations/20261031030035_consulta_privada_desafios.sql'));
  for(const f of ['supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql','supabase/migrations/20261031050037_eventos_grupales_mercado_v1.sql','supabase/migrations/20261031055001_mercado_global_escenarios_v2.sql','supabase/migrations/20261031055442_eventos_productivos_v2.sql','supabase/migrations/20261031060031_eventos_atractivo_duracion_v2.sql'])await db.exec(sql(f));
  const game=await createGame(db,config({cycles:6,capital:1000000,economicEventsVersion:'demand-share-v1'}));const ids=[];
  for(let i=1;i<=3;i++){
   const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Legal '+i,p_nombre_comercial:'Marca '+i});const id=Number(joined.empresa_id);ids.push(id);
   const state=fixture.state(1,{},0);for(const [key,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_ind'],['ACABADOS','aca_ind'],['PERS_CORTE','corte_maestro'],['PERS_ENSAMBLE','ens_personal_esp'],['PERS_ACABADO','aca_personal_art']]){state[key].quantities={[opt]:10};if(state[key].purchases)state[key].purchases={1:{[opt]:10}};}
   if(eventId==='PE74')state.INV_MARKETING={round:1,value:1000};
   if(['PE30','PE26','PE39'].includes(eventId)){state.ENSAMBLE.quantities={ens_ind:1};state.ENSAMBLE.purchases={1:{ens_ind:1}};state.PERS_ENSAMBLE.quantities={ens_personal_esp:1};}
   if(['PE23','PE77'].includes(eventId)&&i===1)state.CANALES={round:1,optionIds:['web','los_olivos'],quantities:{los_olivos:1}};
   state.CUERO.quantities={cuero_prem:900};state.ACCESORIOS.quantities={acc_prem:3000};state.HILO.quantities={hilo_prem:18000};state.PRODUCCION_META.moldTargets={molde_1:3000,molde_2:0,molde_3:0};
   await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);
  }
  await rpc(db,'side_assign_event_v1',{p_partida_id:game.id,p_empresa_id:ids[0],p_ciclo:1,p_event_id:eventId,p_intensity:intensity});
  if(['PE70','PE91','PE92'].includes(eventId)){const scheduled=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.deepEqual(scheduled.map(e=>e.round),[1,2]);await assert.rejects(()=>rpc(db,'side_assign_event_v1',{p_partida_id:game.id,p_empresa_id:ids[1],p_ciclo:6,p_event_id:eventId,p_intensity:intensity}),/dos ciclos/);}
  const student='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await db.query('insert into side_private.student_claims values($1,$2)',[ids[0],student]);
  await db.query("select set_config('test.uid',$1,false)",[student]);await db.exec('set role authenticated');
  const before=await rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[0]});assert.equal(before[0].status,'programado');assert.equal(before[0].eventId,eventId);
  await assert.rejects(()=>rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[1]}),/No autorizado/);await db.exec('reset role');
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args)};}catch(e){return {error:{message:e.message}};}};
  const result=await runOnce(call);assert.equal(result[0].success,true,JSON.stringify(result));
  const close=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa;
  assert.equal(close[ids[0]].receipt.events[0].id,eventId);assert.deepEqual(close[ids[1]].receipt.events,[]);
  const allocation=id=>close[id].receipt.marketAllocation.products.esencial.asignado;
  if(direction)assert.ok(direction*(allocation(ids[0])-allocation(ids[1]))>0);else if(['PE30','PE26','PE39'].includes(eventId)){assert.ok(close[ids[0]].receipt.produced<close[ids[1]].receipt.produced);if(eventId==='PE30')assert.equal(close[ids[0]].financial.flujoCaja.eventos,-200);}else assert.equal(close[ids[0]].financial.flujoCaja.eventos,-({PE23:500,PE38:1000,PE44:350,PE68:1200,PE77:300})[eventId]);
  assert.equal(ids.reduce((s,id)=>s+allocation(id),0),3500);
  const rerun=await runOnce(call);assert.equal(rerun[0].success,true);
  const again=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa;assert.deepEqual(again,close);
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);await db.exec('set role authenticated');
  const history=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.equal(history[0].status,'aplicado');assert.equal(history[0].result.sold,close[ids[0]].receipt.sold);assert.ok(history[0].result.demand.esencial.asignado>0);if(eventId==='PE30'){assert.equal(history[0].result.eventCash,-200);assert.equal(history[0].result.produced,close[ids[0]].receipt.produced);}
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[student]);await db.exec('set role authenticated');
  const after=(await rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[0]}))[0];assert.equal(after.status,'aplicado');if(eventId==='PE30')assert.equal(after.result.eventCash,-200);
 }finally{await db.close();}
});
