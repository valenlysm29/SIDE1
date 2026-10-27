'use strict';
// Delivered student UI, mocked server acknowledgements, no external requests.
const {chromium}=require('playwright'),{execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output/optional-world');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const html=execFileSync('python',['-B','-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],checks=[];
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
 async function ready(remote=false){
  console.log('Loading fixture',remote);await page.goto('about:blank');await page.reload();
  await page.setContent(html,{waitUntil:'load'});
  console.log('Seeding fixture');await page.evaluate(remote=>{
   localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:1000000,cycles:3,roundHours:8}));
   window.worldCalls=0;SIDE3D={preload:async()=>true,prepare:async()=>true,enter:async()=>{worldCalls++;showScreen('simulator3d');return true;},suspend(){},cycleProductionRecord:()=>null};
   currentStudent={name:'QA',company:'QA OPCIONAL',game:DEMO_GAME,...(remote?{empresaId:'company-test'}:{})};
   studentConnected=false;loadDecisionState();openDecisionMenu();
   for(const item of allDecisionItems()){const d=initDraft(item);if(item.options&&['choice','multi-choice'].includes(item.type)&&itemRequired(item))d.optionIds=[item.defaultOptionIds?.[0]||item.options[0].id];}
   Object.assign(decisionDrafts,{MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_ind:1}},ACABADOS:{quantities:{aca_ind:1}},MOLDE:{optionIds:['molde_1']},PERS_CORTE:{quantities:{corte_maestro:1}},PERS_ENSAMBLE:{quantities:{ens_personal_esp:1}},PERS_ACABADO:{quantities:{aca_personal_art:1}},CANALES:{optionIds:['web'],quantities:{}},CUERO:{quantities:{cuero_sint:35}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:700}},PRODUCCION_META:{moldTargets:{molde_1:100,molde_2:0,molde_3:0}}});
   if(remote){window.syncPromise=new Promise(resolve=>window.resolveSync=resolve);queueStudentSnapshot=()=>syncPromise;}
   renderDecisionCategory();
  },remote);
 }
 async function submit(){console.log('Submitting');
  await page.locator('#topSubmitAllDecisions').click();assert.deepEqual(await page.evaluate(()=>reviewProblems(liveCompanyReview())),[]);
  await page.locator('#confirmCompanyReview').click();console.log('Confirmed');
  assert.equal(await page.evaluate(()=>simulationSubmissionComplete()),true);
 }
 async function stays(){
  assert.equal(await page.evaluate(()=>worldCalls),0);
  assert.equal(await page.locator('#decisionMenu').isVisible(),true);
  assert.equal(await page.locator('#characterSelection').isVisible(),false);
  assert.equal(await page.evaluate(()=>currentCategory),'A');
 }
 await ready();console.log('Ready');await submit();await stays();console.log('Stayed');
 assert.match(await page.locator('.cs-world-ready').innerText(),/opcional/);
 const submittedCash=await page.evaluate(()=>cashBalance());
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#companyStartWorld').isVisible(),true);
 await page.screenshot({path:path.join(out,'summary-mobile.png'),fullPage:true});
 await page.locator('#companyStartWorld').click();await page.locator('#characterSelection').waitFor({state:'visible'});
 await page.locator('[data-character="miguel"]').click();await page.locator('#confirmCharacterBtn').click();await page.waitForFunction(()=>worldCalls===1);
 assert.equal(await page.evaluate(()=>cashBalance()),submittedCash,'entering must not charge decisions again');checks.push('local confirmation stays in summary; explicit click enters without charging');
 await page.setViewportSize({width:1366,height:900});await ready(true);await submit();await stays();
 assert.equal(await page.locator('#companyStartWorld').count(),0,'pending acknowledgement blocks world entry');
 console.log('Resolving sync');await page.evaluate(()=>{resolveSync(true);});console.log('Sync resolved');await page.locator('#companyStartWorld').waitFor({state:'visible'});await stays();checks.push('server confirmation stays in summary');
 await ready(true);await submit();await page.evaluate(()=>resolveSync(false));await page.locator('#retryCyclePlanSync').waitFor({state:'visible'});await stays();
 await page.evaluate(()=>{retryStudentSync=async()=>true;});await page.locator('#retryCyclePlanSync').click();await page.locator('#companyStartWorld').waitFor({state:'visible'});await stays();checks.push('retry acknowledgement stays in summary');
 await ready();
 await page.evaluate(()=>{for(const cat of decisionCategories()){currentCategory=cat.cat;persistCurrentDraftOnly();}});
 for(const cat of ['B','C','D','E','F'])assert.equal(await page.evaluate(cat=>commitReviewedSections([cat],false),cat),true,cat);
 await stays();assert.equal(await page.evaluate(()=>simulationSubmissionComplete()),true);assert.equal(await page.locator('#companyStartWorld').isVisible(),true);checks.push('last individual section stays in summary');
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'summary-desktop.png'),fullPage:true});
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({checks,errors},null,2));console.log('PASS: '+checks.join('; '));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
