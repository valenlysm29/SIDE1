"""Decision controls and send actions, isolated from real accounts and services."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/decisions_restored_20261027'
OUT.mkdir(parents=True,exist_ok=True)
SETUP="""() => {
  localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-UI27',capital:200000,cycles:3,roundHours:8}));
  SIDE3D={suspend(){},cycleProductionRecord:()=>null};
  currentStudent={name:'Prueba local',company:'EMPRESA UI',game:{...DEMO_GAME,codigo:'SIDE-UI27'}};
  loadDecisionState();openDecisionMenu();
  for(const item of allDecisionItems())if(item.options&&itemRequired(item)&&['choice','multi-choice'].includes(item.type))initDraft(item).optionIds=[item.defaultOptionIds?.[0]||item.options[0].id];
  Object.assign(decisionDrafts,{
    MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_basica:1}},ACABADOS:{quantities:{aca_basica:1}},MOLDE:{optionIds:['molde_1','molde_2','molde_3']},
    PERS_CORTE:{quantities:{corte_basico:1}},PERS_ENSAMBLE:{quantities:{ens_personal_basico:1},assignments:{ens_personal_basico:{ens_basica:25}}},PERS_ACABADO:{quantities:{aca_personal_basico:1},assignments:{aca_personal_basico:{aca_basica:50}}},
    CANALES:{optionIds:[],quantities:{}},CUERO:{quantities:{cuero_sint:30}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:600}},
    PRODUCCION_META:{moldTargets:{molde_1:100,molde_2:0,molde_3:0},prices:{esencial:'',urbano:'bad',premium:null}}
  });for(const cat of ['B','C','F','D','E']){currentCategory=cat;persistCurrentDraftOnly();}currentCategory='C';renderDecisionCategory();
}"""

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        page=browser.new_page(viewport={'width':1366,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/*',lambda route:route.abort())
        page.set_content(document('index.html'),wait_until='load')
        page.wait_for_load_state('networkidle');page.evaluate(SETUP)
        assert page.locator('[data-sale-price], [data-worker-assignment], [data-choice="REGIMEN_LABORAL"]').count()==0
        text=page.locator('#decisionCards').inner_text()
        assert 'Precio de venta por segmento' not in text and 'Trabajadores por tipo de máquina' not in text
        assert 'Reducir personal respecto al ciclo anterior' not in text
        assert page.locator('#sendDecisionSection').is_enabled()
        page.screenshot(path=str(OUT/'produccion-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.screenshot(path=str(OUT/'produccion-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1366,'height':900})
        page.locator('#sendDecisionSection').click()
        assert page.evaluate("sectionSubmitted('C')")
        assert page.locator('#sendDecisionSection').is_disabled()
        assert page.evaluate("Object.hasOwn(decisionState.PERS_ENSAMBLE,'assignments')")==False
        cash=page.evaluate('cashBalance()');assert page.evaluate('sendCurrentSection()')==False
        assert page.evaluate('cashBalance()')==cash
        page.locator('[data-cat="D"]').click()
        assert page.locator('#sendDecisionSection').is_disabled()
        page.locator('[data-choice="CANALES"][data-option="web"]').locator('..').click()
        assert page.locator('#sendDecisionSection').is_enabled()
        page.screenshot(path=str(OUT/'ventas.png'),full_page=True)
        page.locator('#sendDecisionSection').click();assert page.evaluate("sectionSubmitted('D')")
        page.locator('[data-cat="B"]').click()
        assert page.evaluate("computeItemCost(findDecisionItem('MOLDE'))")==303
        mesa=page.locator('[data-qty="MESA_CORTE"][data-option="mesa"]')
        mesa.fill('100000');page.evaluate('updateHud()')
        assert page.locator('#sendDecisionSection').is_disabled()
        mesa.fill('1')
        assert page.locator('#sendDecisionSection').is_enabled()
        page.locator('#sendDecisionSection').click();assert page.evaluate("sectionSubmitted('B')")
        assert page.evaluate('decisionState.MOLDE.optionIds')==['molde_1']
        page.locator('[data-cat="E"]').click()
        assert page.locator('[data-number="INV_MARKETING"]').count()==0
        assert page.locator('[data-choice="INV_MARKETING"]').count()==3
        page.locator('[data-choice="INV_MARKETING"][data-option="mkt_alta"]').locator('..').click()
        assert page.evaluate("computeItemCost(findDecisionItem('INV_MARKETING'))")==12000
        page.screenshot(path=str(OUT/'finanzas.png'),full_page=True)
        page.locator('#sendDecisionSection').click();assert page.evaluate("sectionSubmitted('E')")
        assert page.evaluate("buildSupabaseDecision(findDecisionItem('INV_MARKETING'),decisionState.INV_MARKETING,currentRound()).opcion_id")=='mkt_alta'
        page.locator('[data-cat="F"]').click();page.locator('#sendDecisionSection').click()
        assert page.evaluate("decisionCategories().every(c=>sectionSubmitted(c.cat))")
        assert page.evaluate('decisionsSubmitted()')
        assert page.evaluate('buildStudentSnapshot().decisions_submitted')
        original=page.evaluate('JSON.stringify({state:decisionState,ledger:cashLedger,cash:cashBalance()})')
        projection=page.evaluate("""() => ({
          units:cycleSalesProjection().receipt.sold,
          income:financialReport({projection:true}).estadoResultados.ingresos,
          recorded:financialReport().estadoResultados.ingresos,
          closed:!!decisionState.__cycleSettlements?.[currentRound()],
          html:cycleSalesHtml()
        })""")
        assert projection['units']==100 and projection['income']==4250
        assert projection['recorded']==0 and projection['closed']==False
        assert 'Unidades vendidas estimadas' in projection['html']
        assert 'Ingresos estimados del ciclo' in page.locator('#companySummaryMount').inner_text()
        assert 'Unidades vendidas estimadas: 100' in page.locator('#companySummaryMount').inner_text()
        page.evaluate('cycleSalesProjection();financialReport({projection:true});renderCompanySummary()')
        assert page.evaluate('JSON.stringify({state:decisionState,ledger:cashLedger,cash:cashBalance()})')==original
        assert page.evaluate('syncStudentReportPreview().ingresos')==0
        page.screenshot(path=str(OUT/'ventas-estimadas-ciclo-abierto.png'),full_page=True)
        result=page.evaluate("""() => {
          const closed=SIDE_CYCLE_MODEL.close({state:decisionState,ledger:cashLedger,catalog:DECISION_CATALOG,round:currentRound(),capital:initialCapital(),sectionsByRound:recordedFinancialSections()});
          return {receipt:closed.receipt,financial:closed.financial};
        }""")
        assert result['receipt']['production']['days']==30
        assert result['receipt']['produced']==100 and result['receipt']['revenue']==4250
        assert result['receipt']['reputation']['factorPublicidad']==10
        assert abs(result['financial']['balanceGeneral']['activos']-result['financial']['balanceGeneral']['pasivoPatrimonio'])<.02
        final=page.evaluate("""() => {
          const closed=SIDE_CYCLE_MODEL.close({state:decisionState,ledger:cashLedger,catalog:DECISION_CATALOG,round:currentRound(),capital:initialCapital(),sectionsByRound:recordedFinancialSections()});
          decisionState=closed.state;cashLedger=closed.ledger;
          return {projection:cycleSalesProjection(),income:financialReport({projection:true}).estadoResultados.ingresos,html:cycleSalesHtml()};
        }""")
        assert final['projection']==None and final['income']==4250
        assert 'Ventas por segmento' in final['html'] and 'Unidades vendidas estimadas' not in final['html']
        page.evaluate(SETUP)
        page.locator('[data-cat="D"]').click()
        page.locator('[data-choice="CANALES"][data-option="web"]').locator('..').click()
        page.locator('#topSubmitAllDecisions').click()
        assert page.locator('#confirmCompanyReview').is_enabled()
        page.locator('#confirmCompanyReview').click()
        assert page.evaluate('decisionsSubmitted()')
        assert page.evaluate('Boolean(decisionState.__cyclePlans[currentRound()])')
        assert errors==[],errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'errors':errors,**result},ensure_ascii=False,indent=2),encoding='utf-8')
        print('PASS: controles restaurados, borradores antiguos, presupuesto, cinco envíos individuales, envío completo y motor de 30 días.')
    finally:
        browser.close()
