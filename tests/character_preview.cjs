'use strict';
const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto((process.env.SIDE_TEST_URL||'http://127.0.0.1:8771/')+'tools/character_preview.html');
  await page.waitForFunction(()=>window.ready,null,{timeout:60000});
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(__dirname,'output/characters-final.png')});
  await page.evaluate(()=>{preview.camera.position.set(-1.1,1.59,.85);preview.camera.lookAt(-1.15,1.61,0)});
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(__dirname,'output/character-portrait.png')});
  await page.evaluate(()=>{preview.camera.position.set(0,1.12,5.4);preview.camera.lookAt(0,.95,0);preview.models.forEach(model=>model.rotation.y=Math.PI)});
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(__dirname,'output/characters-back.png')});
  await page.keyboard.press('Space');await page.waitForTimeout(300);
  await page.screenshot({path:path.join(__dirname,'output/characters-walk.png')});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('PASS character preview: 3 models, idle/walk, front/portrait/back screenshots');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
