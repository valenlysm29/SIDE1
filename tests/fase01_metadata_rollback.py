"""Prove forward/rollback/forward on a current unexposed production restore."""
from pathlib import Path
import json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];db=sys.argv[1] if len(sys.argv)>1 else 'fase01_restore3'
assert db.startswith('fase01_restore') and db.replace('_','').isalnum()
OUT=ROOT/'tests/output/fase01/finalizacion'
def sql(source):
 r=subprocess.run(['docker','exec','-i','supabase_db_fase01local','psql','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-Atq'],input=source.encode(),capture_output=True)
 if r.returncode:raise RuntimeError(next((s for s in r.stderr.decode(errors='replace').splitlines() if 'ERROR:' in s),'Local rollback failed'))
 return r.stdout.decode().strip()
def business():return sql("select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from partidas t;select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by empresa_id),'')) from side_student_state t;select md5(string_agg(md5(cierre::text),'' order by partida_id,ciclo)) from side_business_closures;")
metadata="select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('side_game_features','side_excel_features','side_guardar_cierre_excel','side_guardar_cierre_negocio');"
before=json.loads(sql(metadata));state=business()
assert sql("select to_regprocedure('public.side_restringir_costos_historicos()') is null")=='t'
rollback='begin;\n'+'\n'.join(row['definition']+';' for row in before if row['name'] in ('side_game_features','side_excel_features'))+'\ndrop trigger if exists zz_side_restringir_costos_historicos on public.partidas;\ndrop function if exists public.side_restringir_costos_historicos();\ncommit;\n'
(OUT/'rollback-metadata.sql').write_text(rollback,encoding='utf8')
files=['20261102025853_bloquear_eventos_costos_no_verificados.sql','20261102054323_fase01_security_paths.sql']
def forward():
 for name in files:sql((ROOT/'supabase/migrations'/name).read_text(encoding='utf-8-sig'))
 assert sql("select bool_and(not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('side_guardar_cierre_excel','side_guardar_cierre_negocio')")=='t'
 assert sql("select to_regprocedure('public.side_restringir_costos_historicos()') is not null")=='t'
 assert business()==state
forward();sql(rollback)
assert json.loads(sql(metadata))==before and business()==state
assert sql("select to_regprocedure('public.side_restringir_costos_historicos()') is null")=='t'
forward()
(OUT/'metadata-rollback.json').write_text(json.dumps({'database':db,'forward':True,'rollbackExactMetadata':True,'reapply':True,'businessDataUnchanged':True,'files':files},indent=2))
print('PASS current restore: forward, exact metadata rollback, reapply; business data unchanged')
