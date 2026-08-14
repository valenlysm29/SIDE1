const cfg = window.SIDE_CONFIG || {};
const hasConfig = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("TU-PROYECTO") && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("TU-PUBLISHABLE");
const supabaseClient = hasConfig ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
const $ = id => document.getElementById(id);
const screens = ["landing","profiles","studentLoading","tutorial","studentLobby","decisionMenu"];
const modals = ["teacherLoginModal","teacherRegisterModal","studentModal"];
const DEMO_TEACHER = { email: "profesor@upch.pe", password: "Heredia" };
const DEMO_GAME = { id: "demo-side-000", codigo: "SIDE-000", nombre: "SIDE — Simulación Principal", curso: "Finanzas Corporativas", estado: "esperando", segmento: "Estandar" };
const DECISION_CATEGORY_ICONS = {
  A:"assets/side_logo.png",
  B:"assets/icons/categories/infraestructura.svg",
  C:"assets/icons/categories/recursos_humanos.svg",
  D:"assets/icons/categories/canales_ventas.svg",
  E:"assets/icons/categories/insumos.svg",
  F:"assets/icons/categories/inversiones.svg",
  G:"assets/icons/categories/finanzas.svg"
};
const UI_ICONS = {
  play:"assets/icons/ui/play.svg",
  check:"assets/icons/ui/check.svg",
  back:"assets/icons/ui/back.svg",
  lock:"assets/icons/ui/lock.svg"
};
const decisionIcon = cat => DECISION_CATEGORY_ICONS[cat] || "assets/side_logo.png";
let currentStudent = { name:"", company:"", participantId:null, game:DEMO_GAME };
let decisionState = {};
let decisionDrafts = {};
let currentCategory = null;
const DECISION_CATALOG = Array.isArray(window.SIDE_DECISION_CATALOG) ? window.SIDE_DECISION_CATALOG : [];

function showScreen(id){screens.forEach(s=>$(s)?.classList.toggle("hidden",s!==id));window.scrollTo(0,0)}
function showModal(id){$("modalRoot").classList.remove("hidden");modals.forEach(m=>$(m)?.classList.toggle("hidden",m!==id));setTimeout(()=>$(id)?.querySelector("input")?.focus(),80)}
function closeModal(){$("modalRoot").classList.add("hidden");modals.forEach(m=>$(m)?.classList.add("hidden"))}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function message(id,msg,error=false){$(id).textContent=msg;$(id).style.color=error?"#ff9d9d":"#ffe06a"}
function requireSupabase(){if(!supabaseClient){toast("Modo local activo: configura Supabase para sincronización.");return false}return true}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}

document.querySelector(".modal-backdrop")?.addEventListener("click",closeModal);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeModal));
document.querySelectorAll("[data-switch]").forEach(b=>b.addEventListener("click",()=>showModal(b.dataset.switch==="register"?"teacherRegisterModal":"teacherLoginModal")));
document.querySelectorAll(".profile-card").forEach(card=>card.addEventListener("click",()=>showModal(card.dataset.profile==="teacher"?"teacherLoginModal":"studentModal")));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

let progress=0;
const timer=setInterval(()=>{progress=Math.min(100,progress+1);$("loadingBar").style.width=progress+"%";$("loadingPercent").textContent=progress+"%";if(progress>=100){clearInterval(timer);$("startBtn").disabled=false}},28);
$("startBtn").addEventListener("click",()=>showScreen("profiles"));

function openTeacherPanel(){
  closeModal();
  window.location.href="docente.html";
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("loginEmail").value.trim().toLowerCase(),password=$("loginPassword").value;
  if(email===DEMO_TEACHER.email&&password===DEMO_TEACHER.password){openTeacherPanel();return}
  if(!requireSupabase())return;
  message("loginMessage","Ingresando...");
  const{error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){message("loginMessage",error.message,true);return}
  openTeacherPanel();
});
$("registerForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!requireSupabase())return;
  message("registerMessage","Creando cuenta...");
  const email=$("registerEmail").value.trim(),password=$("registerPassword").value;
  const{data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{nombre:$("registerName").value.trim(),apellido:$("registerLastName").value.trim(),curso:$("registerCourse").value.trim()}}});
  if(error){message("registerMessage",error.message,true);return}
  if(data.session){openTeacherPanel()}else message("registerMessage","Cuenta creada. Revisa tu correo si la confirmación está activada.");
});

$("studentForm").addEventListener("submit",async e=>{e.preventDefault();const code=$("gameCode").value.trim().toUpperCase(),name=$("studentName").value.trim(),company=$("companyName").value.trim();if(code!=="SIDE-000"){if(!requireSupabase())return;message("studentMessage","Buscando partida...");const{data:game,error}=await supabaseClient.rpc("buscar_partida_por_codigo",{p_codigo:code});if(error){message("studentMessage",error.message,true);return}const found=Array.isArray(game)?game[0]:game;if(!found){message("studentMessage","No encontramos una partida con ese código.",true);return}const{data:participant,error:joinError}=await supabaseClient.from("participantes").insert({partida_id:found.id,nombre:name,empresa:company}).select("id").single();if(joinError){message("studentMessage",joinError.message,true);return}currentStudent={name,company,participantId:participant?.id||null,game:found};}else currentStudent={name,company,participantId:null,game:DEMO_GAME};closeModal();startJoinLoading()});
function startJoinLoading(){showScreen("studentLoading");let p=0;const texts=["Sincronizando partida","Cargando escenario empresarial","Preparando decisiones","¡Todo listo!"];let step=0;$("joinProgress").style.width="0%";const i=setInterval(()=>{p+=4;$("joinProgress").style.width=p+"%";if(p%25===0&&step<3)$("joinLoadingText").textContent=texts[++step];if(p>=100){clearInterval(i);prepareLobby()}},55)}
async function prepareLobby(){
  $("lobbyCode").textContent=currentStudent.game.codigo;
  $("lobbyGameName").textContent=currentStudent.game.nombre;
  $("lobbyStudent").textContent=currentStudent.name+" · "+currentStudent.company;
  $("lobbySegment").textContent="SEGMENTO INICIAL DE REFERENCIA: "+(currentStudent.game.segmento||"ESTÁNDAR").toUpperCase()+" · PODRÁS DEFINIRLO EN DECISIONES";
  await openStudentTutorial();
}
async function openStudentTutorial(isReplay=false){
  showScreen("tutorial");
  const mount=$("tutorialMount");
  if(!mount.dataset.loaded){
    try{
      const response=await fetch("tutorial.html");
      if(!response.ok) throw new Error("No se pudo cargar tutorial.html");
      mount.innerHTML=await response.text();
      mount.dataset.loaded="1";
    }catch(error){
      console.error(error);
      showScreen("studentLobby");
      return;
    }
  }
  if(typeof window.initSIDETutorial==="function"){
    window.initSIDETutorial(()=>showScreen("studentLobby"));
  }
}
$("enterDecisionsBtn").addEventListener("click",()=>openDecisionMenu());
$("reopenTutorialBtn").addEventListener("click",()=>openStudentTutorial(true));
$("backToProfiles").addEventListener("click",()=>showScreen("profiles"));

function loadDecisionState(){
  try{decisionState=JSON.parse(localStorage.getItem("SIDE_DECISIONS_"+currentStudent.company)||"{}")||{}}
  catch{decisionState={}}
  decisionDrafts={};
}
function saveDecisionState(){localStorage.setItem("SIDE_DECISIONS_"+currentStudent.company,JSON.stringify(decisionState))}
function syncStudentReportPreview(){
  /*
   * TODO BACKEND CONNECTION:
   * Reemplazar este bloque por INSERT/UPSERT a la tabla/API de reportes
   * cuando el módulo Estudiante y el Panel Docente estén conectados.
   */
  const entries=allDecisionItems().map(item=>decisionState[item.id]).filter(Boolean);
  const totalCosts=entries.reduce((sum,e)=>sum+(Number(e.cost)||0),0);
  const seed=Array.from(currentStudent.company||"SIDE").reduce((n,c)=>n+c.charCodeAt(0),0);
  const base=30000;
  const ingresos=Math.max(0,Math.round(base*0.18 + entries.length*1250 + (seed%900)));
  const costos=Math.round(totalCosts + base*0.05);
  const report={
    id:currentStudent.participantId||("local-"+currentStudent.company),
    nombre:currentStudent.name||"Estudiante demo",
    empresa:currentStudent.company||"Empresa demo",
    partida:currentStudent.game?.codigo||"SIDE-000",
    ronda:1,
    capital:base,
    ingresos,costos,utilidad:ingresos-costos,
    rondasActivas:1,
    actividad:entries.length,
    decisiones:entries.map(e=>e.label),
    score:Math.max(0,Math.round((ingresos-costos)/100 + entries.length*5)),
    estado:"activa",
    updatedAt:new Date().toISOString()
  };
  const reports=JSON.parse(localStorage.getItem("SIDE_STUDENT_REPORTS")||"[]");
  const idx=reports.findIndex(r=>r.empresa===report.empresa&&r.partida===report.partida);
  if(idx>=0) reports[idx]=report; else reports.push(report);
  localStorage.setItem("SIDE_STUDENT_REPORTS",JSON.stringify(reports));
}
function allDecisionItems(){return DECISION_CATALOG.flatMap(c=>c.items)}
function findDecisionItem(id){return allDecisionItems().find(i=>i.id===id)}
function normalizeIds(entry,item){
  const raw=Array.isArray(entry?.optionIds)?entry.optionIds:(entry?.optionId?[entry.optionId]:[]);
  const valid=new Set(item.options.map(o=>o.id));
  return [...new Set(raw.filter(id=>valid.has(id)))];
}
function savedIds(item){return normalizeIds(decisionState[item.id],item)}
function pickedIds(item){return Object.prototype.hasOwnProperty.call(decisionDrafts,item.id)?decisionDrafts[item.id]:savedIds(item)}
function isDecisionDone(item){return savedIds(item).length>0}
function arraysEqual(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
function formatCost(cost){const n=Number(cost)||0;return n>0?"S/ "+n.toLocaleString("es-PE"):"Sin costo"}
function impactChip(label,value){
  const n=Number(value)||0;
  if(!n)return "";
  const sign=n>0?"+":"";
  const cls=n>0?"positive":"negative";
  return `<span class="impact-chip ${cls}">${escapeHtml(label)} ${sign}${n}</span>`;
}
function openDecisionMenu(){loadDecisionState();currentCategory=null;renderDecisionHome();showScreen("decisionMenu")}
function renderDecisionHome(){
  currentCategory=null;
  decisionDrafts={};
  $("decisionHome").classList.remove("hidden");
  $("decisionDetail").classList.add("hidden");
  $("decisionConfirm")?.classList.add("hidden");
  const grid=$("categoryCards");
  grid.innerHTML=DECISION_CATALOG.map(c=>{
    const done=c.items.filter(isDecisionDone).length;
    const pct=c.items.length?Math.round(done/c.items.length*100):0;
    return `<button class="category-game-card cat-${c.cat}" data-cat="${c.cat}" aria-label="Abrir ${escapeHtml(c.title)}">
      <div class="cat-art"><img class="category-svg" src="${escapeHtml(c.icon||decisionIcon(c.cat))}" alt=""><span class="cat-glow"></span></div>
      <div class="cat-copy"><span class="cat-kicker">ZONA DE DECISIÓN</span><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.desc)}</p><div class="cat-progress"><span style="width:${pct}%"></span></div><small>${done}/${c.items.length} jugadas completadas</small></div>
      <span class="play-arrow"><img src="${UI_ICONS.play}" alt=""></span>
    </button>`;
  }).join("");
  grid.querySelectorAll(".category-game-card").forEach(b=>b.addEventListener("click",()=>openDecisionCategory(b.dataset.cat)));
  updateOverallProgress();
}
function openDecisionCategory(cat){
  currentCategory=cat;
  decisionDrafts={};
  renderDecisionCategory();
  $("decisionHome").classList.add("hidden");
  $("decisionDetail").classList.remove("hidden");
  window.scrollTo(0,0);
}
function renderDecisionCategory(){
  const cat=DECISION_CATALOG.find(c=>c.cat===currentCategory);
  if(!cat){renderDecisionHome();return}
  $("categoryEyebrow").textContent="ZONA DE DECISIÓN";
  $("categoryTitle").textContent=cat.title;
  $("categoryDescription").textContent=cat.desc;
  $("categoryCount").textContent=cat.items.length;
  $("detailCategoryIcon").src=cat.icon||decisionIcon(cat.cat);
  const cards=$("decisionCards");
  cards.innerHTML=cat.items.map(item=>renderDecisionCard(item,cat)).join("");
  cards.querySelectorAll(".option-card").forEach(b=>b.addEventListener("click",()=>toggleDecisionOption(b.dataset.decision,b.dataset.option)));
  cards.querySelectorAll(".confirm-card").forEach(b=>b.addEventListener("click",()=>confirmDecisionSelection(b.dataset.decision)));
  updateOverallProgress();
}
function renderDecisionCard(item,cat){
  const saved=savedIds(item);
  const picked=pickedIds(item);
  const changed=!arraysEqual(saved,picked);
  const complete=saved.length>0;
  const multi=item.multi===true&&Number(item.max)>1;
  const max=multi?Math.min(Number(item.max)||3,item.options.length):1;
  const slots=Array.from({length:max},(_,i)=>`<i class="pick-slot ${i<picked.length?"on":""}"></i>`).join("");
  const instruction=multi?`Combina hasta ${max} alternativas en esta jugada.`:(item.options.length===1?"Decisión obligatoria: confírmala para continuar.":"Elige una alternativa y confirma la jugada.");
  const status=changed?(picked.length?"POR GUARDAR":"PENDIENTE"):(complete?"✓ GUARDADA":"PENDIENTE");
  const statusClass=changed?"draft":(complete?"saved":"");
  const options=item.options.map(opt=>{
    const selected=picked.includes(opt.id);
    const impacts=[impactChip("Cal.",opt.quality),impactChip("Efi.",opt.efficiency),impactChip("Rep.",opt.reputation),impactChip("Fin.",opt.finance)].filter(Boolean).join("");
    const choiceIcon=selected?UI_ICONS.check:(item.options.length===1?UI_ICONS.lock:UI_ICONS.play);
    return `<button class="option-card ${selected?"selected":""}" data-decision="${item.id}" data-option="${opt.id}" aria-pressed="${selected}">
      <span class="option-option-icon"><img src="${choiceIcon}" alt=""></span>
      <span class="option-top"><strong>${escapeHtml(opt.label)}</strong><i>${formatCost(opt.cost)}</i></span>
      <span class="option-desc">${escapeHtml(opt.desc)}</span>
      <span class="option-meta"><small>${escapeHtml(opt.period)}</small><b>${escapeHtml(opt.id)}</b></span>
      ${impacts?`<span class="impact-row">${impacts}</span>`:""}
      ${opt.notes?`<span class="option-note">${escapeHtml(opt.notes)}</span>`:""}
      <span class="option-play">${selected?"SELECCIONADA":"ELEGIR"} <img src="${selected?UI_ICONS.check:UI_ICONS.play}" alt=""></span>
    </button>`;
  }).join("");
  const selectionText=multi?`${picked.length}/${max} seleccionadas`:(picked.length?"1/1 seleccionada":"0/1 seleccionada");
  return `<article class="decision-card ${complete?"completed":""} ${changed?"has-draft":""}">
    <div class="decision-card-art">
      <img src="${escapeHtml(cat.icon||decisionIcon(cat.cat))}" alt="">
      <div><span class="decision-kicker">DECISIÓN ${escapeHtml(cat.cat)} · ${escapeHtml(item.id)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(instruction)}</p></div>
      <span class="decision-status ${statusClass}">${status}</span>
    </div>
    <div class="selection-guide"><div class="pick-slots">${slots}</div><strong>${selectionText}</strong>${multi?"<small>PUEDES ELEGIR 1, 2 O 3</small>":"<small>SELECCIÓN ÚNICA</small>"}</div>
    <div class="options-grid">${options}</div>
    <div class="decision-card-foot">
      <span>${picked.length?`Costo de la jugada: <strong>${formatCost(item.options.filter(o=>picked.includes(o.id)).reduce((n,o)=>n+(Number(o.cost)||0),0))}</strong>`:"Selecciona una opción para habilitar el botón."}</span>
      <button class="confirm-card" data-decision="${item.id}" ${picked.length?"":"disabled"}><img src="${UI_ICONS.check}" alt="">${complete?"ACTUALIZAR JUGADA":"CONFIRMAR JUGADA"}</button>
    </div>
  </article>`;
}
function toggleDecisionOption(decisionId,optionId){
  const item=findDecisionItem(decisionId); if(!item)return;
  let ids=[...pickedIds(item)];
  const pos=ids.indexOf(optionId);
  if(item.multi===true&&Number(item.max)>1){
    if(pos>=0) ids.splice(pos,1);
    else{
      const max=Math.min(Number(item.max)||3,item.options.length);
      if(ids.length>=max){toast(`Puedes seleccionar como máximo ${max} opciones en ${item.name}.`);return}
      ids.push(optionId);
    }
  }else ids=pos>=0?[]:[optionId];
  decisionDrafts[item.id]=ids;
  renderDecisionCategory();
}
function confirmDecisionSelection(decisionId){
  const item=findDecisionItem(decisionId); if(!item)return;
  const ids=pickedIds(item); if(!ids.length){toast("Selecciona al menos una opción.");return}
  const opts=item.options.filter(o=>ids.includes(o.id));
  const cost=opts.reduce((n,o)=>n+(Number(o.cost)||0),0);
  decisionState[item.id]={optionIds:ids,optionId:ids[0],label:opts.map(o=>o.label).join(" + "),cost,options:opts.map(o=>({id:o.id,label:o.label,cost:o.cost}))};
  delete decisionDrafts[item.id];
  saveDecisionState();
  syncStudentReportPreview();
  saveDecisionToSupabase({item,opts,cost});
  toast(opts.length>1?`${opts.length} opciones confirmadas en ${item.name}.`:`Jugada confirmada: ${opts[0].label}`);
  renderDecisionCategory();
  checkAllDecisions();
}
async function saveDecisionToSupabase(selection){
  if(!supabaseClient || !currentStudent.participantId) return;
  try{
    const impacts=selection.opts.reduce((a,o)=>({quality:a.quality+(Number(o.quality)||0),efficiency:a.efficiency+(Number(o.efficiency)||0),reputation:a.reputation+(Number(o.reputation)||0),finance:a.finance+(Number(o.finance)||0)}),{quality:0,efficiency:0,reputation:0,finance:0});
    await supabaseClient.from("decisiones").insert({participante_id:currentStudent.participantId,ronda:1,categoria:selection.item.name,decision:{id:selection.item.id,option_ids:selection.opts.map(o=>o.id),options:selection.opts.map(o=>o.label)},resultado:{costo_referencial:selection.cost,impactos:impacts}});
  }catch(err){console.warn("No se pudo sincronizar la decisión:",err.message)}
}
function updateOverallProgress(){
  const items=allDecisionItems();
  const done=items.filter(isDecisionDone).length;
  const pct=items.length?Math.round(done/items.length*100):0;
  $("decisionProgressText").textContent=pct+"%";
  $("decisionProgressBar").style.width=pct+"%";
}
function checkAllDecisions(){
  const items=allDecisionItems();
  const done=items.filter(isDecisionDone).length;
  if(done>=items.length&&items.length){
    $("decisionSummary").classList.remove("hidden");
    const cost=items.reduce((n,item)=>n+(Number(decisionState[item.id]?.cost)||0),0);
    $("summaryStats").innerHTML=`<div><strong>${items.length}</strong><span>DECISIONES</span></div><div><strong>S/ ${cost.toLocaleString("es-PE")}</strong><span>COSTO REFERENCIAL</span></div>`;
  }
}
$("restartDecisionMenu").addEventListener("click",()=>{$("decisionSummary").classList.add("hidden");renderDecisionHome()});
$("backToDecisionHome").addEventListener("click",()=>renderDecisionHome());
$("exitDecisions").addEventListener("click",()=>showScreen("studentLobby"));

if(supabaseClient)supabaseClient.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")showScreen("profiles")});
