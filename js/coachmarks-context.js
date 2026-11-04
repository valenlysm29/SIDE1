(() => {
  'use strict';
  const root=document.getElementById('decisionMenu'); if(!root)return;
  const guides={
    DOP:[['.production-calculator-fields','Meta y modelo','Indica cuántos bolsos deseas producir y selecciona el molde.'],['[aria-label="Materiales necesarios por molde"]','Materiales necesarios','Consulta los insumos necesarios para alcanzar tu meta.'],['.pd-metrics','Unidades proyectadas','Revisa cuántas unidades podrías fabricar según tu capacidad.']],
    B:[['[data-item="MESA_CORTE"] .quantity-option','Maquinaria','Elige mesas de corte y máquinas de ensamble y acabado.'],['[data-item="MOLDE"] .choice-strip','Moldes','Selecciona los moldes para tus bolsos.'],['[data-item="MANTENIMIENTO"]','Mantenimiento','Considera el mantenimiento preventivo de tus equipos.'],['.decision-action-pair','Guardar y enviar','Guarda un borrador o envía la sección cuando esté lista.']],
    C:[['#decisionTabs [data-cat="DOP"]','Meta de producción','En Planificación, define las cantidades por molde según tus recursos.'],['[data-item="PERS_CORTE"] .quantity-option','Personal','Organiza el personal de corte, ensamble y acabado.']],
    F:[['[data-item="CUERO"] .quantity-option','Materiales','Gestiona la compra de cuero y los demás insumos para producir.']],
    D:[['[data-item="CANALES"]','Canales de venta','Elige los canales para vender tus productos; SIDE calcula los precios por segmento.']],
    E:[['.cash-hud','Dinero disponible','Consulta la caja disponible de tu empresa.'],['.loan-control','Financiamiento','Revisa la línea disponible y administra tu solicitud de préstamo.']],
    A:[['#companyReviewAll','Revisión final','Revisa tus decisiones antes de enviarlas; la confirmación se realiza después.']]
  };
  const help=document.createElement('button');help.type='button';help.className='context-help';help.textContent='?';help.setAttribute('aria-label','Guía de esta sección');help.title='Guía de esta sección';
  document.querySelector('#decisionStickyHead .detail-heading')?.append(help);
  const layer=document.createElement('div');layer.className='context-layer';layer.hidden=true;
  layer.innerHTML='<div class="context-spot" hidden></div><section class="context-card" role="dialog" aria-labelledby="context-title" aria-describedby="context-text" tabindex="-1"><div class="context-progress" aria-live="polite"></div><h2 id="context-title"></h2><p id="context-text"></p><div class="coach-actions"><button type="button" data-context="skip">Saltar</button><span></span><button type="button" data-context="back">Anterior</button><button type="button" data-context="next">Siguiente</button></div></section>';document.body.append(layer);
  const card=layer.querySelector('.context-card'),spot=layer.querySelector('.context-spot');let steps=[],index=0,category='',active=false,suspended=false,frame=0;
  const shown=e=>!!e&&!!e.getClientRects().length&&!e.closest('.hidden,[hidden],[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden';
  const current=()=>root.querySelector('#decisionTabs .decision-tab.active')?.dataset.cat;
  const modal=()=>[...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"],dialog[open],.coach-layer:not([hidden])')].some(e=>e!==layer&&!layer.contains(e)&&shown(e));
  const find=step=>{const el=root.querySelector(step[0]);if(!shown(el))return null;const controls=[...el.querySelectorAll('input,select,button')];if(controls.length&&controls.every(e=>e.disabled))return null;return el};
  function close(){active=false;suspended=false;layer.hidden=true;spot.hidden=true;help.focus({preventScroll:true})}
  function position(){if(!active||suspended)return;const el=find(steps[index]);if(!el){spot.hidden=true;return}const r=el.getBoundingClientRect(),v=window.visualViewport,w=v?.width||innerWidth,h=v?.height||innerHeight,p=4;
    if(r.bottom<=0||r.top>=h||r.right<=0||r.left>=w){spot.hidden=true;return}spot.hidden=false;const left=Math.max(0,r.left-p),top=Math.max(0,r.top-p),right=Math.min(w,r.right+p),bottom=Math.min(h,r.bottom+p);
    Object.assign(spot.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
    const cw=card.offsetWidth,ch=card.offsetHeight,g=12;let x=right+g,y=top;if(x+cw>w-12)x=left-cw-g;if(x<12){x=Math.max(12,Math.min(w-cw-12,left));y=bottom+g;if(y+ch>h-12)y=top-ch-g}card.style.left=Math.max(12,Math.min(w-cw-12,x))+'px';card.style.top=Math.max(12,Math.min(h-ch-12,y))+'px';
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position)}
  function render(scroll=true){const step=steps[index],el=step&&find(step);if(!el){steps.splice(index,1);if(!steps.length)return close();index=Math.min(index,steps.length-1);return render(scroll)}
    layer.querySelector('.context-progress').textContent=`${index+1} de ${steps.length}`;layer.querySelector('#context-title').textContent=step[1];layer.querySelector('#context-text').textContent=step[2];layer.querySelector('[data-context="back"]').hidden=index===0;layer.querySelector('[data-context="next"]').textContent=index===steps.length-1?'Finalizar':'Siguiente';
    if(scroll){const r=el.getBoundingClientRect(),viewport=root.querySelector('#decisionFormScroll')?.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-80||(viewport&&(r.top<viewport.top||r.bottom>viewport.bottom))){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center',inline:'nearest'})}}
    schedule();card.focus({preventScroll:true});
  }
  function open(){if(modal())return;category=current();steps=(guides[category]||[]).filter(find);if(!steps.length)return;index=0;active=true;layer.hidden=false;render()}
  help.addEventListener('click',open);layer.addEventListener('click',e=>{const action=e.target.closest('[data-context]')?.dataset.context;if(!action)return;if(action==='skip'||action==='next'&&index===steps.length-1){close()}else{index+=action==='back'?-1:1;render()}});
  document.addEventListener('keydown',e=>{if(active&&!suspended&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}},true);
  document.addEventListener('click',e=>{if(active&&e.target.closest('#decisionTabs [data-cat]'))close()},true);
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  new MutationObserver(records=>{if(records.every(r=>layer.contains(r.target)))return;if(active&&(!shown(root)||current()!==category)){close();return}if(active&&modal()){suspended=true;layer.hidden=true;return}if(active&&suspended){suspended=false;layer.hidden=false;render(false)}else if(active)schedule()}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-hidden']});
})();
