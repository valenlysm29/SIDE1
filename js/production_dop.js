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
  const UNDEFINED='No definido en el Excel';
  const number=value=>value===null||value===undefined||!Number.isFinite(Number(value))?UNDEFINED:Number(value).toLocaleString('es-PE',{maximumFractionDigits:4});
  const quantity=(value,unit='')=>number(value)===UNDEFINED?UNDEFINED:number(value)+(unit?' '+escape(unit):'');
  const money=value=>value===null||value===undefined||!Number.isFinite(Number(value))?UNDEFINED:'S/ '+Number(value).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  function render(plan,{round,producedPercent=null}={}){
    const requirements=plan.requirements||{
      target:plan.target,
      materials:(plan.materials||[]).map(row=>({...row,needs:row.neededForTarget})),
      processes:(plan.processes||[]).map(row=>({id:row.id,label:row.label,units:plan.target,workersNeeded:null,machinesNeeded:null,laborDays:null,calendarDays:plan.days,monthlyPayroll:null,unitWorkCost:null})),
      costs:{items:[],total:null,knownSubtotal:null,unresolved:[]},unresolved:[]
    };
    const comparison=plan.comparison||{items:(plan.materials||[]).map(row=>({...row,needs:row.neededForTarget,missing:row.shortfall,surplus:null,costToCover:null}))};
    const material=id=>requirements.materials?.find(entry=>entry.id===id);
    const process=id=>requirements.processes?.find(entry=>entry.id===id)||{id,units:requirements.target};
    const lines=(plan.productLines||[]).filter(line=>line.target>0);
    const mix=lines.map(line=>`${escape(line.label)}: ${number(line.target)} u.`).join(' · ');
    const field=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
    const processFields=row=>`<dl class="pd-process-requirements">${field('Personal requerido',quantity(row.workersNeeded,'personas'))}${field('Equipos requeridos',quantity(row.machinesNeeded,'equipos'))}${field('Trabajo requerido',quantity(row.laborDays,'jornadas'))}${field('Días productivos por ciclo',quantity(row.calendarDays,'días'))}${field('Planilla necesaria',money(row.monthlyPayroll))}${field('Costo de trabajo por unidad',money(row.unitWorkCost))}</dl>${row.unresolved?.length?`<p class="pd-unresolved">${row.unresolved.map(escape).join(' ')}</p>`:''}`;
    const source=(id,title,label,materialId)=>`<article class="pd-node pd-source pd-${id}" data-pd-node="${id}"><span class="pd-eyebrow">${title}</span><h4>${label}</h4><strong class="pd-value">${quantity(material(materialId)?.needs,material(materialId)?.unit)}</strong><span class="pd-state">Requerido para tu meta</span><p>La cantidad deseada determina este requerimiento. Revisa tus compras al final.</p></article>`;
    const step=(id,type,index,name,value,detail)=>`<article class="pd-node pd-${id}" data-pd-node="${id}"><div class="pd-node-title"><i class="pd-symbol pd-${type}" aria-label="${{operation:'Operación',inspection:'Inspección',combined:'Combinada'}[type]} ${index}"><span>${index}</span></i><h4>${name}</h4></div><strong class="pd-value">${value}</strong><span class="pd-state">Requerimiento de tu meta</span>${detail}</article>`;
    const cut=process('cut'),assembly=process('assembly'),finish=process('finish');
    const coverCost=row=>row.costToCover!==null&&row.costToCover!==undefined?money(row.costToCover):(row.costToCoverOptions?.length?row.costToCoverOptions.map(option=>`<span class="pd-cover-option">${escape(option.label)}: ${money(option.amount)}</span>`).join(''):UNDEFINED);
    const costs=requirements.costs||{items:[],total:null,knownSubtotal:null,unresolved:[]};
    const unresolved=requirements.unresolved||[];
    return `<section class="production-dop pd-panel pd-target-first" aria-labelledby="productionDopTitle" data-production-target="${requirements.target}" data-production-possible="${plan.producibleUnits}">
      <header class="pd-heading"><div><span class="pd-eyebrow">DOP · Diagrama de operaciones del proceso</span><h3 id="productionDopTitle">Qué necesitas para producir tu meta</h3><p>Área productiva única · Ciclo ${round}. Tu cantidad deseada es el punto de partida; los recursos disponibles se comparan al final.</p></div><div class="pd-legend" aria-label="Leyenda de actividades">${[['operation','Operación'],['inspection','Inspección'],['combined','Combinada']].map(([type,label])=>`<span><i class="pd-symbol pd-${type}" aria-hidden="true"></i>${label}</span>`).join('')}</div></header>
      <div class="pd-plan"><div><h4>Plan de producción deseado</h4><p>${mix||'Aún no hay producción para mostrar. Define una meta en la calculadora.'}</p></div><div><span class="pd-eyebrow">Cantidad deseada</span><strong data-pd-desired>${quantity(requirements.target,'u.')}</strong></div></div>
      <div class="pd-graph" data-pd-graph>
        <svg class="pd-connectors" data-pd-connectors aria-hidden="true" focusable="false"></svg>
        ${source('leather','Materia prima principal','Cuero necesario','CUERO')}
        ${step('cut','operation',1,'Corte de piezas',quantity(cut.units,'juegos por cortar'),processFields(cut))}
        ${source('accessories','Materia prima secundaria','Accesorios necesarios','ACCESORIOS')}
        ${step('classification','inspection',1,'Clasificación',quantity(material('ACCESORIOS')?.needs,'accesorios por revisar'),'<p>Selección y conteo de los accesorios que requiere la meta.</p>')}
        ${step('preparation','operation',2,'Preparación',quantity(material('ACCESORIOS')?.needs,'accesorios por preparar'),'<p>Preparación de las piezas para su ensamblado.</p>')}
        ${step('assembly','combined',1,'Ensamblado y colocación de accesorios',quantity(assembly.units,'bolsos por ensamblar'),`<p>Hilo necesario: <b>${quantity(material('HILO')?.needs,material('HILO')?.unit)}</b></p>${processFields(assembly)}`)}
        ${step('finish','combined',2,'Acabado final',quantity(finish.units,'bolsos por acabar'),processFields(finish))}
        <section class="pd-result pd-node" data-pd-node="result" aria-label="Meta del plan de producción"><div class="pd-target-result"><span class="pd-eyebrow">Meta que organiza tu plan</span><strong>${quantity(requirements.target,'bolsos')}</strong><p>Los requerimientos del diagrama conservan esta meta aunque todavía no tengas materiales, equipos o personal.</p></div></section>
      </div>
      <section class="pd-requirements-table"><h4>Insumos para la cantidad deseada</h4><div class="pd-table-scroll" tabindex="0" role="region" aria-label="Requerimientos de materiales"><table><thead><tr><th>Insumo</th><th>Necesitas</th><th>Referencia del Excel</th></tr></thead><tbody>${(requirements.materials||[]).map(row=>`<tr data-pd-required-material="${escape(row.id)}"><th>${escape(row.label||row.id)}</th><td>${quantity(row.needs,row.unit)}</td><td>${escape(row.excelSource||UNDEFINED)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="pd-target-costs"><h4>Costo de realizar tu meta</h4><p>Se muestran los importes definidos por el modelo. Un dato pendiente no equivale a cero.</p><div class="pd-table-scroll" tabindex="0" role="region" aria-label="Costos de la meta"><table><thead><tr><th>Concepto</th><th>Importe para tu meta</th><th>Referencia del Excel</th></tr></thead><tbody>${(costs.items||[]).map(row=>`<tr><th>${escape(row.label||row.id)}</th><td>${money(row.amount)}</td><td>${escape(row.excelSource||UNDEFINED)}</td></tr>`).join('')}</tbody></table></div><details class="pd-material-scenarios" open><summary>Escenarios de costo por insumo y calidad</summary><p class="pd-excel-note">Referencias teóricas de la hoja para la cantidad deseada. No son una cotización, una compra ni un cobro. La calidad se elige en tus decisiones; el total queda pendiente mientras no esté definida.</p><div class="pd-table-scroll" tabindex="0" role="region" aria-label="Escenarios de costo de materiales"><table><thead><tr><th>Insumo</th><th>Calidad</th><th>Cantidad de la meta</th><th>Precio de referencia</th><th>Costo teórico del Excel</th><th>Fuente</th></tr></thead><tbody>${(requirements.materials||[]).flatMap(row=>(row.options||[]).map(option=>`<tr><th>${escape(row.label||row.id)}</th><td>${escape(option.label||option.id)}</td><td>${quantity(option.quantity,option.unit||row.unit)}</td><td>${money(option.unitPrice)}</td><td>${money(option.amount)}</td><td>${escape(option.excelSource||row.excelSource||UNDEFINED)}</td></tr>`)).join('')}</tbody></table></div></details><dl class="pd-cost-total">${field('Subtotal de importes definidos',money(costs.knownSubtotal))}${field('Costo total de la meta',money(costs.total))}</dl>${costs.unresolved?.length?`<p class="pd-unresolved">${costs.unresolved.map(escape).join(' ')}</p>`:''}</section>
      ${unresolved.length?`<details class="pd-unresolved-details"><summary>Datos del Excel que faltan para completar el plan</summary><ul>${unresolved.map(value=>`<li>${escape(typeof value==='string'?value:value.message||value.label||UNDEFINED)}</li>`).join('')}</ul></details>`:''}
      <footer class="pd-footer"><table><caption>Actividades del proceso</caption><thead><tr><th>Actividad</th><th>Cantidad</th></tr></thead><tbody><tr><td>Operaciones</td><td>2</td></tr><tr><td>Inspecciones</td><td>1</td></tr><tr><td>Combinadas</td><td>2</td></tr><tr><th>Total</th><th>5</th></tr></tbody></table><p class="pd-excel-note">Los datos de personal, maquinaria, trabajo o costo que el Excel no define se señalan expresamente. Las compras y contrataciones se eligen en sus apartados.</p></footer>
      <section class="pd-comparison" aria-labelledby="pdComparisonTitle"><h4 id="pdComparisonTitle">Ahora compara con lo que tienes</h4><p>Esta comparación no cambia tu meta ni realiza compras.</p><div class="pd-table-scroll" tabindex="0" role="region" aria-label="Comparación entre requerimientos y recursos disponibles"><table><thead><tr><th>Recurso</th><th>Necesitas</th><th>Tienes</th><th>Falta</th><th>Sobra</th><th>Costo para completar</th></tr></thead><tbody>${(comparison.items||[]).map(row=>`<tr data-pd-comparison="${escape(row.id)}"><th>${escape(row.label||row.id)}</th><td>${quantity(row.needs,row.unit)}</td><td>${quantity(row.available,row.unit)}</td><td>${quantity(row.missing,row.unit)}</td><td>${quantity(row.surplus,row.unit)}</td><td>${coverCost(row)}</td></tr>`).join('')}</tbody></table></div><div class="pd-metrics"><div><span>Tu meta</span><strong>${quantity(requirements.target,'unidades')}</strong></div><div><span>Posible con tus recursos actuales</span><strong data-pd-feasible>${quantity(comparison.producibleUnits??plan.producibleUnits,'unidades')}</strong></div><div><span>Costo de personal y materiales elegidos</span><strong>${money(comparison.currentCost)}</strong>${comparison.currentCostScope?`<small>${escape(comparison.currentCostScope)}</small>`:''}</div><div><span>Costo para completar recursos</span><strong>${money(comparison.costToCoverTotal)}</strong></div>${producedPercent!==null&&producedPercent!==undefined?`<div><span>Cobertura actual de la meta</span><strong>${number(producedPercent)}%</strong></div>`:''}</div><p class="pd-excel-note">La producción posible es una comparación de tus decisiones actuales, no la cantidad que debes elegir ni un resultado de ventas.</p></section>
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
