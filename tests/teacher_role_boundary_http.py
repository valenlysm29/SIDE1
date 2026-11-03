"""Reproduce and fix profile-to-teacher escalation on the dedicated clean stack."""
from pathlib import Path
import json,subprocess,uuid,urllib.request,urllib.error,sys
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
status=json.loads(subprocess.check_output([str(ROOT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(PROJECT/'.codex-work/side-clean-install'),'-o','json'],stderr=subprocess.DEVNULL));BASE=status['API_URL'];assert BASE=='http://127.0.0.1:33621'
def req(path,args,token=None,method='POST'):
 request=urllib.request.Request(BASE+path,data=json.dumps(args).encode(),headers={'apikey':status['ANON_KEY'],'Authorization':'Bearer '+(token or status['ANON_KEY']),'Content-Type':'application/json'},method=method)
 try:
  with urllib.request.urlopen(request,timeout=30) as f:
   data=f.read();return f.status,json.loads(data) if data else None
 except urllib.error.HTTPError as error:return error.code,json.loads(error.read())
def session(domain):
 email=uuid.uuid4().hex+'@'+domain;password=uuid.uuid4().hex+'Aa1!'
 assert req('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},status['SERVICE_ROLE_KEY'])[0]==200
 return req('/auth/v1/token?grant_type=password',{'email':email,'password':password})[1]
def rpc(name,args,s=None):return req('/rest/v1/rpc/'+name,args,s['access_token'] if s else None)
def sql(source):
 result=subprocess.run(['docker','exec','-i','supabase_db_sidecleanfinal','psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=source.encode(),capture_output=True)
 assert result.returncode==0,result.stderr.decode(errors='replace');return result.stdout.decode().strip()
config={'lifecycleVersion':2,'cycles':3,'roundHours':0,'roundMinutes':1,'integrationDurationMinutes':5,'cycleCloseMode':'manual','enabledEvents':[]}
def create(s):return rpc('crear_sala_docente',{'p_config':config,'p_nombre':'QA Role Boundary','p_curso':'QA','p_segmento':'Estandar','p_request_id':str(uuid.uuid4()),'p_reemplazar_id':None},s)
bad=session('example.invalid');code,before=create(bad);assert code==200 and before.get('id'),before
sql("update partidas set configuracion=configuracion||'{\"runtime\":{\"phase\":\"cancelled\"},\"phase\":\"cancelled\"}'::jsonb where nombre='QA Role Boundary'")
migration=(ROOT/'supabase/migrations/20261103002234_teacher_authorization.sql').read_text(encoding='utf8');sql(migration);sql(migration)
checks=[]
code,after=create(bad);assert code==403,(code,after);checks.append('unauthorized profile rejected')
code,anon=req('/auth/v1/signup',{});assert code==200,(code,anon)
assert create(anon)[0]==403;checks.append('authenticated anonymous student rejected')
code,spoof=req('/auth/v1/user',{'data':{'role':'teacher','correo':'teacher@upch.pe','email':'teacher@upch.pe'}},bad['access_token'],'PUT');assert code==200
assert create(bad)[0]==403;checks.append('editable metadata cannot grant role')
code,forged=req('/rest/v1/partidas',{'profesor_id':bad['user']['id'],'nombre':'QA Forged Role','configuracion':config},bad['access_token']);assert code==403,(code,forged);checks.append('direct table insert rejected')
args={'p_partida_id':before['id'],'p_accion':'pausar','p_expected_round':1}
assert rpc('controlar_partida',args,bad)[0]==403;checks.append('own historical QA game does not confer teacher role')
good=session('upch.pe');code,game=create(good);assert code==200 and game.get('id'),(code,game);checks.append('verified institutional teacher can create')
assert rpc('controlar_partida',{'p_partida_id':game['id'],'p_accion':'sincronizar','p_expected_round':1},good)[0]==200
assert rpc('cancelar_partida',{'p_partida_id':game['id']},good)[0]==200;checks.append('authorized owner controls and cancels')
# A valid signed JWT cannot override the current verified email in PostgreSQL.
sql(f"update auth.users set email_confirmed_at=null where id='{good['user']['id']}'")
assert create(good)[0]==403;checks.append('stale JWT cannot override unverified current identity')
assert sql("select count(*) from pg_tables where schemaname='public' and not rowsecurity")=='0'
assert sql("select count(*) from cron.job where active and jobname='side-business-close'")=='0'
(ROOT/'tests/output/finalizacion-integral/teacher-boundary.json').write_text(json.dumps({'reproducedBefore':True,'migrationTwice':True,'checks':checks,'allPublicTablesRls':True,'cronDisabled':True},indent=2),encoding='utf8')
print('PASS original escalation reproduced; 8 real Auth/RPC/Data API checks; migration idempotent; authorized teacher retained')
