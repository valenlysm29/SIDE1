"""Render the actual server-worker SQL output in the delivered student UI."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/business-worker-ui'
OUT.mkdir(parents=True,exist_ok=True)
snapshot=json.loads((ROOT/'tests/output/business-worker-state.json').read_text(encoding='utf-8'))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    try:
        page=browser.new_page(viewport={'width':1366,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/*',lambda route:route.abort())
        page.set_content(document('index.html'),wait_until='load')
        page.wait_for_load_state('networkidle')
        page.evaluate('''snapshot=>{
          localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-QA',capital:200000,cycles:2,roundHours:8}));
          localStorage.setItem('SIDE_ACTIVE_ROUND','2');
          currentStudent={name:'QA',company:'Ventas automáticas',game:{...DEMO_GAME,codigo:'SIDE-QA'}};
          loadDecisionState();decisionState=snapshot.decision_state;cashLedger=snapshot.cash_ledger;
          localStorage.setItem(financialSectionsKey(),JSON.stringify(snapshot.financial_sections));
          persistGameState();showScreen('studentLobby');renderStudentStatus();
        }''',snapshot)
        assert page.evaluate('currentRound()')==2
        for summary in page.locator('#studentCycleHistory details:not([open]) > summary').all():
            summary.click()
        text=page.locator('#studentCycleHistory').inner_text()
        assert text.count('Unidades vendidas: 90')==2,text
        assert '22,500.00' in text,text
        assert '5,839.77' in text,text
        page.locator('#studentCycleHistory').screenshot(path=str(OUT/'two-cycles.png'))
        # A new/pending cycle must preserve the previous receipt and not call it zero sales.
        page.evaluate('''()=>{
          delete decisionState.__cycleSettlements[2];delete decisionState.__financialSnapshots[2];
          for(const key of Object.keys(cashLedger))if(key.startsWith('2:'))delete cashLedger[key];
          renderStudentStatus();
        }''')
        for summary in page.locator('#studentCycleHistory details:not([open]) > summary').all():
            summary.click()
        text=page.locator('#studentCycleHistory').inner_text()
        assert 'Ciclo 1 · resultado definitivo' in text,text
        assert 'Unidades vendidas: 90' in text,text
        assert 'Ciclo 2 · cierre pendiente' in text,text
        assert 'Ventas e ingresos definitivos: pendientes' in text,text
        assert 'Unidades vendidas: 0' not in text,text
        assert page.evaluate('syncStudentReportPreview().unidadesVendidas') is None
        page.locator('#studentCycleHistory').screenshot(path=str(OUT/'pending-keeps-history.png'))
        assert errors==[],errors
        print('PASS Chromium: server receipts, 90 sales per cycle, final tax, pending is not zero, prior sales survive new cycle; no page errors.')
    finally:
        browser.close()
