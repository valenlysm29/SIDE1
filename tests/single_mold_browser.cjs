'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve('tests/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.resolve('tests/output/single-mold');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}const ext=path.extname(f);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[ext]||'application/octet-stream');res.end(f.endsWith(path.join('js','config.js'))?'window.SIDE_CONFIG={};':fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 for(const width of [1366,390]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA MOLDE',company:'QA MOLDE',game:DEMO_GAME};openDecisionMenu();currentCategory='DOP';renderDecisionCategory();});
 await page.locator('[data-mold-target]').fill('100');
 for(const id of ['molde_2','molde_3','molde_1','molde_3']){
 await page.locator(`[data-production-mold][value="${id}"]`).check();assert.equal(await page.locator('[data-production-mold]:checked').count(),1);assert.equal(await page.locator('[data-mold-target]').inputValue(),'100');
 const data=await page.evaluate(()=>{const d=initDraft(findDecisionItem('PRODUCCION_META'));return {d,p:productionPlan(),saved:prepareSectionSave(categoryByCat('C')).entries.PRODUCCION_META};});
 assert.equal(data.p.materials[0].neededForTarget,{molde_1:30,molde_2:40,molde_3:70}[id]);assert.ok(await page.locator('.pd-requirements-table').count()>0);
 assert.equal(data.d.moldTargets[id],100);assert.equal(data.p.target,100);assert.equal(data.saved.moldTargets[id],100);assert.equal(data.saved.moldId,id);
 assert.equal(Object.values(data.saved.moldTargets).filter(Boolean).length,1);
 }
 await page.evaluate(()=>{const meta=prepareSectionSave(categoryByCat('C')).entries.PRODUCCION_META;decisionState.PRODUCCION_META=JSON.parse(JSON.stringify(meta));decisionDrafts={};renderDecisionCategory();});
 assert.equal(await page.locator('[data-production-mold]:checked').inputValue(),'molde_3');assert.equal(await page.locator('[data-mold-target]').inputValue(),'100');
 await page.screenshot({path:path.join(out,`planning-${width}.png`),fullPage:true});await page.close();console.log('PASS browser '+width+' switch, recommendations, save and recovery');
 }
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
