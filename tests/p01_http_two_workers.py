import subprocess,os,json,threading,sys
# Prepare one local room via the existing HTTP fixture, stopping before worker execution.
source=open('tests/p01_http_auth_local.py',encoding='utf8').read().split('worker=subprocess.run')[0]
ctx={};exec(compile(source,'p01_http_auth_local.py','exec'),ctx)
gid,env,sql=ctx['gid'],ctx['env'],ctx['sql'];assert env['SUPABASE_URL']=='http://127.0.0.1:57321'
barrier=threading.Barrier(2);out=[]
def close():
 barrier.wait(timeout=10)
 p=subprocess.run(['node','services/business_worker.cjs','--once'],env=env,encoding='utf8',capture_output=True,timeout=70)
 out.append((p.returncode,p.stdout,p.stderr))
threads=[threading.Thread(target=close) for _ in range(2)]
for t in threads:t.start()
for t in threads:t.join(80);assert not t.is_alive()
assert len(out)==2 and all(x[0]==0 for x in out),[(x[0],x[2]) for x in out]
count=int(sql("select count(*) from public.side_business_closures where partida_id='%s' and ciclo=1"%gid));assert count==1,count
company=ctx['ra']['empresa_id'];n=int(sql("select count(*) from public.reportes_ciclo where empresa_id=%d and ciclo=1"%company));assert n==1,n
print('PASS dos workers Node simultáneos vía HTTP sobre PostgreSQL real: un cierre, un reporte; partida',gid)
