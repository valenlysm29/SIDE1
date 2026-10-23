'use strict';
// Independent delivered-page test, local offline classroom only. No SQL writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'tests/output/dop-20261022/browser');fs.mkdirSync(OUT,{recursive:true});
const {chromium}=require('./node_modules/playwright');
const summaryPath=path.join(ROOT,'tests/output/dop-20261022/independent/summary.json');
const oracle=fs.existsSync(summaryPath)?JSON.parse(fs.readFileSync(summaryPath,'utf8')):require('./oracle/dop_cantidad_20261022.json').summary;
const report={startedAt:new Date().toISOString(),checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(OUT,process.env.SIDE_DOP_CAPTURE_ONLY==='1'?'capture-summary.json':'summary.json'),JSON.stringify(report,null,2));
function check(label,ok=true){assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label);save();}
function near(a,b,label){check(label,Math.abs(a-b)<=1e-7);}
const amount=value=>Number(String(value).replace(/[^\d.-]/g,''));
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((request,response)=>{const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\//,'')||'index.html',file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(relative==='js/config.js'?'window.SIDE_CONFIG={};':fs.readFileSync(file));});
async function captureDop(page,width){
 await page.clock.runFor(100);
 for(const [label,selector] of [['diagram','[data-pd-node="cut"]'],['requirements','.pd-requirements-table'],['costs','.pd-target-costs'],['comparison','.pd-comparison']]){
  await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'start',inline:'nearest'}));await page.clock.runFor(100);await page.screenshot({path:path.join(OUT,'visible-'+label+'-'+width+'.png')});
 }
 if(width<500){
  const scroller=page.locator('.pd-comparison .pd-table-scroll');
  const position=await scroller.evaluate(el=>{el.scrollLeft=el.scrollWidth-el.clientWidth;return {left:el.scrollLeft,maximum:el.scrollWidth-el.clientWidth};});
  check(width+' comparison last columns reachable',position.left>0&&Math.abs(position.left-position.maximum)<2);
  await page.screenshot({path:path.join(OUT,'visible-comparison-right-'+width+'.png')});
  await scroller.evaluate(el=>{el.scrollLeft=0;});
 }
}
async function checkDopWidths(page,width){
 const violations=await page.evaluate(()=>Array.from(document.querySelectorAll('.pd-target-costs p,.pd-comparison p,.pd-table-scroll')).flatMap(el=>{
  const b=el.getBoundingClientRect(),inside=b.left>=-1&&b.right<=innerWidth+1,wrapped=el.tagName!=='P'||el.scrollWidth<=el.clientWidth+1;
  return inside&&wrapped?[]:[{tag:el.tagName,className:el.className,left:b.left,right:b.right,width:b.width,client:el.clientWidth,scroll:el.scrollWidth,text:el.textContent.slice(0,80)}];
 }));
 check(width+' DOP paragraphs and table containers inside viewport '+JSON.stringify(violations),violations.length===0);
}
async function scenario(browser,origin,width,height){
 const context=await browser.newContext({viewport:{width,height},locale:'es-PE',timezoneId:'America/Lima'});
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const now=Date.UTC(2026,9,22,15),started=new Date(now-1000).toISOString();
 await context.addInitScript(({started})=>{if(localStorage.getItem('QA_DOP'))return;localStorage.setItem('QA_DOP','1');localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-000',capital:1000000,cycles:3,integrationMinutes:0,cycleCloseMode:'automatic',roundHours:0,roundMinutes:1,scheduledStart:started,gameStartedAt:started}));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:started}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions',status:'running',running:true,remaining:60,startedAt:started,duration:60}));},{started});
 const page=await context.newPage();page.on('pageerror',error=>{report.errors.push(error.message);save();});
 await page.clock.install({time:new Date(now)});await page.clock.pauseAt(new Date(now+1000));
 try{
  await page.goto(origin+'/index.html',{waitUntil:'networkidle'});await page.evaluate(()=>showModal('studentModal'));await page.locator('#gameCode').fill('SIDE-000');await page.locator('#companyLegalName').fill('Oraculo '+width+' SAC');await page.locator('#companyBrandName').fill('Oraculo '+width);await page.locator('#studentForm button[type="submit"]').click();await page.waitForFunction(()=>studentConnected);
  await page.locator('#cycleCostsUnderstood').click();await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="C"]').click();
  const baseline=await page.evaluate(()=>({cash:cashBalance(),ledger:JSON.stringify(cashLedger)}));
  await page.locator('#productionMoldSelector').selectOption('molde_1');
  const targetInput=page.locator('[data-mold-target]');
  check(width+' target help associated',await targetInput.getAttribute('aria-describedby')==='productionPlanningHint');
  check(width+' total atomic live status',await page.locator('[data-production-total]').getAttribute('role')==='status'&&await page.locator('[data-production-total]').getAttribute('aria-atomic')==='true');
  await targetInput.fill('17');
  check(width+' live total updated',await page.locator('[data-production-total]').innerText()==='17 u.');
  const plus=page.locator('[data-mold-step="molde_1"][data-delta="10"]');
  await plus.focus();await page.keyboard.press('Space');
  check(width+' keyboard plus keeps focus',await plus.evaluate(el=>el===document.activeElement));
  check(width+' keyboard plus updates target',await targetInput.inputValue()==='27');
  await page.keyboard.press('Space');
  check(width+' keyboard repeat keeps focus',await plus.evaluate(el=>el===document.activeElement));
  check(width+' keyboard repeat updates target',await targetInput.inputValue()==='37');
  near(await page.evaluate(()=>cashBalance()),baseline.cash,width+' keyboard target changes no cash');
  if(process.env.SIDE_DOP_CAPTURE_ONLY==='1'){
   await page.locator('#productionMoldSelector').selectOption('molde_1');await page.locator('[data-mold-target]').fill('397');
   await checkDopWidths(page,width);await captureDop(page,width);return;
  }
  // Each exact target/mold input is checked against the independently recalculated Excel copy.
  for(const row of oracle.direct){
   for(let i=0;i<3;i++){
    await page.locator('#productionMoldSelector').selectOption('molde_'+(i+1));
    await page.locator('[data-mold-target]').fill(String(row.inputs[i].set_to));
   }
   const view=await page.evaluate(()=>({req:productionPlan().requirements,possible:productionPlan().producibleUnits,target:Number(document.querySelector('.production-dop').dataset.productionTarget),cash:cashBalance(),ledger:JSON.stringify(cashLedger),graph:document.querySelector('[data-pd-graph]').textContent}));
   near(view.target,row.values.D36,width+' '+row.name+' visible DOP meta');
   const cells=[['D42','G42','J42'],['E43','H43','K43'],['F44','I44','L44']];
   view.req.lots.forEach((lot,i)=>lot.materials.forEach((material,m)=>near(material.needs,row.values[cells[i][m]],width+' '+row.name+' Excel '+cells[i][m])));
   near(view.cash,baseline.cash,width+' '+row.name+' no real cash movement');check(width+' '+row.name+' no ledger movement',view.ledger===baseline.ledger);
   check(width+' '+row.name+' diagram finite',!/NaN|Infinity|undefined/.test(view.graph));
  }
  for(let i=0;i<3;i++){await page.locator('#productionMoldSelector').selectOption('molde_'+(i+1));await page.locator('[data-mold-target]').fill(i===0?'10':'0');}
  const empty=await page.evaluate(()=>({req:productionPlan().requirements,graph:document.querySelector('[data-pd-graph]').innerHTML,comparison:productionPlan().comparison}));
  check(width+' stock zero really empty',empty.comparison.items.filter(row=>row.kind==='material').every(row=>row.available===0));
  // Unsaved, explicit material decisions change comparison only; target never buys.
  await page.locator('[data-cat="F"]').click();
  for(const [id,option] of [['CUERO','cuero_sint'],['ACCESORIOS','acc_eco'],['HILO','hilo_std']])await page.locator('[data-qty="'+id+'"][data-option="'+option+'"]').fill('1000');
  await page.locator('[data-cat="C"]').click();
  const stocked=await page.evaluate(()=>({req:productionPlan().requirements,comparison:productionPlan().comparison,cash:cashBalance(),ledger:JSON.stringify(cashLedger),hud:document.querySelector('#cashBalance').textContent,projection:document.querySelector('#projectedCash').textContent}));
  check(width+' sufficient stock really available',stocked.comparison.items.filter(row=>row.kind==='material').every(row=>row.surplus>0&&row.missing===0));
  check(width+' requirements invariant with available stock',JSON.stringify(empty.req)===JSON.stringify(stocked.req));
  near(stocked.cash,baseline.cash,width+' unsaved material scenarios no charge');near(amount(stocked.hud),baseline.cash,width+' HUD actual cash');near(amount(stocked.projection),baseline.cash,width+' shown cash actual while comparing');check(width+' no fictitious purchases in ledger',stocked.ledger===baseline.ledger);
  await checkDopWidths(page,width);
  await page.clock.runFor(100);await page.screenshot({path:path.join(OUT,'dop-stocked-'+width+'.png'),fullPage:true});
  await captureDop(page,width);
  await page.locator('[data-cat="F"]').click();
  for(const [id,option] of [['CUERO','cuero_sint'],['ACCESORIOS','acc_eco'],['HILO','hilo_std']])await page.locator('[data-qty="'+id+'"][data-option="'+option+'"]').fill('0');
  await page.locator('[data-cat="C"]').click();
  await page.locator('#saveDecisionSection').click();near(await page.evaluate(()=>cashBalance()),baseline.cash,width+' saving target has no fictitious purchase');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>studentConnected);await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="C"]').click();near(await page.evaluate(()=>productionPlan().requirements.target),10,width+' saved target survives reentry');
  await page.locator('#productionMoldSelector').selectOption('molde_1');check(width+' saved mold input survives',await page.locator('[data-mold-target]').inputValue()==='10');
  check(width+' one quantity input',await page.locator('[data-mold-target]').count()===1);
  check(width+' comparison follows requirements',await page.evaluate(()=>!!(document.querySelector('[data-pd-graph]').compareDocumentPosition(document.querySelector('.pd-comparison'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  await page.clock.runFor(100);check(width+' seven attached connector paths',await page.locator('[data-pd-connectors] path').count()===7);
  check(width+' no horizontal viewport overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(OUT,'dop-saved-'+width+'.png'),fullPage:true});
  // Explicit saved physical stock is a fixture, not a purchase or carry-over
  // inferred from earlier purchase quantities. Fractions remain physical units.
  const inventoryBefore=await page.evaluate(()=>({cash:cashBalance(),ledger:JSON.stringify(cashLedger),requirements:productionPlan().requirements}));
  await page.evaluate(()=>{decisionState.__inventarioMP={'INS-01':1.5,'INS-04':7,'INS-06':12};persistGameState();refreshProductionDop();});
  const physical=await page.evaluate(()=>({requirements:productionPlan().requirements,comparison:productionPlan().comparison,snapshot:buildStudentSnapshot(),cash:cashBalance(),ledger:JSON.stringify(cashLedger)}));
  check(width+' persisted physical stock keeps target requirements',JSON.stringify(physical.requirements)===JSON.stringify(inventoryBefore.requirements));
  for(const [id,available,missing] of [['CUERO',1.5,1.5],['ACCESORIOS',7,3],['HILO',12,48]]){
   const row=physical.comparison.items.find(row=>row.id===id);near(row.available,available,width+' '+id+' saved physical units');near(row.missing,missing,width+' '+id+' actual delta missing');near(row.surplus,0,width+' '+id+' no invented surplus');
   const cells=await page.locator('[data-pd-comparison="'+id+'"] td').allTextContents();near(amount(cells[1].split('Almacén:')[0]),available,width+' '+id+' UI saved stock');near(amount(cells[2]),missing,width+' '+id+' UI missing stock');
  }
  check(width+' explicit stock is in real snapshot',JSON.stringify(physical.snapshot.decision_state.__inventarioMP)===JSON.stringify({'INS-01':1.5,'INS-04':7,'INS-06':12}));
  near(physical.cash,inventoryBefore.cash,width+' persisted stock not charged again');check(width+' persisted stock adds no ledger entry',physical.ledger===inventoryBefore.ledger);
  await page.locator('.pd-comparison').evaluate(el=>el.scrollIntoView({block:'start'}));await page.clock.runFor(100);await page.screenshot({path:path.join(OUT,'physical-inventory-'+width+'.png')});
  await page.locator('#saveDecisionSection').click();near(await page.evaluate(()=>cashBalance()),inventoryBefore.cash,width+' saving with prior inventory has no repeat debit');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>studentConnected);await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="C"]').click();
  const hydrated=await page.evaluate(()=>({inventory:decisionState.__inventarioMP,comparison:productionPlan().comparison,cash:cashBalance(),ledger:JSON.stringify(cashLedger),target:productionPlan().requirements.target}));
  check(width+' physical inventory survives reentry',JSON.stringify(hydrated.inventory)===JSON.stringify({'INS-01':1.5,'INS-04':7,'INS-06':12}));near(hydrated.target,10,width+' stock reload preserves desired target');near(hydrated.cash,inventoryBefore.cash,width+' stock reload no repeat debit');check(width+' stock reload ledger unchanged',hydrated.ledger===inventoryBefore.ledger);
  near(hydrated.comparison.items.find(row=>row.id==='HILO').missing,48,width+' stock reload retains correct missing thread');
  await page.locator('[data-cat="F"]').click();
  for(const [id,option,value] of [['CUERO','cuero_sint',1],['ACCESORIOS','acc_eco',2],['HILO','hilo_std',1]])await page.locator('[data-qty="'+id+'"][data-option="'+option+'"]').fill(String(value));
  await page.locator('[data-cat="C"]').click();
  const combined=await page.evaluate(()=>({materials:productionPlan().comparison.items.filter(row=>row.kind==='material'),cash:cashBalance(),ledger:JSON.stringify(cashLedger)}));
  for(const [id,available,missing,surplus] of [['CUERO',2.5,0.5,0],['ACCESORIOS',9,1,0],['HILO',282,0,222]]){const row=combined.materials.find(row=>row.id===id);near(row.available,available,width+' '+id+' physical stock plus current purchases');near(row.missing,missing,width+' '+id+' combined missing');near(row.surplus,surplus,width+' '+id+' combined surplus');}
  near(combined.cash,inventoryBefore.cash,width+' draft replenishment no premature debit');check(width+' draft replenishment ledger unchanged',combined.ledger===inventoryBefore.ledger);
  await page.locator('[data-cat="F"]').click();for(const [id,option] of [['CUERO','cuero_sint'],['ACCESORIOS','acc_eco'],['HILO','hilo_std']])await page.locator('[data-qty="'+id+'"][data-option="'+option+'"]').fill('0');await page.locator('[data-cat="C"]').click();
  // Advance the actual automatic schedule, rather than calling a round setter.
  for(let cycle=2;cycle<=3;cycle++){
   await page.clock.fastForward(60000);await page.waitForFunction(cycle=>currentRound()===cycle,cycle);
   await page.waitForSelector('#cycleCostsModal:not(.hidden)');
   const state=await page.evaluate(()=>({receipt:decisionState.__cycleCosts[currentRound()],cash:cashBalance(),ledger:{...cashLedger},hud:document.querySelector('#cashBalance').textContent}));
   near(state.receipt.total,2712.32,width+' cycle '+cycle+' actual Excel fixed costs');
   near(state.receipt.before-state.receipt.after,state.receipt.total,width+' cycle '+cycle+' receipt equals real debit');
   near(state.cash,state.receipt.after,width+' cycle '+cycle+' real cash matches receipt');near(amount(state.hud),state.cash,width+' cycle '+cycle+' HUD cents');
   near(Object.entries(state.ledger).filter(([key])=>key.startsWith(cycle+':')).reduce((sum,[,value])=>sum+value,0),-state.receipt.total,width+' cycle '+cycle+' no unannounced debits');
   near(amount(await page.locator('#cycleCostsTotal').innerText()),state.receipt.total,width+' cycle '+cycle+' visible cost notice');
   await page.locator('#cycleCostsUnderstood').click();await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="C"]').click();
   await page.locator('#productionMoldSelector').selectOption('molde_1');await page.locator('[data-mold-target]').fill(String(cycle*10));await page.locator('#saveDecisionSection').click();
   near(await page.evaluate(()=>cashBalance()),state.cash,width+' cycle '+cycle+' target save no invented purchase');
   await page.clock.runFor(100);await page.screenshot({path:path.join(OUT,'dop-cycle-'+cycle+'-'+width+'.png'),fullPage:true});
  }
 }finally{await context.close();}
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),origin='http://127.0.0.1:'+server.address().port;
 try{for(const [width,height] of [[1150,666],[1440,900],[390,844]])await scenario(browser,origin,width,height);check('no uncaught browser errors',report.errors.length===0);report.finishedAt=new Date().toISOString();save();}
 finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{report.failure={message:error.message,stack:error.stack};save();console.error(error);server.close();process.exitCode=1;});
