'use strict';
// Run through run_world_regression.cjs: ephemeral origin, isolated local storage, no Supabase.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.SIDE_TEST_URL||'http://127.0.0.1:8772/';
const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8');
const instrumented=source.replace('  window.SIDE3D = {',`  window.tabletQA={
  freeze(){cancelAnimationFrame(raf);},
  open(origin){keys.KeyW=true;if(origin==='news'){positionPlayer(HUB_OFFSET+19,30.1);openNewsPanel();}if(origin==='office'){const room=businessInteriors.rooms.find(room=>room.id==='office');businessInteriors.ensureRoom(room);positionPlayer(HUB_OFFSET+room.layout.x,room.layout.z-2);updateBusinessZone();openAdmin('finance');}if(origin==='office')openDecisionsFrom3D('B');else $3('sim3dDecisionsBtn').click();},
  motion(){const before={x:player.x,z:player.z};keys.KeyW=true;for(let i=0;i<15;i++)updatePlayer(1/60);keys={};return Math.hypot(player.x-before.x,player.z-before.z);},
  snapshot(){return {running,keys:{...keys},adminOpen,newsOpen,checkoutOpen,productInspectOpen,hubDirectoryOpen,cameraMode,interior:currentInterior,focus:document.activeElement?.id,cycle:currentRoundSafe(),time:gameSession.timeLeft};}
};\n  window.SIDE3D = {`);
const seed={MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['miraflores'],quantities:{miraflores:1}},INV_MARKETING:{optionIds:['mkt_baja']}};
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>!r.request().url().startsWith(url)?r.abort():/\/js\/simulator3d\.js(?:\?|$)/.test(r.request().url())?r.fulfill({contentType:'application/javascript',body:instrumented}):r.continue());
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(seed=>{localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA TABLET',company:'QA TABLET',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);commitReviewedSections(decisionCategories().map(c=>c.cat),true);},seed);
    assert.equal(await page.evaluate(()=>startSimulationLoading()),true);await page.evaluate(()=>tabletQA.freeze());
    await page.evaluate(()=>{window.tabletReturns=0;const original=SIDE3D.returnFromDecisions;SIDE3D.returnFromDecisions=function(){tabletReturns++;return original.apply(this,arguments)};});
    const stable=()=>page.evaluate(()=>({decisions:JSON.stringify(decisionState),ledger:JSON.stringify(cashLedger),cycle:currentRound(),submitted:simulationSubmissionComplete()}));
    const before=await stable();
    let exits=0;
    for(const origin of ['button','news','office']){
      for(let i=0;i<20;i++){
        await page.evaluate(origin=>tabletQA.open(origin),origin);
        assert.equal(await page.locator('#decisionMenu').isVisible(),true);
        assert.equal(await page.locator('#exitDecisions').getAttribute('aria-label'),'Volver al mundo');
        // A test-only editor exercises Escape while an input owns keyboard focus.
        await page.evaluate(()=>{const input=document.createElement('input');input.id='tabletFocusQA';$('decisionMenu').append(input);input.focus();});
        if(i===0&&origin==='button'){
          const output=path.join(__dirname,'output/tablet-return');fs.mkdirSync(output,{recursive:true});
          await page.screenshot({path:path.join(output,'tablet-volver-al-mundo.png'),fullPage:true});
          for(const width of [390,320]){
            await page.setViewportSize({width,height:844});
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`tablet return button fits ${width}px`);
            assert.equal(await page.locator('#decisionReturnLabel').isVisible(),true);
          }
          await page.setViewportSize({width:1366,height:900});
        }
        if(i%2)await page.keyboard.press('Escape');else await page.locator('#exitDecisions').click();
        await page.waitForFunction(()=>document.activeElement?.id==='side3dCanvas'&&SIDE3D.diagnostics().running);
        await page.evaluate(()=>$('tabletFocusQA')?.remove());
        await page.evaluate(()=>tabletQA.freeze());
        const state=await page.evaluate(()=>tabletQA.snapshot());
        assert.equal(state.running,true);assert.equal(state.focus,'side3dCanvas');
        if(origin==='office')assert.equal(state.interior,'office','tablet returns to the physical office');
        assert.ok(Object.values(state.keys).every(value=>!value),'no held key leaks from the tablet');
        for(const key of ['adminOpen','newsOpen','checkoutOpen','productInspectOpen','hubDirectoryOpen'])assert.equal(state[key],false,key);
        assert.equal(await page.evaluate(()=>tabletReturns),++exits,'one return callback per exit');assert.deepEqual(await stable(),before);
      }
      console.log(`PASS 20 consecutive tablet exits from ${origin}: focus, keys, overlays, decisions and cycle`);
    }
    // These are the real keyboard and camera listeners, with deterministic movement integration.
    const camera=await page.evaluate(()=>tabletQA.snapshot().cameraMode);await page.keyboard.press('v');assert.notEqual(await page.evaluate(()=>tabletQA.snapshot().cameraMode),camera);
    assert.ok(await page.evaluate(()=>tabletQA.motion())>.05,'WASD moves after repeated tablet returns');
    assert.deepEqual(errors,[]);console.log('PASS camera and WASD restored without browser errors');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
