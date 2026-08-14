const cfg=window.SIDE_CONFIG||{};
const hasConfig=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_URL.includes("TU-PROYECTO");
const supabaseClient=hasConfig&&window.supabase?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY):null;
const $=id=>document.getElementById(id);
const state={
  modes:{capital:"manual",demand:"manual",interest:"manual",cycles:"manual",marketShock:"manual",volatility:"manual",regulation:"manual"},
  reports:[],
  events:[],
  round:1,
  timer:null,
  seconds:600,
  eliminated:new Set()
};
const SHOCKS=["none","leather_up","leather_down","fashion","recession","boom"];
const REGULATIONS=["none","tariff","environment","quality","tax"];
const SHOCK_LABELS={none:"Sin shock",leather_up:"Cuero +25%",leather_down:"Cuero -15%",fashion:"Cambio de moda: demanda premium +30%",recession:"Contracción: demanda -25%",boom:"Boom de mercado: demanda +25%"};
const REG_LABELS={none:"Sin evento",tariff:"Arancel de importación +12%",environment:"Norma ambiental: costo +8%",quality:"Norma de calidad: penalización por baja calidad",tax:"Impuesto extraordinario +5%"};
const DEMO_REPORTS=[
 {id:"demo-1",nombre:"Ana Torres",empresa:"Andes Leather",partida:"SIDE-000",ronda:3,capital:30000,ingresos:18400,costos:10200,utilidad:8200,rondasActivas:3,actividad:12,decisiones:["Premium","Maquinaria industrial","Canal digital"],score:92,estado:"activa"},
 {id:"demo-2",nombre:"Luis Pérez",empresa:"Cuero Norte",partida:"SIDE-000",ronda:3,capital:30000,ingresos:17100,costos:9900,utilidad:7200,rondasActivas:3,actividad:11,decisiones:["Estándar","Preventivo básico","Venta mayorista"],score:86,estado:"activa"},
 {id:"demo-3",nombre:"María Silva",empresa:"Marroquinería Sol",partida:"SIDE-000",ronda:3,capital:30000,ingresos:14900,costos:11200,utilidad:3700,rondasActivas:3,actividad:8,decisiones:["Económico","Equipo básico","Canales mixtos"],score:73,estado:"activa"},
 {id:"demo-4",nombre:"Carlos Rojas",empresa:"Piel Urbana",partida:"SIDE-000",ronda:2,capital:30000,ingresos:8900,costos:9800,utilidad:-900,rondasActivas:2,actividad:3,decisiones:["Estándar","Sin mantenimiento"],score:41,estado:"activa"}
];

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2600)}
function money(n){return "S/ "+Number(n||0).toLocaleString("es-PE",{maximumFractionDigits:0})}
function clamp(n,a,b){return Math.min(b,Math.max(a,n))}
function setDefaultDates(){
  const now=new Date(), end=new Date(now); end.setMonth(end.getMonth()+2);
  $("startDate").value=now.toISOString().slice(0,10); $("endDate").value=end.toISOString().slice(0,10);
}
function getConfig(){
 return {
  nombre:$("gameName").value,curso:$("gameCourse").value,codigo:$("gameCode").value,
  capital:Number($("capital").value),capitalMin:Number($("capitalMin").value),capitalMax:Number($("capitalMax").value),
  demand:Number($("demand").value),demandMin:Number($("demandMin").value),demandMax:Number($("demandMax").value),
  interest:Number($("interest").value),interestMin:Number($("interestMin").value),interestMax:Number($("interestMax").value),
  cycles:Number($("cycles").value),cyclesMin:Number($("cyclesMin").value),cyclesMax:Number($("cyclesMax").value),
  roundMinutes:Number($("roundMinutes").value),round:Number($("currentRound").value),
  startDate:$("startDate").value,endDate:$("endDate").value,
  volatility:Number($("volatility").value),volMin:Number($("volMin").value),volMax:Number($("volMax").value),
  marketShock:$("marketShock").value,regulation:$("regulation").value,
  modes:{...state.modes}
 };
}
function saveConfig(){
 localStorage.setItem("SIDE_TEACHER_CONFIG",JSON.stringify(getConfig()));
 $("gameCodeBadge").textContent=$("gameCode").value||"SIDE-000";
 toast("Configuración guardada localmente.");
}
function loadConfig(){
 const raw=localStorage.getItem("SIDE_TEACHER_CONFIG"); if(!raw)return setDefaultDates();
 try{
  const c=JSON.parse(raw);
  Object.keys(c).forEach(k=>{if(k==="modes")return;if($(k))$(k).value=c[k]??$(k).value});
  Object.assign(state.modes,c.modes||{});
 }catch{}
 setDefaultDatesIfEmpty();
}
function setDefaultDatesIfEmpty(){if(!$("startDate").value||!$("endDate").value)setDefaultDates()}
function setMode(key,mode){
 state.modes[key]=mode;
 document.querySelectorAll(`[data-mode-for="${key}"] button`).forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
 localStorage.setItem("SIDE_TEACHER_MODES",JSON.stringify(state.modes));
 if(mode==="random") randomize(key);
}
function randomInt(a,b){a=Math.ceil(Number(a));b=Math.floor(Number(b));if(b<a)[a,b]=[b,a];return Math.floor(Math.random()*(b-a+1))+a}
function randomFloat(a,b){a=Number(a);b=Number(b);if(b<a)[a,b]=[b,a];return Math.round((Math.random()*(b-a)+a)*10)/10}
function randomize(key){
 if(key==="capital")$("capital").value=randomInt($("capitalMin").value,$("capitalMax").value);
 if(key==="demand")$("demand").value=randomInt($("demandMin").value,$("demandMax").value);
 if(key==="interest")$("interest").value=randomFloat($("interestMin").value,$("interestMax").value);
 if(key==="cycles")$("cycles").value=randomInt($("cyclesMin").value,$("cyclesMax").value);
 if(key==="volatility")$("volatility").value=randomFloat($("volMin").value,$("volMax").value);
 if(key==="marketShock")$("marketShock").value=SHOCKS[randomInt(0,SHOCKS.length-1)];
 if(key==="regulation")$("regulation").value=REGULATIONS[randomInt(0,REGULATIONS.length-1)];
 toast("Valor aleatorio generado para "+key+".");
}
function loadReports(){
  /*
   * TODO CONEXIÓN ESTUDIANTE → DOCENTE:
   * Actualmente se leen reportes de localStorage. Sustituir esta función por:
   * const {data,error}=await supabaseClient.from("reportes_estudiantes").select("*").eq("partida_id", partidaId)
   * o por la API/Realtime que utilicen para comunicar ambos módulos.
   */
  try{const saved=JSON.parse(localStorage.getItem("SIDE_STUDENT_REPORTS")||"[]");state.reports=saved.length?saved:DEMO_REPORTS.map(x=>({...x}))}
  catch{state.reports=DEMO_REPORTS.map(x=>({...x}))}
  state.reports=state.reports.filter(r=>r.partida===$("gameCode").value||!r.partida);
  if(!state.reports.length)state.reports=DEMO_REPORTS.map(x=>({...x}));
  renderCompanies();renderResults();renderWinnerSelect();
}
function renderCompanies(){
 const grid=$("companiesGrid");
 grid.innerHTML=state.reports.map((r,i)=>`
  <article class="company-card">
   <h3>${escapeHtml(r.empresa)}</h3><small>${escapeHtml(r.nombre||"Estudiante")} · ${r.rondasActivas||r.ronda||0} rondas</small>
   <div class="score">${Number(r.score||0)} pts</div>
   <div class="metric"><span>Utilidad</span><b class="${r.utilidad>=0?"profit":"loss"}">${money(r.utilidad)}</b></div>
   <div class="metric"><span>Actividad</span><b>${r.actividad||0} decisiones</b></div>
   <div class="metric"><span>Estado</span><b>${r.estado||"activa"}</b></div>
   <button class="eliminate" data-eliminate="${i}">${r.estado==="eliminada"?"Reactivar empresa":"Eliminar por inactividad"}</button>
  </article>`).join("")||'<div class="card">No hay empresas reportadas.</div>';
 grid.querySelectorAll("[data-eliminate]").forEach(b=>b.addEventListener("click",()=>toggleElimination(Number(b.dataset.eliminate))));
}
function toggleElimination(i){
 const r=state.reports[i]; if(!r)return;
 if(r.estado==="eliminada"){r.estado="activa";state.eliminated.delete(r.empresa);toast(r.empresa+" reactivada.")}
 else{r.estado="eliminada";state.eliminated.add(r.empresa);toast(r.empresa+" marcada como eliminada por el docente.")}
 persistReports();renderCompanies();renderResults();renderWinnerSelect();
}
function persistReports(){localStorage.setItem("SIDE_STUDENT_REPORTS",JSON.stringify(state.reports))}
function renderResults(){
 const active=state.reports.filter(r=>r.estado!=="eliminada"), totalProfit=active.reduce((s,r)=>s+Number(r.utilidad||0),0);
 const best=active.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0))[0];
 $("resultStats").innerHTML=[
  ["Empresas",state.reports.length],["Activas",active.length],["Utilidad total",money(totalProfit)],["Mayor puntaje",best?`${best.score} pts`:"—"]
 ].map(x=>`<div class="stat"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
 $("resultsBody").innerHTML=state.reports.map(r=>`<tr><td><b>${escapeHtml(r.empresa)}</b><br><small>${escapeHtml(r.nombre||"")}</small></td><td>${money(r.capital)}</td><td>${money(r.ingresos)}</td><td>${money(r.costos)}</td><td class="${r.utilidad>=0?"profit":"loss"}">${money(r.utilidad)}</td><td>${r.rondasActivas||r.ronda||0}</td><td>${r.actividad||0}</td><td>${r.estado}</td></tr>`).join("");
 $("detailReports").innerHTML=state.reports.map(r=>`<div class="report-detail"><h4>${escapeHtml(r.empresa)} · ${r.score||0} pts</h4><p><b>Decisiones:</b> ${(r.decisiones||[]).map(escapeHtml).join(" · ")||"Sin detalle recibido"}<br><b>Actualizado:</b> ${r.updatedAt?new Date(r.updatedAt).toLocaleString("es-PE"):"simulación"}</p></div>`).join("");
}
function renderWinnerSelect(){
 const sel=$("winnerSelect"); const active=state.reports.filter(r=>r.estado!=="eliminada");
 sel.innerHTML=active.map(r=>`<option value="${escapeAttr(r.empresa)}">${escapeHtml(r.empresa)} — ${r.score||0} pts</option>`).join("");
}
function renderPodium(){
 const winner=$("winnerSelect").value;
 let list=state.reports.filter(r=>r.estado!=="eliminada").sort((a,b)=>Number(b.score||0)-Number(a.score||0));
 if(winner){const idx=list.findIndex(r=>r.empresa===winner);if(idx>0)[list[0],list[idx]]=[list[idx],list[0]]}
 const names=["🥇","🥈","🥉"], classes=["first","second","third"];
 $("podiumPreview").innerHTML=list.slice(0,3).map((r,i)=>`<div class="podium-place ${classes[i]}"><span>${names[i]}</span><strong>${escapeHtml(r.empresa)}</strong><small>${r.score||0} pts</small></div>`).join("")||"<p>Sin empresas activas.</p>";
}
function publishPodium(){
 const winner=$("winnerSelect").value;
 if(!winner){toast("Selecciona una empresa ganadora.");return}
 const list=state.reports.filter(r=>r.estado!=="eliminada").sort((a,b)=>Number(b.score||0)-Number(a.score||0));
 const idx=list.findIndex(r=>r.empresa===winner);if(idx>0)[list[0],list[idx]]=[list[idx],list[0]];
 const publication={publishedAt:new Date().toISOString(),winner,reason:$("winnerReason").value,podium:list.slice(0,3).map(r=>({empresa:r.empresa,score:r.score}))};
 localStorage.setItem("SIDE_PUBLISHED_PODIUM",JSON.stringify(publication));
 $("podiumState").textContent="Publicado";$("publishStatus").textContent="Podio publicado: "+new Date(publication.publishedAt).toLocaleString("es-PE");
 renderPodium();toast("Podio publicado correctamente.");
 /*
  * TODO BACKEND CONNECTION:
  * Reemplazar localStorage por UPDATE/INSERT de la publicación en Supabase.
  */
}
function loadPublished(){
 try{const p=JSON.parse(localStorage.getItem("SIDE_PUBLISHED_PODIUM")||"null");if(p){$("winnerSelect").value=p.winner;$("winnerReason").value=p.reason||"";$("podiumState").textContent="Publicado";$("publishStatus").textContent="Publicado: "+new Date(p.publishedAt).toLocaleString("es-PE");renderPodium()}}catch{}
}
function addEvent(text,type){
 state.events.unshift({round:state.round,text,type,at:new Date().toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})});
 localStorage.setItem("SIDE_EVENT_LOG",JSON.stringify(state.events));renderEvents();
}
function renderEvents(){$("eventLog").innerHTML=state.events.map(e=>`<div class="event-entry"><span>Ronda ${e.round}: ${escapeHtml(e.text)}</span><small>${e.at}</small></div>`).join("")||"<p class=\"hint\">No hay eventos registrados.</p>"}
function advanceRound(){
 const max=Number($("cycles").value)||6;
 if(state.round>=max){toast("La simulación ya llegó al último ciclo.");return}
 state.round++;
 $("currentRound").value=state.round;$("roundDisplay").textContent=`${state.round} / ${max}`;
 $("roundState").textContent="Ronda en curso";
 const shock=state.modes.marketShock==="random"?(SHOCKS[randomInt(0,SHOCKS.length-1)]):$("marketShock").value;
 const reg=state.modes.regulation==="random"?(REGULATIONS[randomInt(0,REGULATIONS.length-1)]):$("regulation").value;
 if(shock!=="none")addEvent(SHOCK_LABELS[shock],"mercado");
 if(reg!=="none")addEvent(REG_LABELS[reg],"regulación");
 const vol=state.modes.volatility==="random"?randomFloat($("volMin").value,$("volMax").value):Number($("volatility").value);
 $("roundSummary").textContent=`Volatilidad ${vol}% · ${SHOCK_LABELS[shock]} · ${REG_LABELS[reg]}`;
 state.seconds=Number($("roundMinutes").value)*60;updateTimer();
 loadReports();
 toast(`Ronda ${state.round} iniciada.`);
}
function updateTimer(){
 const s=Math.max(0,state.seconds),m=String(Math.floor(s/60)).padStart(2,"0"),sec=String(s%60).padStart(2,"0");
 $("roundTimer").textContent=`${m}:${sec}`;
}
function startTimer(){
 if(state.timer){clearInterval(state.timer);state.timer=null;$("startTimer").textContent="Iniciar";return}
 $("startTimer").textContent="Pausar";
 state.timer=setInterval(()=>{state.seconds--;updateTimer();if(state.seconds<=0){clearInterval(state.timer);state.timer=null;$("startTimer").textContent="Iniciar";addEvent("Tiempo de la ronda agotado.","sistema")}},1000);
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(v){return escapeHtml(v)}
function switchTab(tab){
 document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+tab));
 const titles={configuracion:"Configuración de la simulación",rondas:"Rondas y eventos",empresas:"Empresas participantes",resultados:"Resultados de estudiantes",podio:"Ganador y podio"};
 $("pageTitle").textContent=titles[tab];
 if(tab==="empresas"||tab==="resultados"||tab==="podio")loadReports();
 if(tab==="podio")loadPublished();
}
function makePdf(){
 const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:"pt",format:"a4"});
 const c=getConfig(), active=state.reports.filter(r=>r.estado!=="eliminada");
 doc.setFont("helvetica","bold");doc.setFontSize(19);doc.text("SIDE — Reporte de simulación",40,45);
 doc.setFontSize(10);doc.setFont("helvetica","normal");doc.text(`${c.nombre} · ${c.curso} · ${c.codigo}`,40,63);
 doc.text(`Generado: ${new Date().toLocaleString("es-PE")}`,40,78);
 let y=108;doc.setFont("helvetica","bold");doc.text("Configuración económica",40,y);y+=18;doc.setFont("helvetica","normal");
 [
  `Capital inicial: ${money(c.capital)}`,`Demanda base: ${c.demand} unidades/ciclo`,`Tasa de interés: ${c.interest}%`,
  `Ciclos: ${c.cycles}`,`Minutos por ronda: ${c.roundMinutes}`,`Inicio: ${c.startDate} · Fin: ${c.endDate}`,
  `Shock: ${SHOCK_LABELS[c.marketShock]}`,`Regulación: ${REG_LABELS[c.regulation]}`,`Volatilidad: ${c.volatility}%`
 ].forEach(t=>{doc.text(t,40,y);y+=14});
 y+=12;doc.setFont("helvetica","bold");doc.text("Resultados de estudiantes",40,y);y+=18;doc.setFont("helvetica","normal");
 active.forEach((r,i)=>{
  if(y>750){doc.addPage();y=45}
  doc.setFont("helvetica","bold");doc.text(`${i+1}. ${r.empresa} — ${r.score||0} pts`,40,y);y+=14;
  doc.setFont("helvetica","normal");doc.text(`Estudiante: ${r.nombre||"—"} | Capital: ${money(r.capital)} | Ingresos: ${money(r.ingresos)} | Costos: ${money(r.costos)} | Utilidad: ${money(r.utilidad)}`,50,y);y+=13;
  doc.text(`Actividad: ${r.actividad||0} decisiones | Rondas: ${r.rondasActivas||r.ronda||0} | Estado: ${r.estado}`,50,y);y+=14;
  doc.text(`Decisiones: ${(r.decisiones||[]).join(" · ")||"Sin detalle"}`,50,y);y+=20;
 });
 const pub=JSON.parse(localStorage.getItem("SIDE_PUBLISHED_PODIUM")||"null");
 if(pub){if(y>700){doc.addPage();y=45}doc.setFont("helvetica","bold");doc.text("Podio publicado",40,y);y+=18;doc.setFont("helvetica","normal");pub.podium.forEach((p,i)=>{doc.text(`${i+1}. ${p.empresa} — ${p.score} pts`,50,y);y+=15});doc.text(`Ganador elegido por el docente: ${pub.winner}`,50,y);y+=15;if(pub.reason)doc.text(`Justificación: ${pub.reason}`,50,y)}
 return doc;
}
function showPdf(){
 const doc=makePdf(),blob=doc.output("blob"),url=URL.createObjectURL(blob);
 $("pdfFrame").src=url;$("pdfModal").classList.remove("hidden");
}
function downloadPdf(){makePdf().save(($("gameCode").value||"SIDE-000")+"-reporte.pdf")}
function restoreModes(){
 try{Object.assign(state.modes,JSON.parse(localStorage.getItem("SIDE_TEACHER_MODES")||"{}"))}catch{}
 Object.keys(state.modes).forEach(k=>setMode(k,state.modes[k]));
}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
document.querySelectorAll(".segmented button").forEach(b=>b.addEventListener("click",()=>setMode(b.parentElement.dataset.modeFor,b.dataset.mode)));
document.querySelectorAll("[data-randomize]").forEach(b=>b.addEventListener("click",()=>randomize(b.dataset.randomize)));
$("saveAll").addEventListener("click",saveConfig);
$("refreshReports").addEventListener("click",()=>{loadReports();toast("Información actualizada.")});
$("advanceRound").addEventListener("click",advanceRound);
$("startTimer").addEventListener("click",startTimer);
$("clearEvents").addEventListener("click",()=>{state.events=[];localStorage.removeItem("SIDE_EVENT_LOG");renderEvents()});
$("publishPodium").addEventListener("click",publishPodium);
$("winnerSelect").addEventListener("change",renderPodium);
$("viewPdf").addEventListener("click",showPdf);
$("downloadPdf").addEventListener("click",downloadPdf);
$("closePdf").addEventListener("click",()=>$("pdfModal").classList.add("hidden"));
$("backHome").addEventListener("click",()=>window.location.href="index.html");

(async function init(){
 loadConfig();restoreModes();
 try{state.events=JSON.parse(localStorage.getItem("SIDE_EVENT_LOG")||"[]")}catch{}
 state.round=Number($("currentRound").value)||1;
 $("roundDisplay").textContent=`${state.round} / ${$("cycles").value}`;
 $("roundTimer").textContent=`${String(Number($("roundMinutes").value)).padStart(2,"0")}:00`;
 loadReports();renderEvents();loadPublished();
 if(supabaseClient){
  const {data:{session}}=await supabaseClient.auth.getSession();
  $("connectionDot").style.background=session?"#46d59a":"#f3c95f";
  $("connectionText").textContent=session?"Supabase conectado":"Modo simulación / sin sesión";
 }
})();
