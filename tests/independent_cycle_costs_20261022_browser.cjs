'use strict';
// Independent delivered-page checks. Offline classroom fixture, no remote SQL.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(process.env.SIDE_ROOT||path.join(__dirname,'..'));
const {chromium}=require(path.join(ROOT,'tests/node_modules/playwright'));
const OUT=path.join(ROOT,'tests/output/costos-calculadora-20261022');fs.mkdirSync(OUT,{recursive:true});
const report={startedAt:new Date().toISOString(),checks:[],errors:[],cycles:[]};
function check(label,condition=true){assert.ok(condition,label);report.checks.push(label);console.log('PASS '+label);save();}
function near(a,b,label){check(label,Math.abs(a-b)<1e-7);}
function save(){fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(report,null,2));}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((request,response)=>{const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\//,'')||'index.html',file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(relative==='js/config.js'?'window.SIDE_CONFIG={};':fs.readFileSync(file));});
const amount=value=>Number(String(value||'').replace(/[^\d.-]/g,''));
async function inspectNotice(page,cycle,opening,width,acknowledge=true){
 await page.waitForSelector('#cycleCostsModal:not(.hidden)');
 const state=await page.evaluate(()=>({cycle:currentRound(),receipt:decisionState.__cycleCosts[currentRound()],cash:cashBalance(),ledger:{...cashLedger},hud:$('cashBalance').textContent,snapshot:buildStudentSnapshot()}));
 check(width+' actual automatic cycle '+cycle,state.cycle===cycle);near(state.receipt.total,2712.32,width+' receipt has fixed amount '+cycle);near(state.receipt.before,opening,width+' opening balance '+cycle);near(state.receipt.after,opening-2712.32,width+' closing balance '+cycle);near(state.cash,state.receipt.after,width+' real cash equals receipt '+cycle);
 near(amount(await page.locator('#cycleCostsTotal').innerText()),state.receipt.total,width+' displayed total equals charge '+cycle);near(amount(await page.locator('#cycleCostsBefore').innerText()),state.receipt.before,width+' displayed initial equals real '+cycle);near(amount(await page.locator('#cycleCostsAfter').innerText()),state.receipt.after,width+' displayed final equals real '+cycle);
 const rowsText=await page.locator('#cycleCostsItems').innerText();for(const row of state.receipt.items)check(width+' announced '+row.id+'/'+cycle,rowsText.includes(row.label));near(state.receipt.items.reduce((sum,row)=>sum+row.amount,0),state.receipt.total,width+' sum displayed items '+cycle);
 const cycleEntries=Object.entries(state.ledger).filter(([key])=>key.startsWith(cycle+':'));near(cycleEntries.reduce((sum,[,v])=>sum+v,0),-state.receipt.total,width+' no unannounced ledger debit '+cycle);
 check(width+' receipt persists in student snapshot '+cycle,!!state.snapshot.decision_state.__cycleCosts[cycle]);
 check(width+' modal inside viewport '+cycle,await page.locator('#cycleCostsModal').evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=-1&&b.right<=innerWidth+1&&b.top>=-1&&b.bottom<=innerHeight+1;}));
 await page.screenshot({path:path.join(OUT,'notice-'+width+'-cycle-'+cycle+'.png')});report.cycles.push({width,...state});save();
 if(!acknowledge)return state.receipt.after;await page.locator('#cycleCostsUnderstood').click();check(width+' acknowledgement stored '+cycle,await page.evaluate(()=>decisionState.__cycleCosts[currentRound()].acknowledged===true));
 await page.evaluate(()=>maybeShowCycleCostNotice());check(width+' acknowledged notice not repeated '+cycle,await page.locator('#cycleCostsModal').isHidden());
 return state.receipt.after;
}
async function scenario(browser,origin,width,height){
 const context=await browser.newContext({viewport:{width,height},locale:'es-PE',timezoneId:'America/Lima'});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const now=Date.UTC(2026,9,22,15),started=new Date(now-1000).toISOString();
 await context.addInitScript(({started})=>{if(localStorage.getItem('QA_CONFIGURED'))return;localStorage.setItem('QA_CONFIGURED','1');localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-000',capital:100000,cycles:3,integrationMinutes:0,cycleCloseMode:'automatic',roundHours:0,roundMinutes:1,scheduledStart:started,gameStartedAt:started}));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:started}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions',status:'running',running:true,remaining:60,startedAt:started,duration:60}));},{started});
 const page=await context.newPage();page.on('pageerror',error=>{report.errors.push(error.message);save();});await page.clock.install({time:new Date(now)});
 try{
  await page.goto(origin+'/index.html',{waitUntil:'networkidle'});await page.evaluate(()=>showModal('studentModal'));await page.locator('#gameCode').fill('SIDE-000');await page.locator('#companyLegalName').fill('Costos '+width+' SAC');await page.locator('#companyBrandName').fill('Costos '+width);await page.locator('#studentForm button[type="submit"]').click();await page.waitForFunction(()=>studentConnected);
  let cash=await inspectNotice(page,1,100000,width);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>studentConnected);check(width+' reload reenters same company',await page.evaluate(()=>currentStudent.returning===true||currentStudent.company.startsWith('Costos ')));check(width+' reload does not repeat acknowledged notice',await page.locator('#cycleCostsModal').isHidden());near(await page.evaluate(()=>cashBalance()),cash,width+' reload no double charge');
  // The schedule advances itself through the real runtime/tick path; no teacher click.
  for(let cycle=2;cycle<=3;cycle++){await page.clock.fastForward(60000);await page.waitForFunction(cycle=>currentRound()===cycle,cycle);cash=await inspectNotice(page,cycle,cash,width,cycle!==2);if(cycle===3)check(width+' replacing open cycle2 notice never acknowledges it',await page.evaluate(()=>decisionState.__cycleCosts[2].acknowledged===false));}
  await page.evaluate(()=>openDecisionMenu());await page.locator('[data-cat="B"]').click();await page.locator('#saveDecisionSection').click();await page.locator('[data-cat="C"]').click();await page.locator('#saveDecisionSection').click();near(await page.evaluate(()=>cashBalance()),cash,width+' saving fixed sections no second charge');
  await page.locator('[data-cat="C"]').click();check(width+' exactly one units input',await page.locator('[data-mold-target]').count()===1);check(width+' mold selector present',await page.locator('#productionMoldSelector[data-production-mold]').count()===1);
  const initialCash=await page.evaluate(()=>cashBalance());
  const needed={molde_1:{CUERO:3,ACCESORIOS:10,HILO:60},molde_2:{CUERO:4,ACCESORIOS:10,HILO:70},molde_3:{CUERO:7,ACCESORIOS:10,HILO:130}};
  for(const mold of ['molde_1','molde_2','molde_3']){
   await page.locator('#productionMoldSelector').selectOption(mold);await page.locator('[data-mold-target="'+mold+'"]').fill('10');
   const view=await page.evaluate(()=>({plan:productionPlan(),draft:decisionDrafts.PRODUCCION_META,requirements:document.querySelector('[data-mold-requirements]').textContent,dopTarget:Number(document.querySelector('.production-dop').dataset.productionTarget),total:Number(document.querySelector('[data-production-total]').textContent.replace(/[^\d]/g,'')),cash:cashBalance()}));
   const line=view.plan.productLines.find(line=>line.id===mold);for(const [id,value] of Object.entries(needed[mold]))near(line.requirements[id],value,width+' '+mold+' '+id+' requirements');
   near(view.dopTarget,view.plan.target,width+' '+mold+' DOP target from same plan');near(view.total,view.plan.target,width+' '+mold+' total from same plan');near(view.cash,initialCash,width+' '+mold+' comparison does not buy mold or charge');
   check(width+' '+mold+' still one numeric control',await page.locator('[data-mold-target]').count()===1);
  }
  await page.locator('[data-mold-target="molde_3"]').fill('-5');check(width+' negative clamp immediate',await page.locator('[data-mold-target]').inputValue()==='0');
  await page.screenshot({path:path.join(OUT,'calculator-dop-'+width+'.png'),fullPage:true});check(width+' no global horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }finally{await context.close();}
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),origin='http://127.0.0.1:'+server.address().port;
 try{for(const [width,height] of [[1150,666],[390,844]])await scenario(browser,origin,width,height);check('no uncaught page errors',report.errors.length===0);report.finishedAt=new Date().toISOString();save();console.log('PASS '+report.checks.length+' independent checks');}
 finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{report.failure={message:error.message,stack:error.stack};save();console.error(error);server.close();process.exitCode=1;});
