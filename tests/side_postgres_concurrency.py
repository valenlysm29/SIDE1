from pathlib import Path
import sys,uuid,threading,json,re
sys.path.insert(0,str(Path('tests/.python-deps').resolve()))
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
root=Path.cwd(); dsn='host=127.0.0.1 port=55439 user=side_test dbname=postgres'; name='side_test_'+uuid.uuid4().hex[:12]
with psycopg.connect(dsn,autocommit=True) as c:c.execute(sql.SQL('create database {}').format(sql.Identifier(name)))
target=f'host=127.0.0.1 port=55439 user=side_test dbname={name}'
read=lambda p:(root/p).read_text(encoding='utf-8-sig')
source=read('tests/lifecycle_db_fixture.cjs'); prelude=re.search(r'await db\.exec\(`(.*?)`\);',source,re.S).group(1)
with psycopg.connect(target,autocommit=True) as c:
 c.execute("do $$ begin if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if; if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;")
 c.execute(prelude.replace('create role anon; create role authenticated;', ''))
 for f in ['supabase/migrations/supabase_migration.sql','supabase/migrations/supabase_game_lifecycle.sql','supabase/migrations/supabase_student_admission.sql','supabase/migrations/20260930_preservar_opciones_decisiones.sql','supabase/migrations/20261009_sala_espera_identidad_exacta.sql']:
  c.execute(read(f).replace('create extension if not exists "pgcrypto";',''))
 c.execute("insert into auth.users(id,raw_user_meta_data,email) values('11111111-1111-1111-1111-111111111111','{}','test@example.invalid')")
 c.execute("select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)")
 c.execute("create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$; alter table participantes add column if not exists expulsada_at timestamptz")
 for f in ['docs/sql/20261023_despliegue_cierre_v19.sql','supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql','supabase/migrations/20261027_corregir_ventas_generales.sql','supabase/migrations/20261028_cierre_servidor.sql','supabase/migrations/20261028150647_cierre_sin_plan.sql']:c.execute(read(f))
 cfg={'lifecycleVersion':2,'cycleCloseMode':'manual','integrationDurationMinutes':5,'integrationMinutes':0,'cycles':1,'roundHours':0,'roundMinutes':10,'enabledEvents':[],'runtime':{'phase':'results','round':1}}
 game=c.execute("insert into partidas(profesor_id,nombre,configuracion) values ('11111111-1111-1111-1111-111111111111','TEST CONCURRENCY',%s) returning id,codigo",[Jsonb(cfg)]).fetchone()
 joined=c.execute("select ingresar_empresa(%s,'Prueba','Prueba')",[game[1]]).fetchone()[0]; eid=joined['empresa_id']; snap={'decision_state':{'__cyclePlans':{'1':{'state':{}}}},'cash_ledger':{},'financial_sections':{}}
 c.execute('insert into side_student_state(empresa_id,snapshot) values(%s,%s) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[eid,Jsonb(snap)])
 c.execute("update partidas set configuracion=jsonb_set(configuracion,'{runtime,phase}',to_jsonb('results'::text)) where id=%s",[game[0]])
 c.execute("select set_config('test.role','service_role',false)")
 ctx=c.execute('select side_contexto_cierre_negocio(%s,1)',[game[0]]).fetchone()[0]
 assert 'token' in ctx,ctx
 result={'state':{'__financialSnapshots':{},'__cycleSettlements':{},'__finishedGoods':{},'__inventarioMP':{}},'ledger':{},'receipt':{'round':1},'financial':{'balanceCaja':{'cajaFinal':100},'flujoCaja':{},'estadoResultados':{'ingresos':0,'costos':0,'utilidad':0}}}
 closure={'ciclo':1,'resultadosPorEmpresa':{str(eid):result}}
 responses=[]; errors=[]; barrier=threading.Barrier(2)
 def close():
  try:
   with psycopg.connect(target) as db:
    db.execute("select set_config('test.role','service_role',false)");barrier.wait()
    responses.append(db.execute('select side_guardar_cierre_negocio(%s,1,%s,%s)',[game[0],ctx['token'],Jsonb(closure)]).fetchone()[0])
  except Exception as e: errors.append(repr(e))
 threads=[threading.Thread(target=close) for _ in range(2)]
 for t in threads:t.start()
 for t in threads:t.join(30)
 assert not errors,errors
 assert len(responses)==2 and sorted(bool(x.get('reused')) for x in responses)==[False,True],responses
 assert c.execute('select count(*) from side_business_closures where partida_id=%s',[game[0]]).fetchone()[0]==1
 assert c.execute('select count(*) from reportes_ciclo where empresa_id=%s',[eid]).fetchone()[0]==1
 # Failure injected after closure insertion but before report write: the whole RPC rolls back.
 c.execute("select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)")
 second=c.execute("insert into partidas(profesor_id,nombre,configuracion) values ('11111111-1111-1111-1111-111111111111','TEST ROLLBACK',%s) returning id,codigo",[Jsonb(cfg)]).fetchone()
 member=c.execute("select ingresar_empresa(%s,'Rollback','Rollback')",[second[1]]).fetchone()[0]; eid2=member['empresa_id']
 c.execute('insert into side_student_state(empresa_id,snapshot) values(%s,%s) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[eid2,Jsonb(snap)])
 c.execute("update partidas set configuracion=jsonb_set(configuracion,'{runtime,phase}',to_jsonb('results'::text)) where id=%s",[second[0]])
 context2=c.execute('select side_contexto_cierre_negocio(%s,1)',[second[0]]).fetchone()[0]
 c.execute(sql.SQL("create function public.test_fail_report() returns trigger language plpgsql as $$ begin if new.empresa_id = {} then raise exception 'test failure'; end if; return new; end $$").format(sql.Literal(eid2)))
 c.execute('create trigger test_fail_report before insert on reportes_ciclo for each row execute function public.test_fail_report()')
 try: c.execute('select side_guardar_cierre_negocio(%s,1,%s,%s)',[second[0],context2['token'],Jsonb({'ciclo':1,'resultadosPorEmpresa':{str(eid2):result}})])
 except psycopg.errors.RaiseException: pass
 else: raise AssertionError('expected injected report failure')
 assert c.execute('select count(*) from side_business_closures where partida_id=%s',[second[0]]).fetchone()[0]==0
 assert c.execute('select count(*) from reportes_ciclo where empresa_id=%s',[eid2]).fetchone()[0]==0
 print('PASS PostgreSQL 17: failure during persistence rolls back closure and report atomically.')
 # A participant removed while closing must invalidate the context, not persist stale results.
 third=c.execute("insert into partidas(profesor_id,nombre,configuracion) values ('11111111-1111-1111-1111-111111111111','TEST ROSTER',%s) returning id,codigo",[Jsonb(cfg)]).fetchone()
 m3=c.execute("select ingresar_empresa(%s,'Roster','Roster')",[third[1]]).fetchone()[0]; eid3=m3['empresa_id']
 c.execute('insert into side_student_state(empresa_id,snapshot) values(%s,%s) on conflict(empresa_id) do update set snapshot=excluded.snapshot',[eid3,Jsonb(snap)])
 c.execute("update partidas set configuracion=jsonb_set(configuracion,'{runtime,phase}',to_jsonb('results'::text)) where id=%s",[third[0]])
 context3=c.execute('select side_contexto_cierre_negocio(%s,1)',[third[0]]).fetchone()[0]; outcome=[]
 with psycopg.connect(target) as removal:
  removal.execute('update participantes set expulsada_at=clock_timestamp() where empresa_id=%s',[eid3])
  def close_after_removal():
   with psycopg.connect(target) as db:
    db.execute("select set_config('test.role','service_role',false)")
    outcome.append(db.execute('select side_guardar_cierre_negocio(%s,1,%s,%s)',[third[0],context3['token'],Jsonb({'ciclo':1,'resultadosPorEmpresa':{str(eid3):result}})]).fetchone()[0])
  job=threading.Thread(target=close_after_removal);job.start()
  import time; time.sleep(.3); removal.commit();job.join(10)
 assert not job.is_alive() and outcome and outcome[0].get('code')=='ESTADO_DESACTUALIZADO',outcome
 assert c.execute('select count(*) from side_business_closures where partida_id=%s',[third[0]]).fetchone()[0]==0
 print('PASS PostgreSQL 17: roster change during close rejects stale context without persistence.')
 print('PASS PostgreSQL 17: simultaneous closes produce one closure and one report; retry reuses result.')
 print('Isolated database:',name)
