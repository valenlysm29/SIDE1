"""Authenticated Chromium + local Auth/Data API/PostgreSQL + generated Edge worker.
Only newly created QA games have their test clock accelerated; no mocked RPCs.
"""
import os,sys,json,subprocess,threading,urllib.request,concurrent.futures,hashlib,time,uuid
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
sys.path.insert(0,str(PROJECT/'.codex-work/flicker-python'))
from playwright.sync_api import sync_playwright
work=ROOT/'.codex-work/rentab-stack'
for flag in list(os.environ):
 if flag.startswith('HISTORY_') or flag=='SIDE_FASE01_WORK':os.environ.pop(flag,None)
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(work),'-o','json'],stderr=subprocess.DEVNULL))
BASE=status['API_URL'];assert BASE=='http://127.0.0.1:33721'
KEY=status['ANON_KEY'];OUT=ROOT/'tests/output/rentabilidad_final/connected';OUT.mkdir(parents=True,exist_ok=True)
def req(path,payload,token=None):
 r=urllib.request.Request(BASE+path,data=json.dumps(payload).encode(),headers={'apikey':KEY,'Authorization':'Bearer '+(token or KEY),'Content-Type':'application/json'})
 with urllib.request.urlopen(r) as f:return json.load(f)
def rpc(name,args,token):return req('/rest/v1/rpc/'+name,args,token)
def sql(query):
 return subprocess.check_output(['docker','exec','supabase_db_sideprofitfinal','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atc',query],encoding='utf8').strip()
def worker(game,cycle):
 run=uuid.uuid4()
 sql(f"insert into side_closure_execution_requests(run_id,request_id) values('{run}',{-int(run.int%(2**60))})")
 result=req('/functions/v1/profit-qa',{'game':game,'cycle':cycle,'runId':str(run)},status['SERVICE_ROLE_KEY'])
 assert result.get('results') and all(r['success'] and (not r.get('pending') or r.get('code')=='INTENTO_EN_CURSO') for r in result['results']),result
 return result

def normalize(value):
 if isinstance(value,list):return [normalize(x) for x in value]
 if isinstance(value,dict):return {k:(float(format(v,'.14g')) if k=='factorPrecioAbsoluto' and isinstance(v,(float,int)) else normalize(v)) for k,v in value.items()}
 return value

class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/js/config.js':
   self.send_response(200);self.send_header('Content-Type','application/javascript');self.end_headers();self.wfile.write(('window.SIDE_CONFIG='+json.dumps({'SUPABASE_URL':BASE,'SUPABASE_PUBLISHABLE_KEY':KEY})+';').encode())
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(server.server_port)
evidence=json.loads((OUT/'integration.json').read_text()) if (OUT/'integration.json').exists() else [];prior_plans={};current_cycles=3
def plan(cycle,company):
 data={'round':cycle,'cycles':current_cycles,'previous':prior_plans.get(company)}
 result=subprocess.run(['node','tests/rentabilidad_plan.cjs'],input=json.dumps(data),encoding='utf8',capture_output=True,check=True)
 return json.loads(result.stdout)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 try:
  for count,mode in [(3,'manual'),(6,'automatic')]:
   if os.environ.get('SIDE_PROFIT_CYCLES') and int(os.environ['SIDE_PROFIT_CYCLES'])!=count:continue
   current_cycles=count;prior_plans={}
   if os.environ.get('HISTORY_LEGACY') and mode!='manual':continue
   if os.environ.get('HISTORY_SCENARIO') and int(os.environ['HISTORY_SCENARIO'])!=count:continue
   teacher=req('/auth/v1/signup',{});uid=teacher['user']['id'];sql(f"insert into profesores(id,nombre,apellido) values ('{uid}','Historia','QA') on conflict do nothing")
   options={'viewport':{'width':1366,'height':900}}
   ctx=browser.new_context(**options)
   ctx.add_init_script('localStorage.setItem("sb-127-auth-token",'+json.dumps(json.dumps(teacher))+');')
   t=ctx.new_page();errors=[];local_failures=[];t.on('pageerror',lambda e:errors.append(str(e)))
   def check_resource(response):
    if response.url.startswith(origin+'/') and response.status>=400:local_failures.append({'url':response.url,'status':response.status})
   ctx.on('response',check_resource)
   t.goto(origin+'/docente.html',wait_until='networkidle')
   t.locator('#gameName').fill(f'QA Rentabilidad {count}');t.locator('#cycles').fill(str(count));t.locator('#roundMinutes').fill('1');t.locator('#integrationDurationMinutes').fill('5');t.locator('#capital').fill('100000')
   t.locator(f'input[name=cycleMode][value={mode}]').check()
   t.evaluate("state.authoritative={materialRulesVersion:'receipts-v1',materialLeadTimeDays:0,materialPaymentMode:'cash',supplierCreditTermCycles:1,planSyncGraceSeconds:0,economicRulesVersion:'utility-v1',sequentialCloseVersion:'1'}")
   t.locator('#startGame').click();t.wait_for_function('state.partidaId!==null',timeout=30000);game=t.evaluate('state.partidaId');code=t.locator('#gameCode').input_value()
   if os.environ.get('HISTORY_LEGACY'):
    sql(f"update partidas set configuracion=configuracion-'sequentialCloseVersion' where id='{game}' and nombre='QA Historia {count}'")
   students=[]
   for n in range(3):
    sc=browser.new_context(viewport={'width':1366,'height':900});sc.on('response',check_resource);s=sc.new_page();s.on('pageerror',lambda e:errors.append(str(e)))
    s.goto(origin+'/index.html',wait_until='networkidle')
    try:s.locator('#startBtn').click(timeout=15000)
    except Exception:
     print('Landing retry',s.locator('#landingProgressText').text_content(),flush=True)
     s.reload(wait_until='networkidle');s.locator('#startBtn').click(timeout=20000)
    s.locator('[data-profile=student]').click()
    name=f'Rentabilidad {count} {uuid.uuid4().hex[:8]} Empresa {n+1}'
    def failed_response(response):
     if response.status>=400 and response.url.startswith(BASE):print('API_FAILURE',response.status,response.url,response.text()[:600],flush=True)
     if response.url.endswith('/side_ingresar_empresa_segura') and response.status==200:
      payload=response.json()
      if payload.get('success') is False:print('ADMISSION_REJECTED',json.dumps({k:payload.get(k) for k in ['code','error','success']}),flush=True)
    s.on('response',failed_response)
    s.locator('#gameCode').fill(code);s.locator('#companyLegalName').fill(name);s.locator('#companyBrandName').fill(name);s.locator('#studentForm button[type=submit]').click()
    try:s.wait_for_function('studentConnected&&currentStudent.empresaId',timeout=30000)
    except Exception:
     s.screenshot(path=str(OUT/'admission-failure.png'));print(s.locator('#studentMessage').text_content(),flush=True);raise
    ident={'codigo':code,'nombreLegal':name,'nombreComercial':name};company=s.evaluate('currentStudent.empresaId')
    students.append((sc,s,ident,company))
   # Test clock only: this SQL targets the new QA game, preserving real RPC transitions.
   sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{gameStartAt}}',to_jsonb(clock_timestamp()-interval '1 second')) where id='{game}'")
   t.evaluate('refreshTeacherGame()');t.wait_for_function('runtime()?.phase==="decisions"',timeout=15000)
   before_hashes={};previous={};scenario={'cycles':count,'mode':mode,'game':game,'workerVersion':'0' if os.environ.get('HISTORY_LEGACY') else '1','checks':[]}
   for cycle in range(1,count+1):
    for n,(sc,s,ident,company) in enumerate(students):
     s.evaluate('refreshStudentGame({forceHydrate:true})')
     result=s.evaluate('''async ({ident,plan,cycle})=>{let result;for(let attempt=0;attempt<5;attempt++){const current=await SIDE.EmpresaService.obtenerEstado(ident);if(!current.success)return current;const snapshot=current.data.snapshot||{};snapshot.round=cycle;snapshot.decisions_submitted=true;const ds=snapshot.decision_state||{};Object.assign(ds,plan);ds.__cyclePlans={...ds.__cyclePlans,[cycle]:{state:plan}};snapshot.decision_state=ds;result=await SIDE.EmpresaService.guardarEstado(ident,snapshot,current.data.snapshot_revision);if(result.success||result.code!=='ESTADO_DESACTUALIZADO')return result;await new Promise(r=>setTimeout(r,100));}return result;}''',{'ident':ident,'plan':plan(cycle,n),'cycle':cycle})
     assert result['success'],result
    if mode=='manual':
     t.locator('[data-tab="rondas"]').click();t.locator('#cutRound').click();t.wait_for_function('runtime()?.phase==="results"')
    else:
     sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{runtime,startedAt}}',to_jsonb(clock_timestamp()-interval '61 seconds')) where id='{game}'")
     t.evaluate('refreshTeacherGame()');t.wait_for_function('runtime()?.phase==="results"')
    for sc,s,ident,company in students:
     book=rpc('side_material_context_v1',{'p_partida_id':game,'p_empresa_id':company,'p_cutoff_day':cycle*30-1},status['SERVICE_ROLE_KEY'])
     for order in [e for e in book['events'].values() if e['type']=='order' and int(e['orderedDay'])//30+1==cycle]:
      r=rpc('side_record_material_receipt_v1',{'p_order_id':order['orderId'],'p_receipt_id':order['orderId']+'-qa','p_quantity':order['quantity'],'p_day':(cycle-1)*30},status['SERVICE_ROLE_KEY']);assert not r.get('error'),r
    prediction=subprocess.run(['node','tests/compare_profit_node.cjs'],input=json.dumps({'url':BASE,'key':status['SERVICE_ROLE_KEY'],'game':game,'cycle':cycle}),encoding='utf8',capture_output=True)
    assert prediction.returncode==0,prediction.stderr
    predicted=json.loads(prediction.stdout)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda _:worker(game,cycle),range(2)))
    official=rpc('side_historial_oficial',{'p_partida_id':game,'p_empresa_id':None},teacher['access_token'])
    closed=[r for r in official['cycles'] if r['status']=='confirmed'];assert len(closed)==cycle*3
    for row in closed:
     key=(row['empresa_id'],row['ciclo']);digest=hashlib.sha256(json.dumps(row['result'],sort_keys=True).encode()).hexdigest()
     assert before_hashes.get(key,digest)==digest;before_hashes[key]=digest
    for sc,s,ident,company in students:
     row=next(r for r in closed if int(r['empresa_id'])==int(company) and int(r['ciclo'])==cycle);f=row['result']['financial'];receipt=row['result']['receipt']
     expected=predicted['resultadosPorEmpresa'][str(company)];assert normalize(row['result'])==normalize(expected),'Node/Deno/PostgreSQL differ'
     for key in ['estadoResultados','flujoCaja','balanceGeneral']:assert f[key]==expected['financial'][key],key
     prior_plans[students.index((sc,s,ident,company))]=row['result']
     assert receipt['produced']>0 and receipt['sold']>0,(cycle,company,receipt)
     if company in previous:assert abs(float(f['balanceCaja']['cajaInicial'])-previous[company]['cash'])<.0000001,(f,previous[company])
     if company in previous:
      assert receipt['openingInventory']==previous[company]['inventory'],(receipt['openingInventory'],previous[company])
      assert f['balanceGeneral']['deuda']==previous[company]['debt']
     previous[company]={'cash':float(f['balanceCaja']['cajaFinal']),'inventory':receipt['inventory'],'goods':receipt.get('goods'),'debt':f['balanceGeneral'].get('deuda')}
     assert abs(float(f['balanceGeneral']['activos'])-float(f['balanceGeneral']['pasivoPatrimonio']))<.0000001
     s.reload(wait_until='networkidle');s.evaluate('refreshStudentGame({forceHydrate:true})')
     view=s.evaluate('financialReport()');assert len(view['history'])==cycle,(view,cycle)
     if cycle==1:
      sc.set_offline(True);s.evaluate('refreshStudentGame({forceHydrate:true})');assert len(s.evaluate('financialReport().history'))==cycle
      sc.set_offline(False);s.evaluate('refreshStudentGame({forceHydrate:true})')
     denied=s.evaluate('''async ({game,other})=>{const r=await SIDE.SupabaseClient.getStudent().rpc('side_historial_oficial',{p_partida_id:game,p_empresa_id:other});return !!r.error;}''',{'game':game,'other':students[(students.index((sc,s,ident,company))+1)%3][3]})
     assert denied,'Cross-company history must be denied'
     for statement in ['estadoResultados','balanceCaja','flujoCaja','balanceGeneral']:assert view['history'][-1][statement]==f[statement]
    t.evaluate('loadReports()');t.locator('[data-tab="resultados"]').click();t.wait_for_function('state.reports.length===3')
    for old in range(1,cycle+1):
     t.locator('#resultCycleSelect').select_option(str(old));t.wait_for_timeout(100)
     assert t.locator('#resultComparison tbody tr').count()==3
     assert 'pendiente' not in t.locator('#resultComparison tbody').inner_text().lower()
    lab=t.evaluate('''async game=>{const h=await SIDE_LAB_SERVICE.history(game);return h}''',game)
    assert [r for r in lab['cycles'] if r['status']=='confirmed']==closed
    t.locator('[data-tab="laboratorio"]').click();t.wait_for_selector('#lab-cycle');t.locator('#lab-game').select_option(game);t.locator('#lab-refresh').click();t.wait_for_timeout(1200);t.locator('#lab-cycle').select_option(str(cycle));t.wait_for_timeout(700)
    t.screenshot(path=str(OUT/f'lab-{count}-{cycle}.png'))
    scenario['checks'].append({'cycle':cycle,'confirmedCompanies':3,'produced':receipt['produced'],'sold':receipt['sold'],'cash':f['balanceCaja']['cajaFinal'],'immutableClosures':len(closed)})
    t.locator('[data-tab="rondas"]').click()
    if mode=='manual':t.locator('#advanceRound').click()
    else:t.evaluate('refreshTeacherGame()')
    if cycle<count:t.wait_for_function(f'state.round==={cycle+1}',timeout=15000)
   t.wait_for_function('runtime()?.phase==="finished"',timeout=20000);t.reload(wait_until='networkidle');t.locator('[data-tab="historial"]').click();t.wait_for_timeout(1500);t.screenshot(path=str(OUT/f'history-{count}.png'))
   for r in prior_plans.values():
    bg=r['financial']['balanceGeneral'];assert bg['resultadosAcumulados']>0 and bg['efectivo']>100000,(count,bg)
   history=rpc('side_historial_oficial',{'p_partida_id':game,'p_empresa_id':None},teacher['access_token'])
   primary=students[0][3];own=[r for r in history['cycles'] if r['status']=='confirmed' and int(r['empresa_id'])==int(primary)]
   produced=sum(r['result']['receipt']['produced'] for r in own);sold=sum(r['result']['receipt']['sold'] for r in own)
   assert 900<=produced<=1100 and 900<=sold<=produced,(count,produced,sold)
   scenario.update(producedTotal=produced,soldTotal=sold,finalCash=prior_plans[0]['financial']['balanceGeneral']['efectivo'],profit=prior_plans[0]['financial']['balanceGeneral']['resultadosAcumulados'],nodeDenoPostgresEqual=True)
   assert not errors,errors
   assert not local_failures,local_failures
   scenario['pageErrors']=errors;scenario['failedLocalResources']=local_failures;scenario['blockedHistoricalGame']=os.environ.get('HISTORY_BLOCKED_GAME');evidence.append(scenario);(OUT/'integration.json').write_text(json.dumps(evidence,indent=2))
   print('PASS rentabilidad conectada',count,json.dumps({'produced':produced,'sold':sold,'cash':scenario['finalCash'],'profit':scenario['profit']}),flush=True)
   for sc,*_ in students:sc.close()
   ctx.close()
 finally:browser.close();server.shutdown()
