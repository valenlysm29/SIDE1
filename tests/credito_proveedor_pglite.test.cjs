'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const fixture=require('./economic_v19_fixture.cjs'),worker=require('../services/business_runtime.cjs');
const sql=name=>fs.readFileSync(require.resolve(name),'utf8');
test('crédito parcial: recepción crea CxP sin pagar compra; Node y Edge cierran igual',async()=>{
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['../docs/sql/20261023_despliegue_cierre_v19.sql','../supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','../supabase/migrations/20261027_corregir_ventas_generales.sql','../supabase/migrations/20261028_cierre_servidor.sql','../supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','../supabase/migrations/20261030165204_side_cierre_revision_pedidos.sql'])await db.exec(sql(f));
  const game=await createGame(db,config({cycles:1,capital:200000,materialRulesVersion:'receipts-v1',materialLeadTimeDays:7,materialPaymentMode:'credit'}));
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Crédito QA',p_nombre_comercial:'Crédito QA'}),id=Number(joined.empresa_id);
  const state=fixture.state(1,{},2);state.__inventarioMP={};state.CUERO={round:1,quantities:{cuero_prem:140}};state.ACCESORIOS={round:1,quantities:{acc_prem:200}};state.HILO={round:1,quantities:{hilo_std:2600}};state.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:200};state.JEFATURA={round:1,optionIds:['no_jefatura']};
  for(const [key,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[key]={round:1,quantities:{[opt]:1},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(key)?{purchases:{1:{[opt]:1}}}:{})};
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  for(const [sku,quantity,received,day] of [['cuero_prem',140,140,0],['acc_prem',200,200,0],['hilo_std',2600,1300,7]]){
   const order=await rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:id,p_ciclo:1,p_sku:sku});assert.equal(Number(order.quantity),quantity);
   await rpc(db,'side_record_material_receipt_v1',{p_order_id:order.orderId,p_receipt_id:'credit-'+sku,p_quantity:received,p_day:day});
  }
  const call=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[1]}]};try{return {data:await rpc(db,name,args),error:null};}catch(error){return {data:null,error:{message:error.message}};}};
  await db.exec('reset role');const snapshotBefore=(await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0];
  await db.exec("create function public.fail_credit_close() returns trigger language plpgsql as $$begin raise exception 'fallo crédito inducido'; end$$; create trigger fail_credit_close before insert or update on public.reportes_ciclo for each row execute function public.fail_credit_close()");
  await db.exec('set role service_role');const failed=await worker.runOnce(call);assert.equal(failed[0].success,false);assert.match(failed[0].error,/fallo crédito inducido/);
  await db.exec('reset role');assert.deepEqual((await db.query('select snapshot,revision from side_student_state where empresa_id=$1',[id])).rows[0],snapshotBefore);
  assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),0);
  assert.equal(Number((await db.query('select count(*) as n from side_material_receipts_v1 r join side_material_orders_v1 o on o.order_id=r.order_id where o.partida_id=$1',[game.id])).rows[0].n),3);
  await db.exec('drop trigger fail_credit_close on public.reportes_ciclo');await db.exec('set role service_role');
  await db.exec('begin');const node=await worker.runOnce(call);assert.equal(node[0].success,true,JSON.stringify(node));
  const result=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre,closed=result.resultadosPorEmpresa[String(id)];
  assert.equal(closed.receipt.produced,100);assert.equal(closed.receipt.production.temporal.consumedBySku.hilo_std,1300);assert.equal(closed.receipt.inventory.hilo_std,0);
  assert.equal(closed.financial.balanceGeneral.cuentasPorPagarProveedores,14352);assert.equal(closed.financial.balanceGeneral.anticiposMateriales,0);
  assert.equal(closed.financial.cuentasPorPagarDetalle.reduce((sum,row)=>sum+row.value,0),14352);assert.ok(closed.financial.cuentasPorPagarDetalle.every(row=>row.dueCycle===2));
  assert.equal(closed.ledger['1:PROVEEDOR_CREDITO'],16744);assert.equal(closed.financial.balanceGeneral.activos,closed.financial.balanceGeneral.pasivoPatrimonio);
  assert.equal(closed.financial.balanceCaja.cajaFinal,Math.round((closed.financial.balanceCaja.cajaInicial+closed.financial.balanceCaja.entradas-closed.financial.balanceCaja.salidas)*100)/100);
  console.log('CIERRE_CREDITO_QA '+JSON.stringify({producido:closed.receipt.produced,recibidoHilo:1300,pendienteHilo:1300,cxp:closed.financial.balanceGeneral.cuentasPorPagarProveedores,vencimiento:2,cajaInicial:closed.financial.balanceCaja.cajaInicial,cajaFinal:closed.financial.balanceCaja.cajaFinal,ventas:closed.receipt.revenue,costoVentas:closed.financial.estadoResultados.costoVentas,utilidad:closed.financial.estadoResultados.utilidadNeta}));
  await db.exec('rollback');
  const edge=await import(require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../supabase/functions/side-business-close/runtime.mjs')).href);
  const edgeResult=await edge.runOnce(call);assert.equal(edgeResult[0].success,true,JSON.stringify(edgeResult));
  assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre,result);
  assert.equal((await edge.runOnce(call))[0].success,true);
  await db.exec('reset role');assert.equal(Number((await db.query('select count(*) as n from side_business_closures where partida_id=$1',[game.id])).rows[0].n),1);
 }finally{await db.close();}
});

for(const [mode,total] of [['credit',2],['cash',2],['credit',6]])test(`${total} ciclos ${mode}: arrastran stock y liquidan obligaciones sin duplicación`,async()=>{
 const db=await database();
 try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz");
  for(const f of ['../docs/sql/20261023_despliegue_cierre_v19.sql','../supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','../supabase/migrations/20261027_corregir_ventas_generales.sql','../supabase/migrations/20261028_cierre_servidor.sql','../supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','../supabase/migrations/20261030165204_side_cierre_revision_pedidos.sql'])await db.exec(sql(f));
  const game=await createGame(db,config({cycles:total,capital:200000,materialRulesVersion:'receipts-v1',materialLeadTimeDays:7,materialPaymentMode:mode,supplierCreditTermCycles:1}));
  const joined=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Crédito dos ciclos',p_nombre_comercial:'Crédito dos ciclos'}),id=Number(joined.empresa_id);
  const state=fixture.state(1,{},2);state.__inventarioMP={};state.CUERO={round:1,quantities:{cuero_prem:140}};state.ACCESORIOS={round:1,quantities:{acc_prem:200}};state.HILO={round:1,quantities:{hilo_std:2600}};state.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:200};state.JEFATURA={round:1,optionIds:['no_jefatura']};
  let idB=null,stateB=null,priorB=null;if(total===6){const joinedB=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Segunda empresa',p_nombre_comercial:'Segunda empresa'});idB=Number(joinedB.empresa_id);}
  for(const [key,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])state[key]={round:1,quantities:{[opt]:1},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(key)?{purchases:{1:{[opt]:1}}}:{})};
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state}}}}]);
  if(idB){stateB=structuredClone(state);stateB.CANALES={round:1,optionIds:[]};stateB.HILO={round:1,quantities:{hilo_std:1300}};await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[idB,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state:stateB}}}}]);}
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  let hilo;
  for(const [sku,q,received,day] of [['cuero_prem',140,140,0],['acc_prem',200,200,0],['hilo_std',2600,1300,7]]){
   const order=await rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:id,p_ciclo:1,p_sku:sku});if(sku==='hilo_std')hilo=order;
   await rpc(db,'side_record_material_receipt_v1',{p_order_id:order.orderId,p_receipt_id:'two-'+sku,p_quantity:received,p_day:day});
  }
  if(idB)for(const [sku,q,day] of [['cuero_prem',140,0],['acc_prem',200,0],['hilo_std',1300,7]]){
   const order=await rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:idB,p_ciclo:1,p_sku:sku});
   await rpc(db,'side_record_material_receipt_v1',{p_order_id:order.orderId,p_receipt_id:'b-'+sku,p_quantity:q,p_day:day});
  }
  const run=round=>worker.runOnce(async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:game.id,cycles:[round]}]};try{return {data:await rpc(db,name,args),error:null};}catch(error){return {data:null,error:{message:error.message}};}});
  const firstResult=await run(1);assert.equal(firstResult[0].success,true,JSON.stringify(firstResult));
  const first=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa[String(id)];
  assert.equal(first.receipt.produced,100);assert.equal(first.financial.balanceGeneral.cuentasPorPagarProveedores,mode==='credit'?14352:0);assert.equal(first.financial.balanceGeneral.anticiposMateriales,mode==='cash'?2392:0);
  if(idB){priorB=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1})).cierre.resultadosPorEmpresa[String(idB)];assert.equal(priorB.receipt.sold,0);assert.ok(priorB.financial.balanceGeneral.inventarioPT>0);}
  await db.exec('reset role');
  const saved=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot;
  const next=structuredClone(state);for(const key of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','JEFATURA','CANALES','PRODUCCION_META'])next[key].round=2;
  next.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:100};
  for(const key of ['CUERO','ACCESORIOS','HILO'])next[key]={round:2,quantities:{}};
  for(const key of ['MESA_CORTE','ENSAMBLE','ACABADOS'])next[key]={round:2,quantities:{},purchases:structuredClone(first.state[key].purchases)};
  saved.decision_state.__cyclePlans={...saved.decision_state.__cyclePlans,2:{state:next}};saved.decisions_submitted=true;
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,saved]);
  if(idB){const bSaved=(await db.query('select snapshot from side_student_state where empresa_id=$1',[idB])).rows[0].snapshot;const bPlan=structuredClone(stateB);
   for(const key of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','JEFATURA','CANALES','PRODUCCION_META'])bPlan[key].round=2;bPlan.CANALES.optionIds=['web'];bPlan.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:0};
   for(const key of ['CUERO','ACCESORIOS','HILO'])bPlan[key]={round:2,quantities:{}};for(const key of ['MESA_CORTE','ENSAMBLE','ACABADOS'])bPlan[key]={round:2,quantities:{},purchases:structuredClone(priorB.state[key].purchases)};
   bSaved.decision_state.__cyclePlans={...bSaved.decision_state.__cyclePlans,2:{state:bPlan}};bSaved.decisions_submitted=true;await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[idB,bSaved]);}
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',2,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.exec('set role service_role');
  await db.exec('begin');
  await rpc(db,'side_record_material_receipt_v1',{p_order_id:hilo.orderId,p_receipt_id:'late-old',p_quantity:1,p_day:10});
  const stale=await run(2);assert.equal(stale[0].code,'RECEPCIONES_ANTERIORES_NO_VERIFICADAS');
  await db.exec('rollback');
  await rpc(db,'side_record_material_receipt_v1',{p_order_id:hilo.orderId,p_receipt_id:'two-hilo-rest',p_quantity:1300,p_day:37});
  const secondResult=await run(2);assert.equal(secondResult[0].success,true,JSON.stringify(secondResult));
  const second=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:2})).cierre.resultadosPorEmpresa[String(id)];
  if(idB){const b2=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:2})).cierre.resultadosPorEmpresa[String(idB)];assert.equal(b2.receipt.production.producibleUnits,0);assert.ok(b2.receipt.sold>0);assert.ok(b2.financial.estadoResultados.costoVentas>0);assert.equal(b2.financial.balanceCaja.cajaInicial,priorB.financial.balanceCaja.cajaFinal);priorB=b2;}
  assert.equal(second.receipt.openingInventory.cuero_prem,70);assert.equal(second.receipt.openingInventory.acc_prem,100);
  assert.ok(second.receipt.consequences.some(row=>row.id==='CONS-08'));assert.equal(second.receipt.produced,95);assert.equal(second.receipt.production.temporal.consumedBySku.hilo_std,95*13);
  assert.equal(second.ledger['2:PROVEEDOR_PAGO'],mode==='credit'?-14352:0);
  assert.equal(second.financial.flujoCaja.pagosProveedores,mode==='credit'?14352:0);assert.equal(second.financial.balanceGeneral.cuentasPorPagarProveedores,mode==='credit'?2392:0);assert.equal(second.financial.balanceGeneral.anticiposMateriales,0);
  assert.equal(second.financial.pagosProveedores.reduce((sum,row)=>sum+row.amount,0),mode==='credit'?14352:0);if(mode==='credit')assert.equal(second.financial.cuentasPorPagarDetalle.filter(row=>row.outstanding>0)[0].dueCycle,3);
  assert.equal(second.financial.balanceCaja.cajaInicial,first.financial.balanceCaja.cajaFinal);assert.equal(second.financial.balanceGeneral.activos,second.financial.balanceGeneral.pasivoPatrimonio);
  assert.equal((await run(2))[0].success,true);assert.deepEqual((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:2})).cierre.resultadosPorEmpresa[String(id)],second);
  const rowFor=(r,prior)=>({ciclo:r.receipt.round,pedidosPendientes:Object.fromEntries(r.receipt.production.materials.map(m=>[m.id,m.pending||0])),recibido:r.receipt.materialReceiptFacts.receivedBySku,consumido:r.receipt.production.temporal.consumedBySku,stockInicial:r.receipt.openingInventory,stockFinal:r.receipt.inventory,valorMP:r.financial.balanceGeneral.inventarioMP,anticipos:r.financial.balanceGeneral.anticiposMateriales,cxpInicial:prior?.financial.balanceGeneral.cuentasPorPagarProveedores||0,cxpNueva:r.receipt.materialReceiptFacts.paymentMode==='credit'?Object.values(r.receipt.materialReceiptFacts.receivedValueBySku).reduce((a,v)=>a+v,0):0,pago:r.financial.flujoCaja.pagosProveedores,cxpFinal:r.financial.balanceGeneral.cuentasPorPagarProveedores,inventarioPT:r.financial.balanceGeneral.inventarioPT,ventas:r.receipt.revenue,cxc:r.financial.balanceGeneral.cuentasPorCobrar,cajaInicial:r.financial.balanceCaja.cajaInicial,cajaFinal:r.financial.balanceCaja.cajaFinal,costoVentas:r.financial.estadoResultados.costoVentas,utilidad:r.financial.estadoResultados.utilidadNeta});
  const rows=[rowFor(first,null),rowFor(second,first)];
  let previous=second;
  for(let round=3;round<=total;round++){
   await db.exec('reset role');const current=(await db.query('select snapshot from side_student_state where empresa_id=$1',[id])).rows[0].snapshot;
   const plan=structuredClone(next);for(const key of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','JEFATURA','CANALES','PRODUCCION_META'])plan[key].round=round;
   plan.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:0};for(const key of ['CUERO','ACCESORIOS','HILO'])plan[key]={round,quantities:{}};
   for(const key of ['MESA_CORTE','ENSAMBLE','ACABADOS'])plan[key]={round,quantities:{},purchases:structuredClone(previous.state[key].purchases)};
   current.decision_state.__cyclePlans={...current.decision_state.__cyclePlans,[round]:{state:plan}};current.decisions_submitted=true;
   await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[id,current]);
   if(idB){const bSaved=(await db.query('select snapshot from side_student_state where empresa_id=$1',[idB])).rows[0].snapshot;const bPlan=structuredClone(stateB);
    for(const key of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','JEFATURA','CANALES','PRODUCCION_META'])bPlan[key].round=round;bPlan.CANALES.optionIds=['web'];bPlan.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:0};
    for(const key of ['CUERO','ACCESORIOS','HILO'])bPlan[key]={round,quantities:{}};for(const key of ['MESA_CORTE','ENSAMBLE','ACABADOS'])bPlan[key]={round,quantities:{},purchases:structuredClone(priorB.state[key].purchases)};
    bSaved.decision_state.__cyclePlans={...bSaved.decision_state.__cyclePlans,[round]:{state:bPlan}};bSaved.decisions_submitted=true;await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[idB,bSaved]);}
   await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',$2::int,'phase','results','status','finished')) where id=$1",[game.id,round]);await db.exec('set role service_role');
   const response=await run(round);assert.equal(response[0].success,true,JSON.stringify(response));
   const result=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa[String(id)];
   if(idB){const bNext=(await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:round})).cierre.resultadosPorEmpresa[String(idB)];assert.equal(bNext.financial.balanceCaja.cajaInicial,priorB.financial.balanceCaja.cajaFinal);assert.equal(bNext.financial.balanceGeneral.activos,bNext.financial.balanceGeneral.pasivoPatrimonio);priorB=bNext;}
   assert.equal(result.financial.balanceCaja.cajaInicial,previous.financial.balanceCaja.cajaFinal);assert.equal(result.financial.balanceGeneral.activos,result.financial.balanceGeneral.pasivoPatrimonio);
   if(round===3&&mode==='credit'){assert.equal(result.financial.flujoCaja.pagosProveedores,2392);assert.equal(result.financial.balanceGeneral.cuentasPorPagarProveedores,0);}
   rows.push(rowFor(result,previous));previous=result;
  }
  if(total===6){const out=await run(7);assert.equal(out[0].success,false);assert.equal((await rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:6})).cierre.resultadosPorEmpresa[String(id)].receipt.round,6);}
  console.log('CICLOS_'+mode.toUpperCase()+'_'+total+' '+JSON.stringify(rows));
  await db.exec('reset role');
 }finally{await db.close();}
});
