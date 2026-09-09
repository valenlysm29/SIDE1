"""SIDE v2026.09.09.3: actual click handlers + viewport/hit-test regressions.
Runs the delivered UI in an offline Chromium DOM, using browser_fixture.
This does not test an HTTP deployment, Supabase, or the 3D renderer.
"""
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright, expect
from browser_fixture import load, embed_assets, ROOT
OUT=Path(os.environ.get('SIDE_QA_OUTPUT','/tmp/side-final-qa'))
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(name,condition=True):
    assert condition,name
    checks.append(name)
    print('PASS',name,flush=True)
def rect_is_clear(page,selector):
    return page.locator(selector).evaluate('''el=>{
      const r=el.getBoundingClientRect();
      if(r.width<1||r.height<1||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)return false;
      return [[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4],[r.left+r.width/2,r.top+r.height/2]].every(([x,y])=>el.contains(document.elementFromPoint(x,y)));
    }''')
def snapshot(page):
    return page.evaluate("Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return [k,localStorage.getItem(k)]}))")
seed={'SIDE_TEACHER_CONFIG':json.dumps({'capital':100000,'roundHours':8,'roundMinutes':0,'cycles':20})}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1366,'height':768},locale='es-PE',timezone_id='America/Lima')
    context.set_default_timeout(15000)
    context.set_default_navigation_timeout(45000)
    context.route('**/*',lambda route:route.abort())
    errors=[]
    context.on('page',lambda page:page.on('pageerror',lambda e:errors.append(str(e))))
    page=context.new_page()
    load(page,'index.html',seed)
    # Load the delivered tutorial as the browser would, without an HTTP request.
    tutorial=embed_assets((ROOT/'tutorial.html').read_text())
    page.locator('#tutorialMount').evaluate("(el,html)=>{el.innerHTML=html;el.dataset.loaded='1'}",tutorial)
    page.locator('#startBtn').click()
    page.locator('[data-profile="student"]').click()
    page.locator('#gameCode').fill('SIDE-000')
    page.locator('#companyLegalName').fill('Empresa de prueba SIDE')
    page.locator('#companyBrandName').fill('SIDE QA')
    page.locator('#studentForm button[type="submit"]').click()
    expect(page.locator('#tutorial')).to_be_visible()
    for _ in range(5): page.locator('#tutorialNext').click()
    page.locator('#tutorialContinue').click()
    expect(page.locator('#studentLobby')).to_be_visible()
    ok('Student form and complete tutorial lead to the lobby via real buttons')
    for width,height in [(1792,862),(1366,768),(1280,720),(1024,600),(768,600),(390,844),(375,667),(320,568),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        page.mouse.move(0,0)
        page.wait_for_timeout(300)
        ok(f'Lobby {width}x{height}: entire decisions button visible and unobstructed',rect_is_clear(page,'#enterDecisionsBtn'))
        ok(f'Lobby {width}x{height}: tutorial and return buttons visible',rect_is_clear(page,'#reopenTutorialBtn') and rect_is_clear(page,'#backToProfiles'))
        before=page.locator('#enterDecisionsBtn').bounding_box()
        page.locator('.lobby-content').evaluate('el=>el.scrollTop=el.scrollHeight')
        after=page.locator('#enterDecisionsBtn').bounding_box()
        stable=all(abs(before[k]-after[k])<1 for k in before)
        if not stable: print('RECT DEBUG',width,height,before,after,flush=True)
        ok(f'Lobby {width}x{height}: scrolling results never moves or covers footer',stable and rect_is_clear(page,'#enterDecisionsBtn'))
        ok(f'Lobby {width}x{height}: no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        if width in (1366,390,844):
            page.locator('.lobby-content').evaluate('el=>el.scrollTop=0')
            page.screenshot(path=str(OUT/f'lobby-{width}x{height}.png'))
    page.set_viewport_size({'width':1366,'height':768})
    ok('Logo stays centered in front of card',page.evaluate("Math.abs(document.querySelector('.dash-logo').getBoundingClientRect().x+document.querySelector('.dash-logo').getBoundingClientRect().width/2-innerWidth/2)<2"))
    page.locator('#enterDecisionsBtn').click()
    expect(page.locator('#decisionMenu')).to_be_visible()
    ok('Fully visible entry button opens the decisions menu')
    page.locator('.decision-tab[data-cat="D"]').click()
    # Web never gets a quantity control.
    page.locator('[data-choice="CANALES"][data-option="web"]').check()
    ok('Web-only selection has no physical-store quantity controls',page.locator('[data-store-qty]').count()==0)
    for i,district in enumerate(['los_olivos','miraflores','sjl'],2):
        page.locator(f'[data-channel-card="{district}"] .choice-pill').click()
        page.wait_for_timeout(400)
        control=page.locator(f'[data-store-qty="{district}"]')
        expect(control).to_have_value('1')
        ok(f'{district}: quantity appears within the selected district card',page.locator(f'[data-channel-card="{district}"] [data-store-qty="{district}"]').count()==1)
        ok(f'{district}: newly shown quantity is not hidden by sticky bars',rect_is_clear(page,f'[data-store-qty="{district}"]'))
        page.locator(f'[data-store-step="{district}"][data-delta="1"]').click()
        expect(control).to_have_value('2')
        expect(page.locator(f'[data-choice="CANALES"][data-option="{district}"]')).to_be_checked()
        control.fill(str(i))
        ok(f'{district}: +/- and typed quantity do not deselect the district',page.locator(f'[data-choice="CANALES"][data-option="{district}"]').is_checked() and control.input_value()==str(i))
    # 2 Los Olivos + 3 Miraflores + 4 SJL + website.
    expected_cost=2*1800+3*3500+4*2200+500
    ok('Three independent quantities compute exact cost and 9 sellers',page.evaluate("computeItemCost(findDecisionItem('CANALES'))") == expected_cost and page.evaluate('RULES.storeCount(channelDraft())')==9)
    page.locator('[data-store-qty="los_olivos"]').fill('-5')
    expect(page.locator('[data-store-qty="los_olivos"]')).to_have_value('1')
    page.locator('[data-store-qty="los_olivos"]').fill('2')
    page.locator('#saveDecisionSection').click()
    ok('Saving applies the exact amount and all three quantities',page.evaluate('cashBalance()')==100000-expected_cost and page.evaluate('decisionState.CANALES.quantities')=={'los_olivos':2,'miraflores':3,'sjl':4})
    page.locator('#saveDecisionSection').click()
    ok('Saving again does not duplicate the cost',page.evaluate('cashBalance()')==100000-expected_cost)
    page.locator('[data-store-qty="miraflores"]').fill('5')
    # A working draft must survive reinitializing the state, exactly as entering menu does.
    saved=snapshot(page)
    page.screenshot(path=str(OUT/'sales-desktop.png'))
    # On mobile, each selected district must reveal the control automatically.
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-choice="CANALES"][data-option="sjl"]').uncheck()
    expect(page.locator('[data-store-qty="sjl"]')).to_have_count(0)
    page.locator('[data-choice="CANALES"][data-option="sjl"]').check()
    page.wait_for_timeout(400)
    ok('Mobile: district selection automatically brings quantity into the visible area',rect_is_clear(page,'[data-store-qty="sjl"]'))
    page.locator('[data-store-step="sjl"][data-delta="1"]').click()
    expect(page.locator('[data-store-qty="sjl"]')).to_have_value('2')
    ok('Mobile: quantity buttons work without unchecking the district',page.locator('[data-choice="CANALES"][data-option="sjl"]').is_checked())
    page.screenshot(path=str(OUT/'sales-mobile.png'))
    student=page.evaluate('currentStudent')
    page.close()
    page=context.new_page();load(page,'index.html',saved)
    page.evaluate("student=>{currentStudent=student;loadDecisionState();openDecisionMenu();currentCategory='D';renderTabs();renderDecisionCategory()}",student)
    ok('Saved values and unsent edits survive a reconstructed page load',page.locator('[data-store-qty="los_olivos"]').input_value()=='2' and page.locator('[data-store-qty="miraflores"]').input_value()=='5' and page.locator('[data-store-qty="sjl"]').input_value()=='4')
    page.locator('#sendDecisionSection').click()
    ok('Sending saves quantities and locks only the confirmed section',page.evaluate("sectionSubmitted('D')&&decisionState.CANALES.quantities.miraflores===5") and page.locator('[data-store-qty="miraflores"]').is_disabled())
    ok('No JavaScript runtime errors in these scenarios',not errors)
    browser.close()
(OUT/'ui-final-results.json').write_text(json.dumps({'build':'2026.09.09.3','passed':len(checks),'checks':checks,'page_errors':errors,'scope':'Offline Chromium DOM using delivered HTML/CSS/JS and a Web Storage double. External network, HTTP deployment, Supabase and 3D not tested.'},indent=2))
print('PASS',len(checks),'checks',flush=True)
