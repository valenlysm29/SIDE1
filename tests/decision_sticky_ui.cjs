const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'output'),baseline=process.argv.includes('--baseline');
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
(async()=>{
 const errors=[],warnings=[],cache=new Map();
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html',file=path.resolve(root,relative);
  if(relative==='favicon.ico'){res.writeHead(204).end();return;}
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  let data;
  if(baseline&&/\.(css|js|html)$/.test(relative)){
   if(!cache.has(relative))cache.set(relative,execFileSync('git',['show',`HEAD:${relative}`],{cwd:root,maxBuffer:20*1024*1024}));
   data=cache.get(relative);
  }else data=fs.readFileSync(file);
  if(relative==='js/config.js')data='window.SIDE_CONFIG = {};';
  if(relative==='index.html')data=data.toString().replace(/<link[^>]*href="https:[^>]+>/g,'').replace(/<script src="https:[^"]+"><\/script>/g,'').replace(/<script src="js\/simulator3d(?:-config)?\.js[^\"]*"><\/script>/g,'').replace('<script src="js/app.js','<script>window.SIDE3D={preload:async()=>true,suspend:()=>{},cycleProductionRecord:()=>null};</script><script src="js/app.js');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage({viewport:{width:1900,height:1000}});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await p.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const categories=['B','C','F','D','E','A'];
 const scroller=()=>p.locator('#decisionFormScroll');
 async function top(){await scroller().evaluate(el=>{el.scrollTop=0});}
 async function tab(cat){await p.locator(`#decisionTabs [data-cat="${cat}"]`).click();}
 async function choice(id,option){await p.locator('label').filter({has:p.locator(`[data-choice="${id}"][data-option="${option}"]`)}).click();}
 async function number(selector,value){await p.locator(selector).fill(String(value));await p.locator(selector).press('Tab');}
 try{
  await p.goto(origin,{waitUntil:'networkidle'});
  await p.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
  await p.evaluate(()=>{const startedAt=new Date(Date.now()-42000).toISOString();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,roundHours:0,roundMinutes:10,cycles:6}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,running:true,startedAt,duration:600,remaining:600}));openDecisionMenu();});
  if(baseline){for(const [width,height] of [[1900,1000],[1366,900],[390,844],[320,568]]){await p.setViewportSize({width,height});await tab('B');await p.screenshot({path:path.join(output,`decision-sticky-baseline-${width}x${height}.png`)});}console.log('PASS baseline captures from HEAD');return;}
  await scroller().waitFor();
  assert.match(await p.locator('#decisionProgressText').innerText(),/^0\/5/);
  const runtimeStart=await p.evaluate(()=>readRoundRuntime().startedAt);
  for(const [width,height] of [[1900,1000],[1366,900],[390,844],[320,568],[844,390],[667,375]]){
   await p.setViewportSize({width,height});
   for(const cat of categories){
    await tab(cat);await top();
    const before=await p.evaluate(()=>['decisionTopbar','decisionTabs','decisionStickyHead'].map(id=>{const r=$(id).getBoundingClientRect();return {id,top:r.top,bottom:r.bottom,height:r.height};}));
    await scroller().evaluate(el=>{el.scrollTop=el.scrollHeight});
    const layout=await p.evaluate(()=>{
     const nodes=['decisionTopbar','decisionTabs','decisionStickyHead'].map(id=>{const r=$(id).getBoundingClientRect();return {id,top:r.top,bottom:r.bottom,height:r.height};});
     const headerBottom=Math.max(...nodes.map(r=>r.bottom)),body=$('decisionFormScroll'),b=body.getBoundingClientRect();
     return {nodes,headerBottom,body:{top:b.top,bottom:b.bottom,height:b.height,scrollTop:body.scrollTop,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight},windowScroll:scrollY,wide:document.documentElement.scrollWidth>innerWidth+1,height:innerHeight,hiddenControls:['#cashBalance','#cashMovement','#categoryDescription','#roundLabel','#decisionRoundTimer','#decisionProgressText','#topSubmitAllDecisions'].filter(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return !el.getClientRects().length||r.top<-.5||r.bottom>innerHeight+.5||r.left<-.5||r.right>innerWidth+.5;})};
    });
    assert.deepEqual(layout.nodes,before,`stationary header ${width}/${cat}`);
    assert.equal(layout.windowScroll,0,`only body scrolls ${width}/${cat}`);assert.equal(layout.wide,false,`horizontal overflow ${width}/${cat}`);
    assert.deepEqual(layout.hiddenControls,[],`visible controls ${width}/${cat}`);
    assert.ok(layout.body.top>=layout.headerBottom-.5,`content below headings ${width}/${cat}: ${JSON.stringify(layout)}`);
    if(layout.body.height<70)await p.screenshot({path:path.join(output,`decision-sticky-failure-${width}x${height}-${cat}.png`)});
    assert.ok(layout.body.height>=(height>=568?100:70),`usable content height ${width}/${cat}: ${layout.body.height}`);
    assert.ok(layout.body.bottom<=height+.5,`body inside viewport ${width}/${cat}`);
    if(layout.body.scrollHeight>layout.body.clientHeight+2)assert.ok(layout.body.scrollTop>0,`body responds to scroll ${width}/${cat}`);
    if(cat==='B'||cat==='A')await p.screenshot({path:path.join(output,`decision-sticky-${width}x${height}-${cat}-scrolled.png`)});
    const target=p.locator('#decisionCards input:not([disabled]),#decisionCards button:not([disabled])').last();
    if(await target.count()){
     await target.focus();
     const box=await target.boundingBox(),header=await p.locator('#decisionStickyHead').boundingBox();
     assert.ok(box.y>=header.y+header.height-.5&&box.y+box.height<=height+.5,`focused control visible ${width}/${cat}`);
    }
   }
   await tab('B');assert.equal(await scroller().evaluate(el=>el.scrollTop),0,`tab switch resets content scroll ${width}`);
  }
  if(process.argv.includes('--layout-only')){
   assert.equal(await p.locator('.section-balance,[data-saved-final-balance],#projectedCash').count(),0);
   assert.equal(await p.locator('#cashBalance').isVisible(),true);
   await tab('A');assert.equal(await p.locator('.cs-unit-cost').count(),1,'production unit cost remains');
   assert.deepEqual(errors,[]);
   console.log('PASS 36 responsive tab layouts; no duplicate balance; top cash and unit cost retained; no browser errors');return;
  }
  await p.setViewportSize({width:1366,height:900});await tab('B');
  const initial=await p.evaluate(()=>cashBalance());
  const readMoney=async selector=>Number((await p.locator(selector).innerText()).replace(/[^\d.-]/g,''));
  const hudBefore=await readMoney('#cashBalance');
  assert.equal(await p.locator('.section-balance,[data-saved-final-balance],#projectedCash').count(),0,'duplicate saved balance removed from shared section header');
  await number('[data-qty="MESA_CORTE"][data-option="mesa"]',1);await choice('MOLDE','molde_1');
  assert.equal(await p.evaluate(()=>cashBalance()),initial,'choosing draft does not charge before saving');
  const hudDraft=await readMoney('#cashBalance');assert.equal(hudDraft,hudBefore,'cash HUD preserves saved cash while editing draft');
  await tab('C');assert.equal(await readMoney('#cashBalance'),hudDraft,'cash projection persists across tabs');await tab('B');assert.equal(await readMoney('#cashBalance'),hudDraft);
  await p.clock.install();await p.evaluate(()=>syncStudentTimer());
  const seconds=text=>text.trim().split(':').reduce((total,part)=>total*60+Number(part),0),timerBefore=seconds(await p.locator('#decisionRoundTimer').innerText());
  await p.clock.fastForward(2100);await p.evaluate(()=>syncStudentTimer());
  assert.ok(seconds(await p.locator('#decisionRoundTimer').innerText())<=timerBefore-2,'visible cycle timer keeps counting down');
  await p.locator('#saveDecisionSection').click();
  assert.equal(await p.evaluate(()=>cashBalance()),initial-2800,'saved desk and mold charge once; initial already includes required premises');
  assert.equal(await p.locator('#cashBalance').innerText(),await p.evaluate(()=>money(cashBalance())));
  await p.locator('#saveDecisionSection').click();assert.equal(await p.evaluate(()=>cashBalance()),initial-2800,'saving twice does not charge twice');
  await tab('C');await number('[data-mold-target="molde_1"]',1);await choice('GARANTIA_PT','pt_30');await p.locator('#saveDecisionSection').click();
  await tab('F');for(const [id,option] of [['CUERO','cuero_sint'],['ACCESORIOS','acc_eco'],['HILO','hilo_std']])await number(`[data-qty="${id}"][data-option="${option}"]`,1);await p.locator('#saveDecisionSection').click();
  await tab('D');await choice('CANALES','web');await p.locator('#saveDecisionSection').click();
  await tab('E');await choice('INV_MARKETING','mkt_baja');await p.locator('#saveDecisionSection').click();
  const savedCash=await p.evaluate(()=>cashBalance());
  await p.locator('#topSubmitAllDecisions').click();assert.equal(await p.locator('#companyReviewDialog').isVisible(),true);assert.equal(await p.evaluate(()=>cashBalance()),savedCash,'review does not charge');
  assert.equal(await p.locator('#confirmCompanyReview').isEnabled(),true);
  await p.locator('#cancelCompanyReview').click();
  await tab('A');await p.locator('[data-summary-filter="sent"]').click();assert.equal(await p.locator('.cs-empty').count(),1);
  await p.locator('[data-summary-filter="all"]').click();assert.equal(await p.locator('#companySummaryMount [data-summary-section]').count(),5);
  await p.locator('[data-summary-goto="B"]').first().click();assert.equal(await p.evaluate(()=>currentCategory),'B');assert.equal(await scroller().evaluate(el=>el.scrollTop),0);
  await p.locator('#sendDecisionSection').click();assert.match(await p.locator('#decisionProgressText').innerText(),/^1\/5/);
  await tab('A');await p.locator('[data-summary-filter="sent"]').click();assert.equal(await p.locator('#companySummaryMount [data-summary-section]').count(),1);
  await p.locator('#topSubmitAllDecisions').click();await p.locator('#confirmCompanyReview').click();
  // Confirmation returns to the lobby/world; reopen the read-only decision summary.
  await p.evaluate(()=>openDecisionMenu());
  assert.match(await p.locator('#decisionProgressText').innerText(),/^5\/5/);assert.equal(await p.evaluate(()=>simulationSubmissionComplete()),true);assert.equal(await p.evaluate(()=>cashBalance()),savedCash,'final confirmation does not duplicate saved charges');
  assert.equal(await p.locator('#decisionTabs .section-sent').count(),5);
  await tab('A');await p.locator('[data-summary-filter="sent"]').click();assert.equal(await p.locator('#companySummaryMount [data-summary-section]').count(),5);
  assert.equal(await p.locator('#companySummaryCycle').inputValue(),'current');
  await p.evaluate(()=>{localStorage.setItem('SIDE_ACTIVE_ROUND','2');lastObservedRound=2;loadDecisionState();restoreDraftsForRound();currentCategory='A';renderTabs();renderDecisionCategory();});
  await p.locator('#companySummaryCycle').selectOption('1');assert.match(await p.locator('#companySummaryTitle').innerText(),/ciclo 1/);assert.equal(await p.locator('#companySummaryMount [data-summary-section]').count(),5);
  await p.locator('#companySummaryCycle').selectOption('current');assert.match(await p.locator('#companySummaryTitle').innerText(),/Resumen/);
  assert.equal(await p.evaluate(()=>readRoundRuntime().startedAt),runtimeStart,'navigation and actions do not restart timer');
  assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
  console.log('PASS sticky decisions: 36 responsive tab checks; fixed header, body scroll, focus; cash/draft/send/review/filter/cycle/progress and persistent timer; no browser warnings/errors');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
