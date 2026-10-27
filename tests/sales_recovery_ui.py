"""Isolated Chromium: real confirmation controls, legacy plans and visible sales."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/sales-recovery-ui'
OUT.mkdir(parents=True, exist_ok=True)
SETUP = """({mold}) => {
 localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-QA',capital:200000,cycles:3,roundHours:8}));
 SIDE3D={suspend(){},cycleProductionRecord:()=>null};
 currentStudent={name:'QA',company:'QA VENTAS',game:{...DEMO_GAME,codigo:'SIDE-QA'}};
 loadDecisionState();openDecisionMenu();
 for(const item of allDecisionItems())if(item.options&&itemRequired(item)&&['choice','multi-choice'].includes(item.type))initDraft(item).optionIds=[item.defaultOptionIds?.[0]||item.options[0].id];
 Object.assign(decisionDrafts,{
  MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_basica:1}},ACABADOS:{quantities:{aca_basica:1}},MOLDE:{optionIds:[mold]},
  PERS_CORTE:{quantities:{corte_basico:1}},PERS_ENSAMBLE:{quantities:{ens_personal_basico:1}},PERS_ACABADO:{quantities:{aca_personal_basico:1}},
  CANALES:{optionIds:['web'],quantities:{}},CUERO:{quantities:{cuero_sint:100}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:1500}},
  PRODUCCION_META:{moldTargets:{[mold]:90}}
 });
 for(const cat of ['B','C','D','E','F']){currentCategory=cat;persistCurrentDraftOnly();}
 currentCategory='B';renderDecisionCategory();
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        page = browser.new_page(viewport={'width':1366,'height':900})
        errors, rows = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda route: route.abort())
        page.set_content(document('index.html'), wait_until='load')
        page.wait_for_load_state('networkidle')
        for mold, income in [('molde_1',3825),('molde_2',9000),('molde_3',22500)]:
            page.evaluate(SETUP, {'mold':mold})
            for category in ['B','C','D','E','F']:
                page.locator(f'[data-cat="{category}"]').click()
                assert page.locator('#sendDecisionSection').is_enabled(), category
                page.locator('#sendDecisionSection').click()
                assert page.evaluate('(cat)=>sectionSubmitted(cat)', category)
            assert page.evaluate('simulationSubmissionComplete()')
            assert page.locator('[data-sale-price], [data-worker-assignment]').count() == 0
            page.evaluate("""() => {
             const plan=decisionState.__cyclePlans[currentRound()];
             plan.state.PERS_ENSAMBLE.assignments={ens_personal_basico:{ens_ind:1}};
             plan.state.PERS_ACABADO.assignments={};
             plan.state.PRODUCCION_META.prices={esencial:'',urbano:'bad',premium:null};
             decisionState.__financialSnapshots={[currentRound()]:SIDE_FINANCIAL_MODEL.calculate({capital:initialCapital(),round:currentRound()})};
             persistGameState();loadDecisionState();renderCompanySummary();renderStudentStatus();
            }""")
            before = page.evaluate('JSON.stringify({state:decisionState,ledger:cashLedger,cash:cashBalance()})')
            projected = page.evaluate("""() => ({
             sold:cycleSalesProjection().receipt.sold,income:financialReport({projection:true}).estadoResultados.ingresos,
             html:cycleSalesHtml(),recorded:financialReport().estadoResultados.ingresos
            })""")
            assert projected['sold'] == 90 and projected['income'] == income, projected
            assert projected['recorded'] == 0
            assert 'Unidades vendidas estimadas: 90' in page.locator('#companySummaryMount').inner_text()
            assert 'Unidades vendidas estimadas' in page.locator('#studentFinancialDetail').inner_text()
            page.evaluate('renderCompanySummary();renderStudentStatus();cycleSalesProjection()')
            assert page.evaluate('JSON.stringify({state:decisionState,ledger:cashLedger,cash:cashBalance()})') == before
            page.locator('div.cs-financial-scope').scroll_into_view_if_needed()
            page.screenshot(path=str(OUT/f'{mold}-estimado.png'), full_page=True)
            final = page.evaluate("""() => {
             const round=currentRound(),saved=decisionState.__cyclePlans[round];
             const r=SIDE_CYCLE_MODEL.close({state:SIDE_CYCLE_MODEL.restoreState(saved.state,decisionState),ledger:cashLedger,catalog:DECISION_CATALOG,round,capital:initialCapital(),sectionsByRound:recordedFinancialSections()});
             decisionState={...decisionState,...r.state};cashLedger=r.ledger;
             persistGameState();loadDecisionState();renderCompanySummary();renderStudentStatus();
             return {sold:decisionState.__cycleSettlements[round].sold,income:financialReport().estadoResultados.ingresos,projection:cycleSalesProjection(),html:cycleSalesHtml()};
            }""")
            assert final['sold'] == 90 and final['income'] == income and final['projection'] is None, final
            assert 'Unidades vendidas: 90' in page.locator('#companySummaryMount').inner_text()
            assert 'Unidades vendidas estimadas' not in page.locator('#studentFinancialDetail').inner_text()
            page.locator('div.cs-financial-scope').scroll_into_view_if_needed()
            page.locator('div.cs-financial-scope').screenshot(path=str(OUT/f'{mold}-ventas.png'))
            page.screenshot(path=str(OUT/f'{mold}-definitivo.png'), full_page=True)
            rows.append({'mold':mold,'sold':final['sold'],'revenue':final['income'],'projectionRevenue':projected['income']})
        assert errors == [], errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'rows':rows,'pageErrors':errors},indent=2),encoding='utf-8')
        print('PASS Chromium: three segments, five real confirmations each, legacy plans, estimated and final sales, reload, unchanged controls, no page errors.')
    finally:
        browser.close()
