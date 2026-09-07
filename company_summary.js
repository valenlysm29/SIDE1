/* SIDE V3: Empresa summary, immutable local receipts and explicit final review. */
const reviewModel=window.SIDE_REVIEW_MODEL;
let companySummaryRound='current',companySummaryFilter='all',summaryOwner='',activeReview=null,reviewCommitBusy=false;
const reviewMoney=value=>'S/ '+Number(value||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
function receiptKey(round=currentRound()){return `SIDE_DECISION_RECEIPTS_${storageKey()}_${round}`;}
function readReviewReceipts(round=currentRound()){
  try{const value=JSON.parse(localStorage.getItem(receiptKey(round))||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([cat,r])=>categoryByCat(cat)&&r&&Array.isArray(r.items)&&r.items.every(i=>i&&Array.isArray(i.rows)))):{};}catch{return {};}
}
function receiptRounds(){
  const prefix=`SIDE_DECISION_RECEIPTS_${storageKey()}_`,rounds=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix)){const r=Number(key.slice(prefix.length));if(Number.isInteger(r)&&r>0)rounds.push(r);}}
  return [...new Set(rounds)].sort((a,b)=>b-a);
}
function confirmedContext(){
  const ctx=decisionModelContext(),receipts=readReviewReceipts();
  for(const cat of decisionCategories()){
    if(!(sectionSubmitted(cat.cat)||decisionsSubmitted()))continue;
    const receipt=receipts[cat.cat];
    if(receipt?.drafts){Object.assign(ctx.drafts,deepClone(receipt.drafts));continue;}
    // Legacy V2 submissions have flags but no immutable receipts. Read saved values,
    // never an unsent working draft, and do not invent an original submission time.
    for(const item of cat.items)ctx.drafts[item.id]=reviewModel.draft(item,{...ctx,drafts:{}});
  }
  return ctx;
}
function migrateCurrentReceipts(){
  const receipts=readReviewReceipts(),ctx=confirmedContext();let changed=false;
  for(const cat of decisionCategories()){
    if(receipts[cat.cat]||!(sectionSubmitted(cat.cat)||decisionsSubmitted()))continue;
    const model=reviewModel.section(cat,ctx),drafts={};cat.items.forEach(i=>{drafts[i.id]=deepClone(ctx.drafts[i.id])});
    receipts[cat.cat]={...model,drafts,submitted:true,source:'legacy',sentAt:null,company:currentStudent.company,game:currentStudent.game?.codigo,recordedNet:Number(cashLedger[sectionLedgerKey(cat.cat)]||0)};
    changed=true;
  }
  if(changed)writeDecisionBatch({[receiptKey()]:JSON.stringify(receipts)});
}
function comparableSummaryDraft(item,d){
  if(item.type==='number')return {value:Number(d.value)||0};
  if(item.type==='loan')return {amount:Number(d.amount)||0};
  if(item.asset||item.type==='quantity'||item.type==='quantity-choice')return (item.options||[]).map(o=>[o.id,Number(d.quantities?.[o.id])||0]);
  if(item.id==='CANALES')return {ids:[...(d.optionIds||[])].sort(),quantities:RULES.STORE_IDS.map(id=>[id,RULES.storeQuantity(d,id)])};
  return {ids:[...(d.optionIds||[])].sort()};
}
function liveCompanyReview(){
  const context=confirmedContext(),receipts=readReviewReceipts();
  const sections=decisionCategories().map(cat=>{
    const submitted=sectionSubmitted(cat.cat)||decisionsSubmitted(),saved=cat.items.some(i=>Number(decisionState[i.id]?.round)===currentRound());
    const frozen=submitted?receipts[cat.cat]:null;
    const section=frozen?.items?deepClone(frozen):reviewModel.section(cat,context);
    const dirty=!submitted&&cat.items.some(item=>JSON.stringify(comparableSummaryDraft(item,context.drafts[item.id]))!==JSON.stringify(comparableSummaryDraft(item,reviewModel.draft(item,{...context,drafts:{}}))));
    return {...section,submitted,status:submitted?'sent':dirty?'draft':saved?'saved':'pending',sentAt:frozen?.sentAt||null,source:frozen?.source||'local'};
  });
  return {round:currentRound(),context,sections,financial:reviewModel.finances(sections,context),warnings:reviewModel.warnings(context)};
}
function reviewProblems(review,cats=decisionCategories().map(c=>c.cat)){
  const issues=[],ctx=review.context;
  for(const cat of decisionCategories().filter(c=>cats.includes(c.cat)&&!sectionSubmitted(c.cat))){
    for(const item of cat.items){
      if(item.type==='info')continue;
      const d=ctx.drafts[item.id]||{};
      if(itemRequired(item)&&!draftItemComplete(item))issues.push({cat:cat.cat,item:item.id,text:`Falta completar: ${item.name}.`});
      if(item.options){
        for(const id of d.optionIds||[])if(!item.options.some(o=>o.id===id))issues.push({cat:cat.cat,item:item.id,text:`Opci\u00f3n no v\u00e1lida en ${item.name}.`});
        for(const [id,value] of Object.entries(d.quantities||{})){
          const q=Number(value),floor=item.asset?-getOwned(item,id):item.id==='CANALES'?1:0;
          if(!Number.isSafeInteger(q)||q<floor)issues.push({cat:cat.cat,item:item.id,text:`Cantidad no v\u00e1lida en ${item.name}.`});
        }
      }
      if(item.type==='number'&&draftItemComplete(item)&&(!Number.isSafeInteger(Number(d.value))||Number(d.value)<Number(item.min||0)))issues.push({cat:cat.cat,item:item.id,text:`Revisa el valor de ${item.name}.`});
      if(item.type==='loan'&&(!Number.isFinite(Number(d.amount))||Number(d.amount)<0||Number(d.amount)>loanMaximum()))issues.push({cat:cat.cat,item:item.id,text:'El pr\u00e9stamo est\u00e1 fuera del l\u00edmite permitido.'});
      if(item.id==='CANALES')for(const id of RULES.STORE_IDS){try{RULES.nextStoreBatches(decisionState.CANALES,id,RULES.storeQuantity(d,id),ctx.round);}catch{issues.push({cat:'D',item:'CANALES',text:'No puedes reducir tiendas con un compromiso vigente.'});}}
    }
  }
  const delta=review.sections.filter(s=>cats.includes(s.cat)&&!s.submitted).reduce((sum,s)=>sum+s.net-Number(cashLedger[`${ctx.round}:${s.cat}`]||0),0);
  if(review.financial.currentCash+delta<-0.005)issues.push({cat:'E',text:'La caja al confirmar ser\u00eda negativa. Reduce gastos o revisa el financiamiento.'});
  return issues.filter((x,index,array)=>array.findIndex(y=>y.text===x.text&&y.cat===x.cat)===index);
}
function reviewFingerprint(){
  return JSON.stringify({company:storageKey(),round:currentRound(),drafts:decisionModelContext().drafts,config:teacherConfig(),
    state:localStorage.getItem(decisionKey()),ledger:localStorage.getItem(ledgerKey()),receipts:localStorage.getItem(receiptKey()),
    flags:decisionCategories().map(c=>sectionSubmitted(c.cat)),all:decisionsSubmitted()});
}
function commitReviewedSections(cats,finalize){
  if(reviewCommitBusy||decisionsSubmitted())return false;
  reviewCommitBusy=true;
  try{
    const review=liveCompanyReview(),problems=reviewProblems(review,cats);
    if(problems.length){toast(problems[0].text);return false;}
    const selected=decisionCategories().filter(c=>cats.includes(c.cat)&&!sectionSubmitted(c.cat));
    const plans=selected.map(cat=>prepareSectionSave(cat,review.context));
    const state=deepClone(decisionState),ledger=deepClone(cashLedger),receipts=readReviewReceipts(),writes={},sentAt=new Date().toISOString();
    const draftKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let draftStore={};try{draftStore=JSON.parse(localStorage.getItem(draftKey)||'{}')||{}}catch{}
    for(const plan of plans){
      Object.assign(state,plan.entries);ledger[sectionLedgerKey(plan.cat)]=plan.net;
      const drafts={};categoryByCat(plan.cat).items.forEach(i=>{drafts[i.id]=deepClone(review.context.drafts[i.id])});
      // Do not overwrite a prior submitted receipt. New cycles use a new key.
      if(!receipts[plan.cat])receipts[plan.cat]={...plan.model,drafts,submitted:true,sentAt,source:'local',company:currentStudent.company,game:currentStudent.game?.codigo,recordedNet:plan.net};
      delete draftStore[plan.cat];writes[sectionSubmissionKey(plan.cat)]='1';
    }
    if(finalize)writes[submissionKey()]='1';
    writes[decisionKey()]=JSON.stringify(state);writes[ledgerKey()]=JSON.stringify(ledger);writes[receiptKey()]=JSON.stringify(receipts);writes[draftKey]=JSON.stringify(draftStore);
    if(!writeDecisionBatch(writes))return false;
    const delta=Object.values(ledger).reduce((a,b)=>a+Number(b||0),0)-ledgerTotal();
    decisionState=state;cashLedger=ledger;decisionDrafts={};restoreDraftsForRound();
    if(finalize){currentCategory='A';companySummaryRound='current';companySummaryFilter='sent';closeCompanyReview();}
    try{syncStudentReportPreview();}catch(error){console.error('SIDE: preview report refresh failed',error);}
    animateCash(delta);renderTabs();renderDecisionCategory();updateHud();
    toast(finalize?'Decisiones confirmadas en este equipo. Consulta el resumen en Empresa.':`Secci\u00f3n ${categoryByCat(cats[0])?.short} enviada en este equipo.`);
    return true;
  }catch(error){console.error('SIDE: review confirmation failed',error);toast('No se pudo confirmar. Revisa tus decisiones e intenta nuevamente.');return false;}
  finally{reviewCommitBusy=false;}
}
function summaryStatus(section){return section.submitted?'ENVIADA':section.status==='draft'?'BORRADOR SIN GUARDAR':section.status==='saved'?'GUARDADA, NO ENVIADA':'PENDIENTE';}
function summaryDate(section){
  if(!section.submitted)return 'No confirmada en este ciclo';
  if(!section.sentAt)return 'Registro anterior; fecha original no disponible';
  const d=new Date(section.sentAt);return Number.isFinite(d.getTime())?`Enviada el ${d.toLocaleString('es-PE')}`:'Fecha no disponible';
}
function financialCardsHtml(financial){
  const f=financial,cards=[
    ['Caja actual',reviewMoney(f.currentCash),'Saldo guardado antes de los cambios pendientes. Los borradores guardados ya est\u00e1n reflejados.','current'],
    ['Desembolso de estas decisiones',reviewMoney(f.outflow),'Costo total elegido para este ciclo. Incluye lo enviado y lo guardado; no se cobra dos veces.','outflow'],
    ['Compromisos futuros',reviewMoney(f.contracts.total),'Alquileres m\u00ednimos de tiendas posteriores a este ciclo. No se descuentan ahora.','commitments'],
    ['Resultado estimado',reviewMoney(f.projectedCash),'Caja proyectada al confirmar, sin ventas futuras. Es una estimaci\u00f3n de caja, no de utilidad.','estimate']
  ];
  return `<div class="cs-financial-grid">${cards.map(([title,value,help,key])=>`<article class="cs-metric cs-metric-${key}"><span>${title}</span><strong data-summary-metric="${key}">${value}</strong><p>${help}</p>${key==='estimate'?'<b class="cs-estimate-tag">PROYECCI\u00d3N \u00b7 NO GARANTIZADA</b>':''}</article>`).join('')}</div>
    <div class="cs-cash-bridge"><span>Ajuste pendiente sobre la caja guardada: <b>${f.pendingDelta>=0?'+':''}${reviewMoney(f.pendingDelta)}</b></span><span>Pr\u00e9stamos elegidos: <b>${reviewMoney(f.financing)}</b></span><span>Ingreso por liquidaci\u00f3n: <b>${reviewMoney(f.assetIncome)}</b></span></div>`;
}
function futureHtml(financial){
  const f=financial;
  return `<details class="cs-future"><summary>Detalle de compromisos y supuestos de la proyecci\u00f3n</summary><div class="cs-future-body">
    <p><b>Costos de continuidad: ${reviewMoney(f.recurring)} por ciclo</b> si mantienes los locales, las tiendas y la dotaci\u00f3n elegidos. Es una referencia, no una obligaci\u00f3n contractual completa; excluye nuevas compras de insumos, marketing y capacitaci\u00f3n.</p>
    ${f.contracts.contracts.length?`<div class="cs-contracts">${f.contracts.contracts.map(c=>`<p><b>${escapeHtml(c.label)}: ${c.quantity} tienda(s).</b> ${reviewMoney(c.perCycle)} por ciclo; ${reviewMoney(c.total)} de alquileres m\u00ednimos futuros. \u00daltimo compromiso hasta el ciclo ${c.lastRound}.</p>`).join('')}</div>`:'<p>Sin contratos de tiendas f\u00edsicas seleccionados.</p>'}
    ${f.contracts.beyondGame>0?`<p class="cs-warning-text">${reviewMoney(f.contracts.beyondGame)} de esos alquileres quedan despu\u00e9s del \u00faltimo ciclo configurado. Se informan, pero este resumen no inventa una liquidaci\u00f3n al terminar la partida.</p>`:''}
    <p>El modelo de producci\u00f3n usa 1 ciclo como un mes de 30 d\u00edas, de acuerdo con el Excel de referencia. La duraci\u00f3n real del temporizador es independiente. La proyecci\u00f3n solo aplica los movimientos elegidos a la caja guardada: no anticipa ventas, eventos futuros, devoluciones ni intereses.</p>
    ${f.financing>0?'<p>El pr\u00e9stamo figura como ingreso de financiamiento, no como venta ni utilidad. El proyecto a\u00fan no define plazo ni cuotas; por eso no se presenta una amortizaci\u00f3n ficticia.</p>':''}
    <p>Guardar un borrador ya actualiza el saldo guardado en SIDE. Confirmar aplica \u00fanicamente la diferencia pendiente y bloquea las decisiones del ciclo.</p>
  </div></details>`;
}
function productionItemOutflow(review,id){
  const item=review.sections.flatMap(section=>section.items||[]).find(entry=>entry.id===id);
  return Number(item?.outflow||0);
}
function productionSummaryHtml(review){
  const plan=window.SIDE_PRODUCTION_MODEL.calculate(review.context);
  const materialCost=['CUERO','ACCESORIOS','HILO'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const laborCost=['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const supportCost=['JEFATURA','LIMPIEZA','ANALISTA_COMPRAS','LOCAL_PROD','MANTENIMIENTO'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const investmentCost=['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const cycleProductionCost=materialCost+laborCost+supportCost;
  const unitCost=plan.producibleUnits?cycleProductionCost/plan.producibleUnits:0;
  const stateClass=plan.productionGap?'limited':'ready';
  return `<section class="cs-production cs-production-${stateClass}" aria-labelledby="companyProductionTitle">
    <header class="cs-production-heading"><div><span class="cs-kicker">PLAN PRODUCTIVO DEL CICLO</span><h3 id="companyProductionTitle">De la compra a la producción terminada</h3><p>La cantidad final depende del menor resultado entre corte, ensamblado, acabado y materia prima disponible.</p></div><span class="cs-production-state">${plan.productionGap?'CAPACIDAD INSUFICIENTE':'META CUBIERTA'}</span></header>
    <div class="cs-production-kpis">
      <div><span>Meta elegida</span><strong>${plan.target.toLocaleString('es-PE')} u.</strong></div>
      <div><span>Producción posible</span><strong>${plan.producibleUnits.toLocaleString('es-PE')} u.</strong></div>
      <div><span>Faltante</span><strong>${plan.productionGap.toLocaleString('es-PE')} u.</strong></div>
      <div><span>Eficiencia aplicada</span><strong>${Math.round(plan.efficiency*100)}%</strong></div>
    </div>
    <div class="cs-process-grid">${plan.processes.map((process,index)=>`<article class="cs-process-card ${process.shortfall?'is-limited':''}"><span class="cs-process-step">${index+1}</span><div><h4>${escapeHtml(process.label)}</h4><strong>Debe procesar ${process.plannedUnits.toLocaleString('es-PE')} unidades</strong><p>Capacidad máxima: ${process.cycleCapacity.toLocaleString('es-PE')} u./ciclo · ${process.dailyCapacity.toLocaleString('es-PE')} u./día</p><small>${process.staff} trabajador(es) · ${process.machines} equipo(s) emparejados · personal ${reviewMoney(process.payroll)}</small></div></article>`).join('')}</div>
    <div class="cs-material-table" role="table" aria-label="Conversión y uso de insumos">
      <div class="cs-material-head" role="row"><span>Insumo</span><span>Disponible por compras</span><span>Necesario para la meta</span><span>Uso en producción posible</span><span>Saldo</span></div>
      ${plan.materials.map(material=>`<div class="cs-material-row ${material.shortfall?'is-limited':''}" role="row"><strong>${escapeHtml(material.label)}</strong><span>${material.available.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</span><span>${material.neededForTarget.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</span><span>${material.consumption.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</span><span>${material.remaining.toLocaleString('es-PE')} ${escapeHtml(material.unit)}${material.shortfall?`<small>Faltan ${material.shortfall.toLocaleString('es-PE')}</small>`:''}</span></div>`).join('')}
    </div>
    <div class="cs-production-costs">
      <div><span>Materia prima comprada</span><strong>${reviewMoney(materialCost)}</strong></div>
      <div><span>Personal directo</span><strong>${reviewMoney(laborCost)}</strong></div>
      <div><span>Soporte productivo</span><strong>${reviewMoney(supportCost)}</strong></div>
      <div><span>Inversión en planta</span><strong>${reviewMoney(investmentCost)}</strong><small>Se muestra aparte del costo operativo.</small></div>
      <div class="cs-unit-cost"><span>Costo operativo por unidad posible</span><strong>${plan.producibleUnits?reviewMoney(unitCost):'No calculable'}</strong><small>${reviewMoney(cycleProductionCost)} / ${plan.producibleUnits.toLocaleString('es-PE')} unidades posibles.</small></div>
    </div>
    <p class="cs-production-method">Base del Excel: 30 días por ciclo, 90% de eficiencia base, +1 punto porcentual por trabajador de nivel 3 y +4 puntos con jefatura. Modelo seleccionado: ${escapeHtml(plan.moldLabel)}.</p>
  </section>`;
}
function sectionSummaryHtml(section,{history=false,compact=false}={}){
  const hasSelection=section.items.some(i=>i.rows?.some(r=>r.outflow||r.income||Number(r.quantity)>0));
  return `<details class="cs-section cs-status-${section.submitted?'sent':section.status||'pending'}" data-summary-section="${section.cat}" ${!compact||hasSelection?'open':''}>
    <summary><img src="${escapeHtml(categoryByCat(section.cat)?.icon||'')}" alt=""><span class="cs-section-name"><b>${escapeHtml(section.title)}</b><small>${escapeHtml(summaryDate(section))}</small></span><span class="cs-badge">${summaryStatus(section)}</span><span class="cs-section-total">${reviewMoney(section.outflow)}<small>desembolso del ciclo</small></span></summary>
    <div class="cs-section-body">${!history&&!section.submitted?`<button type="button" class="cs-link" data-summary-goto="${section.cat}">Revisar ${escapeHtml(section.title)}</button>`:''}
    <div class="cs-items">${section.items.map(item=>`<article class="cs-item" data-summary-item="${item.id}"><h4>${escapeHtml(item.name)}</h4>${item.rows.length?item.rows.map(row=>`<div class="cs-detail-row"><div><strong>${escapeHtml(row.label)}${row.quantity!==null?` <span class="cs-quantity">\u00d7 ${escapeHtml(row.quantity)}</span>`:''}</strong>${row.detail?`<p>${escapeHtml(row.detail)}</p>`:''}${row.unitCost>0?`<small>Referencia por unidad: ${reviewMoney(row.unitCost)}</small>`:''}</div><div class="cs-row-money">${row.outflow?reviewMoney(row.outflow):row.income?`+ ${reviewMoney(row.income)}`:'Sin desembolso'}</div></div>`).join(''):`<p class="cs-empty-item">${escapeHtml(item.note)}</p>`}</article>`).join('')}</div>
    <div class="cs-section-footer"><span>Desembolso: <b>${reviewMoney(section.outflow)}</b></span>${section.financing?`<span>Financiamiento: <b>+ ${reviewMoney(section.financing)}</b></span>`:''}${section.assetIncome?`<span>Liquidaci\u00f3n: <b>+ ${reviewMoney(section.assetIncome)}</b></span>`:''}</div></div></details>`;
}
function noticesHtml(problems,warnings){
  return `${problems.length?`<div class="cs-notice cs-notice-error"><h3>Antes de enviar, completa lo siguiente</h3>${problems.map(p=>`<p>${escapeHtml(p.text)} <button class="cs-link" type="button" data-summary-goto="${p.cat}">Ir a ${escapeHtml(categoryByCat(p.cat)?.short||'la secci\u00f3n')}</button></p>`).join('')}</div>`:''}
    ${warnings.length?`<details class="cs-notice cs-notice-warning"><summary>${warnings.length} advertencia(s) de operaci\u00f3n \u00b7 no bloquean el env\u00edo</summary>${warnings.map(w=>`<p>${escapeHtml(w.text)}</p>`).join('')}</details>`:''}`;
}
function navigateFromSummary(cat){
  closeCompanyReview();persistCurrentDraftOnly();currentCategory=cat;renderTabs();renderDecisionCategory();
  $('decisionMenu').scrollTop=0;
}
function bindSummaryLinks(root){root.querySelectorAll('[data-summary-goto]').forEach(b=>b.addEventListener('click',()=>navigateFromSummary(b.dataset.summaryGoto)));}
function renderCompanySummary(){
  const mount=$('companySummaryMount');if(!mount)return;
  const owner=storageKey();if(summaryOwner!==owner){summaryOwner=owner;companySummaryRound='current';companySummaryFilter='all';}
  migrateCurrentReceipts();
  const history=companySummaryRound!=='current'&&Number(companySummaryRound)!==currentRound(),review=liveCompanyReview();
  const old=history?readReviewReceipts(Number(companySummaryRound)):null;
  let sections=history?decisionCategories().map(c=>old[c.cat]).filter(Boolean):review.sections;
  if(companySummaryFilter==='sent')sections=sections.filter(s=>s.submitted);
  const sent=(history?decisionCategories().map(category=>old[category.cat]).filter(Boolean):review.sections).filter(s=>s.submitted).length;
  const rounds=receiptRounds().filter(r=>r!==currentRound());
  const heading=history?`Decisiones enviadas \u00b7 ciclo ${companySummaryRound}`:'Resumen de decisiones de tu empresa';
  mount.innerHTML=`<section class="company-summary" aria-labelledby="companySummaryTitle"><header class="cs-heading"><div><span class="cs-kicker">EMPRESA \u00b7 CICLO ${history?companySummaryRound:currentRound()}</span><h2 id="companySummaryTitle">${heading}</h2><p>Decisiones, proceso productivo, compras, costos y financiamiento en un solo lugar.</p></div><span class="cs-progress">${sent} / ${decisionCategories().length}<small>apartados enviados</small></span></header>
    <div class="cs-toolbar"><div class="cs-filters" role="group" aria-label="Filtrar decisiones"><button type="button" data-summary-filter="all" aria-pressed="${companySummaryFilter==='all'}">Todas las decisiones</button><button type="button" data-summary-filter="sent" aria-pressed="${companySummaryFilter==='sent'}">Solo enviadas</button></div><label>Ciclo <select id="companySummaryCycle"><option value="current">Actual \u00b7 ciclo ${currentRound()}</option>${rounds.map(r=>`<option value="${r}" ${history&&Number(companySummaryRound)===r?'selected':''}>Ciclo ${r} \u00b7 historial enviado</option>`).join('')}</select></label></div>
    ${!history?'<p class="cs-financial-scope">Vista financiera del ciclo completo: decisiones enviadas y borradores. El filtro inferior corresponde al detalle.</p>':''}
    ${history?'<p class="cs-local-note">Historial de env\u00edos guardados: las cantidades y costos permanecen como se confirmaron. No se recalcula la caja actual de un ciclo anterior.</p>':financialCardsHtml(review.financial)+productionSummaryHtml(review)+futureHtml(review.financial)}
    <p class="cs-local-note">Las etiquetas ENVIADA corresponden a confirmaciones guardadas en este navegador. No son un acuse de recibo de Supabase. Los borradores no se presentan como enviados.</p>
    ${!history?`<div class="cs-status-strip">${review.sections.map(s=>`<span class="cs-mini-${s.submitted?'sent':'pending'}">${escapeHtml(s.title)}: ${s.submitted?'enviada':'pendiente de env\u00edo'}</span>`).join('')}</div>`:''}
    <div class="cs-sections">${sections.length?sections.map(s=>sectionSummaryHtml(s,{history})).join(''):'<div class="cs-empty"><h3>A\u00fan no hay decisiones enviadas</h3><p>Guardar borrador no confirma una decisi\u00f3n. Usa ENVIAR DECISI\u00d3N en cada apartado o revisa el env\u00edo completo.</p></div>'}</div>
    ${!history?`<footer class="cs-main-actions"><span>${decisionsSubmitted()?'Ciclo completo confirmado. Este resumen sigue disponible para consulta.':'Revisa lo elegido y los apartados pendientes antes de confirmar.'}</span><button id="companyReviewAll" type="button" class="cs-primary">${decisionsSubmitted()?'VER REVISI\u00d3N DEL CICLO':'REVISAR Y ENVIAR TODO'}</button></footer>`:''}
  </section>`;
  mount.querySelectorAll('[data-summary-filter]').forEach(b=>b.addEventListener('click',()=>{companySummaryFilter=b.dataset.summaryFilter;renderCompanySummary();}));
  mount.querySelector('#companySummaryCycle').addEventListener('change',e=>{companySummaryRound=e.target.value;renderCompanySummary();});
  mount.querySelector('#companyReviewAll')?.addEventListener('click',openCompanyReview);bindSummaryLinks(mount);
  if($('companySummaryJump'))$('companySummaryJump').onclick=()=>{
    const stage=$('decisionMenu'),head=$('decisionStickyHead');
    stage.scrollTop+=mount.getBoundingClientRect().top-head.getBoundingClientRect().bottom-12;
    requestAnimationFrame(()=>{stage.scrollTop+=mount.getBoundingClientRect().top-head.getBoundingClientRect().bottom-12;});
  };
}
function ensureReviewDialog(){
  let dialog=$('companyReviewDialog');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='companyReviewDialog';dialog.className='cs-review-dialog';dialog.setAttribute('aria-labelledby','companyReviewTitle');
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{activeReview=null;});
  dialog.addEventListener('cancel',()=>{activeReview=null;});
  return dialog;
}
function paintReviewDialog(message=''){
  const dialog=ensureReviewDialog(),review=liveCompanyReview(),problems=decisionsSubmitted()?[]:reviewProblems(review),complete=decisionsSubmitted();
  activeReview={fingerprint:reviewFingerprint(),round:currentRound()};
  dialog.innerHTML=`<div class="cs-dialog-frame"><header class="cs-dialog-heading"><div><span class="cs-kicker">EMPRESA \u00b7 CICLO ${currentRound()}</span><h2 id="companyReviewTitle">${complete?'Decisiones del ciclo confirmado':'Revisi\u00f3n final antes de enviar'}</h2><p id="companyReviewDescription">${complete?'Consulta las decisiones confirmadas en este equipo.':'Revisar no guarda, no cobra y no bloquea. Solo el bot\u00f3n de confirmaci\u00f3n env\u00eda el ciclo.'}</p></div><button type="button" id="closeCompanyReview" class="cs-close" aria-label="Cerrar revisi\u00f3n">\u00d7</button></header>
    <div class="cs-dialog-body" tabindex="0">${message?`<p class="cs-notice cs-notice-warning" role="status">${escapeHtml(message)}</p>`:''}${financialCardsHtml(review.financial)}${productionSummaryHtml(review)}${futureHtml(review.financial)}${noticesHtml(problems,review.warnings)}
    <div class="cs-sections">${review.sections.map(s=>sectionSummaryHtml(s,{compact:true,history:complete})).join('')}</div><p class="cs-local-note">Confirmaci\u00f3n local: este proyecto no implementa a\u00fan un acuse de recepci\u00f3n del servidor para estas decisiones.</p></div>
    <footer class="cs-dialog-footer"><p>${complete?'Las decisiones no se vuelven a cobrar.':problems.length?`${problems.length} punto(s) por resolver antes de confirmar.`:'Se bloquear\u00e1n los apartados pendientes hasta el pr\u00f3ximo ciclo. Las advertencias no impiden continuar.'}</p><div><button type="button" id="cancelCompanyReview" class="cs-secondary">${complete?'CERRAR':'VOLVER A EDITAR'}</button>${!complete?`<button type="button" id="confirmCompanyReview" class="cs-primary" ${problems.length?'disabled':''}>CONFIRMAR Y ENVIAR TODO</button>`:''}</div></footer></div>`;
  dialog.querySelector('#closeCompanyReview').addEventListener('click',closeCompanyReview);dialog.querySelector('#cancelCompanyReview').addEventListener('click',closeCompanyReview);
  dialog.querySelector('#confirmCompanyReview')?.addEventListener('click',()=>{
    if(!activeReview||activeReview.round!==currentRound()){closeCompanyReview();toast('El ciclo ha cambiado. Revisa las decisiones del nuevo ciclo.');return;}
    if(activeReview.fingerprint!==reviewFingerprint()){paintReviewDialog('Los datos cambiaron mientras revisabas. Verifica los valores actualizados y confirma nuevamente.');return;}
    commitReviewedSections(decisionCategories().map(c=>c.cat),true);
  });
  bindSummaryLinks(dialog);
}
function openCompanyReview(){
  // Working drafts are already persisted by the existing input handlers. This
  // read-only path does not call saveCurrentSection or mark anything submitted.
  migrateCurrentReceipts();paintReviewDialog();const dialog=ensureReviewDialog();if(!dialog.open)dialog.showModal();
}
function closeCompanyReview(){const dialog=$('companyReviewDialog');if(dialog?.open)dialog.close();activeReview=null;}
window.addEventListener('storage',event=>{
  if(!playerIsDeciding)return;
  if([decisionKey(),ledgerKey(),'SIDE_ACTIVE_ROUND',receiptKey()].includes(event.key)){
    closeCompanyReview();loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory();
  }
});
