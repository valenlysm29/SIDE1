"""Expulsión: DOM entregado con servicios simulados; no usa cuentas ni red."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
from browser_fixture import load

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/company-expulsion'
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(label,condition=True):
    assert condition,label
    checks.append(label)
    print('PASS',label,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    context=browser.new_context(viewport={'width':1366,'height':900})
    context.route('**/*',lambda route:route.abort())
    errors=[]
    context.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
    teacher=context.new_page()
    load(teacher,'docente.html')
    teacher.evaluate("""()=>{
      loadReports=async()=>{};state.partidaId='qa-game';
      state.reports=[{id:'qa',empresaId:7,empresa:'Empresa QA',fuente:'supabase',estado:'activa',partida:'SIDE-AAA'}];
      switchTab('empresas');renderCompanies();
      SIDE.PartidaService.expulsarEmpresa=async()=>({success:false,error:'Falta aplicar la migración de expulsión.'});
    }""")
    ok('Fallo remoto no marca eliminada',teacher.evaluate("async()=>{const done=await toggleElimination(0);return !done&&state.reports[0].estado==='activa'}"))
    expect(teacher.locator('#toast')).to_contain_text('migración')
    teacher.evaluate("""()=>{
      SIDE.PartidaService.expulsarEmpresa=()=>new Promise(resolve=>window.finishExpulsion=resolve);
      window.expulsionTask=toggleElimination(0);
    }""")
    expect(teacher.locator('[data-eliminate]')).to_be_disabled()
    ok('Expulsión espera confirmación del servidor',teacher.evaluate("state.reports[0].estado==='activa'"))
    teacher.evaluate("async()=>{finishExpulsion({success:true,data:{expulsada_at:new Date().toISOString()}});await expulsionTask}")
    expect(teacher.locator('[data-field=presence]')).to_contain_text('FUERA DE LA PARTIDA')
    expect(teacher.locator('[data-eliminate]')).to_have_text('Reactivar empresa')
    ok('Profesor ve expulsión confirmada y opción de reactivar')
    ok('Empresa desaparece de la lista activa y pasa a eliminadas',teacher.locator('#companiesGrid [data-company-id]').count()==0 and teacher.locator('#companiesExpelledGrid [data-company-id]').count()==1)
    teacher.screenshot(path=str(OUT/'profesor.png'))
    # A subsequent roster read must use the server, including after reload.
    ok('Listado remoto conserva expulsión y reactivación',teacher.evaluate("""async()=>{
      SIDE.SupabaseClient.isReady=()=>true;let expulsada=new Date().toISOString();
      SIDE.PartidaService.listarParticipantes=async()=>({success:true,data:[{empresa_id:7,empresa:'Empresa QA',expulsada_at:expulsada}]});
      SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
      SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{empresa:{nombre_comercial:'Empresa QA'}}});
      const off=await supabaseReports([{id:'qa',empresaId:7,empresa:'Empresa QA',estado:'activa'}]);
      expulsada=null;const on=await supabaseReports(off);
      return off[0].estado==='eliminada' && on[0].estado==='activa';
    }"""))
    student=context.new_page()
    load(student,'index.html')
    student.evaluate("""()=>{
      const session={};Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>session[k]??null,setItem:(k,v)=>session[k]=String(v),removeItem:k=>delete session[k]}});
      stopStudentSync();window.suspended=0;window.SIDE3D={suspend(){suspended++}};
      currentStudent={company:'Empresa QA',legalName:'Legal QA',empresaId:7,game:{id:'qa-game',codigo:'SIDE-AAA'}};
      studentConnected=true;studentProgressHydrated=true;persistStudentSession();
      SIDE.EmpresaService.obtenerEstado=async()=>({success:false,code:'EMPRESA_EXPULSADA'});
      showScreen('studentLobby');
    }""")
    student.evaluate('refreshStudentGame()')
    expect(student.locator('#studentExpelledModal')).to_be_visible()
    expect(student.get_by_role('alertdialog')).to_contain_text('eliminó tu empresa por inactividad')
    ok('Estudiante sale, se suspende juego, pierde sesión y no puede operar',student.evaluate("!studentConnected&&studentPoll===null&&studentTick===null&&suspended>0&&sessionStorage.getItem('SIDE_STUDENT_SESSION')===null&&!studentAccess().canOperate&&syncStudentReportPreview()===null"))
    student.screenshot(path=str(OUT/'estudiante.png'))
    student.locator('#studentExpelledModal [data-close]').click()
    expect(student.locator('#profiles')).to_be_visible()
    expect(student.locator('#roomCancellationNotice')).to_contain_text('eliminada de la partida')
    ok('Aviso persiste al cerrar el diálogo')
    student.evaluate("""async()=>{
      currentStudent={company:'Empresa QA',legalName:'Legal QA',empresaId:7,game:{id:'qa-game',codigo:'SIDE-AAA'},snapshotRevision:0};
      studentConnected=true;studentProgressHydrated=true;
      SIDE.EmpresaService.guardarEstado=async()=>({success:false,code:'EMPRESA_EXPULSADA'});
      await queueStudentSnapshot({round:1,decision_state:{}},{key:'report',type:'report',payload:{}});
    }""")
    expect(student.locator('#studentExpelledModal')).to_be_visible()
    ok('Expulsión durante guardado también detiene sesión y cola',student.evaluate('!studentConnected&&!studentSyncPending()'))
    # Restore path checks the server before showing the game.
    student.evaluate("""async()=>{
      closeModal();currentStudent={company:'Empresa QA',legalName:'Legal QA',empresaId:7,game:{id:'qa-game',codigo:'SIDE-AAA'}};
      studentConnected=true;studentSessionRecovering=true;persistStudentSession();await resumeStudentSession();
    }""")
    expect(student.locator('#studentExpelledModal')).to_be_visible()
    ok('Recuperación de sesión expulsada bloqueada')
    student.set_viewport_size({'width':360,'height':800})
    ok('Aviso legible en móvil sin desborde',student.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    student.screenshot(path=str(OUT/'estudiante-movil.png'))
    # Same-device local demo cannot overwrite the teacher marker with its report.
    student.evaluate("""()=>{
      closeModal();currentStudent={company:'Local QA',legalName:'Local QA',game:{codigo:'SIDE-000'}};studentConnected=true;
      localStorage.setItem('SIDE_COMPANY_EXCLUSIONS',JSON.stringify({'SIDE-000_Local QA':true}));
      window.dispatchEvent(new StorageEvent('storage',{key:'SIDE_COMPANY_EXCLUSIONS'}));
    }""")
    expect(student.locator('#studentExpelledModal')).to_be_visible()
    ok('Modo local respeta expulsión y bloquea reporte que la sobrescribiría',student.evaluate('!studentConnected&&syncStudentReportPreview()===null'))
    ok('Sin errores JavaScript',not errors)
    browser.close()
(OUT/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
