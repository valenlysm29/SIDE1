'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const name='side-events-readonly-'+crypto.randomBytes(5).toString('hex');
const docker=(args,input)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],...(input===undefined?{}:{input})});
const sql=text=>docker(['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],text);
test('PostgreSQL aísla la lectura de eventos al servicio y preserva sorteos', {timeout:60000},async()=>{
 try{
  docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
  let ready=false;for(let i=0;i<80;i++){try{docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}assert.ok(ready);
  const setup=`create role anon; create role authenticated; create role service_role;
   create table public.partidas(id uuid primary key,configuracion jsonb);
   create table public.participantes(partida_id uuid,empresa_id bigint,expulsada_at timestamptz);
   create table public.side_event_catalog(id text primary key,scope text);
   create table public.side_individual_event_schedule(empresa_id bigint,ciclo int,events jsonb);
   insert into public.side_event_catalog values('PE01','group'),('PE91','individual');
   insert into public.partidas values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{"economicRulesVersion":"utility-v1","cycles":3,"enabledEvents":["PE01","PE91"],"eventSchedule":{"1":{"group":["PE01"]}}}');
   insert into public.participantes values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,null);
   insert into public.side_individual_event_schedule values(1,1,'["PE91"]');`;
  const migration=fs.readFileSync('supabase/migrations/20261102015806_side_eventos_historicos_contexto.sql','utf8');sql(setup+'\n'+migration);
  const call="select public.side_legacy_event_context_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,1)::text;";
  assert.throws(()=>sql('set role authenticated; '+call),/permission denied/i);
  const result=JSON.parse(sql('set role service_role; '+call));assert.deepEqual(result.groupByCycle,{'1':['PE01']});assert.deepEqual(result.individualByCycle,{'1':['PE91']});
  const missing=JSON.parse(sql("set role service_role; select public.side_legacy_event_context_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,2)::text;"));assert.equal(missing.code,'EVENTOS_NO_VERIFICADOS');
  assert.equal(sql('select count(*) from public.side_individual_event_schedule;').trim(),'1');
 }finally{try{docker(['rm','-f',name]);}catch{}}
});
