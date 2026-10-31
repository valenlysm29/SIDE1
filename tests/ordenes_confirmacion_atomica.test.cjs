'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
test('snapshot confirmado crea órdenes atomizadas; borrador, reintento y conflicto',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; create schema side_private; alter table participantes add column if not exists expulsada_at timestamptz;");
  await db.exec(fs.readFileSync('supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261030173958_ordenes_confirmacion_atomica.sql','utf8'));
  const game=await createGame(db,config({cycles:2,materialRulesVersion:'receipts-v1',materialLeadTimeDays:7,materialPaymentMode:'cash'}));
  const a=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'A',p_nombre_comercial:'A'}),b=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'B',p_nombre_comercial:'B'});
  await db.query("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true)) where id=$1",[game.id]);
  await db.query("select set_config('test.role','authenticated',false)");
  const state={CUERO:{round:1,quantities:{}},ACCESORIOS:{round:1,quantities:{}},HILO:{round:1,quantities:{hilo_std:2600}}};
  const snapshot={round:1,decision_state:{__cyclePlans:{1:{state}}},decisions_submitted:false};
  const args={p_codigo:game.codigo,p_nombre_legal:'A',p_nombre_comercial:'A',p_snapshot:snapshot,p_expected_revision:0};
  let r=await rpc(db,'guardar_estado_estudiante',args);assert.equal(r.success,true);assert.equal((await db.query('select count(*) n from side_material_orders_v1')).rows[0].n,0);
  args.p_expected_revision=r.snapshot_revision;args.p_snapshot={...snapshot,decisions_submitted:true};r=await rpc(db,'guardar_estado_estudiante',args);assert.equal(r.success,true);
  let rows=(await db.query('select * from side_material_orders_v1')).rows;assert.equal(rows.length,1);assert.equal(Number(rows[0].quantity),2600);assert.equal(Number(rows[0].unit_cost),1.84);assert.equal(Number(rows[0].empresa_id),Number(a.empresa_id));
  args.p_expected_revision=r.snapshot_revision;r=await rpc(db,'guardar_estado_estudiante',args);assert.equal(r.success,true);assert.equal((await db.query('select count(*) n from side_material_orders_v1')).rows[0].n,1);
  const changed=structuredClone(args.p_snapshot);changed.decision_state.__cyclePlans[1].state.HILO.quantities.hilo_std=100;args.p_snapshot=changed;args.p_expected_revision=r.snapshot_revision;
  await assert.rejects(()=>rpc(db,'guardar_estado_estudiante',args),/Orden ya confirmada/);assert.equal((await db.query('select revision from side_student_state where empresa_id=$1',[a.empresa_id])).rows[0].revision,r.snapshot_revision);
  assert.equal((await db.query('select count(*) n from side_material_orders_v1 where empresa_id=$1',[b.empresa_id])).rows[0].n,0);
  await db.exec('set role authenticated');await assert.rejects(()=>rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:a.empresa_id,p_ciclo:1,p_sku:'hilo_std'}),/permission denied/i);
 }finally{await db.close();}
});
test('confirmación atómica convierte cada presentación y mantiene su precio comercial',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; create schema side_private; alter table participantes add column if not exists expulsada_at timestamptz;");
  for(const file of ['20261030162649_side_pedidos_autoritativos.sql','20261030173958_ordenes_confirmacion_atomica.sql','20261031041921_presentaciones_excel_v2.sql','20261031161309_presentaciones_confirmacion_atomica.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
  const game=await createGame(db,config({cycles:3}));
  assert.equal(game.configuracion.materialRulesVersion,'receipts-v1');assert.equal(game.configuracion.materialPurchaseVersion,'side-packs-v1');assert.equal(game.configuracion.deliveryPolicy,'explicit_provider_event_v1');
  const company=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Compra A',p_nombre_comercial:'Compra A'});
  await db.query("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true)) where id=$1",[game.id]);
  await db.query("select set_config('test.role','authenticated',false)");
  const state={CUERO:{round:1,quantities:{cuero_std:2,cuero_prem:1}},ACCESORIOS:{round:1,quantities:{}},HILO:{round:1,quantities:{hilo_std:1,hilo_ref:2,hilo_prem:3}}};
  const args={p_codigo:game.codigo,p_nombre_legal:'Compra A',p_nombre_comercial:'Compra A',p_snapshot:{round:1,decision_state:{__cyclePlans:{1:{state}}},decisions_submitted:true},p_expected_revision:0};
  const result=await rpc(db,'guardar_estado_estudiante',args);assert.equal(result.success,true);
  const rows=(await db.query('select sku,quantity,unit_cost from side_material_orders_v1 where empresa_id=$1',[Number(company.empresa_id)])).rows;
  for(const [sku,units,total] of [['cuero_std',4,90],['cuero_prem',2,80],['hilo_std',270,2],['hilo_ref',500,8],['hilo_prem',600,21]]){
   const row=rows.find(x=>x.sku===sku);assert.equal(Number(row.quantity),units);assert.ok(Math.abs(Number(row.quantity)*Number(row.unit_cost)-total)<1e-8,sku);
  }
  args.p_expected_revision=result.snapshot_revision;assert.equal((await rpc(db,'guardar_estado_estudiante',args)).success,true);
  assert.equal(Number((await db.query('select count(*) n from side_material_orders_v1 where empresa_id=$1',[Number(company.empresa_id)])).rows[0].n),5);
 }finally{await db.close();}
});
