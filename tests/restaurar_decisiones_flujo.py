"""Chrome regression: authoritative lifecycle access and five decision sections.

Isolated delivered DOM; no production accounts, Supabase or 3D rendering.
Run from SIDE1 with the bundled Python and Playwright available on PYTHONPATH.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
from browser_fixture import load

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/restaurar-decisiones'
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(label, value=True):
    assert value, label
    checks.append(label)
    print('PASS', label, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
    errors = []
    for width, height in [(1440, 1000), (390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.route('**/*', lambda route: route.abort())
        page.on('pageerror', lambda error: errors.append(str(error)))
        load(page, 'index.html')
        page.wait_for_load_state('networkidle')
        page.evaluate("""() => {
          stopStudentSync(); currentStudent={company:'Flujo QA',legalName:'Flujo QA SAC',game:{codigo:'SIDE-QA'}};
          studentConnected=true;
          window.qaPhase=(round,phase,status='running')=>{
            const runtime={round,phase,status,running:status==='running',remaining:600,duration:600,startedAt:new Date().toISOString()};
            const config={capital:100000,lifecycleVersion:2,cycles:3,round,roundMinutes:10,cycleCloseMode:'automatic',motor_version:'excel-16',runtime,gameStartAt:new Date(Date.now()+60000).toISOString()};
            localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(config));localStorage.setItem('SIDE_ACTIVE_ROUND',String(round));
            localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(runtime));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));
            updateIntegrationUI();
          };
          qaPhase(1,'integration'); showScreen('studentLobby');
        }""")
        check(f'{width}: waiting room blocks decisions', page.evaluate('!studentAccess().canOperate && openDecisionMenu()===false'))
        for cycle in [1, 2, 3]:
            page.evaluate("cycle=>{qaPhase(cycle,'decisions');loadDecisionState();if(!decisionState.__excel?.habilitado){decisionState.__excel={habilitado:true,round:cycle,enviado:false,decisiones:SIDE_EXCEL_UI.nuevasDecisiones()};persistGameState();}openDecisionMenu();}", cycle)
            check(f'{width}: cycle {cycle} running access', page.evaluate('studentAccess().canOperate && canExploreWorld()'))
            expect(page.locator('.decision-tab')).to_have_count(5)
            for category in ['A', 'B', 'C', 'D', 'E']:
                page.locator(f'[data-cat="{category}"]').click()
                page.locator('#excelProductionMount details').evaluate_all('(nodes)=>nodes.forEach(node=>node.open=true)')
                controls = page.locator('#excelProductionMount input[type="radio"]:visible:not(:disabled),#excelProductionMount input[type="number"]:visible:not(:disabled)')
                check(f'{width}: cycle {cycle} {category} editable controls', controls.count() > 0)
                radio = page.locator('#excelProductionMount input[type="radio"]:visible:not(:disabled)').first
                if radio.count():
                    radio.check()
                else:
                    numeric = page.locator('#excelProductionMount input[type="number"]:visible:not(:disabled)').first
                    numeric.fill(numeric.input_value())
                save = page.locator('[data-excel-guardar-item]:visible:not(:disabled)').first
                expect(save).to_be_visible()
                save.click()
                check(f'{width}: cycle {cycle} {category} item save keeps draft editable', page.evaluate('!decisionsSubmitted() && studentAccess().canOperate'))
            page.evaluate("qaPhase(currentRound(),'decisions','paused')")
            check(f'{width}: cycle {cycle} pause blocks persistence', page.evaluate('!studentAccess().canOperate && studentAccess().canReview'))
            expect(page.locator('[data-excel-guardar-item]:visible:not(:disabled)')).to_have_count(0)
            expect(page.locator('#topSubmitAllDecisions')).to_be_disabled()
            page.evaluate("qaPhase(currentRound(),'decisions')")
            expect(page.locator('[data-excel-guardar-item]:visible:not(:disabled)').first).to_be_enabled()
            expect(page.locator('#topSubmitAllDecisions')).to_be_enabled()
            page.evaluate("()=>{decisionState.__excel.enviado=true;persistGameState();renderDecisionCategory();updateHud();}")
            check(f'{width}: cycle {cycle} sent locks editor', page.evaluate('decisionsSubmitted()'))
            expect(page.locator('#excelProductionMount input[type="radio"]:visible:not(:disabled),#excelProductionMount input[type="number"]:visible:not(:disabled)')).to_have_count(0)
            page.evaluate("qaPhase(currentRound(),'results')")
            check(f'{width}: cycle {cycle} results disallow operation', page.evaluate('!studentAccess().canOperate'))
        page.evaluate("qaPhase(3,'finished')")
        check(f'{width}: final summary disallows another cycle', page.evaluate('!studentAccess().canOperate && studentAccess().phase==="finished"'))
        page.screenshot(path=str(OUT / f'flow-final-{width}.png'), full_page=True)
        page.close()
    check('No uncaught browser errors', not errors)
    browser.close()
(OUT / 'flow-results.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'scope': 'Delivered DOM lifecycle; send lock seeded, real full-cycle submission covered separately.'}, ensure_ascii=False, indent=2), encoding='utf-8')
