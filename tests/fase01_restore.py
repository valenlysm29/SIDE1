"""Restore real schema/data into an unexposed database, never the API database.

Usage: python tests/fase01_restore.py <directory containing production-*.sql>
The production scheduler is inspected, never invoked from the restored copy.
"""
from pathlib import Path
import hashlib,json,subprocess,sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1]).resolve()
PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
assert SOURCE.is_relative_to(PROJECT)
CONTAINER='supabase_db_fase01local';DB=sys.argv[2] if len(sys.argv)>2 else 'fase01_restore'
assert DB.startswith('fase01_restore') and DB.replace('_','').isalnum()
def run(args,data=None):
    r=subprocess.run(['docker','exec','-i',CONTAINER]+args,input=data,capture_output=True)
    if r.returncode:
        # Do not echo COPY data (may include credentials or private records).
        errors=r.stderr.decode('utf8',errors='replace').splitlines()
        raise RuntimeError(next((line for line in errors if 'ERROR:' in line),'Restore command failed'))
    return r.stdout.decode('utf8')
def sql(source):
    return run(['psql','-U','supabase_admin','-d',DB,'-v','ON_ERROR_STOP=1','-Atq'],source.encode() if isinstance(source,str) else source)

run(['createdb','-U','postgres','-T','template0',DB])
sql('create schema extensions; create schema vault; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions; create extension supabase_vault with schema vault; create extension pg_net with schema extensions;')
sql((SOURCE/'production-schema.sql').read_bytes())
sql((SOURCE/'production-data.sql').read_bytes())
tables=['public.partidas','public.participantes','public.side_business_closures','public.side_student_state','side_private.student_claims','auth.users']
summary={}
for table in tables:
    summary[table]=json.loads(sql(f"select json_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from {table} t"))
try:
    summary['vault']=json.loads(sql("select json_build_object('count',count(*),'fingerprint',md5(string_agg(decrypted_secret,'' order by name))) from vault.decrypted_secrets"))
except RuntimeError as error:
    summary['vault']={'decryptable':False,'error':str(error)}
summary['sourceFiles']={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in SOURCE.glob('production-*.sql')}
summary['database']=DB
summary['cron']=json.loads((SOURCE/'cron-jobs.json').read_text(encoding='utf-8-sig'))
out=ROOT/'tests/output/fase01/restore.json';out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(summary,indent=2),encoding='utf8')
print('PASS restored schema, public/side_private/Auth data and foreign keys; Vault status recorded; production jobs NOT invoked')
