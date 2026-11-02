"""Exercise candidate -> deployed v9 -> candidate in the local real Edge runtime."""
from pathlib import Path
import hashlib,json,shutil,subprocess,time,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
OUT=ROOT/'tests/output/fase01/finalizacion';target=PROJECT/'.codex-work/fase01-local/supabase/functions/side-business-close'
assert target.is_relative_to(PROJECT)
files=['index.ts','runtime.mjs','legacy-runtime.mjs','route.mjs'];source=ROOT/'supabase/functions/side-business-close'
blocked=json.loads((OUT/'historical-fixture.json').read_text())['game']
def fingerprint():return subprocess.check_output(['docker','exec','supabase_db_fase01local','psql','-U','postgres','-Atc',"select md5(string_agg(md5(cierre::text),'' order by partida_id,ciclo)) from side_business_closures;select md5(string_agg(md5(snapshot::text),'' order by empresa_id)) from side_student_state;"],encoding='utf8')
def invoke(token):
 request=urllib.request.Request('http://127.0.0.1:33421/functions/v1/side-business-close',data=b'{}',headers={'Content-Type':'application/json','x-side-cron-token':token})
 try:
  with urllib.request.urlopen(request,timeout=45) as response:return response.status,response.read()
 except urllib.error.HTTPError as error:return error.code,error.read()
def exercise():
 for attempt in range(25):
  try:
   code,_=invoke('invalid')
   if code==401:break
  except (urllib.error.URLError,TimeoutError):pass
  time.sleep(.3)
 else:raise AssertionError('Local Edge unavailable')
 code,body=invoke('fase01-local-only');data=json.loads(body)
 assert code==503 and not data['success']
 own=[r for r in data['results'] if r['game']==blocked]
 assert own and all(not r['success'] and r['code']=='DECISION_INVALIDA' for r in own)
 return {'invalidToken':401,'historicalErrorExplicit':True,'httpStatus':code}
before=fingerprint();results={}
try:
 for label,folder in [('rollbackV9',OUT/'edge-v9'),('candidate',source)]:
  for name in files:shutil.copy2(folder/name,target/name)
  time.sleep(1)
  results[label]=exercise()
  assert fingerprint()==before,'Economic data changed during Edge rollback'
finally:
 for name in files:shutil.copy2(source/name,target/name)
results['economicDataUnchanged']=True
results['candidateFiles']={name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in files}
(OUT/'edge-rollback.json').write_text(json.dumps(results,indent=2))
print('PASS real Edge v9 rollback and candidate reapply; auth/error guards intact; no economic writes')
