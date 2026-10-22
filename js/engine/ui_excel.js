(function(root){
  'use strict';
  const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const cat=()=>root.SIDE_EXCEL_CATALOGO;
  const cfg=()=>root.SIDE_EXCEL_CONFIG.CONFIG;
  const numero=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const format=value=>Number(value||0).toLocaleString('es-PE',{maximumFractionDigits:4});
  const money=value=>'S/ '+Number(value||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const areas={corte:'Corte',ensamble:'Ensamble',acabado:'Acabado'};
  const maquinas=['Manual','Semiindustrial','Industrial'];
  const grupoSeccion=g=>({'Inversion en RR.HH.':'A','Maquina de ensamblado':'B','Maquina de acabados':'B','Molde':'B','Canal de venta':'D','Acceso a prestamo bancario':'E'}[g]||'C');
  const grupos=()=>cfg().DECISIONES_VISIBLES.filter(g=>cat().some(o=>o.grupo===g));
  const opcionesGrupo=grupo=>cat().filter(o=>o.grupo===grupo);
  const filasFamilia=familia=>cfg().INSUMOS_POR_FAMILIA[familia].map(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]);
  const nuevoLote=()=>({segmento:'',cantidad:0,cuero:'',accesorios:'',hilo:'',molde:'',precio:0});
  const motorOverrides=version=>root.SIDE_EXCEL_CONFIG.paraMotor(version);
  function costoLaboralHtml(rol,nivel,regimen='MYPE'){
    const d=root.SIDE_EXCEL_COSTOS.costoLaboral(rol,nivel,regimen);
    return `<small>Costo mensual: ${money(d.pagoMensual)} · sueldo base: ${money(d.base)} · beneficios y ajuste de la hoja: ${money(d.pagoMensual-d.base)}.</small><small>Provisión anual: EsSalud ${money(d.essalud)}, gratificación ${money(d.gratificacion)}, CTS ${money(d.cts)}, vacaciones ${money(d.vacaciones)}. Costo según la hoja: suma anual / ${cfg().DIVISOR_MO[d.regimen]}.</small>`;
  }
  function costoActivoHtml(codigo,regimen='MYPE'){
    const d=root.SIDE_EXCEL_COSTOS.costoMaquinaria(codigo,regimen);
    return `<small>Compra: ${money(d.salidaCompra)} = precio ${money(d.adquisicion)} + instalación ${money(d.instalacion)} + capacitación ${money(d.capacitacion)}. Mantenimiento mensual: ${money(d.mantenimientoCiclo)}. Depreciación contable mensual: ${money(d.depreciacionCiclo)}.</small>`;
  }
  function nuevasDecisiones(){return {seleccion:[],garantiaDias:null,mantenimientoPreventivo:false,marketingNivel:null,analistaCompras:false,garantiaProveedor:0,tiendasPorDistrito:{los_olivos:0,miraflores:0,sjl:0},lotes:[nuevoLote()],personal:{corte:[[0,0,0],[0,0,0],[0,0,0]],ensamble:[[0,0,0],[0,0,0],[0,0,0]],acabado:[[0,0,0],[0,0,0],[0,0,0]]},jefes:0,regimen:'MYPE',publicidad:0,montoPrestamo:0,comprasUnidades:{},maquinaria:{}};}
  function normalizarNumeros(d){
    const cantidades=value=>Array.isArray(value)?value.map(cantidades):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,n])=>[key,cantidades(n)])):numero(value);
    for(const key of ['personal','comprasUnidades','maquinaria','tiendasPorDistrito'])if(d[key])d[key]=cantidades(d[key]);
    for(const key of ['montoPrestamo','publicidad','jefes','garantiaDias','garantiaProveedor'])if(d[key]!=null)d[key]=numero(d[key]);
    for(const lote of d.lotes||[]){lote.cantidad=numero(lote.cantidad);lote.precio=numero(lote.precio);}
    return d;
  }
  function prepararDecisiones(d){
    const out=normalizarNumeros(clone(d));
    // Los planes guardados antes de congelar decisiones no reactivan campos retirados.
    out.seleccion=out.seleccion.filter(k=>cfg().DECISIONES_VISIBLES.includes(root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo));
    if(cfg().GARANTIA_MAPEO_EXACTO[out.garantiaDias])out.seleccion.push(cfg().GARANTIA_MAPEO_EXACTO[out.garantiaDias]);
    const marketing=cfg().MARKETING_BASE[out.marketingNivel];out.publicidad=marketing?.costo||0;if(marketing)out.seleccion.push(marketing.codigo);
    out.jefes=out.seleccion.includes('RH-10A')?1:0;
    // Las cantidades de activos se registran aparte; seleccionar nivel puntúa,
    // pero no inventa maquinaria ni una compra que el estudiante no declaró.
    return out;
  }
  function opciones(rows,selected,empty='Elegir…'){return `<option value="">${e(empty)}</option>`+rows.map(o=>`<option value="${e(o.codigo)}" ${o.codigo===selected?'selected':''}>${e(o.opcion)}${o.grupo==='Inversion en RR.HH.'?' · '+money(o.costo)+' por ciclo':''}</option>`).join('');}
  function loteHtml(l,i,locked){
    const select=(campo,label,rows)=>`<label>${label}<select data-lote="${i}" data-campo="${campo}" ${locked?'disabled':''}>${opciones(rows,l[campo])}</select></label>`;
    return `<fieldset class="excel-lote"><legend>Lote ${i+1}</legend><div class="excel-grid">
      ${select('segmento','Segmento',cat().filter(o=>/^SEG-0[123]$/.test(o.codigo)))}
      <label>Cantidad a producir<input type="number" min="0" step="1" value="${e(l.cantidad)}" data-lote="${i}" data-campo="cantidad" ${locked?'disabled':''}></label>
      ${select('molde','Molde',cat().filter(o=>/^INF-(08|09|10)$/.test(o.codigo)))}
      <label>Precio por bolso (S/)<input type="number" min="0" step="0.01" value="${e(l.precio)}" data-lote="${i}" data-campo="precio" ${locked?'disabled':''}></label>
      ${['cuero','accesorios','hilo'].map(f=>select(f,{cuero:'Cuero',accesorios:'Accesorios',hilo:'Hilo'}[f],filasFamilia(f))).join('')}
      <button type="button" class="side-button" data-quitar-lote="${i}" ${locked?'disabled':''}>Quitar lote</button></div><div data-calidad-lote="${i}" class="excel-feedback" aria-live="polite"></div></fieldset>`;
  }
  function resumenHtml(r,{preview=false}={}){
    if(!r)return '';
    const p=r.puntajes,pro=r.produccion;
    const metricas=[['Calidad',p.calidadEmpresaMotor,p.niveles.calidad],['Eficiencia',p.puntajeEficiencia,p.niveles.eficiencia],['Reputación',r.reputacionMatriz,p.niveles.reputacion],['Salud financiera',p.saludFinanciera,p.niveles.salud]];
    return `<section class="excel-resultados"><h3>${preview?'Proyección de producción':'Resultado del ciclo'}</h3>
      <div class="excel-puntajes">${metricas.map(([label,value,nivel])=>`<div><span>${e(label)}</span><strong>${format(value)}</strong><small>${e(nivel)}</small></div>`).join('')}</div>
      <p>Planeado: <b>${format(pro.totalPlaneado)}</b> · Producción: <b>${format(pro.totalProducido)}</b> · Capacidad con eficiencia: <b>${format(pro.produccionCapacidad)}</b></p>
      <p>Cuello de botella: ${pro.cuelloBotella.map(a=>areas[a]).join(', ')} · Factor de producción: ${format(pro.factorEficienciaProduccion)} · Personal: ${format(pro.totalTrabajadores)}</p>
      <div class="excel-table-wrap"><table><caption>Producción y materia prima utilizada</caption><thead><tr><th>Lote</th><th>Planeado</th><th>Producido</th><th>Cuero m²</th><th>Accesorios u</th><th>Hilo m</th></tr></thead><tbody>${pro.lotes.map((l,i)=>`<tr><th>${i+1}</th><td>${format(l.cantidad)}</td><td>${format(l.producido)}</td><td>${format(l.consumo.cuero)}</td><td>${format(l.consumo.accesorios)}</td><td>${format(l.consumo.hilo)}</td></tr>`).join('')}</tbody></table></div>
      <p>Costos ${preview?'estimados':'del ciclo'}: <b>${money(r.financial?.estadoResultados.costos??r.costosTotales??r.costos.costosEstimados??r.costos.totalCostos)}</b>${preview?'':` · Ventas: <b>${format(r.unidadesVendidas)}</b> · Ingreso: <b>${money(r.ingresos)}</b> · Utilidad: <b>${money(r.financial?.estadoResultados.utilidad??r.utilidad)}</b>`}</p>
      ${r.financial?`<p>Caja inicial: <b>${money(r.financial.balanceCaja.cajaInicial)}</b> · Caja final: <b>${money(r.financial.balanceCaja.cajaFinal)}</b> · Intereses: <b>${money(r.financial.estadoResultados.intereses)}</b></p>`:''}
      <details><summary>Desglose de costos del ciclo</summary><ul>${(r.costos.detalles?.manoObra||[]).filter(d=>d.cantidad).map(d=>`<li>${e(d.rol)}: ${format(d.cantidad)} × ${money(d.pagoMensual)} = ${money(d.costo)}</li>`).join('')}<li>Materia prima consumida: ${money(r.costos.costoMP)}</li><li>Mantenimiento de activos y preventivo: ${money(r.costos.costoMantenimiento)}</li><li>Depreciación contable: ${money(r.costos.depreciacion)}</li><li>Marketing: ${money(r.costos.costoPublicidad)}</li><li>Analista de compras: ${money(r.costos.costoAnalistaCompras)}</li>${(r.costos.detallesRecurrentes||[]).map(d=>`<li>${e(root.SIDE_EXCEL_PUNTAJES.indice[d.codigo]?.opcion||({web:'Canal web',comisionVentas:'Comisión de ventas'}[d.codigo])||(d.distrito?'Tienda en '+cfg().DISTRITOS_TIENDAS[d.distrito]:'Decisión recurrente'))}: ${money(d.costo)}</li>`).join('')}<li>Almacenaje: ${money(r.costos.costoAlmacenaje)}</li><li>Horas extra: ${money(r.consecuencias?.efectos?.costoHorasExtra)}</li></ul></details>${preview?'<p class="excel-help">Las ventas se calculan al cierre entre las empresas del mismo segmento.</p>':''}
      <details><summary>Inventario de materia prima al cierre</summary><ul>${Object.entries(pro.inventarioFinal).map(([k,v])=>`<li>${e(root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)}: ${format(v)}</li>`).join('')}</ul></details>
      ${r.inventarioProductos?`<p>Productos sin vender: <b>${format(r.inventarioSinVender)}</b></p>`:''}
      <ul class="excel-mensajes">${r.consecuencias.mensajes.map(m=>`<li>${e(m.texto)}</li>`).join('')}</ul></section>`;
  }
  function validar(d,version){
    if(!d.lotes.length)return 'Agrega al menos un lote.';
    if(d.lotes.some(l=>!l.segmento||!l.molde||numero(l.cantidad)<1||numero(l.precio)<=0))return 'Completa segmento, molde, cantidad y precio de cada lote.';
    if(version===root.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL){
      if(Number(d.maquinaria?.mesa)!==1)return 'La producción requiere una única mesa de corte. Registra 1 mesa en Compras.';
      if(d.lotes.some(l=>numero(d.maquinaria?.[l.molde])<1))return 'Compra al menos una unidad de cada molde elegido antes de confirmar el plan.';
      const canales=root.SIDE_EXCEL_COSTOS.costosCanales(d);
      if((d.seleccion||[]).some(k=>['COM-01A','COM-01C'].includes(k))&&!canales.tiendas)return 'El canal físico requiere al menos una tienda en un distrito.';
    }
    return '';
  }
  function dopPlan(d,r){
    const pro=r.produccion,families={cuero:['CUERO','Cuero','m²'],accesorios:['ACCESORIOS','Accesorios','u.'],hilo:['HILO','Hilo','m']};
    const lots=(d.lotes||[]).map((l,index)=>({...l,index})).filter(l=>cfg().CONSUMO_MOLDE[l.molde]);
    return {target:lots.reduce((s,l)=>s+numero(l.cantidad),0),producibleUnits:pro.totalProducido,efficiency:pro.factorEficienciaProduccion,
      productLines:lots.map((l,i)=>({id:String(i),label:'Lote '+(l.index+1),target:numero(l.cantidad),plannedUnits:pro.lotes.find(p=>p.indice===l.index)?.producido||0})),
      processes:Object.entries(areas).map(([area],i)=>({id:['cut','assembly','finish'][i],staff:pro.personal[area].flat().reduce((s,n)=>s+n,0),machines:area==='corte'?numero(d.maquinaria?.mesa):Object.entries(d.maquinaria||{}).filter(([k])=>area==='ensamble'?/^INF-0[234]$/.test(k):/^INF-0[567]$/.test(k)).reduce((s,[,v])=>s+numero(v),0),cycleCapacity:pro.capacidadPorArea[area]*cfg().DIAS_CICLO})),
      materials:Object.entries(families).map(([family,[id,label,unit]])=>{const codes=cfg().INSUMOS_POR_FAMILIA[family],available=codes.reduce((s,k)=>s+numero(pro.disponibleInicial[k]),0),neededForTarget=lots.reduce((s,l)=>s+numero(l.cantidad)*cfg().CONSUMO_MOLDE[l.molde][family],0);return {id,label,unit,available,neededForTarget,shortfall:codes.reduce((sum,code)=>sum+Math.max(0,lots.filter(l=>l[family]===code).reduce((need,l)=>need+numero(l.cantidad)*cfg().CONSUMO_MOLDE[l.molde][family],0)-numero(pro.disponibleInicial[code])),0),selections:codes.filter(k=>pro.disponibleInicial[k]>0).map(k=>({label:root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion||k}))};})};
  }
  function materialRecommendationHtml(d,r){
    const needs={};for(const l of d.lotes||[]){const consumption=cfg().CONSUMO_MOLDE[l.molde];if(!consumption)continue;for(const family of ['cuero','accesorios','hilo'])if(l[family])needs[l[family]]=(needs[l[family]]||0)+numero(l.cantidad)*consumption[family];}
    const rows=Object.entries(needs).map(([code,need])=>{const available=numero(r.produccion.disponibleInicial[code]),missing=Math.max(0,need-available),conversion=cfg().CONVERSION_COMPRA[code],unit=cfg().INSUMOS_POR_FAMILIA.hilo.includes(code)?'m':cfg().INSUMOS_POR_FAMILIA.cuero.includes(code)?'m²':'u.';return `<tr><th>${e(root.SIDE_EXCEL_PUNTAJES.indice[code]?.opcion||code)}</th><td>${format(need)} ${unit}</td><td>${format(available)} ${unit}</td><td>${Math.ceil(Number((missing/conversion).toPrecision(15)))} × ${format(conversion)} ${unit}</td></tr>`;});
    return `<div class="excel-table-wrap"><table><caption>Recomendación de compra por material elegido</caption><thead><tr><th>Material</th><th>Necesario</th><th>Disponible con tus compras</th><th>Compras adicionales sugeridas</th></tr></thead><tbody>${rows.length?rows.join(''):'<tr><td colspan="4">Elige molde, cantidad y materiales del lote para calcular las compras.</td></tr>'}</tbody></table><p class="excel-help">La sugerencia descuenta el inventario inicial y las compras del borrador. Cada compra se redondea a su unidad de venta; no compra ni descuenta caja automáticamente.</p></div>`;
  }
  // A preview reserves the plan's cash without recording a movement or guessing sales.
  function proyectarPlan(d,{cash=0,historial={},round=1,motorVersion}={}){
    const overrides=motorOverrides(motorVersion),config=root.SIDE_EXCEL_CONFIG.configurar(overrides);
    const decisions=prepararDecisiones(d),prepared=root.SIDE_EXCEL_CICLO.prepararEmpresa({...decisions,ciclo:round},historial,overrides),costs=prepared.costos;
    const assets=(costs.detalles?.maquinaria||[]).reduce((sum,row)=>sum+row.salidaCompra*Math.max(0,numero(decisions.maquinaria?.[row.codigo])-numero(historial.maquinariaActivos?.[row.codigo])),0);
    const loan=numero(decisions.montoPrestamo),rate=Math.pow(1+(numero(config.TEA_BASE)+numero(historial.tasaAdicionalPP))/100,1/config.MESES_ANIO)-1;
    const priorRate=historial.tasaMensualVigente??(Math.pow(1+numero(historial.teaVigente??config.TEA_BASE)/100,1/config.MESES_ANIO)-1);
    const interest=config.PRESTAMO_COBRAR_INTERES_CICLO?(numero(historial.deudaPrincipal)*priorRate+loan*rate)*config.CICLO_EQUIVALE_A_MESES:0;
    const spending=numero(costs.costosEstimados??costs.totalCostos)-numero(costs.depreciacion)-numero(costs.valorConsumidoNeto)+numero(costs.valorCompradoNeto)+assets+interest;
    return {prepared,plan:dopPlan(decisions,prepared),spending,cashAfter:Number(cash)+loan-spending};
  }
  function mountEditor(container,context){
    if(!container)return;
    const actual=context.motorVersion===root.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,overrides=motorOverrides(context.motorVersion);
    let stored=context.getState()||{},draft=Object.assign(nuevasDecisiones(),clone(stored.decisiones||{})),enabled=actual||!!stored.habilitado;
    draft.personal=root.SIDE_EXCEL_PRODUCCION.normalizarPersonal(draft.personal);
    draft.tiendasPorDistrito={los_olivos:0,miraflores:0,sjl:0,...draft.tiendasPorDistrito};
    normalizarNumeros(draft);
    for(const [codigo,owned] of Object.entries(context.historial?.maquinariaActivos||{}))draft.maquinaria[codigo]=Math.max(numero(draft.maquinaria[codigo]),numero(owned));
    let locked=!!context.locked,confirmed=Number(stored.round)===Number(context.round)&&stored.enviado,disposeDop=()=>{};
    const local=context.local!==false;
    let remoteReady=local||context.remoteReady!==false;
    const sectioned=!!context.category;
    let renderedReason='';
    let saved=Object.assign(nuevasDecisiones(),clone(stored.decisionesGuardadas||stored.decisiones||{}));
    saved.personal=root.SIDE_EXCEL_PRODUCCION.normalizarPersonal(saved.personal);
    saved.tiendasPorDistrito={los_olivos:0,miraflores:0,sjl:0,...saved.tiendasPorDistrito};
    normalizarNumeros(saved);
    stored={...stored,decisionesGuardadas:prepararDecisiones(saved)};
    if(!Number.isFinite(Number(stored.saldoFinalGuardado))||Number(stored.round)!==Number(context.round))savedBalance();

    function savedBalance(){
      try{stored.saldoFinalGuardado=proyectarPlan(saved,context).cashAfter;}catch(_){stored.saldoFinalGuardado=Number(context.cash)||0;}
      stored.decisionesGuardadas=prepararDecisiones(saved);
    }
    function saveControl(control){
      if(control.dataset.excelGrupo!==undefined){const group=grupos()[Number(control.dataset.excelGrupo)];saved.seleccion=saved.seleccion.filter(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo!==group).concat(draft.seleccion.filter(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo===group));}
      else if(control.dataset.lote!==undefined){const i=Number(control.dataset.lote);saved.lotes[i]=saved.lotes[i]||nuevoLote();saved.lotes[i][control.dataset.campo]=draft.lotes[i][control.dataset.campo];}
      else if(control.dataset.personal){const [a,n,m]=control.dataset.personal.split(',');saved.personal[a][n][m]=draft.personal[a][n][m];}
      else if(control.dataset.compra)saved.comprasUnidades[control.dataset.compra]=draft.comprasUnidades[control.dataset.compra];
      else if(control.dataset.activo)saved.maquinaria[control.dataset.activo]=draft.maquinaria[control.dataset.activo];
      else if(control.dataset.excelTienda)saved.tiendasPorDistrito[control.dataset.excelTienda]=draft.tiendasPorDistrito[control.dataset.excelTienda];
      else for(const [attribute,key] of Object.entries({'data-excel-regimen':'regimen','data-excel-prestamo':'montoPrestamo','data-excel-marketing':'marketingNivel','data-excel-garantia':'garantiaDias','data-excel-mantenimiento':'mantenimientoPreventivo','data-excel-analista':'analistaCompras','data-excel-garantia-proveedor':'garantiaProveedor'}))if(control.hasAttribute(attribute))saved[key]=draft[key];
      // Loan eligibility and its amount are one decision.
      if(control.hasAttribute('data-excel-prestamo')||control.dataset.excelGrupo!==undefined&&grupos()[Number(control.dataset.excelGrupo)]==='Acceso a prestamo bancario'){
        saved.montoPrestamo=draft.montoPrestamo;saved.seleccion=saved.seleccion.filter(k=>!['FIN-01A','FIN-01B'].includes(k)).concat(draft.seleccion.filter(k=>['FIN-01A','FIN-01B'].includes(k)));
      }
      savedBalance();persistDraft();context.savedBalanceChanged?.();context.refreshSavedBalance?.(stored.saldoFinalGuardado);
    }
    function decorateDecisions(){
      let serial=0;
      for(const table of container.querySelectorAll('table:has([data-personal])')){
        const grid=document.createElement('div');grid.className='excel-personal-cards';
        for(const row of table.querySelectorAll('tbody tr')){
          const controls=Array.from(row.querySelectorAll('[data-personal]')).filter(control=>{const [area,,machine]=control.dataset.personal.split(',');return area!=='corte'||machine==='0';});if(!controls.length)continue;
          const [area,level]=controls[0].dataset.personal.split(','),card=document.createElement('fieldset');card.className='excel-decision-card';
          card.innerHTML=`<legend>Personal de ${e(areas[area].toLowerCase())} · Nivel ${Number(level)+1}</legend><div class="excel-decision-card__meta"><span class="excel-decision-badge">Opcional</span><span class="excel-decision-impact" data-card-impact></span></div><p class="excel-help">${money(root.SIDE_EXCEL_COSTOS.costoLaboral(area,Number(level)+1,draft.regimen).pagoMensual)} por persona y ciclo. Elige cuántas personas operan cada tipo de máquina.</p><div class="excel-personal-quantities"></div>`;
          for(const control of controls){const label=document.createElement('label');label.textContent=maquinas[Number(control.dataset.personal.split(',')[2])];label.appendChild(control);card.querySelector('.excel-personal-quantities').appendChild(label);}
          const save=document.createElement('button');save.type='button';save.className='side-button excel-decision-save';save.dataset.excelGuardarItem='';save.textContent='Guardar decisión';save.disabled=controls.every(control=>control.disabled);save._decisionControls=controls;card.appendChild(save);grid.appendChild(card);
        }
        table.parentNode.replaceChild(grid,table);
      }
      for(const control of container.querySelectorAll('select,input[type="number"],input[type="checkbox"]:not([data-excel-enable])')){
        if(control.closest('.excel-decision-card'))continue;
        const label=control.closest('label'),cell=control.closest('td');if(!label&&!cell)continue;
        if(control.dataset.excelGrupo!==undefined&&grupos()[Number(control.dataset.excelGrupo)]==='Acceso a prestamo bancario'){label.hidden=true;continue;}
        const host=label||control,card=document.createElement('fieldset');card.className='excel-decision-card';
        if(host.dataset.excelSection)card.dataset.excelSection=host.dataset.excelSection;
        let title=label?Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim():control.getAttribute('aria-label');
        if(title==='Inversion en RR.HH.')title='Capacitación del equipo';
        const mandatory=control.dataset.campo&&['segmento','cantidad','molde','precio'].includes(control.dataset.campo)||control.dataset.activo==='mesa';
        card.innerHTML=`<legend>${e(title||'Cantidad')}</legend><div class="excel-decision-card__meta"><span class="excel-decision-badge ${mandatory?'is-required':''}">${mandatory?'Obligatoria':'Opcional'}</span><span class="excel-decision-impact" data-card-impact>Según tu elección</span></div>`;
        host.parentNode.insertBefore(card,host);card.appendChild(host);if(label)for(const n of Array.from(label.childNodes))if(n.nodeType===3)n.remove();
        if(control.tagName==='SELECT'||control.type==='checkbox'){
          const id='excel-choice-'+(++serial),choices=document.createElement('div');choices.className='excel-decision-options';
          const entries=control.tagName==='SELECT'?Array.from(control.options).map(o=>({value:o.value,label:o.textContent,selected:o.selected})): [{value:'0',label:control.hasAttribute('data-excel-mantenimiento')?'No realizar mantenimiento':'No contratar',selected:!control.checked},{value:'1',label:control.hasAttribute('data-excel-mantenimiento')?'Realizar mantenimiento':'Contratar analista',selected:control.checked}];
          for(const option of entries){
            if(option.value===''&&!control.hasAttribute('data-excel-marketing')&&!(control.dataset.excelGrupo!==undefined&&grupos()[Number(control.dataset.excelGrupo)]==='Inversion en RR.HH.'))continue;
            const row=cat().find(o=>o.codigo===option.value),marketing=control.hasAttribute('data-excel-marketing')?cfg().MARKETING_BASE[option.value]:null;
            const amount=row?.costo??marketing?.costo??(control.hasAttribute('data-excel-mantenimiento')&&option.value==='1'?cfg().COSTO_MANTENIMIENTO_BASE:control.hasAttribute('data-excel-analista')&&option.value==='1'?cfg().ANALISTA_BASE.costo:0);
            const optionLabel=row?.opcion||(option.value===''?(control.hasAttribute('data-excel-marketing')?'No invertir':control.dataset.excelGrupo!==undefined&&grupos()[Number(control.dataset.excelGrupo)]==='Inversion en RR.HH.'?'No capacitar':'Sin seleccionar'):option.label.replace(/ · S\/.*$/,''));
            const item=document.createElement('label');item.className='excel-decision-option';
            item.innerHTML=`<input type="radio" name="${id}" value="${e(option.value)}" ${option.selected?'checked':''} ${control.disabled?'disabled':''} data-excel-choice><span><strong>${e(optionLabel)}</strong><b>${money(amount)}</b><small>${e(row?.descripcion||(control.hasAttribute('data-excel-garantia')?'Cobertura comercial sin salida de caja.':control.hasAttribute('data-excel-marketing')?'Inversión por ciclo para dar a conocer tu empresa.':control.hasAttribute('data-excel-regimen')?'Define el régimen de los costos laborales.':'Elige esta alternativa para el ciclo.'))}</small></span>`;
            item.querySelector('input').addEventListener('input',event=>{event.stopPropagation();if(control.type==='checkbox')control.checked=option.value==='1';else control.value=option.value;control.dispatchEvent(new Event('input',{bubbles:true}));});
            item.querySelector('input').addEventListener('change',event=>event.stopPropagation());choices.appendChild(item);
          }
          control.hidden=true;control.tabIndex=-1;card.appendChild(choices);const help=document.createElement('p');help.className='excel-help';help.textContent='Botón de opción: solo puedes seleccionar una alternativa.';card.appendChild(help);
        }
        const save=document.createElement('button');save.type='button';save.className='side-button excel-decision-save';save.dataset.excelGuardarItem='';save.textContent='Guardar decisión';save.disabled=control.disabled;save._decisionControl=control;card.appendChild(save);
      }
      function groupCards(cards,title,description){
        if(!cards.length)return;const group=document.createElement('fieldset');group.className='excel-decision-card excel-decision-group';
        group.innerHTML=`<legend>${e(title)}</legend><div class="excel-decision-card__meta"><span class="excel-decision-badge ${title.startsWith('Lote')?'is-required':''}">${title.startsWith('Lote')?'Obligatoria':'Opcional'}</span><span>El saldo se actualiza al guardar</span></div><p class="excel-help">${e(description)}</p>`;
        cards[0].parentNode.insertBefore(group,cards[0]);const controls=[];
        for(const card of cards){
          controls.push(...card.querySelectorAll('select,input:not([data-excel-choice])'));
          card.querySelectorAll('[data-excel-guardar-item]').forEach(button=>button.remove());
          card.querySelectorAll('.excel-help').forEach(help=>{if(help.textContent.startsWith('Botón de opción'))help.remove();});
          card.classList.remove('excel-decision-card');card.classList.add('excel-decision-subcontrol');
          if(card.querySelector('.excel-decision-options')){
            const details=document.createElement('details');details.className='excel-choice-disclosure';
            const summary=document.createElement('summary'),source=card.querySelector('select'),selected=source?.selectedOptions[0]?.textContent||'Elegir alternativa';
            summary._decisionTitle=card.querySelector('legend')?.textContent||'Opción';summary.textContent=summary._decisionTitle+': '+selected;details.appendChild(summary);details.appendChild(card);group.appendChild(details);
          }else group.appendChild(card);
        }
        const button=document.createElement('button');button.type='button';button.className='side-button excel-decision-save';button.dataset.excelGuardarItem='';button.textContent='Guardar decisión';button.disabled=controls.every(control=>control.disabled);button._decisionControls=controls;group.appendChild(button);
      }
      for(const [area,label] of Object.entries(areas))groupCards(Array.from(container.querySelectorAll('.excel-personal-cards>.excel-decision-card')).filter(card=>card.querySelector(`[data-personal^="${area},"]`)),`Personal de ${label.toLowerCase()}`,'Define la cantidad de personas de cada nivel y el tipo de máquina que operarán.');
      for(const [family,label] of Object.entries({cuero:'Compra de cuero',accesorios:'Compra de accesorios',hilo:'Compra de hilo'}))groupCards(Array.from(container.querySelectorAll('.excel-decision-card')).filter(card=>Array.from(card.querySelectorAll('[data-compra]')).some(control=>cfg().INSUMOS_POR_FAMILIA[family].includes(control.dataset.compra))),label,'Indica cuántas unidades de compra necesitas de cada material. El inventario sobrante se conserva.');
      for(const lot of container.querySelectorAll('.excel-lote'))groupCards(Array.from(lot.querySelectorAll('.excel-decision-card')),lot.querySelector('legend')?.textContent||'Plan de producción','Define cuánto producir y a qué precio. Abre cada alternativa para elegir segmento, molde y materiales.');
    }

    function canSave(){return !context.canSave||context.canSave();}
    function blockedReason(){return confirmed?'El plan ya fue confirmado para este ciclo. Podrás editar al comenzar el siguiente.':locked?(context.lockReason?.()||'El ciclo está cerrado; no se pueden modificar sus decisiones.'):!canSave()?(context.lockReason?.()||'La edición está en pausa o el tiempo del ciclo terminó.') : '';}
    function canEdit(){const reason=blockedReason();if(reason){render();const status=container.querySelector('[data-excel-status]');if(status)status.textContent=reason;return false;}return true;}
    function persistDraft(){if(!enabled||!canSave())return;stored={...stored,habilitado:true,motor_version:context.motorVersion,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:false};context.save(stored);}
    function feedback(){
      function controlValue(plan,control){
        if(control.dataset.excelGrupo!==undefined){const group=grupos()[Number(control.dataset.excelGrupo)];return plan.seleccion.find(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo===group)||'';}
        if(control.dataset.lote!==undefined)return plan.lotes?.[Number(control.dataset.lote)]?.[control.dataset.campo]??'';
        if(control.dataset.personal){const [a,n,m]=control.dataset.personal.split(',');return plan.personal?.[a]?.[n]?.[m]||0;}
        if(control.dataset.compra)return plan.comprasUnidades?.[control.dataset.compra]||0;
        if(control.dataset.activo)return plan.maquinaria?.[control.dataset.activo]||0;
        if(control.dataset.excelTienda)return plan.tiendasPorDistrito?.[control.dataset.excelTienda]||0;
        for(const [attribute,key] of Object.entries({'data-excel-regimen':'regimen','data-excel-prestamo':'montoPrestamo','data-excel-marketing':'marketingNivel','data-excel-garantia':'garantiaDias','data-excel-mantenimiento':'mantenimientoPreventivo','data-excel-analista':'analistaCompras','data-excel-garantia-proveedor':'garantiaProveedor'}))if(control.hasAttribute(attribute))return plan[key];
      }
      container.querySelectorAll('[data-excel-guardar-item]').forEach(button=>{
        const controls=button._decisionControls||[button._decisionControl],dirty=controls.some(control=>JSON.stringify(controlValue(draft,control))!==JSON.stringify(controlValue(saved,control)));
        const card=button.closest('.excel-decision-card');card.dataset.pending=String(dirty);
        button.textContent=dirty?'Guardar decisión':button.dataset.justSaved?'Decisión guardada':'Guardar decisión';
        let note=card.querySelector(':scope > .excel-decision-dirty');if(dirty&&!note){note=document.createElement('p');note.className='excel-decision-dirty';note.setAttribute('role','status');card.insertBefore(note,button);}if(note){note.textContent=dirty?'Cambios pendientes de guardar':'';note.hidden=!dirty;}
      });
      container.querySelectorAll('.excel-decision-card:not(.excel-decision-group),.excel-decision-subcontrol').forEach(card=>{
        const control=card.querySelector('select,input:not([data-excel-choice])'),impact=card.querySelector('[data-card-impact]');if(!control||!impact)return;
        const row=cat().find(o=>o.codigo===control.value);let amount=row?.costo||0;
        if(control.hasAttribute('data-excel-marketing'))amount=cfg().MARKETING_BASE[control.value]?.costo||0;
        if(control.hasAttribute('data-excel-mantenimiento'))amount=control.checked?cfg().COSTO_MANTENIMIENTO_BASE:0;
        if(control.hasAttribute('data-excel-analista'))amount=control.checked?cfg().ANALISTA_BASE.costo:0;
        if(control.dataset.compra)amount=numero(control.value)*cfg().CONVERSION_COMPRA[control.dataset.compra]*cfg().PRECIO_MP[control.dataset.compra];
        if(control.dataset.activo){const cost=root.SIDE_EXCEL_COSTOS.costoMaquinaria(control.dataset.activo,draft.regimen);amount=Math.max(0,numero(control.value)-numero(context.historial?.maquinariaActivos?.[control.dataset.activo]))*cost.salidaCompra;}
        if(control.dataset.excelTienda)amount=numero(control.value)*cfg().COSTOS_TIENDAS[control.dataset.excelTienda];
        if(control.dataset.personal){const [area,n]=control.dataset.personal.split(',');amount=Array.from(card.querySelectorAll('[data-personal]')).reduce((sum,input)=>sum+numero(input.value),0)*root.SIDE_EXCEL_COSTOS.costoLaboral(area,Number(n)+1,draft.regimen).pagoMensual;}
        impact.textContent=control.hasAttribute('data-excel-prestamo')?`Ingreso de caja: ${money(control.value)}`:amount?`Salida de caja: ${money(amount)}`:'Sin salida de caja';
        const disclosure=card.closest('.excel-choice-disclosure'),summary=disclosure?.querySelector('summary');if(summary&&control.tagName==='SELECT')summary.textContent=summary._decisionTitle+': '+(control.value?control.selectedOptions[0]?.textContent:'Elige una alternativa');
        card.querySelectorAll('[data-excel-choice]').forEach(radio=>radio.checked=control.type==='checkbox'?radio.value===(control.checked?'1':'0'):radio.value===control.value);
      });
      const credit=container.querySelector('[data-excel-credit-after]');if(credit&&Number.isFinite(Number(context.creditAvailable)))credit.textContent='Después de esta solicitud: '+money(Math.max(0,Number(context.creditAvailable)-numero(draft.montoPrestamo)));
      container.querySelectorAll('[data-calidad-lote]').forEach(el=>{const l=root.SIDE_EXCEL_PUNTAJES.evaluarLote(draft.lotes[Number(el.dataset.calidadLote)]);el.textContent=`Calidad ${format(l.calidad)} · Umbral ${format(l.umbral)} · ${l.resultado||'Elige un segmento'}. ${l.mensaje}`;});
      const preview=container.querySelector('[data-excel-preview]');if(!preview)return;
      disposeDop();
      try{
        const d=prepararDecisiones(draft),r=root.SIDE_EXCEL_CICLO.prepararEmpresa({...d,ciclo:context.round},context.historial||{},overrides),plan=dopPlan(d,r);
        const fixed=(r.costos.detalles?.manoObra||[]).filter(row=>['local','limpieza'].includes(row.rol)),total=fixed.reduce((s,row)=>s+row.costo,0);
        const compulsory=container.querySelector('[data-excel-compulsory]');
        if(compulsory)compulsory.innerHTML=`<aside class="side-compulsory" aria-label="Costos obligatorios del ciclo"><h3>Costos obligatorios del ciclo</h3>${Number.isFinite(context.cash)?`<p>Caja antes del cierre: <b>${money(context.cash)}</b></p>`:''}${fixed.map(row=>`<p>${row.rol==='local'?'Local de producción':'Limpieza y servicios'}: <strong>− ${money(row.costo)}</strong></p>`).join('')}<p>Total obligatorio: <strong>− ${money(total)}</strong>. Se cobra una vez al cerrar el ciclo. La proyección no descuenta dinero.</p></aside>`;
        preview.innerHTML='';
        if(!context.category||context.category==='C'){
          if(root.SIDE_PRODUCTION_DOP)preview.innerHTML+=root.SIDE_PRODUCTION_DOP.render(plan,{round:context.round,producedPercent:plan.target?Math.round(plan.producibleUnits/plan.target*100):0});
          preview.innerHTML+=materialRecommendationHtml(d,r);
        }
        preview.innerHTML+=resumenHtml(r,{preview:true});
        if(plan.target&&plan.producibleUnits===0)preview.innerHTML+='<p class="excel-feedback" role="status">Este plan produce 0 unidades: revisa mesa y moldes en Infraestructura, personal de corte, ensamble y acabado, y los materiales elegidos en Logística. Sin productos disponibles no habrá ingresos por ventas.</p>';
        if(root.SIDE_PRODUCTION_DOP)disposeDop=root.SIDE_PRODUCTION_DOP.mount(preview);
      }catch(error){preview.textContent='Completa los moldes y las decisiones para ver la proyección.';}
    }
    function render(){
      renderedReason=blockedReason();
      const frozen=!!renderedReason;
      const opened=Array.from(container.querySelectorAll('details[open]')).map(el=>el.querySelector('summary')?.textContent);
      container.innerHTML=`<section class="excel-editor${sectioned?' excel-editor--section':''}" aria-labelledby="excelEditorTitle"><header><img src="assets/icons/categories/recursos_humanos.svg" alt=""><div><h2 id="excelEditorTitle">${sectioned?({B:'Infraestructura',C:'Producción',D:'Ventas',E:'Finanzas',F:'Logística'}[context.category]||'Plan de producción por lotes'):'Plan de producción por lotes'}</h2><p>Las cinco secciones forman un único plan para el ciclo.</p></div></header>
        ${sectioned?'<details class="excel-cycle-help"><summary>Cómo se cierra el ciclo</summary>':''}<p class="excel-help">El docente cierra las ventas de todas las empresas participantes desde su panel. Caja, costos, compras y préstamos se registran una sola vez al cerrar el ciclo.</p>
        ${actual?'<p class="excel-help">Todas las empresas de esta partida usan el mismo plan por lotes. Un ciclo equivale a un mes con 24 días productivos. Al cerrar se enviará automáticamente el último borrador guardado; local y limpieza se cobran aunque no envíes.</p>':`<label class="excel-toggle"><input type="checkbox" data-excel-enable ${enabled?'checked':''} ${locked||confirmed||!remoteReady||context.activationBlocked?'disabled':''}>Usar el modelo por lotes en esta empresa</label>`}
        ${sectioned?'</details>':''}
        ${blockedReason()?`<p class="excel-feedback" role="status">${e(blockedReason())}</p>`:''}
        <p data-excel-connection class="excel-feedback" role="status" ${remoteReady?'hidden':''}>Puedes editar y guardar tu borrador mientras se comprueba la conexión. La confirmación requiere que la partida esté disponible.</p>
        ${context.activationBlocked?'<p>Este ciclo ya tiene compras o pagos confirmados. Activa el plan por lotes al comenzar el próximo ciclo, antes de registrar operaciones. Se conservarán caja, activos y deuda anteriores.</p>':''}
        ${!local?(remoteReady?'<p>Confirma el plan para sincronizarlo con la partida.</p>':'<p>La partida necesita una actualización antes de registrar este plan. Consulta a tu docente. Tus datos guardados se conservan.</p>'):''}
        ${enabled?`<div data-excel-compulsory></div><div class="excel-grid"><label data-excel-section="C">Régimen laboral<select data-excel-regimen ${frozen?'disabled':''}><option value="MYPE" ${draft.regimen==='MYPE'?'selected':''}>MYPE</option><option value="NO_MYPE" ${draft.regimen==='NO_MYPE'?'selected':''}>No MYPE</option></select></label><label data-excel-section="D">Inversión en marketing<select data-excel-marketing ${frozen?'disabled':''}><option value="">Elegir…</option>${Object.entries(cfg().MARKETING_BASE).map(([key,m])=>`<option value="${key}" ${draft.marketingNivel===key?'selected':''}>${e(key[0].toUpperCase()+key.slice(1))} · ${money(m.costo)}</option>`).join('')}</select></label><label data-excel-section="E">Préstamo solicitado (S/)<input type="number" min="0" step="0.01" value="${e(draft.montoPrestamo)}" data-excel-prestamo ${Number.isFinite(Number(context.creditAvailable))?'max="'+Number(context.creditAvailable)+'"':''} ${frozen?'disabled':''}>${Number.isFinite(Number(context.creditAvailable))?'<small>Línea disponible: '+money(context.creditAvailable)+'</small><small data-excel-credit-after></small>':''}</label></div>
          <details data-excel-section="D"><summary>Tiendas</summary><p>${actual?'Cada tienda compromete 12 ciclos mensuales (24 días productivos por ciclo); si la partida termina antes, el compromiso se informa sin cobrar ciclos posteriores. El canal web cuesta '+money(cfg().COSTO_WEB)+' por ciclo; se suma al alquiler de las tiendas. Con tiendas, la comisión comercial es 1% de las ventas.':'Se conservan los distritos del juego. La equivalencia con zonas del Excel está pendiente de confirmación.'}</p><div class="excel-grid">${Object.entries(cfg().DISTRITOS_TIENDAS).map(([key,label])=>`<label>Tiendas en ${e(label)} (unidades)${actual?' · '+money(cfg().COSTOS_TIENDAS[key])+' por tienda y ciclo':''}<input type="number" min="0" step="1" value="${draft.tiendasPorDistrito[key]}" data-excel-tienda="${key}" ${frozen?'disabled':''}></label>`).join('')}</div></details>
          ${(root.SIDE_DECISION_CATALOG||[]).find(category=>category.cat==='D')?.items.filter(item=>item.type==='info').map(item=>`<aside class="excel-help" data-excel-section="D" data-catalog-rule="${e(item.id)}"><strong>${e(item.name)}</strong><p>${e(item.desc)}</p></aside>`).join('')||''}
          <details><summary>Decisiones del ciclo</summary><p>Las opciones sin elegir aportan cero. Un material faltante también aporta cero a la calidad y puede impedir producir.</p><div class="excel-grid">${grupos().map((g,i)=>`<label data-excel-section="${grupoSeccion(g)}">${e(g)}<select data-excel-grupo="${i}" ${frozen?'disabled':''}>${opciones(opcionesGrupo(g),draft.seleccion.find(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo===g))}</select></label>`).join('')}<label data-excel-section="C">Garantía de productos terminados<select data-excel-garantia ${frozen?'disabled':''}><option value="">Elegir…</option>${cfg().GARANTIA_DIAS_BASE.map(d=>`<option value="${d}" ${Number(draft.garantiaDias)===d?'selected':''}>Cobertura comercial ${d} días</option>`).join('')}</select></label><label data-excel-section="B"><input type="checkbox" data-excel-mantenimiento ${draft.mantenimientoPreventivo?'checked':''} ${frozen?'disabled':''}> Mantenimiento preventivo opcional (${money(cfg().COSTO_MANTENIMIENTO_BASE)})</label></div><p data-excel-section="C">La garantía comercial de 30, 90 o 180 días no afecta la caja.</p><p data-excel-section="B">El mantenimiento preventivo opcional cuesta ${money(cfg().COSTO_MANTENIMIENTO_BASE)} por ciclo; el mantenimiento mensual de cada activo se detalla en Infraestructura. El importe obligatorio exacto, con el régimen elegido, aparece al inicio del formulario.</p><p data-excel-section="C">Limpieza obligatoria: ${costoLaboralHtml('limpieza',1,draft.regimen)} Jefatura, si se contrata: ${costoLaboralHtml('jefatura',1,draft.regimen)}</p></details>
          <details data-excel-section="C"><summary>Personal por nivel y máquina</summary><p>La cantidad corresponde a operarios. Corte utiliza la columna manual.</p><button type="button" data-excel-importar class="side-button" ${frozen?'disabled':''}>Importar personal de mis decisiones</button><div class="excel-table-wrap"><table><thead><tr><th>Área y nivel</th>${maquinas.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${Object.entries(areas).flatMap(([a,label])=>[0,1,2].map(n=>`<tr><th>${label} N${n+1}${costoLaboralHtml(a,n+1,draft.regimen)}</th>${[0,1,2].map(m=>`<td><input aria-label="${label} nivel ${n+1} ${maquinas[m]}" data-personal="${a},${n},${m}" type="number" min="0" step="1" value="${draft.personal[a][n][m]}" ${frozen||a==='corte'&&m!==0?'disabled':''}></td>`).join('')}</tr>`)).join('')}</tbody></table></div></details>
          <details data-excel-section="F"><summary>Compras de materiales</summary><p>Declara cantidades de compra: rollos, pieles completas, juegos y carretes. La materia prima sobrante se conserva. Los precios se aplican a unidades de producción; cada compra se convierte según su rendimiento. Se aplica el descuento general de materiales de ${format(cfg().DESCUENTO_CANTIDAD*100)}%; el analista añade su descuento cuando se contrata.</p><div class="excel-grid"><label><input type="checkbox" data-excel-analista ${draft.analistaCompras?'checked':''} ${frozen?'disabled':''}> Contratar analista de compras (${money(cfg().ANALISTA_BASE.costo)} por ciclo)</label><label>Garantía de proveedores<select data-excel-garantia-proveedor ${frozen?'disabled':''}>${cfg().GARANTIA_PROVEEDOR_BASE.map(p=>`<option value="${p}" ${Number(draft.garantiaProveedor)===p?'selected':''}>${p?p+'% de devolución':'Sin garantía'}</option>`).join('')}</select></label></div><p>El analista negocia ${format(root.SIDE_EXCEL_COSTOS.descuentoAnalista(context.round))}% en materiales este ciclo. La garantía se conserva; las devoluciones requieren un evento de falla cubierto, que el Excel no define.</p><div class="excel-grid">${Object.keys(cfg().CONVERSION_COMPRA).map(k=>`<label>${e(root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)} · ${money(cfg().PRECIO_MP[k])} por unidad de producción<input type="number" min="0" step="any" data-compra="${k}" value="${e(draft.comprasUnidades[k]||0)}" ${frozen?'disabled':''}><small>Costo bruto de 1 compra: ${money(cfg().CONVERSION_COMPRA[k]*cfg().PRECIO_MP[k])}. 1 compra = ${cfg().CONVERSION_COMPRA[k]} ${k.startsWith('INS-0')&&['INS-01','INS-02','INS-03'].includes(k)?'m²':['INS-04','INS-05'].includes(k)?'u':'m'}</small></label>`).join('')}</div></details><details data-excel-section="B"><summary>Activos disponibles en el ciclo</summary><p>Compra una única mesa y al menos un molde para fabricar. Los activos se conservan entre ciclos.</p><div class="excel-grid">${Object.keys(cfg().MAQUINARIA).map(k=>`<label>${e(k==='mesa'?'Mesa de corte':root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)}<input type="number" min="0" ${actual&&k==='mesa'?'max="1"':''} step="1" data-activo="${k}" value="${e(draft.maquinaria[k]||0)}" ${frozen?'disabled':''}>${costoActivoHtml(k,draft.regimen)}</label>`).join('')}</div></details>
          <div data-excel-section="C" data-excel-lotes>${draft.lotes.map((l,i)=>loteHtml(l,i,frozen)).join('')}</div><button type="button" data-excel-section="C" class="side-button" data-agregar-lote ${frozen||draft.lotes.length>=cfg().MAX_LOTES?'disabled':''}>Agregar lote</button>
          <div data-excel-preview></div><p class="excel-help">Guardar conserva avances; confirmar envía el plan completo de las cinco secciones. Finanzas sin préstamo equivale a S/ 0 y no exige guardar antes.</p><div class="excel-actions"><button type="button" data-excel-guardar class="side-button" ${frozen?'disabled':''}>Guardar borrador de lotes</button><button type="button" data-excel-enviar class="side-button side-button--primary" ${frozen||!remoteReady?'disabled':''}>Confirmar plan del ciclo</button></div><p data-excel-status role="status">${confirmed?'Plan del ciclo confirmado.':stored.round?'Último guardado: ciclo '+e(stored.round):'Completa y confirma el plan para participar en el cierre.'}</p>`:''}</section>`;
      if(sectioned){for(const el of container.querySelectorAll('[data-excel-section]'))if(el.dataset.excelSection!==context.category&&!(context.category==='C'&&el.dataset.excelSection==='F'))el.remove();for(const el of container.querySelectorAll('.excel-grid'))if(!el.querySelector('input,select,button'))el.remove();for(const el of container.querySelectorAll('details'))if(el.querySelector('summary')?.textContent==='Decisiones del ciclo'&&!el.querySelector('input,select,button'))el.remove();}
      for(const el of container.querySelectorAll('details'))if(opened.includes(el.querySelector('summary')?.textContent)||((actual||sectioned)&&el.querySelector('input,select,button')))el.open=true;
      decorateDecisions();
      feedback();
    }
    container.oninput=event=>{
      const el=event.target;if(!canEdit())return;if(el.type==='number'){if(!Number.isFinite(Number(el.value))||Number(el.value)<0)el.value='0';if(el.step==='1'&&el.value!=='')el.value=String(Math.floor(numero(el.value)));if(el.max!==''&&Number(el.value)>Number(el.max))el.value=el.max;}
      if(el.dataset.lote!==undefined){const campo=el.dataset.campo;draft.lotes[Number(el.dataset.lote)][campo]=['cantidad','precio'].includes(campo)?numero(el.value):el.value;}
      else if(el.dataset.personal){const [a,n,m]=el.dataset.personal.split(',');draft.personal[a][n][m]=Math.floor(numero(el.value));}
      else if(el.dataset.compra)draft.comprasUnidades[el.dataset.compra]=numero(el.value);
      else if(el.dataset.activo){const owned=numero(context.historial?.maquinariaActivos?.[el.dataset.activo]);draft.maquinaria[el.dataset.activo]=Math.max(owned,Math.floor(numero(el.value)));if(actual&&el.dataset.activo==='mesa')draft.maquinaria.mesa=Math.min(1,draft.maquinaria.mesa);el.value=draft.maquinaria[el.dataset.activo];}
      else if(el.dataset.excelGrupo!==undefined){const g=grupos()[Number(el.dataset.excelGrupo)];draft.seleccion=draft.seleccion.filter(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo!==g);if(el.value)draft.seleccion.push(el.value);if(actual&&g==='Acceso a prestamo bancario'&&el.value!=='FIN-01A'){draft.montoPrestamo=0;const monto=container.querySelector('[data-excel-prestamo]');if(monto)monto.value='0';}}
      else if(el.matches('[data-excel-regimen]')){draft.regimen=el.value;persistDraft();render();return;}
      else if(el.matches('[data-excel-prestamo]')){draft.montoPrestamo=numero(el.value);if(actual){const codigo=draft.montoPrestamo>0?'FIN-01A':'FIN-01B';draft.seleccion=draft.seleccion.filter(k=>!['FIN-01A','FIN-01B'].includes(k)).concat(codigo);const control=container.querySelector(`[data-excel-grupo="${grupos().indexOf('Acceso a prestamo bancario')}"]`);if(control)control.value=codigo;}}
      else if(el.dataset.excelTienda&&Object.hasOwn(cfg().DISTRITOS_TIENDAS,el.dataset.excelTienda))draft.tiendasPorDistrito[el.dataset.excelTienda]=Math.floor(numero(el.value));
      else if(el.matches('[data-excel-garantia]'))draft.garantiaDias=cfg().GARANTIA_DIAS_BASE.includes(Number(el.value))?Number(el.value):null;
      else if(el.matches('[data-excel-mantenimiento]'))draft.mantenimientoPreventivo=!!el.checked;
      else if(el.matches('[data-excel-marketing]'))draft.marketingNivel=Object.hasOwn(cfg().MARKETING_BASE,el.value)?el.value:null;
      else if(el.matches('[data-excel-analista]'))draft.analistaCompras=!!el.checked;
      else if(el.matches('[data-excel-garantia-proveedor]'))draft.garantiaProveedor=cfg().GARANTIA_PROVEEDOR_BASE.includes(Number(el.value))?Number(el.value):0;
      persistDraft();feedback();
    };
    container.onchange=event=>{if(!canEdit())return;if(event.target.matches('[data-excel-enable]')){enabled=event.target.checked;stored={...stored,habilitado:enabled,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:false};context.save(stored);render();}else container.oninput(event);};
    container.onclick=event=>{
      const el=event.target.closest('button');if(!el||el.disabled||!canEdit())return;
      if(el.hasAttribute('data-excel-guardar-item')){for(const control of el._decisionControls||[el._decisionControl])saveControl(control);el.dataset.justSaved='true';feedback();container.querySelector('[data-excel-status]').textContent='Decisión guardada. El saldo final guardado se actualizó.';return;}
      if(el.hasAttribute('data-agregar-lote')){draft.lotes.push(nuevoLote());persistDraft();render();}
      if(el.dataset.quitarLote!==undefined){draft.lotes.splice(Number(el.dataset.quitarLote),1);persistDraft();render();}
      if(el.hasAttribute('data-excel-importar')){const imported=context.importar?.();if(imported){draft.personal=imported.personal;draft.seleccion=[...draft.seleccion.filter(k=>!imported.seleccion.some(v=>root.SIDE_EXCEL_PUNTAJES.indice[v]?.grupo===root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo)),...imported.seleccion];}persistDraft();render();}
      if(el.hasAttribute('data-excel-guardar')||el.hasAttribute('data-excel-enviar')){
        if(!canSave()){container.querySelector('[data-excel-status]').textContent='No se puede guardar ni confirmar mientras el ciclo está en pausa o fuera de la fase de decisiones.';return;}
        const enviar=el.hasAttribute('data-excel-enviar'),error=enviar?validar(draft,context.motorVersion):'';
        if(error){container.querySelector('[data-excel-status]').textContent=error;return;}
        if(enviar&&actual){
          const projection=proyectarPlan(draft,context);
          const issue=!remoteReady?'Recupera la conexión o actualiza la partida antes de confirmar.':Number.isFinite(context.cash)&&projection.cashAfter<0?'El plan supera la caja disponible. Reduce compras o gastos, o solicita financiamiento.':(projection.plan.target>projection.prepared.produccion.produccionCapacidad||projection.plan.materials.some(material=>material.shortfall>0))?'La cantidad planeada supera la capacidad o los materiales disponibles. Ajusta producción, personal, activos y compras.':'';
          if(issue){container.querySelector('[data-excel-status]').textContent=issue;return;}
        }
        saved=clone(draft);savedBalance();stored={...stored,habilitado:true,motor_version:context.motorVersion||stored.motor_version,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:enviar};if(enviar)stored.planesPorCiclo={...stored.planesPorCiclo,[context.round]:clone(stored.decisiones)};context.save(stored);context.savedBalanceChanged?.();context.refreshSavedBalance?.(stored.saldoFinalGuardado);confirmed=enviar;render();container.querySelector('[data-excel-status]').textContent=enviar?'Plan del ciclo confirmado.':'Borrador guardado.';
      }
    };
    render();
    return Object.assign(()=>disposeDop(),{refreshAccess(){
      if(renderedReason!==blockedReason())render();
    },setRemoteReady(value){
      remoteReady=local||!!value;
      const confirm=container.querySelector('[data-excel-enviar]');
      if(confirm)confirm.disabled=!!blockedReason()||!remoteReady;
      const toggle=container.querySelector('[data-excel-enable]');
      if(toggle)toggle.disabled=!!blockedReason()||!remoteReady||!!context.activationBlocked;
      const notice=container.querySelector('[data-excel-connection]');
      if(notice)notice.hidden=remoteReady;
    }});
  }
  const cierreKey=(game,ciclo)=>`SIDE_EXCEL_CIERRE_${game}_${ciclo}`;
  const historiaKey=game=>`SIDE_EXCEL_HISTORIAL_${game}`;
  function leer(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
  function historial(game,id){return leer(historiaKey(game),{})[id]||{};}
  function resultado(game,ciclo,id){return leer(cierreKey(game,ciclo),{}).resultadosPorEmpresa?.[id]||null;}
  function cerrarLocal({game,ciclo,reports,motorVersion}){
    motorVersion=motorVersion||reports.find(r=>r.partida===game&&r.excelDecisionState?.motor_version)?.excelDecisionState.motor_version;
    const actual=motorVersion===root.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,overrides=motorOverrides(motorVersion);
    const participantes=reports.filter(r=>r.partida===game&&r.estado!=='eliminada'&&(actual||r.excelDecisionState?.habilitado)&&Number(r.excelDecisionState?.cicloActivacion??1)<=Number(ciclo));
    if(!participantes.length)return null;
    const previo=leer(cierreKey(game,ciclo),null);let cierre=previo;
    if(!cierre){
      const decisionesPorEmpresa={},borradoresPorEmpresa={};participantes.forEach(r=>{const d=r.excelDecisionState||{},plan=d.planesPorCiclo?.[ciclo]||(Number(d.round)===Number(ciclo)&&d.enviado?d.decisiones:null);if(plan)decisionesPorEmpresa[r.id]=prepararDecisiones(plan);else if(actual&&Number(d.round)===Number(ciclo)&&d.decisiones)borradoresPorEmpresa[r.id]=prepararDecisiones(d.decisiones);});
      const baseHistoria=leer(historiaKey(game),{}),historialAnterior=root.SIDE_EXCEL_CAJA?root.SIDE_EXCEL_CAJA.sembrarTransicion(baseHistoria,participantes.map(r=>({id:r.id,envelope:r.excelDecisionState}))):baseHistoria;
      cierre=root.SIDE_EXCEL_CICLO.cerrarCiclo({ciclo,empresas:participantes.map(r=>r.id),decisionesPorEmpresa,borradoresPorEmpresa,historialPorEmpresa:historialAnterior},overrides);
      if(root.SIDE_EXCEL_CAJA)cierre=root.SIDE_EXCEL_CAJA.adjuntarCaja(cierre,{capitalPorEmpresa:Object.fromEntries(participantes.map(r=>[r.id,r.capital])),baseCajaPorEmpresa:Object.fromEntries(participantes.map(r=>[r.id,r.excelDecisionState?.cajaTransicion??r.capital])),historialAnterior,overrides});
      localStorage.setItem(cierreKey(game,ciclo),JSON.stringify(cierre));localStorage.setItem(historiaKey(game),JSON.stringify(cierre.historialPorEmpresa));
    }
    participantes.forEach(r=>{const value=cierre.resultadosPorEmpresa[r.id];if(value){if(actual){r.excelDecisionState={...r.excelDecisionState,habilitado:true,motor_version:motorVersion,resultado:value,historial:cierre.historialPorEmpresa[r.id]};if(value.envioAutomatico)r.excelDecisionState.enviosAutomaticos={...r.excelDecisionState.enviosAutomaticos,[ciclo]:true};}r.estadoResultados={...r.estadoResultados,excel:value,ingresos:value.ingresos,costos:value.costosTotales,utilidad:value.utilidad};Object.assign(r,{ingresos:value.ingresos,costos:value.costosTotales,utilidad:value.utilidad,ronda:ciclo,updatedAt:new Date().toISOString()});root.SIDE_EXCEL_CAJA?.aplicarReporte(r,value);}if(cierre.eliminadas.includes(r.id))r.estado='eliminada';});
    localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));return cierre;
  }
  root.SIDE_EXCEL_UI=Object.freeze({mountEditor,proyectarPlan,nuevasDecisiones,prepararDecisiones,resumenHtml,validar,dopPlan,materialRecommendationHtml,cerrarLocal,historial,resultado,cierreKey,historiaKey,costoLaboralHtml,costoActivoHtml});
}(typeof globalThis!=='undefined'?globalThis:this));
