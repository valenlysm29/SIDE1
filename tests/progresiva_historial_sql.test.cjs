'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('historial 12 empresas × 6 ciclos: optimización conserva JSON, estados y autorización',{timeout:120000},async()=>{
 const db=new PGlite(),owner='11111111-1111-1111-1111-111111111111',student='22222222-2222-2222-2222-222222222222',game='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema side_private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table partidas(id uuid,profesor_id uuid,configuracion jsonb);
   create table empresas(id bigint,nombre_comercial text);
   create table participantes(partida_id uuid,empresa_id bigint,empresa text,expulsada_at timestamptz);
   create table side_private.student_claims(empresa_id bigint,owner_id uuid);
   create table side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,created_at timestamptz);
   create table side_closure_processing_status(partida_id uuid,ciclo integer,status text,code text,error text,updated_at timestamptz);
   create function public.side_ciclo_actual(c jsonb) returns integer language sql immutable as $$select (c->>'round')::integer$$;
   create function public.side_estado_intento_cierre(p uuid,c integer) returns text language sql stable as $$select case when c=4 then 'interrupted' else null end$$;
  `);
  await db.query('insert into partidas values($1,$2,$3)',[game,owner,{cycles:6,round:5,runtime:{phase:'decisions'}}]);
  for(let id=1;id<=12;id++){await db.query('insert into empresas values($1,$2)',[id,'QA '+id]);await db.query('insert into participantes values($1,$2,$3,null)',[game,id,'QA '+id]);}
  await db.query('insert into side_private.student_claims values(1,$1)',[student]);
  for(let round=1;round<=3;round++){
   const payload=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),{receipt:{round,sold:100+i},financial:{estadoResultados:{utilidadNeta:1000+i},balanceCaja:{cajaFinal:50000+i}},state:{notes:Array.from({length:400},(_,j)=>({id:j,detail:'cycle-'+round+'-company-'+i+'-'+j}))}}]));
   if(round===3)delete payload['12'].receipt;
   await db.query("insert into side_business_closures values($1,$2,$3,'2026-11-03')",[game,round,{resultadosPorEmpresa:payload}]);
  }
  await db.query("insert into side_closure_processing_status values($1,6,'error','TEST','failed',now())",[game]);
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  const call=async company=>(await db.query('select side_historial_oficial($1,$2) h',[game,company])).rows[0].h;
  await db.exec(fs.readFileSync(require.resolve('./fixtures/official_history_before_optimization.sql'),'utf8'));
  const start=performance.now(),before=await call(null),oldMs=performance.now()-start;
  await db.query("select set_config('test.uid',$1,false)",[student]);const studentBefore=await call(1);
  await assert.rejects(call(2),/autorizada/);
  await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261103161158_optimizar_historial_oficial_progresivo.sql'),'utf8'));
  await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261103162040_serializar_historial_sin_copias_jsonb.sql'),'utf8'));
  await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261103162526_historial_oficial_lectura_secuencial.sql'),'utf8'));
  await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/20261103163707_indice_lectura_cierres_por_empresa.sql'),'utf8'));
  await db.query("select set_config('test.uid',$1,false)",[owner]);const began=performance.now(),after=await call(null),newMs=performance.now()-began;
  assert.deepEqual(after,before);assert.equal(after.cycles.length,72);
  assert.equal(after.cycles.find(r=>r.ciclo===3&&r.empresa_id===12).status,'missing');
  assert.equal(after.cycles.find(r=>r.ciclo===4).status,'interrupted');
  assert.equal(after.cycles.find(r=>r.ciclo===5).status,'in_progress');
  assert.equal(after.cycles.find(r=>r.ciclo===6).status,'error');
  await db.query("select set_config('test.uid',$1,false)",[student]);assert.deepEqual(await call(1),studentBefore);
  await assert.rejects(call(2),/autorizada/);await assert.rejects(call(null),/autorizada/);
  await db.query("select set_config('test.uid','',false)");await assert.rejects(call(1),/Sesión requerida/);
  const future={receipt:{round:4,sold:5},financial:{estadoResultados:{utilidadNeta:123},balanceCaja:{cajaFinal:456}}};
  await db.query('insert into side_business_closures values($1,4,$2,now())',[game,{resultadosPorEmpresa:{1:future}}]);
  assert.deepEqual((await db.query('select result from side_private.official_company_closures where partida_id=$1 and ciclo=4 and empresa_id=1',[game])).rows[0].result,future,'El trigger indexa cierres futuros sin modificar su JSON');
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  assert.deepEqual((await call(1)).cycles.find(r=>r.ciclo===4).result,future);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from side_private.official_company_closures'),/permission denied/);
  await db.exec('reset role');
  console.log('HISTORY_PERFORMANCE',JSON.stringify({rows:72,oldMs:Math.round(oldMs),newMs:Math.round(newMs),identical:true}));
 }finally{await db.close()}
});
