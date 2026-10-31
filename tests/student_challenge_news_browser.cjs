'use strict';
const {chromium}=require('../.codex-work/lab-browser/node_modules/playwright-core');const {spawn}=require('child_process');const assert=require('node:assert/strict');
(async()=>{const server=spawn('python',['-m','http.server','8793','--bind','127.0.0.1'],{stdio:'ignore'});let browser;try{
 await new Promise(r=>setTimeout(r,1000));browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8793/')?r.continue():r.abort());await page.goto('http://127.0.0.1:8793/index.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  currentStudent={game:{id:'g',codigo:'SIDE-TEST'},empresaId:1,company:'A'};studentConnected=true;studentSnapshotEpoch++;
  authoritativeStudentState={config:{economicEventsVersion:'demand-share-v1'},empresaId:1,gameId:'g',code:'SIDE-TEST'};
  window.SIDE.EmpresaService.consultarDesafios=async()=>({success:true,data:[{eventId:'PE69',round:2,status:'programado',title:'<img src=x onerror=alert(1)>',description:'Atractivo de mercado'}]});
  await studentChallengeNews.refresh();return {html:document.querySelector('#studentNewsList').innerHTML,text:document.querySelector('#studentNewsList').textContent,legacy:cycleBusinessData().events.length};
 });
 assert.match(result.text,/Ciclo 2/);assert.match(result.text,/programado/);assert.doesNotMatch(result.html,/<img/);assert.equal(result.legacy,0);
 console.log('PASS noticias privadas V2: texto escapado y fuera del snapshot económico');
 }finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
