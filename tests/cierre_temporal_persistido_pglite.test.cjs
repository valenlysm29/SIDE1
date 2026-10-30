'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const fixture=require('./economic_v19_fixture.cjs'),PRO=require('../js/production_model'),worker=require('../services/business_runtime.cjs');
const sql=name=>fs.readFileSync(require.resolve(name),'utf8');
test('cierre contado con hilo pendiente: anticipo, stock cero, rollback y reintento',async()=>{
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['../docs/sql/20261023_despliegue_cierre_v19.sql','../supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','../supabase/migrations/20261027_corregir_ventas_generales.sql','../supabase/migrations/20261028_cierre_servidor.sql','../supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','../supabase/migrations/20261030165204_side_cierre_revision_pedidos.sql'])await db.exec(sql(f));
  const game=await createGame(db,config({cycles:1,capital:200000,materialRulesVersion:'receipts-v1',materialLeadTimeDays:7,materialPaymentMode:'cash'}));
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Pendiente QA',p_nombre_comercial:'Pendiente QA'}),id=Number(joined.empresa_id);
  const state=fixture.state(1,{},2);state.__inventarioMP={};state.CUERO={round:1,quantities:{cuero_prem:140}};state.ACCESORIOS={round:1,quantities:{acc_prem:200}};state.HILO={round:1,quantities:{hilo_std:2600}};state.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:200};state.JEFATURA={round:1,optionIds:['no_jefatura']};
  for(const [key,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[key]={round:1,quantities:{[opt]:1},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(key)?{purchases:{1:{[opt]:1}}}:{})};
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.exec("create function public.test_temporal_error() returns trigger language plpgsql as $$begin raise exception 'fallo temporal inducido'; end$$; create trigger test_temporal_error before insert or update on public.reportes_ciclo for each row execute function public.test_temporal_error()");
  const before=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0],cash=(await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual;
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  for(const [sku,quantity] of [['cuero_prem',140],['acc_prem',200],['hilo_std',2600]]){
   const order=await rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:id,p_ciclo:1,p_sku:sku});
   if(sku!=='hilo_std')await rpc(db,'side_record_material_receipt_v1',{p_order_id:order.orderId,p_receipt_id:'pending-'+sku,p_quantity:quantity,p_day:0});
  }
  const facts=await rpc(db,'side_material_context_v1',{p_partida_id:game.id,p_empresa_id:id,p_cutoff_day:29});
  const preview=PRO.calculate({state:{...state,__materialOrders:facts},catalog:fixture.catalog,round:1});assert.equal(preview.producibleUnits,0);assert.equal(preview.materials.find(m=>m.id==='HILO').pending,2600);
  const CYCLE=require('../js/cycle_model');assert.throws(()=>CYCLE.close({state:{...state,__materialOrders:facts},catalog:fixture.catalog,round:1,capital:0,financialPolicy:{cycles:1,verifiedMaterialContext:true,materialPaymentMode:'cash'}}),/Caja insuficiente/);
  const run=()=>worker.runOnce(async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args),error:null};}catch(error){return {data:null,error:{message:error.message}};}});
  const failed=await run();assert.equal(failed[0].success,false);assert.match(failed[0].error,/fallo temporal inducido/);
  await db.exec('reset role');assert.deepEqual((await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0],before);assert.equal((await db.query('select caja_actual from empresas where id=$1',[id])).rows[0].caja_actual,cash);assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),0);
  await db.exec('drop trigger test_temporal_error on public.reportes_ciclo');await db.exec('set role service_role');
  const success=await run();assert.equal(success[0].success,true,JSON.stringify(success));
  const saved=await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1});const closed=saved.cierre.resultadosPorEmpresa[String(id)];
  assert.equal(closed.receipt.produced,0);assert.equal(closed.receipt.production.temporal.consumedBySku.hilo_std,0);assert.equal(closed.receipt.inventory.hilo_std,0);assert.equal(closed.financial.balanceGeneral.anticiposMateriales,4784);assert.equal(closed.financial.estadoResultados.costoVentas,0);
  assert.equal(closed.financial.balanceGeneral.activos,closed.financial.balanceGeneral.pasivoPatrimonio);
  assert.equal((await run())[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre,saved.cierre);
  await db.exec('reset role');assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),1);
 }finally{await db.close();}
});
