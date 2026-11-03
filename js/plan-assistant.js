(function(root){
  'use strict';
  let recommendationKey,recommendation;
  let host,panel,toggle,read,navigate,identity;
  const nodes={};
  const number=value=>Number.isFinite(value)?value.toLocaleString('es-PE',{maximumFractionDigits:4}):'Por calcular';
  function text(key,value){if(nodes[key].textContent!==value)nodes[key].textContent=value;}
  function close(focus=false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});}
  function mount(){
    if(host)return;
    host=document.createElement('aside');host.className='plan-assistant';host.hidden=true;
    host.innerHTML=`<section id="myPlanPanel" class="plan-assistant-panel" aria-labelledby="myPlanTitle" hidden>
      <header><h2 id="myPlanTitle" data-plan="title">Mi plan</h2><button type="button" data-close aria-label="Cerrar Mi Plan">×</button></header>
      <strong class="plan-assistant-target" data-plan="target"></strong>
      <h3 data-plan="heading">Te falta:</h3>
      <dl class="plan-assistant-resources">${['CUERO','HILO','ACCESORIOS','workers','machines','molds'].map((id,i)=>`<div data-resource="${id}"><dt>${['Cuero','Hilo','Accesorios','Operarios','Equipos','Moldes'][i]}</dt><dd data-plan="${id}">Por calcular</dd></div>`).join('')}</dl>
      <p class="plan-assistant-status" data-plan="status"></p><p class="plan-assistant-note" data-plan="hint">Revisa Infraestructura y Logística.</p>
      <button type="button" class="plan-assistant-go" data-go>Ir a Planificación</button>
    </section><button type="button" class="plan-assistant-toggle" title="Consultar mi plan" aria-label="Consultar mi plan" aria-controls="myPlanPanel" aria-expanded="false"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5"/></svg></button>`;
    document.getElementById('decisionMenu').append(host);
    panel=host.querySelector('section');toggle=host.querySelector('.plan-assistant-toggle');
    host.querySelectorAll('[data-plan]').forEach(node=>nodes[node.dataset.plan]=node);
    toggle.addEventListener('click',()=>{if(!panel.hidden){close();return;}panel.hidden=false;toggle.setAttribute('aria-expanded','true');refresh();});
    host.querySelector('[data-close]').addEventListener('click',()=>close(true));
    host.querySelector('[data-go]').addEventListener('click',()=>{close();navigate();});
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!host.hidden&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();close(true);}},{capture:true});
    window.addEventListener('pagehide',()=>close());
  }
  function refresh(){
    if(!read)return;mount();
    const snapshot=read(false);host.hidden=!snapshot.visible;
    const notice=document.querySelector('.cycle-pause-notice.is-visible');
    host.style.setProperty('--plan-bottom',notice?`${Math.ceil(notice.getBoundingClientRect().height)+40}px`:'20px');
    if(identity!==snapshot.identity||host.hidden){close();identity=snapshot.identity;}
    if(host.hidden||panel.hidden)return;
    let data=null;try{data=read(true);}catch{ /* Unknown data stays explicit. */ }
    const plan=data?.plan,context=data?.context;
    const lines=plan?.productLines?.filter(line=>line.target>0)||[];
    const names={molde_1:'básicos',molde_2:'estándar',molde_3:'prémium'};
    text('target',!plan?'Meta: Por calcular':!plan.target?'Define tu meta de producción':lines.length===1?`Meta: ${number(plan.target)} bolsos ${names[lines[0].id]||''}`:`Meta: ${number(plan.target)} bolsos (${lines.map(line=>`${number(line.target)} ${names[line.id]||''}`).join(', ')})`);
    // Let the existing engine select additional resources using actual installed levels/pairing.
    if(plan&&context){
      const key=JSON.stringify([snapshot.identity,context]);
      if(key!==recommendationKey){
        recommendation=null;
        try{recommendation=root.SIDE_PRODUCTION_MODEL.recommendResources(context,plan);recommendationKey=key;}catch{recommendationKey=null;}
      }
    }else{recommendation=null;recommendationKey=null;}
    const additions=recommendation?.complete?recommendation.additions:null;
    const values={workers:additions?additions.reduce((sum,row)=>sum+(row.worker?row.quantity:0),0):undefined,machines:additions?additions.reduce((sum,row)=>sum+(row.machine?row.quantity:0),0):undefined,
      molds:plan?.unavailablePlannedMolds?.length};
    for(const id of ['CUERO','HILO','ACCESORIOS'])values[id]=plan?.materials?.find(row=>row.id===id)?.shortfall;
    let pending=0;
    for(const id of ['CUERO','HILO','ACCESORIOS','workers','machines','molds']){
      const value=values[id],show=(!plan||plan.target>0)&&(!Number.isFinite(value)||value>0);
      nodes[id].parentElement.hidden=!show;if(show)pending++;
      const unit={CUERO:'m²',HILO:'m',ACCESORIOS:'u.'}[id];
      text(id,number(value)+(Number.isFinite(value)&&unit?` ${unit}`:''));
    }
    nodes.heading.hidden=!pending;
    text('status',plan?.target>0&&!pending?'✓ Tienes los recursos necesarios para tu plan.':'');
    nodes.status.hidden=!nodes.status.textContent;
    nodes.hint.hidden=!pending&&!snapshot.provisional;
    text('hint',!plan?'Recursos por verificar.':pending?`Revisa Infraestructura y Logística.${snapshot.provisional?' Incluye decisiones sin confirmar.':''}`:snapshot.provisional?'Incluye decisiones sin confirmar.':'');

  }
  root.SIDE_PLAN_ASSISTANT={connect(options){read=options.read;navigate=options.navigate;refresh();},refresh};
})(window);
