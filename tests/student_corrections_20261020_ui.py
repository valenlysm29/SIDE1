"""Student regressions. Set SIDE_ROOT to reuse omitted worktree assets."""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from threading import Thread
from urllib.parse import urlsplit, unquote
import json, mimetypes, os, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
FALLBACK=Path(os.environ.get('SIDE_ROOT',ROOT))
ENGINE=Path(os.environ['SIDE_ENGINE_ROOT']) if os.environ.get('SIDE_ENGINE_ROOT') else None
OUT=ROOT/'tests/output/student-corrections-20261020'
OUT.mkdir(parents=True,exist_ok=True)
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_GET(self):
  relative=unquote(urlsplit(self.path).path).lstrip('/') or 'index.html';file=(ROOT/relative).resolve()
  if not file.is_relative_to(ROOT): self.send_error(403);return
  if ENGINE and (relative.startswith('js/engine/') or relative=='js/decision_catalog.js'): file=ENGINE/relative
  if not file.is_file(): file=FALLBACK/relative
  if relative=='js/config.js': data=b'window.SIDE_CONFIG={};'
  elif not file.is_file(): self.send_error(404);return
  else: data=file.read_bytes()
  if relative=='index.html':
   text=data.decode('utf-8');text=re.sub(r'<link[^>]*href="https:[^>]+>','',text)
   text=re.sub(r'<script[^>]*src="js/simulator3d(?:-config)?\.js[^>]+></script>','',text)
   text=text.replace('<script src="js/app.js','<script>window.SIDE3D={preload:async()=>true,suspend(){},cycleProductionRecord:()=>null};</script><script src="js/app.js')
   data=text.encode('utf-8')
  self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(str(file))[0] or 'application/octet-stream');self.end_headers();self.wfile.write(data)
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}';results=[]
def passed(ids,detail): results.append({'ids':ids,'status':'passed','detail':detail})
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','C:/Program Files/Google/Chrome/Application/chrome.exe'))
  page=browser.new_page(viewport={'width':1150,'height':666});errors=[]
  page.on('pageerror',lambda error: errors.append(str(error)))
  page.route('**/*',lambda route: route.continue_() if urlsplit(route.request.url).netloc==urlsplit(origin).netloc else route.abort())
  page.goto(origin,wait_until='networkidle');page.wait_for_function("!document.getElementById('startBtn').disabled")
  assert page.locator('#loadingPercent').inner_text()=='100%'
  assert page.locator('#registerPasswordConfirm').count()==1 and page.locator('#forgotPassword').count()==1
  assert page.locator('#registerName').get_attribute('placeholder').startswith('Escribe')
  assert page.locator('[data-side-version]').inner_text()=='SIDE · v'+page.evaluate('SIDE_RELEASE.version')
  assert page.locator('meta[name=side-build]').get_attribute('content')==page.evaluate('SIDE_RELEASE.version')
  passed([57],'Una misma versión configura pie y metadatos del estudiante.')
  passed([54,55],'DOM preparado activa Empezar; ejemplos explícitos y campos de acceso completos.')
  page.evaluate("""()=>{const startedAt=new Date(Date.now()-42000).toISOString();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,roundHours:0,roundMinutes:10,cycles:6}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,running:true,startedAt,duration:600,remaining:600}));openDecisionMenu();}""")
  page.add_style_tag(content='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}')
  page.locator('[data-cat="E"]').click();credit=page.locator('[data-item="PRESTAMO"] .loan-box').inner_text()
  assert '70' in credit and 'Después de esta solicitud' in credit;passed([33],'Crédito disponible conserva S/ 70.000 sin solicitud.')
  page.locator('[data-cat="C"]').click();field=page.locator('[data-mold-target="molde_1"]');field.fill('50');field.press('Tab')
  assert '15' in page.locator('.mold-production-card').first.locator('.mold-requirements').inner_text()
  field=page.locator('[data-mold-target="molde_1"]');field.fill('-5')
  assert float(field.input_value() or '0')>=0
  assert page.evaluate("decisionDrafts.PRODUCCION_META.moldTargets.molde_1>=0")
  passed([36,37],'Comparación sin molde comprado y negativos rechazados o normalizados al escribir.')
  page.locator('[data-cat="D"]').click()
  for id_ in ['PERSONAL_VENTAS','CREDITO_VENTAS']:
   row=page.locator(f'[data-item="{id_}"]');assert 'GUARDADA' not in row.inner_text();assert row.locator('p').count()==1
  passed([47,48],'Reglas automáticas con descripción única y sin estado de decisión.')
  assert page.evaluate("materialYieldLabel('ACCESORIOS','acc_eco')")=='Cada compra aporta 1 unidad';passed([49],'Unidad singular.')
  order1=page.locator('#decisionTabs button').evaluate_all('(els)=>els.map(el=>el.dataset.cat)')
  page.evaluate("localStorage.setItem('SIDE_ACTIVE_ROUND','2');renderTabs()")
  assert order1==page.locator('#decisionTabs button').evaluate_all('(els)=>els.map(el=>el.dataset.cat)') and order1[-1]=='A'
  passed([44],'Orden estable de pestañas entre ciclos.')
  page.evaluate("localStorage.setItem('SIDE_ACTIVE_ROUND','1');renderTabs();currentCategory='A';renderDecisionCategory()")
  summary=page.locator('#companySummaryMount').inner_text();assert 'Supabase' not in summary and '24 días productivos' in summary;passed([42],'Resumen claro y días productivos del Excel.')
  assert page.locator('#cashBalance').inner_text()==page.locator('#projectedCash').inner_text();passed([35],'Un mismo valor de caja estimada.')
  cleaning=page.locator('[data-summary-item=LIMPIEZA]');assert cleaning.inner_text().count('Limpieza y servicios generales')==1 and 'Costo por ciclo' in cleaning.inner_text();passed([43],'Servicio fijo sin duplicación ni referencia por unidad.')
  page.evaluate("localStorage.setItem('SIDE_ACTIVE_ROUND','2');cashLedger={'1:SIM_GASTOS':-5000};updateCashHud()")
  assert '95' in page.locator('#cashMovement').inner_text();passed([45],'Caja inicial del ciclo 2 deriva del cierre anterior.')
  page.evaluate("cashLedger={};localStorage.setItem('SIDE_ACTIVE_ROUND','1');currentCategory='B';renderTabs();renderDecisionCategory()")
  assert 'Puedes bajar de 0' not in page.locator('#decisionCards').inner_text();passed([40],'Liquidación explicada como venta de equipos adquiridos.')
  page.evaluate('updateDeadlineWarning(60,true)');assert 'timer-warning' in page.locator('#decisionRoundTimer').get_attribute('class');assert page.locator('[data-cycle-deadline-warning]').last.is_visible()
  page.evaluate('updateDeadlineWarning(15,true)');assert 'timer-urgent' in page.locator('#decisionRoundTimer').get_attribute('class');assert 'automáticamente' in page.locator('[data-cycle-deadline-warning]').last.inner_text()
  page.evaluate('updateDeadlineWarning(120,true)');assert not page.locator('[data-cycle-deadline-warning]').last.is_visible();passed([34],'Avisos accesibles de 60 y 15 segundos.')
  page.evaluate("currentStudent.empresaId='fixture';showStudentSyncStatus('synced');currentStudent.empresaId=null")
  assert 'sincronizados' in page.locator('[data-student-sync-status]').first.inner_text();passed([46],'Confirmación explícita de sincronización.')
  page.evaluate("showStudentSyncStatus('');currentCategory='B';renderTabs();renderDecisionCategory()")
  layouts=[]
  for width,height in [(1150,666),(1440,900),(360,740),(390,844),(414,896)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
   geometry=page.locator('#decisionFormScroll').bounding_box();ratio=geometry['height']/height;layouts.append({'width':width,'height':height,'workingRatio':ratio})
   page.screenshot(path=str(OUT/f'estudiante-{width}x{height}.png'));assert ratio>=.60,layouts;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  passed([39],layouts)
  page.evaluate("localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:false}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,status:'finished',phase:'results',running:false}));updateIntegrationUI()")
  assert 'REVISA Y REGISTRA' not in page.locator('#lobbySegment').inner_text();passed([56],'Mensaje de cierre coherente.')
  if page.evaluate('Boolean(window.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL)'):
   page.evaluate("""()=>{localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:new Date().toISOString()}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions',status:'running',running:true,startedAt:new Date().toISOString(),duration:600,remaining:600}));const config=teacherConfig();config.motor_version=SIDE_EXCEL_CONFIG.MOTOR_ACTUAL;config.lifecycleVersion=2;config.phase='decisions';localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(config));currentCategory='B';openDecisionMenu();}""")
   for category,title in [('B','Infraestructura'),('C','Producción'),('F','Logística'),('D','Ventas'),('E','Finanzas')]:
    assert not errors,errors
    page.locator(f'[data-cat="{category}"]').click();page.locator('#excelProductionMount .excel-editor').wait_for()
    # The repeated inner header is intentionally hidden by excel.css in section mode.
    assert page.locator('#excelEditorTitle').text_content()==title
    assert page.locator('[data-excel-enable]').count()==0
    assert not page.locator('[data-excel-section]').evaluate_all('(els)=>els.some(el=>el.dataset.excelSection!==currentCategory)')
    page.screenshot(path=str(OUT/f'canonico-{category}.png'))
   page.locator('[data-cat="B"]').click();page.locator('#excelProductionMount details').evaluate_all('(els)=>els.forEach(el=>el.open=true)')
   page.locator('[data-activo="mesa"]').fill('1')
   page.locator('[data-cat="D"]').click();page.locator('[data-excel-marketing]').select_option('baja')
   page.locator('[data-cat="B"]').click();page.locator('#excelProductionMount details').evaluate_all('(els)=>els.forEach(el=>el.open=true)')
   assert page.locator('[data-activo="mesa"]').input_value()=='1'
   assert page.evaluate('decisionState.__excel.decisiones.marketingNivel')=='baja'
   passed([41,50],'Cinco secciones canónicas mantienen el mismo borrador; capacitación en Producción y marketing en Ventas.')
   assert page.evaluate("(()=>{const before=JSON.stringify(cashLedger);decisionState.__excel.enviado=true;return SIDE_GAME_BRIDGE.recordSimulatedSale(75)===false&&SIDE_GAME_BRIDGE.recordOperatingExpense(25)===false&&JSON.stringify(cashLedger)===before&&canStartSimulation();})()")
   passed([], 'Entrada 3D permitida tras confirmar; operaciones del recorrido no duplican caja del cierre canónico.')
  assert not errors,errors;browser.close()
finally:
 server.shutdown();(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
