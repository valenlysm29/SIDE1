"""Delivered teacher DOM with isolated storage/RPC doubles; never contacts Supabase.

Run from SIDE1 with the bundled Python 3.12 runtime and
PYTHONPATH=tests/.python-deps, PYTHONDONTWRITEBYTECODE=1.
The independent SQL regression covers actual persistence/business rules.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect
import browser_fixture as fixture

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/teacher-finance-config-20261023'
OUT.mkdir(parents=True,exist_ok=True)
checks=[]

def ok(label, condition=True):
    assert condition,label
    checks.append(label)
    print('PASS',label,flush=True)

def storage(page):
    return page.evaluate("Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).map(k=>[k,localStorage.getItem(k)]))")

def install_service(page, room=None):
    page.evaluate("""room => {
      window.testRoom=room;window.testCalls=[];window.testFail=false;window.testOldServer=false;
      window.SIDE.SupabaseClient.isReady=()=>true;
      loadReports=async()=>{};startLiveCompanies=()=>{};
      const response=()=>({success:true,data:structuredClone(testRoom)});
      Object.assign(SIDE.PartidaService,{
        obtenerActiva:async()=>testRoom?response():{success:true,data:null},
        crear:async input=>{const now=new Date().toISOString();testCalls.push(['crear',input]);
          testRoom={id:'qa-game',codigo:'745612',estado:'esperando',serverTime:now,
            configuracion:{...input.configuracion,codigo:'745612',gameStartedAt:now,
              gameStartAt:new Date(Date.now()+60000).toISOString(),runtime:{round:1,phase:'integration',status:'waiting',running:false,duration:600,remaining:600}}};return response();},
        actualizarConfiguracion:async(id,config)=>{testCalls.push(['guardar',id,structuredClone(config)]);
          if(testFail)return {success:false,error:'Fallo de conexión de prueba'};
          if(testOldServer){const old=response();delete old.data.configuracion.financialSchedule;return old;}
          testRoom.configuracion={...testRoom.configuracion,...structuredClone(config)};return response();},
        controlar:async()=>response()
      });
      clearInterval(teacherPoll);clearInterval(teacherTick);clearInterval(companiesPoll);
    }""",room)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH',r'C:\Program Files\Google\Chrome\Application\chrome.exe'))
    context=browser.new_context(viewport={'width':1440,'height':960},locale='es-PE',timezone_id='America/Lima')
    context.route('**/*',lambda route:route.abort())
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    seed={'nombre':'Finanzas QA','curso':'UPCH','capital':100000,'interest':20,'cycles':3,
          'roundHours':0,'roundMinutes':10,'cycleCloseMode':'manual','integrationDurationMinutes':1,'enabledEvents':[]}
    fixture.load(page,'docente.html',{'SIDE_TEACHER_CONFIG':json.dumps(seed)})
    page.wait_for_load_state('networkidle')
    expect(page.locator('#interest')).to_be_enabled()
    expect(page.locator('#capital')).to_be_enabled()
    page.locator('#interest').fill('18')
    page.locator('#capital').fill('110000')
    page.locator('#saveAll').click()
    ok('Antes del inicio: TEA y caja se editan y guardan',page.evaluate("JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG')).interest===18 && JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG')).capital===110000"))
    saved=storage(page)
    page.goto('about:blank')
    fixture.load(page,'docente.html',saved)
    page.wait_for_load_state('networkidle')
    ok('Antes del inicio: valores persisten tras recarga',page.locator('#interest').input_value()=='18' and page.locator('#capital').input_value()=='110000')
    page.locator('#openEventPicker').click()
    page.locator('.event-enable').first.check()
    page.locator('#closeEventPicker').click()
    ok('Selección de eventos conserva interacción',page.evaluate('state.enabledEvents.size===1'))
    install_service(page)
    page.locator('#startGame').click()
    page.wait_for_function("state.partidaId==='qa-game' && !state.starting")
    ok('Iniciar partida usa creación y abre sala',page.evaluate("testCalls[0][0]==='crear' && runtime().phase==='integration'"))
    page.evaluate("clearInterval(teacherPoll);clearInterval(teacherTick);switchTab('configuracion')")
    page.locator('#interest').fill('17')
    page.locator('#capital').fill('115000')
    page.locator('#saveAll').click()
    page.wait_for_function('testRoom.configuracion.interest===17')
    ok('Sala creada: cambio se programa para ciclo 2 y conserva base ciclo 1',page.evaluate('SIDE_FINANCE_CONFIG.resolve(testRoom.configuracion,1).interest===18 && SIDE_FINANCE_CONFIG.resolve(testRoom.configuracion,1).capital===110000 && SIDE_FINANCE_CONFIG.resolve(testRoom.configuracion,2).interest===17'))
    page.locator('#interest').fill('18')
    page.locator('#capital').fill('110000')
    page.locator('#saveAll').click()
    page.wait_for_function('testRoom.configuracion.interest===18')
    page.evaluate("""() => {clearInterval(teacherPoll);clearInterval(teacherTick);testRoom.estado='activa';
      testRoom.configuracion.runtime={round:2,phase:'decisions',status:'running',running:true,startedAt:new Date().toISOString(),duration:600,remaining:600};
      applyTeacherState(testRoom);switchTab('configuracion');} """)
    expect(page.locator('#interest')).to_be_enabled()
    expect(page.locator('#capital')).to_be_enabled()
    ok('Ciclo 2: TEA/caja editables y parámetros estructurales protegidos',page.locator('#cycles').is_disabled() and page.locator('#gameName').is_disabled())
    page.locator('#interest').fill('12.5')
    page.locator('#capital').fill('150000')
    page.evaluate('watchTeacherGame()')
    page.wait_for_timeout(3300)
    page.evaluate('clearInterval(teacherPoll);clearInterval(teacherTick)')
    ok('Polling de partida conserva borrador financiero sin guardar',page.locator('#interest').input_value()=='12.5' and page.locator('#capital').input_value()=='150000')
    page.locator('#saveAll').click()
    page.wait_for_function("testCalls.some(x=>x[0]==='guardar')")
    page.wait_for_function("!document.getElementById('saveAll').disabled")
    ok('Ciclo 2: guardar confirma TEA/caja en servicio remoto',page.evaluate('testRoom.configuracion.interest===12.5 && testRoom.configuracion.capital===150000'))
    ok('Guardar no altera ciclo en curso',page.evaluate("testRoom.configuracion.runtime.round===2 && testRoom.configuracion.runtime.phase==='decisions'"))
    ok('Cambio programado para ciclo 3 sin alterar ciclos 1 y 2',page.evaluate("SIDE_FINANCE_CONFIG.resolve(testRoom.configuracion,1).interest===18 && SIDE_FINANCE_CONFIG.resolve(testRoom.configuracion,2).capital===110000 && SIDE_FINANCE_CONFIG.resolve(testRoom.configuracion,3).interest===12.5 && SIDE_FINANCE_CONFIG.adjustment(testRoom.configuracion,3,'qa-company',110000)===40000"))
    page.evaluate('testFail=true;window.lastSaved=localStorage.getItem(\'SIDE_TEACHER_CONFIG\')')
    page.locator('#interest').fill('13')
    page.locator('#saveAll').click()
    expect(page.locator('#toast')).to_contain_text('No se guardó')
    ok('Fallo remoto no confirma ni persiste edición local',page.evaluate("testRoom.configuracion.interest===12.5 && localStorage.getItem('SIDE_TEACHER_CONFIG')===lastSaved"))
    page.evaluate('testFail=false')
    page.locator('#interest').fill('12.5')
    page.locator('#capitalModeRandom').check()
    page.locator('#capitalMin').fill('160000')
    page.locator('#capitalMax').fill('140000')
    calls=page.evaluate('testCalls.length')
    page.locator('#saveAll').click()
    expect(page.locator('#capitalMax')).to_have_attribute('aria-invalid','true')
    ok('Rango aleatorio invertido se rechaza sin publicar',page.evaluate('testCalls.length')==calls)
    page.locator('#capitalMin').fill('140000')
    page.locator('#capitalMax').fill('160000')
    page.locator('#saveAll').click()
    page.wait_for_function("testRoom.configuracion.capitalMode==='random'")
    ok('Modo aleatorio persiste con rango válido',page.evaluate("testRoom.configuracion.capitalMin===140000 && testRoom.configuracion.capitalMax===160000"))
    expect(page.locator('#creationFeedback')).to_be_hidden()
    ok('Guardar válido elimina aviso anterior de validación')
    page.locator('#capitalModeFixed').check()
    page.locator('#saveAll').click()
    page.wait_for_function("testRoom.configuracion.capitalMode==='fixed'")
    page.screenshot(path=str(OUT/'ciclo2-configuracion.png'),full_page=True)
    remote=page.evaluate('testRoom')
    saved=storage(page)
    page.evaluate("testOldServer=true;window.beforeOldServer=localStorage.getItem('SIDE_TEACHER_CONFIG')")
    page.locator('#interest').fill('11')
    page.locator('#saveAll').click()
    expect(page.locator('#creationMessage')).to_contain_text('El servidor no confirmó')
    expect(page.locator('#creationMessage')).to_contain_text('2026-10-23_configuracion_financiera.sql')
    ok('Servidor antiguo no anuncia éxito ni cambia datos locales',page.evaluate("localStorage.getItem('SIDE_TEACHER_CONFIG')===beforeOldServer && state.authoritative.interest===12.5 && document.getElementById('toast').textContent!=='Configuración guardada.'"))
    page.goto('about:blank')
    fixture.load(page,'docente.html',saved)
    page.wait_for_load_state('networkidle')
    install_service(page,remote)
    page.evaluate('recoverServerRoom()')
    page.wait_for_function("state.partidaId==='qa-game'")
    ok('Ciclo 2: recarga y recuperación conservan valores',page.locator('#interest').input_value()=='12.5' and page.locator('#capital').input_value()=='150000')
    page.evaluate("""() => {clearInterval(teacherPoll);clearInterval(teacherTick);state.reports=[{id:'qa',empresa:'Empresa QA',nombre:'Alumno QA',ronda:1,capital:110000,caja:103000,utilidad:3000,ingresos:20000,costos:17000,teacherScore:18,estadoResultados:{ventasNetas:20000,costos:17000,utilidad:3000},balanceCaja:{cajaInicial:110000,cajaFinal:103000},balanceGeneral:{efectivo:103000,activos:120000,deuda:10000,patrimonio:110000},updatedAt:new Date().toISOString()}];switchTab('resultados');renderResults();}""")
    ok('Resultados conserva empresa y balance previo','Empresa QA' in page.locator('#detailReports').inner_text() and '110,000' in page.locator('#detailReports').inner_text())
    page.evaluate("switchTab('podio');renderPodium()")
    ok('Podio conserva empresa calificada','Empresa QA' in page.locator('#sidePodium').inner_text() or 'Empresa QA' in page.locator('#podiumPreview').inner_text())
    page.locator('[data-tab="historial"]').click()
    expect(page.locator('#tab-historial')).to_be_visible()
    ok('Historial mantiene navegación')
    page.locator('[data-tab="configuracion"]').click()
    page.evaluate("testRoom.configuracion.runtime.round=3;applyTeacherState(testRoom)")
    page.locator('#interest').fill('19')
    calls=page.evaluate('testCalls.length')
    page.locator('#saveAll').click()
    expect(page.locator('#toast')).to_contain_text('último ciclo')
    ok('Último ciclo rechaza efecto retroactivo sin publicar',page.evaluate('testCalls.length')==calls)
    page.set_viewport_size({'width':390,'height':844})
    ok('Configuración móvil sin desbordamiento',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.screenshot(path=str(OUT/'ciclo2-configuracion-mobile.png'),full_page=True)
    student_config=remote['configuracion']
    student_config['runtime']['round']=2
    student_seed={'SIDE_TEACHER_CONFIG':json.dumps(student_config),'SIDE_ACTIVE_ROUND':'2'}
    page.goto('about:blank')
    fixture.load(page,'index.html',student_seed)
    page.wait_for_load_state('networkidle')
    page.evaluate("currentStudent.initialCapital=110000;currentStudent.empresaId='qa-company';cashLedger={};decisionState={}")
    ok('Alumno ciclo 2 conserva TEA y caja anteriores',page.evaluate('teacherConfig().interest===18 && cashBalance()===110000 && financialAdjustment()===0'))
    page.evaluate("let c=JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG'));c.runtime.round=3;localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));localStorage.setItem('SIDE_ACTIVE_ROUND','3')")
    ok('Alumno ciclo 3 aplica TEA y aporte una sola vez',page.evaluate("teacherConfig().interest===12.5 && cashBalance()===150000 && financialLedger()['3:CAPITAL_ADJUSTMENT']===40000"))
    page.evaluate("decisionState={__excel:{habilitado:true,historial:{cajaFinal:150000,financialAdjustment:40000}}}")
    ok('Motor Excel no duplica aporte ya incluido en cierre',page.evaluate('cashBalance()===150000'))
    student_saved=storage(page)
    page.goto('about:blank')
    fixture.load(page,'index.html',student_saved)
    page.wait_for_load_state('networkidle')
    page.evaluate("currentStudent.initialCapital=110000;currentStudent.empresaId='qa-company';cashLedger={};decisionState={__excel:{habilitado:true,historial:{cajaFinal:150000,financialAdjustment:40000}}}")
    ok('Alumno recargado conserva TEA sin duplicar caja',page.evaluate('teacherConfig().interest===12.5 && cashBalance()===150000'))
    ok('Sin errores JavaScript',not errors)
    browser.close()
(OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors,'scope':'DOM local real con almacenamiento y RPC aislados; SQL validado aparte.'},ensure_ascii=False,indent=2),encoding='utf-8')
