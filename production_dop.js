/* Presentation-only DOP: existing cycle data in, markup and measured SVG paths out. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SIDE_PRODUCTION_DOP=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EDGES=Object.freeze([
    ['leather','cut'],['accessories','classification'],['classification','preparation'],
    ['cut','assembly'],['preparation','assembly'],['assembly','finish'],['finish','result']
  ].map(edge=>Object.freeze(edge)));
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const number=value=>Number(value||0).toLocaleString('es-PE');
  function render(plan,{round,producedPercent}){
    const material=id=>plan.materials.find(entry=>entry.id===id);
    const selection=id=>material(id)?.selections?.map(entry=>entry.label).join(' + ')||'Sin compra registrada';
    const process=id=>plan.processes.find(entry=>entry.id===id)||{staff:0,machines:0,cycleCapacity:0};
    const state=plan.target?'Plan del ciclo':'Sin meta definida';
    const source=(id,title,label,materialId)=>`<article class="pd-node pd-source pd-${id}" data-pd-node="${id}"><span class="pd-eyebrow">${title}</span><h4>${label}</h4><strong class="pd-value">${number(material(materialId)?.available)} ${escape(material(materialId)?.unit||'')}</strong><span class="pd-state">${material(materialId)?.selections?.length?'Compra registrada':'Sin compra registrada'}</span><p>${escape(selection(materialId))}</p></article>`;
    const step=(id,type,index,name,value,detail)=>`<article class="pd-node pd-${id}" data-pd-node="${id}"><div class="pd-node-title"><i class="pd-symbol pd-${type}" aria-label="${{operation:'Operación',inspection:'Inspección',combined:'Combinada'}[type]} ${index}"><span>${index}</span></i><h4>${name}</h4></div><strong class="pd-value">${value}</strong><span class="pd-state">${state}</span><p>${detail}</p></article>`;
    const cut=process('cut'),assembly=process('assembly'),finish=process('finish');
    const lines=plan.productLines.filter(line=>line.target>0);
    const mix=lines.map(line=>`${escape(line.label)}: ${number(line.target)} u.`).join(' · ');
    return `<section class="production-dop pd-panel" aria-labelledby="productionDopTitle">
      <header class="pd-heading"><div><span class="pd-eyebrow">DOP · DIAGRAMA DE OPERACIONES DEL PROCESO</span><h3 id="productionDopTitle">Elaboración mensual de bolsos</h3><p>Área productiva única · Ciclo ${round}. Numeración independiente por tipo de actividad.</p></div><div class="pd-legend" aria-label="Leyenda de actividades">${[['operation','Operación'],['inspection','Inspección'],['combined','Combinada']].map(([type,label])=>`<span><i class="pd-symbol pd-${type}" aria-hidden="true"></i>${label}</span>`).join('')}</div></header>
      <div class="pd-plan"><div><h4>DOP consolidado de producción</h4><p>${mix||'Aún no hay producción para mostrar. Define una meta en la calculadora.'}</p></div><div><span class="pd-eyebrow">PRODUCCIÓN TOTAL DESEADA</span><strong>${number(plan.target)} u.</strong></div></div>
      <div class="pd-graph" data-pd-graph>
        <svg class="pd-connectors" data-pd-connectors aria-hidden="true" focusable="false"></svg>
        ${source('leather','MATERIA PRIMA PRINCIPAL','Cuero','CUERO')}
        ${step('cut','operation',1,'Corte de piezas',`${number(plan.producibleUnits)} juegos cortados`,`${cut.staff} operario(s) · ${cut.machines} mesa(s) · ${number(cut.cycleCapacity)} u./ciclo`)}
        ${source('accessories','MATERIA PRIMA SECUNDARIA','Accesorios','ACCESORIOS')}
        ${step('classification','inspection',1,'Clasificación',`${number(material('ACCESORIOS')?.available)} accesorios disponibles`,'Selección y conteo')}
        ${step('preparation','operation',2,'Preparación',`${number(material('ACCESORIOS')?.available)} accesorios disponibles`,'Accesorios para ensamblado')}
        ${step('assembly','combined',1,'Ensamblado y colocación de accesorios',`${number(plan.producibleUnits)} bolsos ensamblados`,`${assembly.staff} operario(s) · ${assembly.machines} máquina(s) · Hilo: ${escape(selection('HILO'))}`)}
        ${step('finish','combined',2,'Acabado final',`${number(plan.producibleUnits)} bolsos acabados`,`${finish.staff} operario(s) · ${finish.machines} máquina(s) · ${number(finish.cycleCapacity)} u./ciclo`)}
        <section class="pd-result pd-node" data-pd-node="result" aria-label="Resultado de producción del ciclo">
          <div class="pd-yield"><span class="pd-eyebrow">PORCENTAJE PRODUCIDO</span><strong>${producedPercent}%</strong><p>${number(plan.producibleUnits)} conformes ÷ ${number(plan.target)} deseadas</p></div>
          <div class="pd-output"><span class="pd-eyebrow">PRODUCCIÓN FINAL DEL CICLO ${round}</span><strong>${number(plan.producibleUnits)} unidades totales</strong><div class="pd-mix">${(lines.length?lines:plan.productLines).map(line=>`<span><b>${escape(line.label)}</b> ${number(line.plannedUnits)} u.</span>`).join('')}</div><p>Resultado mensual consolidado del área productiva única.</p></div>
        </section>
      </div>
      <footer class="pd-footer"><table><caption>Tabla de resumen</caption><thead><tr><th>Actividad</th><th>Cantidad</th></tr></thead><tbody><tr><td>Operaciones</td><td>2</td></tr><tr><td>Inspecciones</td><td>1</td></tr><tr><td>Combinadas</td><td>2</td></tr><tr><th>Total</th><th>5</th></tr></tbody></table><div class="pd-metrics"><div><span>EFICIENCIA DE LA LÍNEA</span><strong>${Math.round(plan.efficiency*100)}%</strong></div><div><span>PRODUCCIÓN MENSUAL</span><strong>${number(plan.producibleUnits)} unidades</strong></div><div><span>CUMPLIMIENTO DE LA META</span><strong>${producedPercent}%</strong></div></div></footer>
    </section>`;
  }
  // Points are measured from card borders in the SVG's coordinate space, never viewport constants.
  function routes(boxes,{stacked=false,rail=0}={}){
    const bottom=b=>({x:(b.left+b.right)/2,y:b.bottom});
    const top=b=>({x:(b.left+b.right)/2,y:b.top});
    const left=b=>({x:b.left,y:(b.top+b.bottom)/2});
    const right=b=>({x:b.right,y:(b.top+b.bottom)/2});
    return EDGES.flatMap(([from,to])=>{
      const a=boxes[from],b=boxes[to];if(!a||!b)return [];
      let start=bottom(a),end=top(b),d;
      if(stacked&&from==='cut'&&to==='assembly'){
        start=left(a);end=left(b);
        d=`M ${start.x} ${start.y} H ${rail} V ${end.y} H ${end.x}`;
      }else if(!stacked&&from==='preparation'&&to==='assembly'){
        start=right(a);end=left(b);
        const middle=(start.x+end.x)/2;
        d=`M ${start.x} ${start.y} H ${middle} V ${end.y} H ${end.x}`;
      }else{
        const middle=(start.y+end.y)/2;
        d=`M ${start.x} ${start.y} V ${middle} H ${end.x} V ${end.y}`;
      }
      return [{from,to,start,end,d}];
    });
  }
  function mount(container){
    const graph=container?.querySelector('[data-pd-graph]');
    if(!graph)return ()=>{};
    const svg=graph.querySelector('[data-pd-connectors]');
    let frame=0,disposed=false;
    const draw=()=>{
      frame=0;if(disposed||!graph.isConnected)return;
      const bounds=graph.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      const boxes={};
      graph.querySelectorAll('[data-pd-node]').forEach(node=>{
        const box=node.getBoundingClientRect();
        boxes[node.dataset.pdNode]={left:box.left-bounds.left,right:box.right-bounds.left,top:box.top-bounds.top,bottom:box.bottom-bounds.top};
      });
      const stacked=getComputedStyle(graph).getPropertyValue('--pd-stacked').trim()==='1';
      const rail=boxes.leather.left/2;
      svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
      svg.innerHTML=routes(boxes,{stacked,rail}).map(({from,to,d})=>`<path data-from="${from}" data-to="${to}" class="${['accessories','classification','preparation'].includes(from)?'pd-branch-path':'pd-main-path'}" d="${d}"/>`).join('');
    };
    const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(draw)};
    const observer=new ResizeObserver(schedule);
    observer.observe(graph);
    graph.querySelectorAll('[data-pd-node]').forEach(node=>observer.observe(node));
    window.addEventListener('resize',schedule);
    if(document.fonts)document.fonts.ready.then(schedule);
    schedule();
    return ()=>{disposed=true;observer.disconnect();window.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame)};
  }
  return Object.freeze({render,routes,mount,edges:EDGES});
});
