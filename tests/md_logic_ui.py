"""Headless UI integration against the delivered HTML, isolated from real accounts."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/md_logic_ui'
OUT.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        page=browser.new_page(viewport={'width':1366,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/*',lambda route:route.abort())
        page.set_content(document('index.html'),wait_until='load')
        page.wait_for_load_state('networkidle')
        page.evaluate("""() => {
          localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-MD27',capital:200000,cycles:3,roundHours:8}));
          SIDE3D={suspend(){},cycleProductionRecord:()=>null};
          currentStudent={name:'Prueba local',company:'EMPRESA MD',game:{...DEMO_GAME,codigo:'SIDE-MD27'}};
          loadDecisionState();openDecisionMenu();
          for(const item of allDecisionItems())if(item.options&&itemRequired(item)&&['choice','multi-choice'].includes(item.type))initDraft(item).optionIds=[item.defaultOptionIds?.[0]||item.options[0].id];
          Object.assign(decisionDrafts,{
            MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_basica:1}},ACABADOS:{quantities:{aca_basica:1}},MOLDE:{optionIds:['molde_1']},
            PERS_CORTE:{quantities:{corte_basico:1}},PERS_ENSAMBLE:{quantities:{ens_personal_basico:1}},PERS_ACABADO:{quantities:{aca_personal_basico:1}},
            CANALES:{optionIds:['web'],quantities:{}},CUERO:{quantities:{cuero_sint:30}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:600}},
            PRODUCCION_META:{moldTargets:{molde_1:100,molde_2:0,molde_3:0},prices:{esencial:40,urbano:120,premium:250}}
          });for(const cat of ['B','C','F','D','E']){currentCategory=cat;persistCurrentDraftOnly();}currentCategory='B';renderDecisionCategory();
        }""")
        page.locator('[data-choice="REGIMEN_LABORAL"][data-option="no_mype"]').locator('..').click()
        page.locator('[data-choice="MOLDE"][data-option="molde_2"]').locator('..').click()
        assert page.evaluate("computeItemCost(findDecisionItem('MOLDE'))")==1530
        assert page.evaluate("computeItemCost(findDecisionItem('MESA_CORTE'))")==2700
        assert page.evaluate('saveCurrentSection()') is True
        page.evaluate("() => {currentCategory='C';renderDecisionCategory();}")
        assert abs(page.evaluate("optionUnitCost(findDecisionItem('PERS_CORTE'),findDecisionItem('PERS_CORTE').options[0])")-1856.5384615384614)<1e-7
        field=page.locator('[data-worker-assignment="PERS_ENSAMBLE"][data-worker="ens_personal_basico"][data-machine="ens_basica"]')
        assert field.input_value()=='1'
        field.fill('0')
        assert page.evaluate("reviewProblems(liveCompanyReview()).some(x=>x.item==='PERS_ENSAMBLE')") is True
        field.fill('1')
        assert page.evaluate("prepareSectionSave(categoryByCat('C')).entries.PERS_ENSAMBLE.assignments.ens_personal_basico.ens_basica")==1
        assert page.evaluate('saveCurrentSection()') is True
        page.locator('.machine-assignments').first.scroll_into_view_if_needed()
        page.locator('.machine-assignments').first.screenshot(path=str(OUT/'asignacion-desktop.png'))
        page.screenshot(path=str(OUT/'produccion-desktop.png'),full_page=True)
        page.evaluate("() => {currentCategory='E';renderDecisionCategory();}")
        amount=page.locator('[data-number="INV_MARKETING"]')
        amount.fill('12000');amount.blur()
        assert amount.input_value()=='10000'
        amount.fill('3000');amount.blur()
        assert page.evaluate("computeItemCost(findDecisionItem('INV_MARKETING'))")==3000
        assert page.evaluate('saveCurrentSection()') is True
        assert page.evaluate("buildSupabaseDecision(findDecisionItem('INV_MARKETING'),decisionState.INV_MARKETING,currentRound()).costo_total")==3000
        page.screenshot(path=str(OUT/'publicidad.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate("() => {currentCategory='C';renderDecisionCategory();}")
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.locator('.machine-assignments').first.scroll_into_view_if_needed()
        page.locator('.machine-assignments').first.screenshot(path=str(OUT/'asignacion-mobile.png'))
        page.screenshot(path=str(OUT/'produccion-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1366,'height':900})
        issues=page.evaluate('reviewProblems(liveCompanyReview())')
        assert issues==[],issues
        assert page.evaluate("commitReviewedSections(['B','C','F','D','E'],true)") is True
        result=page.evaluate("""() => {
          const closed=SIDE_CYCLE_MODEL.close({state:decisionState,ledger:cashLedger,catalog:DECISION_CATALOG,round:currentRound(),capital:initialCapital(),sectionsByRound:recordedFinancialSections()});
          return {receipt:closed.receipt,financial:closed.financial,assignments:closed.state.PERS_ENSAMBLE.assignments};
        }""")
        assert result['receipt']['modelVersion']=='md-20261027'
        assert result['receipt']['regimen']=='NO_MYPE'
        assert result['receipt']['production']['days']==30
        assert result['receipt']['produced']==100
        assert result['receipt']['revenue']==4000
        assert result['receipt']['reputation']['factorPublicidad']==3
        assert result['assignments']['ens_personal_basico']['ens_basica']==1
        assert result['receipt']['decisions']['MOLDE']['purchases']['1']=={'molde_1':1,'molde_2':1}
        assert abs(result['financial']['balanceGeneral']['activos']-result['financial']['balanceGeneral']['pasivoPatrimonio'])<.02
        assert errors==[],errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'errors':errors,**result},ensure_ascii=False,indent=2),encoding='utf-8')
        print('PASS: régimen, costo de adquisición y nómina, matriz editable y guardada, publicidad monetaria y tope, móvil sin desbordamiento, confirmación y cierre integrado.')
    finally:
        browser.close()
