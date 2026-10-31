'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const fixture=require('./economic_v19_fixture.cjs'),worker=require('../services/business_runtime.cjs');
test('presentaciones Excel V2: decisión, orden, recepción, producción, costo y reintento',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','supabase/migrations/20261030165204_side_cierre_revision_pedidos.sql','supabase/migrations/20261031041921_presentaciones_excel_v2.sql'])await db.exec(fs.readFileSync(f,'utf8'));
  const game=await createGame(db,config({cycles:1,capital:200000,materialRulesVersion:'receipts-v1',materialPurchaseVersion:'excel-v2-packs-v1',materialLeadTimeDays:0,materialPaymentMode:'cash'}));
  await assert.rejects(()=>db.query("update partidas set configuracion=configuracion-'materialPurchaseVersion' where id=$1",[game.id]),/inmutable/);
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Presentaciones QA',p_nombre_comercial:'Bolsos QA'}),id=Number(joined.empresa_id);
  const state=fixture.state(1,{},0);state.CUERO={round:1,quantities:{cuero_std:2}};state.ACCESORIOS={round:1,quantities:{acc_eco:10}};state.HILO={round:1,quantities:{hilo_std:1}};state.PRODUCCION_META.moldTargets={molde_1:10,molde_2:0,molde_3:0};
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  for(const [sku,physical] of [['cuero_std',4],['acc_eco',10],['hilo_std',270]]){const order=await rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:id,p_ciclo:1,p_sku:sku});assert.equal(Number(order.quantity),physical);const parts=sku==='hilo_std'?[1,1,268]:[physical];for(const [index,quantity] of parts.entries())await rpc(db,'side_record_material_receipt_v1',{p_order_id:order.orderId,p_receipt_id:`receipt-${sku}-${index}`,p_quantity:quantity,p_day:0});}
  const book=await rpc(db,'side_material_context_v1',{p_partida_id:game.id,p_empresa_id:id,p_cutoff_day:29});
  const preview=require('../js/production_model.js').calculate({state:{...state,__materialOrders:book},catalog:fixture.catalog,round:1,config:{materialRulesVersion:'receipts-v1',materialPurchaseVersion:'excel-v2-packs-v1'}});
  assert.equal(preview.producibleUnits,10);assert.equal(preview.materials.find(m=>m.id==='HILO').available,270);
  const edge=await import(require('node:url').pathToFileURL(require('node:path').resolve('supabase/functions/side-business-close/runtime.mjs')).href);let edgeClosure;
  const edgeResult=await edge.runOnce(async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};if(name==='side_guardar_cierre_temporal_v1'){edgeClosure=args.p_cierre;return {data:{cierre:edgeClosure}};}try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}});
  assert.equal(edgeResult[0].success,true,JSON.stringify(edgeResult));
  const run=()=>worker.runOnce(async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args)}}catch(error){return {error:{message:error.message}}}});
  const outcome=await run();assert.equal(outcome[0].success,true,JSON.stringify(outcome));
  const result=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa[String(id)];
  assert.deepEqual(JSON.parse(JSON.stringify(edgeClosure.resultadosPorEmpresa[String(id)])),result);
  assert.equal(result.receipt.produced,10);assert.equal(result.receipt.inventory.cuero_std,1);assert.equal(result.receipt.inventory.acc_eco,0);assert.equal(result.receipt.inventory.hilo_std,210);
  assert.equal(result.receipt.materialReceiptFacts.receivedBySku.hilo_std,270);assert.equal(result.receipt.materialReceiptFacts.receivedValueBySku.hilo_std,2);
  assert.deepEqual(result.receipt.materialReceiptFacts.receipts.filter(r=>r.sku==='hilo_std').map(r=>r.value),[0.01,0,1.99]);
  assert.equal(result.financial.balanceGeneral.activos,result.financial.balanceGeneral.pasivoPatrimonio);
  assert.equal((await run())[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa[String(id)],result);
 }finally{await db.close();}
});
