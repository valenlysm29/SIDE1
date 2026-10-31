'use strict';
// Browser clicks against an explicitly selected isolated local stack.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');

(async()=>{
 const status=JSON.parse(execFileSync('npx.cmd',['--no-install','supabase','status','--workdir','.codex-work/modos-e2e','-o','json'],{encoding:'utf8',shell:true,stdio:['ignore','pipe','ignore']}));
 if(status.API_URL!=='http://127.0.0.1:62321')throw Error('Se requiere Supabase local aislado');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const context=await browser.newContext();
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
   if(url.pathname==='/js/config.js')return route.fulfill({status:200,contentType:'application/javascript',body:`window.SIDE_CONFIG=${JSON.stringify({SUPABASE_URL:status.API_URL,SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY,LOCAL_EXPERIMENTAL_EVENTS:true})};`});
   return route.continue();
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:62380/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#startBtn').click({timeout:25000});
  await page.locator('[data-profile=teacher]').click();
  await page.locator('[data-switch=register]').click();
  for(const [id,value] of Object.entries({registerName:'Docente',registerLastName:'Prueba',registerCourse:'SIDE',registerEmail:`side-${crypto.randomBytes(8).toString('hex')}@example.test`,registerPassword:'Local-side-test-123456!'}))await page.locator('#'+id).fill(value);
  await page.locator('#registerForm button[type=submit]').click();
  await page.waitForURL('**/docente.html**',{timeout:30000});
  await page.waitForTimeout(4000);
  await page.locator('#startGame').click();
  await page.locator('#gameCodeBadge').waitFor();
  await page.waitForFunction(()=>document.querySelector('#gameCodeBadge')?.textContent?.startsWith('SIDE-'),null,{timeout:30000});
  await page.locator('[data-tab=configuracion]').click();
  await page.locator('#challengeV1Panel').waitFor({state:'visible'});
  for(const mode of ['manual','random','balanced']){
   await page.locator('#challengeV1Mode').selectOption(mode);
   await page.waitForFunction(async value=>{const result=await window.SIDE.PartidaService.obtenerActiva();return result.success&&result.data?.configuracion?.challengeModeV1===value;},mode,{timeout:20000,polling:500});
   await page.reload();
   await page.locator('[data-tab=configuracion]').click();
   await page.waitForFunction(value=>document.querySelector('#challengeV1Mode')?.value===value,mode,{timeout:20000});
   console.log('APROBADO clic y persistencia:',mode);
  }
  console.log('NO EJECUTADO: decisiones, compras, cierre, avance y finalización.');
 }finally{await browser.close();}
})().catch(error=>{console.error('FALLIDO:',error.message);process.exitCode=1;});
