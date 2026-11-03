"""Restore the production backup only into the dedicated local QA container."""
import subprocess,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
BACKUP=PROJECT/'output/respaldo_rentabilidad_20261102'
OUT=ROOT/'tests/output/rentabilidad_final';OUT.mkdir(parents=True,exist_ok=True)
CONTAINER='supabase_db_sideprofitfinal'
def sql(text):
 r=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=text,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf8',errors='replace')[-3000:])
 return r.stdout.decode('utf8').strip()
sql(b"do $$ declare r record; n bigint; begin for r in select schemaname,tablename from pg_tables where schemaname in ('public','side_private') loop execute format('select count(*) from %I.%I',r.schemaname,r.tablename) into n; if n>0 then raise exception 'QA database must be empty: %',r.tablename; end if; end loop; end $$;")
sql(b'drop schema public cascade; drop schema if exists side_private cascade; create schema public;')
sql(b'create extension if not exists pg_net; create extension if not exists pg_cron;')
for name in ['schema.sql','public.sql','side_private.sql']:
 assert (BACKUP/name).is_file() and (BACKUP/name).stat().st_size>1000
 sql((BACKUP/name).read_bytes())
rows=json.loads(sql(b"select jsonb_agg(jsonb_build_object('partida_id',partida_id,'ciclo',ciclo,'hash',md5(cierre::text)) order by partida_id,ciclo)::text from public.side_business_closures"))
before=json.loads((BACKUP/'hashes_before.json').read_text())
assert rows==before['fingerprints'], 'Restored closures differ from production fingerprints'
# The test invokes the real tracked Edge job itself. Disable only the local
# scheduler's external HTTP transport so the clone can never contact production.
assert sql(b'select count(*) from vault.decrypted_secrets')=='0'
sql(b"create or replace function public.side_invocar_cierre_programado() returns bigint language sql security definer set search_path=pg_catalog as 'select 0::bigint';")
sql(b"notify pgrst,'reload schema';")
evidence={'restored':True,'container':CONTAINER,'closures':len(rows),'allHashesMatch':True,'files':{name:{'bytes':(BACKUP/name).stat().st_size,'sha256':hashlib.sha256((BACKUP/name).read_bytes()).hexdigest()} for name in ['schema.sql','public.sql','side_private.sql']}}
(OUT/'backup_restored.json').write_text(json.dumps(evidence,indent=2))
print('PASS respaldo restaurado: '+str(len(rows))+' cierres idénticos; esquema y datos verificados')
