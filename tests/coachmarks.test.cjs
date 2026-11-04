'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png'};
test('Guías reales: pasos, persistencia y prioridad de diálogos', {timeout:180000}, async t=>{
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,name||'index.html');if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 t.after(async()=>{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))});
 const url=`http://127.0.0.1:${server.address().port}/`;
 for(const [role,file,total] of [['docente','docente.html',6],['estudiante','index.html',7]])await t.test(role,async()=>{
  // External requests are intentionally blocked; their ERR_FAILED messages are expected.
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text())});t.after(()=>page.close());
  await page.route('**/*',r=>r.request().url().startsWith(url+'js/config.js')?r.fulfill({contentType:'text/javascript',body:'window.SIDE_CONFIG={};'}):r.request().url().startsWith(url)?r.continue():r.abort());
  await page.goto(url+file,{waitUntil:'domcontentloaded'});
  if(role==='estudiante'){await page.evaluate(()=>{sessionStorage.setItem('SIDE_STUDENT_SESSION',JSON.stringify(currentStudent));openDecisionMenu()});if(await page.locator('#cycleCostsUnderstood').isVisible())await page.locator('#cycleCostsUnderstood').click()}
  await page.locator('.coach-layer:not([hidden])').waitFor();await page.locator('[data-action=next]').click();
  const before=role==='estudiante'?await page.evaluate(()=>JSON.stringify([decisionState,decisionDrafts,cashLedger])):null;
  if(role==='estudiante'){await page.locator('[data-cat=C]').click();await page.waitForFunction(()=>document.getElementById('coach-title').textContent==='Producción');await page.locator('[data-action=back]').click();await page.locator('[data-action=back]').click()}
  else {await page.locator('[data-tab=empresas]').click();await page.waitForFunction(()=>document.getElementById('coach-title').textContent==='Empresas');await page.locator('[data-action=back]').click()}
  for(let i=1;i<=total;i++){
   assert.equal(await page.locator('.coach-progress').innerText(),`${i} de ${total}`);
   assert.equal(await page.locator('.coach-spot').isVisible(),true);
   const box=await page.locator('.coach-card').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844);
   await page.locator('[data-action=next]').click();
  }
  if(before)assert.equal(await page.evaluate(()=>JSON.stringify([decisionState,decisionDrafts,cashLedger])),before);
  assert.equal(await page.locator('.coach-layer').isVisible(),false);
  await page.locator('.coach-help').click();
  await page.evaluate(()=>{const d=document.createElement('div');d.id='coach-test-dialog';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.style.cssText='position:fixed;inset:0;background:white';document.body.append(d)});
  await page.locator('.coach-layer').waitFor({state:'hidden'});await page.locator('#coach-test-dialog').evaluate(e=>e.remove());await page.locator('.coach-layer').waitFor({state:'visible'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('.coach-layer').isVisible(),false);
  await page.reload({waitUntil:'domcontentloaded'});if(role==='estudiante')await page.evaluate(()=>openDecisionMenu());
  assert.equal(await page.locator('.coach-layer').isVisible(),false);assert.deepEqual(errors,[]);await page.close();
 });
});
