const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 page.on('requestfailed',r=>console.log('REQUESTFAILED',r.url(),r.failure().errorText));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await page.goto('http://127.0.0.1:8771/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));
  currentStudent={name:'QA',company:'QA MUNDO',game:DEMO_GAME};openDecisionMenu();
  Object.assign(decisionDrafts,{MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:1}},INV_MARKETING:{optionIds:['mkt_baja']}});
  renderDecisionCategory();openCompanyReview();
 });
 console.log('BEFORE',await page.evaluate(()=>({problems:reviewProblems(liveCompanyReview()),pct:decisionProgressPercent()})));
 await page.locator('#confirmCompanyReview').click();
 console.log('AFTER',await page.evaluate(()=>({pct:decisionProgressPercent(),submitted:decisionsSubmitted(),incomplete:requiredDecisionItems().filter(i=>!itemComplete(i)).map(i=>[i.id,savedEntry(i)]),launchHidden:$('simulationLaunch').className,btn:$('startSimulationBtn').className})));
 if(await page.locator('#startSimulationBtn').isVisible())await page.locator('#startSimulationBtn').click();
 await page.waitForTimeout(15000);
 console.log('END',await page.evaluate(()=>({screen:screens.filter(id=>!$(id).classList.contains('hidden')),stage:$('simulationLoadingStage').textContent,toast:$('toast').textContent,engine:typeof SIDE3D})));
 await page.screenshot({path:'tests/output/start-baseline.png',fullPage:false});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
