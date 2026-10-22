"""Player observations: isolated browser, local engine, no production writes."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
import browser_fixture as fixture

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/player-observations-20261021'
OUT.mkdir(parents=True, exist_ok=True)
checks = []

def ok(label, value=True):
    assert value, label
    checks.append(label)
    print('PASS', label, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, locale='es-PE')
    page.route('**/*', lambda route: route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    config = {'nombre': 'Prueba', 'curso': 'Finanzas', 'codigo': 'SIDE-QA', 'capital': 100000,
              'lifecycleVersion': 2, 'motor_version': 'side-lotes-2026-10-20', 'cycles': 3,
              'cycleCloseMode': 'manual', 'roundMinutes': 5, 'integrationDurationMinutes': 5,
              'runtime': {'round': 1, 'phase': 'decisions', 'status': 'running', 'running': True}}
    fixture.load(page, 'docente.html', {'SIDE_TEACHER_CONFIG': json.dumps(config)})
    page.evaluate("""() => {
      window.createdRooms=0;prepareGame=async()=>{window.createdRooms++;};
      document.getElementById('gameName').value='Prueba';document.getElementById('gameCourse').value='Finanzas';
      document.getElementById('saveAll').click();
    }""")
    ok('Guardar configuración no crea sala ni inicia integración', page.evaluate('createdRooms===0'))
    page.close()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, locale='es-PE')
    page.route('**/*', lambda route: route.abort())
    page.on('pageerror', lambda error: errors.append(str(error)))
    fixture.load(page, 'index.html', {'SIDE_TEACHER_CONFIG': json.dumps(config),
                 'SIDE_ACTIVE_ROUND': '1', 'SIDE_ROUND_RUNTIME': json.dumps(config['runtime']),
                 'SIDE_GAME_STATUS': json.dumps({'active': True})})
    page.evaluate("""() => {
      currentStudent={company:'QA',legalName:'QA SAC',game:{codigo:'SIDE-QA',nombre:'Prueba'}};
      studentConnected=true;loadDecisionState();
      const d=SIDE_EXCEL_UI.nuevasDecisiones();
      d.personal={corte:[[1,0,0],[0,0,0],[0,0,0]],ensamble:[[1,0,0],[0,0,0],[0,0,0]],acabado:[[1,0,0],[0,0,0],[0,0,0]]};
      d.maquinaria={mesa:1,'INF-02':1,'INF-05':1,'INF-08':1};
      d.comprasUnidades={'INS-01':100,'INS-04':200,'INS-06':5};
      d.lotes=[{segmento:'SEG-01',cantidad:100,precio:40,molde:'INF-08',cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06'}];
      decisionState.__excel={habilitado:true,round:1,decisiones:d,cajaTransicion:100000};persistGameState();
      currentCategory='C';showScreen('decisionMenu');renderDecisionCategory();updateIntegrationUI();
    }""")
    expect(page.locator('.production-dop')).to_be_visible()
    expect(page.locator('.pd-connectors path')).to_have_count(7)
    ok('DOP de lotes muestra operaciones y siete conectores')
    expect(page.get_by_text('Costos obligatorios del ciclo', exact=True)).to_be_visible()
    ok('Costos visibles conservan caja antes del cierre', page.evaluate('cashBalance()===100000'))
    page.locator('[data-lote="0"][data-campo="cantidad"]').fill('200')
    expect(page.locator('.pd-plan').first).to_contain_text('200')
    ok('DOP y recomendaciones se actualizan al editar cantidad')
    page.locator('[data-pd-node="cut"]').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / 'dop-escritorio.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    expect(page.locator('.pd-connectors path')).to_have_count(7)
    page.locator('[data-pd-node="cut"]').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / 'dop-movil.png'))
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.locator('[data-lote="0"][data-campo="cantidad"]').fill('100')
    page.locator('[data-excel-enviar]').click()
    ok('Plan se confirma sin guardar antes', page.evaluate('decisionState.__excel.enviado'))
    metrics = page.evaluate("""() => {
      const reports=[{id:excelCompanyId(),partida:excelGameCode(),empresa:'QA',capital:100000,excelDecisionState:decisionState.__excel}];
      const close=SIDE_EXCEL_UI.cerrarLocal({game:excelGameCode(),ciclo:1,reports,motorVersion:SIDE_EXCEL_CONFIG.MOTOR_ACTUAL});
      const result=close.resultadosPorEmpresa[excelCompanyId()];
      decisionState.__excel={...decisionState.__excel,resultado:result,historial:close.historialPorEmpresa[excelCompanyId()]};
      localStorage.setItem('SIDE_ACTIVE_ROUND','2');
      const c=teacherConfig();c.runtime={round:2,phase:'decisions',status:'running',running:true};
      localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(c.runtime));
      renderStudentStatus();
      return {produced:result.produccion.totalProducido,sold:result.unidadesVendidas,income:result.ingresos,history:financialReport().history.length};
    }""")
    ok('Cierre genera producción, ventas e ingresos reales', metrics['produced'] > 0 and metrics['sold'] > 0 and metrics['income'] > 0)
    ok('Ciclo siguiente conserva resultados anteriores', metrics['history'] == 1)
    expect(page.locator('#studentCycleHistory')).to_contain_text('Ciclo 1')
    page.evaluate("""() => {
      const c=teacherConfig();c.runtime.status='paused';c.runtime.running=false;
      localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(c.runtime));
      updateIntegrationUI();
    }""")
    expect(page.locator('#decisionMenu [data-cycle-paused]')).to_be_visible()
    ok('Pausa aparece al jugador y bloquea mundo', page.evaluate('!canExploreWorld()'))
    page.evaluate("""() => {
      showScreen('studentLobby');Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});
      currentStudent.empresaId='remote';renderStudentConnection();
    }""")
    expect(page.locator('#studentConnectionStatus')).to_contain_text('Sin conexión a internet')
    ok('Desconexión no aparece como conectado')
    page.evaluate("""() => {
      currentStudent.empresaId=null;decisionState.__excel=null;
      const c=teacherConfig();delete c.motor_version;c.runtime.status='running';c.runtime.running=true;
      localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(c.runtime));
      updateIntegrationUI();currentCategory='E';decisionState={};decisionDrafts={};showScreen('decisionMenu');renderDecisionCategory();
    }""")
    expect(page.locator('#sendDecisionSection')).to_be_enabled()
    page.locator('#sendDecisionSection').click()
    ok('Finanzas vacías se envían directamente', page.evaluate("sectionSubmitted('E')"))
    page.evaluate("""() => {
      hydrateRemoteProgress({partida:{},empresa:{estado:'eliminada'},snapshot:{decision_state:{}}});
    }""")
    expect(page.locator('#studentExpelledModal')).to_be_visible()
    ok('Empresa eliminada recibe aviso y no puede operar', page.evaluate('currentStudent.expulsada&&!studentAccess().canOperate&&!studentConnected'))
    page.screenshot(path=str(OUT / 'empresa-eliminada.png'))
    ok('Sin errores JavaScript', not errors)
    (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'metrics': metrics, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    browser.close()

