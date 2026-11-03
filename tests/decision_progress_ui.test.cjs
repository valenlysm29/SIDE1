'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const python='C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}}).replace(/<script>\s*const fixtureData=[\s\S]*?<\/script>/,'');
test('delivered UI distinguishes automatic values, edits, saves, confirmations and cycle continuity',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='http://side-progress.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.goto('http://side-progress.test/');
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));openDecisionMenu();});
  const states=()=>page.evaluate(()=>decisionCategories().map(c=>[c.cat,decisionSectionStatus(c.cat)]));
  assert.ok((await states()).every(([,s])=>s==='pending'));
  await page.locator('[data-cat="C"]').click();
  assert.equal(await page.locator('[data-cat="C"] .tab-status').innerText(),'Sin decisiones');
  await page.screenshot({path:path.join(root,'tests/output/decision-progress-initial.png'),fullPage:true});
  const initial=await page.evaluate(()=>({ledger:JSON.stringify(cashLedger),automatic:decisionState.LIMPIEZA.decisionOrigin}));assert.equal(initial.automatic,'automatic');
  await page.locator('[data-cat="DOP"]').click();
  await page.evaluate(()=>{window.initialTabNodes=[...document.querySelectorAll('.decision-tab')];});
  await page.locator('[data-mold-target="molde_1"]').fill('37');
  assert.equal(await page.evaluate(()=>initialTabNodes.every((node,index)=>node===document.querySelectorAll('.decision-tab')[index])),true,'editing preserves existing tab nodes and focus');
  assert.equal(await page.locator('[data-cat="C"] .tab-status').innerText(),'En edición');
  assert.equal(await page.locator('[data-cat="DOP"] .tab-status').innerText(),'En edición');
  await page.reload();await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="DOP"]').click();
  assert.equal(await page.evaluate(()=>decisionSectionStatus('C')),'draft');
  await page.locator('[data-cat="C"]').click();await page.locator('[data-cat="DOP"]').click();
  assert.equal(await page.locator('[data-mold-target="molde_1"]').inputValue(),'37');
  await page.locator('[data-cat="C"]').click();
  await page.locator('#saveDecisionSection').click();
  assert.equal(await page.locator('[data-cat="C"] .tab-status').innerText(),'Borrador guardado');
  assert.match(await page.locator('#sectionSaveHint').innerText(),/este equipo/);
  await page.reload();await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="DOP"]').click();
  assert.equal(await page.locator('[data-mold-target="molde_1"]').inputValue(),'37');
  assert.equal(await page.locator('[data-cat="C"] .tab-status').innerText(),'Borrador guardado');
  await page.evaluate(()=>{loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory();});
  assert.equal(await page.evaluate(()=>decisionSectionStatus('C')),'saved');
  await page.locator('[data-mold-target="molde_1"]').fill('38');
  assert.equal(await page.evaluate(()=>decisionSectionStatus('C')),'draft');
  await page.locator('[data-mold-target="molde_1"]').fill('37');
  assert.equal(await page.evaluate(()=>decisionSectionStatus('C')),'saved');
  await page.locator('[data-cat="D"]').click();await page.locator('[data-choice="CANALES"][data-option="web"]').check();
  await page.locator('#sendDecisionSection').click();
  assert.equal(await page.evaluate(()=>decisionSectionStatus('D')),'sent');
  assert.equal(await page.locator('[data-cat="D"] .tab-status').innerText(),'Confirmado');
  assert.equal(await page.evaluate(()=>liveCompanyReview().sections.every(s=>s.status===decisionSectionStatus(s.cat))),true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1366,height:900});
  await page.screenshot({path:path.join(root,'tests/output/decision-progress-confirmed.png'),fullPage:true});
  for(const cycles of [3,6]){
   for(let round=2;round<=cycles;round++){
    const result=await page.evaluate(({round,cycles})=>{const conf=teacherConfig();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...conf,cycles}));localStorage.setItem('SIDE_ACTIVE_ROUND',String(round));loadDecisionState();restoreDraftsForRound();ensureCycleFixedCosts();renderTabs();currentCategory='C';renderDecisionCategory();return {states:decisionCategories().map(c=>decisionSectionStatus(c.cat)),target:currentProductionTarget(),old:decisionState.__decisionProgress[1].C.savedAt};},{round,cycles});
    assert.ok(result.states.every(s=>s==='pending'),JSON.stringify(result));assert.equal(result.target,0);assert.ok(result.old);
   }
  }
  await page.evaluate(()=>{decisionState.__cycleSettlements={6:{round:6}};renderTabs();});
  assert.equal(await page.evaluate(()=>decisionSectionStatus('C')),'finished');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
