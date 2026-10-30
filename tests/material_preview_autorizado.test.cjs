'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
test('lectura de preview autoriza dueño o docente y entrega la misma revisión del libro',async()=>{
 const db=await database();try{
  await db.exec("create role service_role; create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; create schema side_private; create table side_private.student_claims(empresa_id bigint primary key,owner_id uuid); alter table participantes add column if not exists expulsada_at timestamptz;");
  await db.exec(fs.readFileSync('supabase/migrations/20261030162649_side_pedidos_autoritativos.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261030172347_material_preview_autorizado.sql','utf8'));
  const game=await createGame(db,config({cycles:2,materialRulesVersion:'receipts-v1',materialLeadTimeDays:7,materialPaymentMode:'cash',runtime:{round:1,phase:'results'}}));
  const a=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'A',p_nombre_comercial:'A'}),b=await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'B',p_nombre_comercial:'B'});
  const uid='22222222-2222-2222-2222-222222222222',other='33333333-3333-3333-3333-333333333333';
  await db.query('insert into side_private.student_claims values($1,$2),($3,$4)',[a.empresa_id,uid,b.empresa_id,other]);
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[a.empresa_id,{decisions_submitted:true,decision_state:{__cyclePlans:{1:{state:{HILO:{round:1,quantities:{hilo_std:1300}}}}}}}]);
  await db.query("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id=$1",[game.id]);
  await db.query("select set_config('test.role','service_role',false)");await db.exec('set role service_role');
  const order=await rpc(db,'side_confirm_material_order_v1',{p_partida_id:game.id,p_empresa_id:a.empresa_id,p_ciclo:1,p_sku:'hilo_std'});
  await rpc(db,'side_record_material_receipt_v1',{p_order_id:order.orderId,p_receipt_id:'preview-r',p_quantity:300,p_day:7});
  const actual=await rpc(db,'side_material_context_v1',{p_partida_id:game.id,p_empresa_id:a.empresa_id,p_cutoff_day:29});await db.exec('reset role');
  await db.query("select set_config('test.uid',$1,false)",[uid]);await db.exec('set role authenticated');
  const args={p_partida_id:game.id,p_empresa_id:a.empresa_id,p_ciclo:1},book=await rpc(db,'side_material_preview_v1',args);
  assert.deepEqual(book.events,actual.events);assert.equal(book.revision,actual.revision);assert.equal(book.cutoffDay,29);
  await assert.rejects(()=>rpc(db,'side_material_preview_v1',{...args,p_empresa_id:b.empresa_id}),/No autorizado/);
  await assert.rejects(()=>rpc(db,'side_material_preview_v1',{...args,p_ciclo:2}),/Contexto temporal/);
  await db.query("select set_config('test.uid',$1,false)",[other]);await assert.rejects(()=>rpc(db,'side_material_preview_v1',args),/No autorizado/);
  await db.query("select set_config('test.uid',$1,false)",[professor]);assert.equal((await rpc(db,'side_material_preview_v1',args)).revision,actual.revision);
  await db.query("select set_config('test.uid','',false)");await assert.rejects(()=>rpc(db,'side_material_preview_v1',args),/No autorizado/);
  await db.exec('reset role');await db.exec('set role anon');await assert.rejects(()=>rpc(db,'side_material_preview_v1',args),/permission denied/i);
 }finally{await db.close();}
});
