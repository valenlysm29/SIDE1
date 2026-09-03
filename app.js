const cfg = window.SIDE_CONFIG || {};
const hasConfig = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('TU-PROYECTO') && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes('TU-PUBLISHABLE');
const supabaseClient = hasConfig && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
const $ = id => document.getElementById(id);
const screens = ['landing','profiles','studentLoading','tutorial','studentLobby','simulationLoading','simulator3d','decisionMenu'];
const modals = ['teacherLoginModal','teacherRegisterModal','studentModal'];
const DEMO_TEACHER = {email:'profesor@upch.pe',password:'Heredia'};
const DEMO_GAME = {id:'demo-side-000',codigo:'SIDE-000',nombre:'SIDE — Simulación Principal',curso:'Finanzas Corporativas',estado:'esperando',segmento:'Estandar'};
const COMPANY_NAME = 'MI EMPRESA'; // respaldo visual; el estudiante define el nombre comercial al ingresar
const DECISION_CATALOG = Array.isArray(window.SIDE_DECISION_CATALOG) ? window.SIDE_DECISION_CATALOG : [];
const EVENT_CATALOG = Array.isArray(window.SIDE_EVENT_CATALOG) ? window.SIDE_EVENT_CATALOG : [];
const LOAN_MAX_PERCENT = 50;
const LOAN_INITIAL_PERCENT = 25;
const UI_ICONS = {check:'assets/icons/ui/check.svg',play:'assets/icons/ui/play.svg',lock:'assets/icons/ui/lock.svg'};
let currentStudent = {name:'Jugador',company:COMPANY_NAME,participantId:null,game:DEMO_GAME};
let decisionState = {};
let decisionDrafts = {};
let cashLedger = {};
let currentCategory = DECISION_CATALOG[0]?.cat || 'A';
let playerIsDeciding = false;

function showScreen(id){screens.forEach(s=>$(s)?.classList.toggle('hidden',s!==id));window.scrollTo(0,0)}
function showModal(id){$('modalRoot').classList.remove('hidden');modals.forEach(m=>$(m)?.classList.toggle('hidden',m!==id));setTimeout(()=>$(id)?.querySelector('input')?.focus(),80)}
function closeModal(){$('modalRoot').classList.add('hidden');modals.forEach(m=>$(m)?.classList.add('hidden'))}
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__sideToast);window.__sideToast=setTimeout(()=>t.classList.remove('show'),2600)}
function message(id,msg,error=false){const el=$(id);if(!el)return;el.textContent=msg;el.style.color=error?'#ff9d9d':'#ffe06a'}
function requireSupabase(){if(!supabaseClient){toast('Modo local activo: configura Supabase para sincronización.');return false}return true}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(n){return 'S/ '+Math.round(Number(n)||0).toLocaleString('es-PE')}
function deepClone(v){return JSON.parse(JSON.stringify(v??{}))}

function teacherConfig(){
  const defaults={capitalMode:'fixed',capital:100000,capitalMin:80000,capitalMax:120000,interest:20,creditPercentStart:20,round:1,cycles:6,demandLosOlivos:1000,demandMiraflores:1250,demandSJL:1100,cycleCloseMode:'manual',roundHours:0,roundMinutes:10,roundSecs:0,scheduledStart:'',enabledEvents:[]};
  try{return {...defaults,...JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG')||'{}')}}catch{return defaults}
}
function stableHash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function initialCapital(){const c=teacherConfig();if(c.capitalMode!=='random')return Math.max(0,Number(c.capital||100000));let min=Math.max(0,Number(c.capitalMin||80000)),max=Math.max(min,Number(c.capitalMax||120000));const ratio=(stableHash(storageKey())%10001)/10000;return Math.round((min+(max-min)*ratio)/500)*500}
function loanMaximum(){return Math.floor(initialCapital()*LOAN_MAX_PERCENT/100/500)*500}
function loanInitialReference(){return Math.floor(initialCapital()*LOAN_INITIAL_PERCENT/100/500)*500}
function currentRound(){return Math.max(1,Number(localStorage.getItem('SIDE_ACTIVE_ROUND')||teacherConfig().round||1))}
function storageKey(){return `${currentStudent.game?.codigo||'SIDE-000'}_${currentStudent.company}`}
function decisionKey(){return 'SIDE_DECISIONS_'+storageKey()}
function ledgerKey(){return 'SIDE_CASH_LEDGER_'+storageKey()}
function loadDecisionState(){
  try{decisionState=JSON.parse(localStorage.getItem(decisionKey())||'{}')||{}}catch{decisionState={}}
  try{cashLedger=JSON.parse(localStorage.getItem(ledgerKey())||'{}')||{}}catch{cashLedger={}}
  decisionDrafts={};
}
function persistGameState(){localStorage.setItem(decisionKey(),JSON.stringify(decisionState));localStorage.setItem(ledgerKey(),JSON.stringify(cashLedger))}
function ledgerTotal(){return Object.values(cashLedger).reduce((s,n)=>s+(Number(n)||0),0)}
function cashBalance(){return initialCapital()+ledgerTotal()}
function submissionKey(){return `SIDE_DECISIONS_SUBMITTED_${storageKey()}_${currentRound()}`}
function decisionsSubmitted(){return localStorage.getItem(submissionKey())==='1'}
function setDecisionsSubmitted(v){if(v)localStorage.setItem(submissionKey(),'1');else localStorage.removeItem(submissionKey())}
function sectionLedgerKey(cat){return `${currentRound()}:${cat}`}
window.SIDE_GAME_BRIDGE={
  get decisions(){return decisionState},
  get ledger(){return cashLedger},
  currentRound:()=>currentRound(),
  cash:()=>cashBalance(),
  decisionProgress:()=>decisionProgressPercent(),
  canStartSimulation:()=>decisionProgressPercent()===100&&decisionsSubmitted(),
  companyName:()=>currentStudent.company||COMPANY_NAME,
  legalName:()=>currentStudent.legalName||currentStudent.company||COMPANY_NAME,
  activeEvents:()=>activeStudentEvents(),
  recordSimulatedSale(amount=75){
    const sale=Math.max(0,Number(amount)||0),key=`${currentRound()}:SIM_VENTAS`;
    cashLedger[key]=Number(cashLedger[key]||0)+sale;
    const physicalStores=(savedEntry(findDecisionItem('CANALES'))?.optionIds||[]).filter(id=>findDecisionItem('CANALES')?.options?.find(o=>o.id===id)?.channel==='store').length;
    if(physicalStores>0){const commissionKey=`${currentRound()}:COMISION_VENTAS`;cashLedger[commissionKey]=Number(cashLedger[commissionKey]||0)-sale*0.01}
    persistGameState();syncStudentReportPreview();renderStudentStatus();
    return cashLedger[key];
  }
};

// Landing / acceso
const loadingTimer=setInterval(()=>{const bar=$('loadingBar');if(!bar){clearInterval(loadingTimer);return}const p=Math.min(100,(Number(bar.dataset.p)||0)+1);bar.dataset.p=p;bar.style.width=p+'%';$('loadingPercent').textContent=p+'%';if(p>=100){clearInterval(loadingTimer);$('startBtn').disabled=false}},28);
$('startBtn')?.addEventListener('click',()=>showScreen('profiles'));
document.querySelector('.modal-backdrop')?.addEventListener('click',closeModal);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
document.querySelectorAll('[data-switch]').forEach(b=>b.addEventListener('click',()=>showModal(b.dataset.switch==='register'?'teacherRegisterModal':'teacherLoginModal')));
document.querySelectorAll('.profile-card').forEach(card=>card.addEventListener('click',()=>showModal(card.dataset.profile==='teacher'?'teacherLoginModal':'studentModal')));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalRoot')?.classList.contains('hidden'))closeModal()});
function openTeacherPanel(){closeModal();window.location.href='docente.html'}
$('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;if(email===DEMO_TEACHER.email&&password===DEMO_TEACHER.password){openTeacherPanel();return}if(!requireSupabase())return;message('loginMessage','Ingresando...');const{error}=await supabaseClient.auth.signInWithPassword({email,password});if(error){message('loginMessage',error.message,true);return}openTeacherPanel()});
$('registerForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireSupabase())return;message('registerMessage','Creando cuenta...');const email=$('registerEmail').value.trim(),password=$('registerPassword').value;const{data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{nombre:$('registerName').value.trim(),apellido:$('registerLastName').value.trim(),curso:$('registerCourse').value.trim()}}});if(error){message('registerMessage',error.message,true);return}if(data.session)openTeacherPanel();else message('registerMessage','Cuenta creada. Revisa tu correo si la confirmación está activada.')});
$('studentForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const code=$('gameCode').value.trim().toUpperCase();
  const legalName=$('companyLegalName')?.value.trim();
  const brandName=$('companyBrandName')?.value.trim()||legalName||COMPANY_NAME;
  if(!legalName||!brandName){message('studentMessage','Ingresa el nombre y el nombre comercial de tu empresa.',true);return}
  const localCfg=teacherConfig(),localCode=String(localCfg.codigo||'SIDE-000').toUpperCase();
  if(code===localCode||code==='SIDE-000'){
    const localGame={...DEMO_GAME,codigo:code,nombre:localCfg.nombre||DEMO_GAME.nombre,curso:localCfg.curso||DEMO_GAME.curso,estado:'activa'};
    currentStudent={name:'Jugador',company:brandName,legalName,participantId:null,game:localGame};
  }else{
    if(!requireSupabase())return; message('studentMessage','Buscando partida...');
    const{data:game,error}=await supabaseClient.rpc('buscar_partida_por_codigo',{p_codigo:code});if(error){message('studentMessage',error.message,true);return}
    const found=Array.isArray(game)?game[0]:game;if(!found){message('studentMessage','No encontramos una partida con ese código.',true);return}
    const{data:participant,error:joinError}=await supabaseClient.from('participantes').insert({partida_id:found.id,nombre:'Jugador',empresa:brandName}).select('id').single();
    if(joinError){message('studentMessage',joinError.message,true);return} currentStudent={name:'Jugador',company:brandName,legalName,participantId:participant?.id||null,game:found};
  }
  closeModal();startJoinLoading();
});
function startJoinLoading(){showScreen('studentLoading');let p=0,step=0;const texts=['Sincronizando partida','Cargando escenario empresarial','Preparando decisiones','¡Todo listo!'];$('joinProgress').style.width='0%';const i=setInterval(()=>{p+=4;$('joinProgress').style.width=p+'%';if(p%25===0&&step<3)$('joinLoadingText').textContent=texts[++step];if(p>=100){clearInterval(i);prepareLobby()}},55)}
async function prepareLobby(){
  $('lobbyCode').textContent=currentStudent.game.codigo;$('lobbyGameName').textContent=currentStudent.game.nombre;
  $('lobbyStudent').textContent=currentStudent.legalName&&currentStudent.legalName!==currentStudent.company?`${currentStudent.company} · ${currentStudent.legalName}`:currentStudent.company;
  $('lobbySegment').textContent='EMPRESA: '+currentStudent.company+' · DEFINE TU SEGMENTO EN DECISIONES';
  renderStudentStatus(); syncStudentTimer();
  await openStudentTutorial();
}
async function openStudentTutorial(){
  showScreen('tutorial'); const mount=$('tutorialMount');
  if(!mount.dataset.loaded){try{const response=await fetch('tutorial.html');if(!response.ok)throw new Error('No se pudo cargar tutorial.html');mount.innerHTML=await response.text();mount.dataset.loaded='1'}catch(error){console.error(error);showScreen('studentLobby');return}}
  if(typeof window.initSIDETutorial==='function')window.initSIDETutorial(()=>showScreen('studentLobby'));
}
$('enterDecisionsBtn')?.addEventListener('click',openDecisionMenu);
$('reopenTutorialBtn')?.addEventListener('click',openStudentTutorial);
$('backToProfiles')?.addEventListener('click',()=>showScreen('profiles'));
$('exitDecisions')?.addEventListener('click',()=>{playerIsDeciding=false;syncStudentReportPreview();if(window.__SIDE_RETURN_TO_3D){window.__SIDE_RETURN_TO_3D=false;window.SIDE3D?.returnFromDecisions?.();}else showScreen('studentLobby')});
$('restartDecisionMenu')?.addEventListener('click',()=>{$('decisionSummary').classList.add('hidden');renderDecisionCategory()});

function allDecisionItems(){return DECISION_CATALOG.flatMap(c=>c.items)}
function categoryByCat(cat){return DECISION_CATALOG.find(c=>c.cat===cat)}
function findDecisionItem(id){return allDecisionItems().find(i=>i.id===id)}
function savedEntry(item){return decisionState[item.id]||null}
function sectionSubmissionKey(cat=currentCategory){return `SIDE_DECISION_SECTION_SUBMITTED_${storageKey()}_${currentRound()}_${cat}`}
function sectionSubmitted(cat=currentCategory){return localStorage.getItem(sectionSubmissionKey(cat))==='1'}
function setSectionSubmitted(cat,v=true){const k=sectionSubmissionKey(cat);if(v)localStorage.setItem(k,'1');else localStorage.removeItem(k)}
function isLocked(item){const e=savedEntry(item);return sectionSubmitted(currentCategory) || decisionsSubmitted() || !!(item.lockAfterPurchase&&e&&Number(e.round)<currentRound())}
function cycleDecisionsLocked(){return decisionsSubmitted()} 
function decisionEditingBlocked(){if(decisionsSubmitted()){toast('Todas las decisiones de este ciclo ya fueron enviadas. Podrás modificarlas cuando comience el próximo ciclo.');return true}if(sectionSubmitted(currentCategory)){toast('Esta sección ya fue enviada y está bloqueada hasta el próximo ciclo.');return true}return false}
function itemRequired(item){
  if(item?.requiredWhenProduction)return currentProductionTarget()>0;
  return item?.required===true;
}
function itemComplete(item){
  if(item.type==='info')return true;
  const e=savedEntry(item); if(!e)return false;
  if(item.recurring&&Number(e.round)!==currentRound())return false;
  if(item.asset&&e.purchases)return Object.values(e.purchases).some(r=>Object.values(r||{}).some(q=>Number(q)>0));
  if(item.type==='number')return Number(e.value)>=Number(item.min||0);
  if(item.type==='loan')return e.amount!==undefined;
  if(item.type==='sales-staff')return true;
  if(item.type==='multi-choice')return (e.optionIds||[]).length>=Number(item.minSelections||1);
  return (e.optionIds||[]).length>0 || Object.values(e.quantities||{}).some(q=>Number(q)>0);
}
function getOwned(item,optId){
  const e=savedEntry(item);if(!e?.purchases)return 0;
  return Object.entries(e.purchases).reduce((s,[round,row])=>s+(Number(round)<currentRound()?(Number(row?.[optId])||0):0),0);
}
function currentPurchase(item,optId){return Number(savedEntry(item)?.purchases?.[currentRound()]?.[optId]||0)}
function initDraft(item){
  if(decisionDrafts[item.id])return decisionDrafts[item.id]; const e=savedEntry(item);
  if(item.asset){const quantities={};item.options.forEach(o=>quantities[o.id]=currentPurchase(item,o.id));return decisionDrafts[item.id]={quantities}}
  if(item.type==='quantity'||item.type==='quantity-choice'){const quantities={};item.options.forEach(o=>quantities[o.id]=Number(e?.round===currentRound()?e.quantities?.[o.id]:0));return decisionDrafts[item.id]={quantities}}
  if(item.type==='number')return decisionDrafts[item.id]={value:Number(e?.round===currentRound()?e.value:0)};
  if(item.type==='loan')return decisionDrafts[item.id]={amount:Number(e?.round===currentRound()?e.amount:0)};
  if(item.type==='sales-staff')return decisionDrafts[item.id]={staff:deepClone(e?.round===currentRound()?e.staff:{})};
  const ids=(e?.optionIds||item.defaultOptionIds||[]).slice();return decisionDrafts[item.id]={optionIds:ids};
}
function selectedOptionIds(item){return initDraft(item).optionIds||[]}
function analystSelected(){const item=findDecisionItem('ANALISTA_COMPRAS');return selectedOptionIds(item).includes('si_analista')}
function analystDiscount(){return analystSelected()?Math.max(2,12-(currentRound()-1)*2):0}
function optionUnitCost(item,opt){const base=Number(opt.cost)||0;return item.material?base*(1-analystDiscount()/100):base}
function currentProductionTarget(){return Number(initDraft(findDecisionItem('PRODUCCION_META')).value||0)}
function materialNeed(){return currentProductionTarget()}
function districtDemand(id){const c=teacherConfig();return id==='los_olivos'?Number(c.demandLosOlivos||1000):id==='miraflores'?Number(c.demandMiraflores||1250):id==='sjl'?Number(c.demandSJL||1100):0}
function chosenStores(){const item=findDecisionItem('CANALES');return selectedOptionIds(item).map(id=>item.options.find(o=>o.id===id)).filter(o=>o?.channel==='store')}
function creditPercent(){const base=Number(teacherConfig().creditPercentStart||20);return Math.min(70,base+(currentRound()-1)*5+(analystSelected()?5:0))}
function recurringAlreadyPrevious(item){const e=savedEntry(item);return e&&Number(e.round)<currentRound()}

function computeItemCost(item){
  if(item.noCashEffect||item.type==='info'||item.type==='number'||item.type==='loan')return 0;
  if(item.lockAfterPurchase&&isLocked(item))return 0;
  const d=initDraft(item);
  if(item.asset){return item.options.reduce((sum,o)=>sum+(Number(d.quantities?.[o.id])||0)*optionUnitCost(item,o),0)}
  if(item.type==='quantity'||item.type==='quantity-choice')return item.options.reduce((sum,o)=>sum+(Number(d.quantities?.[o.id])||0)*optionUnitCost(item,o),0);
  if(item.type==='sales-staff')return Object.values(d.staff||{}).reduce((s,q)=>s+(Number(q)||0)*Number(item.costPerPerson||0),0);
  return item.options?.filter(o=>(d.optionIds||[]).includes(o.id)).reduce((s,o)=>s+optionUnitCost(item,o),0)||0;
}
function categoryDraftNet(cat){
  const category=categoryByCat(cat);if(!category)return 0;
  let cost=0,loan=0;
  category.items.forEach(item=>{if(item.type==='loan')loan+=Number(initDraft(item).amount||0);else cost+=computeItemCost(item)});
  return loan-cost;
}
function projectedCash(){const old=Number(cashLedger[sectionLedgerKey(currentCategory)]||0);return initialCapital()+ledgerTotal()-old+categoryDraftNet(currentCategory)}

function openDecisionMenu(){
  loadDecisionState(); playerIsDeciding=true; currentCategory=currentCategory||DECISION_CATALOG[0]?.cat; restoreDraftsForRound(); showScreen('decisionMenu');
  renderTabs(); renderDecisionCategory(); updateHud(); syncStudentReportPreview();
  const stage=$('decisionMenu'); stage.onscroll=()=>{$('decisionTopbar')?.classList.toggle('compact',stage.scrollTop>70);$('decisionStickyHead')?.classList.toggle('compact',stage.scrollTop>135)};
}
function renderTabs(){
  const nav=$('decisionTabs');
  nav.innerHTML=DECISION_CATALOG.map(c=>{const sent=sectionSubmitted(c.cat),saved=categoryHasSaved(c.cat);return `<button class="decision-tab ${c.cat===currentCategory?'active':''} ${sent?'section-sent':''}" data-cat="${c.cat}"><img src="${escapeHtml(c.icon)}" alt=""><span>${escapeHtml(c.short||c.title)}</span>${sent?'<b class="tab-status">✓ ENVIADA</b>':saved?'<b class="tab-status">BORRADOR</b>':''}</button>`}).join('');
  nav.querySelectorAll('.decision-tab').forEach(b=>b.addEventListener('click',()=>{currentCategory=b.dataset.cat;renderTabs();renderDecisionCategory()}));
}
function categoryHasSaved(cat){const c=categoryByCat(cat);const req=c.items.filter(itemRequired);return req.length?req.every(itemComplete):c.items.filter(i=>i.type!=='info').some(itemComplete)}
function draftItemComplete(item){
  if(item.type==='info')return true;
  if(itemComplete(item))return true;
  const d=initDraft(item);
  if(item.type==='number')return d.value!==''&&Number(d.value)>=Number(item.min||0);
  if(item.type==='loan')return d.amount!==undefined;
  if(item.type==='sales-staff')return true;
  if(item.type==='multi-choice')return (d.optionIds||[]).length>=Number(item.minSelections||1);
  if(item.type==='choice')return (d.optionIds||[]).length>0;
  if(item.type==='quantity'||item.type==='quantity-choice'||item.asset)return Object.values(d.quantities||{}).some(q=>Number(q)>0)||itemComplete(item);
  return true;
}
function sectionDraftReady(cat=currentCategory){const c=categoryByCat(cat);if(!c)return false;return c.items.filter(i=>i.type!=='info'&&itemRequired(i)).every(draftItemComplete)}
function sectionReady(cat=currentCategory){return sectionDraftReady(cat)}
function eventHint(){const ev=activeStudentEvents()[0];if(ev)return `${ev.title}: ${ev.implication}`;return 'No hay un evento activo confirmado para esta empresa en este ciclo.'}
function machinerySummaryHtml(){
  const defs=[['MESA_CORTE','Mesas de corte'],['ENSAMBLE','Ensamblado'],['ACABADOS','Acabados']];
  return `<div class="machinery-summary"><div><span>MAQUINARIA DISPONIBLE PARA PRODUCCIÓN</span><small>Incluye equipos adquiridos anteriormente y los comprados en este ciclo.</small></div>${defs.map(([id,label])=>{const item=findDecisionItem(id);let previous=0,current=0;(item?.options||[]).forEach(o=>{previous+=getOwned(item,o.id);current+=Number(initDraft(item).quantities?.[o.id]||0)});const available=previous+current;return `<div><b>${escapeHtml(label)}</b><strong>${available}</strong><small>Disponible ahora</small><em>${current?`+${current} comprado(s) este ciclo`:'Sin compra nueva'}</em></div>`}).join('')}</div>`;
}
function renderDecisionCategory(){
  const cat=categoryByCat(currentCategory)||DECISION_CATALOG[0];currentCategory=cat.cat;
  $('categoryTitle').textContent=cat.title;$('categoryDescription').textContent=cat.desc;$('detailCategoryIcon').src=cat.icon;$('roundLabel').textContent=`CICLO ${currentRound()} · ${currentStudent.company}`;
  const items=cat.items.filter(item=>!(item.lockAfterPurchase&&isLocked(item)));
  let lead=`<div class="event-clue"><span>NOTICIA / CONTEXTO</span><strong>${escapeHtml(eventHint())}</strong><small>Los eventos aplicados aparecen en el resumen financiero.</small></div>`;
  if(cat.cat==='C')lead+=machinerySummaryHtml();
  if(cat.cat==='D')lead+=`<div class="required-alert"><strong>Canal de ventas obligatorio</strong><span>Debes marcar al menos un canal para poder enviar tus decisiones.</span></div>`;
  $('decisionCards').innerHTML=lead+items.map(renderDecisionRow).join('');
  bindDecisionControls(); updateHud(); updateSectionCost(); syncStudentTimer();
}
function renderDecisionRow(item){
  const locked=isLocked(item)||cycleDecisionsLocked(),saved=itemComplete(item),cost=computeItemCost(item),d=initDraft(item),required=itemRequired(item);
  let body='';
  if(item.type==='choice'||item.type==='multi-choice'){
    const multi=item.type==='multi-choice';
    body=`<div class="choice-strip ${multi?'checkbox-options':'radio-options'}">${item.options.map(o=>{const selected=(d.optionIds||[]).includes(o.id);const extra=o.district?`<small>Demanda base: ${districtDemand(o.id).toLocaleString('es-PE')} u./ciclo</small>`:'';const disabled=locked||item.mandatoryFixed;const showPrice=item.showPrice!==false;return `<label class="choice-pill ${selected?'selected':''} ${disabled?'fixed-choice':''}"><input data-choice="${item.id}" data-option="${o.id}" type="${multi?'checkbox':'radio'}" name="decision-${item.id}" ${selected?'checked':''} ${disabled?'disabled':''}><span class="choice-check"></span><strong>${escapeHtml(o.label)}</strong>${showPrice?`<em>${money(optionUnitCost(item,o))}</em>`:''}<p>${escapeHtml(o.desc)}</p>${extra}</label>`}).join('')}</div>${multi?'<div class="micro-caption">Casillas: puedes seleccionar una o varias opciones.</div>':'<div class="micro-caption">Botón de opción: solo puedes seleccionar una alternativa.</div>'}${item.mandatoryFixed?'<div class="mandatory-note">Este costo es obligatorio y permanece marcado durante la simulación.</div>':''}`;
  } else if(item.type==='quantity'||item.type==='quantity-choice'){
    body=`<div class="quantity-grid">${item.options.map(o=>{const q=Number(d.quantities?.[o.id]||0),owned=item.asset?getOwned(item,o.id):0;return `<div class="quantity-option"><div class="quantity-copy"><strong>${escapeHtml(o.label)}</strong><p>${escapeHtml(o.desc)}</p><small>${money(optionUnitCost(item,o))} c/u${item.material&&analystDiscount()?` · −${analystDiscount()}% negociado`:''}</small>${item.asset?`<span class="owned-badge">YA TIENES: ${owned}</span><span class="buying-badge">VAS A COMPRAR: ${q}</span>`:''}${item.material?`<span class="need-badge">NECESITAS: ${materialNeed()} mín.</span>`:''}</div><div class="stepper"><button data-step="${item.id}" data-option="${o.id}" data-delta="-1">−</button><input data-qty="${item.id}" data-option="${o.id}" type="number" min="0" step="1" value="${q}"><button data-step="${item.id}" data-option="${o.id}" data-delta="1">+</button></div></div>`}).join('')}</div>`;
  } else if(item.type==='number'){
    body=`<div class="number-decision"><button data-number-step="${item.id}" data-delta="-10">−10</button><input data-number="${item.id}" type="number" min="${item.min||0}" step="${item.step||1}" value="${Number(d.value||0)}"><button data-number-step="${item.id}" data-delta="10">+10</button><span>${escapeHtml(item.unit||'')}</span></div><div class="requirements"><span>Materia prima mínima estimada</span><b>Cuero: ${materialNeed()}</b><b>Accesorios: ${materialNeed()}</b><b>Hilo: ${materialNeed()}</b><small>Puedes comprar una cantidad mayor si deseas mantener un excedente.</small></div>`;
  } else if(item.type==='sales-staff'){
    body=`<div class="info-decision"><strong>Personal automático por tienda</strong><p>Se asigna 1 vendedor básico a cada tienda física. La comisión es 1% de las ventas.</p></div>`;
  } else if(item.type==='loan'){
    const rate=Number(teacherConfig().interest||20),max=loanMaximum(),amount=Math.min(max,Number(d.amount||0));body=`<div class="loan-box"><div><span>TEA INICIAL DEFINIDA POR EL DOCENTE</span><strong>${rate.toFixed(1)}%</strong></div><div><span>LÍMITE AUTOMÁTICO</span><strong>${money(max)}</strong><small>${LOAN_MAX_PERCENT}% de tu caja inicial</small></div><div><span>REFERENCIA INICIAL</span><strong>${money(loanInitialReference())}</strong><small>${LOAN_INITIAL_PERCENT}% de tu caja inicial</small></div></div><div class="loan-control"><input data-loan="${item.id}" type="range" min="0" max="${max}" step="500" value="${amount}"><input data-loan-number="${item.id}" type="number" min="0" max="${max}" step="500" value="${amount}"><b>${money(amount)}</b></div><div class="micro-caption">El préstamo es opcional y no suma al progreso obligatorio.</div>`;
  } else if(item.type==='info'){
    let dynamic=item.id==='CREDITO_VENTAS'?`<strong>${creditPercent()}% de ventas a crédito</strong><small>${100-creditPercent()}% de ventas al contado</small>`:`<strong>Regla automática del juego</strong>`;if(item.id==='PERSONAL_VENTAS')dynamic='<strong>1 vendedor básico por tienda · comisión 1%</strong>';body=`<div class="info-decision">${dynamic}<p>${escapeHtml(item.desc)}</p></div>`;
  }
  const costLabel=item.type==='loan'?'Financiamiento opcional':item.noCashEffect?'No afecta caja':cost>0?`${item.mandatoryFixed?'Costo obligatorio':'Costo actual'}: ${money(cost)}`:'Sin salida de caja';
  return `<article class="decision-row ${saved?'saved':''} ${locked?'locked':''} ${required?'required-row':'optional-row'}" data-item="${item.id}"><div class="decision-row-head"><div><span class="row-state">${locked?'BLOQUEADA':saved?'GUARDADA':required?'OBLIGATORIA':'OPCIONAL'}</span><h3>${escapeHtml(item.name)}</h3>${item.desc?`<p>${escapeHtml(item.desc)}</p>`:''}</div><div class="row-cost">${costLabel}</div></div>${body}</article>`;
}
document.addEventListener('wheel',e=>{if(e.target?.matches?.('.number-decision input[type=number], .quantity-option input[type=number]')&&document.activeElement===e.target)e.preventDefault()},{passive:false});
function bindDecisionControls(){
  document.querySelectorAll('[data-choice]').forEach(input=>input.addEventListener('change',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(input.dataset.choice);if(item.mandatoryFixed){toast('Esta decisión corresponde a un costo obligatorio y no puede retirarse.');renderDecisionCategory();return}const d=initDraft(item),id=input.dataset.option;if(item.type==='multi-choice'){const set=new Set(d.optionIds||[]);input.checked?set.add(id):set.delete(id);d.optionIds=[...set]}else d.optionIds=[id];persistCurrentDraftOnly();renderDecisionCategory()}));
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;changeQty(b.dataset.step,b.dataset.option,Number(b.dataset.delta));persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-qty]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem(i.dataset.qty));d.quantities[i.dataset.option]=Math.max(0,Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.qty)}));
  document.querySelectorAll('[data-number-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(b.dataset.numberStep),d=initDraft(item);d.value=Math.max(Number(item.min||0),Number(d.value||0)+Number(b.dataset.delta));persistCurrentDraftOnly();renderDecisionCategory()}));
  document.querySelectorAll('[data-number]').forEach(i=>{
    i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.number),d=initDraft(item);const raw=i.value;d.value=raw===''?'':Math.max(Number(item.min||0),Number(raw)||0);persistCurrentDraftOnly();updateSectionCost();});
    i.addEventListener('change',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.number),d=initDraft(item);d.value=Math.max(Number(item.min||0),Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.number);});
  });
  document.querySelectorAll('[data-staff-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;changeStaff(b.dataset.staffStep,b.dataset.store,Number(b.dataset.delta));persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-staff]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem(i.dataset.staff));d.staff[i.dataset.store]=Math.max(0,Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.staff)}));
  document.querySelectorAll('[data-loan]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;setLoan(i.dataset.loan,Number(i.value),true);persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-loan-number]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;setLoan(i.dataset.loan,Number(i.value),true);persistCurrentDraftOnly();}));
}
function changeQty(itemId,optId,delta){const item=findDecisionItem(itemId),d=initDraft(item);d.quantities[optId]=Math.max(0,(Number(d.quantities[optId])||0)+delta);renderDecisionCategory()}
function changeStaff(itemId,store,delta){const item=findDecisionItem(itemId),d=initDraft(item);d.staff[store]=Math.max(0,(Number(d.staff[store])||0)+delta);renderDecisionCategory()}
function setLoan(itemId,value,rerender=false){const item=findDecisionItem(itemId),max=loanMaximum(),d=initDraft(item);d.amount=Math.max(0,Math.min(max,Number(value)||0));if(rerender)renderDecisionCategory()}
function updateRowCost(itemId){const row=document.querySelector(`[data-item="${itemId}"] .row-cost`),item=findDecisionItem(itemId);if(row)row.textContent=computeItemCost(item)>0?'Costo actual: '+money(computeItemCost(item)):'Sin salida de caja'}
function updateSectionCost(){
  const locked=cycleDecisionsLocked();
  const net=categoryDraftNet(currentCategory),old=Number(cashLedger[sectionLedgerKey(currentCategory)]||0),delta=net-old,projected=projectedCash();
  $('sectionDraftCost').textContent=delta<0?`Gastado: ${money(Math.abs(delta))}`:delta>0?`Ingreso previsto: +${money(delta)}`:'Sin cambios pendientes';
  $('projectedCash').textContent=money(cashBalance());$('projectedCash').classList.toggle('danger',projected<0);
  $('sectionSaveHint').textContent=locked?'Decisiones enviadas: edición bloqueada hasta el próximo ciclo.':projected<0?'El gasto supera tu caja actual. Ajusta antes de guardar.':'Borrador local: guarda tus avances y envía el ciclo solo cuando estés seguro.';
  $('saveDecisionSection').disabled=locked||projected<0;
}
function productionMaterialShortages(){
  if(currentCategory!=='C')return [];
  const need=materialNeed();if(!need)return [];
  return ['CUERO','ACCESORIOS','HILO'].map(id=>{
    const item=findDecisionItem(id),d=initDraft(item),total=Object.values(d.quantities||{}).reduce((s,q)=>s+(Number(q)||0),0),missing=Math.max(0,need-total);
    return missing?{item,need,total,missing}:null;
  }).filter(Boolean);
}
function validateProductionMaterials(){return true;}
function warnProductionMaterialShortage(){
  const shortages=productionMaterialShortages();
  if(!shortages.length)return;
  const detail=shortages.map(x=>`${x.item.name}: faltan ${x.missing}`).join(' · ');
  toast(`Advertencia: tu producción supera los insumos comprados. ${detail}. Puedes continuar.`);
}
function validateRequiredSection(cat){for(const item of cat.items){if(!itemRequired(item)||item.type==='info'||(item.lockAfterPurchase&&isLocked(item)))continue;const d=initDraft(item);if(item.type==='choice'&&!(d.optionIds||[]).length){toast(`Debes completar: ${item.name}.`);return false}if(item.type==='multi-choice'&&(d.optionIds||[]).length<Number(item.minSelections||1)){toast(`Debes seleccionar al menos una opción en ${item.name}.`);return false}if(item.type==='number'&&Number(d.value)<Number(item.min||0)){toast(`${item.name} debe ser como mínimo ${item.min}.`);return false}if(item.requiredWhenProduction&&currentProductionTarget()>0){/* El faltante de insumos es una advertencia, no un bloqueo. */}}return true}
function saveCurrentSection(){
  if(decisionEditingBlocked())return;
  const cat=categoryByCat(currentCategory);if(!cat)return;if(!validateRequiredSection(cat))return;if(projectedCash()<0){toast('No tienes caja suficiente para guardar esta sección.');return}warnProductionMaterialShortage();
  const round=currentRound();
  cat.items.forEach(item=>{
    if(item.type==='info'||(item.lockAfterPurchase&&isLocked(item)))return;const d=initDraft(item);
    if(item.asset){const prev=decisionState[item.id]||{purchases:{}};prev.purchases=prev.purchases||{};prev.purchases[round]=deepClone(d.quantities||{});prev.round=round;prev.label=item.name;decisionState[item.id]=prev;return}
    if(item.type==='quantity'||item.type==='quantity-choice'){decisionState[item.id]={quantities:deepClone(d.quantities||{}),round,label:item.name,cost:computeItemCost(item)};return}
    if(item.type==='number'){decisionState[item.id]={value:Number(d.value||0),round,label:`${item.name}: ${Number(d.value||0)} ${item.unit||''}`,cost:0};return}
    if(item.type==='sales-staff'){decisionState[item.id]={staff:deepClone(d.staff||{}),round,label:item.name,cost:computeItemCost(item)};return}
    if(item.type==='loan'){decisionState[item.id]={amount:Number(d.amount||0),round,label:`Préstamo: ${money(d.amount||0)}`,cost:0};return}
    decisionState[item.id]={optionIds:(d.optionIds||[]).slice(),round,label:(item.options||[]).filter(o=>(d.optionIds||[]).includes(o.id)).map(o=>o.label).join(' + '),cost:computeItemCost(item)};
  });
  const key=sectionLedgerKey(currentCategory),old=Number(cashLedger[key]||0),next=categoryDraftNet(currentCategory);cashLedger[key]=next;persistGameState();applyEventCashEffects();syncStudentReportPreview();syncSectionToSupabase(cat);
  const draftStoreKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let draftStore={};try{draftStore=JSON.parse(localStorage.getItem(draftStoreKey)||'{}')||{}}catch{}delete draftStore[currentCategory];localStorage.setItem(draftStoreKey,JSON.stringify(draftStore));
  const movement=next-old;animateCash(movement);decisionDrafts={};renderTabs();renderDecisionCategory();updateHud();toast('Borrador guardado. Puedes seguir revisándolo o enviarlo de inmediato.');
}
$('saveDecisionSection')?.addEventListener('click',saveCurrentSection);
function sendCurrentSection(){
  if(decisionsSubmitted()){toast('El ciclo completo ya fue enviado. Espera al próximo ciclo.');return}
  if(sectionSubmitted(currentCategory)){toast('Esta sección ya fue enviada.');return}
  saveCurrentSection();
  if(!sectionReady(currentCategory)){toast('Completa las decisiones obligatorias de esta pestaña para poder enviarla.');return}
  setSectionSubmitted(currentCategory,true);
  persistGameState(); syncStudentReportPreview(); updateHud(); renderTabs(); renderDecisionCategory();
  toast(`Sección «${categoryByCat(currentCategory)?.title||'Decisión'}» enviada y bloqueada.`);
}
$('sendDecisionSection')?.addEventListener('click',sendCurrentSection);

let simulationLoadingTimer=null;
async function startSimulationLoading(){
  loadDecisionState();
  if(decisionProgressPercent()!==100){toast('Completa y guarda todas las decisiones obligatorias antes de iniciar el juego 3D.');openDecisionMenu();return}
  if(!decisionsSubmitted()){toast('Primero presiona ENVIAR DECISIONES para confirmar el ciclo.');openDecisionMenu();return}
  if(simulationLoadingTimer){clearInterval(simulationLoadingTimer);simulationLoadingTimer=null}
  const bar=$('simulationLoadingBar'),pctEl=$('simulationLoadingPercent'),text=$('simulationLoadingText'),stage=$('simulationLoadingStage');
  const stepEls=[...document.querySelectorAll('[data-load-step]')];
  let p=0;showScreen('simulationLoading');
  const paint=(value)=>{p=Math.max(0,Math.min(100,value));if(bar)bar.style.width=p+'%';if(pctEl)pctEl.textContent=Math.round(p)+'%';let step=1,label='Construyendo local y distribución';if(p>=38){step=2;label='Aplicando maquinaria, personal y stock'}if(p>=72){step=3;label='Preparando inventario, clientes NPC y caja'}if(p>=96)label=`Abriendo ${currentStudent.company||COMPANY_NAME}`;if(stage)stage.textContent=label;if(text)text.textContent=p<38?'Levantando tu tienda según la infraestructura elegida...':p<72?'Colocando físicamente los recursos que compraste y contrataste...':p<96?'Activando stock físico, rutas de clientes, reposición y sistema de ventas...':'Todo listo. Entrando a tu empresa...';stepEls.forEach((el,i)=>el.classList.toggle('active',i<step));};
  paint(0);
  let engineReady=false;
  const enginePromise=window.SIDE3D?.prepare?.().then(ok=>{engineReady=!!ok;return ok}).catch(()=>false);
  simulationLoadingTimer=setInterval(()=>{if(p<88)paint(p+2);else if(p<94&&engineReady)paint(p+1)},34);
  const ok=await enginePromise;
  if(!ok){clearInterval(simulationLoadingTimer);simulationLoadingTimer=null;toast('No se pudo preparar el motor 3D. Revisa tu conexión a Internet.');openDecisionMenu();return}
  clearInterval(simulationLoadingTimer);simulationLoadingTimer=null;
  for(let v=Math.max(94,p);v<=100;v+=2){paint(v);await new Promise(r=>setTimeout(r,45))}
  paint(100);
  await new Promise(r=>setTimeout(r,180));
  await window.SIDE3D.enter({autoStart:true});
}
$('startSimulationBtn')?.addEventListener('click',startSimulationLoading);
function animateCash(netMovement){
  const fx=$('cashFx');if(!fx||!netMovement)return;fx.querySelector('span').textContent=(netMovement>0?'+ ':'− ')+money(Math.abs(netMovement));fx.classList.remove('gain','spend','play');fx.classList.add(netMovement>0?'gain':'spend');void fx.offsetWidth;fx.classList.add('play');setTimeout(()=>fx.classList.remove('play'),1150);
  const cash=$('cashBalance');cash.classList.remove('cash-pulse');void cash.offsetWidth;cash.classList.add('cash-pulse');
}
function requiredDecisionItems(){return allDecisionItems().filter(i=>i.type!=='info'&&itemRequired(i))}
function decisionProgressPercent(){const actionable=requiredDecisionItems();const done=actionable.filter(itemComplete).length;return actionable.length?Math.round(done/actionable.length*100):100}
function categoryCompletionMap(){const out={};DECISION_CATALOG.forEach(cat=>{const req=cat.items.filter(i=>i.type!=='info'&&itemRequired(i));out[cat.cat]={title:cat.short||cat.title,done:req.filter(itemComplete).length,total:req.length,complete:req.length?req.every(itemComplete):true}});return out}
function updateHud(){
  const cash=cashBalance();$('cashBalance').textContent=money(cash);$('cashBalance').classList.toggle('danger',cash<0);$('cashMovement').textContent=`Caja inicial asignada: ${money(initialCapital())}`;
  const pct=decisionProgressPercent();$('decisionProgressText').textContent=pct+'%';$('decisionProgressBar').style.width=pct+'%';
  const launch=$('simulationLaunch');if(launch){const ready=pct===100;launch.classList.toggle('hidden',!ready);launch.classList.toggle('ready',ready);const submitted=decisionsSubmitted();$('submitAllDecisionsBtn')?.classList.toggle('hidden',submitted);$('startSimulationBtn')?.classList.toggle('hidden',!submitted);if($('sendDecisionSection')){$('sendDecisionSection').disabled=sectionSubmitted(currentCategory)||submitted||!sectionDraftReady(currentCategory);$('sendDecisionSection').classList.toggle('submitted',sectionSubmitted(currentCategory))}}
}
function currentDecisionLabels(){return allDecisionItems().map(i=>savedEntry(i)?.label).filter(Boolean)}
function eventStoreKey(){return `SIDE_STUDENT_EVENTS_${storageKey()}`}
function eventSchedule(){try{return JSON.parse(localStorage.getItem('SIDE_EVENT_SCHEDULE')||'{}')||{}}catch{return {}}}
function deterministicChance(seed,pct){return stableHash(seed)%100 < Number(pct||0)}
function activeStudentEvents(){
  let stored={};try{stored=JSON.parse(localStorage.getItem(eventStoreKey())||'{}')||{}}catch{}
  const round=currentRound(),conf=teacherConfig(),enabled=new Set(conf.enabledEvents||[]),schedule=eventSchedule();
  for(let r=1;r<=round;r++)if(!stored[r]){const ids=[];(schedule[r]?.group||[]).forEach(id=>{if(enabled.has(id))ids.push(id)});EVENT_CATALOG.filter(e=>e.scope==='individual'&&enabled.has(e.id)).forEach(e=>{if(ids.filter(id=>EVENT_CATALOG.find(x=>x.id===id)?.scope==='individual').length>=2)return;if(deterministicChance(`${storageKey()}|${r}|${e.id}`,e.probability))ids.push(e.id)});stored[r]=ids}
  localStorage.setItem(eventStoreKey(),JSON.stringify(stored));
  const active=[];Object.entries(stored).forEach(([trigger,ids])=>(ids||[]).forEach(id=>{const ev=EVENT_CATALOG.find(e=>e.id===id);if(!ev)return;const effectiveStart=Number(trigger)+Number(ev.cycleOffset||0),effectiveEnd=effectiveStart+Math.max(1,Number(ev.cycles||1));if(round>=effectiveStart&&round<effectiveEnd)active.push({...ev,triggerRound:Number(trigger),startRound:effectiveStart})}));return active;
}
function applyEventCashEffects(){activeStudentEvents().forEach(ev=>{const delta=Number(ev.effect?.cashDelta||0);if(!delta)return;const key=`${ev.startRound}:EVENT:${ev.id}`;if(cashLedger[key]===undefined)cashLedger[key]=delta});persistGameState()}
function eventAdjustedFinancials(baseRevenue,baseCosts){let revenue=Number(baseRevenue||0),costs=Number(baseCosts||0);activeStudentEvents().forEach(ev=>{revenue*=1+Number(ev.effect?.revenuePct||0)/100;costs*=1+Number(ev.effect?.costPct||0)/100});return {revenue:Math.round(revenue),costs:Math.round(costs)}}
function syncStudentReportPreview(){
  applyEventCashEffects();
  const entries=allDecisionItems().filter(i=>savedEntry(i));
  const costsBase=Object.entries(cashLedger).reduce((s,[k,n])=>s+(k.includes('SIM_VENTAS')||k.includes(':EVENT:')?0:Math.max(0,-Number(n||0))),0);
  const loans=Object.entries(cashLedger).reduce((s,[k,n])=>s+(k.includes('SIM_VENTAS')||k.includes(':EVENT:')?0:Math.max(0,Number(n||0))),0);
  const simRevenue=Number(cashLedger[`${currentRound()}:SIM_VENTAS`]||0);
  const adjusted=eventAdjustedFinancials(simRevenue,costsBase);
  const eventCash=Object.entries(cashLedger).filter(([k])=>k.includes(':EVENT:')).reduce((s,[,n])=>s+Number(n||0),0);
  const pctImpact=(adjusted.revenue-simRevenue)-(adjusted.costs-costsBase);
  const eventImpact=eventCash+pctImpact;
  const utilidad=adjusted.revenue-adjusted.costs+eventCash;
  const flujo=ledgerTotal()+pctImpact;
  const cajaFinal=cashBalance()+pctImpact;
  const events=activeStudentEvents();
  const report={
    id:currentStudent.participantId||('local-'+storageKey()),nombre:'Jugador',empresa:currentStudent.company,
    partida:currentStudent.game?.codigo||'SIDE-000',ronda:currentRound(),capital:initialCapital(),
    ingresos:adjusted.revenue,costos:adjusted.costs,utilidad,rondasActivas:currentRound(),actividad:entries.length,
    decisiones:currentDecisionLabels(),apartados:categoryCompletionMap(),progreso:decisionProgressPercent(),enviado:decisionsSubmitted(),
    eventos:events.map(e=>({id:e.id,titulo:e.title,descripcion:e.description,afectados:e.scope==='group'?'Todos':'Empresa individual',ciclos:e.cycles,cicloAfecta:(Number(e.cycleOffset||0)===0?'+0 · mismo ciclo':Number(e.cycleOffset||0)===1?'+1 · siguiente ciclo':`+${Number(e.cycleOffset||0)} · después de ${Number(e.cycleOffset||0)} ciclos`),implicancia:e.implication,ocurrencia:e.probability})),
    estadoResultados:{ingresos:adjusted.revenue,costos:adjusted.costs,impactoEventos:eventImpact,utilidad},
    balanceCaja:{cajaInicial:initialCapital(),prestamos:loans,cajaFinal},
    flujoCaja:{operacion:adjusted.revenue-adjusted.costs,financiamiento:loans,eventos:eventImpact,flujoNeto:flujo},
    score:Math.max(0,Math.round(utilidad/100+decisionProgressPercent())),estado:'activa',tomandoDecisiones:playerIsDeciding,caja:cajaFinal,updatedAt:new Date().toISOString()
  };
  let reports=[];try{reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')}catch{}
  const idx=reports.findIndex(r=>r.id===report.id);if(idx>=0)reports[idx]=report;else reports.push(report);
  localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));renderStudentStatus();
}
function syncSectionToSupabase(){/* Las decisiones se mantienen en localStorage para la vista del docente. */}


function persistCurrentDraftOnly(){
  const cat=categoryByCat(currentCategory);if(!cat)return false;
  const draftStoreKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;
  let store={};try{store=JSON.parse(localStorage.getItem(draftStoreKey)||'{}')||{}}catch{}
  store[currentCategory]=deepClone(decisionDrafts);
  localStorage.setItem(draftStoreKey,JSON.stringify(store));
  return true;
}
function restoreDraftsForRound(){
  const key=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let store={};try{store=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
  decisionDrafts=store[currentCategory]||{};
}
function saveAllDraftedSections(){
  const original=currentCategory;
  for(const cat of DECISION_CATALOG){
    currentCategory=cat.cat;
    restoreDraftsForRound();
    if(!sectionDraftReady(cat.cat))continue;
    saveCurrentSection();
  }
  currentCategory=original;
  decisionDrafts={};
}
function submitAllDecisions(){
  if(decisionsSubmitted()){toast('Las decisiones de este ciclo ya fueron enviadas. Espera al próximo ciclo para modificarlas.');return}
  // Primero convierte los borradores pendientes de todas las pestañas en decisiones guardadas.
  persistCurrentDraftOnly();
  saveAllDraftedSections();
  const missing=requiredDecisionItems().filter(i=>!itemComplete(i));
  if(missing.length){toast('Completa las decisiones obligatorias que faltan antes de ENVIAR TODO.');renderTabs();renderDecisionCategory();return}
  DECISION_CATALOG.forEach(c=>setSectionSubmitted(c.cat,true));
  setDecisionsSubmitted(true);decisionDrafts={};syncStudentReportPreview();updateHud();renderTabs();renderDecisionCategory();toast('Todas las decisiones fueron enviadas y bloqueadas hasta el próximo ciclo.');
}
$('submitAllDecisionsBtn')?.addEventListener('click',submitAllDecisions);
$('topSubmitAllDecisions')?.addEventListener('click',submitAllDecisions);
function formatStudentTime(total){const s=Math.max(0,Math.floor(Number(total)||0));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function readRoundRuntime(){try{return JSON.parse(localStorage.getItem('SIDE_ROUND_RUNTIME')||'null')}catch{return null}}
function syncStudentTimer(){const r=readRoundRuntime(),conf=teacherConfig(),configuredDuration=Number(conf.roundHours||0)*3600+Number(conf.roundMinutes||0)*60+Number(conf.roundSecs||0);let remain=Number(r?.remaining??configuredDuration),note='Esperando inicio del docente';if(r?.running&&r.startedAt){const duration=Number(r.duration||configuredDuration||remain);remain=Math.max(0,duration-Math.floor((Date.now()-new Date(r.startedAt).getTime())/1000));note=remain>0?'Ciclo en curso':'Tiempo finalizado'}else if(r?.status==='scheduled'){const wait=Math.max(0,Math.floor((new Date(r.scheduledStart).getTime()-Date.now())/1000));note=wait>0?`Inicio automático en ${formatStudentTime(wait)}`:'Inicio automático pendiente'}else if(r?.status==='finished')note='Tiempo finalizado';const text=formatStudentTime(remain);if($('studentRoundTimer'))$('studentRoundTimer').textContent=text;if($('decisionRoundTimer'))$('decisionRoundTimer').textContent=text;if($('studentCycleLabel'))$('studentCycleLabel').textContent=`Ciclo ${r?.round||currentRound()} / ${conf.cycles||6}`;if($('studentTimerNote'))$('studentTimerNote').textContent=note}
function renderStudentStatus(){if(!$('studentCashResult'))return;applyEventCashEffects();const events=activeStudentEvents(),simRevenue=Number(cashLedger[`${currentRound()}:SIM_VENTAS`]||0),baseCosts=Object.entries(cashLedger).reduce((a,[k,n])=>a+(k.includes('SIM_VENTAS')||k.includes(':EVENT:')?0:Math.max(0,-Number(n||0))),0),adjusted=eventAdjustedFinancials(simRevenue,baseCosts),eventCash=Object.entries(cashLedger).filter(([k])=>k.includes(':EVENT:')).reduce((a,[,n])=>a+Number(n||0),0),pctImpact=(adjusted.revenue-simRevenue)-(adjusted.costs-baseCosts),eventImpact=eventCash+pctImpact,profit=adjusted.revenue-adjusted.costs+eventCash,flow=ledgerTotal()+pctImpact,loans=Object.entries(cashLedger).reduce((a,[k,n])=>a+(k.includes('SIM_VENTAS')||k.includes(':EVENT:')?0:Math.max(0,Number(n||0))),0);$('studentIncomeResult').textContent=money(profit);$('studentCashResult').textContent=money(cashBalance()+pctImpact);$('studentFlowResult').textContent=(flow>=0?'+':'−')+money(Math.abs(flow));const set=(id,val)=>{if($(id))$(id).textContent=money(val)};set('studentERIngresos',adjusted.revenue);set('studentERCostos',adjusted.costs);set('studentEREventos',eventImpact);set('studentERUtilidad',profit);set('studentBCInicial',initialCapital());set('studentBCPrestamos',loans);set('studentBCFinal',cashBalance()+pctImpact);set('studentFCOperacion',adjusted.revenue-adjusted.costs);set('studentFCFinanciamiento',loans);set('studentFCEventos',eventImpact);set('studentFCNeto',flow);if($('studentEventImpactText'))$('studentEventImpactText').textContent=events.length?`Impacto del ciclo: ${events.map(e=>e.title+' — '+e.implication).join(' · ')}`:'Sin impacto de eventos activo en este ciclo.';const news=$('studentNewsList');if(news)news.innerHTML=events.length?events.map(e=>`<article><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(e.implication)}</span><small>${e.scope==='group'?'GRUPAL · todos':'INDIVIDUAL · prob. '+e.probability+'%'} · duración ${e.cycles} ciclo(s)</small></article>`).join(''):'<p>Sin eventos activos en este ciclo.</p>'}
setInterval(()=>{syncStudentTimer();if(!$('studentLobby')?.classList.contains('hidden'))renderStudentStatus()},1000);

if(supabaseClient)supabaseClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')showScreen('profiles')});
