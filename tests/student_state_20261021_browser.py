"""State behavior in delivered DOM; no production network or accounts."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
from browser_fixture import load
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/student-state-20261021';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(label,value=True):
 assert value,label
 checks.append(label);print('PASS',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe')
 page=browser.new_page(viewport={'width':1440,'height':1000});page.route('**/*',lambda r:r.abort());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 conf={'capital':100000,'lifecycleVersion':2,'cycles':3,'roundMinutes':10,'runtime':{'round':1,'phase':'decisions','status':'running','running':True,'remaining':137}}
 load(page,'index.html',{'SIDE_TEACHER_CONFIG':json.dumps(conf),'SIDE_GAME_STATUS':'{"active":true}','SIDE_ROUND_RUNTIME':json.dumps(conf['runtime'])})
 page.wait_for_load_state('networkidle')
 page.evaluate("""()=>{
 stopStudentSync();currentStudent={company:'Estado QA',legalName:'Estado QA SAC',game:{codigo:'SIDE-QA'}};studentConnected=true;
 loadDecisionState();currentCategory='E';showScreen('decisionMenu');renderDecisionCategory();
 window.qaPause=value=>{const c=teacherConfig();c.runtime={round:1,phase:'decisions',status:value?'paused':'running',running:!value,remaining:137};localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(c.runtime));updateIntegrationUI();syncStudentTimer();};qaPause(true);
 }""")
 expect(page.locator('#studentCyclePause')).to_be_visible()
 expect(page.locator('#cyclePauseTitle')).to_have_text('Ciclo en pausa')
 ok('Pausa muestra overlay y bloquea operación',page.evaluate('!studentAccess().canOperate&&studentAccess().canReview&&!canExploreWorld()'))
 before=page.locator('#decisionRoundTimer').inner_text();page.wait_for_timeout(1100);page.evaluate('syncStudentTimer()')
 ok('Reloj permanece congelado',page.locator('#decisionRoundTimer').inner_text()==before and before.endswith('02:17'))
 expect(page.locator('#studentTimerNote')).to_contain_text('reloj congelado')
 page.screenshot(path=str(OUT/'pausa-escritorio.png'))
 page.locator('#studentCyclePause button').click()
 expect(page.locator('#decisionMenu')).to_be_visible();expect(page.locator('#studentCyclePause')).to_be_hidden()
 ok('Revisión y preparación disponible durante pausa',page.evaluate("!saveCurrentSection()&&!sectionSubmitted('E')"))
 page.evaluate("sendCurrentSection()")
 ok('Envío no se confirma durante pausa',page.evaluate("!sectionSubmitted('E')"))
 page.evaluate('qaPause(false)');expect(page.locator('#toast')).to_contain_text('Ciclo reanudado')
 ok('Reanudar restituye operación',page.evaluate('studentAccess().canOperate'))
 page.evaluate("""()=>{currentStudent.empresaId=9;studentConnectionConfirmedAt=performance.now();renderStudentConnection();}""")
 expect(page.locator('#studentConnectionStatus')).to_contain_text('confirmada')
 page.evaluate('studentConnectionConfirmedAt=performance.now()-16000;renderStudentConnection()')
 expect(page.locator('#studentConnectionStatus')).to_contain_text('sin confirmar')
 ok('Conexión estudiante no se queda confirmada sin respuesta reciente')
 page.evaluate("""()=>{currentStudent.empresaId=null;decisionState.__excel={habilitado:true,eliminada:true,cajaTransicion:1234};showStudentExpulsion({legacy:true});}""")
 expect(page.locator('#studentExpelledModal [data-expelled-summary]')).to_contain_text('1,234')
 expect(page.locator('#studentExpelledMessage')).to_contain_text('modelo Excel anterior')
 ok('Eliminación bloquea decisiones y presenta último resumen',page.evaluate('currentStudent.expulsada&&!studentAccess().canOperate'))
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'eliminada-movil.png'))
 ok('Resumen eliminación legible en móvil',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 page.close();page=browser.new_page(viewport={'width':1440,'height':1000});page.route('**/*',lambda r:r.abort());page.on('pageerror',lambda e:errors.append(str(e)))
 load(page,'docente.html');page.wait_for_function('typeof state==="object"&&!reportsBusy')
 ok('Presencia local caduca sin conservar booleano conectado',page.evaluate("""()=>{
 [teacherPoll,teacherTick,companiesPoll].forEach(clearInterval);state.partidaId=null;teacherClock=null;presenceTracker.clear();
 const now=Date.now(),r={id:'local-qa',fuente:'local',empresa:'Local QA',conectada:true,lastSeenAt:new Date(now).toISOString()};
 if(companyPresence(r)!=='online')return false;
 teacherClock={time:now+121000,at:performance.now()};companyPresence(r);teacherClock={time:now+137000,at:performance.now()};
 if(companyPresence(r)!=='idle')return false;
 r.lastSeenAt=new Date(now+137000).toISOString();if(companyPresence(r)!=='online')return false;
 r.conectada=false;return companyPresence(r)==='idle';
 }"""))
 ok('Sin errores JavaScript',not errors)
 browser.close()
(OUT/'results.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2),encoding='utf8')
