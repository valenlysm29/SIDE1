"""Real local Auth/Data API negative checks; no production access or mocks."""
from pathlib import Path
import json,os,subprocess,urllib.request,urllib.error,uuid
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
work=Path(os.environ['SIDE_FASE01_WORK']).resolve();assert work==PROJECT/'.codex-work/fase01-local'
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(work),'-o','json'],stderr=subprocess.DEVNULL))
base=status['API_URL'];assert base=='http://127.0.0.1:33421';key=status['ANON_KEY'];checks=[]
def req(path,payload=None,session=None,method='POST',extra=None):
    headers={'apikey':key,'Authorization':'Bearer '+(session['access_token'] if session else key),'Content-Type':'application/json',**(extra or {})}
    request=urllib.request.Request(base+path,data=json.dumps(payload).encode() if payload is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=40) as response:
            text=response.read();return response.status,json.loads(text) if text else None
    except urllib.error.HTTPError as error:return error.code,error.read().decode()
def rpc(name,args,session=None):return req('/rest/v1/rpc/'+name,args,session)
def sql(query):return subprocess.check_output(['docker','exec','supabase_db_fase01local','psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atc',query],encoding='utf8').strip()
def passed(name,condition):
    assert condition,name
    checks.append(name)
sessions=[req('/auth/v1/signup',{})[1] for _ in range(4)];teacher,other,a,b=sessions
gid=str(uuid.uuid4());code='SIDE-QA'+uuid.uuid4().hex[:6].upper()
config={'lifecycleVersion':2,'cycleCloseMode':'manual','integrationDurationMinutes':5,'cycles':3,'roundMinutes':10,'roundHours':0,'enabledEvents':[],'materialRulesVersion':'receipts-v1','materialLeadTimeDays':0,'materialPaymentMode':'cash'}
for s in (teacher,other):sql(f"insert into profesores(id,nombre,apellido) values('{s['user']['id']}','QA','Security') on conflict(id) do nothing")
sql(f"insert into partidas(id,profesor_id,nombre,codigo,configuracion) values('{gid}','{teacher['user']['id']}','QA Seguridad','{code}','{json.dumps(config)}')")
companies=[]
for session,name in ((a,'QA A'),(b,'QA B')):
    _,joined=rpc('side_ingresar_empresa_segura',{'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name,'p_clave':None},session)
    assert joined.get('success'),joined
    companies.append(joined['empresa_id'])
sql(f"update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',now(),'duration',600)) where id='{gid}'")
for session,company,allowed in [(teacher,None,True),(other,None,False),(a,companies[0],True),(a,companies[1],False),(b,companies[0],False),(None,companies[0],False)]:
    code_,_=rpc('side_historial_oficial',{'p_partida_id':gid,'p_empresa_id':company},session)
    passed('history ownership '+str(len(checks)),code_==200 if allowed else code_ in (401,403))
for session in (None,a,teacher,other):
    for name,args in [
        ('side_guardar_cierre_negocio',{'p_partida_id':gid,'p_ciclo':1,'p_token':'fake','p_cierre':{}}),
        ('side_guardar_cierre_excel',{'p_partida_id':gid,'p_ciclo':1,'p_token':'fake','p_cierre':{}}),
        ('side_registrar_estado_cierre',{'p_partida_id':gid,'p_ciclo':1,'p_success':True,'p_pending':False}),
        ('side_record_material_receipt_v1',{'p_order_id':'fake','p_receipt_id':'fake','p_quantity':1,'p_day':0}),
        ('side_validar_token_cierre',{'p_token':'fase01-local-only'}),
        ('side_iniciar_intento_cierre',{'p_run':gid,'p_partida':gid,'p_ciclo':1}),
        ('side_finalizar_intento_cierre',{'p_run':gid,'p_partida':gid,'p_ciclo':1,'p_success':True,'p_pending':False,'p_code':None,'p_error':None}),
        ('side_contexto_cierre_con_intento',{'p_run':gid,'p_partida_id':gid,'p_ciclo':1,'p_ciclo_intento':1}),
        ('side_guardar_cierre_con_intento',{'p_run':gid,'p_partida_id':gid,'p_ciclo':1,'p_token':'fake','p_cierre':{}}),
        ('side_estado_intento_cierre',{'p_partida':gid,'p_ciclo':1})]:
        code_,_=rpc(name,args,session);passed('server-only '+name+' '+str(len(checks)),code_ in (401,403,404))
for session in (None,a,teacher,other):
    code_,_=req('/rest/v1/side_business_closures?select=partida_id',session=session,method='GET')
    passed('direct closures denied '+str(len(checks)),code_ in (401,403))
for token in ('','invalid'):
    code_,_=req('/functions/v1/side-business-close',{},extra={'x-side-cron-token':token})
    passed('invalid scheduler token '+str(len(checks)),code_==401)
_,expelled=rpc('side_expulsar_empresa',{'p_partida_id':gid,'p_empresa_id':companies[0],'p_expulsar':True},teacher)
assert expelled.get('success'),expelled
code_,_=rpc('side_historial_oficial',{'p_partida_id':gid,'p_empresa_id':companies[0]},a)
passed('expelled identity cannot read history',code_ in (401,403))
passed('no forged closure persisted',sql(f"select count(*) from side_business_closures where partida_id='{gid}'")=='0')
# Local fixture is cancelled so production Edge discovery never processes it.
sql(f"update partidas set configuracion=configuracion||'{{\"phase\":\"cancelled\",\"runtime\":{{\"phase\":\"cancelled\"}}}}'::jsonb where id='{gid}'")
out=ROOT/'tests/output/fase01/security.json';out.write_text(json.dumps({'passed':checks,'failed':0},indent=2))
print('PASS',len(checks),'Auth/Data API/Edge negative checks, two teachers, two students, expulsion and no forged seal')
