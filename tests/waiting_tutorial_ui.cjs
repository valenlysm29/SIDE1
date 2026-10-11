const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {database,config,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'output');
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
(async()=>{
 const db=await database(),errors=[];
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  let data=fs.readFileSync(file);
  if(relative==='index.html')data=data.toString().replace(/<script src="https:[^"]+"><\/script>/g,'').replace(/<script src="js\/simulator3d(?:-config)?\.js[^\"]*"><\/script>/g,'').replace('<script src="js/app.js','<script>window.SIDE3D={preload:async()=>true,suspend:()=>{}};</script><script src="js/app.js');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const game=await createGame(db,config());
 await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:{},p_expected_round:null});
 const identity={p_codigo:game.codigo,p_nombre_legal:'Tutorial QA',p_nombre_comercial:'Tutorial QA'};
 const joined=await rpc(db,'ingresar_empresa',identity);assert.ok(joined.empresa_id);
 const p=await browser.newPage({viewport:{width:1366,height:900}});
 p.on('pageerror',error=>errors.push(error.message));
 await p.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await p.exposeFunction('dbState',()=>rpc(db,'obtener_estado_estudiante',identity));
 try{
  await p.goto(origin);await p.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
  await p.evaluate(async({game,joined})=>{
   SIDE.EmpresaService.obtenerEstado=async()=>({success:true,data:await dbState()});
   currentStudent={game,company:'Tutorial QA',legalName:'Tutorial QA',name:'Tutorial QA',empresaId:joined.empresa_id,participantId:joined.participante_id,snapshotRevision:0};
   studentConnected=true;loadDecisionState();await refreshStudentGame();await prepareLobby();
  },{game,joined});
  const mount=p.locator('#waitingTutorialMount'),current=()=>mount.locator('[id$="tutorialCurrent"]');
  await mount.locator('.tutorial-slide').first().waitFor();
  assert.equal(await mount.locator('.tutorial-slide').count(),6);
  assert.match(await p.locator('#integrationCountdown').innerText(),/0[45]:/);
  assert.equal((await p.locator('#waitingCountdown').innerText()).trim(),(await p.locator('#integrationCountdown').innerText()).trim());
  assert.equal(await p.locator('#enterDecisionsBtn').isDisabled(),true);
  for(const [width,height] of [[1366,900],[390,844],[320,568],[844,390],[667,375]]){
   await p.setViewportSize({width,height});
   for(let slide=0;slide<6;slide++){
    await mount.locator('.tutorial-dot').nth(slide).click();
    const diagnostics=await p.evaluate(()=>{
     const viewport={width:innerWidth,height:innerHeight},slide=document.querySelector('#waitingTutorialMount .tutorial-slide.active');
     const overflow=[document.documentElement,document.body,document.querySelector('#studentWaiting'),document.querySelector('#waitingTutorialMount')].filter(Boolean).filter(el=>{const style=getComputedStyle(el);return (el.scrollHeight>el.clientHeight+1&&!/hidden|clip/.test(style.overflowY))||(el.scrollWidth>el.clientWidth+1&&!/hidden|clip/.test(style.overflowX));}).map(el=>({id:el.id||el.tagName,scroll:[el.scrollWidth,el.scrollHeight],client:[el.clientWidth,el.clientHeight]}));
     const clipped=[];
     const textNodes=[...slide.querySelectorAll('h1,h2,h3,p,li,small,strong,span'),...document.querySelectorAll('#studentWaiting .waiting-header h1,#studentWaiting .waiting-header p,#studentWaiting .waiting-header span,#studentWaiting .waiting-header strong,#studentWaiting .waiting-header small,#studentWaiting .waiting-footer p,#studentWaiting .waiting-footer button,#studentWaiting .tutorial-counter')];
     for(const el of textNodes){
      if(!el.textContent.trim()||getComputedStyle(el).display==='none'||!el.getClientRects().length)continue;
      const range=document.createRange();range.selectNodeContents(el);
      for(const r of range.getClientRects()){
       if(r.width<1||r.height<1)continue;
       if(r.left<-.5||r.top<-.5||r.right>viewport.width+.5||r.bottom>viewport.height+.5){clipped.push(el.textContent.trim().slice(0,80));break;}
       for(let ancestor=el.parentElement;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){
        const style=getComputedStyle(ancestor),bounds=ancestor.getBoundingClientRect();
        if(/hidden|clip|auto|scroll/.test(style.overflowY)&& (r.top<bounds.top-.5||r.bottom>bounds.bottom+.5)){clipped.push(el.textContent.trim().slice(0,80));break;}
       }
      }
     }
     return {overflow,clipped:[...new Set(clipped)]};
    });
    if(diagnostics.overflow.length||diagnostics.clipped.length){await p.screenshot({path:path.join(output,`waiting-tutorial-failure-${width}x${height}-${slide+1}.png`)});console.log(await p.evaluate(()=>({media:matchMedia('(max-width:700px)').matches,elements:['#studentWaiting','.student-waiting-content','.waiting-header','#waitingTutorialMount','.tutorial-shell','.tutorial-viewport','.tutorial-slide'].map(selector=>{const el=document.querySelector(selector),s=getComputedStyle(el);return {selector,width:s.width,minWidth:s.minWidth,position:s.position,transform:s.transform,rect:el.getBoundingClientRect().toJSON()}})})));}
    assert.deepEqual(diagnostics,{overflow:[],clipped:[]},`${width}x${height} slide ${slide+1}: ${JSON.stringify(diagnostics)}`);
    if(slide===0||slide===2)await p.screenshot({path:path.join(output,`waiting-tutorial-${width}x${height}-${slide+1}.png`)});
   }
  }
  await p.setViewportSize({width:1366,height:900});
  await p.clock.install();
  await mount.locator('.tutorial-dot').first().click();
  await p.clock.fastForward(6999);assert.equal(await current().innerText(),'1');
  await p.clock.fastForward(1);assert.equal(await current().innerText(),'2','automatic advancement occurs at 7 seconds');
  await mount.locator('[id$="tutorialPrev"]').click();assert.equal(await current().innerText(),'1');
  await mount.locator('[id$="tutorialPrev"]').click();assert.equal(await current().innerText(),'6','waiting tutorial loops backwards');
  await p.clock.fastForward(7000);assert.equal(await current().innerText(),'1','waiting tutorial loops automatically');
  await p.evaluate(()=>{const old=Date.now;Date.now=()=>old()+5*3600000;updateIntegrationUI();});
  assert.match(await p.locator('#integrationCountdown').innerText(),/0[45]:/,'server anchor ignores incorrect local wall clock');
  await p.evaluate(()=>openStudentTutorial());
  await p.locator('#tutorialMount .tutorial-slide').first().waitFor();
  const duplicateIds=await p.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];});
  assert.deepEqual(duplicateIds,[],'embedded and standalone tutorial IDs must be unique');
  const waitingIndex=await current().innerText();await p.keyboard.press('ArrowRight');
  assert.equal(await current().innerText(),waitingIndex,'keyboard does not move hidden waiting tutorial');
  assert.equal(await p.locator('#tutorialMount [id$="tutorialCurrent"]').innerText(),'2','keyboard controls visible standalone tutorial');
  await p.evaluate(()=>showScreen('studentLobby'));
  await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 second')) where id=$1`,[game.id]);
  await p.evaluate(()=>refreshStudentGame());
  assert.equal(await p.locator('#decisionMenu').isVisible(),true,'authoritative deadline opens decisions');
  assert.equal(await p.locator('#studentWaiting').isVisible(),false);
  const stoppedIndex=await current().innerText(),standaloneIndex=await p.locator('#tutorialMount [id$="tutorialCurrent"]').innerText();await p.clock.fastForward(21000);await p.keyboard.press('ArrowRight');
  assert.equal(await current().innerText(),stoppedIndex,'hidden tutorial timer and keyboard are cleaned up');
  assert.equal(await p.locator('#tutorialMount [id$="tutorialCurrent"]').innerText(),standaloneIndex,'standalone tutorial timer and keyboard are cleaned up');
  assert.deepEqual(errors,[]);
  console.log('PASS waiting tutorial: 7 seconds, controls, loop, server countdown, standalone IDs, cleanup, 30 responsive slide checks and automatic decision entry');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
