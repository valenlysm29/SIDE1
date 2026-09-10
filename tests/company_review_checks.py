"""SIDE V3 integration: isolated Chromium DOM + Web Storage test double.
No external network, real accounts, Supabase or 3D engine are exercised.
"""
from pathlib import Path
import json,os,shutil,sys
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from browser_fixture import load
OUT=Path(os.environ.get('SIDE_QA_OUTPUT','/tmp/side-v3-qa'));OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def ok(name,condition=True):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
def business(page):
    return page.evaluate('''()=>({state:localStorage.getItem(decisionKey()),ledger:localStorage.getItem(ledgerKey()),receipts:localStorage.getItem(receiptKey()),flags:DECISION_CATALOG.map(c=>sectionSubmitted(c.cat)),all:decisionsSubmitted(),cash:cashBalance()})''')
def ready_fixture(page,company,capital=100000,drafts=None):
    page.evaluate('''({company,capital,drafts})=>{
      closeCompanyReview();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital,roundHours:8,roundMinutes:0,cycles:6,interest:20}));localStorage.setItem('SIDE_ACTIVE_ROUND','1');lastObservedRound=1;
      currentStudent={name:'Prueba',company,legalName:company+' SAC',game:DEMO_GAME};currentCategory='A';openDecisionMenu();
      if(drafts){Object.assign(decisionDrafts,drafts);renderDecisionCategory();}
    }''',{'company':company,'capital':capital,'drafts':drafts})
def tab(page,cat):
    # Real tab click, avoiding pre-existing sticky header overlap on an old scroll offset.
    page.evaluate("document.getElementById('decisionMenu').scrollTop=0")
    page.locator(f'.decision-tab[data-cat="{cat}"]').click()
def qty(page,item,opt,value):
    page.locator(f'[data-qty="{item}"][data-option="{opt}"]').fill(str(value))
def choice(page,item,opt):page.locator(f'[data-choice="{item}"][data-option="{opt}"]').check()
def clear_rect(page,selector):
    return page.locator(selector).evaluate('''el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&[[r.left+3,r.top+3],[r.right-3,r.bottom-3],[r.left+r.width/2,r.top+r.height/2]].every(([x,y])=>el.contains(document.elementFromPoint(x,y)));}''')
def capture_summary(page,name):
    page.evaluate('''()=>{const mount=document.getElementById('companySummaryMount'),stage=document.getElementById('decisionMenu'),head=document.getElementById('decisionStickyHead');stage.scrollTop+=mount.getBoundingClientRect().top-head.getBoundingClientRect().bottom-12;}''')
    page.screenshot(path=str(OUT/name))
minimal={'MOLDE':{'optionIds':['molde_1']},'PRODUCCION_META':{'value':10},'CUERO':{'quantities':{'cuero_sint':3}},'ACCESORIOS':{'quantities':{'acc_eco':10}},'HILO':{'quantities':{'hilo_std':1}},'GARANTIA_PT':{'optionIds':['pt_30']},'CANALES':{'optionIds':['web'],'quantities':{}},'INV_MARKETING':{'optionIds':['mkt_baja']}}
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1366,'height':900},locale='es-PE',timezone_id='America/Lima')
    context.set_default_timeout(30000)
    context.set_default_navigation_timeout(45000)
    context.route('**/*',lambda route:route.abort())
    context.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
    page=context.new_page();load(page,'index.html')
    ready_fixture(page,'Taller Horizonte')
    ok('Delivered HTML, CSS and modules load in isolated Chromium',page.locator('#companySummaryMount').count()==1 and not errors)
    ok('Untouched decisions are pending, not false dirty drafts',page.evaluate("liveCompanyReview().sections.every(s=>s.status==='pending')"))
    before=business(page);page.locator('#topSubmitAllDecisions').click()
    expect(page.locator('#companyReviewDialog')).to_be_visible();expect(page.locator('#confirmCompanyReview')).to_be_disabled()
    ok('Incomplete cycle opens a blocked review instead of submitting',business(page)==before)
    page.locator('#companyReviewDialog [data-summary-goto="B"]').first.click()
    ok('Review correction link closes dialog and opens the right tab',page.evaluate("currentCategory==='B'&&!document.getElementById('companyReviewDialog').open"))
    tab(page,'B')
    qty(page,'MESA_CORTE','mesa',2);qty(page,'ENSAMBLE','ens_basica',1);qty(page,'ENSAMBLE','ens_semi',1);qty(page,'ACABADOS','aca_semi',1)
    choice(page,'MOLDE','molde_2');choice(page,'MANTENIMIENTO','correctivo')
    expected_b=5000+3500+7500+4500+1200+2000+200
    page.locator('#sendDecisionSection').click()
    ok('Sending infrastructure records full immutable quantities and costs',page.evaluate("readReviewReceipts().B.outflow")==expected_b and page.evaluate("sectionSubmitted('B')"))
    ok('Submitted mold is still included in the exact cycle cost',page.evaluate("readReviewReceipts().B.items.find(i=>i.id==='MOLDE').outflow")==1200)
    tab(page,'C')
    qty(page,'PERS_CORTE','corte_basico',2);qty(page,'PERS_ENSAMBLE','ens_personal_ind',1);qty(page,'PERS_ACABADO','aca_personal_basico',1)
    choice(page,'JEFATURA','si_jefatura')
    page.locator('[data-number="PRODUCCION_META"]').fill('100')
    choice(page,'GARANTIA_PT','pt_90')
    expected_c=3000+2800+1500+3000+600
    page.locator('#sendDecisionSection').click()
    ok('Production receipt contains the single productive line, staffing and quality control',abs(page.evaluate("readReviewReceipts().C.outflow")-expected_c)<.001 and page.evaluate("readReviewReceipts().C.items.length===categoryByCat('C').items.length"))
    tab(page,'F');choice(page,'ANALISTA_COMPRAS','si_analista')
    qty(page,'CUERO','cuero_sint',100);qty(page,'CUERO','cuero_std',10);qty(page,'ACCESORIOS','acc_eco',100);qty(page,'HILO','hilo_std',100)
    choice(page,'GARANTIA_PROV','gar_80')
    expected_f=5000+(2500+450+400+200)*.88
    page.locator('#sendDecisionSection').click()
    ok('Logistics receipt includes purchasing, all materials and supplier guarantee',abs(page.evaluate("readReviewReceipts().F.outflow")-expected_f)<.001 and page.evaluate("readReviewReceipts().F.items.length===categoryByCat('F').items.length"))
    tab(page,'D');choice(page,'CANALES','web')
    for district,value in [('los_olivos',2),('miraflores',1),('sjl',3)]:
        choice(page,'CANALES',district);page.locator(f'[data-store-qty="{district}"]').fill(str(value))
    page.locator('#saveDecisionSection').click();saved_cash=page.evaluate('cashBalance()')
    ok('Saved sales are not marked as sent in Resumen',not page.evaluate("liveCompanyReview().sections.find(s=>s.cat==='D').submitted"))
    page.locator('#sendDecisionSection').click()
    expected_d=500+3600+3500+6600
    ok('Sending an already saved sales section never charges it twice',page.evaluate('cashBalance()')==saved_cash)
    ok('All three store counts and six sellers appear in sent receipt',page.evaluate("readReviewReceipts().D.outflow")==expected_d and page.evaluate("readReviewReceipts().D.items.find(i=>i.id==='PERSONAL_VENTAS').rows[0].quantity")==6)
    tab(page,'E');choice(page,'INV_RRHH','cap_baja');choice(page,'INV_MARKETING','mkt_media');page.locator('[data-loan-number="PRESTAMO"]').fill('10000')
    tab(page,'A')
    ok('Resumen contains all decision items',page.locator('#companySummaryMount [data-summary-item]').count()==page.evaluate('allDecisionItems().length'))
    page.locator('[data-summary-filter="sent"]').click()
    ok('Only sent filter includes B, C, Logistics and Sales and excludes draft Finance',page.locator('#companySummaryMount [data-summary-section]').evaluate_all('(els)=>els.map(e=>e.dataset.summarySection)')==['B','C','F','D'])
    capture_summary(page,'empresa-enviadas-escritorio.png')
    page.locator('[data-summary-filter="all"]').click()
    expected_outflow=expected_b+expected_c+expected_f+expected_d+7000
    f=page.evaluate('liveCompanyReview().financial')
    (OUT/'financial-debug.json').write_text(json.dumps({'actual':f,'expected_outflow':expected_outflow,'drafts':page.evaluate('decisionDrafts'),'state':page.evaluate('decisionState'),'ledger':page.evaluate('cashLedger')},indent=2))
    ok('Four financial concepts reconcile exactly with selections and saved cash',abs(f['outflow']-expected_outflow)<.001 and abs(f['projectedCash']-(100000-expected_outflow+10000))<.001)
    ok('Contract commitments exclude this cycle and disclose after-game amounts',f['contracts']['total']==(3600+3500+6600)*11 and f['contracts']['beyondGame']==(3600+3500+6600)*6)
    capture_summary(page,'empresa-resumen-escritorio.png')
    before=business(page);page.locator('#topSubmitAllDecisions').click()
    ok('Opening complete review does not change decisions, cash or sent flags',business(page)==before)
    ok('Review enables explicit confirmation only when ready',page.locator('#confirmCompanyReview').is_enabled())
    page.screenshot(path=str(OUT/'revision-final-escritorio.png'))
    for width,height in [(1792,862),(1366,768),(1024,600),(768,600),(390,844),(375,667),(320,568),(844,390)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
        ok(f'Review {width}x{height}: confirmation and cancel fully visible',clear_rect(page,'#confirmCompanyReview') and clear_rect(page,'#cancelCompanyReview'))
        ok(f'Review {width}x{height}: no horizontal overflow',page.locator('#companyReviewDialog').evaluate('el=>el.scrollWidth<=el.clientWidth+1') and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.locator('.cs-dialog-body').evaluate('el=>el.scrollTop=el.scrollHeight')
        ok(f'Review {width}x{height}: scrolling never covers confirmation',clear_rect(page,'#confirmCompanyReview'))
        page.locator('.cs-dialog-body').evaluate('el=>el.scrollTop=0')
        if width==390:page.screenshot(path=str(OUT/'revision-final-movil.png'))
    page.set_viewport_size({'width':1366,'height':900});page.locator('#cancelCompanyReview').click()
    ok('Cancel review preserves every submitted and unsubmitted value',business(page)==before)
    page.locator('#topSubmitAllDecisions').click();page.locator('#confirmCompanyReview').click()
    ok('Confirmation submits all five decision sections in a single local batch',page.evaluate('decisionsSubmitted()&&decisionCategories().every(c=>sectionSubmitted(c.cat))'))
    ok('Final cash exactly matches the reviewed projection',abs(page.evaluate('cashBalance()')-f['projectedCash'])<.001)
    after=business(page);page.evaluate('commitReviewedSections(DECISION_CATALOG.map(c=>c.cat),true)')
    ok('Repeated confirmation cannot double-charge or replace receipts',business(page)==after)
    ok('Submitted summary remains visible after the cycle is locked',page.locator('#companySummaryMount [data-summary-section]').count()==5)
    receipts1=page.evaluate('readReviewReceipts()');student=page.evaluate('currentStudent')
    saved_storage=page.evaluate("Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return [k,localStorage.getItem(k)]}))")
    page.close();page=context.new_page();load(page,'index.html',saved_storage);page.evaluate('student=>{currentStudent=student;openDecisionMenu()}',student)
    ok('Receipts and cash survive reconstructing the page from saved Web Storage',page.evaluate('readReviewReceipts()')==receipts1 and abs(page.evaluate('cashBalance()')-f['projectedCash'])<.001)
    page.evaluate("localStorage.setItem('SIDE_ACTIVE_ROUND','2');lastObservedRound=2;loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory()")
    ok('New cycle is not incorrectly marked as already sent',page.evaluate("!decisionsSubmitted()&&!sectionSubmitted('B')"))
    page.locator('#companySummaryCycle').select_option('1')
    ok('Historical cycle shows the five immutable submitted sections',page.locator('#companySummaryMount [data-summary-section]').count()==5 and page.evaluate('readReviewReceipts(1)')==receipts1)
    ok('History does not invent an old projected cash value',page.locator('#companySummaryMount .cs-metric').count()==0)
    capture_summary(page,'historial-ciclo-1.png')
    # Fresh company with enough combined financing but not enough cash for B before E.
    loan_drafts={**minimal,'MESA_CORTE':{'quantities':{'mesa':7}},'PRESTAMO':{'amount':10000}}
    ready_fixture(page,'Financiamiento conjunto',20000,loan_drafts)
    ok('Companies do not see another company history',page.evaluate('receiptRounds().length')==0)
    page.locator('#topSubmitAllDecisions').click();loan_projection=page.evaluate('liveCompanyReview().financial.projectedCash')
    expect(page.locator('#confirmCompanyReview')).to_be_enabled();page.locator('#confirmCompanyReview').click()
    ok('Loan and purchases can be confirmed together without a category-order cash failure',page.evaluate('decisionsSubmitted()') and abs(page.evaluate('cashBalance()')-loan_projection)<.001)
    # Shortage warnings remain advisory; financial impossibility blocks the batch.
    ready_fixture(page,'Advertencias',100000,{**minimal,'PRODUCCION_META':{'value':100}})
    page.locator('#topSubmitAllDecisions').click()
    ok('Capacity and material shortages produce visible advisory warnings',page.locator('.cs-notice-warning').count()>0 and page.locator('#confirmCompanyReview').is_enabled())
    page.locator('#cancelCompanyReview').click()
    ready_fixture(page,'Sin caja',1000,minimal);before=business(page);page.locator('#topSubmitAllDecisions').click()
    ok('Insufficient total cash prevents confirmation without partial saves',page.locator('#confirmCompanyReview').is_disabled() and business(page)==before)
    # Data changes while the review is open require another review/confirmation.
    ready_fixture(page,'Revision desactualizada',100000,minimal);page.locator('#topSubmitAllDecisions').click()
    page.evaluate("const c=teacherConfig();c.interest=22;localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c))")
    page.locator('#confirmCompanyReview').click()
    ok('Changing teacher configuration invalidates the previous review',not page.evaluate('decisionsSubmitted()') and 'Los datos cambiaron' in page.locator('#companyReviewDialog').inner_text())
    page.locator('#confirmCompanyReview').click();ok('Refreshed review can then be explicitly confirmed',page.evaluate('decisionsSubmitted()'))
    # Simulated one-time storage exception: no false success/partial decision flags.
    ready_fixture(page,'Fallo almacenamiento',100000,minimal);page.locator('#topSubmitAllDecisions').click();before=business(page)
    page.evaluate("window.originalStorageSet=localStorage.setItem;let failOnce=true;localStorage.setItem=function(k,v){if(failOnce&&k===receiptKey()){failOnce=false;throw new DOMException('Simulated quota failure','QuotaExceededError')}return originalStorageSet.call(this,k,v)}")
    page.locator('#confirmCompanyReview').click();page.evaluate('localStorage.setItem=window.originalStorageSet')
    ok('A local storage failure rolls back cash, entries and submitted flags',business(page)==before)
    page.locator('#confirmCompanyReview').click();ok('Retry after storage failure succeeds once',page.evaluate('decisionsSubmitted()'))
    # Historical V2 submissions are recovered explicitly without an invented date.
    ready_fixture(page,'Legado V2',100000,minimal)
    page.evaluate("currentCategory='D';saveCurrentSection();setSectionSubmitted('D',true);currentCategory='A';renderTabs();renderDecisionCategory()")
    ok('V2 sent flags migrate saved values without inventing original timestamps',page.evaluate("readReviewReceipts().D.source==='legacy'&&readReviewReceipts().D.sentAt===null"))
    ok('No uncaught browser JavaScript exceptions',not errors)
    ok('Summary and shared financial model remain loaded',page.evaluate("typeof renderCompanySummary==='function'&&typeof SIDE_REVIEW_MODEL.breakdown==='function'"))
    browser.close()
finally:
 pass
(OUT/'company-review-results.json').write_text(json.dumps({'build':'2026.09.10.1','passed':len(checks),'checks':checks,'page_errors':errors,'scope':'Isolated Chromium DOM with delivered HTML/CSS/JS and Web Storage double; external requests blocked. HTTP browser navigation is unavailable in the environment. No production Supabase or complete 3D game tested.'},indent=2))
print('TOTAL PASS',len(checks),flush=True)
