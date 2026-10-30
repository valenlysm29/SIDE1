import subprocess,json,os,uuid,sys
sys.path.insert(0,os.path.abspath('tests/.python-deps'))
import psycopg
# The existing HTTP script prepares a fresh local room and a closed receipt;
# create a separate unclosed room by executing its setup through the order step.
source=open('tests/p01_http_auth_local.py',encoding='utf8').read().split("for sku,quantity in [('cuero_prem'")[0]
ctx={};exec(compile(source,'p01_http_auth_local.py','exec'),ctx)
base,key,teacher,gid,orders,sql=*[ctx[x] for x in ('base','key','teacher','gid','orders','sql')],
assert base=='http://127.0.0.1:57321'
event=str(uuid.uuid4());order=orders['hilo_std']['orderId']
# Function setting is test-only in the isolated stack and restored in finally.
sql("alter function public.side_registrar_entrega_proveedor_v1(uuid,text,text,numeric) set lock_timeout='250ms'")
try:
 with psycopg.connect('host=127.0.0.1 port=57322 user=postgres password=postgres dbname=postgres') as lock:
  lock.execute('select id from partidas where id=%s for update',[gid])
  env={**os.environ,'P01_URL':base,'P01_KEY':key,'P01_TOKEN':teacher['access_token'],'P01_ARGS':json.dumps({'game':gid,'order':order,'event':event,'quantity':1})}
  p=subprocess.Popen(['node','tests/p01_http_retry_driver.cjs'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
  first=p.stdout.readline().strip();assert first=='attempt 1 55P03',first
  lock.commit()
  stdout,stderr=p.communicate(timeout=20);assert p.returncode==0,(stdout,stderr)
  final=json.loads(stdout.strip().splitlines()[-1]);assert final['success'] and final['receiptId']==event and 2<=final['attempts']<=3,final
 count=int(sql("select count(*) from side_material_receipts_v1 where receipt_id='%s'"%event));assert count==1,count
 print('PASS HTTP 55P03: bloqueo real, reintento con misma clave, intentos',final['attempts'],'recepciones',count)
finally:
 sql('alter function public.side_registrar_entrega_proveedor_v1(uuid,text,text,numeric) reset lock_timeout')
