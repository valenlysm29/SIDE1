"""Test additive teacher guard forward / exact rollback / forward on unexposed restore."""
from pathlib import Path
import subprocess,json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'tests/output/finalizacion-integral';DB='fase01_restore4'
def sql(source):
 r=subprocess.run(['docker','exec','-i','supabase_db_fase01local','psql','-U','supabase_admin','-d',DB,'-Atq','-v','ON_ERROR_STOP=1'],input=source.encode(),capture_output=True)
 assert r.returncode==0,next((x for x in r.stderr.decode(errors='replace').splitlines() if 'ERROR' in x),'SQL failed');return r.stdout.decode().strip()
names=['crear_sala_docente','recuperar_sala_docente','controlar_partida','cancelar_partida','avanzar_ciclo','guardar_puntaje_docente','side_expulsar_empresa','side_liberar_empresa','side_podio_docente','side_draw_events_v1','side_assign_event_v1','side_guardar_configuracion_v19','side_registrar_entrega_proveedor_v1','side_correo_docente_permitido']
quoted=','.join("'"+n+"'" for n in names)
functions=json.loads(sql("select jsonb_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ("+quoted+")"))
policies=json.loads(sql("select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'cmd',cmd,'qual',qual,'check',with_check)) from pg_policies where schemaname='public' and tablename in ('profesores','partidas')"))
rollback=['begin;']+functions
for p in policies:
 if p['name'] not in ['profesor ve su perfil','profesor actualiza su perfil','profesor crea partidas','profesor actualiza sus partidas','profesor elimina sus partidas']:continue
 name=p['name'].replace('"','""');rollback.append(f'drop policy if exists "{name}" on public.{p["table"]};');s=f'create policy "{name}" on public.{p["table"]} for {p["cmd"]} to authenticated'
 if p['qual']:s+=' using ('+p['qual']+')'
 if p['check']:s+=' with check ('+p['check']+')'
 rollback.append(s+';')
rollback+=['drop function public.side_docente_autorizado();','commit;']
rollback='\n'.join(x.rstrip(';')+';' for x in rollback)
(OUT/'rollback-teacher.sql').write_text(rollback,encoding='utf8')
fingerprint="select jsonb_build_object('games',(select md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from partidas t),'students',(select md5(string_agg(md5(snapshot::text),'' order by empresa_id)) from side_student_state),'seals',(select md5(string_agg(md5(cierre::text),'' order by partida_id,ciclo)) from side_business_closures))"
state=sql(fingerprint);source=(ROOT/'supabase/migrations/20261103002234_teacher_authorization.sql').read_text(encoding='utf8');sql(source);assert state==sql(fingerprint)
assert sql("select bool_and(position('SIDE_TEACHER_AUTH_V1' in p.prosrc)>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ("+','.join("'"+n+"'" for n in names[:-1])+")")=='t'
sql(rollback);assert state==sql(fingerprint);sql(source);assert state==sql(fingerprint)
(OUT/'teacher-rollback.json').write_text(json.dumps({'database':DB,'forward':True,'rollback':True,'reapply':True,'economicHashesUnchanged':True,'functionsProtected':13},indent=2),encoding='utf8')
print('PASS restored real production: teacher forward/rollback/reapply, 13 RPC guards, unchanged games/students/seals')
