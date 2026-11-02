"""Check restored seals, Vault, inactive cron restoration, and real local cron→Edge.

Run after fase01_restore.py and fase01_vault.py restore. Never targets production.
"""
from pathlib import Path
import json,subprocess,sys,time
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
source=Path(sys.argv[1]).resolve();assert source.is_relative_to(PROJECT)
db=sys.argv[2] if len(sys.argv)>2 else 'fase01_restore2'
assert db.startswith('fase01_restore') and db.replace('_','').isalnum()
def sql(query,database='postgres'):
    r=subprocess.run(['docker','exec','-i','supabase_db_fase01local','psql','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-Atq'],input=query.encode(),capture_output=True)
    if r.returncode:raise RuntimeError(next((l for l in r.stderr.decode(errors='replace').splitlines() if 'ERROR:' in l),'SQL failed'))
    return r.stdout.decode().strip()
baseline=json.loads((source/'production-verification.json').read_text(encoding='utf-8-sig'))['rows'][0]['verification']
restored=json.loads(sql("select json_build_object('closure_count',count(*),'closure_hash',md5(string_agg(md5(cierre::text),'' order by partida_id,ciclo))) from side_business_closures",db))
assert restored['closure_count']==baseline['closure_count'] and restored['closure_hash']==baseline['closure_hash']
vault=json.loads(sql("select json_build_object('count',count(*),'fingerprint',md5(string_agg(decrypted_secret,'' order by name))) from vault.decrypted_secrets",db))
assert vault['count']==baseline['vault_count'] and vault['fingerprint']==baseline['vault_fingerprint']
# Register the exported command against the unexposed restore DB, INACTIVE.
# The unmodified production URL in the restored function is never invoked.
job=json.loads((source/'cron-jobs.json').read_text(encoding='utf-8-sig'))['rows'][0]
q=lambda s:"'"+s.replace("'","''")+"'"
jobid=sql("select cron.schedule_in_database('fase01-inactive-restoration',"+q(job['schedule'])+','+q(job['command'])+','+q(db)+",'supabase_admin',false)")
assert sql(f"select not active and database={q(db)} and schedule={q(job['schedule'])} from cron.job where jobid={jobid}")=='t'
sql(f'select cron.unschedule({jobid})')
# The API database has only QA fixtures. Its wrapper was rewritten by the setup
# to the local Kong URL and its Vault token is local-only.
definition=sql("select pg_get_functiondef('public.side_invocar_cierre_programado()'::regprocedure)")
assert 'http://kong:8000/' in definition and 'plfuwfdpsagzrlveqkvl.supabase.co' not in definition
before=sql('select coalesce(max(id),0) from net._http_response')
jobid=sql("select cron.schedule('fase01-local-proof','1 second','select public.side_invocar_cierre_programado();')")
try:
    response=None
    for attempt in range(25):
        time.sleep(1)
        text=sql(f"select json_build_object('status',status_code,'content',content) from net._http_response where id>{before} order by id desc limit 1")
        if text:response=json.loads(text);break
    assert response and response['status']==200,response
    assert json.loads(response['content'])['success'] is True,response
    assert int(sql(f"select count(*) from cron.job_run_details where jobid={jobid} and status='succeeded'"))>0
finally:sql(f'select cron.unschedule({jobid})')
out={'restoredSeals':restored,'vaultRecoverable':True,'inactiveScheduleRestored':True,'localCronEdgeHTTP':response['status'],'localEconomicSuccess':True,'productionUntouched':True}
(ROOT/'tests/output/fase01/recovery.json').write_text(json.dumps(out,indent=2))
print('PASS full recovery: sealed history unchanged, Vault decrypts, cron restored inactive, real local cron -> Edge succeeds')
