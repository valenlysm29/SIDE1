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
  const grupoSeccion=g=>({'Maquina de ensamblado':'B','Maquina de acabados':'B','Molde':'B','Canal de venta':'D','Acceso a prestamo bancario':'E'}[g]||'C');
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
  function prepararDecisiones(d){
    const out=clone(d);
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
  function mountEditor(container,context){
    if(!container)return;
    const actual=context.motorVersion===root.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,overrides=motorOverrides(context.motorVersion);
    let stored=context.getState()||{},draft=Object.assign(nuevasDecisiones(),clone(stored.decisiones||{})),enabled=actual||!!stored.habilitado;
    draft.personal=root.SIDE_EXCEL_PRODUCCION.normalizarPersonal(draft.personal);
    draft.tiendasPorDistrito={los_olivos:0,miraflores:0,sjl:0,...draft.tiendasPorDistrito};
    for(const [codigo,owned] of Object.entries(context.historial?.maquinariaActivos||{}))draft.maquinaria[codigo]=Math.max(numero(draft.maquinaria[codigo]),numero(owned));
    let locked=!!context.locked,confirmed=Number(stored.round)===Number(context.round)&&stored.enviado;
    const local=context.local!==false;
    const remoteReady=local||context.remoteReady!==false;
    if(actual&&!remoteReady)locked=true;
    function persistDraft(){if(!actual)return;stored={...stored,habilitado:true,motor_version:context.motorVersion,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:false};context.save(stored);}
    function feedback(){
      const credit=container.querySelector('[data-excel-credit-after]');if(credit&&Number.isFinite(Number(context.creditAvailable)))credit.textContent='Después de esta solicitud: '+money(Math.max(0,Number(context.creditAvailable)-numero(draft.montoPrestamo)));
      container.querySelectorAll('[data-calidad-lote]').forEach(el=>{const l=root.SIDE_EXCEL_PUNTAJES.evaluarLote(draft.lotes[Number(el.dataset.calidadLote)]);el.textContent=`Calidad ${format(l.calidad)} · Umbral ${format(l.umbral)} · ${l.resultado||'Elige un segmento'}. ${l.mensaje}`;});
      const preview=container.querySelector('[data-excel-preview]');if(!preview)return;
      try{const d=prepararDecisiones(draft);preview.innerHTML=resumenHtml(root.SIDE_EXCEL_CICLO.prepararEmpresa({...d,ciclo:context.round},context.historial||{},overrides),{preview:true});}catch(error){preview.textContent='Completa los moldes y las decisiones para ver la proyección.';}
    }
    function render(){
      const frozen=locked||confirmed;
      const opened=Array.from(container.querySelectorAll('details[open]')).map(el=>el.querySelector('summary')?.textContent);
      container.innerHTML=`<section class="excel-editor${actual&&context.category?' excel-editor--section':''}" aria-labelledby="excelEditorTitle"><header><img src="assets/icons/categories/recursos_humanos.svg" alt=""><div><h2 id="excelEditorTitle">${actual&&context.category?({B:'Infraestructura',C:'Producción',D:'Ventas',E:'Finanzas',F:'Logística'}[context.category]||'Plan de producción por lotes'):'Plan de producción por lotes'}</h2><p>Las cinco secciones forman un único plan para el ciclo.</p></div></header>
        ${actual&&context.category?'<details class="excel-cycle-help"><summary>Cómo se cierra el ciclo</summary>':''}<p class="excel-help">El docente cierra las ventas de todas las empresas participantes desde su panel. Caja, costos, compras y préstamos se registran una sola vez al cerrar el ciclo.</p>
        ${actual?'<p class="excel-help">Todas las empresas de esta partida usan el mismo plan por lotes. Un ciclo equivale a un mes con 24 días productivos. Al cerrar se enviará automáticamente el último borrador guardado; local y limpieza se cobran aunque no envíes.</p>':`<label class="excel-toggle"><input type="checkbox" data-excel-enable ${enabled?'checked':''} ${locked||confirmed||!remoteReady||context.activationBlocked?'disabled':''}>Usar el modelo por lotes en esta empresa</label>`}
        ${actual&&context.category?'</details>':''}
        ${context.activationBlocked?'<p>Este ciclo ya tiene compras o pagos confirmados. Activa el plan por lotes al comenzar el próximo ciclo, antes de registrar operaciones. Se conservarán caja, activos y deuda anteriores.</p>':''}
        ${!local?(remoteReady?'<p>Confirma el plan para sincronizarlo con la partida.</p>':'<p>La partida necesita una actualización antes de registrar este plan. Consulta a tu docente. Tus datos guardados se conservan.</p>'):''}
        ${enabled?`<div class="excel-grid"><label data-excel-section="C">Régimen laboral<select data-excel-regimen ${frozen?'disabled':''}><option value="MYPE" ${draft.regimen==='MYPE'?'selected':''}>MYPE</option><option value="NO_MYPE" ${draft.regimen==='NO_MYPE'?'selected':''}>No MYPE</option></select></label><label data-excel-section="D">Inversión en marketing<select data-excel-marketing ${frozen?'disabled':''}><option value="">Elegir…</option>${Object.entries(cfg().MARKETING_BASE).map(([key,m])=>`<option value="${key}" ${draft.marketingNivel===key?'selected':''}>${e(key[0].toUpperCase()+key.slice(1))} · ${money(m.costo)}</option>`).join('')}</select></label><label data-excel-section="E">Préstamo solicitado (S/)<input type="number" min="0" step="0.01" value="${e(draft.montoPrestamo)}" data-excel-prestamo ${Number.isFinite(Number(context.creditAvailable))?'max="'+Number(context.creditAvailable)+'"':''} ${frozen?'disabled':''}>${Number.isFinite(Number(context.creditAvailable))?'<small>Línea disponible: '+money(context.creditAvailable)+'</small><small data-excel-credit-after></small>':''}</label></div>
          <details data-excel-section="D"><summary>Tiendas</summary><p>${actual?'Cada tienda compromete 12 ciclos mensuales (24 días productivos por ciclo); si la partida termina antes, el compromiso se informa sin cobrar ciclos posteriores. El canal web cuesta '+money(cfg().COSTO_WEB)+' por ciclo; se suma al alquiler de las tiendas. Con tiendas, la comisión comercial es 1% de las ventas.':'Se conservan los distritos del juego. La equivalencia con zonas del Excel está pendiente de confirmación.'}</p><div class="excel-grid">${Object.entries(cfg().DISTRITOS_TIENDAS).map(([key,label])=>`<label>Tiendas en ${e(label)} (unidades)${actual?' · '+money(cfg().COSTOS_TIENDAS[key])+' por tienda y ciclo':''}<input type="number" min="0" step="1" value="${draft.tiendasPorDistrito[key]}" data-excel-tienda="${key}" ${frozen?'disabled':''}></label>`).join('')}</div></details>
          <details><summary>Decisiones del ciclo</summary><p>Las opciones sin elegir aportan cero. Un material faltante también aporta cero a la calidad y puede impedir producir.</p><div class="excel-grid">${grupos().map((g,i)=>`<label data-excel-section="${grupoSeccion(g)}">${e(g)}<select data-excel-grupo="${i}" ${frozen?'disabled':''}>${opciones(opcionesGrupo(g),draft.seleccion.find(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo===g))}</select></label>`).join('')}<label data-excel-section="C">Garantía de productos terminados<select data-excel-garantia ${frozen?'disabled':''}><option value="">Elegir…</option>${cfg().GARANTIA_DIAS_BASE.map(d=>`<option value="${d}" ${Number(draft.garantiaDias)===d?'selected':''}>Cobertura comercial ${d} días</option>`).join('')}</select></label><label data-excel-section="B"><input type="checkbox" data-excel-mantenimiento ${draft.mantenimientoPreventivo?'checked':''} ${frozen?'disabled':''}> Mantenimiento preventivo opcional (${money(cfg().COSTO_MANTENIMIENTO_BASE)})</label></div><p data-excel-section="C">La garantía comercial de 30, 90 o 180 días no afecta la caja.</p><p data-excel-section="B">El mantenimiento preventivo opcional cuesta ${money(cfg().COSTO_MANTENIMIENTO_BASE)} por ciclo; el mantenimiento mensual de cada activo se detalla en Infraestructura. Local obligatorio: ${money(cfg().SUELDOS.local)} por ciclo.</p><p data-excel-section="C">Limpieza obligatoria: ${costoLaboralHtml('limpieza',1,draft.regimen)} Jefatura, si se contrata: ${costoLaboralHtml('jefatura',1,draft.regimen)}</p></details>
          <details data-excel-section="C"><summary>Personal por nivel y máquina</summary><p>La cantidad corresponde a operarios. Corte utiliza la columna manual.</p><button type="button" data-excel-importar class="side-button" ${frozen?'disabled':''}>Importar personal de mis decisiones</button><div class="excel-table-wrap"><table><thead><tr><th>Área y nivel</th>${maquinas.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${Object.entries(areas).flatMap(([a,label])=>[0,1,2].map(n=>`<tr><th>${label} N${n+1}${costoLaboralHtml(a,n+1,draft.regimen)}</th>${[0,1,2].map(m=>`<td><input aria-label="${label} nivel ${n+1} ${maquinas[m]}" data-personal="${a},${n},${m}" type="number" min="0" step="1" value="${draft.personal[a][n][m]}" ${frozen||a==='corte'&&m!==0?'disabled':''}></td>`).join('')}</tr>`)).join('')}</tbody></table></div></details>
          <details data-excel-section="F"><summary>Compras de materiales</summary><p>Declara cantidades de compra: rollos, pieles completas, juegos y carretes. La materia prima sobrante se conserva. Los precios se aplican a unidades de producción; cada compra se convierte según su rendimiento. Se aplica el descuento general de materiales de ${format(cfg().DESCUENTO_CANTIDAD*100)}%; el analista añade su descuento cuando se contrata.</p><div class="excel-grid"><label><input type="checkbox" data-excel-analista ${draft.analistaCompras?'checked':''} ${frozen?'disabled':''}> Contratar analista de compras (${money(cfg().ANALISTA_BASE.costo)} por ciclo)</label><label>Garantía de proveedores<select data-excel-garantia-proveedor ${frozen?'disabled':''}>${cfg().GARANTIA_PROVEEDOR_BASE.map(p=>`<option value="${p}" ${Number(draft.garantiaProveedor)===p?'selected':''}>${p?p+'% de devolución':'Sin garantía'}</option>`).join('')}</select></label></div><p>El analista negocia ${format(root.SIDE_EXCEL_COSTOS.descuentoAnalista(context.round))}% en materiales este ciclo. La garantía se conserva; las devoluciones requieren un evento de falla cubierto, que el Excel no define.</p><div class="excel-grid">${Object.keys(cfg().CONVERSION_COMPRA).map(k=>`<label>${e(root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)} · ${money(cfg().PRECIO_MP[k])} por unidad de producción<input type="number" min="0" step="1" data-compra="${k}" value="${e(draft.comprasUnidades[k]||0)}" ${frozen?'disabled':''}><small>Costo bruto de 1 compra: ${money(cfg().CONVERSION_COMPRA[k]*cfg().PRECIO_MP[k])}. 1 compra = ${cfg().CONVERSION_COMPRA[k]} ${k.startsWith('INS-0')&&['INS-01','INS-02','INS-03'].includes(k)?'m²':['INS-04','INS-05'].includes(k)?'u':'m'}</small></label>`).join('')}</div></details><details data-excel-section="B"><summary>Activos disponibles en el ciclo</summary><p>Compra una única mesa y al menos un molde para fabricar. Los activos se conservan entre ciclos.</p><div class="excel-grid">${Object.keys(cfg().MAQUINARIA).map(k=>`<label>${e(k==='mesa'?'Mesa de corte':root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)}<input type="number" min="0" ${actual&&k==='mesa'?'max="1"':''} step="1" data-activo="${k}" value="${e(draft.maquinaria[k]||0)}" ${frozen?'disabled':''}>${costoActivoHtml(k,draft.regimen)}</label>`).join('')}</div></details>
          <div data-excel-section="C" data-excel-lotes>${draft.lotes.map((l,i)=>loteHtml(l,i,frozen)).join('')}</div><button type="button" data-excel-section="C" class="side-button" data-agregar-lote ${frozen||draft.lotes.length>=cfg().MAX_LOTES?'disabled':''}>Agregar lote</button>
          <div data-excel-preview></div><div class="excel-actions"><button type="button" data-excel-guardar class="side-button" ${frozen?'disabled':''}>Guardar borrador de lotes</button><button type="button" data-excel-enviar class="side-button side-button--primary" ${frozen?'disabled':''}>Confirmar plan del ciclo</button></div><p data-excel-status role="status">${confirmed?'Plan del ciclo confirmado.':stored.round?'Último guardado: ciclo '+e(stored.round):'Completa y confirma el plan para participar en el cierre.'}</p>`:''}</section>`;
      if(actual&&context.category){for(const el of container.querySelectorAll('[data-excel-section]'))if(el.dataset.excelSection!==context.category)el.remove();for(const el of container.querySelectorAll('.excel-grid'))if(!el.querySelector('input,select,button'))el.remove();for(const el of container.querySelectorAll('details'))if(el.querySelector('summary')?.textContent==='Decisiones del ciclo'&&!el.querySelector('input,select,button'))el.remove();}
      for(const el of container.querySelectorAll('details'))if(opened.includes(el.querySelector('summary')?.textContent))el.open=true;
      feedback();
    }
    container.oninput=event=>{
      const el=event.target;if(locked||confirmed)return;if(el.type==='number'&&Number(el.value)<0)el.value='0';
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
    container.onchange=event=>{if(event.target.matches('[data-excel-enable]')){enabled=event.target.checked;stored={...stored,habilitado:enabled,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:false};context.save(stored);render();}else container.oninput(event);};
    container.onclick=event=>{
      const el=event.target.closest('button');if(!el||el.disabled)return;
      if(el.hasAttribute('data-agregar-lote')){draft.lotes.push(nuevoLote());persistDraft();render();}
      if(el.dataset.quitarLote!==undefined){draft.lotes.splice(Number(el.dataset.quitarLote),1);persistDraft();render();}
      if(el.hasAttribute('data-excel-importar')){const imported=context.importar?.();if(imported){draft.personal=imported.personal;draft.seleccion=[...draft.seleccion.filter(k=>!imported.seleccion.some(v=>root.SIDE_EXCEL_PUNTAJES.indice[v]?.grupo===root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo)),...imported.seleccion];}persistDraft();render();}
      if(el.hasAttribute('data-excel-guardar')||el.hasAttribute('data-excel-enviar')){
        const enviar=el.hasAttribute('data-excel-enviar'),error=enviar?validar(draft,context.motorVersion):'';
        if(error){container.querySelector('[data-excel-status]').textContent=error;return;}
        stored={...stored,habilitado:true,motor_version:context.motorVersion||stored.motor_version,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:enviar};if(enviar)stored.planesPorCiclo={...stored.planesPorCiclo,[context.round]:clone(stored.decisiones)};context.save(stored);confirmed=enviar;render();container.querySelector('[data-excel-status]').textContent=enviar?'Plan del ciclo confirmado.':'Borrador guardado.';
      }
    };
    render();
  }
  const cierreKey=(game,ciclo)=>`SIDE_EXCEL_CIERRE_${game}_${ciclo}`;
  const historiaKey=game=>`SIDE_EXCEL_HISTORIAL_${game}`;
  function leer(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
  function historial(game,id){return leer(historiaKey(game),{})[id]||{};}
  function resultado(game,ciclo,id){return leer(cierreKey(game,ciclo),{}).resultadosPorEmpresa?.[id]||null;}
  function cerrarLocal({game,ciclo,reports,motorVersion}){
    motorVersion=motorVersion||reports.find(r=>r.partida===game&&r.excelDecisionState?.motor_version)?.excelDecisionState.motor_version;
    const actual=motorVersion===root.SIDE_EXCEL_CONFIG.MOTOR_ACTUAL,overrides=motorOverrides(motorVersion);
    const participantes=reports.filter(r=>r.partida===game&&(actual||r.excelDecisionState?.habilitado)&&Number(r.excelDecisionState?.cicloActivacion??1)<=Number(ciclo));
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
  root.SIDE_EXCEL_UI=Object.freeze({mountEditor,nuevasDecisiones,prepararDecisiones,resumenHtml,validar,cerrarLocal,historial,resultado,cierreKey,historiaKey,costoLaboralHtml,costoActivoHtml});
}(typeof globalThis!=='undefined'?globalThis:this));
