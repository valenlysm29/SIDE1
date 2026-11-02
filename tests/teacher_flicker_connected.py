"""Real local Supabase + unmodified teacher services; no RPC interception."""
import os, sys, json, subprocess, threading, urllib.request, time
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
sys.path.insert(0,str(PROJECT/'.codex-work/flicker-python'))
from playwright.sync_api import sync_playwright
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(PROJECT/'.codex-work/side-cli-verificacion'),'-o','json'],stderr=subprocess.DEVNULL))
base=status['API_URL']; key=status['ANON_KEY']
assert base.startswith('http://127.0.0.1:')
def rpc(name,args,token):
 return json.load(urllib.request.urlopen(urllib.request.Request(base+'/rest/v1/rpc/'+name,data=json.dumps(args).encode(),headers={'apikey':key,'Authorization':'Bearer '+token,'Content-Type':'application/json'})))
def settle(game,cycle):
 # Invoke the real trusted worker service only for this newly created test game.
 js="""const {remoteRpc}=require('./services/business_runtime.cjs');const rpc=remoteRpc(process.env.SIDE_TEST_URL,process.env.SIDE_TEST_KEY);const w={SIDE:{SupabaseClient:{get:()=>({rpc})}},SIDE_CYCLE_MODEL:require('./js/cycle_model'),SIDE_FINANCIAL_MODEL:require('./js/financial_model'),SIDE_FINANCE_CONFIG:require('./services/finance_config'),SIDE_DECISION_CATALOG:require('./js/decision_catalog'),SIDE_AUTHORIZED_EVENTS:require('./js/engine/eventos_autorizados')};require('./services/partida_service')(w);w.SIDE.PartidaService.cerrarNegocio(process.env.SIDE_TEST_GAME,Number(process.env.SIDE_TEST_ROUND)).then(r=>console.log(JSON.stringify(r)))"""
 env={**os.environ,'SIDE_TEST_URL':base,'SIDE_TEST_KEY':status['SERVICE_ROLE_KEY'],'SIDE_TEST_GAME':game,'SIDE_TEST_ROUND':str(cycle)}
 return json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,env=env,encoding='utf8'))
session=json.load(urllib.request.urlopen(urllib.request.Request(base+'/auth/v1/signup',data=b'{}',headers={'apikey':key,'Content-Type':'application/json'})))
uid=session['user']['id']
subprocess.check_call(['docker','exec','supabase_db_sidecliverificacion','psql','-U','postgres','-d','postgres','-c',f"insert into profesores(id,nombre,apellido) values ('{uid}','Prueba parpadeo','Aislada') on conflict(id) do nothing;"],stdout=subprocess.DEVNULL)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/js/config.js':
   body=('window.SIDE_CONFIG='+json.dumps({'SUPABASE_URL':base,'SUPABASE_PUBLISHABLE_KEY':key})+';').encode();self.send_response(200);self.send_header('Content-Type','application/javascript');self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
label=os.environ.get('FLICKER_LABEL','before');out=ROOT/'tests/output'/('flicker-'+label);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 context=browser.new_context(viewport={'width':1366,'height':900},record_video_dir=str(out))
 context.add_init_script('localStorage.setItem("sb-127-auth-token",'+json.dumps(json.dumps(session))+');')
 page=context.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append({'at':time.time(),'url':r.url.split('?')[0]}) if '/rest/v1/' in r.url else None)
 try:
  page.goto('http://127.0.0.1:'+str(server.server_port)+'/docente.html',wait_until='networkidle')
  page.locator('#integrationDurationMinutes').fill('1');page.locator('#cycles').fill('3');page.locator('#roundMinutes').fill('1')
  page.locator('#openEventPicker').click();page.locator('#eventSelectAll').click();page.locator('#closeEventPicker').click()
  page.locator('#startGame').click();page.wait_for_function('state.partidaId !== null',timeout=20000)
  game=page.evaluate('state.partidaId');code=page.locator('#gameCode').input_value()
  student=json.load(urllib.request.urlopen(urllib.request.Request(base+'/auth/v1/signup',data=b'{}',headers={'apikey':key,'Content-Type':'application/json'})))
  identity={'p_codigo':code,'p_nombre_legal':'Prueba visual','p_nombre_comercial':'Prueba visual'}
  joined=rpc('side_ingresar_empresa_segura',{**identity,'p_clave':None},student['access_token']);assert joined.get('success'),joined
  page.locator('[data-tab="rondas"]').click()
  page.wait_for_function('runtime()?.phase === "decisions"',timeout=85000)
  page.evaluate('''() => {window.mutations=[];window.originalNodes={};for(const id of ['cycleNews','enabledEventsSummary','eventBankBody','roundTimer','roundState','academicCalendar','lobbyCompanies']){const el=document.getElementById(id);if(!el)continue;originalNodes[id]=el.firstChild;new MutationObserver(records=>mutations.push({id,at:performance.now(),count:records.length,removed:records.reduce((n,r)=>n+r.removedNodes.length,0)})).observe(el,{childList:true,subtree:true,characterData:true});}}''')
  page.screenshot(path=str(out/'cycle-1.png'))
  page.wait_for_timeout(11000)
  result={'game':page.evaluate('state.partidaId'),'errors':errors,'mutations':page.evaluate('mutations'),'stable':page.evaluate('Object.fromEntries(Object.entries(originalNodes).map(([id,node])=>[id,node===document.getElementById(id).firstChild]))')}
  if label!='before':
   assert all(result['stable'][id] for id in ['cycleNews','enabledEventsSummary','eventBankBody','roundState']),result
   page.locator('[data-tab="configuracion"]').click();page.locator('#openEventPicker').click();field=page.locator('.event-repeat').first;field.focus();page.wait_for_timeout(7000)
   result['focusPreserved']=field.evaluate('(el)=>el===document.activeElement')
   assert result['focusPreserved']
   field.uncheck();page.wait_for_timeout(4000);assert not field.is_checked()
   page.locator('#eventSearch').fill('Navidad');assert page.locator('#eventBankBody tr').count()==1
   page.locator('#eventSearch').fill('');assert page.locator('#eventBankBody tr').count()>1
   # This local stack lacks side_legacy_event_context_v1. The separate event
   # walkthrough exercises news; this financial pass uses the UI to clear events.
   page.locator('#eventClearSelection').click();page.wait_for_timeout(4000)
   page.locator('#closeEventPicker').click()
   page.locator('[data-tab="rondas"]').click();result['cycles']=[]
   for cycle in range(1,4):
    current=rpc('obtener_estado_estudiante',identity,student['access_token'])
    snap=current.get('snapshot') or {};ds=snap.get('decision_state') or {}
    ds.setdefault('__cyclePlans',{})[str(cycle)]={'state':{}}
    snap.update(decision_state=ds,decisions_submitted=True)
    saved=rpc('guardar_estado_estudiante',{**identity,'p_snapshot':snap,'p_expected_revision':current['snapshot_revision']},student['access_token']);assert saved.get('success'),saved
    page.locator('#cutRound').click();page.wait_for_function('runtime()?.phase === "results"',timeout=20000)
    closed=settle(game,cycle);assert closed.get('success') and not closed.get('pending'),closed
    page.wait_for_timeout(4000)
    page.locator('[data-tab="resultados"]').click();page.wait_for_timeout(2000)
    page.screenshot(path=str(out/f'financial-results-{cycle}.png'))
    result['cycles'].append({'cycle':cycle,'closureConfirmed':closed.get('success'),'news':page.locator('#cycleNews').text_content()})
    page.locator('[data-tab="rondas"]').click()
    page.screenshot(path=str(out/f'results-{cycle}.png'))
    page.locator('#advanceRound').click();page.wait_for_timeout(4000)
    if cycle<3:
     page.wait_for_function(f'state.round === {cycle+1}');page.screenshot(path=str(out/f'cycle-{cycle+1}.png'))
     page.evaluate('window.mutations=[]');page.wait_for_timeout(7000)
     churn=page.evaluate("mutations.filter(m=>['cycleNews','eventBankBody','enabledEventsSummary','roundState'].includes(m.id))")
     assert not churn,churn
   result['finalPhase']=page.evaluate('runtime()?.phase');result['finalRound']=page.evaluate('state.round')
   assert result['finalPhase']=='finished'
   assert not errors,errors
  result['requests']=requests
  (out/'measurements.json').write_text(json.dumps(result,indent=2),encoding='utf8')
  print(json.dumps({k:v for k,v in result.items() if k not in ('requests','mutations')})+' mutationRecords='+str(len(result['mutations'])))
 except Exception:
  page.screenshot(path=str(out/'failure.png'));print(page.evaluate('({id:state.partidaId,runtime:runtime(),feedback:document.getElementById("creationFeedback").textContent,toast:document.getElementById("toast").textContent})'));raise
 finally:
  context.close();browser.close();server.shutdown()
