'use strict';
// Python Playwright is absent in both installed runtimes; use the repo's Node
// Playwright runner with the same isolated delivered-document fixture.
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/role-selection');
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const html=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const results=[];
  try{
    for(const [width,height] of [[1366,768],[1920,1080],[1024,600],[820,1180],[390,844],[320,568],[320,480],[360,360],[844,390],[667,375],[568,320]]){
      const page=await browser.newPage({viewport:{width,height},locale:'es-PE',timezoneId:'America/Lima'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>route.abort());
      await page.setContent(html,{waitUntil:'load'});
      await page.locator('#startBtn').waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.getElementById('startBtn').disabled);
      const splash=await page.locator('.loading-track').evaluate(el=>({height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderTopWidth,background:getComputedStyle(document.getElementById('loadingBar')).backgroundImage}));
      assert.equal(splash.border,'4px','Splash preserves original silver border');
      assert(splash.background.includes('189, 197, 208'),'Splash preserves original silver fill');
      await page.locator('#startBtn').click();
      await page.locator('#profiles').waitFor({state:'visible'});
      const geometry=await page.evaluate(()=>{
        const screen=document.getElementById('profiles');
        const items=['.profile-side-logo','.profile-title','.student-hero','.student-hero-img','.student-hero-copy','.hero-eyebrow','.hero-cta','.teacher-mini','.upch-corner'].map(selector=>{
          const el=screen.querySelector(selector),r=el.getBoundingClientRect();
          return {selector,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        });
        return {height:screen.getBoundingClientRect().height,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,items};
      });
      assert(Math.abs(geometry.height-height)<1,'role screen uses viewport height');
      assert(geometry.scrollHeight<=height+1,`${width}x${height}: vertical scroll ${geometry.scrollHeight}`);
      assert(geometry.scrollWidth<=width+1,`${width}x${height}: horizontal scroll`);
      for(const item of geometry.items)assert(item.width>0&&item.height>0&&item.left>=0&&item.top>=0&&item.right<=width+1&&item.bottom<=height+1,`${width}x${height}: clipped ${JSON.stringify(item)}`);
      const card=geometry.items.find(item=>item.selector==='.student-hero');
      for(const item of geometry.items.filter(item=>['.student-hero-img','.student-hero-copy','.hero-eyebrow','.hero-cta'].includes(item.selector)))assert(item.left>=card.left&&item.top>=card.top&&item.right<=card.right+1&&item.bottom<=card.bottom+1,`${width}x${height}: content escapes student card ${item.selector}`);
      for(const [role,modal] of [['student','#studentModal'],['teacher','#teacherLoginModal']]){
        await page.locator(`[data-profile="${role}"]`).click();
        assert(await page.locator(modal).isVisible(),`${role}: opens dialog`);
        await page.locator(`${modal} [data-close]`).click();
      }
      assert.deepEqual(errors,[],'No JavaScript errors');
      await page.screenshot({path:path.join(out,`roles-${width}x${height}.png`)});
      results.push({width,height,...geometry,splash});
      await page.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(`PASS: silver splash; roles fit and remain actionable in ${results.length} viewports; no JavaScript errors.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
