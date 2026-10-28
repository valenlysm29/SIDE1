import subprocess,json,urllib.request,urllib.error,uuid
status=json.loads(subprocess.check_output([r'.\node_modules\.bin\supabase.cmd','status','--workdir','.codex-work/supabase-prueba','-o','json'],encoding='utf8',stderr=subprocess.DEVNULL))
key=status['ANON_KEY'];base='http://127.0.0.1:54321'
def req(path,payload=None,token=None,method=None):
 data=json.dumps(payload).encode() if payload is not None else None
 r=urllib.request.Request(base+path,data=data,method=method,headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r) as f:return f.status,json.load(f)
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def sql(s):return subprocess.check_output(['docker','exec','supabase_db_sideisolated','psql','-U','postgres','-d','postgres','-At','-c',s],encoding='utf8').strip()
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
print('PASS Supabase Auth local: dos estudiantes, reingreso con clave, acceso cruzado y RLS directa.')
print('Partida local de prueba:',game)
