'use strict';
// Run sequentially with other Chromium/SwiftShader runners. Local demo only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'output/mejora-tablet-hud-2026-10-01');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((request,response)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));}catch{response.writeHead(400).end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
});
(async()=>{
  fs.mkdirSync(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`,results=[];
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const viewport of [{width:1366,height:900},{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:844,height:390}]){
      const page=await browser.newPage({viewport}),errors=[],localFailures=[];
      page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)localFailures.push({url:response.url(),status:response.status()});});
      await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.evaluate(()=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA BORRADOR',company:'QA BORRADOR',game:DEMO_GAME};currentCategory='B';openDecisionMenu();decisionDrafts.MOLDE={optionIds:['molde_1']};renderDecisionCategory();});
      const finance=()=>page.evaluate(()=>JSON.stringify({state:decisionState,ledger:cashLedger,round:currentRound(),submitted:decisionsSubmitted()}));
      const before=await finance(),button=page.locator('[data-save-item-draft="MOLDE"]'),feedback=page.locator('[data-item="MOLDE"] .item-draft-feedback');
      await button.click();await assert.equal(await feedback.getAttribute('data-state'),'saved');assert.match(await feedback.textContent(),/Borrador local guardado; pendiente de envío/);
      assert.equal(await finance(),before);
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem(`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`)).B.MOLDE.optionIds),['molde_1']);
      const bounds=await button.boundingBox();assert.ok(bounds.height>=44,'44px draft target');
      await page.screenshot({path:path.join(output,`tablet-draft-${viewport.width}x${viewport.height}-viewport.png`)});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:path.join(output,`tablet-draft-${viewport.width}x${viewport.height}.png`),fullPage:true});
      await page.evaluate(()=>{window.__draftOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('SIDE_DECISION_DRAFTS_'))throw new DOMException('Quota exceeded','QuotaExceededError');return window.__draftOriginalSet.call(this,key,value);};});
      await button.click();assert.equal(await feedback.getAttribute('data-state'),'error');assert.equal(await finance(),before);
      const storedDraft=await page.evaluate(()=>localStorage.getItem(`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`));
      await page.evaluate(()=>{Storage.prototype.setItem=window.__draftOriginalSet;delete window.__draftOriginalSet;const config=teacherConfig();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...config,lifecycleVersion:2,phase:'results'}));decisionDrafts.MOLDE.optionIds=['molde_2'];});
      assert.equal(await page.evaluate(()=>studentAccess().canOperate),false);
      await button.click();assert.equal(await finance(),before);assert.equal(await page.evaluate(()=>localStorage.getItem(`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`)),storedDraft);
      await page.evaluate(()=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...teacherConfig(),phase:'decisions'}));localStorage.setItem(sectionSubmissionKey(currentCategory),'1');renderDecisionCategory();});
      assert.equal(await page.locator('[data-save-item-draft="MOLDE"]').isDisabled(),true);
      assert.match(await page.locator('[data-item="MOLDE"] .item-draft-feedback').textContent(),/enviada; edición bloqueada/);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`no overflow ${viewport.width}`);
      assert.deepEqual(errors,[]);assert.deepEqual(localFailures,[]);
      results.push({viewport,passed:true,financialStatePreserved:true,localStorageFailureHandled:true,closedCyclePreventsDraftWrite:true,submittedSectionLocked:true,errors,localFailures,overflow});await page.close();
    }
    fs.writeFileSync(path.join(output,'tablet-item-draft-results.json'),JSON.stringify(results,null,2));console.log('PASS Tablet: local draft, quota errors, submission lock and five viewports');
  }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
