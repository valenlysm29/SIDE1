"""Restore the actual production backup into a new local validation database."""
import subprocess,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'tests/output/history/production-backup';container='supabase_db_sidep01http';db='history_restore_qa4'
def run(args,data=None):return subprocess.run(['docker','exec','-i',container]+args,input=data,capture_output=True)
def sql(data):
 r=run(['psql','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],data)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf8',errors='replace')[-3000:])
 return r.stdout.decode('utf8')
created=run(['createdb','-U','postgres',db]);assert created.returncode==0,created.stderr
# Auth and extension definitions are local prerequisites; the production public
# and private schema/data below are restored verbatim. Foreign keys are retained.
prereq=run(['pg_dump','-U','postgres','-d','postgres','--section=pre-data','--schema=auth','--schema=extensions']);assert prereq.returncode==0
sql(prereq.stdout);sql(b'alter table auth.users add primary key(id);')
sql((out/'schema.sql').read_bytes());sql((out/'data.sql').read_bytes())
before=sql(b"select count(*),md5(coalesce(string_agg(md5(cierre::text),'' order by partida_id,ciclo),'')) from public.side_business_closures;")
files=['20261031041921_presentaciones_excel_v2.sql','20261102022758_impedir_avance_sin_cierre.sql','20261102024042_cierre_automatico_secuencial.sql','20261102034926_versionar_worker_cierres.sql','20261102040000_gracia_cierre_secuencial.sql','20261102044053_historical_continuity.sql','20261102044938_atomic_purchase_presentations.sql','20261102051739_closure_processing_status.sql']
for file in files:
 sql((root/'supabase/migrations'/file).read_bytes());print('PASS compatibility',file,flush=True)
after=sql(b"select count(*),md5(coalesce(string_agg(md5(cierre::text),'' order by partida_id,ciclo),'')) from public.side_business_closures;");assert before==after
evidence={'restored':True,'database':db,'sealedBefore':before,'sealedAfter':after,'migrations':files,'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.glob('*.sql')}}
(out.parent/'production-backup-verification.json').write_text(json.dumps(evidence,indent=2));print('PASS restored production backup: sealed history unchanged')
