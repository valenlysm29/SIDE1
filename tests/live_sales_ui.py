"""Delivered student/teacher pages in separate browser contexts; no remote writes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/live-sales-ui'
OUT.mkdir(parents=True, exist_ok=True)

SETUP = """() => {
 localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-LIVE',capital:200000,cycles:3,roundHours:8}));
 SIDE3D={suspend(){},cycleProductionRecord:()=>null};
 currentStudent={name:'QA',company:'VENTAS EN VIVO',game:{...DEMO_GAME,codigo:'SIDE-LIVE'}};
 loadDecisionState();openDecisionMenu();
 for(const item of allDecisionItems())if(item.options&&itemRequired(item)&&['choice','multi-choice'].includes(item.type))initDraft(item).optionIds=[item.defaultOptionIds?.[0]||item.options[0].id];
 Object.assign(decisionDrafts,{
  MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_basica:1}},ACABADOS:{quantities:{aca_basica:1}},MOLDE:{optionIds:['molde_1']},
  PERS_CORTE:{quantities:{corte_basico:1}},PERS_ENSAMBLE:{quantities:{ens_personal_basico:1}},PERS_ACABADO:{quantities:{aca_personal_basico:1}},
  CANALES:{optionIds:['web'],quantities:{}},CUERO:{quantities:{cuero_sint:100}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:1500}},
  PRODUCCION_META:{moldTargets:{molde_1:90}}
 });
 for(const cat of ['B','C','D','E','F']){currentCategory=cat;persistCurrentDraftOnly();}
 currentCategory='B';renderDecisionCategory();
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        docs = {name: document(name) for name in ['index.html', 'docente.html']}
        errors = []
        contexts = [browser.new_context(viewport={'width':1440,'height':1000}) for _ in range(2)]
        for context in contexts:
            context.route('**/*', lambda route: route.fulfill(content_type='text/html', body=docs[route.request.url.rsplit('/',1)[-1]]) if route.request.url in ['http://side-live.test/index.html','http://side-live.test/docente.html'] else route.abort())
        student, teacher = [context.new_page() for context in contexts]
        for page in [student, teacher]:
            page.on('pageerror', lambda e: errors.append(str(e)))
        student.goto('http://side-live.test/index.html', wait_until='networkidle')
        student.evaluate(SETUP)
        for category in ['B','C','D','E','F']:
            student.locator(f'[data-cat="{category}"]').click()
            student.locator('#sendDecisionSection').click()
            assert student.evaluate('(cat)=>sectionSubmitted(cat)', category)
        student.evaluate("currentStudent.empresaId=7;renderStudentStatus();renderCompanySummary()")
        initial = student.evaluate("""() => ({snapshot:buildStudentSnapshot(),report:syncStudentReportPreview(),projection:cycleSalesProjection(),cash:cashBalance(),ledger:JSON.stringify(cashLedger)})""")
        assert initial['projection']['receipt']['sold'] == 90
        assert initial['projection']['receipt']['revenue'] == 3825
        assert initial['report']['ingresos'] == 0
        assert initial['report']['liveProjection']['receipt']['sold'] == 90
        payload = student.evaluate("""(report) => {
         const original=queueStudentSnapshot;let sent;
         queueStudentSnapshot=(snapshot,operation)=>{sent=operation.payload;return Promise.resolve(true)};
         try{syncReportToSupabase(report)}finally{queueStudentSnapshot=original}
         return sent;
        }""", initial['report'])
        assert payload['ingresos'] == 0
        assert payload['estado_resultados']['liveProjection']['receipt']['sold'] == 90
        teacher.goto('http://side-live.test/docente.html', wait_until='networkidle')
        teacher.evaluate("""() => {
         state.partidaId='room-live';state.round=1;$('gameCode').value='SIDE-LIVE';
         localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions'}));
         window.liveSnapshot={};window.liveReport=null;window.reads=0;
         SIDE.SupabaseClient.isReady=()=>true;
         SIDE.SupabaseClient.get=()=>({channel:()=>({on(){return this},subscribe(cb){cb('SUBSCRIBED');return this}}),removeChannel(){}});
         SIDE.PartidaService.listarParticipantes=async()=>({success:true,data:[{empresa_id:7,empresa:'VENTAS EN VIVO',nombre:'QA',empresas:{nombre_comercial:'VENTAS EN VIVO',ciclo_actual:1,caja_inicial:200000}}]});
         SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
         SIDE.DecisionesService.obtenerReporte=async()=>{reads++;return {success:true,data:{empresa:{nombre_comercial:'VENTAS EN VIVO',ciclo_actual:1,caja_inicial:200000},reportes:liveReport?[liveReport]:[],decisiones:[],contexto_juego:{partida_id:'room-live',codigo:'SIDE-LIVE',ciclo:1,estado:'activa',phase:'decisions',configuracion:{},snapshot:liveSnapshot}}}};
         switchTab('empresas');startLiveCompanies();
        }""")
        teacher.wait_for_function('state.reports.length===1')
        assert teacher.evaluate('state.reports[0].unidadesVendidas') == 0
        # Changing only the network response must reach the DOM through the poll.
        teacher.evaluate('(snap)=>{liveSnapshot=snap}', initial['snapshot'])
        teacher.wait_for_function('state.reports[0].provisional===true && state.reports[0].unidadesVendidas===90', timeout=8000)
        assert teacher.locator('[data-field="sold"]').inner_text() == '90'
        assert '3,825' in teacher.locator('[data-field="income"]').inner_text()
        assert 'Estimación individual' in teacher.locator('[data-field="resultScope"]').inner_text()
        teacher.evaluate("switchTab('resultados')")
        assert 'Unidades vendidas estimadas' in teacher.locator('#detailReports').inner_text()
        assert '42.5' in teacher.locator('#detailReports').inner_text(), 'internal price must retain cents'
        assert '90' in teacher.locator('#detailReports').inner_text()
        teacher.screenshot(path=str(OUT/'docente-estimacion.png'), full_page=True)
        assert teacher.evaluate("localStorage.getItem('SIDE_STUDENT_REPORTS')") is None, 'separate devices must use server response'
        assert student.evaluate('JSON.stringify(cashLedger)') == initial['ledger']
        assert student.evaluate('cashBalance()') == initial['cash']

        final = student.evaluate("""() => {
         const r=SIDE_CYCLE_MODEL.close({state:decisionState,ledger:cashLedger,catalog:DECISION_CATALOG,round:1,capital:initialCapital(),sectionsByRound:recordedFinancialSections()});
         decisionState=r.state;cashLedger=r.ledger;persistGameState();renderCompanySummary();renderStudentStatus();
         return {snapshot:buildStudentSnapshot(),result:r,report:syncStudentReportPreview()};
        }""")
        teacher.evaluate('(snap)=>{liveSnapshot=snap}', final['snapshot'])
        teacher.wait_for_function('state.reports[0].provisional===false && state.reports[0].cycleReceipt?.sold===90', timeout=8000)
        assert 'Resultado definitivo' in teacher.locator('#detailReports').inner_text()
        assert 'Unidades vendidas estimadas' not in teacher.locator('#detailReports').inner_text()
        assert 'Unidades vendidas: 90' in student.locator('#companySummaryMount').inner_text()
        teacher.screenshot(path=str(OUT/'docente-definitivo.png'), full_page=True)

        # An existing SQL installation can read the compatible JSON report too.
        teacher.evaluate("""(payload) => {
         liveReport={ciclo:1,ingresos:0,estado_resultados:{liveProjection:payload}};
         SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{empresa:{nombre_comercial:'VENTAS EN VIVO',ciclo_actual:1,caja_inicial:200000},reportes:[liveReport]}});
         confirmedReportClosures.clear();return loadReports();
        }""", initial['report']['liveProjection'])
        teacher.wait_for_function('state.reports[0].provisional===true && state.reports[0].unidadesVendidas===90')
        teacher.evaluate("""(receipt) => {liveReport={ciclo:1,ingresos:receipt.revenue,estado_resultados:{ingresos:receipt.revenue,cycleReceipt:receipt}};return loadReports()}""", final['result']['receipt'])
        teacher.wait_for_function('state.reports[0].provisional===false && state.reports[0].unidadesVendidas===90')
        assert errors == [], errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'sold':90,'revenue':3825,'pageErrors':errors,'independentBrowserContexts':True}, indent=2), encoding='utf-8')
        print('PASS Chromium: five real confirmations, separate student/teacher devices, automatic three-second refresh, compatible SQL transport, final replacement and unchanged cash while previewing.')
    finally:
        browser.close()
