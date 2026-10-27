"""Local browser check for reopening a submitted Finance section."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import document

ROOT = Path(__file__).resolve().parents[1]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.route('**/*', lambda route: route.abort())
    page.set_content(document('index.html'), wait_until='load')
    page.wait_for_load_state('networkidle')
    result = page.evaluate("""() => {
      currentStudent = {company:'Prueba', legalName:'Prueba', game:{codigo:'SIDE-000',id:'demo-side-000'}};
      localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));
      localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions',status:'running'}));
      localStorage.setItem(sectionSubmissionKey('E'),'1');
      localStorage.setItem(receiptKey(),JSON.stringify({E:{items:[{id:'PRESTAMO',financing:8500}],submitted:true}}));
      decisionState.PRESTAMO={round:1,amount:8500};
      cashLedger['1:E']=8500;
      const before=creditAvailable();
      const notice=document.createElement('div');
      notice.innerHTML=noticesHtml([{cat:'E',text:'La caja al confirmar sería negativa.'}],[]);
      document.body.append(notice);
      const correction=notice.querySelector('[data-summary-reopen="E"]');
      bindSummaryLinks(notice);
      correction?.click();
      const opened=Boolean(correction);
      const after=creditAvailable();
      decisionDrafts.PRESTAMO={amount:10000};
      const resent=commitReviewedSections(['E'],false);
      const receipt=readReviewReceipts().E;
      return {before,opened,after,locked:sectionSubmitted('E'),loan:decisionState.PRESTAMO.amount,
        ledger:cashLedger['1:E'],receiptLoan:receipt?.items?.find(item=>item.id==='PRESTAMO')?.financing,
        currentCategory,resent};
    }""")
    assert result['opened'] is True, result
    assert result['resent'] is True and result['locked'] is True, result
    assert result['after'] == result['before'] + 8500, result
    assert result['loan'] == 10000 and result['ledger'] == 10000, result
    assert result['receiptLoan'] == 10000, result
    assert result['currentCategory'] == 'E', result
    assert not failures, failures
    print('PASS browser: Finance can be reopened and resent with a replacement loan, without charging it twice.')
    browser.close()
