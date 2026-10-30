import subprocess,json,urllib.request,urllib.error,uuid,os
status=json.loads(subprocess.check_output([r'.\node_modules\.bin\supabase.cmd','status','--workdir','.codex-work/p01-http-stack','-o','json'],encoding='utf8',stderr=subprocess.DEVNULL))
base=status['API_URL'];key=status['ANON_KEY'];assert base=='http://127.0.0.1:57321'
def request(path,data,token=None):
 r=urllib.request.Request(base+path,data=json.dumps(data).encode(),headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r,timeout=10) as res:return res.status,json.load(res)
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def sql(query):return subprocess.check_output(['docker','exec','supabase_db_sidep01http','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',query],encoding='utf8').strip()
sessions=[]
for _ in range(4):
 status,s=request('/auth/v1/signup',{});assert status==200 and s.get('access_token'),(status,s);sessions.append(s)
a,b,teacher,other=sessions
uid=teacher['user']['id'];code='SIDE-'+uuid.uuid4().hex[:4].upper();gid=str(uuid.uuid4())
cfg={'lifecycleVersion':2,'cycleCloseMode':'manual','integrationDurationMinutes':5,'integrationMinutes':0,'cycles':1,'roundHours':0,'roundMinutes':10,'enabledEvents':[],'materialRulesVersion':'receipts-v1','materialLeadTimeDays':0,'materialPaymentMode':'cash','deliveryPolicy':'explicit_provider_event_v1'}
sql("insert into public.profesores(id,nombre,apellido) values ('%s','Test','Teacher') on conflict(id) do nothing; insert into public.partidas(id,profesor_id,nombre,codigo,configuracion) values ('%s','%s','P01 HTTP','%s','%s'::jsonb);"%(uid,gid,uid,code,json.dumps(cfg)))
def join(s,name):return request('/rest/v1/rpc/side_ingresar_empresa_segura',{'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name,'p_clave':None},s['access_token'])
_,ra=join(a,'A');_,rb=join(b,'B');assert ra.get('success') and rb.get('success'),(ra,rb)
sql("update partidas set estado='activa',configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','decisions','status','running','running',true,'startedAt',now()-interval '141 seconds','duration',600)) where id='%s'"%gid)
def read(s,company):return request('/rest/v1/rpc/side_material_preview_v1',{'p_partida_id':gid,'p_empresa_id':company,'p_ciclo':1},s['access_token'])
sa,ba=read(a,ra['empresa_id']);st,bt=read(teacher,ra['empresa_id']);assert sa==st==200 and ba==bt,(sa,st,ba,bt)
for session in (b,other):
 status,out=read(session,ra['empresa_id']);assert status in (401,403), (status,out)
status,out=request('/rest/v1/rpc/side_material_preview_v1',{'p_partida_id':gid,'p_empresa_id':ra['empresa_id'],'p_ciclo':1});assert status in (401,403),(status,out)
for s in (a,b,other):
 status,out=request('/rest/v1/rpc/side_registrar_entrega_proveedor_v1',{'p_partida_id':gid,'p_order_id':'fake','p_receipt_id':'fake','p_quantity':1},s['access_token']);assert status in (401,403),(status,out)
status,out=request('/rest/v1/rpc/side_record_material_receipt_v1',{'p_order_id':'fake','p_receipt_id':'fake','p_quantity':1,'p_day':7},a['access_token']);assert status in (401,403),(status,out)
fixture_script="const f=require('./tests/economic_v19_fixture.cjs');const s=f.state(1,{},2);s.MOLDE={round:1,optionIds:['molde_3']};s.__inventarioMP={};s.CUERO={round:1,quantities:{cuero_prem:140}};s.ACCESORIOS={round:1,quantities:{acc_prem:200}};s.HILO={round:1,quantities:{hilo_std:2600}};s.PRODUCCION_META.moldTargets={molde_1:0,molde_2:0,molde_3:200};s.JEFATURA={round:1,optionIds:['no_jefatura']};for(const [k,o] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])s[k]={round:1,quantities:{[o]:1},...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(k)?{purchases:{1:{[o]:1}}}:{})};process.stdout.write(JSON.stringify(s))"
state=json.loads(subprocess.check_output(['node','-e',fixture_script],encoding='utf8'))
snap={'round':1,'decisions_submitted':False,'decision_state':{'__cyclePlans':{'1':{'state':state}}}}
args={'p_codigo':code,'p_nombre_legal':'A','p_nombre_comercial':'A','p_snapshot':snap,'p_expected_revision':0}
status,draft=request('/rest/v1/rpc/guardar_estado_estudiante',args,a['access_token']);assert status==200 and draft.get('success'),(status,draft)
assert int(sql("select count(*) from side_material_orders_v1 where partida_id='%s'"%gid))==0
args['p_expected_revision']=draft['snapshot_revision'];snap['decisions_submitted']=True
status,confirmed=request('/rest/v1/rpc/guardar_estado_estudiante',args,a['access_token']);assert status==200 and confirmed.get('success'),(status,confirmed)
status,book=read(teacher,ra['empresa_id']);assert status==200,book
orders={e['sku']:e for e in book['events'].values() if e['type']=='order'};assert len(orders)==3,orders
for sku,quantity in [('cuero_prem',140),('acc_prem',200),('hilo_std',1300)]:
 payload={'p_partida_id':gid,'p_order_id':orders[sku]['orderId'],'p_receipt_id':str(uuid.uuid4()),'p_quantity':quantity}
 status,delivery=request('/rest/v1/rpc/side_registrar_entrega_proveedor_v1',payload,teacher['access_token']);assert status==200 and delivery['day']==7,(status,delivery)
 status,retry=request('/rest/v1/rpc/side_registrar_entrega_proveedor_v1',payload,teacher['access_token']);assert status==200 and retry['reused'] is True,(status,retry)
status,book=read(a,ra['empresa_id']);assert status==200
status,teacher_book=read(teacher,ra['empresa_id']);assert book==teacher_book
assert sum(e['quantity'] for e in book['events'].values() if e['type']=='receipt')==1640
print('PASS local Auth+HTTP: draft and confirmed snapshot, three derived orders, teacher partial deliveries and retry, identical student/teacher book',book['revision'])
payload={'p_partida_id':gid,'p_order_id':orders['hilo_std']['orderId'],'p_receipt_id':str(uuid.uuid4()),'p_quantity':1300}
status,delivery=request('/rest/v1/rpc/side_registrar_entrega_proveedor_v1',payload,teacher['access_token']);assert status==200,(status,delivery)
status,final_book=read(a,ra['empresa_id']);assert status==200
sql("update partidas set configuracion=configuracion||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','status','finished')) where id='%s'"%gid)
local_status=json.loads(subprocess.check_output([r'.\node_modules\.bin\supabase.cmd','status','--workdir','.codex-work/p01-http-stack','-o','json'],encoding='utf8',stderr=subprocess.DEVNULL))
env={**os.environ,'SUPABASE_URL':base,'SUPABASE_SERVICE_ROLE_KEY':local_status['SERVICE_ROLE_KEY']}
worker=subprocess.run(['node','services/business_worker.cjs','--once'],env=env,encoding='utf8',capture_output=True,timeout=60)
assert worker.returncode==0,(worker.stdout,worker.stderr)
closure=json.loads(sql("select coalesce(cierre,'{}'::jsonb) from side_business_closures where partida_id='%s' and ciclo=1"%gid) or '{}')
assert closure.get('resultadosPorEmpresa'),worker.stdout
row=closure['resultadosPorEmpresa'][str(ra['empresa_id'])];receipt=row['receipt'];physical=receipt['production']['temporal'];assert physical['consumedBySku']['hilo_std']==1625 and receipt['inventory']['hilo_std']==975
print('PASS worker HTTP local: cierre persistido',json.dumps({'partida':gid,'revision':final_book['revision'],'producido':receipt['produced'],'hiloConsumido':physical['consumedBySku']['hilo_std'],'hiloFinal':receipt['inventory']['hilo_std'],'caja':row['financial']['balanceCaja']['cajaFinal']},ensure_ascii=False))
print('PASS local Auth+HTTP: four JWT sessions; owner and teacher same revision; cross-company, anonymous, non-owner delivery and internal RPC denied')
print('game',gid,'company',ra['empresa_id'],'revision',ba['revision'])
