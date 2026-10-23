'use strict';
// Independent delivered-page test, local offline classroom only. No SQL writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'tests/output/verificacion');fs.mkdirSync(OUT,{recursive:true});
const {chromium}=require('./node_modules/playwright');
const summaryPath=path.join(ROOT,'tests/output/dop-20261022/independent/summary.json');
const oracle=fs.existsSync(summaryPath)?JSON.parse(fs.readFileSync(summaryPath,'utf8')):require('./oracle/dop_cantidad_20261022.json').summary;
const report={startedAt:new Date().toISOString(),checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(OUT,process.env.SIDE_DOP_CAPTURE_ONLY==='1'?'capture-summary.json':'browser-caja-cero.json'),JSON.stringify(report,null,2));
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

async function scenario(browser,origin){
 const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'es-PE',timezoneId:'America/Lima'});
 await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 const now=Date.UTC(2026,9,23,15),started=new Date(now-1000).toISOString();
 await context.addInitScript(({started})=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({codigo:'SIDE-000',capital:0,cycles:3,integrationMinutes:0,cycleCloseMode:'automatic',roundHours:0,roundMinutes:30,scheduledStart:started,gameStartedAt:started}));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:started}));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions',status:'running',running:true,remaining:1800,startedAt:started,duration:1800}));},{started});
 const page=await context.newPage();await page.clock.install({time:new Date(now)});await page.clock.pauseAt(new Date(now+1000));
 await page.goto(origin+'/index.html',{waitUntil:'networkidle'});await page.evaluate(()=>showModal('studentModal'));await page.locator('#gameCode').fill('SIDE-000');await page.locator('#companyLegalName').fill('Verificacion manual SAC');await page.locator('#companyBrandName').fill('Verificacion');await page.locator('#studentForm button[type="submit"]').click();await page.waitForFunction(()=>studentConnected);
 await page.locator('#cycleCostsTotal').evaluate(el=>el.style.outline='4px solid #dc2626');await page.screenshot({path:path.join(OUT,'E12-caja-cero.png')});
 report.setupNoticeBeforeZeroFixture=await page.evaluate(()=>({cash:cashBalance(),receipt:decisionState.__cycleCosts[currentRound()]}));
 await page.locator('#cycleCostsUnderstood').click();await page.evaluate(()=>{currentStudent.initialCapital=0;cashLedger={};updateHud();openDecisionMenu();});await page.locator('[data-cat="C"]').click();
 const cases=[['E12',[10,0,0],0]];
 report.scenarios=[];
 for(const [id,quantities,stock] of cases){
  await page.evaluate(stock=>{decisionState.__inventarioMP={'INS-01':stock,'INS-04':stock,'INS-06':stock};},stock);
  for(let i=0;i<3;i++){await page.locator('#productionMoldSelector').selectOption('molde_'+(i+1));await page.locator('[data-mold-target]').fill(String(quantities[i]));}
  await page.locator('#productionMoldSelector').selectOption(quantities[2]?'molde_3':'molde_1');
  await page.locator('[data-mold-target]').evaluate(el=>{el.style.outline='4px solid #dc2626';el.scrollIntoView({block:'center'});});await page.clock.runFor(100);
  const actual=await page.evaluate(()=>({requirements:productionPlan().requirements,comparison:productionPlan().comparison,cash:cashBalance(),visible:document.querySelector('.production-dop').innerText}));
  const cells=[['D42','G42','J42'],['E43','H43','K43'],['F44','I44','L44']],values={D36:actual.requirements.target};actual.requirements.lots.forEach((lot,i)=>lot.materials.forEach((m,j)=>values[cells[i][j]]=m.needs));
  const model=require('../js/production_model.js');const engine=model.calculate({round:1,state:{__inventarioMP:{'INS-01':stock,'INS-04':stock,'INS-06':stock}},drafts:{PRODUCCION_META:{moldTargets:Object.fromEntries(quantities.map((q,i)=>['molde_'+(i+1),q]))}}});
  const screenshot='tests/output/verificacion/'+id+'-produccion.png';await page.screenshot({path:path.join(ROOT,screenshot),fullPage:true});
  await page.locator('.pd-requirements-table').evaluate(el=>{el.style.outline='4px solid #dc2626';el.scrollIntoView({block:'center'});});await page.clock.runFor(100);await page.screenshot({path:path.join(OUT,id+'-necesidades.png')});
  report.scenarios.push({id,quantities,stock,values,actual,engine:engine.requirements,screenshot});save();
 }
 await context.close();
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{await scenario(browser,'http://127.0.0.1:'+server.address().port);report.finishedAt=new Date().toISOString();save();}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{report.failure={message:e.message,stack:e.stack};save();console.error(e);process.exitCode=1;});
