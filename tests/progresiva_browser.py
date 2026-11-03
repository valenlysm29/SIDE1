"""Verify all official cycles on the published Student, Teacher and Laboratory pages."""
import sys,json,re,hashlib,builtins,os
from pathlib import Path
from progresiva_oficial import ROOT,PROJECT,OUT,load,session
temporary=OUT/'browser-temp';temporary.mkdir(parents=True,exist_ok=True)
for key in ['TEMP','TMP','TMPDIR']:os.environ[key]=str(temporary)
sys.path.insert(0,str(PROJECT/'.codex-work/python'))
from playwright.sync_api import sync_playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeout
BASE='https://valenlysm29.github.io/SIDE1/'
cycles=int(sys.argv[1]);m=load(cycles)
h=json.loads((OUT/(str(cycles)+'-historia-'+str(cycles)+'.json')).read_text())
rows=[r for r in h['cycles'] if r['status']=='confirmed']
assert len(rows)==cycles*12
by={(str(r['empresa_id']),r['ciclo']):r['result'] for r in rows}
evidence={'partida':m['game']['codigo'],'ciclos':cycles,'checks':[],'errors':[],'reloaded':False,'reentryRetries':[]}
def amount(t):return builtins.round(float(re.sub(r'[^0-9.\-]','',t)),2)
def init(s,student=False):
 key='side-student-auth' if student else 'sb-plfuwfdpsagzrlveqkvl-auth-token'
 return 'localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(s))+');'
def statements(actual,expected):
 for key in ['estadoResultados','balanceCaja','flujoCaja','balanceGeneral']:assert actual[key]==expected[key],key
def navigate(page,url=None):
 if url:page.goto(url,wait_until='domcontentloaded',timeout=60000)
 else:page.reload(wait_until='domcontentloaded',timeout=60000)
 # This app polls continuously; readiness is established by the official state
 # predicates below when the active requests never reach network idle.
 try:page.wait_for_load_state('networkidle',timeout=5000)
 except PlaywrightTimeout:pass
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding'])
 tc=browser.new_context(viewport={'width':1440,'height':1050});tc.add_init_script(init(session(cycles)))
 t=tc.new_page();t.on('pageerror',lambda e:evidence['errors'].append(str(e)))
 try:
  navigate(t,BASE+'docente.html?qa=progresiva')
  t.wait_for_function('(game)=>state.partidaId===game',arg=m['game']['id'],timeout=60000)
  t.wait_for_function('state.reports.length===12&&state.reports.every(r=>r.cycleHistory?.filter(x=>x.closureStatus==="confirmed").length>0)',timeout=120000)
  # Reload exercises the actual persisted history instead of browser state.
  navigate(t);t.wait_for_function('(n)=>state.reports.length===12&&state.reports.every(r=>r.cycleHistory?.filter(x=>x.closureStatus==="confirmed").length===n)',arg=cycles,timeout=120000)
  evidence['reloaded']=True
  actual=t.evaluate('state.reports.map(r=>({id:r.empresaId,cycles:r.cycleHistory.map(c=>({round:c.round,estadoResultados:c.estadoResultados,balanceCaja:c.balanceCaja,flujoCaja:c.flujoCaja,balanceGeneral:c.balanceGeneral,status:c.closureStatus}))}))')
  for company in actual:
   for row in company['cycles']:
    assert row['status']=='confirmed';statements(row,by[(str(company['id']),row['round'])]['financial'])
  t.locator('[data-tab="resultados"]').click()
  for round in range(1,cycles+1):
   t.locator('#resultCycleSelect').select_option(str(round))
   dom=t.locator('#resultComparison tbody tr').evaluate_all('(rows)=>rows.map(r=>Array.from(r.cells).map(c=>c.textContent))');assert len(dom)==12
   for company in m['companies']:
    cells=next(r for r in dom if r[0]==company['name']);r=by[(str(company['id']),round)]
    assert amount(cells[3])==r['receipt']['revenue'];assert amount(cells[7])==r['financial']['estadoResultados']['utilidadNeta'];assert amount(cells[8])==r['financial']['balanceCaja']['cajaFinal']
    evidence['checks'].append({'vista':'docente','empresa':company['id'],'ciclo':round,'exacto':True})
  t.screenshot(path=str(OUT/('docente-'+str(cycles)+'-final.png')),full_page=True)
  print('UI TEACHER',cycles,len(evidence['checks']),flush=True)
  t.locator('[data-tab="laboratorio"]').click();t.wait_for_selector('#lab-game')
  t.locator('#lab-game').select_option(m['game']['id']);t.locator('#lab-refresh').click()
  t.wait_for_function('document.querySelectorAll("#lab-company option").length===12',timeout=60000)
  lab=t.evaluate('async game=>{const h=await SIDE_LAB_SERVICE.history(game);return h.cycles.filter(c=>c.status==="confirmed").map(c=>({id:c.empresa_id,round:c.ciclo,financial:{estadoResultados:c.result.financial.estadoResultados,balanceCaja:c.result.financial.balanceCaja,flujoCaja:c.result.financial.flujoCaja,balanceGeneral:c.result.financial.balanceGeneral}}))}',m['game']['id'])
  assert len(lab)==len(rows)
  for row in lab:statements(row['financial'],by[(str(row['id']),row['round'])]['financial'])
  for round in range(1,cycles+1):
   t.locator('#lab-cycle').select_option(str(round))
   for company in m['companies']:
    t.locator('#lab-company').select_option(str(company['id']))
    t.wait_for_function('expected=>{const c=document.querySelector(".lab-context");return c&&c.textContent.includes(expected.name)&&c.textContent.trim().endsWith("Ciclo "+expected.round)&&document.querySelectorAll(".lab-metrics strong").length===4}',arg={'name':company['name'],'round':round},timeout=60000)
    r=by[(str(company['id']),round)];metrics=t.locator('.lab-metrics strong').all_text_contents()
    assert amount(metrics[0])==r['receipt']['revenue'];assert amount(metrics[1])==r['financial']['estadoResultados']['utilidadNeta']
    assert not t.locator('.lab-warning').count(),'Laboratory inconsistency warning'
    evidence['checks'].append({'vista':'laboratorio','empresa':company['id'],'ciclo':round,'exacto':True})
  t.screenshot(path=str(OUT/('laboratorio-'+str(cycles)+'-final.png')),full_page=True)
  print('UI LAB',cycles,len(lab),flush=True)
  for company in m['companies']:
   sc=browser.new_context(viewport={'width':1440,'height':1080});sc.add_init_script(init(session(cycles,company['key']),True))
   s=sc.new_page();s.on('pageerror',lambda e:evidence['errors'].append(str(e)))
   try:
    navigate(s,BASE+'index.html?qa=progresiva')
    s.locator('#startBtn').click(timeout=60000);s.locator('[data-profile="student"]').click()
    s.locator('#gameCode').fill(m['game']['codigo']);s.locator('#companyLegalName').fill(company['name']+' SAC');s.locator('#companyBrandName').fill(company['name'])
    for attempt in range(2):
     s.locator('#studentForm button[type="submit"]').click()
     try:
      s.wait_for_function('studentConnected&&currentStudent.empresaId',timeout=30000)
      break
     except PlaywrightTimeout:
      if attempt or not s.locator('#studentForm').is_visible():raise
      evidence['reentryRetries'].append({'empresa':company['id'],'attempt':attempt+1})
      print('UI REENTRY RETRY',cycles,company['key'],flush=True)
    assert str(s.evaluate('currentStudent.empresaId'))==str(company['id'])
    s.evaluate('refreshStudentGame({forceHydrate:true})')
    s.wait_for_function('(n)=>currentRound()===n&&financialReport().closureStatus==="confirmed"&&financialReport().history?.length===n',arg=cycles,timeout=60000)
    actual=s.evaluate('financialReport()')
    for row in actual['history']:
     expected=by[(str(company['id']),row['round'])]
     statements(row,expected['financial'])
     text=s.locator('#studentCycleHistory [data-history-round="'+str(row['round'])+'"] > summary').inner_text()
     values=re.search(r'utilidad\s+(.*?)\s+·\s+caja\s+(.*)$',text)
     assert values,text
     assert amount(values[1])==expected['financial']['estadoResultados']['utilidadNeta']
     assert amount(values[2])==expected['financial']['balanceCaja']['cajaFinal']
     evidence['checks'].append({'vista':'estudiante','empresa':company['id'],'ciclo':row['round'],'exacto':True})
    assert amount(s.locator('#studentIncomeResult').inner_text())==by[(str(company['id']),cycles)]['financial']['estadoResultados']['utilidadNeta'],{'company':company['id'],'round':s.evaluate('currentRound()'),'visible':s.locator('#studentIncomeResult').inner_text(),'expected':by[(str(company['id']),cycles)]['financial']['estadoResultados']['utilidadNeta']}
    assert amount(s.locator('#studentCashResult').inner_text())==by[(str(company['id']),cycles)]['financial']['balanceCaja']['cajaFinal']
    # Reload must preserve the same official balances without resubmission.
    navigate(s);s.wait_for_function('(n)=>studentConnected&&currentRound()===n&&financialReport().closureStatus==="confirmed"&&financialReport().history?.length===n',arg=cycles,timeout=60000)
    refreshed=s.evaluate('financialReport()')
    for row in refreshed['history']:statements(row,by[(str(company['id']),row['round'])]['financial'])
    if company['key']=='combinado-eficiente':s.screenshot(path=str(OUT/('estudiante-'+str(cycles)+'-combinado.png')),full_page=True)
    print('UI STUDENT',cycles,company['key'],flush=True)
   except Exception as error:
    print('UI STUDENT FAILURE',company['key'],repr(error),s.locator('body').inner_text()[-1800:],flush=True)
    raise
   finally:sc.close()
  assert len(evidence['checks'])==cycles*12*3;assert not evidence['errors'],evidence['errors']
  evidence['passed']=True
 except Exception as error:
  print('UI FAILURE',repr(error),flush=True)
  try:print('UI STATE',t.evaluate('({labStatus:document.querySelector("#lab-status")?.textContent,context:document.querySelector(".lab-context")?.textContent,metrics:document.querySelectorAll(".lab-metrics strong").length,reports:state.reports.map(r=>({id:r.empresaId,error:r.historyError,cycles:r.cycleHistory?.length}))})'),flush=True)
  except Exception:pass
  raise
 finally:
  (OUT/('interfaces-'+str(cycles)+'.json')).write_text(json.dumps(evidence,indent=2))
  if not evidence.get('passed'):
   try:t.screenshot(path=str(OUT/('error-ui-'+str(cycles)+'.png')),full_page=True,timeout=5000)
   except Exception:pass
  browser.close()
