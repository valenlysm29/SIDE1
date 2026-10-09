'use strict';
// Visual DOM regression. Run alone; full WebGL flow is covered by gameplay_hud.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tests/output/mejora-integral-2026-10-01/fase2/movil');
const tmp=path.join(root,'.codex-work/mejora-side-2026-10-01/tmp');fs.mkdirSync(tmp,{recursive:true});
const env={...process.env,TEMP:tmp,TMP:tmp,TMPDIR:tmp,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};
const html=name=>execFileSync(process.env.PYTHON_BIN||'python',['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{cwd:root,env,encoding:'utf8',maxBuffer:100*1024*1024}).replace('const cfg = window.SIDE_CONFIG || {};','window.SIDE_CONFIG={};const cfg = window.SIDE_CONFIG || {};');
const sizes=[[360,800],[390,844],[768,1024],[800,360],[844,390],[1024,768]];
(async()=>{
 fs.mkdirSync(out,{recursive:true});const student=html('index.html'),teacher=html('docente.html'),tutorial=html('tutorial.html'),checks=[],errors=[];
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,env});
 const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({fixture:'DOM real y datos locales explícitos de prueba; sin inicializar WebGL ni Supabase',passed:false,checks,errors},null,2));
 try{
  for(const [width,height] of sizes){
   let page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,locale:'es-PE',reducedMotion:'reduce'});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.abort());
   let touchSession=await page.context().newCDPSession(page);
   const touchMedia=()=>touchSession.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
   const capture=async(name,scope)=>{
    await touchMedia();
    const layout=await page.evaluate(scope=>{
     const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
     const targets=[...document.querySelectorAll(scope+' button,'+scope+' input,'+scope+' select,'+scope+' summary')].filter(visible).filter(e=>!e.disabled);
     const hit=e=>e.matches('input[type=radio],input[type=checkbox]')?(e.closest('label')||e):e;
     return {documentWidth:document.documentElement.scrollWidth,smallTargets:targets.filter(e=>{const r=hit(e).getBoundingClientRect();return r.height<43.9||r.width<43.9}).map(e=>({id:e.id,text:e.textContent.trim().slice(0,60),height:hit(e).getBoundingClientRect().height,width:hit(e).getBoundingClientRect().width})),targetCount:targets.length};
    },scope);
    checks.push({name,width,height,...layout});save();
    assert.ok(layout.documentWidth<=width+1,`${name} ${width} overflow:${layout.documentWidth}`);
    assert.deepEqual(layout.smallTargets,[],`${name} ${width}: targets under44`);
    await page.screenshot({path:path.join(out,`${name}-${width}x${height}.png`),fullPage:name!=='hud'});
   };
   await page.setContent(student,{waitUntil:'load'});
   for(const id of ['landing','profiles']){await page.evaluate(id=>{closeModal();showScreen(id)},id);await capture(id,'#'+id)}
   for(const id of ['studentModal','teacherLoginModal','teacherRegisterModal']){await page.evaluate(id=>{showScreen('profiles');showModal(id)},id);await capture('login-'+id,'#'+id)}
   await page.evaluate(tutorial=>{closeModal();showScreen('tutorial');document.querySelector('#tutorialMount').innerHTML=tutorial;window.initSIDETutorial(()=>{})},tutorial);await capture('tutorial','#tutorial');
   await page.evaluate(()=>{closeModal();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));window.SIDE3D.preload=async()=>true;currentStudent={name:'Estudiante QA',company:'Empresa QA',game:DEMO_GAME};return prepareLobby()});await capture('lobby','#studentLobby');
   await page.evaluate(()=>{const mount=document.querySelector('#studentFinancialDetail');mount.innerHTML=window.SIDE_STUDENT_FINANCIAL_VIEW.officeHtml(financialReport());mount.scrollIntoView()});await capture('oficina-finanzas','#studentLobby');
   await page.evaluate(()=>openDecisionMenu());
   for(const cat of await page.evaluate(()=>navigationCategories().map(c=>c.cat))){await page.evaluate(cat=>{currentCategory=cat;renderDecisionCategory()},cat);await capture('tablet-'+cat,'#decisionMenu')}
   await page.evaluate(()=>{
    Object.assign(decisionDrafts,{MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['sjl'],quantities:{sjl:2}},INV_MARKETING:{optionIds:['mkt_baja']}});
    commitReviewedSections(decisionCategories().map(c=>c.cat),true);showScreen('simulator3d');document.querySelector('#sim3dStart').classList.add('hidden');
    document.querySelector('#simHubOrder').hidden=false;document.querySelector('#simHubOrder').textContent='Pedido de prueba:12 unidades en camino';
    document.querySelector('#simCash').textContent='S/ 1,234,567.89';document.querySelector('#simNetProfit').textContent='−S/ 1,234,567.89';
    document.querySelector('#simMissionList').innerHTML='<div><span>1</span><p><b>Revisar el stock de la empresa</b><small>Visita el almacén para comprobar las existencias.</small></p></div>';
   });
   await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'),null,{timeout:5000});
   await touchMedia();
   const boxes=await page.evaluate(()=>{
    const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    return {stats:box('.sim3d-stats'),location:box('.sim-world-location'),missions:box('.sim3d-missions'),profit:box('#simNetProfit'),stock:box('#simTotalStock'),rating:box('#simRating'),order:box('#simHubOrder')};
   });
   const touch=await page.evaluate(()=>({coarse:matchMedia('(pointer:coarse)').matches,buttons:[...document.querySelectorAll('.sim3d-touch-controls button')].map(e=>({label:e.textContent,visible:e.getClientRects().length>0,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),overlap:(()=>{const nodes=[...document.querySelectorAll('.sim3d-touch-controls button,.sim3d-actionbar button,#simCityMapToggle,#simMissionToggle')].filter(e=>e.getClientRects().length);const pairs=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)pairs.push([nodes[i].id||nodes[i].textContent,nodes[j].id||nodes[j].textContent])}return pairs})()}));
   checks.push({name:'hud-layout',width,height,boxes,touch});save();assert.equal(touch.coarse,true);assert.ok(touch.buttons.every(b=>b.visible&&b.width>=44&&b.height>=44));assert.deepEqual(touch.overlap,[],`${width}:touch targets overlap`);
   for(const key of ['profit','stock','rating','order','missions'])assert.ok(boxes[key].width&&boxes[key].height,`${width}: ${key} visible`);
   assert.ok(boxes.location.right<=boxes.stats.left,`${width}: navigation overlaps financial HUD`);
   assert.ok(boxes.missions.top>=boxes.stats.bottom,`${width}: missions overlap financial HUD`);
   await capture('hud','#simulator3d');await page.close();
   page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,locale:'es-PE',reducedMotion:'reduce'});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());await page.setContent(teacher,{waitUntil:'load'});
   touchSession=await page.context().newCDPSession(page);
   await page.evaluate(()=>{clearInterval(teacherPoll);clearInterval(companiesPoll);loadReports=async()=>{};localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));state.reports=[{id:'qa',empresa:'Empresa de prueba con nombre comercial completo',nombre:'Estudiante de prueba',conectada:true,ronda:1,progreso:50,caja:100000,ingresos:0,costos:0,utilidad:0,estado:'activa'}]});
   for(const tab of ['configuracion','rondas','empresas','resultados','podio','historial']){
    await page.evaluate(tab=>{switchTab(tab);if(tab==='empresas')renderCompanies();if(tab==='resultados')renderResults();if(tab==='podio')renderPodium();if(tab==='historial')document.querySelector('#historyContent').innerHTML=SIDE_TEACHER_HISTORY.snapshotHtml({partida:{codigo:'QA',curso:'Prueba aislada',ciclos_jugados:1},empresas:[{id:'qa',nombre_comercial:'Empresa de prueba con nombre comercial completo',decisiones:[],reportes:[]}]},'qa',SIDE_DECISION_CATALOG)},tab);
    assert.equal(await page.locator('.tab-panel.active').getAttribute('id'),'tab-'+tab);
    await capture('profesor-'+tab,'#tab-'+tab);
   }
   await page.close();console.log(`PASS mobile panels ${width}x${height}`);
  }
  assert.deepEqual(errors,[]);save();const result=JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8'));result.passed=true;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log(`PASS mobile:6viewports,${checks.filter(c=>c.name!=='hud-layout').length} captures,no overflow,44px targets,HUD separation`);
 }catch(error){save();throw error}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
