'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const migration=fs.readFileSync('supabase/migrations/20261103_validacion_avance_docente.sql','utf8');
for(const cycles of [3,6])test(`avance PostgreSQL: ${cycles} ciclos, dos empresas y reintento con el mismo ciclo esperado`,async()=>{
 const db=await database();
 try{
  await db.exec(`alter table participantes add column if not exists expulsada_at timestamptz;
   create function public.side_docente_autorizado() returns boolean language sql as $$select auth.uid() is not null$$;
   create table side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo));
   create table side_closure_processing_status(partida_id uuid,ciclo integer,status text,code text,error text);`);
  await db.exec(fs.readFileSync('supabase/migrations/20261102022758_impedir_avance_sin_cierre.sql','utf8'));
  await db.exec(migration);await db.exec(migration);
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
   await submit(companies[1],n,true,'no-plan');assert.equal((await status()).missing.length,1,'plan automático no confirma');
   await submit(companies[1],n,true);assert.equal((await status()).ready,false,'requiere cierre');
   const synced=await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'sincronizar'});
   assert.equal(synced.configuracion.runtime.phase,'results','todas las confirmaciones inician el cierre oficial');
   await rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'cerrar',p_expected_round:n});
   assert.equal((await status()).ready,false);
   const action=()=>rpc(db,'controlar_partida',{p_partida_id:g.id,p_accion:'avanzar',p_expected_round:n});
   assert.equal((await action()).code,'AVANCE_NO_DISPONIBLE');
   const rows=Object.fromEntries(companies.map(id=>[id,{receipt:{},financial:{},state:{}}]));
   await db.query('insert into side_business_closures values($1,$2,$3)',[g.id,n,{resultadosPorEmpresa:rows}]);
   assert.equal((await status()).ready,true);
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
