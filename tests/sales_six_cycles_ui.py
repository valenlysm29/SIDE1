"""Six continuous cycles: select all decisions in the delivered student UI,
close/advance with teacher buttons, retain histories, export snapshots for SQL replay.
Uses an isolated browser origin. No writes to the user's hosted database.
"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/sales-six-cycles'
OUT.mkdir(parents=True, exist_ok=True)
PLANS = [
    {'molde_1':100}, {'molde_2':120}, {'molde_3':100},
    {'molde_1':40,'molde_2':40,'molde_3':40}, {'molde_3':140}, {'molde_3':160},
]
RECIPES = {'molde_1':(.3,1,6),'molde_2':(.4,1,7),'molde_3':(.7,1,13)}

def shared_document(name):
    # Native Web Storage is shared between the student/teacher pages and survives
    # reload; remove only the in-memory storage shim of the offline HTML fixture.
    return re.sub(r'<script>\s*const fixtureData=.*?</script>', '', document(name), count=1, flags=re.S)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        context = browser.new_context(viewport={'width':1440,'height':1000},locale='es-PE',timezone_id='America/Lima')
        context.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}';document.head.appendChild(s);});")
        docs = {name:shared_document(name) for name in ['index.html','docente.html']}
        context.route('**/*', lambda route: route.fulfill(content_type='text/html',body=docs[route.request.url.rsplit('/',1)[-1]]) if route.request.url in ['http://side.test/index.html','http://side.test/docente.html'] else route.abort())
        student = context.new_page()
        errors=[]
        context.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
        student.on('pageerror',lambda error:errors.append(str(error)))
        student.goto('http://side.test/index.html',wait_until='networkidle')
        student.evaluate("""() => {
         localStorage.clear();const now=new Date().toISOString();
         const runtime={round:1,phase:'decisions',status:'running',running:true,startedAt:now,duration:3600,remaining:3600};
         const config={codigo:'SIDE-QA6',nombre:'Prueba seis ciclos',capitalMode:'fixed',capital:200000,cycles:6,lifecycleVersion:2,cycleCloseMode:'manual',integrationMinutes:0,roundHours:1,roundMinutes:0,interest:20,creditPercentStart:20,enabledEvents:[],gameStartedAt:now,gameStartAt:now,runtime};
         localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(config));localStorage.setItem('SIDE_ACTIVE_ROUND','1');
         localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:now,code:'SIDE-QA6'}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(runtime));
         SIDE3D={suspend(){},cycleProductionRecord:()=>null};
         currentStudent={name:'QA',company:'EMPRESA SEIS CICLOS',game:{...DEMO_GAME,codigo:'SIDE-QA6'}};
         studentConnected=true;persistStudentSession();loadDecisionState();startStudentSync();openDecisionMenu();
        }""")
        teacher=context.new_page();teacher.goto('http://side.test/docente.html',wait_until='networkidle')
        teacher.locator('[data-tab="rondas"]').click()

        def tab(category):
            student.locator(f'[data-cat="{category}"]').click()

        def quantity(item,option,amount):
            student.locator(f'[data-qty="{item}"][data-option="{option}"]').fill(str(amount))

        def choice(item,option):
            field=student.locator(f'[data-choice="{item}"][data-option="{option}"]')
            if not field.is_checked():
                field.locator('..').click()
            assert student.locator(f'[data-choice="{item}"][data-option="{option}"]').is_checked()

        def send(category):
            assert student.locator('#sendDecisionSection').is_enabled(), student.locator('#sectionSaveHint').inner_text()
            student.locator('#sendDecisionSection').click()
            assert student.evaluate('(cat)=>sectionSubmitted(cat)',category)

        rows=[]
        for cycle,targets in enumerate(PLANS,1):
            student.wait_for_function('(round)=>currentRound()===round',arg=cycle)
            student.evaluate('openDecisionMenu()')
            notice=student.locator('#cycleCostsUnderstood')
            if notice.is_visible(): notice.click()
            assert not student.evaluate('decisionsSubmitted()')
            # All business choices below use the delivered controls.
            tab('B')
            for item,option in [('MESA_CORTE','mesa'),('ENSAMBLE','ens_basica'),('ACABADOS','aca_basica')]:
                quantity(item,option,1 if cycle==1 else 0)
            if cycle<=3:
                choice('MOLDE','molde_'+str(cycle))
            else:
                # Already owned molds are deliberately disabled for repurchase.
                assert student.locator('[data-choice="MOLDE"][data-option="molde_3"]').is_disabled()
            send('B')
            tab('C')
            for mold in RECIPES:
                student.locator('#productionMoldSelector').select_option(mold)
                student.locator(f'[data-mold-target="{mold}"]').fill(str(targets.get(mold,0)))
            for item,option in [('PERS_CORTE','corte_basico'),('PERS_ENSAMBLE','ens_personal_basico'),('PERS_ACABADO','aca_personal_basico')]:
                quantity(item,option,1)
            choice('JEFATURA','no_jefatura');choice('GARANTIA_PT','pt_30')
            send('C')
            tab('F')
            choice('ANALISTA_COMPRAS','no_analista');choice('GARANTIA_PROV','gar_0')
            requirements=[round(sum(amount*RECIPES[mold][i] for mold,amount in targets.items()),8) for i in range(3)]
            for (item,option),amount in zip([('CUERO','cuero_sint'),('ACCESORIOS','acc_eco'),('HILO','hilo_std')],requirements):
                quantity(item,option,amount)
            send('F')
            tab('D');choice('CANALES','web');send('D')
            tab('E');choice('INV_RRHH','cap_no');choice('INV_MARKETING','mkt_baja');send('E')
            assert student.evaluate('simulationSubmissionComplete()&&decisionsSubmitted()')
            print(f'SUBMITTED cycle {cycle}: all five decision sections selected and sent',flush=True)
            assert student.locator('[data-sale-price], [data-worker-assignment]').count()==0
            before=student.evaluate("""() => ({snapshot:buildStudentSnapshot(),projection:cycleSalesProjection().receipt,plan:productionPlan(),cash:cashBalance()})""")
            assert before['projection']['sold']==sum(targets.values()),before['projection']
            # Close through the real teacher control; student follows the lifecycle.
            teacher.locator('#cutRound').click()
            teacher.wait_for_function('state.authoritative.runtime.phase==="results"&&!teacherBusy')
            student.wait_for_function('(round)=>!!decisionState.__cycleSettlements?.[round]',arg=cycle)
            after=student.evaluate("""() => {
             const round=currentRound();renderStudentStatus();
             return {snapshot:buildStudentSnapshot(),receipt:decisionState.__cycleSettlements[round],financial:financialReport(),cash:cashBalance(),reports:JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')};
            }""")
            receipt=after['receipt'];financial=after['financial']
            assert receipt['produced']==sum(targets.values()) and receipt['sold']==receipt['produced']
            assert receipt['revenue']>0 and receipt['revenue']==sum(line['sold']*line['price'] for line in receipt['sales'])
            assert financial['estadoResultados']['ingresos']==receipt['revenue']
            assert len(after['snapshot']['decision_state']['__cycleSettlements'])==cycle
            assert abs(financial['balanceGeneral']['activos']-financial['balanceGeneral']['pasivoPatrimonio'])<.02
            sales_text=student.locator('#studentFinancialDetail').inner_text()
            assert 'Unidades vendidas estimadas' not in sales_text
            for line in receipt['sales']:
                if line['sold']:
                    assert f'Unidades vendidas {line["sold"]}' in sales_text.replace('\n',' ')
            teacher_result=teacher.evaluate('state.reports.find(r=>r.empresa==="EMPRESA SEIS CICLOS")')
            assert teacher_result['ingresos']==receipt['revenue']
            teacher_receipt=teacher_result.get('cycleReceipt') or teacher_result['gameState']['__cycleSettlements'][str(cycle)]
            assert teacher_receipt['sold']==receipt['sold']
            # A retry of the teacher close cannot charge, produce or sell again.
            teacher.locator('#cutRound').click();teacher.wait_for_function('!teacherBusy')
            retry=student.evaluate('JSON.stringify({state:decisionState,ledger:cashLedger})')
            student.evaluate('settleCycle();renderStudentStatus()')
            assert student.evaluate('JSON.stringify({state:decisionState,ledger:cashLedger})')==retry
            student.locator('#studentFinancialDetail').scroll_into_view_if_needed()
            student.locator('#studentFinancialDetail').screenshot(path=str(OUT/f'cycle-{cycle}-sales.png'),animations='disabled')
            # Persist actual browser storage, reload the delivered page and reopen.
            student.reload(wait_until='networkidle')
            student.wait_for_function('studentConnected')
            recovered=student.evaluate('({receipt:decisionState.__cycleSettlements[currentRound()],income:financialReport().estadoResultados.ingresos,cash:cashBalance()})')
            assert recovered['receipt']['sold']==receipt['sold'] and recovered['income']==receipt['revenue']
            assert recovered['cash']==after['cash']
            row={'cycle':cycle,'targets':targets,'materialsPurchased':dict(zip(['leather','accessories','thread'],requirements)),'produced':receipt['produced'],'sold':receipt['sold'],'revenue':receipt['revenue'],'profit':financial['estadoResultados']['utilidad'],'cash':after['cash'],'creditSales':receipt['accountsReceivable'],'collections':receipt['creditCollections'],'before':before,'after':after}
            rows.append(row)
            (OUT/'ui-results.json').write_text(json.dumps({'passed':False,'completedCycles':cycle,'rows':rows,'pageErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
            print(f'PASS cycle {cycle}: produced={row["produced"]}, sold={row["sold"]}, revenue={row["revenue"]}, cash={row["cash"]}',flush=True)
            teacher.locator('#advanceRound').click()
            if cycle<6:
                teacher.wait_for_function('(round)=>state.round===round&&!teacherBusy',arg=cycle+1)
            else:
                teacher.wait_for_function('state.authoritative.runtime.phase==="finished"&&!teacherBusy')
        assert errors==[],errors
        final={'passed':True,'completedCycles':6,'mode':'isolated browser with real controls and local teacher lifecycle','rows':rows,'pageErrors':errors,'totalSold':sum(row['sold'] for row in rows),'totalRevenue':sum(row['revenue'] for row in rows)}
        (OUT/'ui-results.json').write_text(json.dumps(final,ensure_ascii=False,indent=2),encoding='utf-8')
        for name in ['failure.png','failure-dom.txt']:
            (OUT/name).unlink(missing_ok=True)
        print('PASS: six complete cycles, 30 section submissions, six teacher closes/advances, six reloads, sales and income visible.',flush=True)
    except Exception:
        if 'student' in locals():
            student.screenshot(path=str(OUT/'failure.png'),full_page=True)
            (OUT/'failure-dom.txt').write_text(student.locator('body').inner_text(),encoding='utf-8')
        raise
    finally:
        browser.close()
