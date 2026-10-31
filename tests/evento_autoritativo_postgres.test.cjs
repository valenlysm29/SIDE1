'use strict';
// Real PostgreSQL concurrency, isolated Docker container; no network or remote DB.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{spawn,execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const name='side-v2-concurrency-'+crypto.randomBytes(5).toString('hex');
const run=(args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const sql=text=>new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));p.stdin.end(text);});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('PostgreSQL: dos conexiones serializan asignaciones y rechazan intensidad divergente',{timeout:60000},async()=>{
 try{
  run(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
  let ready=false;for(let i=0;i<80;i++){try{run(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await pause(250);}}assert.ok(ready,'PostgreSQL no inició');
  const setup=`create role anon; create role authenticated; create role service_role; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
   create table public.partidas(id uuid primary key,profesor_id uuid,configuracion jsonb);
   create table public.empresas(id bigint primary key);
   create table public.participantes(partida_id uuid,empresa_id bigint);
   create table public.side_business_closures(partida_id uuid,ciclo integer,cierre jsonb,primary key(partida_id,ciclo));
   create function public.side_runtime(cfg jsonb) returns jsonb language sql stable as $$select cfg->'runtime'$$;
   insert into public.partidas values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','{"economicEventsVersion":"demand-share-v1","cycles":6,"runtime":{"round":1,"phase":"integration"}}');
   insert into public.empresas values(1),(2);insert into public.participantes values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1),('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2);`;
  let result=await sql(setup+'\n'+fs.readFileSync('supabase/migrations/20261031025358_desafios_autoritativos_v1.sql','utf8'));assert.equal(result.code,0,result.err);
  const tx=(company,intensity,delay,event='PE69')=>`begin; select set_config('test.uid','11111111-1111-1111-1111-111111111111',false); set role authenticated; select public.side_assign_event_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',${company},1,'${event}',${intensity}); select pg_sleep(${delay}); commit;`;
  const first=sql(tx(1,20,1));await pause(200);const second=sql(tx(1,10,0));const [a,b]=await Promise.all([first,second]);assert.notEqual(a.code===0,b.code===0,'solo una intensidad debe confirmarse');assert.match(a.code===0?b.err:a.err,/otra intensidad/);
  const winner=a.code===0?20:10;const retry=await sql(tx(1,winner,0));assert.equal(retry.code,0,retry.err);
  result=await sql("select count(*),min(intensity),max(intensity) from public.side_event_assignments_v1 where empresa_id=1");assert.equal(result.out.trim(),`1|${winner}|${winner}`);
  const third=sql(tx(2,20,1));await pause(200);const fourth=sql(tx(2,15,0,'PE71'));const [c,d]=await Promise.all([third,fourth]);assert.notEqual(c.code===0,d.code===0,'solo un evento debe confirmarse');assert.match(c.code===0?d.err:c.err,/otro desafío/);
  result=await sql("select count(*) from public.side_event_assignments_v1 where empresa_id=2");assert.equal(result.out.trim(),'1');
  result=await sql(fs.readFileSync('supabase/migrations/20261031043153_programacion_desafios_autoritativa.sql','utf8')+"\nupdate public.partidas set configuracion=configuracion||'{\"enabledEvents\":[\"PE68\",\"PE69\"]}'::jsonb;");assert.equal(result.code,0,result.err);
  const draw=delay=>`begin; select set_config('test.uid','11111111-1111-1111-1111-111111111111',false); set role authenticated; select public.side_draw_events_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',3); select pg_sleep(${delay}); commit;`;
  const [drawA,drawB]=await Promise.all([sql(draw(1)),sql(draw(0))]);assert.equal(drawA.code,0,drawA.err);assert.equal(drawB.code,0,drawB.err);
  assert.match(drawA.out+drawB.out,/"reused": true/);assert.match(drawA.out+drawB.out,/"reused": false/);
  result=await sql('select count(*) from public.side_event_draws_v1 where source_cycle=3');assert.equal(result.out.trim(),'1');
 }finally{try{run(['rm','-f',name]);}catch{}}
});
