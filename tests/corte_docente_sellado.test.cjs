'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const migration=fs.readFileSync('supabase/migrations/20261103_validacion_avance_docente.sql','utf8');
for(const cycles of [3,6])test(`corte sellado PostgreSQL: ${cycles} ciclos, dos empresas y reintento con el mismo ciclo esperado`,async()=>{
 const db=await database();
 try{
  await db.exec(`alter table participantes add column if not exists expulsada_at timestamptz;
   create function public.side_docente_autorizado() returns boolean language sql as $$select auth.uid() is not null$$;
   create table side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo));
   create table side_closure_processing_status(partida_id uuid,ciclo integer,status text,code text,error text);`);
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  await db.exec(migration);await db.exec('create role service_role');await db.exec(fs.readFileSync('supabase/migrations/20261028150647_cierre_sin_plan.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20261104220123_avance_cierre_oficial.sql','utf8'));
  const g=await createGame(db,config({cycles,sequentialCloseVersion:'1'}));
  const companies=[];
  for(const name of ['Uno','Dos'])companies.push((await rpc(db,'ingresar_empresa',{p_codigo:g.codigo,p_nombre_legal:name,p_nombre_comercial:name})).empresa_id);
  await db.query("update partidas set estado='activa',configuracion=jsonb_set(configuracion,'{runtime}',$2) where id=$1",[g.id,{round:1,phase:'decisions',running:false,status:'paused',remaining:600,duration:600}]);
  const status=()=>rpc(db,'side_estado_avance',{p_partida_id:g.id});
  const submit=async(id,n,confirmed,source)=>db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[id,{round:n,decisions_submitted:confirmed,decision_state:{__cyclePlans:{[n]:{state:{},...(source?{source}:{})}}}}]);
  for(let n=1;n<=cycles;n++){
   assert.equal((await status()).missing.length,2);
   await submit(companies[0],n,false);assert.equal((await status()).missing.length,2,'borrador no confirma');
   await submit(companies[0],n,true);assert.equal((await status()).missing.length,1);
   await submit(companies[1],n,true,'no-plan');assert.equal((await status()).missing.length,1,'plan automÃ¡tico no confirma');
   await submit(companies[1],n,true);assert.equal((await status()).ready,false,'requiere cierre');
   const synced=await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'sincronizar'});
   assert.equal(synced.configuracion.runtime.phase,'results','todas las confirmaciones inician el cierre oficial');
   await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'cerrar',p_expected_round:n});
   assert.equal((await status()).ready,false);
   const action=()=>rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'avanzar',p_expected_round:n});
   assert.equal((await action()).code,'AVANCE_NO_DISPONIBLE');
   const rows=Object.fromEntries(companies.map(id=>[id,{receipt:{},financial:{},state:{}}]));
   await db.query('insert into side_business_closures values($1,$2,$3)',[g.id,n,{resultadosPorEmpresa:rows}]);
   await submit(companies[1],n,false);
   assert.equal((await status()).ready,true,'un cierre oficial completo permite continuar aunque el corte cerró un borrador');
   const [first,retry]=await Promise.all([action(),action()]);
   assert.equal(first.configuracion.runtime.round,Math.min(n+1,cycles));
   assert.equal(retry.configuracion.runtime.round,Math.min(n+1,cycles),'no salta ciclos');
  }
  assert.equal((await db.query('select estado from partidas where id=$1',[g.id])).rows[0].estado,'finalizada');
  assert.equal((await db.query('select count(*)::int n from side_business_closures where partida_id=$1',[g.id])).rows[0].n,cycles);
  await db.query("select set_config('test.uid','22222222-2222-2222-2222-222222222222',false)");
  await assert.rejects(status(),/no autorizado/);
 }finally{await db.close();}
});

test('recuperación de borradores: token estable al reintentar, compras confirmadas y sellos intactos',async()=>{
 const db=await database();
 try{
  await db.exec(`create role service_role;
   create function auth.role() returns text language sql as $$select 'service_role'::text$$;
   create function public.side_precios_v19_validos(jsonb) returns boolean language sql as $$select true$$;
   alter table participantes add column if not exists expulsada_at timestamptz;
   create table side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo));
   create table side_closure_processing_status(partida_id uuid,ciclo integer,status text,code text,error text);
   create table side_material_orders_v1(partida_id uuid,empresa_id bigint,ciclo integer);
   create function public.side_docente_autorizado() returns boolean language sql as $$select true$$;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261028150647_cierre_sin_plan.sql','utf8'));
  const fix=fs.readFileSync('supabase/migrations/20261104220123_avance_cierre_oficial.sql','utf8');
  await db.exec(fix);await db.exec(fix);
  const game=await createGame(db,config({materialRulesVersion:'receipts-v1'}));
  const company=(await rpc(db,'ingresar_empresa',{p_codigo:game.codigo,p_nombre_legal:'Draft',p_nombre_comercial:'Draft'})).empresa_id;
  await db.query("update partidas set estado='activa',configuracion=jsonb_set(configuracion,'{runtime}',$2) where id=$1",[game.id,{phase:'results',round:1}]);
  const draft={CUERO:{round:1,quantities:{cuero_std:100}},PRODUCCION_META:{round:1,moldTargets:{molde_1:10}}};
  const frozen={...draft};
  const snapshot={round:1,decisions_submitted:false,decision_state:{...draft,__cyclePlans:{1:{source:'no-plan',state:frozen}}}};
  await db.query('insert into side_student_state(empresa_id,snapshot) values($1,$2) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[company,snapshot]);
  const read=()=>rpc(db,'side_contexto_cierre_negocio',{p_partida_id:game.id,p_ciclo:1});
  const first=await read(),second=await read();
  assert.equal(first.token,second.token,'el reintento no invalida la revisión del trabajador concurrente');
  const snap=first.empresas[0].snapshot,plan=snap.decision_state.__cyclePlans[1];
  assert.deepEqual(plan.state.CUERO.quantities,{});
  assert.equal(plan.state.PRODUCCION_META.moldTargets.molde_1,0);
  assert.deepEqual(snap.decision_state.CUERO,draft.CUERO,'conserva el borrador original');
  assert.equal(snap.decisions_submitted,false,'no fabrica una confirmación');
  await db.query('insert into side_material_orders_v1 values($1,$2,1)',[game.id,company]);
  await db.query('update side_student_state set snapshot=$2 where empresa_id=$1',[company,snapshot]);
  const verified=await read();assert.deepEqual(verified.empresas[0].snapshot.decision_state.__cyclePlans[1].state.CUERO,draft.CUERO);
  const seal={resultadosPorEmpresa:{immutable:true}};
  await db.query('insert into side_business_closures values($1,1,$2)',[game.id,seal]);
  assert.deepEqual((await read()).cierre,seal);
 }finally{await db.close();}
});
