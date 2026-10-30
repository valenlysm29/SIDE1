'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('docente registra evento elegible con reloj de servidor, una vez y sin alterar otras empresas',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid); alter table participantes add column if not exists expulsada_at timestamptz; create table side_business_closures(partida_id uuid,ciclo integer);");
  await db.exec(fs.readFileSync('supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261030172347_material_preview_autorizado.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261030173958_ordenes_confirmacion_atomica.sql','utf8'));
  await db.exec("alter function public.guardar_estado_estudiante(text,text,text,jsonb,bigint) set schema side_private; alter function side_private.guardar_estado_estudiante(text,text,text,jsonb,bigint) rename to side_ident_guardar_estado;");
  await db.exec(fs.readFileSync('supabase/migrations/20261030180225_entrega_operativa_autorizada.sql','utf8'));
  const game=await createGame(db,config({cycles:1,materialRulesVersion:'receipts-v1',deliveryPolicy:'explicit_provider_event_v1',materialLeadTimeDays:7,materialPaymentMode:'cash'}));
  const a=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'A',p_nombre_comercial:'A'});
  await db.query("insert into side_private.student_claims values($1,'22222222-2222-2222-2222-222222222222')",[a.empresa_id]);
  await db.query("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',now(),'duration',600)) where id=$1",[game.id]);
  await db.query("select set_config('test.role','authenticated',false)");
  const st={CUERO:{round:1,quantities:{}},ACCESORIOS:{round:1,quantities:{}},HILO:{round:1,quantities:{hilo_std:2600}}};
  const snapshot={round:1,decisions_submitted:true,decision_state:{__cyclePlans:{1:{state:st}}}};
  const saved=await rpc(db,'guardar_estado_estudiante',{p_codigo:game.codigo,p_nombre_legal:'A',p_nombre_comercial:'A',p_snapshot:snapshot,p_expected_revision:0});assert.equal(saved.success,true);
  const order=(await db.query('select * from side_material_orders_v1 where empresa_id=$1',[a.empresa_id])).rows[0];assert.ok(order);
  const args={p_partida_id:game.id,p_order_id:order.order_id,p_receipt_id:'event-1',p_quantity:1300};
  await db.exec('set role authenticated');await assert.rejects(()=>rpc(db,'side_registrar_entrega_proveedor_v1',args),/elegible/);
  await db.exec('reset role');await db.query("update partidas set configuracion=jsonb_set(configuracion,'{runtime,startedAt}',to_jsonb(now()-interval '141 seconds')) where id=$1",[game.id]);
  await db.exec('set role authenticated');const received=await rpc(db,'side_registrar_entrega_proveedor_v1',args);assert.equal(received.day,7);assert.equal(received.reused,false);
  await assert.rejects(()=>db.query('select public.side_registrar_entrega_proveedor_v1($1,$2,$3,$4::numeric)',[game.id,order.order_id,'nan','NaN']),/Entrega inválida/);
  const bookArgs={p_partida_id:game.id,p_empresa_id:a.empresa_id,p_ciclo:1};const teacherBook=await rpc(db,'side_material_preview_v1',bookArgs);
  assert.equal((await rpc(db,'side_registrar_entrega_proveedor_v1',args)).reused,true);
  await assert.rejects(()=>rpc(db,'side_registrar_entrega_proveedor_v1',{...args,p_quantity:1200}),/reutilizado/);
  await assert.rejects(()=>rpc(db,'side_registrar_entrega_proveedor_v1',{...args,p_receipt_id:'event-2',p_quantity:1301}),/superior/);
  await assert.rejects(()=>rpc(db,'side_record_material_receipt_v1',{p_order_id:order.order_id,p_receipt_id:'inject',p_quantity:1,p_day:7}),/permission denied/i);
  await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");assert.deepEqual(await rpc(db,'side_material_preview_v1',bookArgs),teacherBook);await assert.rejects(()=>rpc(db,'side_registrar_entrega_proveedor_v1',args),/No autorizado/);
  await db.query("select set_config('test.uid','',false)");await assert.rejects(()=>rpc(db,'side_registrar_entrega_proveedor_v1',args),/No autorizado/);
  await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[professor]);await db.query('insert into side_business_closures values($1,1)',[game.id]);await db.exec('set role authenticated');
  await assert.rejects(()=>rpc(db,'side_registrar_entrega_proveedor_v1',{...args,p_receipt_id:'event-3',p_quantity:100}),/ya cerrado/);
  await db.exec('reset role');const rows=(await db.query('select * from side_material_receipts_v1')).rows;assert.equal(rows.length,1);assert.equal(Number(rows[0].quantity),1300);
 }finally{await db.close();}
});
