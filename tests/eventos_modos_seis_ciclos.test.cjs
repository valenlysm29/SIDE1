'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
for(const mode of ['manual','aleatorio','aleatorio_con_eventos'])test(`${mode}: tres empresas completan seis ciclos persistidos`,async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid)');
  for(const n of ['20261031030035_consulta_privada_desafios','20261031043153_programacion_desafios_autoritativa','20261031050037_eventos_grupales_mercado_v1','20261031055001_mercado_global_escenarios_v2','20261031055442_eventos_productivos_v2','20261031060031_eventos_atractivo_duracion_v2','20261031060810_proteger_programacion_desafios','20261031144757_programacion_equilibrada_v2'])await db.exec(fs.readFileSync(`supabase/migrations/${n}.sql`,'utf8').replace(n==='20261031060810_proteger_programacion_desafios'&&mode==='aleatorio_con_eventos'?'gen_random_uuid()':'__NO_REPLACE__',"'00000000-0000-0000-0000-000000000078'::uuid"));
  const game=await createGame(db,config({cycles:6,capital:1000000,economicEventsVersion:'demand-share-v1',enabledEvents:mode==='aleatorio'?[]:mode==='aleatorio_con_eventos'?['PE68']:['PE69','PE71','PE75']})),ids=[];
  for(let i=0;i<3;i++)ids.push(Number((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Empresa '+i,p_nombre_comercial:'Marca '+i})).empresa_id));
  const student='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await db.query('insert into side_private.student_claims values($1,$2)',[ids[0],student]);
  const fixture=require('./economic_v19_fixture.cjs');let previous={};
  for(let round=1;round<=6;round++){
   await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','integration','status','waiting')) where id=$1",[game.id,round]);
   let scheduled;if(mode==='manual'){const events=[];for(let i=0;i<ids.length;i++)events.push(await rpc(db,'side_assign_event_v1',{p_partida_id:game.id,p_empresa_id:ids[i],p_ciclo:round,p_event_id:['PE69','PE71','PE75'][(i+round-1)%3],p_intensity:2}));await rpc(db,'side_assign_group_event_v1',{p_partida_id:game.id,p_ciclo:round,p_event_id:'PE18',p_intensity:2});scheduled={events};}else{scheduled=await rpc(db,'side_draw_all_events_v1',{p_partida_id:game.id,p_source_cycle:round});if(mode==='aleatorio')assert.deepEqual(scheduled.events,[]);else assert.equal(scheduled.events.length,1);assert.equal((await rpc(db,'side_draw_all_events_v1',{p_partida_id:game.id,p_source_cycle:round})).reused,true);}
   await db.query("select set_config('test.uid',$1,false)",[student]);await db.exec('set role authenticated');
   const news=await rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[0]});if(mode==='manual')assert.ok(news.some(e=>e.round===round&&e.eventId===scheduled.events.find(e=>e.companyId===String(ids[0])).eventId));else if(mode==='aleatorio')assert.equal(news.length,0);else assert.ok(news.some(e=>e.round===round&&e.eventId==='PE68'));
   await assert.rejects(()=>rpc(db,'side_student_events_v1',{p_partida_id:game.id,p_empresa_id:ids[1]}),/No autorizado/);await db.exec('reset role');
   for(const id of ids){const state=fixture.state(round,previous[id]?.state||{},0);await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{[round]:{state}}}}]);}
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
   const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[round]}]};try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}};
   const run=()=>require('../services/business_runtime.cjs').runOnce(call);assert.equal((await run())[0].success,true);
   const close=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa;
   for(const id of ids){const expected=scheduled.events.find(e=>e.companyId===String(id)),result=close[id];if(mode==='manual'){assert.ok(result.receipt.events.some(e=>e.id===expected.eventId&&e.intensity===expected.intensity));assert.ok(result.receipt.events.some(e=>e.id==='PE18'));}else if(mode==='aleatorio'||id!==ids[0])assert.deepEqual(result.receipt.events,[]);else assert.equal(result.receipt.events[0].id,'PE68');assert.equal(result.financial.balanceGeneral.activos,result.financial.balanceGeneral.pasivoPatrimonio);if(round>1)assert.equal(result.financial.balanceCaja.cajaInicial,previous[id].financial.balanceCaja.cajaFinal);for(const sale of result.receipt.sales)assert.ok(sale.sold<=sale.available);
    const consumed={};for(const lot of result.receipt.materialLots)for(const family of Object.values(lot.materials))for(const [sku,q] of Object.entries(family))consumed[sku]=(consumed[sku]||0)+q;
    for(const family of ['CUERO','ACCESORIOS','HILO'])for(const [sku,q] of Object.entries(result.receipt.decisions[family].quantities))assert.ok(Math.abs(Number(result.receipt.openingInventory[sku]||0)+q-Number(consumed[sku]||0)-Number(result.receipt.inventory[sku]||0))<1e-7);
   }
   assert.equal((await run())[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa,close);previous=close;
   await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);await db.exec('set role authenticated');const history=await rpc(db,'side_teacher_events_v1',{p_partida_id:game.id});assert.equal(history.length,mode==='manual'?round*6:mode==='aleatorio_con_eventos'?round:0);assert.ok(history.every(e=>e.status==='aplicado'));
  }
 }finally{await db.close();}
});
