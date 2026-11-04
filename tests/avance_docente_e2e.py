"""Authenticated Chromium + local Auth/Data API/PostgreSQL + generated Edge worker.
Only newly created QA games have their test clock accelerated; no mocked RPCs.
"""
import os,sys,json,subprocess,threading,urllib.request,concurrent.futures,hashlib,time,uuid
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
sys.path.insert(0,str(PROJECT/'.codex-work/python'))
from playwright.sync_api import sync_playwright
work=Path(os.environ.get('SIDE_FASE01_WORK',PROJECT/'.codex-work/p01-http-stack')).resolve()
assert work.is_relative_to(PROJECT)
assert os.environ.get('SIDE_FASE01_WORK') and work==PROJECT/'.codex-work/avance-stack','Use only the dedicated avance-stack test installation'
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(work),'-o','json'],stderr=subprocess.DEVNULL))
if os.environ.get('SIDE_FASE01_WORK'):
 BASE=status['API_URL'];assert BASE=='http://127.0.0.1:57421'
else:
 proxy=subprocess.check_output(['docker','port','side-history-local-proxy','8000/tcp'],encoding='utf8').strip();assert proxy.startswith('127.0.0.1:');BASE='http://'+proxy
KEY=status['ANON_KEY']
OUT=PROJECT/('tests/output/ciclos-definitivo/cortes' if os.environ.get('SIDE_CUT_QA') else 'tests/output/avance-docente/e2e');OUT.mkdir(parents=True,exist_ok=True)
if os.environ.get('HISTORY_LEGACY'):
 OUT=ROOT/'tests/output/fase01/connected-legacy';OUT.mkdir(parents=True,exist_ok=True)
if os.environ.get('HISTORY_BLOCKED_GAME'):
 OUT=ROOT/'tests/output/fase01/finalizacion/connected-isolation';OUT.mkdir(parents=True,exist_ok=True)
if os.environ.get('SIDE_INTEGRAL_ECONOMY'):
 OUT=ROOT/'tests/output/finalizacion-integral/connected';OUT.mkdir(parents=True,exist_ok=True)
if os.environ.get('SIDE_FINAL_QA'):
 OUT=ROOT/'tests/output/cierre-definitivo/connected';OUT.mkdir(parents=True,exist_ok=True)
def req(path,payload,token=None):
 r=urllib.request.Request(BASE+path,data=json.dumps(payload).encode(),headers={'apikey':KEY,'Authorization':'Bearer '+(token or KEY),'Content-Type':'application/json'})
 with urllib.request.urlopen(r) as f:return json.load(f)
def qa_session(teacher=False):

 # Permanent QA identities avoid exhausting anonymous sign-up quotas across reruns.
 # Actual Auth JWTs and all role/ownership checks remain enabled.
 identity=uuid.uuid4().hex;email='side-qa-'+identity+('@upch.pe' if teacher else '@example.invalid');password=uuid.uuid4().hex+'Aa1!'
 req('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},status['SERVICE_ROLE_KEY'])
 return req('/auth/v1/token?grant_type=password',{'email':email,'password':password})

def rpc(name,args,token):return req('/rest/v1/rpc/'+name,args,token)
def sql(query):
 return subprocess.check_output(['docker','exec',('supabase_db_sideavancep0' if os.environ.get('SIDE_FASE01_WORK') else 'supabase_db_sidep01http'),'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atc',query],encoding='utf8').strip()
def worker(game,cycle):
 if os.environ.get('SIDE_FASE01_WORK'):
  run=uuid.uuid4()
  sql(f"insert into side_closure_execution_requests(run_id,request_id) values('{run}',{-int(run.int%(2**60))})")
  request=urllib.request.Request(BASE+'/functions/v1/side-business-close',data=json.dumps({'run_id':str(run)}).encode(),headers={'x-side-cron-token':'avance-local-only','Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(request,timeout=60) as response:result=json.load(response)
  except urllib.error.HTTPError as error:
   if error.code!=503:raise
   result=json.load(error)
  if os.environ.get('HISTORY_BLOCKED_GAME'):
   blocked=[r for r in result['results'] if r['game']==os.environ['HISTORY_BLOCKED_GAME']]
   assert blocked and all(not r['success'] and r['code']=='DECISION_INVALIDA' or r.get('pending') and r.get('code')=='INTENTO_EN_CURSO' for r in blocked),result
   own=[r for r in result['results'] if r['game']==game]
   assert all(r['success'] and (not r.get('pending') or r.get('code')=='INTENTO_EN_CURSO') for r in own),result
   assert not result['success'],'Historical failures must remain explicit'
  else:assert all(r['success'] and (not r.get('pending') or r.get('code')=='INTENTO_EN_CURSO') for r in result['results']),result
  return result
 result=req('/functions/v1/history-qa',{'game':game,'cycle':cycle},status['SERVICE_ROLE_KEY'])
 assert result and all(r['success'] and not r.get('pending') for r in result),result
 return result
if os.environ.get('SIDE_FASE01_WORK'):
 # Quarantine only abandoned fixtures in this dedicated local database.
 sql("update public.partidas set configuracion=configuracion||'{\"phase\":\"cancelled\",\"runtime\":{\"phase\":\"cancelled\"}}'::jsonb where nombre like 'QA Historia %'")
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/js/config.js':
   self.send_response(200);self.send_header('Content-Type','application/javascript');self.end_headers();self.wfile.write(('window.SIDE_CONFIG='+json.dumps({'SUPABASE_URL':BASE,'SUPABASE_PUBLISHABLE_KEY':KEY})+';').encode())
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(server.server_port)
evidence=json.loads((OUT/'integration.json').read_text()) if os.environ.get('HISTORY_SCENARIO') and (OUT/'integration.json').exists() else []
def plan(cycle,company):
 counts={'MESA_CORTE':{'mesa':1},'ENSAMBLE':{'ens_basica':1},'ACABADOS':{'aca_basica':1},'PERS_CORTE':{'corte_basico':1},'PERS_ENSAMBLE':{'ens_personal_basico':1},'PERS_ACABADO':{'aca_personal_basico':1},'CUERO':{'cuero_std':100},'ACCESORIOS':{'acc_eco':200},'HILO':{'hilo_std':2}}
 s={k:{'round':cycle,'quantities':q,'optionIds':list(q),**({'purchases':{'1':q}} if k in ('MESA_CORTE','ENSAMBLE','ACABADOS') else {})} for k,q in counts.items()}
 for k in ('MESA_CORTE','ENSAMBLE','ACABADOS'):s[k]['round']=1
 s.update(MOLDE={'round':1,'optionIds':['molde_1','molde_2','molde_3']},CANALES={'round':cycle,'optionIds':['web']},PRODUCCION_META={'round':cycle,'moldTargets':{'molde_1':10+company*2}},PRESTAMO={'round':1,'amount':1000,'principal':1000})
 if os.environ.get('SIDE_INTEGRAL_ECONOMY'):
  product=min(3,cycle if int(os.environ.get('HISTORY_SCENARIO','3'))==3 else (cycle+1)//2)
  s['PRODUCCION_META']={'round':cycle,'moldTargets':{'molde_'+str(product):100+company*10}}
  if company==2:s['INV_MARKETING']={'round':cycle,'optionIds':['mkt_alta']}
 return s
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding'])
 try:
  for count,mode in [(3,'manual'),(6,'manual')]:
   if os.environ.get('HISTORY_LEGACY') and mode!='manual':continue
   if os.environ.get('HISTORY_SCENARIO') and int(os.environ['HISTORY_SCENARIO'])!=count:continue
   teacher=qa_session(True);uid=teacher['user']['id'];sql(f"insert into profesores(id,nombre,apellido) values ('{uid}','Historia','QA') on conflict do nothing")
   options={'viewport':{'width':1366,'height':900}}
   if not os.environ.get('SIDE_FASE01_WORK'):options['record_video_dir']=str(OUT/f'video-{count}')
   ctx=browser.new_context(**options)
   ctx.add_init_script('localStorage.setItem("sb-127-auth-token",'+json.dumps(json.dumps(teacher))+');')
   ctx.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin+'/') or route.request.url.startswith(BASE+'/') else route.abort())
   t=ctx.new_page();errors=[];local_failures=[];t.on('pageerror',lambda e:errors.append(str(e)))
   def check_resource(response):
    if response.url.startswith(origin+'/') and response.status>=400:local_failures.append({'url':response.url,'status':response.status})
   ctx.on('response',check_resource)
   t.goto(origin+'/docente.html',wait_until='networkidle')
   t.locator('#gameName').fill(f'QA Historia {count}');t.locator('#cycles').fill(str(count));t.locator('#roundMinutes').fill('10' if os.environ.get('SIDE_CUT_QA') else '1');t.locator('#integrationDurationMinutes').fill('5');t.locator('#capital').fill('200000')
   t.locator(f'input[name=cycleMode][value={mode}]').check()
   t.evaluate("state.authoritative={materialRulesVersion:'receipts-v1',materialPurchaseVersion:'excel-v2-packs-v1',materialLeadTimeDays:0,materialPaymentMode:'credit',supplierCreditTermCycles:2,planSyncGraceSeconds:0}")
   if os.environ.get('SIDE_FINAL_QA'):t.evaluate("Object.assign(state.authoritative,{loanPolicy:{version:'french-v1'},economicEventsVersion:'demand-share-v1'});state.enabledEvents=new Set(['PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77'])")
   t.locator('#startGame').click();t.wait_for_function('state.partidaId!==null',timeout=30000);game=t.evaluate('state.partidaId');code=t.locator('#gameCode').input_value()
   if os.environ.get('HISTORY_LEGACY'):
    sql(f"update partidas set configuracion=configuracion-'sequentialCloseVersion' where id='{game}' and nombre='QA Historia {count}'")
   students=[]
   for n in range(3):
    sc=browser.new_context(viewport={'width':1366,'height':900});sc.on('response',check_resource);student_session=qa_session()
    sc.add_init_script('localStorage.setItem("sb-127-auth-token",'+json.dumps(json.dumps(student_session))+');')
    s=sc.new_page();s.on('pageerror',lambda e:errors.append(str(e)))
    s.goto(origin+'/index.html',wait_until='networkidle')
    try:s.locator('#startBtn').click(timeout=15000)
    except Exception:
     print('Landing retry',s.locator('#landingProgressText').text_content(),flush=True)
     s.reload(wait_until='networkidle');s.locator('#startBtn').click(timeout=20000)
    s.locator('[data-profile=student]').click()
    name=f'Historia {count} Empresa {n+1}'
    s.locator('#gameCode').fill(code);s.locator('#companyLegalName').fill(name);s.locator('#companyBrandName').fill(name);s.locator('#studentForm button[type=submit]').click()
    try:s.wait_for_function('studentConnected&&currentStudent.empresaId',timeout=30000)
    except Exception:
     s.screenshot(path=str(OUT/'admission-failure.png'));print(s.locator('#studentMessage').text_content(),flush=True);raise
    ident={'codigo':code,'nombreLegal':name,'nombreComercial':name};company=s.evaluate('currentStudent.empresaId')
    students.append((sc,s,ident,company))
   if os.environ.get('SIDE_FINAL_QA'):
    # Persist all three modes through the delivered controls; no mocked RPC.
    t.evaluate('loadReports()');t.wait_for_function('state.reports.length===3');t.locator('[data-tab="configuracion"]').click()
    t.wait_for_selector('#challengeV1Mode')
    for eventmode in ['random','balanced','manual']:
     t.locator('#challengeV1Mode').select_option(eventmode)
     t.wait_for_function('(mode)=>state.authoritative?.challengeModeV1===mode',arg=eventmode)
    # Random draw is persisted once in a future cycle; re-read must be identical.
    if count==3:
     drawn=rpc('side_draw_events_v1',{'p_partida_id':game,'p_source_cycle':count},teacher['access_token'])
     retry=rpc('side_draw_events_v1',{'p_partida_id':game,'p_source_cycle':count},teacher['access_token']);assert retry['reused'] and retry['events']==drawn['events']
    for eventcycle in range(1,count+1 if count==6 else count):
     if count==6 or eventcycle%2:
      balanced=rpc('side_schedule_balanced_v1',{'p_partida_id':game,'p_ciclo':eventcycle},teacher['access_token']);again=rpc('side_schedule_balanced_v1',{'p_partida_id':game,'p_ciclo':eventcycle},teacher['access_token']);assert again['reused'] and again['events']==balanced['events']
     else:
      assigned=rpc('side_assign_event_v1',{'p_partida_id':game,'p_empresa_id':students[(eventcycle-1)%3][3],'p_ciclo':eventcycle,'p_event_id':'PE68','p_intensity':1},teacher['access_token']);assert assigned['eventId']=='PE68'
    t.reload(wait_until='networkidle');assert t.evaluate('state.authoritative.challengeModeV1')=='manual'
   # Test clock only: this SQL targets the new QA game, preserving real RPC transitions.
   sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{gameStartAt}}',to_jsonb(clock_timestamp()-interval '1 second')) where id='{game}'")
   t.evaluate('refreshTeacherGame()');t.wait_for_function('runtime()?.phase==="decisions"',timeout=15000)
   observer=ctx.new_page();observer.on('pageerror',lambda e:errors.append(str(e)))
   observer.goto(origin+'/docente.html',wait_until='networkidle');observer.locator('[data-tab="rondas"]').click()
   before_hashes={};previous={};scenario={'cycles':count,'mode':mode,'game':game,'workerVersion':'0' if os.environ.get('HISTORY_LEGACY') else '1','checks':[]}
   for cycle in range(1,count+1):
    for n,(sc,s,ident,company) in enumerate(students):
     s.evaluate('refreshStudentGame({forceHydrate:true})')
     result=s.evaluate('''async ({ident,plan,cycle,confirmed})=>{let result;for(let attempt=0;attempt<5;attempt++){const current=await SIDE.EmpresaService.obtenerEstado(ident);if(!current.success)return current;const snapshot=current.data.snapshot||{};snapshot.round=cycle;snapshot.decisions_submitted=confirmed;const ds=snapshot.decision_state||{};Object.assign(ds,plan);if(confirmed)ds.__cyclePlans={...ds.__cyclePlans,[cycle]:{state:plan}};snapshot.decision_state=ds;result=await SIDE.EmpresaService.guardarEstado(ident,snapshot,current.data.snapshot_revision);if(result.success||result.code!=='ESTADO_DESACTUALIZADO')return result;await new Promise(r=>setTimeout(r,100));}return result;}''',{'ident':ident,'plan':plan(cycle,n),'cycle':cycle,'confirmed':not os.environ.get('SIDE_CUT_QA') or n<2})
     assert result['success'],result
     if n<2:
      t.evaluate('refreshTeacherGame()')
      assert t.locator('#advanceRound').is_disabled()
      missing=t.evaluate('state.advanceReadiness?.missing?.length')
      assert missing==2-n,missing
    t.locator('[data-tab="rondas"]').click()
    if os.environ.get('SIDE_CUT_QA'):
     t.bring_to_front()
     t.evaluate('refreshTeacherGame()')
     t.wait_for_function('state.advanceReadiness?.missing?.length===1')
     assert t.locator('#advanceRound').is_disabled()
     if count==6 and cycle==1:
      sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{runtime,startedAt}}',to_jsonb(clock_timestamp()-interval '11 minutes')) where id='{game}'")
      t.evaluate('refreshTeacherGame()')
     else:
      t.keyboard.press('Escape')
      t.locator('.coach-help').click()
      t.locator('[data-action="next"]').click()
      t.locator('#cutRound').click()
      t.keyboard.press('Escape')
    t.evaluate('refreshTeacherGame()');t.wait_for_function('runtime()?.phase==="results"',timeout=15000)
    assert t.locator('#advanceRound').is_disabled(),'Official closure is still pending'
    t.screenshot(path=str(OUT/f'pending-{count}-{cycle}.png'))
    for sc,s,ident,company in students:
     book=rpc('side_material_context_v1',{'p_partida_id':game,'p_empresa_id':company,'p_cutoff_day':cycle*30-1},status['SERVICE_ROLE_KEY'])
     for order in [e for e in book['events'].values() if e['type']=='order' and int(e['orderedDay'])//30+1==cycle]:
      r=rpc('side_record_material_receipt_v1',{'p_order_id':order['orderId'],'p_receipt_id':order['orderId']+'-qa','p_quantity':order['quantity'],'p_day':(cycle-1)*30},status['SERVICE_ROLE_KEY']);assert not r.get('error'),r
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda _:worker(game,cycle),range(2)))
    official=rpc('side_historial_oficial',{'p_partida_id':game,'p_empresa_id':None},teacher['access_token'])
    closed=[r for r in official['cycles'] if r['status']=='confirmed'];assert len(closed)==cycle*3
    for row in closed:
     key=(row['empresa_id'],row['ciclo']);digest=hashlib.sha256(json.dumps(row['result'],sort_keys=True).encode()).hexdigest()
     assert before_hashes.get(key,digest)==digest;before_hashes[key]=digest
    for sc,s,ident,company in students:
     row=next(r for r in closed if int(r['empresa_id'])==int(company) and int(r['ciclo'])==cycle);f=row['result']['financial'];receipt=row['result']['receipt']
     assert (receipt['produced']==0 and receipt['sold']==0) if os.environ.get('SIDE_CUT_QA') and company==students[2][3] else (receipt['produced']>0 and receipt['sold']>0),(cycle,company,receipt)
     if os.environ.get('SIDE_FINAL_QA'):
      assert f['loanPolicyVersion']=='french-v1';assert f['balanceGeneral']['deuda']>=0
      if cycle==count:assert f['balanceGeneral']['deuda']==0
      news=s.evaluate('''async ({game,company})=>{const r=await SIDE.SupabaseClient.getStudent().rpc('side_student_events_v1',{p_partida_id:game,p_empresa_id:company});if(r.error)throw r.error;return r.data}''',{'game':game,'company':company})
      assert news is not None
      if receipt['events']:assert all(e['id'] in ['PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77'] for e in receipt['events'])
     if os.environ.get('SIDE_INTEGRAL_ECONOMY'):
      expected=plan(cycle,students.index((sc,s,ident,company)))['PRODUCCION_META']['moldTargets']
      assert receipt['production']['target']==sum(expected.values()),(receipt['production'],expected)
      assert len([x for x in receipt['sales'] if x['produced']>0])==1
      assert round(f['estadoResultados']['ventasTotales']-f['estadoResultados']['costoVentas'],2)==f['estadoResultados']['utilidadBruta']
      assert abs(f['balanceGeneral']['activos']-f['balanceGeneral']['pasivoPatrimonio'])<.011
      for lot in f.get('lotMovements',[]):assert abs(lot['inventoryValue']-round(lot['inventoryValue'],2))<1e-8
      scenario.setdefault('economics',[]).append({'cycle':cycle,'company':company,'product':next(x['id'] for x in receipt['sales'] if x['produced']>0),'target':receipt['production']['target'],'produced':receipt['produced'],'sold':receipt['sold'],'income':f['estadoResultados']['ventasTotales'],'cogs':f['estadoResultados']['costoVentas'],'profit':f['estadoResultados']['utilidadNeta'],'cash':f['balanceCaja']['cajaFinal'],'tax':f['estadoResultados']['impuestoRenta']})
     if company in previous:assert abs(float(f['balanceCaja']['cajaInicial'])-previous[company]['cash'])<.02,(f,previous[company])
     if company in previous:
      assert receipt['openingInventory']==previous[company]['inventory'],(receipt['openingInventory'],previous[company])
      if os.environ.get('SIDE_FINAL_QA'):
       paid=sum(p['principal'] for p in f['loanPayments']);assert abs(f['balanceGeneral']['deuda']-previous[company]['debt']+paid)<.011
      else:assert f['balanceGeneral']['deuda']==previous[company]['debt']
     previous[company]={'cash':float(f['balanceCaja']['cajaFinal']),'inventory':receipt['inventory'],'goods':receipt.get('goods'),'debt':f['balanceGeneral'].get('deuda')}
     assert abs(float(f['balanceGeneral']['activos'])-float(f['balanceGeneral']['pasivoPatrimonio']))<.03
     s.evaluate('refreshStudentGame({forceHydrate:true})');s.wait_for_function(f'financialReport().history.length==={cycle}',timeout=15000)
     view=s.evaluate('financialReport()');assert len(view['history'])==cycle,(view,cycle)
     if cycle==1:
      sc.set_offline(True);s.evaluate('refreshStudentGame({forceHydrate:true})');assert len(s.evaluate('financialReport().history'))==cycle
      sc.set_offline(False);s.evaluate('refreshStudentGame({forceHydrate:true})')
     denied=s.evaluate('''async ({game,other})=>{const r=await SIDE.SupabaseClient.getStudent().rpc('side_historial_oficial',{p_partida_id:game,p_empresa_id:other});return !!r.error;}''',{'game':game,'other':students[(students.index((sc,s,ident,company))+1)%3][3]})
     assert denied,'Cross-company history must be denied'
     for statement in ['estadoResultados','balanceCaja','flujoCaja','balanceGeneral']:assert view['history'][-1][statement]==f[statement]
    t.bring_to_front();t.evaluate('loadReports()');t.locator('[data-tab="resultados"]').click();t.wait_for_function('state.reports.length===3')
    for old in range(1,cycle+1):
     t.locator('#resultCycleSelect').select_option(str(old));t.wait_for_timeout(100)
     assert t.locator('#resultComparison tbody tr').count()==3
     assert 'pendiente' not in t.locator('#resultComparison tbody').inner_text().lower()
    lab=t.evaluate('''async game=>{const h=await SIDE_LAB_SERVICE.history(game);return h}''',game)
    assert [r for r in lab['cycles'] if r['status']=='confirmed']==closed
    t.locator('[data-tab="laboratorio"]').click();t.wait_for_selector('#lab-cycle');t.locator('#lab-game').select_option(game);t.locator('#lab-refresh').click();t.wait_for_timeout(1200);t.locator('#lab-cycle').select_option(str(cycle));t.wait_for_timeout(700)
    t.screenshot(path=str(OUT/f'lab-{count}-{cycle}.png'))
    print('PASS cycle',count,cycle,'official economics and student/lab history',flush=True)
    scenario['checks'].append({'cutWithDraft':bool(os.environ.get('SIDE_CUT_QA')),'cycle':cycle,'confirmedCompanies':3,'produced':receipt['produced'],'sold':receipt['sold'],'cash':f['balanceCaja']['cajaFinal'],'immutableClosures':len(closed)})
    t.locator('[data-tab="rondas"]').click()
    if mode=='manual':
     t.wait_for_function('state.advanceReadiness?.ready===true&&!document.getElementById("advanceRound").disabled',timeout=20000)
     observer.wait_for_function('state.advanceReadiness?.ready===true',timeout=20000)
     if os.environ.get('SIDE_CUT_QA'):
      t.reload(wait_until='networkidle');t.locator('[data-tab="rondas"]').click();t.wait_for_function('state.advanceReadiness?.ready===true&&!document.getElementById("advanceRound").disabled',timeout=20000)
     t.screenshot(path=str(OUT/f'enabled-{count}-{cycle}.png'))
     if cycle==1:
      assert t.evaluate('()=>{void refreshTeacherGame();const wasBusy=teacherBusy;for(let i=0;i<5;i++)document.getElementById("advanceRound").click();return wasBusy;}')
      observer.evaluate('document.getElementById("advanceRound").click()')
     else:t.locator('#advanceRound').click()
     if cycle<count:
      observer.wait_for_function(f'state.round==={cycle+1}',timeout=20000)
      for sc,s,ident,company in students:s.wait_for_function(f'currentRound()==={cycle+1}',timeout=20000)
     scenario['checks'][-1]['advanceEnabledBeforeClick']=True
     scenario['checks'][-1]['allTabsSynchronized']=True

    else:t.evaluate('refreshTeacherGame()')
    if cycle<count:t.wait_for_function(f'state.round==={cycle+1}',timeout=15000)
   for retry in range(90):
    if t.evaluate('runtime()?.phase==="finished"'):break
    t.evaluate('refreshTeacherGame()');t.wait_for_timeout(1000)
   else:raise AssertionError(t.evaluate('({runtime:runtime(),busy:teacherBusy,failures:state.syncFailures,retryAt:state.syncRetryAt,status:document.querySelector("#roundState")?.textContent})'))
   t.reload(wait_until='networkidle');t.locator('[data-tab="historial"]').click();t.wait_for_timeout(1500);t.screenshot(path=str(OUT/f'history-{count}.png'))
   if os.environ.get('SIDE_INTEGRAL_ECONOMY'):
    assert any(r['profit']<0 for r in scenario['economics']) and any(r['profit']>0 for r in scenario['economics']),scenario['economics']
   assert not errors,errors
   assert not local_failures,local_failures
   scenario['pageErrors']=errors;scenario['failedLocalResources']=local_failures;scenario['blockedHistoricalGame']=os.environ.get('HISTORY_BLOCKED_GAME');evidence.append(scenario);(OUT/('integration-'+str(count)+'.json')).write_text(json.dumps(evidence,indent=2))
   print('PASS',count,'manual cycles, 3 companies, two teacher tabs, repeated clicks, actual Auth/PostgREST/PostgreSQL/Edge, immutable economics and lab',flush=True)
   for sc,*_ in students:sc.close()
   ctx.close()
 except Exception:
  if not t.is_closed():
   t.screenshot(path=str(OUT/'failure.png'),timeout=15000)
   (OUT/'failure.json').write_text(json.dumps({'errors':errors,'resources':local_failures,'state':t.evaluate('({runtime:runtime(),busy:teacherBusy,status:document.getElementById("roundState").textContent,readiness:state.advanceReadiness})')},indent=2))
  raise
 finally:browser.close();server.shutdown()
