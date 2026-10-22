"""Delivered decisions UI, isolated mocked Supabase and responsive layout checks."""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright,expect
from browser_fixture import document
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/decisions-editable';OUT.mkdir(parents=True,exist_ok=True)
source=(ROOT/'tests/student_sync_ui.test.js').read_text(encoding='utf-8')
mock=re.search(r'const mock=`(.*?)`;',source,re.S)[1]
mock=mock.replace("capital:100000,round:1,cycles:6","capital:100000,round:1,cycles:6,motor_version:'side-lotes-2026-10-20'")
mock+="\nSIDE.PartidaService.excelDisponible=async()=>({available:false,motorVersion:null});\n"
html=re.sub(r'<script>\s*const fixtureData=[\s\S]*?</script>','',document('index.html'))
html=html.replace('const cfg = window.SIDE_CONFIG || {};',mock+'\nconst cfg = window.SIDE_CONFIG || {};')
checks=[]
def ok(label,condition=True):
    assert condition,label
    checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    context=browser.new_context(viewport={'width':1366,'height':900})
    page=context.new_page();errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda route:route.abort())
    page.route('http://side-editable.test/**',lambda route:route.fulfill(content_type='text/html',body=html))
    page.goto('http://side-editable.test/');page.wait_for_load_state('networkidle')
    page.evaluate("""async()=>{
      stopStudentSync();currentStudent={game:{id:'test-game',codigo:'SIDE-418'},company:'Marca A',legalName:'Legal A',empresaId:1,snapshotRevision:server.revision};
      studentConnected=true;studentProgressHydrated=true;persistStudentSession();await refreshStudentGame();stopStudentSync();
      currentCategory='B';openDecisionMenu();
    }""")
    def category(cat):
        page.locator('[data-cat="'+cat+'"]').click()
        if cat!='A':page.locator('#excelEditorTitle').wait_for(state='attached')
    def fill(selector,value):
        field=page.locator(selector).first
        expect(field).to_be_enabled();expect(field).to_be_visible()
        field.fill(str(value));field.press('Tab')
    category('B');fill('[data-activo="mesa"]',1)
    ok('Infrastructure editable despite unavailable optional RPC',page.evaluate('decisionState.__excel.decisiones.maquinaria.mesa===1'))
    fill('[data-activo="mesa"]',10);expect(page.locator('[data-activo="mesa"]')).to_have_value('1')
    ok('Single cutting table limit enforced')
    category('C');fill('[data-personal="corte,0,0"]',1);fill('[data-lote="0"][data-campo="cantidad"]',2);fill('[data-lote="0"][data-campo="precio"]',65)
    ok('Production personnel and quantities persist',page.evaluate('decisionState.__excel.decisiones.personal.corte[0][0]===1&&decisionState.__excel.decisiones.lotes[0].cantidad===2'))
    category('F');fill('[data-compra="INS-01"]',1)
    ok('Logistics material quantities persist',page.evaluate('decisionState.__excel.decisiones.comprasUnidades["INS-01"]===1'))
    category('D');fill('[data-excel-tienda="los_olivos"]',1)
    ok('Sales stores and prices persist',page.evaluate('decisionState.__excel.decisiones.tiendasPorDistrito.los_olivos===1&&decisionState.__excel.decisiones.lotes[0].precio===65'))
    category('E');fill('[data-excel-prestamo]',123.45)
    ok('Finance loan persists',page.evaluate('decisionState.__excel.decisiones.montoPrestamo===123.45'))
    fill('[data-excel-prestamo]',-10);ok('Negative amount cannot enter the draft',page.evaluate('decisionState.__excel.decisiones.montoPrestamo>=0'))
    fill('[data-excel-prestamo]',999999);ok('Loan cannot exceed approved credit',page.evaluate('decisionState.__excel.decisiones.montoPrestamo<=creditAvailable()'))
    fill('[data-excel-prestamo]',123.45)
    page.wait_for_function('!studentSyncPending()')
    ok('Autosave reaches mock server',page.evaluate('server.snapshot.decision_state.__excel.decisiones.montoPrestamo===123.45'))
    expect(page.locator('[data-student-sync-status]').last).to_have_text('Cambios guardados y sincronizados.')
    expect(page.locator('[data-excel-enviar]')).to_be_disabled()
    ok('Optional RPC failure only blocks confirmation')
    category('B');fill('[data-activo="INF-08"]',1)
    category('C')
    for area in ['ensamble','acabado']:fill('[data-personal="'+area+',0,0"]',1)
    for campo in ['segmento','molde','cuero','accesorios','hilo']:
        field=page.locator('[data-lote="0"][data-campo="'+campo+'"]')
        field.select_option(field.locator('option').evaluate_all('(els)=>els.find(el=>el.value)?.value'))
    category('D')
    canal=page.locator('[data-excel-grupo]').filter(has=page.locator('option[value="COM-01B"]'))
    canal.select_option('COM-01B')
    ok('Draft preparation visibly advances before confirmation',page.evaluate('decisionProgressPercent()>0&&document.getElementById("decisionProgressHint").textContent.includes("Borrador")||decisionProgressPercent()>0&&document.getElementById("decisionProgressHint").textContent.includes("borrador")'))
    ok('Cash HUD reflects current draft',page.evaluate('document.getElementById("cashBalance").textContent===money(excelDraftProjection().cashAfter)&&excelDraftProjection().cashAfter!==cashBalance()'))
    category('A')
    ok('Summary includes estimated cash and planned spending',page.locator('.excel-resultados').first.inner_text().find('Gastos previstos')>=0)
    expect(page.locator('.excel-resultados').first).to_contain_text(page.locator('#cashBalance').inner_text())
    page.wait_for_function('!studentSyncPending()');page.reload();page.wait_for_load_state('networkidle')
    page.wait_for_function('studentSessionRecoveryTask===null&&studentProgressHydrated')
    page.evaluate('()=>{stopStudentSync();openDecisionMenu()}')
    category('E');expect(page.locator('[data-excel-prestamo]')).to_have_value('123.45')
    ok('Saved decisions survive browser reload',page.evaluate('decisionState.__excel.decisiones.maquinaria.mesa===1&&decisionState.__excel.decisiones.comprasUnidades["INS-01"]===1&&decisionState.__excel.decisiones.personal.corte[0][0]===1'))
    for width,height in [(1900,1000),(1366,900),(1024,768),(768,1024),(390,844),(320,568),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        dims=page.evaluate("""()=>{
          const ids=['.decision-topbar-identity','.decision-topbar-metrics','.decision-topbar-actions'];
          const rects=ids.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}});
          const overlaps=(a,b)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
          const timer=document.getElementById('decisionRoundTimer'),r=timer.getBoundingClientRect(),style=getComputedStyle(timer);
          return {overflow:document.documentElement.scrollWidth>innerWidth,overlap:rects.some((a,i)=>rects.some((b,j)=>i<j&&overlaps(a,b))),nowrap:style.whiteSpace==='nowrap',timerFits:timer.scrollWidth<=timer.clientWidth+1,track:document.querySelector('.mission-track').getBoundingClientRect().width};
        }""")
        ok(f'Header clear and timer unbroken {width}x{height}',not dims['overflow'] and not dims['overlap'] and dims['nowrap'] and dims['timerFits'] and dims['track']>=100)
        page.screenshot(path=str(OUT/f'header-{width}x{height}.png'))
    for phase,status,label in [('decisions','paused','Pause'),('results','finished','Closed cycle'),('finished','simulation-finished','Finished game')]:
        page.evaluate("""({phase,status})=>{authoritativeStudentState.config.lifecycleVersion=2;authoritativeStudentState.runtime={round:1,phase,status,running:false,remaining:0};currentCategory='E';renderDecisionCategory()}""",{'phase':phase,'status':status})
        expect(page.locator('[data-excel-prestamo]')).to_be_disabled()
        ok(label+' blocks editing with explanation',page.locator('#excelProductionMount').inner_text().find('Ciclo en pausa')>=0 if status=='paused' else bool(page.locator('#excelProductionMount [role="status"]').first.inner_text()))
    page.evaluate("""()=>{authoritativeStudentState.runtime={round:1,phase:'decisions',status:'paused',running:false,remaining:600};renderDecisionCategory();authoritativeStudentState.runtime={round:1,phase:'decisions',status:'running',running:true,remaining:600,startedAt:new Date().toISOString(),duration:600};updateIntegrationUI()}""")
    expect(page.locator('[data-excel-prestamo]')).to_be_enabled()
    ok('Resume restores editing without changing tabs')
    page.evaluate("""()=>{authoritativeStudentState.runtime={round:1,phase:'decisions',status:'running',running:true,remaining:600,startedAt:new Date(studentNow()-601000).toISOString(),duration:600};syncStudentTimer()}""")
    before=page.evaluate('JSON.stringify(decisionState.__excel.decisiones)')
    page.locator('[data-excel-prestamo]').evaluate("el=>{el.value='900';el.dispatchEvent(new Event('input',{bubbles:true}))}")
    ok('Expired timer prevents edits before server refresh',page.evaluate('JSON.stringify(decisionState.__excel.decisiones)')==before)
    expect(page.locator('[data-excel-prestamo]')).to_be_disabled()
    page.evaluate("""()=>{authoritativeStudentState.runtime={round:1,phase:'decisions',status:'running',running:true,remaining:600,startedAt:new Date().toISOString(),duration:600};SIDE.PartidaService.excelDisponible=async()=>({available:true,motorVersion:SIDE_EXCEL_CONFIG.MOTOR_ACTUAL});renderDecisionCategory()}""")
    category('B');fill('[data-activo="INF-02"]',100)
    category('C');page.locator('[data-excel-enviar]').click()
    expect(page.locator('[data-excel-status]')).to_contain_text('supera la caja')
    ok('Confirmation rejects spending beyond available cash',page.evaluate('!decisionsSubmitted()'))
    category('B');fill('[data-activo="INF-02"]',1);fill('[data-activo="INF-05"]',1)
    category('C');fill('[data-lote="0"][data-campo="cantidad"]',999999)
    page.locator('[data-excel-enviar]').click()
    expect(page.locator('[data-excel-status]')).to_contain_text('supera la capacidad')
    ok('Confirmation rejects unavailable capacity and materials',page.evaluate('!decisionsSubmitted()'))
    fill('[data-lote="0"][data-campo="cantidad"]',1)
    category('F')
    for code in ['INS-01','INS-04','INS-06']:fill('[data-compra="'+code+'"]',1)
    page.locator('#topSubmitAllDecisions').click()
    expect(page.locator('[data-excel-enviar]')).to_be_enabled()
    page.locator('[data-excel-enviar]').click()
    expect(page.locator('[data-excel-status]')).to_contain_text('Plan del ciclo confirmado')
    page.wait_for_function('!studentSyncPending()')
    ok('Review and confirm flow saves the final plan',page.evaluate('decisionsSubmitted()&&server.snapshot.decision_state.__excel.enviado'))
    expect(page.locator('[data-lote="0"][data-campo="cantidad"]')).to_be_disabled()
    ok('Confirmed plan remains locked with explanation','confirmado' in page.locator('#excelProductionMount').inner_text())
    ok('No JavaScript exceptions',not errors)
    browser.close()
(OUT/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
