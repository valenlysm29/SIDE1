"""Recover older 2D production plans through the delivered student page."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/legacy-sales-2d'
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        page = browser.new_page(viewport={'width':1440,'height':1000})
        errors, rows = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/*', lambda route: route.abort())
        page.set_content(document('index.html'), wait_until='load')
        page.wait_for_load_state('networkidle')
        for mold, price in [('molde_1',42.5),('molde_2',100),('molde_3',250)]:
            result = page.evaluate("""({mold}) => {
              localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:200000,cycles:3,roundHours:8}));
              currentStudent={name:'QA',company:'RECUPERACION 2D',game:DEMO_GAME};
              loadDecisionState();openDecisionMenu();decisionState={};decisionDrafts={};
              for(const [id,quantities] of Object.entries({
                MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1},ACABADOS:{aca_basica:1},
                PERS_CORTE:{corte_basico:1},PERS_ENSAMBLE:{ens_personal_basico:1},PERS_ACABADO:{aca_personal_basico:1},
                CUERO:{cuero_sint:100},ACCESORIOS:{acc_eco:100},HILO:{hilo_std:1500}
              }))decisionState[id]={round:'1',quantities};
              decisionState.MOLDE={round:'1',optionIds:[mold]};decisionState.PRODUCCION_META={round:'1',value:90};
              decisionState.CANALES={round:'1',optionIds:['web']};
              const oldState=JSON.stringify(decisionState);
              currentCategory='B';renderDecisionCategory();
              const assetDrafts=Object.fromEntries(['MESA_CORTE','ENSAMBLE','ACABADOS'].map(id=>[id,initDraft(findDecisionItem(id))]));
              const infrastructureSaved=saveCurrentSection();
              const planDraft=initDraft(findDecisionItem('PRODUCCION_META'));
              const labor=initDraft(findDecisionItem('PERS_CORTE'));
              const material=initDraft(findDecisionItem('CUERO'));
              const selected=initDraft(findDecisionItem('MOLDE'));
              const plan=productionPlan();
              for(const category of decisionCategories())localStorage.setItem(sectionSubmissionKey(category.cat),'1');
              captureCyclePlan();renderStudentStatus();renderCompanySummary();
              const estimate=cycleSalesProjection();
              const cashBefore=cashBalance();
              const closed=settleCycle();renderStudentStatus();currentCategory='A';renderDecisionCategory();
              return {planDraft,labor,material,selected,plan,estimate,closed,infrastructureSaved,assetDrafts,receipt:decisionState.__cycleSettlements[1],
                financial:financialReport(),cashBefore,cashAfter:cashBalance(),oldState};
            }""", {'mold':mold})
            assert result['infrastructureSaved'] is True
            assert result['assetDrafts']['MESA_CORTE']['quantities']['mesa'] == 1
            assert result['assetDrafts']['ENSAMBLE']['quantities']['ens_basica'] == 1
            assert result['assetDrafts']['ACABADOS']['quantities']['aca_basica'] == 1
            assert result['planDraft']['moldTargets'][mold] == 90
            assert result['labor']['quantities']['corte_basico'] == 1
            assert result['material']['quantities']['cuero_sint'] == 100
            assert result['selected']['optionIds'] == [mold]
            assert result['plan']['producibleUnits'] == 90
            assert result['estimate']['receipt']['sold'] == 90
            assert result['closed'] is True
            assert result['receipt']['sold'] == 90
            assert result['receipt']['revenue'] == 90*price
            assert result['financial']['estadoResultados']['ingresos'] == 90*price
            assert 'Unidades vendidas: 90' in page.locator('#companySummaryMount').inner_text()
            page.locator('div.cs-financial-scope').screenshot(path=str(OUT/f'{mold}-ventas.png'))
            rows.append({'mold':mold,'sold':90,'revenue':90*price,'cash':result['cashAfter']})
        continuation = page.evaluate("""() => {
          localStorage.setItem('SIDE_ACTIVE_ROUND','2');decisionDrafts={};
          for(const id of ['MESA_CORTE','ENSAMBLE','ACABADOS'])delete decisionState[id].purchases;
          for(const id of ['PRODUCCION_META','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','CUERO','ACCESORIOS','HILO','CANALES'])decisionState[id].round=2;
          currentCategory='B';renderDecisionCategory();
          const acquired=getOwned(findDecisionItem('MESA_CORTE'),'mesa');
          const newPurchases=currentPurchase(findDecisionItem('MESA_CORTE'),'mesa');
          const maintenanceBefore=SIDE_BUSINESS_RULES.maintenanceEstimate(decisionModelContext());
          const saved=saveCurrentSection(),cash=cashBalance(),history=JSON.parse(JSON.stringify(decisionState.MESA_CORTE.purchases));
          const repeated=saveCurrentSection();
          const maintenanceAfter=SIDE_BUSINESS_RULES.maintenanceEstimate(decisionModelContext());
          const closed=SIDE_CYCLE_MODEL.close({state:decisionState,ledger:cashLedger,catalog:DECISION_CATALOG,round:2,capital:initialCapital(),sectionsByRound:recordedFinancialSections()});
          const assets=recordedFinancialSections()[2].B.items.filter(i=>['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'].includes(i.id));
          return {acquired,newPurchases,maintenanceBefore,maintenanceAfter,saved,repeated,history,cashStable:cashBalance()===cash,assetOutflow:assets.reduce((sum,item)=>sum+item.outflow,0),receipt:closed.receipt,financial:closed.financial};
        }""")
        assert continuation['saved'] and continuation['repeated'] and continuation['cashStable']
        assert continuation['acquired'] == 1 and continuation['newPurchases'] == 0
        assert continuation['history']['1']['mesa'] == 1 and continuation['history']['2']['mesa'] == 0
        assert continuation['assetOutflow'] == 0
        assert continuation['maintenanceBefore'] == continuation['maintenanceAfter']
        assert continuation['maintenanceAfter'] > 0
        assert continuation['receipt']['produced'] == 90 and continuation['receipt']['sold'] == 90
        assert continuation['receipt']['revenue'] == 22500
        assert continuation['financial']['estadoResultados']['ingresos'] == 22500
        assert errors == [], errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'rows':rows,'continuation':continuation,'pageErrors':errors},indent=2),encoding='utf-8')
        print('PASS delivered 2D page: numeric targets, text cycle IDs, three molds, assets without purchase history, infrastructure saves, next-cycle sales and consistent costs.')
    finally:
        browser.close()
