"""Delivered SIDE UI in Chromium, deterministic presence transport/time fixture.
Does not exercise production Supabase, auth, Realtime network or background throttling.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
from browser_fixture import load

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/teacher-presence'
OUT.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH', 'C:/Program Files/Google/Chrome/Application/chrome.exe'))
    context = browser.new_context(viewport={'width': 1366, 'height': 900}, locale='es-PE', timezone_id='America/Lima')
    context.route('**/*', lambda route: route.abort())
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    load(page, 'docente.html')
    # The roster polls continuously; wait for delivered DOM instead of network quiescence.
    page.wait_for_function('typeof state==="object"')
    page.wait_for_function('!reportsBusy')
    page.evaluate('''()=>{
      [teacherPoll,teacherTick,companiesPoll].forEach(clearInterval);
      window.qaTime=Date.parse('2026-10-12T12:00:00Z');teacherClock={time:qaTime,at:performance.now()};
      state.partidaId='presence-game';$('gameCode').value='SIDE-TEST';
      state.authoritative={runtime:{phase:'integration'}};
      localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true}));
      localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({phase:'integration'}));
      presenceTracker.clear();
      state.reports=['Andina','Costa'].map((name,i)=>({id:'report-'+i,empresaId:'empresa-'+i,empresa:name,nombre:'Alumno '+i,partida:'SIDE-TEST',fuente:'supabase',estado:'activa',integracion:true,lastSeenAt:new Date(qaTime).toISOString()}));
      window.qaHeartbeat=(i,stamp)=>{teacherClock={time:qaTime,at:performance.now()};return presenceTracker.observe(companyPresenceKey(state.reports[i]),stamp||new Date(qaTime).toISOString());};
      qaHeartbeat(0);qaHeartbeat(1);renderCompanies();renderTeacherLobby();
      window.qaCards=[...document.querySelectorAll('#companiesGrid [data-company-id]')];
      window.qaLobby=[...document.querySelectorAll('#lobbyCompanies [data-company-id]')];
      window.qaCheck=()=>{
        teacherClock={time:qaTime,at:performance.now()};renderCompanies();renderTeacherLobby();
        if(qaCards.some((n,i)=>n!==document.querySelectorAll('#companiesGrid [data-company-id]')[i]))throw Error('company card replaced');
        if(qaLobby.some((n,i)=>n!==document.querySelectorAll('#lobbyCompanies [data-company-id]')[i]))throw Error('lobby row replaced');
        return state.reports.map((r,i)=>({status:companyPresence(r),lobby:qaLobby[i].dataset.presence,text:qaCards[i].querySelector('[data-field="presence"]').textContent}));
      };
    }''')
    for delay in [15000, 31000, 45000, 27000, 70000, 18000]:
        readings = page.evaluate('''delay=>{
          const old=state.reports.map(r=>r.lastSeenAt);qaTime+=delay;
          state.reports.forEach((r,i)=>{r.lastSeenAt=new Date(qaTime).toISOString();qaHeartbeat(i,r.lastSeenAt);for(let j=0;j<3;j++)qaHeartbeat(i,old[i]);});
          return qaCheck();
        }''', delay)
        assert all(r['status'] == r['lobby'] == 'online' and 'CONECTADA' in r['text'] for r in readings), readings
    # A real sustained timeout, then immediate recovery, retains both DOM nodes.
    page.evaluate('qaTime+=121000;qaCheck()')
    assert page.evaluate('qaCheck().every(r=>r.status==="online")')
    page.evaluate('qaTime+=15001')
    assert page.evaluate('qaCheck().every(r=>r.status==="idle"&&r.lobby==="idle"&&r.text.includes("SIN ACTIVIDAD"))')
    assert page.evaluate('qaHeartbeat(0);qaHeartbeat(1);qaCheck().every(r=>r.status==="online"&&r.lobby==="online")')
    # During an awaited financial report, local reports of the same name must
    # never temporarily replace the Supabase roster used by the lobby tick.
    page.evaluate('''()=>{
      localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(state.reports.map(r=>({...r,fuente:'local'}))));
      SIDE.SupabaseClient.isReady=()=>true;
      SIDE.PartidaService.listarParticipantes=async()=>({success:true,data:state.reports.map(r=>({empresa_id:r.empresaId,empresa:r.empresa,last_seen_at:r.lastSeenAt,empresas:{nombre_comercial:r.empresa}}))});
      SIDE.DecisionesService.obtenerCatalogo=async()=>({success:true,data:{decisions:[],options:[]}});
      window.qaBlocked=false;
      SIDE.DecisionesService.obtenerReporte=async()=>{qaBlocked=true;await new Promise(resolve=>window.qaRelease=resolve);return {success:true,data:{}};};
      window.qaLoad=loadReports();
    }''')
    page.wait_for_function('qaBlocked')
    assert page.evaluate('qaCheck().length===2&&document.querySelectorAll("#lobbyCompanies li").length===2')
    # Resolve the first await, then allow the second company without a delay.
    page.evaluate('''async()=>{SIDE.DecisionesService.obtenerReporte=async()=>({success:true,data:{}});qaRelease();await qaLoad;}''')
    assert page.evaluate('qaCheck().every(r=>r.status===r.lobby&&r.status==="online")')
    page.evaluate("switchTab('rondas')")
    page.screenshot(path=str(OUT / 'desktop-lobby.png'), full_page=True, animations="disabled")
    page.evaluate("switchTab('empresas')")
    page.screenshot(path=str(OUT / 'desktop-companies.png'), full_page=True, animations="disabled")
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUT / 'mobile-companies.png'), full_page=True, animations="disabled")
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'mobile horizontal overflow'
    page.evaluate("switchTab('rondas')")
    page.screenshot(path=str(OUT / 'mobile-lobby.png'), full_page=True, animations="disabled")
    assert not errors, errors
    (OUT / 'result.json').write_text(json.dumps({'passed': True, 'companies': 2, 'checks': ['jitter', 'late snapshots', '70-second interruption', 'sustained inactivity', 'immediate reconnect', 'shared status', 'stable DOM', '390px mobile'], 'limitations': ['isolated transport fixture; no production Supabase or background tab throttling']}, indent=2))
    browser.close()
print('PASS two companies, jitter/late snapshots/brief interruption, stable shared presence, desktop/mobile')
