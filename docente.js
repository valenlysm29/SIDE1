const cfg=window.SIDE_CONFIG||{};
const hasConfig=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_URL.includes('TU-PROYECTO');
const supabaseClient=hasConfig&&window.supabase?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY):null;
const $=id=>document.getElementById(id);
const RULES=window.SIDE_RULES;
const EVENT_CATALOG=Array.isArray(window.SIDE_EVENT_CATALOG)?window.SIDE_EVENT_CATALOG:[];
const state={reports:[],events:[],round:1,timer:null,scheduleWatcher:null,seconds:600,roundClosed:false,enabledEvents:new Set(),eventSelectionMode:'manual',partidaId:null,integrationMinutes:0,lifecycleVersion:2,authoritative:null,starting:false,startingCycle1:false};
try{state.partidaId=localStorage.getItem('SIDE_PARTIDA_ID')||null}catch{state.partidaId=null}

function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2800)}
function money(n){return 'S/ '+Math.round(Number(n)||0).toLocaleString('es-PE')}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escapeAttr(v){return escapeHtml(v)}
function gameStatus(){try{return JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{return null}}
function renderEnabledEvents(){
  const selected=EVENT_CATALOG.filter(e=>state.enabledEvents.has(e.id));
  if($('enabledEventsSummary'))$('enabledEventsSummary').innerHTML=selected.length?
    `<strong>${selected.length} habilitados</strong>`+selected.slice(0,3).map(e=>`<span class="enabled-event-chip">${escapeHtml(e.title)}</span>`).join('')+(selected.length>3?`<span>y ${selected.length-3} más · consulta la selección</span>`:''):'Sin eventos habilitados. Pulsa Seleccionar eventos para agregarlos.';
}
function refreshSetupSummary(){
  const status=gameStatus(),active=Boolean(status?.active),r=runtime();
  const count=Number($('cycles').value)||1;
  const integration=r?.phase==='integration',modern=state.lifecycleVersion===2;
  $('configCycleCount').textContent=`${state.round} / ${count}`;
  $('configReadySummary').textContent=`${count} ciclos operativos de ${$('roundHours').value||0} h ${$('roundMinutes').value||0} min. La integración es previa al Ciclo 1.`;
  $('gameStatusBanner').textContent=integration?(cycleMode()==='manual'?'Estudiantes en período de integración. Pulsa Iniciar partida.':`Inicio automático configurado · ${getConfig().integrationDurationMinutes} minutos de integración.`):active?`Partida iniciada · Ciclo ${state.round} de ${count}.`:status?.finishedAt?'Partida finalizada. Puedes configurar otra partida.':'Guarda la configuración para abrir el ingreso de estudiantes.';
  document.querySelector('[data-tab="rondas"]')?.classList.toggle('hidden',!active&&!status?.finishedAt);
  document.querySelectorAll('#tab-configuracion input:not([readonly])').forEach(input=>input.disabled=active);
  ['startTimer','cutRound','advanceRound'].forEach(id=>{if($(id))$(id).disabled=!active||cycleMode()==='automatic'||integration||(!modern&&state.round===1&&state.integrationMinutes===60&&state.seconds>0)});
  $('startCycle1Btn')?.classList.toggle('hidden',!(active&&integration&&cycleMode()==='manual'));
  if(integration)$('roundState').textContent=cycleMode()==='manual'?'Esperando inicio del Ciclo 1':'Esperando inicio automático';
  else if(active&&modern)$('roundState').textContent=r?.phase==='results'?'Ciclo cerrado':`Ciclo ${state.round} en curso`;
  refreshStartButton();
}
let publishedState='',publishChain=Promise.resolve();
function publishGameState(){
  const service=window.SIDE?.PartidaService;
  if(!state.partidaId||!service?.actualizarConfiguracion||!gameStatus()?.active)return Promise.resolve();
  const r=runtime(),config={...getConfig(),runtime:r?{...r,remaining:r.running?r.duration:r.remaining}:null};
  const signature=JSON.stringify(config),id=state.partidaId;
  publishChain=publishChain.catch(()=>{}).then(async()=>{
    if(signature===publishedState)return;
    const result=await service.actualizarConfiguracion(id,config);
    if(result.success){publishedState=signature;if(result.data?.configuracion)applyTeacherState(result.data);}else toast('No se guardó la configuración remota: '+result.error);
  });
  return publishChain;
}
let companiesPoll=null,companiesChannel=null,companiesChannelId=null;
function startLiveCompanies(){
  if(!companiesPoll)companiesPoll=setInterval(()=>{if(!document.hidden)loadReports()},3000);
  const sb=window.SIDE?.SupabaseClient?.get();
  if(!sb?.channel||!state.partidaId||companiesChannelId===state.partidaId)return;
  if(companiesChannel)sb.removeChannel(companiesChannel);
  companiesChannelId=state.partidaId;
  companiesChannel=sb.channel(`side-roster-${state.partidaId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'participantes',filter:`partida_id=eq.${state.partidaId}`},()=>loadReports())
    .subscribe();
}
function generateGameCode(){const existing=localStorage.getItem('SIDE_ASSIGNED_GAME_CODE');if(existing)return existing;const code='SIDE-'+String(1000+Math.floor(Math.random()*9000));localStorage.setItem('SIDE_ASSIGNED_GAME_CODE',code);return code}
function setDefaultDates(){const now=new Date(),end=new Date(now);end.setMonth(end.getMonth()+2);$('startDate').value=RULES.localDate(now);$('endDate').value=RULES.localDate(end)}
function roundSeconds(){if(state.round===1&&state.integrationMinutes===60)return 3600;if(state.integrationMinutes===0&&state.round===1)return Math.max(60,Number($('roundHours').value||0)*3600+Number($('roundMinutes').value||0)*60);return Math.max(60,Number($('roundHours').value||0)*3600+Number($('roundMinutes').value||0)*60)}
function cycleMode(){return document.querySelector('input[name="cycleMode"]:checked')?.value||'manual'}
function capitalMode(){return document.querySelector('input[name="capitalMode"]:checked')?.value||'fixed'}
function eventSelectionMode(){return document.querySelector('input[name="eventSelectionMode"]:checked')?.value||state.eventSelectionMode||'manual'}
function cycleOffsetLabel(e){const n=Math.max(0,Number(e?.cycleOffset||0));return n===0?'+0 · mismo ciclo':n===1?'+1 · siguiente ciclo':`+${n} · después de ${n} ciclos`}
function filteredEvents(){const q=String($('eventSearch')?.value||'').trim().toLowerCase(),cat=$('eventCategoryFilter')?.value||'all',scope=$('eventScopeFilter')?.value||'all';return EVENT_CATALOG.filter(e=>(!q||`${e.title} ${e.description} ${e.implication} ${e.category||''}`.toLowerCase().includes(q))&&(cat==='all'||e.category===cat)&&(scope==='all'||e.scope===scope))}
function getConfig(){return {
  ...state.authoritative,lifecycleVersion:state.lifecycleVersion===2?2:undefined,
  integrationDurationMinutes:Number($('integrationDurationMinutes').value),
  integrationMinutes:state.integrationMinutes,gameStartedAt:gameStatus()?.startedAt||null,eventSchedule:eventSchedule(),
  nombre:$('gameName').value.trim(),curso:$('gameCourse').value.trim(),codigo:$('gameCode').value,
  capitalMode:capitalMode(),capital:Number($('capital').value||100000),capitalMin:Number($('capitalMin').value||80000),capitalMax:Number($('capitalMax').value||120000),
  demandLosOlivos:Number($('demandLosOlivos').value||0),demandMiraflores:Number($('demandMiraflores').value||0),demandSJL:Number($('demandSJL').value||0),
  interest:Number($('interest').value||20),creditPercentStart:Number($('creditPercentStart').value||20),
  cycles:Number($('cycles').value),roundHours:Number($('roundHours').value),roundMinutes:Number($('roundMinutes').value),roundSecs:0,round:state.round,
  cycleCloseMode:cycleMode(),scheduledStart:$('scheduledStart').value||'',startDate:$('startDate').value,endDate:$('endDate').value,
  manualStartDate:state.manualDates?.start||'',manualEndDate:state.manualDates?.end||'',
  enabledEvents:[...state.enabledEvents],eventSelectionMode:eventSelectionMode(),randomEventCount:Math.max(1,Math.min(40,Number($('eventRandomCount')?.value||15))),loanMaxPercent:50,loanInitialPercent:25
}}
function saveConfig(silent=false){
  renderAcademicCalendar();const c=getConfig();
  const numericPlan=RULES.cycleSchedule({...c,scheduledStart:c.scheduledStart||'2026-01-01T00:00'});
  if(c.lifecycleVersion===2&&c.cycleCloseMode==='automatic'&&(!Number.isInteger(c.integrationDurationMinutes)||c.integrationDurationMinutes<1||c.integrationDurationMinutes>60)){if(!silent)toast('Indica entre 1 y 60 minutos de integración.');return false}
  if(numericPlan.error){if(!silent)toast(numericPlan.error);return false}
  if(c.capitalMode==='random'&&c.capitalMax<c.capitalMin){toast('El rango máximo de caja debe ser mayor o igual al mínimo.');return false}
  localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));$('gameCodeBadge').textContent=c.codigo;updateRoundDisplay();refreshSetupSummary();publishGameState();
  if(!silent)toast('Configuración guardada.');return true;
}
function loadConfig(){const raw=localStorage.getItem('SIDE_TEACHER_CONFIG');let c=null;if(raw){try{c=JSON.parse(raw)}catch{}}if(c&&gameStatus()?.active){state.integrationMinutes=Number(c.integrationMinutes)||0;state.lifecycleVersion=c.lifecycleVersion===2?2:1;state.authoritative=c;}else{state.lifecycleVersion=2;state.integrationMinutes=0;}if(!c){setDefaultDates();c={codigo:generateGameCode(),capitalMode:'fixed',cycleCloseMode:'manual',enabledEvents:[]}}const fields=['integrationDurationMinutes','gameName','gameCourse','capital','capitalMin','capitalMax','demandLosOlivos','demandMiraflores','demandSJL','interest','creditPercentStart','cycles','roundHours','roundMinutes','scheduledStart','startDate','endDate'];fields.forEach(k=>{const value=k==='gameName'?c.nombre:k==='gameCourse'?c.curso:c[k];if($(k)&&value!==undefined){if(k==='scheduledStart'&&value){const date=new Date(value);$(k).value=Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';}else $(k).value=value;}});$('gameCode').value=c.codigo||generateGameCode();localStorage.setItem('SIDE_ASSIGNED_GAME_CODE',$('gameCode').value);const capRadio=document.querySelector(`input[name="capitalMode"][value="${c.capitalMode||'fixed'}"]`);if(capRadio)capRadio.checked=true;const cycleRadio=document.querySelector(`input[name="cycleMode"][value="${c.cycleCloseMode||'manual'}"]`);if(cycleRadio)cycleRadio.checked=true;state.enabledEvents=new Set(c.enabledEvents||[]);state.eventSelectionMode=c.eventSelectionMode||'manual';const eventModeRadio=document.querySelector(`input[name="eventSelectionMode"][value="${state.eventSelectionMode}"]`);if(eventModeRadio)eventModeRadio.checked=true;if($('eventRandomCount'))$('eventRandomCount').value=Math.max(1,Math.min(40,Number(c.randomEventCount||15)));const catSel=$('eventCategoryFilter');if(catSel&&catSel.options.length===1){[...new Set(EVENT_CATALOG.map(e=>e.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(cat=>{const o=document.createElement('option');o.value=cat;o.textContent=cat;catSel.appendChild(o)})}state.round=Math.max(1,Number(localStorage.getItem('SIDE_ACTIVE_ROUND')||c.round||1));state.seconds=roundSeconds();if(!$('startDate').value||!$('endDate').value)setDefaultDates();let status=null;try{status=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{}if(status?.active){$('interest').disabled=true;if($('startGame'))$('startGame').textContent='Partida iniciada'}state.manualDates={start:c.manualStartDate||$('startDate').value,end:c.manualEndDate||$('endDate').value};syncModeUI();renderEventBank()}
function syncModeUI(){$('fixedCapitalFields').classList.toggle('hidden',capitalMode()!=='fixed');$('randomCapitalFields').classList.toggle('hidden',capitalMode()!=='random');$('manualCycleDisclaimer').classList.toggle('hidden',cycleMode()!=='manual');$('automaticCycleConfig').classList.toggle('hidden',cycleMode()!=='automatic');$('cycleCloseMode').value=cycleMode();$('modeSummaryBadge').textContent=cycleMode()==='automatic'?'Automático':'Manual';$('modeRulesText').innerHTML=cycleMode()==='automatic'?'<strong>Automático:</strong> inicia a la hora programada y avanza solo al llegar a cero.':'<strong>Manual:</strong> el docente decide cuándo inicia y cuándo avanza cada ciclo.';['startTimer','cutRound','advanceRound'].forEach(id=>{if($(id)){$(id).disabled=cycleMode()==='automatic';$(id).title=cycleMode()==='automatic'?'Controlado por la programación automática':''}});renderAcademicCalendar()}


function calendarDuration(milliseconds){
  const minutes=Math.round(milliseconds/60000),hours=Math.floor(minutes/60),rest=minutes%60;
  return `${hours?hours+' h':''}${hours&&rest?' ':''}${rest?rest+' min':''}`||'0 min';
}
function calendarDateTime(value){return new Date(value).toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}
function renderAcademicCalendar(){
  if(!$('automaticCalendar'))return;
  const automatic=cycleMode()==='automatic';
  if(automatic&&state.calendarMode!=='automatic'&&!state.manualDates)state.manualDates={start:$('startDate').value,end:$('endDate').value};
  if(!automatic&&state.calendarMode==='automatic'&&state.manualDates){$('startDate').value=state.manualDates.start;$('endDate').value=state.manualDates.end}
  state.calendarMode=cycleMode();
  ['startDate','endDate'].forEach(id=>{$(id).readOnly=automatic;$(id).setAttribute('aria-readonly',String(automatic))});
  $('automaticCalendar').classList.toggle('hidden',!automatic);
  $('calendarModeBadge').textContent=automatic?'Automático':'Referencia';
  if(!automatic){state.manualDates={start:$('startDate').value,end:$('endDate').value};$('academicCalendarHint').textContent='Las fechas son informativas en modo manual. El docente decide cuándo inicia y termina cada ciclo.';return}
  const config=getConfig(),plan=RULES.cycleSchedule(config),r=runtime();
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'hora local';
  $('academicCalendarHint').textContent=`Fechas calculadas desde el inicio programado, la duración y el número de ciclos. Zona horaria de este navegador: ${tz}.`;
  if(plan.error){$('startDate').value='';$('endDate').value='';$('calendarSummary').textContent=plan.error;$('cycleCalendarList').innerHTML='';return}
  $('startDate').value=RULES.localDate(plan.start);$('endDate').value=RULES.localDate(plan.end);
  const matches=config.lifecycleVersion===2?Boolean(config.gameStartAt&&r):r?.mode==='automatic'&&r?.scheduledStart===config.scheduledStart&&Number(r?.duration)===(plan.cycles[Math.max(0,Number(r?.round||1)-1)]?.end-plan.cycles[Math.max(0,Number(r?.round||1)-1)]?.start)/1000;
  const current=matches?Number(r.round||1):0,finished=matches&&r.status==='simulation-finished';
  const running=matches&&r.running,scheduled=matches&&(r.status==='scheduled'||r.phase==='integration');
  const label=finished?'Simulación finalizada':running?`Ciclo ${current} en curso`:scheduled?'Inicio automático programado':'Vista previa de la programación';
  const summaryHtml=`<strong>${plan.cycles.length} ciclos · ${config.integrationMinutes===60?'Ciclo 1: integración de 1 h · ':''}Total ${calendarDuration(plan.total)}</strong><span>${escapeHtml(label)}<br>Inicio: ${calendarDateTime(plan.start)}<br>Fin de simulación: ${calendarDateTime(plan.end)}</span>${!matches?`<small class="calendar-warning">Pulsa Iniciar partida para activar este horario.${plan.start<Date.now()?' El inicio está en el pasado: se retomará el ciclo correspondiente al horario, o se finalizará si ya transcurrió todo el plazo.':''}</small>`:''}`;
  if($('calendarSummary').innerHTML!==summaryHtml)$('calendarSummary').innerHTML=summaryHtml;
  const listHtml=plan.cycles.map(c=>{
    const ended=finished||(matches&&c.round<current),active=running&&c.round===current;
    return `<li class="cycle-calendar-row ${ended?'is-finished':active?'is-current':''}" data-cycle="${c.round}"><div class="cycle-calendar-title"><strong>Ciclo ${c.round}${c.round===1&&config.integrationMinutes===60?' · Integración':''}</strong><span class="cycle-calendar-state">${ended?'Finalizado':active?'En curso':'Programado'}</span></div><div class="cycle-calendar-times"><span><small>Inicio</small><time datetime="${new Date(c.start).toISOString()}">${calendarDateTime(c.start)}</time></span><span><small>Cierre</small><time datetime="${new Date(c.end).toISOString()}">${calendarDateTime(c.end)}</time></span></div><p class="cycle-calendar-action">${c.round===plan.cycles.length?'Al cerrar: fin de la simulación.':`Al cerrar: fin del ciclo e inicio automático del ciclo ${c.round+1}.`}</p></li>`;
  }).join('');
  const list=$('cycleCalendarList');if(list.innerHTML!==listHtml){const scroll=list.scrollTop;list.innerHTML=listHtml;list.scrollTop=scroll}
}

function runtime(){try{return JSON.parse(localStorage.getItem('SIDE_ROUND_RUNTIME')||'null')}catch{return null}}
function writeRuntime(extra={}){
  const base=runtime()||{};
  const data={...base,round:state.round,duration:roundSeconds(),remaining:state.seconds,running:false,status:'ready',mode:cycleMode(),scheduledStart:$('scheduledStart').value||'',...extra};
  localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(data));publishGameState();if(data.round!==base.round)syncRoundToSupabase();refreshSetupSummary();return data;
}
function updateRoundDisplay(){$('roundDisplay').textContent=`${state.round} / ${Number($('cycles').value||6)}`;$('currentRound').value=state.round;localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round));$('roundSummary').textContent=`TEA inicial: ${Number($('interest').value||0).toFixed(1)}% · ${cycleMode()==='automatic'?'Avance automático':'Control manual'}`;renderAcademicCalendar()}
function updateTimer(){const seconds=Math.max(0,state.seconds),h=String(Math.floor(seconds/3600)).padStart(2,'0'),m=String(Math.floor(seconds%3600/60)).padStart(2,'0'),sec=String(seconds%60).padStart(2,'0');$('roundTimer').textContent=`${h}:${m}:${sec}`}
function stopTimer(status='paused'){if(state.timer){clearInterval(state.timer);state.timer=null}$('startTimer').textContent='Iniciar';const r=runtime();writeRuntime({running:false,remaining:state.seconds,status})}
function beginTimer(auto=false,referenceStart=null){
  if(!gameStatus()?.active){toast('Primero pulsa Iniciar partida.');return;}

  if(auto||cycleMode()==='automatic'){scheduleAutomaticStart();return}
  if(state.timer)return;
  if(state.roundClosed){toast('Este ciclo ya está cerrado. Avanza al siguiente.');return}
  if(state.seconds<=0)state.seconds=roundSeconds();
  $('roundState').textContent='Ciclo en curso';$('startTimer').textContent='Pausar';
  const started=referenceStart??Date.now(),duration=state.seconds;
  writeRuntime({running:true,status:'running',duration,remaining:duration,startedAt:new Date(started).toISOString(),mode:'manual'});
  state.timer=setInterval(()=>{state.seconds=Math.max(0,duration-Math.floor((Date.now()-started)/1000));updateTimer();if(state.seconds<=0)finishTime()},1000);
}
function startTimer(){if(state.lifecycleVersion===2){controlGame(runtime()?.running?'pausar':'reanudar');return;}if(!gameStatus()?.active){toast('Primero pulsa Iniciar partida.');return}if(state.round===1&&state.integrationMinutes===60){toast('El período de integración dura una hora y no se pausa.');return}if(cycleMode()==='automatic'){toast('El reloj se controla por la programación automática.');return}if(state.timer){stopTimer('paused');$('roundState').textContent='Pausado';return}beginTimer(false)}
function finishTime(){if(state.timer){clearInterval(state.timer);state.timer=null}state.seconds=0;state.roundClosed=true;writeRuntime({running:false,remaining:0,status:'finished'});$('roundState').textContent='Tiempo finalizado';addEvent('Tiempo del ciclo agotado.','sistema');if(state.round===1&&state.integrationMinutes===60&&cycleMode()==='manual'){advanceRound(false);if(gameStatus()?.active)beginTimer(false)}else if(cycleMode()==='automatic')advanceRound(true);else toast('Tiempo agotado. El docente puede avanzar cuando quiera.')}
function cutRound(){if(state.lifecycleVersion===2){controlGame('cerrar');return;}if(!gameStatus()?.active||state.round===1&&state.integrationMinutes===60){toast('El ciclo de integración debe completar una hora.');return}if(cycleMode()!=='manual'){toast('En modo automático el ciclo se controla por programación.');return}if(state.timer){clearInterval(state.timer);state.timer=null}state.seconds=0;state.roundClosed=true;updateTimer();writeRuntime({running:false,remaining:0,status:'finished'});$('roundState').textContent='Ciclo cortado por docente';addEvent('El docente cerró el ciclo manualmente.','sistema');toast('Ciclo cerrado. Ya puedes avanzar.')}
function refreshAutomaticRuntime(){
  if(state.lifecycleVersion===2){refreshTeacherGame();return;}

  let c,status;try{c=JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG')||'{}');status=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{return}
  if(c.cycleCloseMode!=='automatic'||!status?.active){if(state.scheduleWatcher){clearInterval(state.scheduleWatcher);state.scheduleWatcher=null}return}
  const plan=RULES.cycleSchedule(c),position=RULES.schedulePosition(plan);if(!position)return;
  const previous=runtime(),changed=previous?.round!==position.round||previous?.status!==position.status;
  if(position.status!=='scheduled'){
    const from=previous?.status==='scheduled'||!previous?.running?1:Math.max(1,Number(previous?.round||1));
    for(let round=from;round<=position.round;round++)triggerGroupEvents(round);
  }
  state.round=position.round;state.seconds=position.remaining;state.roundClosed=position.status==='simulation-finished';
  writeRuntime({round:position.round,duration:(plan.cycles[position.round-1].end-plan.cycles[position.round-1].start)/1000,remaining:position.remaining,running:position.status==='running',status:position.status,mode:'automatic',scheduledStart:c.scheduledStart,startedAt:new Date(position.startedAt).toISOString()});
  $('roundState').textContent=position.status==='scheduled'?'Inicio automático programado':position.status==='running'?'Ciclo automático en curso':'Simulación finalizada';
  $('startTimer').textContent='Automático';
  if(position.status==='simulation-finished'){
    localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({...status,active:false,finishedAt:new Date(plan.end).toISOString()}));
    if(state.scheduleWatcher){clearInterval(state.scheduleWatcher);state.scheduleWatcher=null}
    finishSupabasePartida();
  }
  updateTimer();updateRoundDisplay();
  if(changed){renderCycleNews();loadReports();refreshSetupSummary()}
}
function scheduleAutomaticStart(){
  if(!gameStatus()?.active)return false;

  if(state.scheduleWatcher){clearInterval(state.scheduleWatcher);state.scheduleWatcher=null}
  if(state.timer){clearInterval(state.timer);state.timer=null}
  const plan=RULES.cycleSchedule(getConfig());
  if(plan.error){toast(plan.error);return false}
  refreshAutomaticRuntime();
  if(runtime()?.status!=='simulation-finished')state.scheduleWatcher=setInterval(refreshAutomaticRuntime,1000);
  return true;
}

function addEvent(text,type='sistema',meta={}){state.events.unshift({round:state.round,text,type,at:new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),...meta});localStorage.setItem('SIDE_EVENT_LOG',JSON.stringify(state.events));renderEvents()}
function renderEvents(){$('eventLog').innerHTML=state.events.map(e=>`<div class="event-entry"><span><b>Ciclo ${e.round}</b> · ${escapeHtml(e.text)}</span><small>${e.at}</small></div>`).join('')||'<p class="hint">No hay eventos registrados.</p>'}
function eventSchedule(){try{return JSON.parse(localStorage.getItem('SIDE_EVENT_SCHEDULE')||'{}')||{}}catch{return {}}}
function setEventSchedule(s){localStorage.setItem('SIDE_EVENT_SCHEDULE',JSON.stringify(s))}
function triggerGroupEvents(round){
  // No generar eventos en ciclo 1 de integración (solo si hay integración de 60 min)
  if(!gameStatus()?.active||runtime()?.phase==='integration'||(state.lifecycleVersion===2&&state.partidaId)||(round===1&&state.integrationMinutes===60))return {group:[]};
  const schedule=eventSchedule();if(schedule[round])return schedule[round];
  // Solo usar eventos que estén habilitados; si no hay ninguno, retornar vacío sin error
  const candidates=EVENT_CATALOG.filter(e=>e.scope==='group'&&state.enabledEvents.has(e.id));
  if(!candidates.length){schedule[round]={group:[]};setEventSchedule(schedule);return schedule[round];}
  const selected=[];for(const e of candidates){if(Math.random()*100<e.probability)selected.push(e.id);if(selected.length>=2)break}
  schedule[round]={group:selected};setEventSchedule(schedule);
  selected.forEach(id=>{const e=EVENT_CATALOG.find(x=>x.id===id);if(!e)return;addEvent(`${e.title}: ${e.implication}`,'grupal',{eventId:id,impactRound:round+Number(e.cycleOffset||0)})});
  renderCycleNews();return schedule[round];
}
function eventsImpactingRound(round){const schedule=eventSchedule(),out=[];Object.entries(schedule).forEach(([trigger,data])=>(data?.group||[]).forEach(id=>{const e=EVENT_CATALOG.find(x=>x.id===id);if(!e||!state.enabledEvents.has(id))return;const start=Number(trigger)+Number(e.cycleOffset||0),end=start+Math.max(1,Number(e.cycles||1));if(round>=start&&round<end)out.push({...e,triggerRound:Number(trigger),impactRound:start})}));return out}
function renderCycleNews(){const els=eventsImpactingRound(state.round);$('cycleNews').innerHTML=els.length?els.map(e=>`<div class="news-entry"><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(e.implication)}</span><small>GRUPAL · ${escapeHtml(cycleOffsetLabel(e))} · ocurre ${e.probability}% · impacto en ciclo ${e.impactRound}</small></div>`).join(''):'<p class="hint">Sin noticia grupal activa en este ciclo. Los eventos individuales se evalúan por empresa según su probabilidad.</p>'}
function updateEventModeUI(){state.eventSelectionMode=eventSelectionMode();const panel=document.querySelector('.event-mode-panel');panel?.classList.toggle('random-mode',state.eventSelectionMode==='random');panel?.classList.toggle('manual-mode',state.eventSelectionMode==='manual');renderEventBank()}
function randomizeEventSelection(){const candidates=filteredEvents().filter(e=>state.enabledEvents.has(e.id));if(!candidates.length){toast('No hay eventos habilitados con los filtros actuales.');return}const count=Math.max(1,Math.min(candidates.length,Math.min(40,Number($('eventRandomCount')?.value||15))));const shuffled=candidates.slice();for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}state.enabledEvents=new Set(shuffled.slice(0,count).map(e=>e.id));state.eventSelectionMode='random';const radio=document.querySelector('input[name="eventSelectionMode"][value="random"]');if(radio)radio.checked=true;saveConfig(true);updateEventModeUI();toast(`${count} eventos fueron seleccionados aleatoriamente.`)}
function renderEventBank(){
  renderEnabledEvents();
  const body=$('eventBankBody');if(!body)return;
  const events=filteredEvents(),random=eventSelectionMode()==='random';
  body.innerHTML=events.map(e=>`<tr class="${random&&state.enabledEvents.has(e.id)?'random-picked':''}"><td><input class="event-enable" type="checkbox" data-event="${e.id}" ${state.enabledEvents.has(e.id)?'checked':''}  aria-label="Habilitar ${escapeAttr(e.title)}"></td><td><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.description)}</small><span class="event-category">${escapeHtml(e.category||'General')}</span></td><td><span class="scope-badge ${e.scope}">${e.scope==='group'?'GRUPAL':'INDIVIDUAL'}</span></td><td><span class="cycle-offset">${escapeHtml(cycleOffsetLabel(e))}</span></td><td>${escapeHtml(e.implication)}</td><td><b>${e.probability}%</b></td></tr>`).join('')||'<tr><td colspan="6"><p class="hint">No hay eventos que coincidan con los filtros.</p></td></tr>';
  body.querySelectorAll('.event-enable').forEach(i=>i.addEventListener('change',()=>{
    i.checked?state.enabledEvents.add(i.dataset.event):state.enabledEvents.delete(i.dataset.event);
    $('eventSelectionCount').textContent=`${state.enabledEvents.size} seleccionados`;
    updateSelectAllBtn();renderEnabledEvents();saveConfig(true);
  }));
  $('eventSelectionCount').textContent=`${state.enabledEvents.size} seleccionados de ${EVENT_CATALOG.length}`;
  if($('eventVisibleCount'))$('eventVisibleCount').textContent=`Mostrando ${events.length} de ${EVENT_CATALOG.length}`;
  updateSelectAllBtn();
}
function updateSelectAllBtn(){
  const btn=$('eventSelectAll');if(!btn)return;
  const all=EVENT_CATALOG,enabled=all.filter(e=>state.enabledEvents.has(e.id));
  const allSelected=all.length>0&&enabled.length===all.length;
  btn.textContent=allSelected?'Deseleccionar todos':'Seleccionar todos';
  btn.dataset.allSelected=allSelected?'1':'';
}
function toggleSelectAllEvents(){
  const btn=$('eventSelectAll');if(!btn)return;
  const all=EVENT_CATALOG;
  if(!all.length){toast('No hay eventos visibles con los filtros actuales.');return;}
  const allSelected=btn.dataset.allSelected==='1';
  if(allSelected){
    all.forEach(e=>state.enabledEvents.delete(e.id));
    toast(`${all.length} evento(s) deseleccionados.`);
  }else{
    all.forEach(e=>state.enabledEvents.add(e.id));
    toast(`${all.length} evento(s) seleccionados.`);
  }
  renderEventBank();saveConfig(true);
}

/**
 * Promesa de creación en curso (guard anti-doble-clic, Fase C1 fix).
 * Las llamadas concurrentes esperan la misma promesa en vez de crear duplicados.
 * @type {Promise<boolean>|null}
 */
let creatingPartida=null;
/**
 * Crea o reutiliza la partida en Supabase (Fase C1).
 * Guarda el partidaId y el código real generado por la base de datos.
 * Si Supabase no está disponible, continúa en modo local sin bloquear.
 * Anti-doble-clic: una creación en curso se reutiliza, no se duplica.
 * @param {object} config Configuración del formulario (getConfig()).
 * @returns {Promise<boolean>} true si hay partida usable (online u offline).
 */
async function ensureSupabasePartida(config){
  const S=window.SIDE||{};
  if(!S.PartidaService||!S.SupabaseClient?.isReady()){toast('Modo local: la partida no se sincronizará con Supabase.');return true}
  if(state.partidaId)return true;
  if(creatingPartida)return creatingPartida;
  const btn=$('startGame');
  if(btn)btn.disabled=true;
  creatingPartida=(async()=>{
    try{
      const r=await S.PartidaService.crear({
        nombre:config.nombre||'SIDE — Simulación Principal',
        curso:config.curso||'',
        configuracion:{...config,scheduledStart:config.scheduledStart?new Date(config.scheduledStart).toISOString():''},
        eventos_habilitados:config.enabledEvents||[]
      });
      if(!r.success){toast('No se pudo iniciar la partida: '+(r.error||'error de conexión')+'. Vuelve a intentarlo.');return false}
  state.partidaId=r.data.id;
  try{localStorage.setItem('SIDE_PARTIDA_ID',state.partidaId)}catch{}
  if(r.data.codigo){$('gameCode').value=r.data.codigo;$('gameCodeBadge').textContent=r.data.codigo;}
  if(config.lifecycleVersion===2){
    if(r.data.configuracion?.runtime?.phase!=='integration'){toast('Falta aplicar docs/supabase_game_lifecycle.sql en Supabase.');return false;}
    applyTeacherState(r.data);
  }else saveConfig(true);
  // Partida nueva: el contador local vuelve al ciclo 1 (no hereda el anterior).
  state.round=1;state.seconds=roundSeconds();state.roundClosed=false;
  try{localStorage.setItem('SIDE_ACTIVE_ROUND','1')}catch{}
  updateTimer();updateRoundDisplay();
      toast('Partida creada en Supabase: '+r.data.codigo);return true;
    }finally{
      creatingPartida=null;
      if(btn)btn.disabled=false;
    }
  })();
  return creatingPartida;
}
// La configuración remota recibida es la fuente de verdad; no se vuelve a publicar
// un runtime calculado en el navegador sobre el estado del servidor.
let teacherClock=null,teacherPoll=null,teacherTick=null,teacherBusy=false,teacherRead=Promise.resolve();
function teacherNow(){return teacherClock?teacherClock.time+performance.now()-teacherClock.at:Date.now();}
function applyTeacherState(partida){
  const c=partida.configuracion;if(!c)return;
  if(partida.serverTime)teacherClock={time:Date.parse(partida.serverTime),at:performance.now()};
  state.authoritative=c;state.lifecycleVersion=c.lifecycleVersion===2?2:1;
  state.integrationMinutes=Number(c.integrationMinutes)||0;
  const r=c.runtime||{};state.round=Number(r.round||1);state.roundClosed=['results','finished'].includes(r.phase);
  state.enabledEvents=new Set(c.enabledEvents||[]);
  if(c.runtime?.phase==='finished')$('roundState').textContent='Simulación finalizada';
  localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...c,codigo:partida.codigo||$('gameCode').value}));
  localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(r));
  localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round));
  localStorage.setItem('SIDE_EVENT_SCHEDULE',JSON.stringify(c.eventSchedule||{}));
  localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:partida.estado!=='finalizada',startedAt:c.gameStartedAt,finishedAt:partida.estado==='finalizada'?new Date(teacherNow()).toISOString():null,code:partida.codigo||$('gameCode').value}));
  paintTeacherClock();updateRoundDisplay();refreshSetupSummary();renderCycleNews();renderEventBank();
}
function paintTeacherClock(){
  const r=runtime(),c=state.authoritative;if(!c||!r)return;
  state.seconds=r.phase==='integration'&&c.gameStartAt?Math.max(0,Math.ceil((Date.parse(c.gameStartAt)-teacherNow())/1000)):r.running?Math.max(0,Math.ceil((Date.parse(r.startedAt)+r.duration*1000-teacherNow())/1000)):Number(r.remaining||0);
  if(r.phase==='integration'&&c.cycleCloseMode==='manual')state.seconds=0;
  updateTimer();$('startTimer').textContent=r.running?'Pausar':'Reanudar';
}
async function refreshTeacherGame(){
  if(state.lifecycleVersion!==2||!gameStatus()?.active||teacherBusy)return;
  if(state.partidaId){
    teacherBusy=true;
    try{teacherRead=window.SIDE.PartidaService.controlar(state.partidaId,'sincronizar');const result=await teacherRead;if(result.success)applyTeacherState(result.data);}
    finally{teacherBusy=false;}
  }else{
    const c={...state.authoritative,runtime:RULES.resolveRuntime(state.authoritative,teacherNow())};
    if(c.runtime.phase!=='integration'){c.phase=c.runtime.phase;c.gameStartedAt=c.gameStartedAt||c.gameStartAt;}
    applyTeacherState({configuracion:c,estado:c.runtime.phase==='finished'?'finalizada':c.runtime.phase==='integration'?'esperando':'activa'});
    if(c.runtime.phase!=='integration'){triggerGroupEvents(c.runtime.round);state.authoritative.eventSchedule=eventSchedule();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(state.authoritative));}
  }
}
function watchTeacherGame(){
  if(teacherPoll)clearInterval(teacherPoll);if(teacherTick)clearInterval(teacherTick);
  teacherPoll=setInterval(refreshTeacherGame,3000);
  teacherTick=setInterval(()=>{paintTeacherClock();if(!state.partidaId)refreshTeacherGame();},1000);
}
async function prepareGame(){
  if(gameStatus()?.active)return true;
  state.lifecycleVersion=2;state.integrationMinutes=0;state.authoritative=null;
  if(!saveConfig(false))return false;
  if(gameStatus()?.finishedAt){await finishingPartida;state.partidaId=null;publishedState='';localStorage.removeItem('SIDE_PARTIDA_ID');localStorage.removeItem('SIDE_EVENT_SCHEDULE');}
  state.round=1;state.roundClosed=false;
  if(!await ensureSupabasePartida(getConfig()))return false;
  if(!state.partidaId){
    const c=getConfig(),now=Date.now();
    c.gameStartAt=c.cycleCloseMode==='automatic'?new Date(Math.max(now,Date.parse(c.scheduledStart)||now)+c.integrationDurationMinutes*60000).toISOString():null;
    c.gameStartedAt=null;c.integrationStartTime=new Date(now).toISOString();c.phase='integration';c.eventSchedule={};
    c.runtime={round:1,phase:'integration',status:'waiting',running:false,duration:roundSeconds(),remaining:roundSeconds(),mode:cycleMode()};
    applyTeacherState({configuracion:c,estado:'esperando'});
  }
  watchTeacherGame();startLiveCompanies();return true;
}
async function controlGame(action){
  const expectedRound=state.round;
  await teacherRead;
  if(teacherBusy)return false;
  teacherBusy=true;
  try{
    if(state.partidaId){
      const result=await window.SIDE.PartidaService.controlar(state.partidaId,action,null,expectedRound);
      if(!result.success){toast(result.error||'No se pudo actualizar la partida.');return false;}
      applyTeacherState(result.data);
    }else{
      const c={...state.authoritative},r={...c.runtime},now=new Date().toISOString(),duration=roundSeconds();
      if(action==='iniciar'&&r.phase==='integration'&&cycleMode()==='manual'){
        c.gameStartAt=now;c.gameStartedAt=now;Object.assign(r,{phase:'decisions',status:'running',running:true,startedAt:now,duration,remaining:duration});
      }else if(cycleMode()==='manual'&&['decisions','results'].includes(r.phase)){
        if(action==='avanzar')Object.assign(r,r.round>=c.cycles?{phase:'finished',status:'simulation-finished',running:false,remaining:0}:{round:r.round+1,phase:'decisions',status:'running',running:true,startedAt:now,duration,remaining:duration});
        if(action==='cerrar')Object.assign(r,{phase:'results',status:'finished',running:false,remaining:0});
        if(action==='pausar'&&r.running)Object.assign(r,{status:'paused',running:false,remaining:state.seconds});
        if(action==='reanudar'&&r.status==='paused')Object.assign(r,{status:'running',running:true,startedAt:now,duration:r.remaining});
      }
      c.runtime=r;c.phase=r.phase;c.round=r.round;
      applyTeacherState({configuracion:c,estado:r.phase==='finished'?'finalizada':r.phase==='integration'?'esperando':'activa'});
      if(r.phase==='decisions'){triggerGroupEvents(r.round);state.authoritative.eventSchedule=eventSchedule();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(state.authoritative));}
    }
    return true;
  }finally{teacherBusy=false;}
}
async function startGame(){
  if(state.starting)return;
  state.starting=true;refreshStartButton();
  try{
    if(!await prepareGame())return;
    if(cycleMode()==='manual')await controlGame('iniciar');
    else toast('Inicio automático configurado.');
    switchTab('rondas');
  }finally{state.starting=false;refreshSetupSummary();}
}
async function startCycle1(){return startGame();}
/**
 * Propaga el avance de ciclo a Supabase (Fase C3).
 * Sube ciclo_actual de todas las empresas de la partida vía RPC avanzar_ciclo.
 * Fire-and-forget con guard: no bloquea el flujo local ni cambia firmas.
 */
function syncRoundToSupabase(){
  if(state.lifecycleVersion===2)return;

  try{
    const S=window.SIDE||{};
    if(!S.PartidaService||!S.SupabaseClient?.isReady()||!state.partidaId)return;
    publishGameState().then(()=>S.PartidaService.avanzarCiclo(state.partidaId)).then(r=>{
      if(!r.success&&!r.offline)console.warn('SIDE: avanzar ciclo:',r.error);
    });
  }catch(error){console.error('SIDE: supabase advance failed',error)}
}
/**
 * Aísla la sesión local por profesor (equipos compartidos).
 * Si la sesión actual es de otro profesor que el que dejó datos en este
 * navegador, se purgan las claves de partida/config/juego para no mostrarle
 * datos ajenos. Sin sesión (demo) u offline no se toca nada. Solo purga ante
 * confirmación positiva de cambio de cuenta; nunca por error de red.
 */
async function purgeForeignProfessorState(){
  try{
    const S=window.SIDE||{};
    const sb=S.SupabaseClient?.get();
    if(!sb||!S.SupabaseClient?.isReady())return;
    const {data}=await sb.auth.getUser();
    const uid=data?.user?.id||null;
    if(!uid)return;
    let stored=null;
    try{stored=localStorage.getItem('SIDE_PROFESOR_ID')}catch{}
    if(stored&&stored!==uid){
      ['SIDE_PARTIDA_ID','SIDE_TEACHER_CONFIG','SIDE_ASSIGNED_GAME_CODE','SIDE_GAME_STATUS','SIDE_ACTIVE_ROUND','SIDE_ROUND_RUNTIME','SIDE_EVENT_LOG','SIDE_EVENT_SCHEDULE','SIDE_STUDENT_REPORTS','SIDE_PUBLISHED_PODIUM','SIDE_TEACHER_GRADES'].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
    }
    try{localStorage.setItem('SIDE_PROFESOR_ID',uid)}catch{}
  }catch(error){console.error('SIDE: professor isolation check failed',error)}
}
/**
 * Texto del botón principal según haya partida activa vinculada o no.
 * Sin partida → Iniciar partida; con partida → Partida iniciada.
 */
function refreshStartButton(){
  const btn=$('startGame');if(!btn)return;
  const active=Boolean(gameStatus()?.active);
  const waiting=runtime()?.phase==='integration'&&cycleMode()==='manual';
  btn.textContent=state.starting?'Iniciando…':active&&!waiting?(runtime()?.phase==='integration'?'Inicio automático configurado':'Partida iniciada'):'Iniciar partida';
  btn.disabled=state.starting||(active&&!waiting);
}
/**
 * Cierra la partida en Supabase al finalizar la simulación.
 * Conserva el vínculo para consultar resultados; el próximo inicio crea otra partida.
 */
let finishingPartida=Promise.resolve();
function finishSupabasePartida(){
  try{
    const S=window.SIDE||{};
    if(S.PartidaService&&S.SupabaseClient?.isReady()&&state.partidaId){
      const id=state.partidaId;
      finishingPartida=publishChain.catch(()=>{}).then(()=>S.PartidaService.finalizar(id)).then(r=>{
        if(!r.success&&!r.offline)console.warn('SIDE: finalizar partida:',r.error);
      });
    }
  }catch(error){console.error('SIDE: supabase finish failed',error)}
  // Keep the completed game linked so its online companies and results remain available.
  refreshStartButton();
}
function advanceRound(fromAuto=false){
  if(state.lifecycleVersion===2){controlGame('avanzar');return;}

  if(!gameStatus()?.active){toast('Primero pulsa Iniciar partida.');return}
  // Bloquear avance solo si hay integración de 60 min Y quedan segundos en round 1
  if(state.round===1&&state.integrationMinutes===60&&state.seconds>0){
    toast('Espera a que termine la hora de integración.');return;
  }
  if(cycleMode()==='automatic'&&!fromAuto){toast('Los ciclos avanzan según el calendario automático.');return}
  const max=Number($('cycles').value||6);
  if(state.round>=max){
    if(state.timer){clearInterval(state.timer);state.timer=null}
    state.roundClosed=true;
    writeRuntime({running:false,status:'simulation-finished',remaining:0});
    localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:false,finishedAt:new Date().toISOString(),code:$('gameCode').value}));
    finishSupabasePartida();refreshSetupSummary();
    $('roundState').textContent='Simulación finalizada';
    toast('La simulación llegó al último ciclo.');return;
  }
  if(state.timer){clearInterval(state.timer);state.timer=null}
  state.round++;state.roundClosed=false;state.seconds=roundSeconds();
  localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round));
  triggerGroupEvents(state.round);saveConfig(true);updateTimer();updateRoundDisplay();loadReports();
  if(cycleMode()==='automatic'||fromAuto){
    writeRuntime({round:state.round,running:false,status:'ready',remaining:state.seconds});
    beginTimer(true);$('roundState').textContent='Nuevo ciclo automático';
  }else{
    writeRuntime({round:state.round,running:false,status:'ready',remaining:state.seconds});
    $('roundState').textContent='Nuevo ciclo listo';
    toast(`Ciclo ${state.round} disponible.`);
  }
}

/** Caché del catálogo Supabase para mapear IDs a etiquetas (Fase C2). @type {object|null} */
let catalogCache=null;
/**
 * Catálogo Supabase cacheado en memoria.
 * @returns {Promise<object|null>} {decisions, decById: Map, optById: Map} o null si offline.
 */
async function supabaseCatalog(){
  const S=window.SIDE||{};
  if(!S.DecisionesService||!S.SupabaseClient?.isReady())return null;
  if(catalogCache)return catalogCache;
  const r=await S.DecisionesService.obtenerCatalogo();
  if(!r.success)return null;
  catalogCache={
    decisions:r.data.decisions||[],
    decById:new Map((r.data.decisions||[]).map(d=>[d.id,d])),
    optById:new Map((r.data.options||[]).map(o=>[o.id,o]))
  };
  return catalogCache;
}
/**
 * Calcula apartados y progreso desde decisiones sincronizadas (no local).
 * Obligatorio = catálogo con es_obligatoria=true y tipo distinto de 'info'.
 * Nota: MOLDE es condicional en local (solo si no hay moldes propios); aquí
 * cuenta siempre como obligatorio (aproximación documentada).
 * @param {object|null} cat Catálogo cacheado {decisions, decById}.
 * @param {Array} rows Filas de empresas_decisiones del ciclo actual.
 * @returns {{apartados: object, progreso: number, total: number}} total = obligatorias del catálogo.
 */
function remoteProgress(cat,rows){
  const oblig=new Map();
  for(const d of (cat?.decisions||[])){
    if(d.tipo==='info'||d.es_obligatoria!==true)continue;
    if(!oblig.has(d.categoria))oblig.set(d.categoria,new Set());
    oblig.get(d.categoria).add(d.decision_id);
  }
  const synced=new Map();
  for(const r of (rows||[])){
    const dd=cat?.decById.get(r.decision_id);
    if(!dd?.decision_id)continue;
    const c=dd.categoria||'?';
    if(!synced.has(c))synced.set(c,new Set());
    synced.get(c).add(dd.decision_id);
  }
  const apartados={};let doneAll=0,totalAll=0;
  for(const c of ['B','C','D','E','F']){
    const tot=oblig.get(c)||new Set();
    const don=[...(synced.get(c)||new Set())].filter(x=>tot.has(x));
    doneAll+=don.length;totalAll+=tot.size;
    apartados[c]={complete:tot.size?don.length>=tot.size:true,done:don.length,total:tot.size};
  }
  return{apartados,progreso:totalAll?Math.round(100*doneAll/totalAll):0,total:totalAll};
}
/**
 * Construye reportes desde Supabase para la partida actual (Fase C2).
 * Fusión: Supabase manda en campos sincronizados (decisiones, caja, ciclo,
 * enviado, apartados y progreso calculados del ciclo actual); local conserva
 * lo vivo (actividad, financieros, puntaje) y sirve de respaldo sin filas.
 * @returns {Promise<Array|null>} Reportes fusionados o null si offline/sin partida.
 */
async function supabaseReports(){
  const S=window.SIDE||{};
  if(!S.PartidaService||!S.DecisionesService||!S.SupabaseClient?.isReady())return null;
  if(!state.partidaId)return null;
  const parts=await S.PartidaService.listarParticipantes(state.partidaId);
  if(!parts.success)return null;
  const roster=(parts.data||[]).filter(p=>p.empresa_id).map(p=>({id:'sb-'+p.empresa_id,empresaId:p.empresa_id,teacherScore:p.puntaje_docente??null,partida:$('gameCode').value,empresa:p.empresas?.nombre_comercial||p.empresa,nombre:p.nombre||'Jugador',ronda:p.empresas?.ciclo_actual||1,caja:p.empresas?.caja_actual||0,fuente:'supabase',estado:'activa'}));
  const known=new Set(state.reports.map(r=>r.empresa));
  state.reports.push(...roster.filter(r=>!known.has(r.empresa)));renderCompanies();
  const cat=await supabaseCatalog();
  const code=$('gameCode').value;
  const localBase=state.reports||[];
  const out=[];
  for(const p of (parts.data||[])){
    if(!p.empresa_id)continue;
    const rr=await S.DecisionesService.obtenerReporte(p.empresa_id);
    const info=rr.success?rr.data:null;
    const emp=info?.empresa||p.empresas||{};
    const cicloActual=Number(emp.ciclo_actual)||1;
    const rows=(info?.decisiones||[]).filter(d=>Number(d.ciclo)===cicloActual);
    const labels=rows.map(d=>{
      const dd=cat?.decById.get(d.decision_id);
      const codeName=dd?.decision_id||('decisión '+d.decision_id);
      const op=cat?.optById.get(d.opcion_id);
      const qty=Number(d.cantidad)||1;
      return op?`${codeName} · ${op.etiqueta}${qty>1?` ×${qty}`:''}`:`${codeName}${qty>1?` ×${qty}`:''}`;
    });
    const local=localBase.find(x=>x.empresa===(emp.nombre_comercial||p.empresa));
    const prog=rows.length?remoteProgress(cat,rows):{apartados:{},progreso:0,total:0};
    const rep=((info?.reportes)||[]).find(r=>Number(r.ciclo)===cicloActual)||null;
    out.push({
      id:local?.id||('sb-'+p.empresa_id),empresaId:p.empresa_id,teacherScore:p.puntaje_docente??null,
      nombre:p.nombre||local?.nombre||'Jugador',
      empresa:emp.nombre_comercial||p.empresa,
      partida:code,
      ronda:cicloActual,rondasActivas:cicloActual,
      capital:rep?Number(rep.capital):(emp.caja_inicial??local?.capital??0),
      caja:rep?Number(rep.caja_final):(emp.caja_actual??local?.caja??0),
      ingresos:rep?Number(rep.ingresos):(local?.ingresos??0),
      costos:rep?Number(rep.costos):(local?.costos??0),
      utilidad:rep?Number(rep.utilidad):(local?.utilidad??0),
      decisiones:labels.length?labels:(local?.decisiones||[]),
      enviado:rows.some(d=>d.enviada)||!!local?.enviado,
      eventos:local?.eventos||[],
      estadoResultados:rep?.estado_resultados||local?.estadoResultados||{},
      balanceCaja:rep?.balance_caja||local?.balanceCaja||{},
      balanceGeneral:rep?.balance_caja?.balanceGeneral||local?.balanceGeneral||{},
      flujoCaja:rep?.flujo_caja||local?.flujoCaja||{},
      apartados:prog.total>0?prog.apartados:(local?.apartados||{}),progreso:prog.total>0?prog.progreso:(local?.progreso||0),
      score:rep?Number(rep.score):(local?.score||0),
      estado:local?.estado||'activa',tomandoDecisiones:!!local?.tomandoDecisiones,
      updatedAt:new Date().toISOString(),fuente:'supabase'
    });
  }
  const names=new Set(out.map(r=>r.empresa));
  for(const l of localBase){if(!names.has(l.empresa))out.push(l)}
  return out;
}
let reportsBusy=false,reportsAgain=false;
async function loadReports(){
  if(reportsBusy){reportsAgain=true;return;}reportsBusy=true;
  try{
  const cached=state.reports;
  try{state.reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')||[]}catch{state.reports=[]}
  const names=new Set(state.reports.map(r=>r.empresa));
  if(state.partidaId)state.reports.push(...cached.filter(r=>r.fuente==='supabase'&&!names.has(r.empresa)));
  state.reports=state.reports.filter(r=>r.partida===$('gameCode').value);
  renderCompanies();
  try{
    const remote=await supabaseReports();
    if(remote)state.reports=remote;
  }catch(error){console.error('SIDE: no se pudieron cargar reportes de Supabase',error)}
  renderCompanies();renderResults();renderWinnerSelect();
  }finally{reportsBusy=false;if(reportsAgain){reportsAgain=false;setTimeout(loadReports,100);}}
}
function sectionBadges(r){const a=r.apartados||{};return Object.entries(a).map(([k,v])=>`<span class="section-status ${v.complete?'done':'pending'}">${escapeHtml(k)} ${v.complete?'✓':`${v.done||0}/${v.total||0}`}</span>`).join('')||'<span class="section-status pending">Sin datos</span>'}
function companyActivity(r){const recent=r.conectada&&Date.now()-Date.parse(r.updatedAt||'')<20000;return recent?(r.integracion?'CONECTADA · EN INTEGRACIÓN':r.tomandoDecisiones?'CONECTADA · TOMANDO DECISIONES':'CONECTADA · EN SALA'):r.fuente==='supabase'?'REGISTRADA EN LA PARTIDA':'SIN CONEXIÓN RECIENTE'}
function gradeKey(r){return `${$('gameCode').value}:${r.empresaId||r.empresa.trim().toUpperCase()}`;}
function grades(){try{return JSON.parse(localStorage.getItem('SIDE_TEACHER_GRADES')||'{}')||{}}catch{return {}}}
function gradeValue(r){const local=grades()[gradeKey(r)];return local?.pending||r.teacherScore==null?(local?.value??r.teacherScore??null):r.teacherScore;}
function gradeLabel(r){const value=gradeValue(r);return value==null?'Sin calificar':`${Number(value).toLocaleString('es-PE')} / 20`;}
async function saveCompanyGrade(id,value){
  const report=state.reports.find(r=>r.id===id);if(!report)return;
  if(String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>20){toast('Escribe una nota entre 0 y 20.');return false;}
  const note=Math.round(Number(value)*100)/100,all=grades(),key=gradeKey(report),entry={value:note,pending:Boolean(report.empresaId&&state.partidaId),updatedAt:new Date().toISOString()};
  all[key]=entry;localStorage.setItem('SIDE_TEACHER_GRADES',JSON.stringify(all));
  if(entry.pending){
    const result=await window.SIDE.PartidaService.guardarPuntaje(state.partidaId,report.empresaId,note);
    if(result.success){report.teacherScore=note;const latest=grades();if(latest[key]?.updatedAt===entry.updatedAt){latest[key].pending=false;localStorage.setItem('SIDE_TEACHER_GRADES',JSON.stringify(latest));}toast('Puntaje guardado.');}
    else toast('Nota guardada en este equipo; sincronización pendiente. '+(result.error||''));
  }else toast('Puntaje guardado.');
  renderCompanies(true);renderResults();renderWinnerSelect();return true;
}
function renderCompanies(force=false){
  if($('companiesLiveStatus'))$('companiesLiveStatus').textContent=`${state.reports.length} empresa(s) registrada(s) · actualización automática cada 3 segundos`;
  const grid=$('companiesGrid');
  // Background polling must not erase a grade the teacher is currently typing.
  if(!force&&grid.contains(document.activeElement)&&document.activeElement.closest('.company-grade'))return;
  grid.innerHTML=state.reports.map((r,i)=>`<article class="company-card"><div class="company-status-line"><span class="live-dot ${r.tomandoDecisiones?'online':'idle'}"></span><b>${companyActivity(r)}</b></div><h3>${escapeHtml(r.empresa)}</h3><small>${escapeHtml(r.nombre||'Jugador')} · ciclo ${r.rondasActivas||r.ronda||0}</small><div class="section-status-row">${sectionBadges(r)}</div><div class="score">${Number(r.progreso||0)}% decisiones obligatorias</div><div class="metric"><span>Caja</span><b>${money(r.caja??r.capital)}</b></div><div class="metric"><span>Utilidad del ciclo</span><b>${money(r.utilidad)}</b></div><form class="company-grade" data-grade-form="${escapeAttr(r.id)}"><label for="grade-${i}">Puntaje del profesor · 0 a 20</label><div><input id="grade-${i}" data-grade type="number" min="0" max="20" step="0.01" required value="${gradeValue(r)??''}" placeholder="Sin calificar"><button class="secondary" type="submit">Guardar nota</button></div><small>${grades()[gradeKey(r)]?.pending?'Guardada en este equipo · pendiente de sincronizar':gradeLabel(r)}</small></form><button class="eliminate" data-eliminate="${i}">${r.estado==='eliminada'?'Reactivar empresa':'Eliminar por inactividad'}</button></article>`).join('')||'<div class="card">Aún no hay empresas reportadas en esta partida.</div>';
  grid.querySelectorAll('[data-eliminate]').forEach(b=>b.addEventListener('click',()=>toggleElimination(Number(b.dataset.eliminate))));
  grid.querySelectorAll('[data-grade-form]').forEach(form=>form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await saveCompanyGrade(form.dataset.gradeForm,form.querySelector('input').value);}finally{button.disabled=false;}}));
}
function toggleElimination(i){const r=state.reports[i];if(!r)return;r.estado=r.estado==='eliminada'?'activa':'eliminada';persistReports();renderCompanies();renderResults();renderWinnerSelect();toast(r.empresa+(r.estado==='eliminada'?' fue marcada como eliminada.':' fue reactivada.'))}
function persistReports(){localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(state.reports))}

function eventReportTable(r){const events=r.eventos||[];if(!events.length)return '<p class="hint">Sin eventos reportados.</p>';return `<div class="mini-event-report"><div class="mini-event-head"><span>Descripción</span><span>Afectados</span><span>Ciclos</span><span>Implicancia</span><span>Ocurrencia</span></div>${events.map(e=>`<div><span><b>${escapeHtml(e.titulo||'Evento')}</b><small>${escapeHtml(e.descripcion||'')}</small></span><span>${escapeHtml(e.afectados||'')}</span><span>${escapeHtml(e.cicloAfecta||String(e.ciclos||1))}</span><span>${escapeHtml(e.implicancia||'')}</span><span>${Number(e.ocurrencia||0)}%</span></div>`).join('')}</div>`}

function teacherFinancialDetail(r){
  const fc=r.flujoCaja||{},bg=r.balanceGeneral||r.balanceCaja?.balanceGeneral;
  const row=(label,value)=>`<div class="metric"><span>${label}</span><b>${money(value)}</b></div>`;
  return `<details><summary>Flujo de caja y balance general</summary>${row('Caja al inicio',fc.cajaInicial??r.balanceCaja?.cajaInicial)}${row('Cobros por ventas',fc.cobrosVentas)}${row('Devoluciones',fc.reembolsos)}${row('Pagos operativos',fc.pagosOperacion)}${row('Eventos',fc.eventos)}${row('Otros movimientos',fc.otros)}${row('Compra de activos',fc.compraActivos)}${row('Venta de activos',fc.ventaActivos)}${row('Préstamos recibidos',fc.financiamiento)}${row('Caja al cierre',fc.cajaFinal??r.caja)}<h4>Balance general</h4>${bg?row('Efectivo',bg.efectivo)+row('Equipos, moldes y mejoras',bg.activosFijos)+row('Total activos',bg.activos)+row('Deuda financiera',bg.deuda)+row('Patrimonio',bg.patrimonio)+row('Pasivo + patrimonio',bg.pasivoPatrimonio):'<p>El alumno aún no ha sincronizado este balance.</p>'}</details>`;
}
function renderResults(){
  const active=state.reports.filter(r=>r.estado!=='eliminada'),totalProfit=active.reduce((s,r)=>s+Number(r.utilidad||0),0),graded=active.filter(r=>gradeValue(r)!=null),best=graded.sort((a,b)=>gradeValue(b)-gradeValue(a))[0];
  $('resultStats').innerHTML=[['Empresas',state.reports.length],['Calificadas',graded.length],['Utilidad del ciclo',money(totalProfit)],['Mayor nota',best?gradeLabel(best):'Sin calificar']].map(x=>`<div class="stat"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');
  $('incomeStatementBody').innerHTML=state.reports.map(r=>{const x=r.estadoResultados||{};return `<tr><td><b>${escapeHtml(r.empresa)}</b></td><td>${money(x.ventasNetas??x.ingresos??r.ingresos)}</td><td>${money(x.costos??r.costos)}</td><td>${money(x.impactoEventos)}</td><td>${money(Number(x.resultadoVentaActivos||0)+Number(x.otros||0))}</td><td>${money(x.utilidad??r.utilidad)}</td></tr>`}).join('');
  $('cashBalanceBody').innerHTML=state.reports.map(r=>{const x=r.balanceCaja||{};return `<tr><td><b>${escapeHtml(r.empresa)}</b></td><td>${money(x.cajaInicial??r.capital)}</td><td>${money(x.entradas)}</td><td>${money(x.salidas)}</td><td>${money(x.cajaFinal??r.caja)}</td></tr>`}).join('');
  $('cashFlowBody').innerHTML=state.reports.map(r=>{const x=r.flujoCaja||{};return `<tr><td><b>${escapeHtml(r.empresa)}</b></td><td>${money(x.operacion)}</td><td>${money(x.inversion)}</td><td>${money(x.financiamiento)}</td><td>${money(x.flujoNeto)}</td></tr>`}).join('');
  $('detailReports').innerHTML=state.reports.map(r=>`<div class="report-detail"><h4>${escapeHtml(r.empresa)} · ${gradeLabel(r)}</h4><div class="section-status-row">${sectionBadges(r)}</div>${teacherFinancialDetail(r)}<p><b>Actualizado:</b> ${r.updatedAt?new Date(r.updatedAt).toLocaleString('es-PE'):'—'}</p>${eventReportTable(r)}</div>`).join('')||'<p class="hint">Sin resultados recibidos.</p>';
}
function renderWinnerSelect(){
  const sel=$('winnerSelect'),selected=sel.value;
  const active=state.reports.filter(r=>r.estado!=='eliminada');
  sel.innerHTML=active.map(r=>`<option value="${escapeAttr(r.empresa)}">${escapeHtml(r.empresa)} — ${gradeLabel(r)}</option>`).join('');
  if(active.some(r=>r.empresa===selected))sel.value=selected;
  renderPodium();
}
function publishedPodium(){try{return JSON.parse(localStorage.getItem('SIDE_PUBLISHED_PODIUM')||'null')}catch{return null}}
function podiumCandidates(){
  const winner=$('winnerSelect').value,list=state.reports.filter(r=>r.estado!=='eliminada').sort((a,b)=>Number(gradeValue(b)??-1)-Number(gradeValue(a)??-1));
  const idx=list.findIndex(r=>r.empresa===winner);
  if(idx>0)[list[0],list[idx]]=[list[idx],list[0]];
  return list.slice(0,3);
}
function renderPodium(){
  const publication=publishedPodium(),sameGame=publication&&(!publication.code||publication.code===$('gameCode').value);
  const visible=RULES.podiumVisible(publication,$('gameCode').value);
  const list=visible?publication.podium:sameGame?[]:podiumCandidates();
  const names=['🥇','🥈','🥉'],classes=['first','second','third'];
  $('podiumState').textContent=visible?'Publicado · 24 horas':sameGame?'Publicación vencida':'Vista previa';
  $('publishStatus').textContent=visible?'Disponible hasta: '+new Date(RULES.podiumExpiry(publication)).toLocaleString('es-PE'):sameGame?'El podio dejó de mostrarse al cumplirse 24 horas.':'El podio será visible durante 24 horas desde su publicación.';
  $('podiumPreview').innerHTML=list.map((r,i)=>`<div class="podium-place ${classes[i]}"><span>${names[i]}</span><strong>${escapeHtml(r.empresa)}</strong><small>${r.grade!=null?Number(r.grade).toLocaleString('es-PE')+' / 20':visible?'Sin calificar':gradeLabel(r)}</small></div>`).join('')||`<p>${sameGame?'La publicación del podio ha finalizado.':'Sin empresas activas.'}</p>`;
}
function publishPodium(){
  const winner=$('winnerSelect').value;if(!winner){toast('Selecciona una empresa ganadora.');return}
  const publication={code:$('gameCode').value,publishedAt:new Date().toISOString(),winner,reason:$('winnerReason').value,podium:podiumCandidates().map(r=>({empresa:r.empresa,grade:gradeValue(r)}))};
  publication.expiresAt=new Date(RULES.podiumExpiry(publication)).toISOString();
  localStorage.setItem('SIDE_PUBLISHED_PODIUM',JSON.stringify(publication));
  renderPodium();toast('Podio publicado por 24 horas.');
}
function loadPublished(){
  const p=publishedPodium();
  if(RULES.podiumVisible(p,$('gameCode').value)){$('winnerSelect').value=p.winner;$('winnerReason').value=p.reason||'';}
  renderPodium();
}
setInterval(renderPodium,1000);
function switchTab(tab){if(tab==='rondas'&&!gameStatus()?.active&&!gameStatus()?.finishedAt)return;document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));const titles={configuracion:'Configuración de la simulación',rondas:'Ciclos y eventos',empresas:'Empresas participantes',resultados:'Resultados',podio:'Ganador y podio'};$('pageTitle').textContent=titles[tab];if(['empresas','resultados','podio'].includes(tab))loadReports();if(tab==='podio')loadPublished()}
function makePdf(){
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'pt',format:'a4'});let y=45;
  const line=(text,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(bold?12:10);for(const row of doc.splitTextToSize(text,510)){if(y>770){doc.addPage();y=45;}doc.text(row,40,y);y+=15;}};
  line('SIDE — Resultados',true);line(`${getConfig().nombre} · ${$('gameCode').value}`);
  for(const r of state.reports.filter(r=>r.estado!=='eliminada')){
    y+=12;const er=r.estadoResultados||{},bc=r.balanceCaja||{},fc=r.flujoCaja||{},bg=r.balanceGeneral||bc.balanceGeneral;
    line(`${r.empresa} · Ciclo ${r.ronda} · Nota: ${gradeLabel(r)}`,true);
    line(`Resultados: ventas netas ${money(er.ventasNetas??er.ingresos)}; gastos ${money(er.costos)}; eventos ${money(er.impactoEventos)}; otros resultados ${money(Number(er.otros||0)+Number(er.resultadoVentaActivos||0))}; utilidad ${money(er.utilidad)}.`);
    line(`Caja: inicial ${money(bc.cajaInicial)} + entradas ${money(bc.entradas)} - salidas ${money(bc.salidas)} = final ${money(bc.cajaFinal)}.`);
    line(`Flujo: operación ${money(fc.operacion)}; inversión ${money(fc.inversion)}; financiamiento ${money(fc.financiamiento)}; neto ${money(fc.flujoNeto)}.`);
    if(bg)line(`Balance: efectivo ${money(bg.efectivo)}; activos fijos ${money(bg.activosFijos)}; activos totales ${money(bg.activos)} = deuda ${money(bg.deuda)} + patrimonio ${money(bg.patrimonio)}.`);
  }
  return doc;
}
function showPdf(){const doc=makePdf(),blob=doc.output('blob'),url=URL.createObjectURL(blob);$('pdfFrame').src=url;$('pdfModal').classList.remove('hidden')}
function downloadPdf(){makePdf().save(($('gameCode').value||'SIDE')+'-resultados.pdf')}

window.addEventListener('storage',e=>{if(e.key==='SIDE_STUDENT_REPORTS'){loadReports()}if(e.key==='SIDE_ROUND_RUNTIME'){const r=runtime();if(r&&gameStatus()?.active){state.round=Number(r.round||state.round);state.seconds=Number(r.remaining??state.seconds);updateTimer();updateRoundDisplay()}}});

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
document.querySelectorAll('#tab-configuracion input').forEach(input=>{
  input.addEventListener(input.type==='radio'?'change':'input',()=>{
    if(gameStatus()?.active)return;
    if(['capitalMode','cycleMode'].includes(input.name))syncModeUI();
    if(['startDate','endDate'].includes(input.id)&&cycleMode()==='manual')state.manualDates={start:$('startDate').value,end:$('endDate').value};
    state.round=1;state.seconds=roundSeconds();updateTimer();updateRoundDisplay();refreshSetupSummary();saveConfig(true);
  });
});
$('openEventPicker')?.addEventListener('click',()=>{$('eventPicker').showModal();renderEventBank()});
$('closeEventPicker')?.addEventListener('click',()=>$('eventPicker').close());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cycleMode()==='automatic')refreshAutomaticRuntime()});
document.querySelectorAll('input[name="eventSelectionMode"]').forEach(i=>i.addEventListener('change',()=>{state.eventSelectionMode=i.value;saveConfig(true);updateEventModeUI()}));
$('eventRandomize')?.addEventListener('click',randomizeEventSelection);
$('eventClearSelection')?.addEventListener('click',()=>{state.enabledEvents.clear();renderEventBank();saveConfig(true);toast('Selección de eventos limpiada.');});
$('eventSelectAll')?.addEventListener('click',toggleSelectAllEvents);
['eventSearch','eventCategoryFilter','eventScopeFilter'].forEach(id=>$(id)?.addEventListener(id==='eventSearch'?'input':'change',()=>{renderEventBank();updateSelectAllBtn();}));
$('eventRandomCount')?.addEventListener('change',()=>saveConfig(true));
$('saveAll')?.addEventListener('click',async()=>{if(state.starting)return;state.starting=true;try{if(gameStatus()?.active){saveConfig(false);await publishGameState();}else await prepareGame();}finally{state.starting=false;refreshStartButton();}});
$('startGame')?.addEventListener('click',startGame);
$('startCycle1Btn')?.addEventListener('click',startCycle1);
$('refreshReports')?.addEventListener('click',()=>{loadReports();toast('Información actualizada.');});
$('advanceRound')?.addEventListener('click',()=>advanceRound(false));
$('startTimer')?.addEventListener('click',startTimer);
$('cutRound')?.addEventListener('click',cutRound);
$('clearEvents')?.addEventListener('click',()=>{state.events=[];localStorage.removeItem('SIDE_EVENT_LOG');renderEvents();});
$('publishPodium')?.addEventListener('click',publishPodium);
$('winnerSelect')?.addEventListener('change',renderPodium);
$('viewPdf')?.addEventListener('click',showPdf);
$('downloadPdf')?.addEventListener('click',downloadPdf);
$('closePdf')?.addEventListener('click',()=>$('pdfModal').classList.add('hidden'));
$('backHome')?.addEventListener('click',()=>window.location.href='index.html');

(async function init(){
  await purgeForeignProfessorState();
  loadConfig();updateEventModeUI();
  try{state.events=JSON.parse(localStorage.getItem('SIDE_EVENT_LOG')||'[]')||[]}catch{}
  const r=runtime();
  if(r){state.round=Number(r.round||state.round);state.seconds=Number(r.remaining??roundSeconds());state.roundClosed=['finished','simulation-finished'].includes(r.status);}
  let game;try{game=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{}
  if(state.lifecycleVersion===2&&game?.active){watchTeacherGame();await refreshTeacherGame();}
  else if(cycleMode()==='automatic'&&game?.active){scheduleAutomaticStart();}
  else if(game?.active&&r?.running&&r.startedAt){
    state.seconds=Math.max(0,Number(r.duration||roundSeconds())-Math.floor((Date.now()-new Date(r.startedAt).getTime())/1000));
    if(state.seconds>0){state.seconds=Number(r.duration||roundSeconds());beginTimer(false,Date.parse(r.startedAt));}
    else finishTime();
  }
  if(r?.status==='simulation-finished')$('roundState').textContent='Simulación finalizada';
  updateTimer();updateRoundDisplay();loadReports();renderEvents();renderCycleNews();loadPublished();renderAcademicCalendar();
  refreshSetupSummary();startLiveCompanies();
  updateSelectAllBtn();
  // Si el partidaId guardado apunta a una partida finalizada/inexistente
  // (ej. localStorage anterior al fix), se libera para permitir crear nueva.
  // Solo se limpia con confirmación positiva; errores de red no borran nada.
  try{
    const S=window.SIDE||{};
    if(S.PartidaService&&S.SupabaseClient?.isReady()&&state.partidaId){
      S.PartidaService.obtener(state.partidaId).then(r=>{
        if(r.success&&!r.data){
          state.partidaId=null;
          try{localStorage.removeItem('SIDE_PARTIDA_ID')}catch{}
          refreshStartButton();
        }
        if(r.success&&r.data?.estado==='finalizada'&&gameStatus()?.active){
          localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({...gameStatus(),active:false,finishedAt:new Date().toISOString()}));
          if(state.timer){clearInterval(state.timer);state.timer=null;}
          refreshSetupSummary();
        }
      });
    }
  }catch(error){console.error('SIDE: partida check failed',error)}
})();

window.addEventListener('pagehide',()=>{[teacherPoll,teacherTick,companiesPoll].forEach(clearInterval);teacherPoll=null;teacherTick=null;companiesPoll=null;if(companiesChannel)window.SIDE?.SupabaseClient?.get()?.removeChannel(companiesChannel);companiesChannel=null;companiesChannelId=null;});
window.addEventListener('pageshow',()=>{if(gameStatus()?.active&&state.lifecycleVersion===2){watchTeacherGame();refreshTeacherGame();startLiveCompanies();}});
