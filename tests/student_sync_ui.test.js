/* Delivered student page in isolated Chromium; no real accounts or remote writes. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const python=process.env.PYTHON_BIN||'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const baseHTML=execFileSync(python,['-c',"import sys;sys.path.insert(0,'tests');from browser_fixture import document;print(document('index.html'))"],{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}}).replace(/<script>\s*const fixtureData=[\s\S]*?<\/script>/,'');
const mock=`
window.calls=[];
const empty={decision_state:{},cash_ledger:{},financial_sections:{},section_submissions:{},decisions_submitted:false,selected_character:null};
window.server=JSON.parse(localStorage.getItem('TEST_SERVER')||'null')||{revision:0,snapshot:empty};
const storeServer=()=>localStorage.setItem('TEST_SERVER',JSON.stringify(server));
const state=()=>({partida:{id:'test-game',codigo:'SIDE-418',nombre:'Prueba',estado:'activa',configuracion:{capital:100000,round:1,cycles:6}},empresa:{id:1,nombre_legal:'Legal A',nombre_comercial:'Marca A',caja_actual:100000,ciclo_actual:1},empresa_id:1,ciclo_partida:1,snapshot_revision:server.revision,snapshot:server.snapshot});
SIDE.EmpresaService.obtenerEstado=async()=>{
  calls.push({type:'read'});
  if(sessionStorage.TEST_READ_ERROR==='network')return {success:false,technical:true,code:'FETCH_ERROR',error:'Failed to fetch'};
  if(sessionStorage.TEST_READ_ERROR==='invalid')return {success:false,code:'CREDENCIALES_INVALIDAS',error:'Invalid identity'};
  return {success:true,data:JSON.parse(JSON.stringify(state()))};
};
SIDE.EmpresaService.guardarEstado=async(identity,snapshot,revision)=>{
  calls.push({type:'snapshot',identity,snapshot,revision});
  if(sessionStorage.TEST_WRITE_ERROR==='1')return {success:false,technical:true,code:'FETCH_ERROR',error:'Failed to fetch'};
  if(revision!==server.revision)return {success:false,code:'ESTADO_DESACTUALIZADO'};
  server.snapshot=snapshot;server.revision++;storeServer();
  if(sessionStorage.TEST_ACK_LOST==='1'){sessionStorage.TEST_ACK_LOST='0';return {success:false,technical:true,error:'Response lost'};}
  return {success:true,data:{snapshot_revision:server.revision}};
};
for(const [method,type] of [['guardar','decisions'],['guardarReporte','report']])SIDE.DecisionesService[method]=async(identity,round,payload,revision)=>{
  calls.push({type,identity,round,payload,revision});
  if(revision!==server.revision)return {success:false,code:'ESTADO_DESACTUALIZADO'};
  return {success:true};
};
SIDE.SupabaseClient.get=()=>({auth:{onAuthStateChange(){},signInWithPassword:async identity=>{calls.push({type:'auth',identity});return {error:{message:'Credenciales de prueba incorrectas'}};}}});
`;
test('student synchronization and session recovery through the delivered UI',async t=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const errors=[];
  async function page(seed={}){
    const context=await browser.newContext({viewport:{width:1366,height:900}}),p=await context.newPage();
    p.on('pageerror',error=>errors.push(error.message));
    await p.addInitScript(seed=>{for(const [key,value] of Object.entries(seed))if(sessionStorage.getItem(key)===null)sessionStorage.setItem(key,value);},seed);
    const html=baseHTML.replace('const cfg = window.SIDE_CONFIG || {};',mock+'\nconst cfg = window.SIDE_CONFIG || {};');
    await p.route('**/*',route=>route.abort());
    await p.route('http://side-sync.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
    await p.goto('http://side-sync.test/');return p;
  }
  const session=JSON.stringify({game:{id:'test-game',codigo:'SIDE-418'},company:'Marca A',legalName:'Legal A',empresaId:1,snapshotRevision:0});
  async function draft(p){
    await p.evaluate(async()=>{
      stopStudentSync();currentStudent={game:{id:'test-game',codigo:'SIDE-418'},company:'Marca A',legalName:'Legal A',empresaId:1,snapshotRevision:server.revision};
      studentConnected=true;studentProgressHydrated=true;persistStudentSession();await refreshStudentGame();stopStudentSync();
      currentCategory='D';openDecisionMenu();currentCategory='D';renderTabs();renderDecisionCategory();
    });
    await p.locator('[data-choice="CANALES"][data-option="web"]').check();
    await p.locator('#saveDecisionSection').click();
    await p.evaluate(()=>studentSnapshotQueue);
  }
  try{
    await t.test('saving a draft sends snapshot, report and normalized decisions with the acknowledged revision',async()=>{
      const p=await page();await draft(p);
      const calls=await p.evaluate(()=>window.calls.filter(c=>c.type!=='read'));
      assert.ok(calls.some(c=>c.type==='decisions'&&c.payload.some(d=>d.decision_id==='CANALES'&&d.opcion_id==='web')));
      assert.ok(calls.some(c=>c.type==='report'));
      assert.equal(calls.filter(c=>c.type==='snapshot').length,1);
      assert.ok(calls.filter(c=>c.type==='decisions'||c.type==='report').every(c=>c.revision===1));
      assert.equal(await p.locator('[data-student-sync-status]').last().textContent(),'');
      assert.equal(await p.locator('[data-student-sync-status]').last().isVisible(),false);
      // Simulate an older response arriving after a successful write.
      const stale=await p.evaluate(async()=>{
        SIDE.EmpresaService.obtenerEstado=async()=>({success:true,data:{...state(),snapshot_revision:0,snapshot:empty}});
        const refreshed=await refreshStudentGame();return {refreshed,revision:currentStudent.snapshotRevision,web:decisionState.CANALES.optionIds.includes('web')};
      });
      assert.deepEqual(stale,{refreshed:false,revision:1,web:true});
      await p.context().close();
    });
    await t.test('online retries failed writes before reading and does not erase the local draft',async()=>{
      const p=await page({TEST_WRITE_ERROR:'1'});await draft(p);
      assert.equal(await p.evaluate(()=>studentSyncPending()),true);
      assert.match(await p.locator('[data-student-sync-status]').last().innerText(),/pendiente/);
      await p.evaluate(()=>{sessionStorage.TEST_WRITE_ERROR='0';window.dispatchEvent(new Event('online'));});
      await p.waitForFunction(()=>!studentSyncPending());
      assert.equal(await p.evaluate(()=>decisionState.CANALES.optionIds.includes('web')),true);
      assert.equal(await p.evaluate(()=>calls.filter(c=>c.type==='decisions').length),1);
      assert.equal(await p.evaluate(()=>server.revision),1);
      await p.context().close();
    });
    await t.test('pending decisions/report survive a reload and recover the latest offline draft',async()=>{
      const p=await page({TEST_WRITE_ERROR:'1'});await draft(p);
      await p.reload();await p.waitForFunction(()=>studentSessionRecoveryTask===null);
      await p.evaluate(()=>stopStudentSync());
      assert.equal(await p.evaluate(()=>studentSyncPending()),true);
      assert.equal(await p.evaluate(()=>decisionState.CANALES.optionIds.includes('web')),true);
      await p.evaluate(()=>{sessionStorage.TEST_WRITE_ERROR='0';window.dispatchEvent(new Event('online'));});
      await p.waitForFunction(()=>!studentSyncPending());
      assert.equal(await p.evaluate(()=>calls.filter(c=>c.type==='decisions').length),1);
      assert.equal(await p.evaluate(()=>server.snapshot.decision_state.CANALES.optionIds.includes('web')),true);
      await p.context().close();
    });
    await t.test('a stale offline write preserves another session and hydrates the newer server state',async()=>{
      const p=await page({TEST_WRITE_ERROR:'1'});await draft(p);
      await p.evaluate(()=>{server.revision=9;server.snapshot={decision_state:{PRECIO:{round:1,value:77}},cash_ledger:{},financial_sections:{},section_submissions:{},decisions_submitted:false,selected_character:null};sessionStorage.TEST_WRITE_ERROR='0';window.dispatchEvent(new Event('online'));});
      await p.waitForFunction(()=>decisionState.PRECIO?.value===77);
      assert.equal(await p.evaluate(()=>server.revision),9);
      assert.equal(await p.evaluate(()=>studentSyncPending()),false);
      assert.equal(await p.evaluate(()=>calls.some(c=>c.type==='decisions')),false);
      await p.context().close();
    });
    await t.test('a lost save response still recovers normalized decisions without repeating the committed snapshot',async()=>{
      const p=await page({TEST_ACK_LOST:'1'});await draft(p);
      assert.equal(await p.evaluate(()=>studentSyncPending()),true);
      await p.evaluate(()=>window.dispatchEvent(new Event('online')));
      await p.waitForFunction(()=>!studentSyncPending());
      assert.equal(await p.evaluate(()=>server.revision),1);
      assert.equal(await p.evaluate(()=>calls.filter(c=>c.type==='decisions').length),1);
      assert.equal(await p.evaluate(()=>calls.filter(c=>c.type==='report').length),1);
      await p.context().close();
    });
    await t.test('network failure retains the session and retry button restores access without retyping identity',async()=>{
      const p=await page({SIDE_STUDENT_SESSION:session,TEST_READ_ERROR:'network'});
      await p.waitForFunction(()=>studentSessionRecoveryTask===null&&studentSessionRecovering);
      await p.evaluate(()=>stopStudentSync());
      assert.equal(await p.evaluate(()=>Boolean(sessionStorage.SIDE_STUDENT_SESSION)),true);
      assert.match(await p.locator('#studentMessage').innerText(),/sesión se conserva/);
      assert.equal(await p.locator('#studentReconnectBtn').isVisible(),true);
      assert.equal(await p.evaluate(()=>studentAccess().canOperate),false);
      await p.setViewportSize({width:390,height:844});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await p.evaluate(()=>{sessionStorage.TEST_READ_ERROR='';});await p.locator('#studentReconnectBtn').click();
      await p.waitForFunction(()=>!studentSessionRecovering&&studentAccess().canOperate);
      assert.equal(await p.locator('#studentModal').isVisible(),false);
      await p.context().close();
    });
    await t.test('an explicit identity rejection clears the session instead of retrying indefinitely',async()=>{
      const p=await page({SIDE_STUDENT_SESSION:session,TEST_READ_ERROR:'invalid'});
      await p.waitForFunction(()=>!studentConnected&&studentSessionRecoveryTask===null);
      assert.equal(await p.evaluate(()=>Boolean(sessionStorage.SIDE_STUDENT_SESSION)),false);
      assert.equal(await p.locator('#studentReconnectBtn').isVisible(),false);
      assert.match(await p.locator('#studentMessage').innerText(),/validar el ingreso/);
      await p.context().close();
    });
    await t.test('online automatically restores a session retained after a network failure',async()=>{
      const p=await page({SIDE_STUDENT_SESSION:session,TEST_READ_ERROR:'network'});
      await p.waitForFunction(()=>studentSessionRecoveryTask===null&&studentSessionRecovering);
      await p.evaluate(()=>{stopStudentSync();sessionStorage.TEST_READ_ERROR='';window.dispatchEvent(new Event('online'));});
      await p.waitForFunction(()=>!studentSessionRecovering&&studentAccess().canOperate);
      assert.equal(await p.evaluate(()=>Boolean(sessionStorage.SIDE_STUDENT_SESSION)),true);
      assert.equal(await p.locator('#studentModal').isVisible(),false);
      await p.context().close();
    });
    await t.test('configured teacher demo credentials use Supabase Auth and stay on login if rejected',async()=>{
      const p=await page();
      await p.evaluate(()=>{$('loginEmail').value=DEMO_TEACHER.email;$('loginPassword').value=DEMO_TEACHER.password;$('loginForm').requestSubmit();});
      await p.waitForFunction(()=>calls.some(c=>c.type==='auth'));
      assert.match(p.url(),/side-sync.test/);assert.match(await p.locator('#loginMessage').innerText(),/incorrectas/);
      await p.context().close();
    });
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
