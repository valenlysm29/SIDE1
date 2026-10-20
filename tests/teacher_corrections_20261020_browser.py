"""Teacher corrections, isolated delivered DOM; no production writes or accounts."""
from pathlib import Path
import base64, json, mimetypes, os, sys
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
BASE=Path(os.environ.get('SIDE_BASE_ROOT',str(ROOT)))
sys.path.insert(0,str(BASE/'tests'))
import browser_fixture as fixture
fixture.ROOT=ROOT
# Reuse immutable image assets from SIDE1 when a sparse worktree omits them.
def asset_uri(relative):
    path=ROOT/relative
    if not path.is_file():path=BASE/relative
    if not path.is_file():return relative
    return 'data:'+str(mimetypes.guess_type(str(path))[0] or 'application/octet-stream')+';base64,'+base64.b64encode(path.read_bytes()).decode()
fixture.asset_uri=asset_uri
OUT=Path(os.environ.get('SIDE_QA_OUTPUT',str(ROOT/'tests/output/teacher-corrections-20261020')))
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(label,condition=True):
    assert condition,label
    checks.append(label)
    print('PASS',label,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',r'C:\Program Files\Google\Chrome\Application\chrome.exe'),headless=True)
    context=browser.new_context(viewport={'width':1440,'height':900},locale='es-PE',timezone_id='America/Lima')
    context.route('**/*',lambda route:route.abort())
    page=context.new_page()
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    config={'nombre':'SIDE QA','curso':'Finanzas','codigo':'SIDE-QA','capital':100000,'cycles':3,'roundHours':0,'roundMinutes':5,'cycleCloseMode':'manual','integrationDurationMinutes':5}
    fixture.load(page,'docente.html',{'SIDE_TEACHER_CONFIG':json.dumps(config)})
    page.wait_for_function("document.getElementById('configCycleCount').textContent.includes('/')")
    ok('57: versión docente usa constante compartida',page.locator('#teacherRelease').inner_text()=='2026.10.20.1')
    ok('30: menú y volver al inicio son botones',page.evaluate("[...document.querySelectorAll('.nav-btn,#backHome')].every(b=>b.type==='button')"))
    ok('Motor nuevo queda versionado',page.evaluate("getConfig().motor_version==='side-lotes-2026-10-20'"))
    page.locator('#capitalModeRandom').check()
    expect(page.locator('#randomCapitalFields')).to_be_visible()
    ok('1-2: modo aleatorio seleccionable antes de iniciar',page.evaluate("getComputedStyle($('capitalModeRandom').parentElement).borderTopColor==='rgb(255, 211, 41)'"))
    page.locator('#openEventPicker').click()
    page.locator('input[name=eventSelectionMode][value=random]').check()
    page.locator('#eventRandomize').click()
    expect(page.locator('#eventSelectionCount')).to_have_text('15 seleccionados de 92')
    ok('10: selección aleatoria funciona con selección inicial vacía',page.locator('.event-enable:checked').count()==15)
    page.locator('#eventRandomCount').fill('1');page.locator('#eventRandomize').click()
    expect(page.locator('#eventSelectionCount')).to_have_text('1 seleccionado de 92')
    ok('11: singular y contador total consistentes')
    ok('12: tabla permite desplazamiento accesible',page.locator('.event-table-wrap').get_attribute('tabindex')=='0' and page.locator('#eventTableHelp').is_visible())
    page.locator('#closeEventPicker').click()
    # Active paused state without services; late UI refreshes must derive one status.
    page.evaluate("""() => {loadReports=async()=>{};state.lifecycleVersion=1;state.round=1;state.authoritative={motor_version:'legacy'};
      localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:'2026-10-20T12:00:00Z'}));
      localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,running:false,status:'paused',phase:'decisions',remaining:300}));
      refreshSetupSummary();renderEventBank();} """)
    ok('1-5: bloqueo explicado y guardar deshabilitado',page.locator('#capitalModeRandom').is_disabled() and page.locator('#saveAll').is_disabled() and page.locator('#configLockNotice').is_visible() and 'Consulta' in page.locator('#configWelcome').inner_text())
    ok('16: ciclo pausado nunca figura en curso','pausado' in page.locator('#roundState').inner_text())
    ok('6: fecha manual refleja activación y explica fin estimado',page.locator('#startDate').input_value()=='2026-10-20' and 'estimación sin pausas' in page.locator('#academicCalendarHint').inner_text())
    ok('Partida existente conserva motor previo',page.evaluate("getConfig().motor_version==='legacy'"))
    page.locator('#openEventPicker').click()
    ok('9: eventos bloqueados incluso dentro del modal',page.locator('#eventRandomize').is_disabled() and page.locator('.event-enable').first.is_disabled() and page.locator('#eventLockNotice').is_visible())
    page.locator('#closeEventPicker').click()
    page.evaluate("window.scrollTo(0,600);switchTab('rondas')")
    ok('13-15: nombre unificado, scroll al inicio y un solo copiar código',page.locator('#pageTitle').inner_text()=='Rondas y eventos' and page.evaluate('scrollY===0') and page.get_by_role('button',name='Copiar código',exact=True).count()==1)
    page.evaluate("""() => {state.reports=[{id:'qa',empresa:'Empresa QA',nombre:'Estudiante QA',capital:100000,caja:97287.68,teacherScore:null,apartados:{B:{done:1,total:2,complete:false},F:{done:2,total:3,complete:false}},progreso:60}];switchTab('empresas');renderCompanies();}""")
    ok('20: indicadores identifican secciones y decisiones obligatorias','Infraestructura: 1/2' in page.locator('#companiesGrid').inner_text() and 'Logística: 2/3' in page.locator('#companiesGrid').inner_text())
    grade=page.locator('[data-grade]');grade.fill('25')
    ok('19: aviso inmediato de nota fuera de rango','entre 0 y 20' in page.locator('[data-grade-status]').inner_text())
    grade.press('Tab')
    ok('19: nota limitada al salir del campo',grade.input_value()=='20')
    page.evaluate("switchTab('podio');renderPodium()")
    ok('28-29: no sugiere podio de ceros ni publica sin notas','Sin datos suficientes' in page.locator('#sidePodium').inner_text() and page.locator('#publishPodium').is_disabled())
    page.evaluate("switchTab('resultados');renderResults()")
    ok('26: panel conserva ausencia de datos igual que PDF','Sin datos' in page.locator('#detailReports').inner_text())
    ok('27: nombre del producto usa el de la página',page.locator('.topbar-mark').inner_text().strip()=='SIMULADOR DE DECISIONES FINANCIERAS')
    # Hold PDF generation to observe its live loading state without a CDN dependency.
    page.evaluate("window.savedMakePdf=makePdf;makePdf=()=>new Promise(resolve=>window.finishPdf=resolve);showPdf();void 0")
    ok('25: indicador de carga visible con estado aria',page.locator('#pdfLoading').is_visible() and page.locator('#viewPdf').get_attribute('aria-busy')=='true' and 'Preparando' in page.locator('#viewPdf').inner_text())
    page.evaluate("finishPdf({output:()=>new Blob(['%PDF-1.7'],{type:'application/pdf'})})")
    page.wait_for_function("!pdfBusy")
    ok('25: controles recuperados tras generar',not page.locator('#viewPdf').is_disabled() and page.locator('#pdfLoading').is_hidden())
    page.evaluate('closePdfPreview()')
    # Real heartbeat derivation with retained latest stamp (existing fix, browser coverage).
    page.evaluate("""() => {state.reports=[{id:'remote',empresaId:'remote',empresa:'Conectada QA',fuente:'supabase'}];presenceTracker.observe(companyPresenceKey(state.reports[0]),new Date().toISOString());presenceTracker.observe(companyPresenceKey(state.reports[0]),null);switchTab('empresas');renderCompanies();}""")
    ok('18: presencia conserva heartbeat ante snapshot sin marca','CONECTADA' in page.locator('#companiesGrid').inner_text())
    for width,height in [(1440,900),(1150,666),(360,800),(414,896)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate("switchTab('configuracion')")
        ok(f'Docente sin overflow global {width}x{height}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        page.screenshot(path=str(OUT/f'docente-{width}x{height}.png'),full_page=True)
        page.locator('#openEventPicker').click()
        page.screenshot(path=str(OUT/f'eventos-{width}x{height}.png'))
        ok(f'Modal eventos contenido en viewport {width}',page.locator('#eventPicker').bounding_box()['width']<=width)
        page.locator('#closeEventPicker').click()
    ok('Sin errores JavaScript',not errors)
    browser.close()
(OUT/'teacher-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors,'scope':'DOM aislado de entrega local; sin cuentas ni producción.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'PASS {len(checks)} checks. {OUT}',flush=True)

