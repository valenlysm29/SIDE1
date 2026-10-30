import subprocess,json,uuid
source=open('tests/p01_http_auth_local.py',encoding='utf8').read().split('worker=subprocess.run')[0]
ctx={};exec(compile(source,'p01_http_auth_local.py','exec'),ctx)
gid,env,sql,company=ctx['gid'],ctx['env'],ctx['sql'],ctx['ra']['empresa_id'];assert env['SUPABASE_URL']=='http://127.0.0.1:57321'
name='p01_fail_'+uuid.uuid4().hex[:10]
read=lambda:json.loads(sql("select jsonb_build_object('snapshot',s.snapshot,'revision',s.revision,'cash',e.caja_actual,'receipts',(select count(*) from side_material_receipts_v1 r join side_material_orders_v1 o on r.order_id=o.order_id where o.partida_id='%s')) from side_student_state s join empresas e on e.id=s.empresa_id where s.empresa_id=%d"%(gid,company)))
before=read();assert before['receipts']==4
sql("create function public.%s() returns trigger language plpgsql as $$ begin if new.empresa_id=%d then raise exception 'p01 rollback induced'; end if; return new; end $$; create trigger %s before insert or update on public.reportes_ciclo for each row execute function public.%s()"%(name,company,name,name))
try:
 p=subprocess.run(['node','services/business_worker.cjs','--once'],env=env,encoding='utf8',capture_output=True,timeout=90)
 assert 'p01 rollback induced' in p.stdout or 'p01 rollback induced' in p.stderr,(p.stdout,p.stderr)
 assert int(sql("select count(*) from side_business_closures where partida_id='%s'"%gid))==0
 assert int(sql('select count(*) from reportes_ciclo where empresa_id=%d and ciclo=1'%company))==0
 assert read()==before
finally:
 sql('drop trigger %s on public.reportes_ciclo; drop function public.%s()'%(name,name))
p=subprocess.run(['node','services/business_worker.cjs','--once'],env=env,encoding='utf8',capture_output=True,timeout=90);assert p.returncode==0,(p.stdout,p.stderr)
assert int(sql("select count(*) from side_business_closures where partida_id='%s'"%gid))==1
assert int(sql('select count(*) from reportes_ciclo where empresa_id=%d and ciclo=1'%company))==1
assert read()['receipts']==4
print('PASS rollback PostgreSQL/worker HTTP: recepción conservada, cierre/snapshot/caja/reporte revertidos, reintento único; partida',gid)
