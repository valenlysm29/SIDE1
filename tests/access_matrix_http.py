"""Additional real Auth/RPC ownership matrix, local QA only; no production requests."""
from pathlib import Path
import json,subprocess,uuid,urllib.request,urllib.error,os
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(PROJECT/'.codex-work/fase01-local'),'-o','json'],stderr=subprocess.DEVNULL))
BASE=status['API_URL'];assert BASE=='http://127.0.0.1:33421';checks=[]
def req(path,args,token=None):
 r=urllib.request.Request(BASE+path,data=json.dumps(args).encode(),headers={'apikey':status['ANON_KEY'],'Authorization':'Bearer '+(token or status['ANON_KEY']),'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r,timeout=40) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:
  body=e.read()
  try:body=json.loads(body)
  except ValueError:body=body.decode()
  return e.code,body
def session():
 email=uuid.uuid4().hex+'@example.invalid';password=uuid.uuid4().hex+'Aa1!'
 assert req('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},status['SERVICE_ROLE_KEY'])[0]==200
 return req('/auth/v1/token?grant_type=password',{'email':email,'password':password})[1]
def sql(q):return subprocess.check_output(['docker','exec','supabase_db_fase01local','psql','-U','postgres','-Atq','-v','ON_ERROR_STOP=1','-c',q],encoding='utf8').strip()
def rpc(name,args,s):return req('/rest/v1/rpc/'+name,args,s['access_token'] if s else None)
t,other,a,b=[session() for _ in range(4)];gid=str(uuid.uuid4());code='SIDE-QA'+uuid.uuid4().hex[:7].upper()
for teacher in (t,other):sql(f"insert into profesores(id,nombre,apellido) values('{teacher['user']['id']}','QA','Access') on conflict do nothing")
config={'lifecycleVersion':2,'cycles':3,'roundMinutes':10,'roundHours':0,'cycleCloseMode':'manual','integrationDurationMinutes':5,'materialRulesVersion':'receipts-v1','enabledEvents':[]}
sql(f"insert into partidas(id,profesor_id,nombre,codigo,configuracion) values('{gid}','{t['user']['id']}','QA Access matrix','{code}','{json.dumps(config)}')")
companies=[]
for s,name in ((a,'Access A'),(b,'Access B')):
 code_,r=rpc('side_ingresar_empresa_segura',{'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name,'p_clave':None},s);assert code_==200 and r['success'],r;companies.append(r['empresa_id'])
cases=[
 ('side_contexto_cierre_excel',{'p_partida_id':gid,'p_ciclo':1}),
 ('side_consultar_cierre_negocio',{'p_partida_id':gid,'p_ciclo':1}),
 ('controlar_partida',{'p_partida_id':gid,'p_accion':'pausar','p_config':{},'p_expected_round':1}),
 ('side_expulsar_empresa',{'p_partida_id':gid,'p_empresa_id':companies[0],'p_expulsar':True}),
 ('side_liberar_empresa',{'p_partida_id':gid,'p_empresa_id':companies[0]}),
 ('side_draw_events_v1',{'p_partida_id':gid,'p_source_cycle':1}),
 ('side_assign_event_v1',{'p_partida_id':gid,'p_empresa_id':companies[0],'p_ciclo':1,'p_event_id':'PE23','p_intensity':1}),
 ('side_teacher_events_v1',{'p_partida_id':gid}),
 ('side_guardar_configuracion_v19',{'p_partida_id':gid,'p_config':{},'p_expected_revision':0}),
 ('guardar_puntaje_docente',{'p_partida_id':gid,'p_empresa_id':companies[0],'p_puntaje':20}),
 ('cancelar_partida',{'p_partida_id':gid}),
 ('obtener_reporte_empresa',{'p_empresa_id':companies[0],'p_ciclo':1})]
for name,args in cases:
 for caller in (None,other,b):
  code_,r=rpc(name,args,caller)
  denied=code_ in (401,403) or code_==200 and isinstance(r,dict) and (r.get('error') or r.get('success') is False)
  assert denied,(name,code_,r)
  checks.append({'rpc':name,'role':'anon' if caller is None else 'other teacher' if caller is other else 'other student','denied':True})
for caller,company in ((a,companies[1]),(b,companies[0]),(other,companies[0])):
 for name,args in [('side_material_preview_v1',{'p_partida_id':gid,'p_empresa_id':company,'p_ciclo':1}),('side_student_events_v1',{'p_partida_id':gid,'p_empresa_id':company})]:
  code_,r=rpc(name,args,caller);assert code_ in (401,403) or isinstance(r,dict) and (r.get('error') or r.get('success') is False),(name,code_,r);checks.append({'rpc':name,'denied':True})
for caller,company in ((t,None),(a,companies[0]),(b,companies[1])):
 code_,r=rpc('side_historial_oficial',{'p_partida_id':gid,'p_empresa_id':company},caller);assert code_==200 and 'cycles' in r
checks.append({'positive authorized history reads':3})
assert sql(f"select count(*) from side_business_closures where partida_id='{gid}'")=='0'
sql(f"update partidas set configuracion=configuracion||'{{\"phase\":\"cancelled\",\"runtime\":{{\"phase\":\"cancelled\"}}}}'::jsonb where id='{gid}'")
(ROOT/'tests/output/finalizacion-integral/access-matrix.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
print('PASS',len(checks)-1,'additional negative RPC checks, 3 authorized reads; no forged seal')
