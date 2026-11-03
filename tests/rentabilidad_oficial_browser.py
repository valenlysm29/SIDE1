"""Real deployed pages + real Auth/PostgREST + official Edge closure; no mocks."""
import sys,json,re,hashlib
from pathlib import Path
from rentabilidad_oficial_setup import ROOT,PROJECT,OUT
sys.path.insert(0,str(PROJECT/'.codex-work/python'))
from playwright.sync_api import sync_playwright
BASE='https://valenlysm29.github.io/SIDE1/'
manifest=json.loads((OUT/'manifest.json').read_text())
official=json.loads((OUT/'official-history.json').read_text())
summary=json.loads((OUT/'official-summary.json').read_text())
by_id={str(x['empresa_id']):x['result'] for x in official['cycles'] if x['ciclo']==1 and x['status']=='confirmed'}
def amount(text):return round(float(re.sub(r'[^0-9.\-]','',text)),2)
def auth_script(session,student=False):
 key='side-student-auth' if student else 'sb-plfuwfdpsagzrlveqkvl-auth-token'
 return 'localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(session))+');'
def equal_statements(actual,expected):
 for key in ['estadoResultados','balanceCaja','flujoCaja','balanceGeneral']:
  assert actual[key]==expected[key],key
evidence={'url':BASE,'code':manifest['game']['codigo'],'cycle':1,'checks':[],'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding'])
 teacher_session=json.loads((OUT/'teacher-session.local.json').read_text())
 ctx=browser.new_context(viewport={'width':1440,'height':1080})
 ctx.add_init_script(auth_script(teacher_session))
 t=ctx.new_page();t.on('pageerror',lambda e:evidence['errors'].append(str(e)))
 try:
  t.goto(BASE+'docente.html?qa=8cd602a',wait_until='networkidle',timeout=60000)
  t.wait_for_function('(game)=>state.partidaId===game',arg=manifest['game']['id'],timeout=30000)
  t.evaluate('loadReports()');t.wait_for_function('state.reports.length===3',timeout=30000)
  t.locator('[data-tab="resultados"]').click();t.locator('#resultCycleSelect').select_option('1')
  t.wait_for_function('document.querySelectorAll("#resultComparison tbody tr").length===3',timeout=30000)
  teacher_rows=t.evaluate('state.reports.map(r=>({id:r.id,companyId:r.empresaId,cycles:r.cycleHistory}))')
  for company in manifest['companies']:
   strategy=company['strategy'];id=str(company['companyId']);expected=by_id[id]
   report=next(r for r in teacher_rows if str(r['companyId'])==id)
   cycle=next(r for r in report['cycles'] if r['round']==1)
   assert cycle['closureStatus']=='confirmed';equal_statements(cycle,expected['financial'])
   t.locator('#resultCompanySelect').select_option(report['id'])
   visible=t.locator('#resultComparison tbody tr').filter(has_text=company['name']).locator('td').all_text_contents()
   assert amount(visible[3])==expected['receipt']['revenue'];assert amount(visible[7])==expected['financial']['estadoResultados']['utilidadNeta'];assert amount(visible[8])==expected['financial']['balanceCaja']['cajaFinal']
   t.screenshot(path=str(OUT/('docente-'+strategy+'.png')),full_page=True)
   evidence['checks'].append({'strategy':strategy,'view':'docente','allFourStatementsEqual':True,'visibleValuesEqual':True})
  print('PASS deployed teacher: three official financial statements',flush=True)
  t.locator('[data-tab="laboratorio"]').click()
  t.wait_for_selector('#lab-game');t.locator('#lab-game').select_option(manifest['game']['id']);t.locator('#lab-refresh').click()
  t.wait_for_function('document.querySelectorAll("#lab-company option").length===3',timeout=30000)
  t.locator('#lab-cycle').select_option('1')
  lab_history=t.evaluate('async game=>await SIDE_LAB_SERVICE.history(game)',manifest['game']['id'])
  assert [x for x in lab_history['cycles'] if x['ciclo']==1]==[x for x in official['cycles'] if x['ciclo']==1]
  for company in manifest['companies']:
   id=str(company['companyId']);expected=by_id[id];strategy=company['strategy']
   t.locator('#lab-company').select_option(id)
   value=t.evaluate('r=>SIDE_LAB_MODEL.read(r)',expected)
   assert not value['inconsistent'] and value['breakdown']
   assert value['revenue']==expected['receipt']['revenue'];assert value['profit']==expected['financial']['estadoResultados']['utilidadNeta'];assert value['cash']==expected['financial']['balanceCaja']['cajaFinal']
   metrics=t.locator('.lab-metrics strong').all_text_contents()
   assert amount(metrics[0])==value['revenue'];assert amount(metrics[1])==value['profit']
   t.screenshot(path=str(OUT/('laboratorio-'+strategy+'.png')),full_page=True)
   evidence['checks'].append({'strategy':strategy,'view':'laboratorio','officialHistoryEqual':True,'visibleValuesEqual':True,'breakdownReconciled':True})
  print('PASS deployed laboratory: three official closures and visible values',flush=True)
  for company in manifest['companies']:
   strategy=company['strategy'];id=str(company['companyId']);expected=by_id[id]
   session=json.loads((OUT/(strategy+'-session.local.json')).read_text())
   sc=browser.new_context(viewport={'width':1440,'height':1080});sc.add_init_script(auth_script(session,True))
   s=sc.new_page();s.on('pageerror',lambda e:evidence['errors'].append(str(e)))
   try:
    s.goto(BASE+'index.html?qa=8cd602a',wait_until='networkidle',timeout=60000)
    s.locator('#startBtn').click(timeout=60000);s.locator('[data-profile="student"]').click()
    s.locator('#gameCode').fill(manifest['game']['codigo']);s.locator('#companyLegalName').fill(company['name']+' SAC');s.locator('#companyBrandName').fill(company['name']);s.locator('#studentForm button[type="submit"]').click()
    s.wait_for_function('studentConnected&&currentStudent.empresaId',timeout=30000)
    s.evaluate('refreshStudentGame({forceHydrate:true})')
    s.wait_for_function('financialReport().closureStatus==="confirmed"',timeout=30000)
    actual=s.evaluate('financialReport()');equal_statements(actual,expected['financial'])
    assert amount(s.locator('#studentIncomeResult').inner_text())==expected['financial']['estadoResultados']['utilidadNeta']
    assert amount(s.locator('#studentCashResult').inner_text())==expected['financial']['balanceCaja']['cajaFinal']
    income=s.locator('#studentIncomeStatement > span').all_text_contents()
    assert any('30,000' in x or '37,500' in x or '39,200' in x for x in income),income
    s.screenshot(path=str(OUT/('estudiante-'+strategy+'.png')),full_page=True)
    evidence['checks'].append({'strategy':strategy,'view':'estudiante','allFourStatementsEqual':True,'visibleValuesEqual':True})
    print('PASS deployed student',strategy,flush=True)
   finally:sc.close()
  evidence['passed']=len(evidence['checks'])==9
  assert evidence['passed']
 finally:
  (OUT/'browser-verification.json').write_text(json.dumps(evidence,indent=2))
  if not evidence.get('passed'):t.screenshot(path=str(OUT/'browser-failure.png'),full_page=True);(OUT/'browser-failure.txt').write_text(t.locator('body').inner_text(),encoding='utf8')
  browser.close()
