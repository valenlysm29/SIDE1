const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(__dirname,'output'),{recursive:true});
execFileSync(process.env.PYTHON_BIN||'python',['-c',"import sys;from pathlib import Path;sys.path.insert(0,'tests');from browser_fixture import document;Path('tests/output/decisions.html').write_text(document('index.html'),encoding='utf-8')"],{cwd:root,env:{...process.env,PYTHONUTF8:'1'}});
const fixturePath=path.join(__dirname,'output/decisions.html'),html=fs.readFileSync(fixturePath,'utf8');
fs.unlinkSync(fixturePath);
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/*',r=>r.abort());
await page.setContent(html,{waitUntil:'load'});
await page.evaluate(()=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({roundHours:8,roundMinutes:0,cycles:20}));openDecisionMenu();});
for(const [width,height] of [[1366,768],[1024,768],[768,1024],[390,844],[320,568],[844,390]]){
 await page.setViewportSize({width,height});
 for(const cat of ['B','C','F','D','E','A']){
  await page.locator(`[data-cat="${cat}"]`).click();await page.waitForTimeout(80);
  const layout=await page.evaluate(()=>({wide:document.documentElement.scrollWidth>innerWidth,scroll:([...document.querySelectorAll('#decisionMenu,#decisionTabs,.decision-window,.decision-detail,.decision-cards')]).filter(e=>e.scrollHeight>e.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(e).overflowY)).map(e=>e.id||e.className)}));
  assert.equal(layout.wide,false,`horizontal overflow ${width}/${cat}`);assert.deepEqual(layout.scroll,[],`nested vertical scroll ${width}/${cat}`);
  assert.equal(await page.locator('.production-dop').count(),cat==='C'?1:0,`DOP exclusivity ${width}/${cat}`);
  if(cat==='C'){
   assert.equal(await page.locator('.dop-cycle-flow li').count(),await page.evaluate(()=>productionPlan().processes.length));
   assert.equal(await page.locator('.production-dop').isVisible(),true);
   assert.ok(await page.evaluate(()=>!!(document.querySelector('.production-dop').compareDocumentPosition(document.querySelector('[data-item="PRODUCCION_META"]'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  }
  if(cat==='C')assert.doesNotMatch(await page.locator('#decisionCards').innerText(),/Cuero:|Accesorios:|Hilo:|MATERIA PRIMA|INSUMOS NECESARIOS|Materiales/);
  if(cat==='A')assert.doesNotMatch(await page.locator('#companySummaryMount').innerText(),/logística|materiales|inventario|transporte|financiamiento|insumos/i);
 }
 console.log(`PASS all tabs layout ${width}x${height}`);
}
await page.setViewportSize({width:1366,height:768});
await page.locator('[data-cat="D"]').click();
assert.equal(await page.locator('[data-store-option]').count(),3);
assert.equal(await page.locator('[data-store-option]:checked').count(),1);
assert.equal(await page.locator('[data-store-qty],[data-store-step],#storeDistrict,.store-options input[type="text"],.store-options input[type="number"]').count(),0);
for(const id of ['sjl','los_olivos','miraflores']){
 await page.locator('label').filter({has:page.locator(`[data-store-option="${id}"]`)}).click();
 assert.equal(await page.locator(`[data-store-option="${id}"]`).isChecked(),true);
 assert.equal(await page.locator('[data-store-option]:checked').count(),1);
}
await page.locator('[data-store-option="miraflores"]').focus();await page.keyboard.press('ArrowRight');
assert.equal(await page.locator('[data-store-option="sjl"]').isChecked(),true);
await page.keyboard.press('ArrowLeft');
assert.equal(await page.evaluate(()=>RULES.storeCount(channelDraft())),1);
assert.equal(await page.evaluate(()=>channelDraft().optionIds.includes('miraflores')),true);
await page.locator('label').filter({has:page.locator('[data-choice="CANALES"]')}).click();
assert.equal(await page.evaluate(()=>RULES.storeCount(channelDraft())),1);
await page.locator('#saveDecisionSection').click();
assert.equal(await page.evaluate(()=>RULES.storeCount(decisionState.CANALES)),1);
const cost=await page.evaluate(()=>computeItemCost(findDecisionItem('CANALES')));
assert.equal(cost,await page.evaluate(()=>findDecisionItem('CANALES').options.filter(o=>channelDraft().optionIds.includes(o.id)).reduce((sum,o)=>sum+o.cost,0)));
await page.evaluate(()=>{loadDecisionState();restoreDraftsForRound();renderDecisionCategory();});
assert.equal(await page.locator('[data-store-option="miraflores"]').isChecked(),true);
await page.evaluate(()=>{setSectionSubmitted('D');renderDecisionCategory();});
assert.equal(await page.locator('[data-store-option]:disabled').count(),3);
await page.evaluate(()=>{setSectionSubmitted('D',false);renderDecisionCategory();});
console.log('PASS selectable store cards, keyboard, single selection, web, save, reload and submission lock');
await page.locator('[data-cat="C"]').click();
assert.equal(await page.locator('[data-productivity="produced"]').innerText(),'Sin datos');
await page.locator('[data-mold-target="molde_1"]').fill('100');
assert.equal(await page.locator('[data-productivity="target"]').innerText(),'100 u.');
await page.evaluate(()=>{const code=($('lobbyCode')?.textContent||'SIDE').replace(/\s+/g,'_');const company=currentStudent.company.replace(/[^a-z0-9_-]+/gi,'_').slice(0,36)||'EMPRESA';localStorage.setItem(`side3d_inventory_${code}_${company}_${currentRound()}`,JSON.stringify({schemaVersion:2,producedUnits:75}));refreshCycleProductivity();});
const dop=await page.locator('[data-cycle-productivity]').innerText();
assert.equal(await page.locator('[data-productivity="compliance"]').innerText(),'75%');
await page.locator('[data-cat="A"]').click();
assert.ok((await page.locator('[data-cycle-productivity]').innerText()).startsWith(dop));
assert.equal(await page.locator('[data-productivity="difference"]').innerText(),'25 u.');
await page.locator('[data-cat="C"]').click();
await page.locator('[data-mold-target="molde_1"]').fill('0');
assert.equal(await page.locator('[data-productivity="compliance"]').innerText(),'Sin objetivo');
await page.locator('[data-mold-target="molde_1"]').fill('50');
assert.equal(await page.locator('[data-productivity="compliance"]').innerText(),'150%');
await page.locator('[data-cat="A"]').click();
assert.equal(await page.locator('[data-productivity="difference"]').innerText(),'-25 u.');
console.log('PASS actual production, live target, zero, overachievement, DOP/summary parity');
await page.evaluate(()=>{localStorage.setItem('SIDE_ACTIVE_ROUND','2');loadDecisionState();restoreDraftsForRound();renderDecisionCategory();});
assert.equal(await page.locator('[data-productivity="produced"]').innerText(),'Sin datos');
assert.equal(await page.locator('[data-productivity="target"]').innerText(),'0 u.');
await page.evaluate(()=>{localStorage.setItem('SIDE_ACTIVE_ROUND','1');loadDecisionState();restoreDraftsForRound();renderDecisionCategory();});
await page.locator('#companyReviewAll').click();assert.equal(await page.locator('#companyReviewDialog').isVisible(),true);await page.locator('#closeCompanyReview').click();
await page.locator('[data-cat="C"]').click();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(200);
assert.ok(await page.evaluate(()=>window.scrollY>0));
await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(3000);await page.screenshot({path:path.join(__dirname,'output/production-desktop.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});await page.locator('[data-cat="A"]').click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'output/summary-mobile.png'),fullPage:true});
await page.evaluate(()=>{decisionCategories().forEach(c=>setSectionSubmitted(c.cat));renderTabs();});
for(const [width,height] of [[1366,768],[1024,768],[768,1024],[390,844],[320,568],[844,390]]){
 await page.setViewportSize({width,height});
 const badges=await page.locator('.decision-tab .tab-status').evaluateAll(nodes=>nodes.map(badge=>{
  const tab=badge.closest('.decision-tab'),label=tab.querySelector('.decision-tab-label'),icon=tab.querySelector('img');
  const b=badge.getBoundingClientRect(),t=tab.getBoundingClientRect(),l=label.getBoundingClientRect(),i=icon.getBoundingClientRect();
  const overlaps=(a,c)=>a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top;
  return {text:badge.textContent,inside:b.left>=t.left&&b.right<=t.right&&b.top>=t.top&&b.bottom<=t.bottom,clear:!overlaps(b,l)&&!overlaps(b,i),readable:parseFloat(getComputedStyle(badge).fontSize)>=11&&b.height>=24,uncut:badge.scrollWidth<=badge.clientWidth&&badge.scrollHeight<=badge.clientHeight};
 }));
 assert.equal(badges.length,5);assert.ok(badges.every(b=>b.text.includes('ENVIADO')&&b.inside&&b.clear&&b.readable&&b.uncut),JSON.stringify({width,badges}));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log(`PASS five readable, nonoverlapping submission badges ${width}x${height}`);
}
await page.setViewportSize({width:390,height:844});await page.locator('[data-cat="C"]').click();await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
await page.screenshot({path:path.join(__dirname,'output/dop-and-badges-mobile.png'),fullPage:true});
await page.setViewportSize({width:1366,height:768});await page.locator('[data-cat="D"]').click();await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);
await page.screenshot({path:path.join(__dirname,'output/store-options-desktop.png'),fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS page scroll, review dialog and no browser errors');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
