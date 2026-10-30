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
