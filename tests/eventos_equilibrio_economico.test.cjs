'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const fixture=require('./economic_v19_fixture.cjs');

test('comparación económica pareada de la rotación equilibrada durante seis ciclos',async()=>{
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261031025358_desafios_autoritativos_v1.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  await db.exec('create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid)');
  for(const n of ['20261031030035_consulta_privada_desafios','20261031043153_programacion_desafios_autoritativa','20261031050037_eventos_grupales_mercado_v1','20261031055001_mercado_global_escenarios_v2','20261031055442_eventos_productivos_v2','20261031060031_eventos_atractivo_duracion_v2','20261031060810_proteger_programacion_desafios','20261031144757_programacion_equilibrada_v2'])await db.exec(fs.readFileSync(`supabase/migrations/${n}.sql`,'utf8'));
  const games=[];
  for(let scenario=0;scenario<2;scenario++){
   const game=await createGame(db,config({cycles:6,capital:1000000,economicEventsVersion:'demand-share-v1',enabledEvents:['PE69','PE71','PE75']})),ids=[];
   for(let i=0;i<3;i++)ids.push(Number((await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:`Empresa ${scenario}-${i}`,p_nombre_comercial:`Marca ${scenario}-${i}`})).empresa_id));
   games.push({game,ids,rows:[]});
  }
  for(let round=1;round<=6;round++)for(let scenario=0;scenario<2;scenario++){
   const {game,ids,rows}=games[scenario];
   await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','integration','status','waiting')) where id=$1",[game.id,round]);
   if(scenario)await rpc(db,'side_schedule_balanced_v1',{p_partida_id:game.id,p_ciclo:round});
   for(let i=0;i<3;i++){
    const state=fixture.state(round,{},0);
    state.PRODUCCION_META.moldTargets={molde_1:1500,molde_2:0,molde_3:0};
    state.CUERO.quantities.cuero_prem=1000;state.ACCESORIOS.quantities.acc_prem=3000;state.HILO.quantities.hilo_prem=30000;
    await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[ids[i],{decisions_submitted:true,decision_state:{__cyclePlans:{[round]:{state}}}}]);
   }
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);
   await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
   const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[round]}]};try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}};
   const result=await require('../services/business_runtime.cjs').runOnce(call);assert.equal(result[0].success,true,JSON.stringify(result));
   const close=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa;
   rows.push(ids.map(id=>{const r=close[id],f=r.financial.estadoResultados;return {produccion:r.receipt.produced,ventas:r.receipt.sold,inventario:r.receipt.inventory,costos:f.costos,ingresos:f.ingresos,utilidad:f.utilidad,caja:r.financial.balanceCaja.cajaFinal,eventos:r.receipt.events.map(e=>e.id)};}));
  }
  const comparison=games[0].rows.map((base,round)=>base.map((b,i)=>({ciclo:round+1,empresa:i+1,sin:b,con:games[1].rows[round][i]})));
  for(const cycle of comparison)for(const row of cycle)for(const key of ['produccion','ventas','costos','ingresos','utilidad','caja'])assert.ok(Number.isFinite(row.sin[key])&&Number.isFinite(row.con[key]),`${row.ciclo}/${row.empresa}: ${key}`);
  for(let i=0;i<3;i++){
   const events=comparison.flatMap(c=>c[i].con.eventos);
   for(const id of ['PE69','PE71','PE75'])assert.equal(events.filter(e=>e===id).length,2);
  }
  assert.ok(comparison.some(c=>c.some(row=>row.sin.ventas!==row.con.ventas)),'el escenario debe exponer efectos económicos');
  console.log('COMPARACION_ECONOMICA '+JSON.stringify(comparison));
 }finally{await db.close();}
});
