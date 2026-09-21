const cfg = window.SIDE_CONFIG || {};
const hasConfig = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('TU-PROYECTO') && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes('TU-PUBLISHABLE');
const supabaseClient = hasConfig && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
const $ = id => document.getElementById(id);
const screens = ['landing','profiles','studentLoading','tutorial','studentLobby','simulationLoading','simulator3d','decisionMenu'];
const modals = ['teacherLoginModal','teacherRegisterModal','studentModal'];
const DEMO_TEACHER = {email:'profesor@upch.pe',password:'Heredia'};
const DEMO_GAME = {id:'demo-side-000',codigo:'SIDE-000',nombre:'SIDE — Simulación Principal',curso:'Finanzas Corporativas',estado:'esperando'};
const COMPANY_NAME = 'MI EMPRESA'; // respaldo visual; el estudiante define el nombre comercial al ingresar
const DECISION_CATALOG = Array.isArray(window.SIDE_DECISION_CATALOG) ? window.SIDE_DECISION_CATALOG : [];
const EVENT_CATALOG = Array.isArray(window.SIDE_EVENT_CATALOG) ? window.SIDE_EVENT_CATALOG : [];
const CREDIT_INITIAL_PERCENT = 70;
const CREDIT_ASSET_PERCENT = 20;
// Supuestos del modelo de producción: un ciclo representa 30 días de operación.
const WORKING_DAYS_PER_MONTH = 24;
// Indemnización por reducir personal de un ciclo a otro: medio "sueldo" (costo de la
// opción) por persona que se retira, como aproximación simple de liquidación laboral.
const SEVERANCE_RATE = 0.5;
// % de recuperación al vender/liquidar una máquina ya adquirida cuando la opción no
// define su propio liquidationRate.
const LIQUIDATION_RATE_DEFAULT = 0.4;
const RULES = window.SIDE_RULES;
const UI_ICONS = {check:'assets/icons/ui/check.svg',play:'assets/icons/ui/play.svg',lock:'assets/icons/ui/lock.svg'};
let currentStudent = {name:'Jugador',company:COMPANY_NAME,participantId:null,empresaId:null,game:DEMO_GAME};
let decisionState = {};
let decisionDrafts = {};
let cashLedger = {};
let currentCategory = null;
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
function creditOutstanding(){
  const prefix=`SIDE_DECISION_RECEIPTS_${storageKey()}_`;
  let total=0;
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key?.startsWith(prefix))continue;
    try{
      const receipt=JSON.parse(localStorage.getItem(key)||'{}')||{};
      const item=receipt.E?.items?.find(x=>x.id==='PRESTAMO');
      total+=Number(item?.financing||0);
    }catch{}
  }
  return Math.max(0,total);
}
function creditAssetValue(){
  let total=0;
  const assetIds=['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'];
  for(const id of assetIds){
    const item=findDecisionItem(id); if(!item)continue;
    const e=savedEntry(item); if(!e?.purchases)continue;
    for(const opt of item.options||[]){
      const netQty=Object.values(e.purchases).reduce((sum,row)=>sum+(Number(row?.[opt.id])||0),0);
      total+=Math.max(0,netQty)*Number(opt.cost||0);
    }
  }
  return Math.max(0,total);
}
function creditApprovedLine(){
  const round=currentRound();
  if(round<=1)return Math.floor(initialCapital()*CREDIT_INITIAL_PERCENT/100/500)*500;
  const cash=Math.max(0,cashBalance()-creditOutstanding());
  const assets=creditAssetValue();
  return Math.floor((cash*CREDIT_INITIAL_PERCENT/100+assets*CREDIT_ASSET_PERCENT/100)/500)*500;
}
function creditAvailable(){return Math.max(0,creditApprovedLine()-creditOutstanding());}
function loanMaximum(){return creditAvailable()}
function loanInitialReference(){return creditApprovedLine()}
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
function simulationSubmissionComplete(){return decisionsSubmitted()||decisionCategories().every(category=>sectionSubmitted(category.cat))}
function canStartSimulation(){return decisionProgressPercent()===100&&simulationSubmissionComplete()}
function setDecisionsSubmitted(v){if(v)localStorage.setItem(submissionKey(),'1');else localStorage.removeItem(submissionKey())}
function sectionLedgerKey(cat){return `${currentRound()}:${cat}`}
window.SIDE_GAME_BRIDGE={
  get decisions(){return decisionState},
  get ledger(){return cashLedger},
  currentRound:()=>currentRound(),
  cash:()=>cashBalance(),
  decisionProgress:()=>decisionProgressPercent(),
  canStartSimulation:()=>canStartSimulation(),
  companyName:()=>currentStudent.company||COMPANY_NAME,
  legalName:()=>currentStudent.legalName||currentStudent.company||COMPANY_NAME,
  activeEvents:()=>activeStudentEvents(),
  productionPlan:()=>productionPlan(),
  recordSimulatedSale(amount=75){
    const sale=Math.max(0,Number(amount)||0),key=`${currentRound()}:SIM_VENTAS`;
    cashLedger[key]=Number(cashLedger[key]||0)+sale;
    const physicalStores=RULES.storeCount(savedEntry(findDecisionItem('CANALES')));
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
function openTeacherPanel(){closeModal();window.location.href='docente.html?v=20260910-2'}
$('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;if(email===DEMO_TEACHER.email&&password===DEMO_TEACHER.password){openTeacherPanel();return}if(!requireSupabase())return;message('loginMessage','Ingresando...');const{error}=await supabaseClient.auth.signInWithPassword({email,password});if(error){message('loginMessage',error.message,true);return}openTeacherPanel()});
$('registerForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireSupabase())return;message('registerMessage','Creando cuenta...');const email=$('registerEmail').value.trim(),password=$('registerPassword').value;const{data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{nombre:$('registerName').value.trim(),apellido:$('registerLastName').value.trim(),curso:$('registerCourse').value.trim()}}});if(error){message('registerMessage',error.message,true);return}$('registerForm')?.reset();if(data.session)openTeacherPanel();else message('registerMessage','Cuenta creada. Revisa tu correo si la confirmación está activada.')});
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
    const S=window.SIDE||{};
    // Fase A: buscar partida + crear empresa via servicios (RPC crear_empresa).
    // Si Supabase falla, se usa el flujo local anterior como respaldo.
    let found=null,empresaId=null,participantId=null;
    if(S.PartidaService){
      const r=await S.PartidaService.buscarPorCodigo(code);
      if(!r.success){message('studentMessage',r.error||'Error al buscar partida.',true);return}
      found=r.data;
    }else{
      const{data:game,error}=await supabaseClient.rpc('buscar_partida_por_codigo',{p_codigo:code});if(error){message('studentMessage',error.message,true);return}
      found=Array.isArray(game)?game[0]:game;
    }
    if(!found){message('studentMessage','No encontramos una partida con ese código.',true);return}
    if(S.EmpresaService){
      const c=await S.EmpresaService.crear(found.id,{nombreEstudiante:'Jugador',nombreLegal:legalName,nombreComercial:brandName,capital:initialCapital()});
      if(!c.success){message('studentMessage',c.error||'No se pudo crear la empresa.',true);return}
      empresaId=c.data?.empresa_id||null;participantId=c.data?.participante_id||null;
      // Fase A-fix: la partida manda en capital y reglas. Si el navegador no
      // tiene config propia (incógnito/dispositivo nuevo), se siembra la remota
      // para que la economía local coincida. Con config propia, manda la local.
      try{
        const remoteCfg=c.data?.configuracion;
        if(remoteCfg&&typeof remoteCfg==='object'&&!localStorage.getItem('SIDE_TEACHER_CONFIG')){
          localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(remoteCfg));
        }
      }catch(error){console.error('SIDE: no se pudo aplicar config de partida',error)}
    }else{
      const{data:participant,error:joinError}=await supabaseClient.from('participantes').insert({partida_id:found.id,nombre:'Jugador',empresa:brandName}).select('id').single();
      if(joinError){message('studentMessage',joinError.message,true);return} participantId=participant?.id||null;
    }
    currentStudent={name:'Jugador',company:brandName,legalName,participantId,empresaId,game:found};
  }
  // Fase C3: sincroniza el ciclo real desde Supabase (el docente pudo avanzar).
  // Solo sube (nunca baja) y no toca la config local del docente.
  try{
    const S=window.SIDE||{};
    if(S.EmpresaService&&S.SupabaseClient?.isReady()&&currentStudent.empresaId){
      S.EmpresaService.obtenerEstado(currentStudent.empresaId).then(r=>{
        if(!r.success||!r.data)return;
        const remoteRound=Math.max(1,Number(r.data.ciclo_partida)||Number(r.data.empresa?.ciclo_actual)||1);
        if(remoteRound>currentRound()){try{localStorage.setItem('SIDE_ACTIVE_ROUND',String(remoteRound))}catch{}console.info('SIDE: ciclo sincronizado desde Supabase:',remoteRound)}
        try{localStorage.setItem('SIDE_PARTIDA_REMOTA_'+currentStudent.empresaId,JSON.stringify(r.data.partida||{}))}catch{}
      });
    }
  }catch(error){console.error('SIDE: no se pudo sincronizar el estado',error)}
  closeModal();startJoinLoading();
});
function startJoinLoading(){showScreen('studentLoading');let p=0,step=0;const texts=['Sincronizando partida','Cargando escenario empresarial','Preparando decisiones','¡Todo listo!'];$('joinProgress').style.width='0%';const i=setInterval(()=>{p+=4;$('joinProgress').style.width=p+'%';if(p%25===0&&step<3)$('joinLoadingText').textContent=texts[++step];if(p>=100){clearInterval(i);prepareLobby()}},55)}
async function prepareLobby(){
  $('lobbyCode').textContent=currentStudent.game.codigo;$('lobbyGameName').textContent=currentStudent.game.nombre;
  $('lobbyStudent').textContent=currentStudent.legalName&&currentStudent.legalName!==currentStudent.company?`${currentStudent.company} · ${currentStudent.legalName}`:currentStudent.company;
  $('lobbySegment').textContent='EMPRESA: '+currentStudent.company+' · REVISA Y REGISTRA TUS DECISIONES';
  renderStudentStatus(); syncStudentTimer();
  await openStudentTutorial();
}
async function openStudentTutorial(){
  showScreen('tutorial'); const mount=$('tutorialMount');
  if(!mount.dataset.loaded){try{const response=await fetch('tutorial.html?v=20260910-2');if(!response.ok)throw new Error('No se pudo cargar tutorial.html');mount.innerHTML=await response.text();mount.dataset.loaded='1'}catch(error){console.error(error);showScreen('studentLobby');return}}
  if(typeof window.initSIDETutorial==='function')window.initSIDETutorial(()=>showScreen('studentLobby'));
}
$('enterDecisionsBtn')?.addEventListener('click',openDecisionMenu);
$('reopenTutorialBtn')?.addEventListener('click',openStudentTutorial);
$('backToProfiles')?.addEventListener('click',()=>showScreen('profiles'));
$('exitDecisions')?.addEventListener('click',()=>{playerIsDeciding=false;syncStudentReportPreview();if(window.__SIDE_RETURN_TO_3D){window.__SIDE_RETURN_TO_3D=false;window.SIDE3D?.returnFromDecisions?.();}else showScreen('studentLobby')});
$('restartDecisionMenu')?.addEventListener('click',()=>{$('decisionSummary').classList.add('hidden');renderDecisionCategory()});

function allDecisionItems(){return DECISION_CATALOG.flatMap(c=>c.items)}
function decisionCategories(){return DECISION_CATALOG.filter(category=>!category.summaryOnly)}
function navigationCategories(){
  const summary=DECISION_CATALOG.find(category=>category.summaryOnly),decisions=decisionCategories();
  return currentRound()<=1?[...decisions,...(summary?[summary]:[])]:[...(summary?[summary]:[]),...decisions];
}
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
  if(item?.id==='MOLDE')return ownedMolds().length===0;
  if(item?.requiredWhenProduction)return currentProductionTarget()>0;
  return item?.required===true;
}
function itemComplete(item){
  if(item.type==='info')return true;
  const e=savedEntry(item); if(!e)return false;
  if(item.recurring&&Number(e.round)!==currentRound())return false;
  if(item.asset&&e.purchases)return Object.values(e.purchases).some(r=>Object.values(r||{}).some(q=>Number(q)>0));
  if(item.type==='production-plan')return (e.moldTargets?Object.values(e.moldTargets).reduce((total,value)=>total+Number(value||0),0):Number(e.value||0))>=Number(item.min||0);
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
function ownedMolds(){
  const item=findDecisionItem('MOLDE'),e=savedEntry(item),owned=[];
  for(const [round,row] of Object.entries(e?.purchases||{})){
    if(Number(round)>=currentRound())continue;
    for(const [id,q] of Object.entries(row||{}))if(Number(q)>0&&!owned.some(x=>x.id===id))owned.push({id,round:Number(round)});
  }
  if(!owned.length&&e&&Number(e.round)<currentRound())for(const id of e.optionIds||[])if(item.options.some(option=>option.id===id))owned.push({id,round:Number(e.round)});
  return owned;
}
function initDraft(item){
  if(decisionDrafts[item.id]){
    return decisionDrafts[item.id];
  }
  const e=savedEntry(item);
  if(item.asset){const quantities={};item.options.forEach(o=>quantities[o.id]=currentPurchase(item,o.id));return decisionDrafts[item.id]={quantities}}
  if(item.type==='quantity'||item.type==='quantity-choice'){const quantities={};item.options.forEach(o=>quantities[o.id]=Number(e?.round===currentRound()?e.quantities?.[o.id]:0));return decisionDrafts[item.id]={quantities}}
  if(item.type==='production-plan'){
    const moldTargets={molde_1:0,molde_2:0,molde_3:0};
    if(e?.round===currentRound()&&e.moldTargets)Object.keys(moldTargets).forEach(id=>moldTargets[id]=Number(e.moldTargets[id]||0));
    else if(e?.round===currentRound()&&e.value){const legacyId=e.moldId||'molde_1';moldTargets[legacyId]=Number(e.value||0);}
    return decisionDrafts[item.id]={moldTargets};
  }
  if(item.type==='number')return decisionDrafts[item.id]={value:Number(e?.round===currentRound()?e.value:0)};
  if(item.id==='MOLDE')return decisionDrafts[item.id]={optionIds:e?.round===currentRound()?(e.optionIds||[]):[]};
  if(item.type==='loan')return decisionDrafts[item.id]={amount:Number(e?.round===currentRound()?e.amount:0)};
  if(item.type==='sales-staff')return decisionDrafts[item.id]={staff:deepClone(e?.round===currentRound()?e.staff:{})};
  if(item.id==='CANALES'){
    const optionIds=(e?.optionIds||[]).slice(),quantities={};
    RULES.STORE_IDS.forEach(id=>{if(optionIds.includes(id))quantities[id]=RULES.storeQuantity(e,id)});
    return decisionDrafts[item.id]={optionIds,quantities};
  }
  const ids=(e?.optionIds||item.defaultOptionIds||[]).slice();return decisionDrafts[item.id]={optionIds:ids};
}
function selectedOptionIds(item){return initDraft(item).optionIds||[]}
function analystSelected(){const item=findDecisionItem('ANALISTA_COMPRAS');return selectedOptionIds(item).includes('si_analista')}
function analystDiscount(){return analystSelected()?Math.max(2,12-(currentRound()-1)*2):0}
function optionUnitCost(item,opt){const base=Number(opt.cost)||0;return item.material?base*(1-analystDiscount()/100):base}
function currentProductionTarget(){return Object.values(initDraft(findDecisionItem('PRODUCCION_META')).moldTargets||{}).reduce((total,value)=>total+Number(value||0),0)}
function productionPlan(){return window.SIDE_PRODUCTION_MODEL.calculate(decisionModelContext())}
function materialYieldLabel(itemId,optionId){
  const amount=window.SIDE_PRODUCTION_MODEL.yieldFor(itemId,optionId),unit=window.SIDE_PRODUCTION_MODEL.materialUnit(itemId);
  return amount?`Cada compra aporta ${amount.toLocaleString('es-PE')} ${unit}`:'';
}
function districtDemand(id){const c=teacherConfig();return id==='los_olivos'?Number(c.demandLosOlivos??1000):id==='miraflores'?Number(c.demandMiraflores??1250):id==='sjl'?Number(c.demandSJL??1100):0}
function chosenStores(){const item=findDecisionItem('CANALES');return selectedOptionIds(item).map(id=>item.options.find(o=>o.id===id)).filter(o=>o?.channel==='store')}
function channelDraft(){
  const item=findDecisionItem('CANALES'),d=initDraft(item);
  d.quantities=d.quantities||{};
  RULES.STORE_IDS.forEach(id=>{if((d.optionIds||[]).includes(id))d.quantities[id]=RULES.storeQuantity(d,id)});
  return d;
}
function storeMinimum(id){return RULES.committedQuantity(savedEntry(findDecisionItem('CANALES')),id,currentRound())}
function renderChannelChoices(item,locked){
  const d=channelDraft();
  return `<div class="choice-strip store-channel-grid">${item.options.map(option=>{
    const id=option.id,selected=(d.optionIds||[]).includes(id),physical=option.channel==='store';
    const remaining=optionCommitRemaining(item,id),disabled=locked||(physical&&storeMinimum(id)>0);
    return `<div class="store-channel-card ${selected?'selected':''}" data-channel-card="${id}">
      <label class="choice-pill ${selected?'selected':''} ${disabled?'fixed-choice':''}">
        <input data-choice="CANALES" data-option="${id}" type="checkbox" name="decision-channels" ${selected?'checked':''} ${disabled?'disabled':''}>
        <span class="choice-check"></span><strong>${escapeHtml(option.label)}</strong>
        <em>${money(optionUnitCost(item,option))}${physical?' <span class="store-unit-caption">/ ciclo</span>':''}</em>
        <p>${escapeHtml(option.desc)}</p>
        ${physical?`<small>Demanda base del distrito: ${districtDemand(id).toLocaleString('es-PE')} u./ciclo</small>`:''}
        ${remaining?`<span class="lock-note">Compromiso vigente: ${remaining} ciclo(s)</span>`:''}
      </label>
    </div>`;
  }).join('')}</div><div class="micro-caption">Puedes seleccionar varias tiendas físicas en los distritos disponibles y activar también el canal web. Cada tienda incluye un vendedor básico.</div>`;
}
function validateChannelQuantities(){
  const d=channelDraft(),previous=savedEntry(findDecisionItem('CANALES'));
  for(const id of RULES.STORE_IDS){
    if(RULES.storeQuantity(d,id)<RULES.committedQuantity(previous,id,currentRound())){toast('Debes mantener las tiendas con contrato vigente.');return false}
  }
  return true;
}
function creditPercent(){const base=Number(teacherConfig().creditPercentStart??20);return Math.min(70,base+(currentRound()-1)*5+(analystSelected()?5:0))}
function recurringAlreadyPrevious(item){const e=savedEntry(item);return e&&Number(e.round)<currentRound()}
function priorQuantity(item,optId){const e=savedEntry(item);if(!e)return 0;return Number(Number(e.round)===currentRound()?e.previousQuantities?.[optId]||0:e.quantities?.[optId]||0)}
function severanceForItem(item){
  if(!item.severanceEligible)return 0;
  const d=initDraft(item);
  return (item.options||[]).reduce((sum,o)=>{
    const prev=priorQuantity(item,o.id),now=Number(d.quantities?.[o.id]||0);
    return now<prev?sum+(prev-now)*optionUnitCost(item,o)*SEVERANCE_RATE:sum;
  },0);
}
function optionCommitRemaining(item,optId){
  if(item.id==='CANALES'&&RULES.STORE_IDS.includes(optId))return RULES.remainingCommitment(savedEntry(item),optId,currentRound());
  const opt=(item.options||[]).find(o=>o.id===optId);
  if(!opt?.minCommitCycles)return 0;
  const e=savedEntry(item),firstRound=e?.optionRounds?.[optId];
  if(firstRound===undefined)return 0;
  return Math.max(0,Number(opt.minCommitCycles)-(currentRound()-Number(firstRound)));
}

function historicalQuantities(){
  const out={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i); if(!key?.startsWith(`SIDE_DECISION_RECEIPTS_${storageKey()}_`))continue;
    try{const receipt=JSON.parse(localStorage.getItem(key)||'{}')||{};for(const section of Object.values(receipt))for(const item of section?.items||[]){
      if(!['quantity','quantity-choice'].includes(item.type)||item.asset)continue;
      const dst=out[item.id]||(out[item.id]={});
      for(const row of item.rows||[])if(row.quantity!=null){
        const label=String(row.label||''); const def=findDecisionItem(item.id); const opt=def?.options?.find(o=>o.label===label); if(opt)dst[opt.id]=(dst[opt.id]||0)+Number(row.quantity)||0;
      }
    }}catch{}
  }
  return out;
}
function decisionModelContext(){
  const drafts={};allDecisionItems().forEach(item=>{drafts[item.id]=deepClone(initDraft(item))});
  return {catalog:DECISION_CATALOG,state:decisionState,drafts: drafts,round:currentRound(),config:teacherConfig(),rules:RULES,
    capital:initialCapital(),ledger:cashLedger,workingDays:WORKING_DAYS_PER_MONTH,severanceRate:SEVERANCE_RATE,liquidationRate:LIQUIDATION_RATE_DEFAULT,
    creditOutstanding:creditOutstanding(),creditApprovedLine:creditApprovedLine(),creditAvailable:creditAvailable(),historyQuantities:historicalQuantities()};
}
function computeItemCost(item){
  const detail=window.SIDE_REVIEW_MODEL.breakdown(item,decisionModelContext());
  return detail.outflow-detail.assetIncome;
}
function categoryDraftNet(cat){
  const category=categoryByCat(cat);if(!category)return 0;
  let cost=0,loan=0;
  category.items.forEach(item=>{if(item.type==='loan')loan+=Number(initDraft(item).amount||0);else cost+=computeItemCost(item)});
  return loan-cost;
}
function projectedCash(){const old=Number(cashLedger[sectionLedgerKey(currentCategory)]||0);return initialCapital()+ledgerTotal()-old+categoryDraftNet(currentCategory)}

function openDecisionMenu(){
  loadDecisionState(); playerIsDeciding=true; currentCategory=currentCategory||navigationCategories()[0]?.cat; restoreDraftsForRound(); showScreen('decisionMenu');
  renderTabs(); renderDecisionCategory(); updateHud(); syncStudentReportPreview();
  updateDecisionLayout();
}
function updateDecisionLayout(){
  const screen=$('decisionMenu');
  if(!screen||screen.classList.contains('hidden'))return;
  screen.style.setProperty('--decision-top-height',`${$('decisionTopbar').offsetHeight}px`);
  screen.style.setProperty('--decision-tabs-height',`${$('decisionTabs').offsetHeight}px`);
}
const decisionLayoutObserver=new ResizeObserver(updateDecisionLayout);
[$('decisionTopbar'),$('decisionTabs')].filter(Boolean).forEach(el=>decisionLayoutObserver.observe(el));
window.addEventListener('resize',updateDecisionLayout);
function renderTabs(){
  const nav=$('decisionTabs');
  nav.innerHTML=navigationCategories().map(c=>{const sent=!c.summaryOnly&&sectionSubmitted(c.cat),saved=!c.summaryOnly&&categoryHasSaved(c.cat);return `<button class="decision-tab ${c.cat===currentCategory?'active':''} ${sent?'section-sent':''}" data-cat="${c.cat}"><img src="${escapeHtml(c.icon)}" alt=""><span class="tab-label">${escapeHtml(c.short||c.title)}</span>${sent?'<b class="tab-status">✓ ENVIADA</b>':saved?'<b class="tab-status">BORRADOR</b>':''}</button>`}).join('');
  updateDecisionLayout();
  nav.querySelectorAll('.decision-tab').forEach(b=>b.addEventListener('click',()=>{currentCategory=b.dataset.cat;renderTabs();renderDecisionCategory()}));
}
function categoryHasSaved(cat){const c=categoryByCat(cat);const req=c.items.filter(itemRequired);return req.length?req.every(itemComplete):c.items.filter(i=>i.type!=='info').some(itemComplete)}
function draftItemComplete(item){
  if(item.type==='info')return true;
  if(item.lockAfterPurchase&&itemComplete(item))return true;
  const d=initDraft(item);
  if(item.type==='production-plan')return Object.values(d.moldTargets||{}).reduce((total,value)=>total+Number(value||0),0)>=Number(item.min||0);
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
function stationStats(itemId){
  const item=findDecisionItem(itemId);
  let count=0,capacity=0,buying=0;
  (item?.options||[]).forEach(o=>{
    const previous=getOwned(item,o.id),draftQty=Number(initDraft(item).quantities?.[o.id]||0);
    const total=Math.max(0,previous+draftQty);
    count+=total; capacity+=total*Number(o.dailyCapacity||0);
    if(draftQty>0)buying+=draftQty;
  });
  return {count,capacity,buying};
}
let disposeProductionDop=()=>{};
function productionDopHtml(plan=productionPlan()){
  const producedPercent=plan.target?Math.min(100,Math.round(plan.producibleUnits/plan.target*100)):0;
  return window.SIDE_PRODUCTION_DOP.render(plan,{round:currentRound(),producedPercent});
}
// Refresh only the diagram while the existing input handlers own state and calculations.
function refreshProductionDop(){
  if(currentCategory!=='C')return;
  const mount=document.querySelector('.production-dop-mount');
  if(!mount)return;
  disposeProductionDop();
  mount.innerHTML=productionDopHtml();
  disposeProductionDop=window.SIDE_PRODUCTION_DOP.mount(mount);
}
document.addEventListener('input',event=>{
  if(event.target?.matches?.('[data-qty], [data-mold-target]'))refreshProductionDop();
});
function renderDecisionCategory(){
  disposeProductionDop();
  const cat=categoryByCat(currentCategory)||DECISION_CATALOG[0];currentCategory=cat.cat;
  $('categoryTitle').textContent=cat.title;$('categoryDescription').textContent=cat.desc;$('detailCategoryIcon').src=cat.icon;$('roundLabel').textContent=`CICLO ${currentRound()} · ${currentStudent.company}`;
  const items=cat.items.filter(item=>!(item.lockAfterPurchase&&isLocked(item)));
  const cardItems=items.filter(i=>!i.displayAsAsterisk),footnoteItems=items.filter(i=>i.displayAsAsterisk);
  let lead=cat.summaryOnly?'':`<div class="event-clue"><span>NOTICIA / CONTEXTO</span><strong>${escapeHtml(eventHint())}</strong><small>Los eventos aplicados aparecen en el resumen financiero.</small></div>`;
  if(cat.cat==='D')lead+=`<div class="required-alert"><strong>Canal de ventas obligatorio</strong><span>Debes marcar al menos un canal para poder enviar tus decisiones.</span></div>`;
  const footnotes=footnoteItems.length?`<div class="asterisk-notes">${footnoteItems.map(i=>`<p class="asterisk-note">* ${escapeHtml(i.desc)}</p>`).join('')}</div>`:'';
  const cards=cat.cat==='C'?renderDecisionRow(cardItems.find(item=>item.id==='PRODUCCION_META'))+`<div class="production-dop-mount">${productionDopHtml()}</div>`+cardItems.filter(item=>item.id!=='PRODUCCION_META').map(renderDecisionRow).join(''):cardItems.map(renderDecisionRow).join('');
  $('decisionCards').innerHTML=lead+cards+footnotes+(cat.cat==='A'?'<div id="companySummaryMount"></div>':'');
  document.querySelector('.section-save-bar')?.classList.toggle('hidden',!!cat.summaryOnly);
  bindDecisionControls(); updateHud(); updateSectionCost(); syncStudentTimer(); updateDecisionLayout();
  disposeProductionDop=window.SIDE_PRODUCTION_DOP.mount(document.querySelector('.production-dop-mount'));
}
function renderDecisionRow(item){
  const locked=isLocked(item)||cycleDecisionsLocked(),saved=itemComplete(item),cost=computeItemCost(item),d=initDraft(item),required=itemRequired(item);
  let body='';
  if(item.id==='CANALES'){
    body=renderChannelChoices(item,locked);
  } else if(item.id==='MOLDE'){
    const owned=ownedMolds(),ownedIds=owned.map(x=>x.id),selected=(d.optionIds||[])[0]||'';
    body=`<div class="choice-strip radio-options">${item.options.map(o=>{const already=ownedIds.includes(o.id),isSelected=selected===o.id&&!already;const disabled=locked||already;return `<label class="choice-pill ${isSelected?'selected':''} ${disabled?'fixed-choice':''}"><input data-choice="${item.id}" data-option="${o.id}" type="radio" name="decision-${item.id}" ${isSelected?'checked':''} ${disabled?'disabled':''}><span class="choice-check"></span><strong>${escapeHtml(o.label)}</strong><em>${money(optionUnitCost(item,o))}</em><p>${escapeHtml(o.desc)}</p>${already?'<span class="owned-badge">YA TIENES ESTE MOLDE · NO SE VUELVE A COMPRAR</span>':isSelected?'<span class="buying-badge">MOLDE ELEGIDO EN INFRAESTRUCTURA</span>':''}</label>`}).join('')}</div><div class="mandatory-note">Por reglamento debes adquirir al menos un molde antes de enviar el ciclo. Los moldes comprados permanecen disponibles y cada tipo se paga una sola vez.</div><div class="mold-owned-list"><strong>MOLDES DISPONIBLES</strong>${owned.length?owned.map(x=>{const o=item.options.find(v=>v.id===x.id);return `<span>${escapeHtml(o?.label||x.id)}</span>`}).join(''):'<span>Ninguno de ciclos anteriores</span>'}${selected?`<span>Elegido ahora: ${escapeHtml(item.options.find(o=>o.id===selected)?.label||selected)}</span>`:''}</div>`;
  } else if(item.type==='choice'||item.type==='multi-choice'){
    const multi=item.type==='multi-choice';
    body=`<div class="choice-strip ${multi?'checkbox-options':'radio-options'}">${item.options.map(o=>{const selected=(d.optionIds||[]).includes(o.id);const extra=o.district?`<small>Demanda base: ${districtDemand(o.id).toLocaleString('es-PE')} u./ciclo</small>`:'';const commitRemaining=multi?optionCommitRemaining(item,o.id):0;const disabled=locked||item.mandatoryFixed||(selected&&commitRemaining>0);const showPrice=item.showPrice!==false;const lockNote=commitRemaining>0?`<span class="lock-note">🔒 Compromiso vigente: ${commitRemaining} ciclo(s) más antes de poder retirarlo</span>`:'';return `<label class="choice-pill ${selected?'selected':''} ${disabled?'fixed-choice':''}"><input data-choice="${item.id}" data-option="${o.id}" type="${multi?'checkbox':'radio'}" name="decision-${item.id}" ${selected?'checked':''} ${disabled?'disabled':''}><span class="choice-check"></span><strong>${escapeHtml(o.label)}</strong>${showPrice?`<em>${money(optionUnitCost(item,o))}</em>`:''}<p>${escapeHtml(o.desc)}</p>${extra}${lockNote}</label>`}).join('')}</div>${multi?'<div class="micro-caption">Casillas: puedes seleccionar una o varias opciones.</div>':`<div class="micro-caption">${!required&&!item.mandatoryFixed?'Selecciona una alternativa; vuelve a pulsarla para dejarla sin selección.':'Botón de opción: solo puedes seleccionar una alternativa.'}</div>`}${item.mandatoryFixed?'<div class="mandatory-note">Este costo es obligatorio y permanece marcado durante la simulación.</div>':''}`;
  } else if(item.type==='quantity'||item.type==='quantity-choice'){
    body=`<div class="quantity-grid">${item.options.map(o=>{const q=Number(d.quantities?.[o.id]||0),owned=item.asset?getOwned(item,o.id):0;const floor=item.asset?-owned:0;const sellValue=q<0?Math.abs(q)*optionUnitCost(item,o)*Number(o.liquidationRate??LIQUIDATION_RATE_DEFAULT):0;const prevHeadcount=item.severanceEligible?priorQuantity(item,o.id):0;const severance=item.severanceEligible&&q<prevHeadcount?(prevHeadcount-q)*optionUnitCost(item,o)*SEVERANCE_RATE:0;return `<div class="quantity-option"><div class="quantity-copy"><strong>${escapeHtml(o.label)}</strong><p>${escapeHtml(o.desc)}</p><small>${money(optionUnitCost(item,o))} c/u${item.material&&analystDiscount()?` · −${analystDiscount()}% negociado`:''}</small>${item.asset?`<span class="owned-badge">YA TIENES: ${owned}</span>${q>0?`<span class="buying-badge">VAS A COMPRAR: ${q}</span>`:q<0?`<span class="selling-badge">VAS A VENDER (LIQUIDAR): ${Math.abs(q)} · recuperas ${money(sellValue)}</span>`:''}`:''}${item.material?`<span class="need-badge">${escapeHtml(materialYieldLabel(item.id,o.id))}</span>`:''}${severance>0?`<span class="severance-badge">DESPIDO: ${prevHeadcount-q} persona(s) · liquidación ${money(severance)}</span>`:''}</div><div class="stepper"><button data-step="${item.id}" data-option="${o.id}" data-delta="-1">−</button><input data-qty="${item.id}" data-option="${o.id}" type="number" min="${floor}" step="1" value="${q}"><button data-step="${item.id}" data-option="${o.id}" data-delta="1">+</button></div></div>`}).join('')}</div>${item.asset?'<div class="micro-caption">Puedes bajar de 0 para vender/liquidar equipo ya adquirido (recuperas un % de su costo).</div>':''}${item.severanceEligible?'<div class="micro-caption">Reducir personal respecto al ciclo anterior genera un costo de indemnización por despido.</div>':''}`;
  } else if(item.type==='production-plan'){
    const plan=productionPlan();
    body=`<div class="production-calculator"><header><div><span>CALCULADORA DE PRODUCCIÓN</span><strong>Define el volumen por cada molde</strong><p>Los tres escenarios siempre se muestran. La sugerencia es una referencia calculada por SIDE según tu capacidad instalada; tú decides la cantidad final.</p></div><div class="production-total"><small>TOTAL DESEADO</small><b>${plan.target.toLocaleString('es-PE')} u.</b></div></header><div class="mold-production-grid">${plan.productLines.map(line=>`<article class="mold-production-card ${line.available?'is-available':'is-unavailable'}"><div class="mold-production-title"><div><span>${line.available?(line.selectedThisCycle?'ELEGIDO EN INFRAESTRUCTURA':'DISPONIBLE'):'ESCENARIO DE CÁLCULO'}</span><h4>${escapeHtml(line.label)}</h4></div>${line.available?'<b>✓ Molde habilitado</b>':'<b>Molde aún no adquirido</b>'}</div><label for="production-${line.id}">¿Cuánto deseas producir con este molde?</label><div class="mold-target-control"><button type="button" data-mold-step="${line.id}" data-delta="-10" ${locked?'disabled':''}>−10</button><input id="production-${line.id}" data-mold-target="${line.id}" type="number" inputmode="numeric" min="0" step="1" value="${line.target}" ${locked?'disabled':''}><button type="button" data-mold-step="${line.id}" data-delta="10" ${locked?'disabled':''}>+10</button><span>unidades</span></div><button type="button" class="mold-suggestion" data-mold-suggest="${line.id}" ${locked?'disabled':''}>Usar sugerencia SIDE: ${line.suggested.toLocaleString('es-PE')} u.</button><div class="mold-requirements"><span>INSUMOS NECESARIOS PARA ${line.target.toLocaleString('es-PE')} U.</span><b>Cuero: ${line.requirements.CUERO.toLocaleString('es-PE')} m²</b><b>Accesorios: ${line.requirements.ACCESORIOS.toLocaleString('es-PE')} u.</b><b>Hilo: ${line.requirements.HILO.toLocaleString('es-PE')} m</b></div></article>`).join('')}</div><footer><span>Capacidad del cuello de botella: <b>${plan.processCapacity.toLocaleString('es-PE')} u./ciclo</b></span><span>Producción posible con tus insumos: <b>${plan.producibleUnits.toLocaleString('es-PE')} u.</b></span><small>La calculadora permite comparar los moldes aunque todavía no los hayas comprado. Para operar, debes cumplir la compra obligatoria de al menos un molde en Infraestructura.</small></footer></div>`;
  } else if(item.type==='number'){
    const plan=productionPlan();body=`<div class="number-decision"><button data-number-step="${item.id}" data-delta="-10">−10</button><input data-number="${item.id}" type="number" min="${item.min||0}" step="${item.step||1}" value="${Number(d.value||0)}"><button data-number-step="${item.id}" data-delta="10">+10</button><span>${escapeHtml(item.unit||'')}</span></div><div class="requirements"><span>Materia prima para la meta · ${escapeHtml(plan.moldLabel)}</span>${plan.materials.map(material=>`<b>${escapeHtml(material.label)}: ${material.neededForTarget.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</b>`).join('')}<small>La compra se convierte según su presentación: rollo, piel, juego o carrete.</small></div>`;
  } else if(item.type==='sales-staff'){
    body=`<div class="info-decision"><strong>Personal automático por tienda</strong><p>Se asigna 1 vendedor básico a cada tienda física. La comisión es 1% de las ventas.</p></div>`;
  } else if(item.type==='loan'){
    const rate=Number(teacherConfig().interest??20),approved=creditApprovedLine(),available=creditAvailable(),amount=Math.min(available,Number(d.amount||0)),afterRequest=Math.max(0,available-amount);body=`<div class="loan-box"><div><span>TEA</span><strong>${rate.toFixed(1)}%</strong><small>Condición definida por el docente</small></div><div><span>LÍNEA APROBADA</span><strong>${money(approved)}</strong><small>${currentRound()===1?'70% de la caja inicial':'Se actualiza según caja y activos'}</small></div><div><span>LÍNEA DISPONIBLE</span><strong>${money(afterRequest)}</strong><small>Después de esta solicitud</small></div></div><div class="loan-control"><input data-loan="${item.id}" type="range" min="0" max="${available}" step="500" value="${amount}"><input data-loan-number="${item.id}" type="number" min="0" max="${available}" step="500" value="${amount}"><b>${money(amount)}</b></div><div class="micro-caption">La línea inicia en 70% de la caja. Al avanzar los ciclos puede aumentar o disminuir según la caja y los activos. Lo utilizado reduce la línea disponible.</div>`;
  } else if(item.type==='info'){
    let dynamic=item.id==='CREDITO_VENTAS'?`<strong>${creditPercent()}% de ventas a crédito</strong><small>${100-creditPercent()}% de ventas al contado</small>`:`<strong>Regla automática del juego</strong>`;if(item.id==='PERSONAL_VENTAS'){const n=RULES.storeCount(channelDraft());dynamic=`<strong data-basic-sales-staff>${n?`${n} vendedor(es) básico(s) · 1 por tienda · comisión total 1%`:'Sin tiendas físicas: no se asignan vendedores básicos.'}</strong>`;}body=`<div class="info-decision">${dynamic}<p>${escapeHtml(item.desc)}</p></div>`;
  }
  const costLabel=item.type==='loan'?'Financiamiento opcional':item.noCashEffect?'No afecta caja':cost>0?`${item.mandatoryFixed?'Costo obligatorio':'Costo actual'}: ${money(cost)}`:cost<0?`Ingreso por liquidación: ${money(Math.abs(cost))}`:'Sin salida de caja';
  return `<article class="decision-row ${saved?'saved':''} ${locked?'locked':''} ${required?'required-row':'optional-row'}" data-item="${item.id}"><div class="decision-row-head"><div><span class="row-state">${locked?'BLOQUEADA':saved?'GUARDADA':required?'OBLIGATORIA':'OPCIONAL'}</span><h3>${escapeHtml(item.name)}</h3>${item.desc?`<p>${escapeHtml(item.desc)}</p>`:''}</div><div class="row-cost">${costLabel}</div></div>${body}</article>`;
}
document.addEventListener('wheel',e=>{if(e.target?.matches?.('.number-decision input[type=number], .quantity-option input[type=number], [data-store-qty], [data-mold-target]')&&document.activeElement===e.target)e.preventDefault()},{passive:false});
function bindDecisionControls(){
  document.querySelectorAll('[data-choice]').forEach(input=>{
    input.addEventListener('click',event=>{
      const item=findDecisionItem(input.dataset.choice);
      if(item.type==='choice'&&!itemRequired(item)&&!item.mandatoryFixed&&!isLocked(item)&&selectedOptionIds(item).includes(input.dataset.option)){
        event.preventDefault();if(decisionEditingBlocked())return;
        initDraft(item).optionIds=[];persistCurrentDraftOnly();renderDecisionCategory();
      }
    });
    input.addEventListener('change',()=>{
      if(decisionEditingBlocked())return;
      const item=findDecisionItem(input.dataset.choice),id=input.dataset.option;
      if(item.mandatoryFixed){renderDecisionCategory();return}
      if(item.type==='multi-choice'&&!input.checked&&optionCommitRemaining(item,id)>0){toast('Este canal tiene tiendas con contrato vigente y no puede retirarse.');renderDecisionCategory();return}
      const d=initDraft(item);
      if(item.id==='CANALES'&&RULES.STORE_IDS.includes(id)){
        const set=new Set(d.optionIds||[]);input.checked?set.add(id):set.delete(id);d.optionIds=[...set];
        d.quantities=d.quantities||{};
        if(input.checked)d.quantities[id]=RULES.positiveInteger(d.quantities[id],1);else delete d.quantities[id];
      }else if(item.type==='multi-choice'){
        const set=new Set(d.optionIds||[]);input.checked?set.add(id):set.delete(id);d.optionIds=[...set];
      }else d.optionIds=[id];
      persistCurrentDraftOnly();renderDecisionCategory();
      const updated=document.querySelector(`[data-choice="${item.id}"][data-option="${id}"]`);
      updated?.focus({preventScroll:true});
    });
  });
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;changeQty(b.dataset.step,b.dataset.option,Number(b.dataset.delta));persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-qty]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.qty),d=initDraft(item),floor=item.asset?-getOwned(item,i.dataset.option):0;d.quantities[i.dataset.option]=Math.max(floor,Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.qty)}));
  document.querySelectorAll('[data-mold-step]').forEach(button=>button.addEventListener('click',()=>{
    if(decisionEditingBlocked())return;const item=findDecisionItem('PRODUCCION_META'),d=initDraft(item),id=button.dataset.moldStep;
    d.moldTargets[id]=Math.max(0,Math.trunc(Number(d.moldTargets[id]||0)+Number(button.dataset.delta)));persistCurrentDraftOnly();renderDecisionCategory();
  }));
  document.querySelectorAll('[data-mold-target]').forEach(input=>{
    input.addEventListener('input',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem('PRODUCCION_META'));d.moldTargets[input.dataset.moldTarget]=input.value===''?'':Math.max(0,Math.trunc(Number(input.value)||0));persistCurrentDraftOnly();updateHud();});
    input.addEventListener('change',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem('PRODUCCION_META')),id=input.dataset.moldTarget;d.moldTargets[id]=Math.max(0,Math.trunc(Number(input.value)||0));persistCurrentDraftOnly();renderDecisionCategory();});
  });
  document.querySelectorAll('[data-mold-suggest]').forEach(button=>button.addEventListener('click',()=>{
    if(decisionEditingBlocked())return;const id=button.dataset.moldSuggest,line=productionPlan().productLines.find(entry=>entry.id===id),d=initDraft(findDecisionItem('PRODUCCION_META'));
    d.moldTargets[id]=Number(line?.suggested||0);persistCurrentDraftOnly();renderDecisionCategory();
  }));
  document.querySelectorAll('[data-number-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(b.dataset.numberStep),d=initDraft(item);d.value=Math.max(Number(item.min||0),Number(d.value||0)+Number(b.dataset.delta));persistCurrentDraftOnly();renderDecisionCategory()}));
  document.querySelectorAll('[data-number]').forEach(i=>{
    i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.number),d=initDraft(item);const raw=i.value;d.value=raw===''?'':Math.max(Number(item.min||0),Number(raw)||0);persistCurrentDraftOnly();updateSectionCost();});
    i.addEventListener('change',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.number),d=initDraft(item);d.value=Math.max(Number(item.min||0),Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.number);});
  });
  document.querySelectorAll('[data-staff-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;changeStaff(b.dataset.staffStep,b.dataset.store,Number(b.dataset.delta));persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-staff]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem(i.dataset.staff));d.staff[i.dataset.store]=Math.max(0,Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.staff)}));
  document.querySelectorAll('[data-loan]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;setLoan(i.dataset.loan,Number(i.value),true);persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-loan-number]').forEach(i=>i.addEventListener('input',()=>{
    if(decisionEditingBlocked())return;
    const id=i.dataset.loanNumber;setLoan(id,Number(i.value),false);persistCurrentDraftOnly();
    const amount=Number(initDraft(findDecisionItem(id)).amount||0),range=document.querySelector(`[data-loan="${id}"]`),label=i.closest('.loan-control')?.querySelector('b');
    if(range)range.value=amount;if(label)label.textContent=money(amount);updateSectionCost();
  }));
}
function changeQty(itemId,optId,delta){const item=findDecisionItem(itemId),d=initDraft(item),floor=item.asset?-getOwned(item,optId):0;d.quantities[optId]=Math.max(floor,(Number(d.quantities[optId])||0)+delta);renderDecisionCategory()}
function changeStaff(itemId,store,delta){const item=findDecisionItem(itemId),d=initDraft(item);d.staff[store]=Math.max(0,(Number(d.staff[store])||0)+delta);renderDecisionCategory()}
function setLoan(itemId,value,rerender=false){const item=findDecisionItem(itemId),max=loanMaximum(),d=initDraft(item);d.amount=Math.max(0,Math.min(max,Number(value)||0));if(rerender)renderDecisionCategory()}
function updateRowCost(itemId){const row=document.querySelector(`[data-item="${itemId}"] .row-cost`),item=findDecisionItem(itemId);if(!row)return;const cost=computeItemCost(item);row.textContent=cost>0?`${item.mandatoryFixed?'Costo obligatorio':'Costo actual'}: ${money(cost)}`:cost<0?`Ingreso por liquidación: ${money(Math.abs(cost))}`:'Sin salida de caja'}
function updateSectionCost(){
  const locked=cycleDecisionsLocked()||sectionSubmitted(currentCategory);
  const net=categoryDraftNet(currentCategory),old=Number(cashLedger[sectionLedgerKey(currentCategory)]||0),delta=net-old,projected=projectedCash();
  $('sectionDraftCost').textContent=delta<0?`Gastado: ${money(Math.abs(delta))}`:delta>0?`Ingreso previsto: +${money(delta)}`:'Sin cambios pendientes';
  $('projectedCash').textContent=money(cashBalance());$('projectedCash').classList.toggle('danger',projected<0);
  $('sectionSaveHint').textContent=locked?'Decisiones enviadas: edición bloqueada hasta el próximo ciclo.':projected<0?'El gasto supera tu caja actual. Puedes guardar el borrador, pero no enviarlo hasta ajustar el presupuesto.':'Borrador local: guarda tus avances y envía el ciclo solo cuando estés seguro.';
  // El presupuesto puede impedir confirmar una decisión, pero nunca debe impedir
  // conservar el avance del jugador como borrador.
  $('saveDecisionSection').disabled=locked;
  if(currentCategory==='A'&&$('companySummaryMount'))renderCompanySummary();
  const send=$('sendDecisionSection');if(send){send.disabled=locked||projected<0||!sectionDraftReady(currentCategory);send.querySelector('strong').textContent=locked?'DECISIÓN ENVIADA':'ENVIAR DECISIÓN';send.querySelector('small').textContent=locked?'Editable en el próximo ciclo':'Confirmar; no editable en este ciclo'}
}
function productionMaterialShortages(){
  if(!['C','F'].includes(currentCategory))return [];
  if(!currentProductionTarget())return [];
  return productionPlan().materials.filter(material=>material.shortfall>0).map(material=>({item:findDecisionItem(material.id),need:material.neededForTarget,total:material.available,missing:material.shortfall,unit:material.unit}));
}
function validateProductionMaterials(){return true;}
function warnProductionMaterialShortage(){
  const shortages=productionMaterialShortages();
  if(!shortages.length)return;
  const detail=shortages.map(x=>`${x.item.name}: faltan ${x.missing.toLocaleString('es-PE')} ${x.unit}`).join(' · ');
  toast(`Advertencia: tu producción supera los insumos comprados. ${detail}. Puedes continuar.`);
}
function validateRequiredSection(cat){
  for(const item of cat.items){
    if(!itemRequired(item)||item.type==='info'||(item.lockAfterPurchase&&isLocked(item)))continue;
    const d=initDraft(item);
    if(item.type==='choice'&&!(d.optionIds||[]).length){toast(`Debes completar: ${item.name}.`);return false}
    if(item.type==='multi-choice'&&(d.optionIds||[]).length<Number(item.minSelections||1)){toast(`Debes seleccionar al menos una opción en ${item.name}.`);return false}
    if(item.type==='production-plan'&&Object.values(d.moldTargets||{}).reduce((total,value)=>total+Number(value||0),0)<Number(item.min||0)){toast('Indica cuánto deseas producir en al menos uno de los tres moldes.');return false}
    if(item.type==='number'&&Number(d.value)<Number(item.min||0)){toast(`${item.name} debe ser como mínimo ${item.min}.`);return false}
    if(item.requiredWhenProduction&&currentProductionTarget()>0){/* El faltante de insumos es una advertencia, no un bloqueo. */}
  }
  return true;
}
// Build entries before changing state so totals and severance are stable on re-save.
function prepareSectionSave(cat,context=decisionModelContext()){
  const entries={},round=context.round,model=window.SIDE_REVIEW_MODEL.section(cat,context);
  cat.items.forEach(item=>{
    if(item.type==='info')return;
    const prev=decisionState[item.id],d=context.drafts[item.id]||{},detail=model.items.find(x=>x.id===item.id);
    if(item.lockAfterPurchase&&prev&&Number(prev.round)<round)return;
    const common={round,label:item.name,cost:detail.outflow-detail.assetIncome};
    if(item.asset){
      entries[item.id]={...deepClone(prev||{}),...common,purchases:{...deepClone(prev?.purchases||{}),[round]:deepClone(d.quantities||{})}};return;
    }
    if(item.type==='quantity'||item.type==='quantity-choice'){
      entries[item.id]={...common,quantities:deepClone(d.quantities||{})};
      if(item.severanceEligible)entries[item.id].previousQuantities=deepClone(Number(prev?.round)===round?prev?.previousQuantities||{}:prev?.quantities||{});
      return;
    }
    if(item.type==='production-plan'){
      const moldTargets=Object.fromEntries(Object.entries(d.moldTargets||{}).map(([id,value])=>[id,Math.max(0,Math.trunc(Number(value)||0))]));
      const value=Object.values(moldTargets).reduce((total,target)=>total+target,0);
      entries[item.id]={...common,moldTargets,value,label:`Producción deseada: ${value} unidades`};return;
    }
    if(item.type==='number'){entries[item.id]={...common,value:Number(d.value||0),label:`${item.name}: ${Number(d.value||0)} ${item.unit||''}`};return;}
    if(item.type==='sales-staff'){entries[item.id]={...common,staff:deepClone(d.staff||{})};return;}
    if(item.type==='loan'){entries[item.id]={...common,amount:Number(d.amount||0),label:`Línea de crédito utilizada: ${money(d.amount||0)}`};return;}
    if(item.id==='MOLDE'){
      const chosen=(d.optionIds||[]).find(id=>item.options.some(o=>o.id===id)&&!ownedMolds().some(x=>x.id===id))||null;
      const purchases=deepClone(prev?.purchases||{});
      delete purchases[round];
      if(chosen)purchases[round]={[chosen]:1};
      entries[item.id]={...common,optionIds:chosen?[chosen]:[],optionRounds:{...(prev?.optionRounds||{}),...(chosen?{[chosen]:round}:{})},purchases,label:chosen?item.options.find(o=>o.id===chosen)?.label:(prev?.label||'Sin compra nueva')};
      return;
    }
    const optionRounds={};(d.optionIds||[]).forEach(id=>{optionRounds[id]=prev?.optionRounds?.[id]??round});
    if(item.id==='CANALES'){
      const quantities={},storeContracts={};
      RULES.STORE_IDS.forEach(id=>{const q=RULES.storeQuantity(d,id);if(q){quantities[id]=q;storeContracts[id]=RULES.nextStoreBatches(prev,id,q,round);optionRounds[id]=Math.min(...storeContracts[id].map(b=>b.round));}});
      entries[item.id]={...common,optionIds:[...(d.optionIds||[])],quantities,storeContracts,optionRounds,
        label:item.options.filter(o=>(d.optionIds||[]).includes(o.id)).map(o=>o.channel==='store'?`${o.label} x ${quantities[o.id]}`:o.label).join(' + ')};return;
    }
    entries[item.id]={...common,optionIds:[...(d.optionIds||[])],optionRounds,label:(item.options||[]).filter(o=>(d.optionIds||[]).includes(o.id)).map(o=>o.label).join(' + ')};
  });
  return {cat:cat.cat,entries,net:model.net,model};
}
// Local multi-key write with rollback; not a server receipt or distributed transaction.
function writeDecisionBatch(writes){
  const previous=new Map(),written=[];
  try{
    for(const key of Object.keys(writes))previous.set(key,localStorage.getItem(key));
    for(const [key,value] of Object.entries(writes)){written.push(key);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}
    return true;
  }catch(error){
    for(const key of written.reverse()){try{const value=previous.get(key);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(rollbackError){console.error('SIDE: storage rollback failed',rollbackError);}}
    console.error('SIDE: decision storage failed',error);toast('No se pudo guardar en este navegador. Libera espacio y vuelve a intentar. No se ha confirmado el envio.');return false;
  }
}
function saveCurrentSection(){
  if(decisionEditingBlocked())return false;
  const cat=categoryByCat(currentCategory);if(!cat)return false;
  if(currentCategory==='D'&&(!validateChannelQuantities()||!validateRequiredSection(cat)))return false;
  const context=decisionModelContext();let plan;
  try{plan=prepareSectionSave(cat,context);}catch(error){console.error('SIDE: no se pudo preparar el borrador',error);toast(`No se pudo preparar el borrador: ${error?.message||'revisa las opciones elegidas'}.`);return false;}
  const key=sectionLedgerKey(currentCategory),old=Number(cashLedger[key]||0);
  const affordable=cashBalance()-old+plan.net>=-0.005;
  const state={...decisionState,...plan.entries};
  // Un borrador que excede la caja conserva sus elecciones sin aplicar todavía
  // el movimiento financiero. El envío seguirá bloqueado hasta ajustar el gasto.
  const ledger=affordable?{...cashLedger,[key]:plan.net}:{...cashLedger};
  const draftKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let draftStore={};try{draftStore=JSON.parse(localStorage.getItem(draftKey)||'{}')||{}}catch{}
  delete draftStore[currentCategory];
  if(!writeDecisionBatch({[decisionKey()]:JSON.stringify(state),[ledgerKey()]:JSON.stringify(ledger),[draftKey]:JSON.stringify(draftStore)}))return false;
  decisionState=state;cashLedger=ledger;decisionDrafts={};restoreDraftsForRound();
  // Las vistas derivadas no deben convertir un guardado exitoso en un fallo aparente.
  try{warnProductionMaterialShortage();}catch(error){console.error('SIDE: no se pudo actualizar la advertencia productiva',error)}
  try{syncStudentReportPreview();}catch(error){console.error('SIDE: no se pudo actualizar el resumen',error)}
  try{syncSectionToSupabase(cat);}catch(error){console.error('SIDE: no se pudo sincronizar la sección',error)}
  try{if(affordable)animateCash(plan.net-old);renderTabs();renderDecisionCategory();updateHud();}catch(error){console.error('SIDE: el borrador se guardó, pero una vista no pudo refrescarse',error)}
  toast(affordable?'Borrador guardado sin enviar. Puedes continuar editando.':'Borrador guardado. Ajusta el presupuesto antes de enviar la decisión.');return true;
}
$('saveDecisionSection')?.addEventListener('click',saveCurrentSection);
function sendCurrentSection(){
  if(decisionsSubmitted()||sectionSubmitted(currentCategory)){toast('Esta seccion ya fue enviada.');return;}
  if(!validateRequiredSection(categoryByCat(currentCategory))||!sectionReady(currentCategory)){
    toast('Completa las decisiones obligatorias de esta pestana.');return;
  }
  commitReviewedSections([currentCategory],false);
}
$('sendDecisionSection')?.addEventListener('click',sendCurrentSection);


let simulationLoadingTimer=null;
let simulationLoadingActive=false;
async function startSimulationLoading(){
  if(simulationLoadingActive)return false;
  loadDecisionState();
  if(decisionProgressPercent()!==100){toast('Completa y guarda todas las decisiones obligatorias antes de iniciar el juego 3D.');openDecisionMenu();return}
  if(!simulationSubmissionComplete()){toast('Envía todos los apartados o confirma ENVIAR TODO antes de abrir el mundo.');openDecisionMenu();return false}
  if(location.protocol==='file:'){toast('Abre INICIAR_JUEGO.bat para ejecutar el mundo desde el servidor local.');return false}
  simulationLoadingActive=true;
  document.querySelectorAll('[data-start-world],#startSimulationBtn').forEach(button=>button.disabled=true);
  let loadingDeadline=null;
  try{
  if(simulationLoadingTimer){clearInterval(simulationLoadingTimer);simulationLoadingTimer=null}
  const bar=$('simulationLoadingBar'),pctEl=$('simulationLoadingPercent'),text=$('simulationLoadingText'),stage=$('simulationLoadingStage');
  const stepEls=[...document.querySelectorAll('[data-load-step]')];
  let p=0;showScreen('simulationLoading');
  const paint=(value)=>{p=Math.max(0,Math.min(100,value));if(bar)bar.style.width=p+'%';if(pctEl)pctEl.textContent=Math.round(p)+'%';let step=1,label='Construyendo local y distribución';if(p>=38){step=2;label='Aplicando maquinaria, personal y stock'}if(p>=72){step=3;label='Preparando inventario, clientes NPC y caja'}if(p>=96)label=`Abriendo ${currentStudent.company||COMPANY_NAME}`;if(stage)stage.textContent=label;if(text)text.textContent=p<38?'Levantando tu tienda según la infraestructura elegida...':p<72?'Colocando físicamente los recursos que compraste y contrataste...':p<96?'Activando stock físico, rutas de clientes, reposición y sistema de ventas...':'Todo listo. Entrando a tu empresa...';stepEls.forEach((el,i)=>el.classList.toggle('active',i<step));};
  paint(0);
  let engineReady=false;
  if(typeof window.SIDE3D?.prepare!=='function')throw new Error('No se encontró el motor 3D. Recarga la página.');
  const enginePromise=window.SIDE3D.prepare().then(ok=>{engineReady=!!ok;return ok});
  simulationLoadingTimer=setInterval(()=>{if(p<88)paint(p+2);else if(p<94&&engineReady)paint(p+1)},34);
  const ok=await Promise.race([enginePromise,new Promise((_,reject)=>{loadingDeadline=setTimeout(()=>reject(new Error('La carga tardó demasiado. Puedes volver a intentarlo sin reenviar decisiones.')),90000)})]);
  clearTimeout(loadingDeadline);
  if(!ok)throw new Error(window.SIDE3D.getLastError?.()||'No se pudo preparar el mundo 3D. Revisa que el navegador permita WebGL.');
  clearInterval(simulationLoadingTimer);simulationLoadingTimer=null;
  for(let v=Math.max(94,p);v<=100;v+=2){paint(v);await new Promise(r=>setTimeout(r,45))}
  paint(100);
  await new Promise(r=>setTimeout(r,180));
  if(!await window.SIDE3D.enter({autoStart:true}))throw new Error('No se pudo abrir el mundo. Tus decisiones siguen guardadas.');
  return true;
  }catch(error){
    console.error('SIDE: inicio del mundo 3D',error);
    openDecisionMenu();toast(error.message||'No se pudo abrir el mundo 3D. Vuelve a intentarlo.');
    return false;
  }finally{
    clearTimeout(loadingDeadline);clearInterval(simulationLoadingTimer);simulationLoadingTimer=null;simulationLoadingActive=false;
    document.querySelectorAll('[data-start-world],#startSimulationBtn').forEach(button=>button.disabled=false);
  }
}
$('startSimulationBtn')?.addEventListener('click',startSimulationLoading);
function animateCash(netMovement){
  const fx=$('cashFx');if(!fx||!netMovement)return;fx.querySelector('span').textContent=(netMovement>0?'+ ':'− ')+money(Math.abs(netMovement));fx.classList.remove('gain','spend','play');fx.classList.add(netMovement>0?'gain':'spend');void fx.offsetWidth;fx.classList.add('play');setTimeout(()=>fx.classList.remove('play'),1150);
  const cash=$('cashBalance');cash.classList.remove('cash-pulse');void cash.offsetWidth;cash.classList.add('cash-pulse');
}
function requiredDecisionItems(){return allDecisionItems().filter(i=>i.type!=='info'&&itemRequired(i))}
function decisionProgressPercent(){const actionable=requiredDecisionItems();const done=actionable.filter(itemComplete).length;return actionable.length?Math.round(done/actionable.length*100):100}
function categoryCompletionMap(){const out={};decisionCategories().forEach(cat=>{const req=cat.items.filter(i=>i.type!=='info'&&itemRequired(i));out[cat.cat]={title:cat.short||cat.title,done:req.filter(itemComplete).length,total:req.length,complete:req.length?req.every(itemComplete):true}});return out}
function updateHud(){
  const cash=cashBalance();$('cashBalance').textContent=money(cash);$('cashBalance').classList.toggle('danger',cash<0);$('cashMovement').textContent=`Caja inicial asignada: ${money(initialCapital())}`;
  const pct=decisionProgressPercent();$('decisionProgressText').textContent=pct+'%';$('decisionProgressBar').style.width=pct+'%';
  const launch=$('simulationLaunch');if(launch){const ready=pct===100;launch.classList.toggle('hidden',!ready);launch.classList.toggle('ready',ready);const submitted=simulationSubmissionComplete();$('submitAllDecisionsBtn')?.classList.toggle('hidden',submitted);$('startSimulationBtn')?.classList.toggle('hidden',!submitted);if($('sendDecisionSection')){$('sendDecisionSection').disabled=sectionSubmitted(currentCategory)||submitted||!sectionDraftReady(currentCategory);$('sendDecisionSection').classList.toggle('submitted',sectionSubmitted(currentCategory))}}
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
  const loans=creditOutstanding();
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
    canalesVenta:{cantidades:deepClone(savedEntry(findDecisionItem('CANALES'))?.quantities||{}),tiendasFisicas:RULES.storeCount(savedEntry(findDecisionItem('CANALES')))},
    produccion:productionPlan(),
    resumenEnviado:typeof readReviewReceipts==='function'?readReviewReceipts():null,
    decisiones:currentDecisionLabels(),apartados:categoryCompletionMap(),progreso:decisionProgressPercent(),enviado:decisionsSubmitted(),
    eventos:events.map(e=>({id:e.id,titulo:e.title,descripcion:e.description,afectados:e.scope==='group'?'Todos':'Empresa individual',ciclos:e.cycles,cicloAfecta:(Number(e.cycleOffset||0)===0?'+0 · mismo ciclo':Number(e.cycleOffset||0)===1?'+1 · siguiente ciclo':`+${Number(e.cycleOffset||0)} · después de ${Number(e.cycleOffset||0)} ciclos`),implicancia:e.implication,ocurrencia:e.probability})),
    estadoResultados:{ingresos:adjusted.revenue,costos:adjusted.costs,impactoEventos:eventImpact,utilidad},
    balanceCaja:{cajaInicial:initialCapital(),prestamos:creditOutstanding(),cajaFinal},
    flujoCaja:{operacion:adjusted.revenue-adjusted.costs,financiamiento:loans,eventos:eventImpact,flujoNeto:flujo},
    score:Math.max(0,Math.round(utilidad/100+decisionProgressPercent())),estado:'activa',tomandoDecisiones:playerIsDeciding,caja:cajaFinal,updatedAt:new Date().toISOString()
  };
  let reports=[];try{reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')}catch{}
  const idx=reports.findIndex(r=>r.id===report.id);if(idx>=0)reports[idx]=report;else reports.push(report);
  localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));renderStudentStatus();
}
/**
 * Sincroniza la sección actual de decisiones con Supabase (Fase B).
 * Convierte el estado local a [{decision_id, opcion_id, cantidad, costo_total}]
 * y lo envía via DecisionesService.guardar(). Silencioso si offline.
 * @param {string} cat Código de categoría (B/C/D/E/F).
 */
async function syncSectionToSupabase(cat){
  try{
    const S=window.SIDE||{};
    if(!S.DecisionesService||!currentStudent?.empresaId)return;
    const categoria=categoryByCat(cat);if(!categoria||!categoria.items?.length)return;
    const round=currentRound(),decisiones=[],omitidas=[];
    for(const item of categoria.items){
      if(item.type==='info')continue;
      const st=decisionState[item.id];if(!st)continue;
      const entry=buildSupabaseDecision(item,st,round);
      if(!entry){omitidas.push(item.id);continue}
      if(Array.isArray(entry))decisiones.push(...entry);else decisiones.push(entry);
    }
    if(omitidas.length)console.info('SIDE: sync omite sin mapeo:',omitidas.join(','));
    if(!decisiones.length)return;
    const r=await S.DecisionesService.guardar(currentStudent.empresaId,round,decisiones);
    if(!r.success&&!r.offline)console.warn('SIDE: sync decisiones:',r.error);
  }catch(error){console.error('SIDE: no se pudo sincronizar la sección',error)}
}
/**
 * Convierte una decisión del estado local al formato del RPC guardar_decisiones.
 * @param {object} item Definición del catálogo (decision_catalog.js).
 * @param {object} st Estado local de la decisión (ver prepareSectionSave).
 * @param {number} round Ciclo actual (las compras de activos viven por ciclo).
 * @returns {object|Array|null} {decision_id, opcion_id, cantidad, costo_total},
 *   array si hay varias opciones, o null si no hay nada que sincronizar.
 */
function buildSupabaseDecision(item,st,round){
  if(!item||!st)return null;
  const ids=Array.isArray(st.optionIds)?st.optionIds:[];
  const quantities=st.quantities||{};
  const out=[];
  const push=(opId,qty,cost)=>{
    out.push({decision_id:item.id,opcion_id:opId||null,cantidad:Math.max(1,Number(qty)||1),costo_total:Math.round(Number(cost)||0)});
  };
  // Activos (mesas, máquinas): las compras del ciclo están en
  // st.purchases[round]. Cantidad con signo (negativo = liquidación/venta).
  if(item.asset){
    const bought=(st.purchases&&st.purchases[round])||{};
    for(const[opId,qty]of Object.entries(bought)){
      const q=Number(qty)||0;if(q===0)continue;
      const opt=(item.options||[]).find(o=>o.id===opId);
      let unit=Number(opt?.cost)||0;
      try{if(typeof optionUnitCost==='function'&&opt)unit=optionUnitCost(item,opt)}catch{}
      out.push({decision_id:item.id,opcion_id:opId,cantidad:q,costo_total:Math.round(unit*q)});
    }
    return out.length?(out.length===1?out[0]:out):null;
  }
  // Plan de producción: meta total de unidades (sin opción ni costo).
  if(item.type==='production-plan'){
    const total=Math.max(0,Math.trunc(Number(st.value)||0));
    if(total<=0)return null;
    push(null,total,0);
    return out[0];
  }
  if(item.type==='choice'||item.type==='multi-choice'){
    if(!ids.length)return null;
    for(const opId of ids){
      const opt=(item.options||[]).find(o=>o.id===opId);
      push(opId,quantities[opId]||1,(opt?.cost||0)*(quantities[opId]||1));
    }
    return out.length===1?out[0]:out;
  }
  if(item.type==='quantity'||item.type==='quantity-choice'){
    let any=false;
    for(const[opId,qty]of Object.entries(quantities)){
      if(Number(qty)>0){const opt=(item.options||[]).find(o=>o.id===opId);push(opId,qty,(opt?.cost||0)*Number(qty));any=true}
    }
    if(!any&&ids.length){for(const opId of ids){const opt=(item.options||[]).find(o=>o.id===opId);push(opId,1,opt?.cost||0);any=true}}
    return any?(out.length===1?out[0]:out):null;
  }
  if(typeof st.cost==='number'&&st.cost>0){push(ids[0]||null,1,st.cost);return out[0]}
  if(typeof st.amount==='number'&&st.amount>0){push(null,1,st.amount);return out[0]}
  return null;
}


function persistCurrentDraftOnly(){
  const cat=categoryByCat(currentCategory);if(!cat)return false;
  const draftStoreKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;
  let store={};try{store=JSON.parse(localStorage.getItem(draftStoreKey)||'{}')||{}}catch{}
  store[currentCategory]={};cat.items.forEach(item=>{if(decisionDrafts[item.id])store[currentCategory][item.id]=deepClone(decisionDrafts[item.id])});
  localStorage.setItem(draftStoreKey,JSON.stringify(store));
  return true;
}
function restoreDraftsForRound(){
  const key=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let store={};try{store=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
  for(const cat of DECISION_CATALOG){if(sectionSubmitted(cat.cat))continue;const section=store[cat.cat]||{};cat.items.forEach(item=>{if(section[item.id])decisionDrafts[item.id]=deepClone(section[item.id])})}
}
function submitAllDecisions(){openCompanyReview();}
$('submitAllDecisionsBtn')?.addEventListener('click',submitAllDecisions);
$('topSubmitAllDecisions')?.addEventListener('click',submitAllDecisions);
function formatStudentTime(total){const s=Math.max(0,Math.floor(Number(total)||0));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function readRoundRuntime(){try{return JSON.parse(localStorage.getItem('SIDE_ROUND_RUNTIME')||'null')}catch{return null}}
function syncStudentTimer(){const r=readRoundRuntime(),conf=teacherConfig(),configuredDuration=Number(conf.roundHours||0)*3600+Number(conf.roundMinutes||0)*60+Number(conf.roundSecs||0);let remain=Number(r?.remaining??configuredDuration),note='Esperando inicio del docente';if(r?.running&&r.startedAt){const duration=Number(r.duration||configuredDuration||remain);remain=Math.max(0,duration-Math.floor((Date.now()-new Date(r.startedAt).getTime())/1000));note=remain>0?'Ciclo en curso':'Tiempo finalizado'}else if(r?.status==='scheduled'){const wait=Math.max(0,Math.floor((new Date(r.scheduledStart).getTime()-Date.now())/1000));note=wait>0?`Inicio automático en ${formatStudentTime(wait)}`:'Inicio automático pendiente'}else if(r?.status==='finished')note='Tiempo finalizado';else if(r?.status==='simulation-finished')note='Simulación finalizada';const text=formatStudentTime(remain);if($('studentRoundTimer'))$('studentRoundTimer').textContent=text;if($('decisionRoundTimer'))$('decisionRoundTimer').textContent=text;if($('studentCycleLabel'))$('studentCycleLabel').textContent=`Ciclo ${r?.round||currentRound()} / ${conf.cycles||6}`;if($('studentTimerNote'))$('studentTimerNote').textContent=note}
function renderStudentStatus(){if(!$('studentCashResult'))return;applyEventCashEffects();const events=activeStudentEvents(),simRevenue=Number(cashLedger[`${currentRound()}:SIM_VENTAS`]||0),baseCosts=Object.entries(cashLedger).reduce((a,[k,n])=>a+(k.includes('SIM_VENTAS')||k.includes(':EVENT:')?0:Math.max(0,-Number(n||0))),0),adjusted=eventAdjustedFinancials(simRevenue,baseCosts),eventCash=Object.entries(cashLedger).filter(([k])=>k.includes(':EVENT:')).reduce((a,[,n])=>a+Number(n||0),0),pctImpact=(adjusted.revenue-simRevenue)-(adjusted.costs-baseCosts),eventImpact=eventCash+pctImpact,profit=adjusted.revenue-adjusted.costs+eventCash,flow=ledgerTotal()+pctImpact,loans=creditOutstanding();$('studentIncomeResult').textContent=money(profit);$('studentCashResult').textContent=money(cashBalance()+pctImpact);$('studentFlowResult').textContent=(flow>=0?'+':'−')+money(Math.abs(flow));const set=(id,val)=>{if($(id))$(id).textContent=money(val)};set('studentERIngresos',adjusted.revenue);set('studentERCostos',adjusted.costs);set('studentEREventos',eventImpact);set('studentERUtilidad',profit);set('studentBCInicial',initialCapital());set('studentBCPrestamos',loans);set('studentBCFinal',cashBalance()+pctImpact);set('studentFCOperacion',adjusted.revenue-adjusted.costs);set('studentFCFinanciamiento',loans);set('studentFCEventos',eventImpact);set('studentFCNeto',flow);if($('studentEventImpactText'))$('studentEventImpactText').textContent=events.length?`Impacto del ciclo: ${events.map(e=>e.title+' — '+e.implication).join(' · ')}`:'Sin impacto de eventos activo en este ciclo.';const news=$('studentNewsList');if(news)news.innerHTML=events.length?events.map(e=>`<article><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(e.implication)}</span><small>${e.scope==='group'?'GRUPAL · todos':'INDIVIDUAL · prob. '+e.probability+'%'} · duración ${e.cycles} ciclo(s)</small></article>`).join(''):'<p>Sin eventos activos en este ciclo.</p>'}
let lastObservedRound=currentRound();
setInterval(()=>{
  const round=currentRound();
  if(round!==lastObservedRound){if(typeof closeCompanyReview==='function')closeCompanyReview();lastObservedRound=round;currentCategory=round>1?'A':navigationCategories()[0]?.cat;loadDecisionState();restoreDraftsForRound();if(!$('decisionMenu')?.classList.contains('hidden')){renderTabs();renderDecisionCategory()}}
  syncStudentTimer();if(!$('studentLobby')?.classList.contains('hidden'))renderStudentStatus();
},1000);

if(supabaseClient)supabaseClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')showScreen('profiles')});
