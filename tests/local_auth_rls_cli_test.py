import subprocess,json,urllib.request,urllib.error,uuid,os
name=os.environ.get('SIDE_LOCAL_TEST','side-cli-verificacion')
if name not in ('side-cli-verificacion','side-cli-repite'):raise SystemExit('Only isolated local projects are allowed')
workdir='.codex-work/'+name
status=json.loads(subprocess.check_output([r'.\node_modules\.bin\supabase.cmd','status','--workdir',workdir,'-o','json'],encoding='utf8',stderr=subprocess.DEVNULL))
key=status['ANON_KEY'];base=status['API_URL'];container='supabase_db_'+name.replace('-','')
if not base.startswith('http://127.0.0.1:'):raise SystemExit('Refusing non-local API')
def req(path,payload=None,token=None,method=None):
 data=json.dumps(payload).encode() if payload is not None else None
 r=urllib.request.Request(base+path,data=data,method=method,headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def sql(s):return subprocess.check_output(['docker','exec',container,'psql','-U','postgres','-d','postgres','-At','-c',s],encoding='utf8').strip()
sessions=[]
for i in range(3):
 code,session=req('/auth/v1/signup',{});assert code==200,(code,session);sessions.append(session)
a,b,t=sessions;tid=t['user']['id']; code='TEST'+uuid.uuid4().hex[:4].upper(); game=str(uuid.uuid4())
sql(f"insert into public.profesores(id,nombre,apellido) values ('{tid}','Test','Teacher') on conflict(id) do nothing; insert into public.partidas(id,profesor_id,nombre,codigo,configuracion) values ('{game}','{tid}','TEST-RLS','{code}', '{{}}');")
def join(session,name,companykey=None):return req('/rest/v1/rpc/side_ingresar_empresa_segura',{'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name,'p_clave':companykey},session['access_token'])
sa,ra=join(a,'TEST-A');sb,rb=join(b,'TEST-B');assert ra.get('success') and rb.get('success'),(ra,rb)
for sess,expected,forbidden in [(a,ra,rb),(b,rb,ra)]:
 payload={'p_codigo':code,'p_nombre_legal':'TEST-B' if sess==a else 'TEST-A','p_nombre_comercial':'TEST-B' if sess==a else 'TEST-A'}
 st,out=req('/rest/v1/rpc/obtener_estado_estudiante',payload,sess['access_token']);assert not out.get('success') and out.get('code')=='CREDENCIALES_INVALIDAS',(st,out)
 st,out=req('/rest/v1/side_student_state?select=empresa_id',token=sess['access_token']);assert st in (200,401,403),(st,out)
 if st==200:assert not any(x['empresa_id']==forbidden['empresa_id'] for x in out),out
st,out=join(b,'TEST-A');assert out.get('code')=='CLAVE_REQUERIDA',out
st,out=join(b,'TEST-A',ra['clave_empresa']);assert out.get('success'),out

args={'p_partida_id':game,'p_empresa_id':ra['empresa_id'],'p_expulsar':True}
st,out=req('/rest/v1/rpc/side_expulsar_empresa',args,a['access_token']);assert not out.get('success') and out.get('code')=='NO_AUTORIZADO',(st,out)
st,out=req('/rest/v1/rpc/side_expulsar_empresa',args,t['access_token']);assert out.get('success') and out.get('expulsada_at'),(st,out)
st,out=join(b,'TEST-A');assert out.get('code')=='EMPRESA_EXPULSADA',(st,out)
args['p_expulsar']=False
st,out=req('/rest/v1/rpc/side_expulsar_empresa',args,t['access_token']);assert out.get('success') and out.get('expulsada_at') is None,(st,out)
st,out=join(b,'TEST-A');assert out.get('success'),(st,out)
st,out=req('/rest/v1/rpc/side_ingresar_empresa_segura',{'p_codigo':code,'p_nombre_legal':'TEST-B','p_nombre_comercial':'TEST-B'});assert st in (401,403) or not out.get('success'),(st,out)

# Usuario B ahora posee empresa A por recuperación; A no puede consultar ni modificar B.
foreign={'p_codigo':code,'p_nombre_legal':'TEST-B','p_nombre_comercial':'TEST-B'}
st,out=req('/rest/v1/rpc/guardar_estado_estudiante',{**foreign,'p_snapshot':{'decision_state':{}},'p_expected_revision':0},a['access_token']);assert not out.get('success') and out.get('code')=='CREDENCIALES_INVALIDAS',(st,out)
st,out=req('/rest/v1/side_student_state?empresa_id=eq.'+str(rb['empresa_id']),{'snapshot':{}},a['access_token'],method='PATCH');assert st in (401,403) or (st in (200,204) and not out),(st,out)
st,out=req('/rest/v1/rpc/side_consultar_cierre_negocio',{'p_partida_id':game,'p_ciclo':1},a['access_token']);assert out.get('code')=='NO_AUTORIZADO',(st,out)
print('PASS Auth y Data API: reingreso, RLS, expulsión, reactivación y rechazos.')
print('Partida local de prueba:',game)
