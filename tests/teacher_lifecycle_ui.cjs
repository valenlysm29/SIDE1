const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output');
fs.mkdirSync(out,{recursive:true});
function fixture(name){
  return execFileSync(process.env.PYTHON_BIN||'python',['-c',`import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('${name}'))`],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
 await page.clock.install();
 await page.clock.pauseAt(new Date(Date.now()+1000)); // El tiempo sólo avanza con fastForward.
 // Local controls are seeded explicitly; creation without a server must fail visibly.
 const teacher=fixture('docente.html').replace('<script>const cfg=','<script>window.SIDE_CONFIG={};const cfg='),student=fixture('index.html');
 await page.setContent(teacher,{waitUntil:'load'});
 assert.equal(await page.locator('#startGame').innerText(),'Iniciar partida');
 assert.equal(await page.locator('[data-tab="rondas"]').isVisible(),false);
 await page.locator('#cycles').fill('3');
 await page.locator('#integrationDurationMinutes').fill('3');
 assert.equal(await page.locator('#configCycleCount').innerText(),'1 / 3');
 assert.equal(await page.locator('#roundDisplay').innerText(),'1 / 3');
 assert.equal(await page.evaluate(()=>runtime()?.running||false),false);
 await page.evaluate(async()=>{
   window.SIDE.SupabaseClient.isReady=()=>true;
   window.SIDE.PartidaService.crear=async()=>({success:false,error:'Sin conexión de prueba'});
   await startGame();
 });
 assert.equal(await page.evaluate(()=>Boolean(gameStatus()?.active)),false);
 assert.equal(await page.evaluate(()=>runtime()?.running||false),false);
 await page.evaluate(()=>{window.SIDE.SupabaseClient.isReady=()=>false;});
 await page.locator('#openEventPicker').click();
 await page.locator('.event-enable').first().check();await page.locator('#closeEventPicker').click();
 assert.match(await page.locator('#enabledEventsSummary').innerText(),/1 habilitados/);
 await page.locator('#startGame').click();
 assert.equal(await page.locator('#creationFeedback').getAttribute('data-tone'),'error');
 assert.equal(await page.evaluate(()=>Boolean(gameStatus()?.active)),false);
 // Seed the legacy local fixture to keep testing controls and podium independently.
 await page.evaluate(()=>{
  const c=getConfig(),now=Date.now();
  c.gameStartAt=new Date(now+c.integrationDurationMinutes*60000).toISOString();c.integrationStartTime=new Date(now).toISOString();
  c.runtime={round:1,phase:'integration',status:'waiting',running:false,duration:roundSeconds(),remaining:roundSeconds(),mode:cycleMode()};
  applyTeacherState({configuracion:c,estado:'esperando'});watchTeacherGame();startLiveCompanies();switchTab('rondas');
 });
 assert.equal(await page.locator('[data-tab="rondas"]').isVisible(),true);
 assert.equal(await page.evaluate(()=>runtime().duration),600);
 assert.equal(await page.evaluate(()=>runtime().phase),'integration');
 assert.equal(await page.locator('#advanceRound').isDisabled(),true);
 assert.equal(await page.locator('#startGame').isDisabled(),true);
 const wait=await page.evaluate(()=>({duration:Date.parse(state.authoritative.gameStartAt)-Date.parse(state.authoritative.integrationStartTime),seconds:state.seconds,deadline:state.authoritative.gameStartAt}));
 assert.equal(wait.duration,180000);
 assert.equal(wait.seconds,180);
 assert.match(await page.locator('#gameStatusBanner').innerText(),/00:03:00/);
 await page.clock.fastForward(180000);
 await page.evaluate(()=>refreshTeacherGame());
 assert.equal(await page.evaluate(()=>runtime().phase),'decisions');
 assert.equal(await page.evaluate(()=>state.authoritative.gameStartAt),wait.deadline);
 assert.equal(await page.locator('#advanceRound').isDisabled(),false);

 await page.evaluate(()=>{const reports=[{partida:$('gameCode').value,empresa:'Empresa A',nombre:'Ana',score:50,conectada:true,updatedAt:new Date().toISOString()}];localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));window.dispatchEvent(new StorageEvent('storage',{key:'SIDE_STUDENT_REPORTS'}));});
 await page.waitForFunction(()=>document.querySelector('#companiesGrid').textContent.includes('Empresa A'));
 await page.clock.fastForward(600000);
 await page.evaluate(()=>controlGame('avanzar'));
 assert.equal(await page.evaluate(()=>state.round),2);
 assert.equal(await page.evaluate(()=>runtime().duration),600);
 assert.equal(await page.locator('#advanceRound').isDisabled(),false);
 await page.evaluate(()=>{switchTab('podio');const report=state.reports.find(r=>r.empresa==='Empresa A');saveCompanyGrade(report.id,18);});
 await page.waitForFunction(()=>document.querySelector('#podiumPreview')?.textContent.includes('Empresa A'));
 await page.locator('#publishPodium').click();
 assert.equal(await page.locator('#podiumDialog').isVisible(),true,'publication requires reviewing and confirming the dialog');
 assert.equal(await page.evaluate(()=>publishedPodium()),null,'opening the dialog does not publish');
 await page.evaluate(()=>{
   state.partidaId='test-game-id';
   window.__podiumFixture=null;window.__podiumCalls=[];
   window.SIDE.PartidaService.podio=async(id,action='consultar')=>{
     window.__podiumCalls.push({id,action});
     if(action==='publicar')window.__podiumFixture={code:$('gameCode').value,publishedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),visible:true,scheduled:false,podium:podiumCandidates(),gradeSignature:gradeSignature()};
     return {success:true,data:{publication:window.__podiumFixture,serverTime:new Date().toISOString()}};
   };
 });
 await page.locator('#confirmPodiumPublish').click();
 await page.waitForFunction(()=>!document.querySelector('#podiumDialog').open);
 assert.match(await page.locator('#podiumState').innerText(),/24 horas/i);
 assert.equal(await page.evaluate(()=>window.__podiumCalls.filter(c=>c.action==='publicar').length),1,'confirmation publishes once through the service');
 await page.evaluate(async()=>{window.__podiumFixture={...window.__podiumFixture,publishedAt:new Date(Date.now()-86400000).toISOString(),expiresAt:new Date(Date.now()-1000).toISOString(),visible:false};await loadPublished();});
 assert.equal(await page.locator('#podiumPreview .podium-place').count(),1,'expiry hides the publication, not the teacher grade preview');
 assert.match(await page.locator('#podiumState').innerText(),/vencida/i);
 await page.evaluate(async()=>{
   state.partidaId='test-game-id';
   window.SIDE.PartidaService.finalizar=async()=>({success:true});
   window.SIDE.SupabaseClient.isReady=()=>true;
   finishSupabasePartida();await finishingPartida;
 });
 assert.equal(await page.evaluate(()=>state.partidaId),'test-game-id');
 console.log('PASS teacher setup, admission cycle, live roster, cycle advance and 24-hour podium');
 await page.goto('about:blank');
 await page.setContent(student,{waitUntil:'load'});
 await page.evaluate(async()=>{currentStudent.returning=true;await prepareLobby();});
 assert.equal(await page.locator('#studentLobby').isVisible(),true);
 assert.equal(await page.locator('#tutorial').isVisible(),false);
 await page.evaluate(()=>{
   localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:9,running:true}));
   applyStudentGameState({codigo:'SIDE-REMOTE',estado:'esperando',configuracion:{integrationMinutes:60,gameStartedAt:new Date().toISOString(),eventSchedule:{2:{group:['test-event']}},runtime:{round:1,running:true,duration:3600,startedAt:new Date().toISOString()}}});
 });
 assert.equal(await page.evaluate(()=>currentRound()),1);
 assert.equal(await page.evaluate(()=>studentAccess().canOperate),false);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('SIDE_EVENT_SCHEDULE'))),{2:{group:['test-event']}});
 await page.evaluate(()=>{
   const start=new Date(Date.now()-3600000).toISOString();
   applyStudentGameState({estado:'esperando',configuracion:{integrationMinutes:60,cycles:3,roundHours:0,roundMinutes:10,cycleCloseMode:'automatic',scheduledStart:start,gameStartedAt:start,runtime:{round:1,running:true,duration:3600,startedAt:start}}});
   syncStudentTimer();
 });
 assert.equal(await page.evaluate(()=>currentRound()),2);
 assert.equal(await page.locator('#studentRoundTimer').textContent(),'00:10:00');
 assert.equal(await page.evaluate(()=>studentAccess().canOperate),true);
 await page.evaluate(()=>{currentStudent.returning=false;localStorage.setItem('SIDE_TUTORIAL_SEEN_'+storageKey().trim().toUpperCase(),'1');});
 await page.evaluate(()=>prepareLobby());assert.equal(await page.locator('#studentLobby').isVisible(),true);
 await page.evaluate(()=>{localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({integrationMinutes:60,gameStartedAt:new Date(Date.now()-3600000).toISOString(),cycles:3}));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:new Date(Date.now()-3600000).toISOString()}));localStorage.setItem('SIDE_ACTIVE_ROUND','1');openDecisionMenu();});
 assert.equal(await page.locator('#decisionMenu').isVisible(),false);
 await page.evaluate(()=>{localStorage.setItem('SIDE_ACTIVE_ROUND','2');localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:2,duration:600,remaining:600,running:true,startedAt:new Date().toISOString()}));openDecisionMenu();});
 assert.equal(await page.locator('#decisionMenu').isVisible(),true);
 for(const [width,height] of [[1366,768],[1024,768],[390,844],[320,568],[844,390]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>{currentCategory='C';renderDecisionCategory();window.scrollTo(0,900);});
   await page.waitForTimeout(120);
   const layout=await page.evaluate(()=>({top:$('decisionTopbar').getBoundingClientRect().top,height:$('decisionTopbar').offsetHeight,wide:document.documentElement.scrollWidth>innerWidth,items:['cashBalance','decisionRoundTimer','decisionProgressText'].map(id=>{const r=$(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width>0;})}));
   assert.ok(Math.abs(layout.top)<2,`fixed top ${width}: ${JSON.stringify(layout)}`);
   assert.ok(layout.height<height*.5,`compact bar ${width}`);
   assert.equal(layout.wide,false,`overflow ${width}`);assert.ok(layout.items.every(Boolean),`visible status ${width}`);
   if(width===1366||width===390)await page.screenshot({path:path.join(out,`teacher-lifecycle-student-${width}.png`)});
 }
 console.log('PASS reentry without tutorial, integration lock and sticky student status at five viewports');
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
