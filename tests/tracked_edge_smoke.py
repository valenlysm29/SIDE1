"""Focal real HTTP/Edge manual+automatic check of the deployed fencing contract."""
from pathlib import Path
import concurrent.futures,json,subprocess,urllib.request,urllib.error,uuid
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
OUT=ROOT/'tests/output/fase01/finalizacion'
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(PROJECT/'.codex-work/fase01-local'),'-o','json'],stderr=subprocess.DEVNULL))
base=status['API_URL'];assert base=='http://127.0.0.1:33421'
def sql(source):
 r=subprocess.run(['docker','exec','-i','supabase_db_fase01local','psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=source.encode(),capture_output=True)
 if r.returncode:raise RuntimeError('Local SQL failed: '+r.stderr.decode(errors='replace').splitlines()[0])
 return r.stdout.decode().strip()
def req(path,args,token=None,headers=None):
 request=urllib.request.Request(base+path,data=json.dumps(args).encode(),headers={'apikey':status['ANON_KEY'],'Authorization':'Bearer '+(token or status['ANON_KEY']),'Content-Type':'application/json',**(headers or {})})
 try:
  with urllib.request.urlopen(request,timeout=60) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as error:
  body=error.read();return error.code,json.loads(body) if body.startswith(b'{') else body.decode()
def rpc(name,args,session):
 code,result=req('/rest/v1/rpc/'+name,args,session['access_token']);assert code==200,(name,code,result)
 return result
def call_worker():
 run=uuid.uuid4()
 # Emulate the scheduler-issued registry in QA only, without forging ownership:
 # the real claim/context/save/finalize RPCs are still exercised over HTTP.
 sql(f"insert into side_closure_execution_requests(run_id,request_id) values('{run}',{-int(run.int%(2**60))})")
 return req('/functions/v1/side-business-close',{'run_id':str(run)},headers={'x-side-cron-token':'fase01-local-only'})
evidence=[]
for mode in ('manual','automatic'):
 teacher=req('/auth/v1/signup',{})[1];gid=str(uuid.uuid4())
 config={'lifecycleVersion':2,'cycles':1,'cycleCloseMode':mode,'roundMinutes':1,'roundHours':0,'integrationDurationMinutes':5,'enabledEvents':[],'capital':1000000,'planSyncGraceSeconds':0}
 game=json.loads(sql(f"insert into partidas(id,profesor_id,nombre,configuracion) values('{gid}','{teacher['user']['id']}','QA Tracked {mode}','{json.dumps(config)}') returning row_to_json(partidas)"))
 students=[]
 for n in range(3):
  session=req('/auth/v1/signup',{})[1];name='Tracked '+mode+' '+str(n)
  joined=rpc('side_ingresar_empresa_segura',{'p_codigo':game['codigo'],'p_nombre_legal':name,'p_nombre_comercial':name,'p_clave':None},session);assert joined['success']
  students.append((session,name))
 sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{gameStartAt}}',to_jsonb(clock_timestamp()-interval '1 second')) where id='{gid}'")
 if mode=='manual':rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'iniciar','p_expected_round':1},teacher)
 else:sql(f"select public.side_sync_game('{gid}')")
 for session,name in students:
  ident={'p_codigo':game['codigo'],'p_nombre_legal':name,'p_nombre_comercial':name}
  current=rpc('obtener_estado_estudiante',ident,session)
  plan=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./tests/economic_v19_fixture.cjs').state(1)))"]))
  snapshot={'round':1,'decisions_submitted':True,'decision_state':{**plan,'__cyclePlans':{'1':{'state':plan}}}}
  saved=rpc('guardar_estado_estudiante',{**ident,'p_snapshot':snapshot,'p_expected_revision':current['snapshot_revision']},session);assert saved['success'],saved
 if mode=='manual':rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'cerrar','p_expected_round':1},teacher)
 else:
  sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{runtime,startedAt}}',to_jsonb(clock_timestamp()-interval '61 seconds')) where id='{gid}';select public.side_sync_game('{gid}')")
 assert sql(f"select configuracion#>>'{{runtime,phase}}' from partidas where id='{gid}'")=='results'
 assert sql(f"select side_cierre_completo('{gid}',1)")=='f'
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:responses=list(pool.map(lambda _:call_worker(),range(2)))
 for code,result in responses:assert code in (200,503) and isinstance(result,dict),responses
 assert sql(f"select side_cierre_completo('{gid}',1)")=='t',responses
 official=rpc('side_historial_oficial',{'p_partida_id':gid,'p_empresa_id':None},teacher)
 assert len([r for r in official['cycles'] if r['status']=='confirmed'])==3
 assert sql(f"select count(*) from side_business_closures where partida_id='{gid}'")=='1'
 assert sql(f"select outcome from side_closure_execution_attempts where partida_id='{gid}' and ciclo=1")=='confirmed'
 if mode=='manual':rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'avanzar','p_expected_round':1},teacher)
 else:sql(f"select side_sync_game('{gid}')")
 assert sql(f"select configuracion#>>'{{runtime,phase}}' from partidas where id='{gid}'")=='finished'
 # A fresh registered retry must not overwrite the seal.
 seal=sql(f"select md5(cierre::text) from side_business_closures where partida_id='{gid}'")
 call_worker();assert sql(f"select md5(cierre::text) from side_business_closures where partida_id='{gid}'")==seal
 evidence.append({'mode':mode,'game':gid,'companies':3,'sealedRows':1,'fencedConcurrent':True,'retryImmutable':True,'finished':True})
blocked=json.loads((OUT/'historical-fixture.json').read_text())['game']
assert sql(f"select count(*) from side_business_closures where partida_id='{blocked}'")=='0'
(OUT/'tracked-smoke.json').write_text(json.dumps(evidence,indent=2))
print('PASS real tracked Edge: manual+automatic, 6 official results, concurrent fencing, immutable retries; invalid legacy still unclosed')
