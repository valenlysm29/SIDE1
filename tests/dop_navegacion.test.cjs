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
  for(const [width,height] of [[1920,1080],[1366,900],[1024,768],[768,900],[390,844],[320,568]]){
   await p.setViewportSize({width,height});
   const tabs=await p.locator('#decisionTabs .decision-tab').evaluateAll(es=>es.map(e=>e.dataset.cat));
   assert.deepEqual(tabs,['DOP','B','C','F','D','E','A']);
   const layout=await p.locator('#decisionTabs .decision-tab').evaluateAll(es=>es.map(e=>({top:e.offsetTop,height:e.offsetHeight})));
   assert.equal(new Set(layout.map(e=>e.top)).size,1,`single row ${width}`);
   for(const cat of tabs){await tab(cat);assert.equal(await p.locator('#decisionTabs .active').getAttribute('data-cat'),cat);}
   const scroll=await p.locator('#decisionTabs').evaluate(e=>({width:e.clientWidth,total:e.scrollWidth}));
   if(width<=768)assert.ok(scroll.total>scroll.width,`horizontal scroll ${width}`);
   assert.equal(await p.locator('#decisionTabs [data-cat="DOP"] .tab-label').innerText(),'Planificación');
   await tab('DOP');assert.equal(await p.locator('#categoryTitle').innerText(),'Planificación');assert.equal(await p.locator('.production-dop').count(),1);
   const target=p.locator('[data-mold-target]');await target.fill('25');await target.press('Tab');
   assert.match(await p.locator('[data-production-total]').innerText(),/25/);
   await tab('C');assert.equal(await p.locator('.production-dop').count(),0);assert.equal(await p.locator('[data-mold-target]').count(),0);
   await tab('DOP');assert.equal(await p.locator('[data-mold-target]').inputValue(),'25');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  for(const cycles of [3,6])for(let round=1;round<=cycles;round++){
   const order=await p.evaluate(({cycles,round})=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles}));localStorage.setItem('SIDE_ACTIVE_ROUND',String(round));return navigationCategories().map(c=>c.cat);},{cycles,round});
   assert.deepEqual(order,['DOP','B','C','F','D','E','A']);
  }
  await p.evaluate(()=>{localStorage.setItem('SIDE_ACTIVE_ROUND','1');decisionDrafts={};restoreDraftsForRound();});
  await tab('C');await tab('DOP');assert.equal(await p.locator('[data-mold-target]').inputValue(),'25');
  await p.evaluate(()=>{window.originalCategoryHasSaved=categoryHasSaved;categoryHasSaved=cat=>cat==='C';renderTabs();});
  assert.equal(await p.locator('#decisionTabs [data-cat="C"] .tab-status').innerText(),'Borrador');
  await p.evaluate(()=>{categoryHasSaved=window.originalCategoryHasSaved;setSectionSubmitted('C');});await tab('C');assert.match(await p.locator('#decisionTabs [data-cat="C"] .tab-status').innerText(),/Enviado/);await tab('DOP');assert.equal(await p.locator('[data-mold-target]').isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('PASS DOP navigation, draft, lock and responsive layout');return;
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
