(function(root){
  'use strict';
  const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const cat=()=>root.SIDE_EXCEL_CATALOGO;
  const cfg=()=>root.SIDE_EXCEL_CONFIG.CONFIG;
  const numero=value=>Math.max(0,Number(value)||0);
  const format=value=>Number(value||0).toLocaleString('es-PE',{maximumFractionDigits:4});
  const money=value=>'S/ '+Number(value||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const areas={corte:'Corte',ensamble:'Ensamble',acabado:'Acabado'};
  const maquinas=['Manual','Semiindustrial','Industrial'];
  const grupos=()=>cfg().DECISIONES_VISIBLES.filter(g=>cat().some(o=>o.grupo===g));
  const opcionesGrupo=grupo=>cat().filter(o=>o.grupo===grupo);
  const filasFamilia=familia=>cfg().INSUMOS_POR_FAMILIA[familia].map(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]);
  const nuevoLote=()=>({segmento:'',cantidad:0,cuero:'',accesorios:'',hilo:'',molde:'',precio:0});
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
  function opciones(rows,selected,empty='Elegir…'){return `<option value="">${e(empty)}</option>`+rows.map(o=>`<option value="${e(o.codigo)}" ${o.codigo===selected?'selected':''}>${e(o.opcion)}</option>`).join('');}
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
      <p>Costos ${preview?'estimados':'del ciclo'}: <b>${money(r.financial?.estadoResultados.costos??r.costosTotales??r.costos.totalCostos)}</b>${preview?'':` · Ventas: <b>${format(r.unidadesVendidas)}</b> · Ingreso: <b>${money(r.ingresos)}</b> · Utilidad: <b>${money(r.financial?.estadoResultados.utilidad??r.utilidad)}</b>`}</p>
      ${r.financial?`<p>Caja inicial: <b>${money(r.financial.balanceCaja.cajaInicial)}</b> · Caja final: <b>${money(r.financial.balanceCaja.cajaFinal)}</b> · Intereses: <b>${money(r.financial.estadoResultados.intereses)}</b></p>`:''}
      ${preview?'<p class="excel-help">Las ventas se calculan al cierre entre las empresas del mismo segmento.</p>':''}
      <details><summary>Inventario de materia prima al cierre</summary><ul>${Object.entries(pro.inventarioFinal).map(([k,v])=>`<li>${e(root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)}: ${format(v)}</li>`).join('')}</ul></details>
      ${r.inventarioProductos?`<p>Productos sin vender: <b>${format(r.inventarioSinVender)}</b></p>`:''}
      <ul class="excel-mensajes">${r.consecuencias.mensajes.map(m=>`<li>${e(m.texto)}</li>`).join('')}</ul></section>`;
  }
  function validar(d){
    if(!d.lotes.length)return 'Agrega al menos un lote.';
    if(d.lotes.some(l=>!l.segmento||!l.molde||numero(l.cantidad)<1||numero(l.precio)<=0))return 'Completa segmento, molde, cantidad y precio de cada lote.';
    return '';
  }
  function mountEditor(container,context){
    if(!container)return;
    let stored=context.getState()||{},draft=Object.assign(nuevasDecisiones(),clone(stored.decisiones||{})),enabled=!!stored.habilitado;
    draft.personal=root.SIDE_EXCEL_PRODUCCION.normalizarPersonal(draft.personal);
    draft.tiendasPorDistrito={los_olivos:0,miraflores:0,sjl:0,...draft.tiendasPorDistrito};
    for(const [codigo,owned] of Object.entries(context.historial?.maquinariaActivos||{}))draft.maquinaria[codigo]=Math.max(numero(draft.maquinaria[codigo]),numero(owned));
    let locked=!!context.locked,confirmed=Number(stored.round)===Number(context.round)&&stored.enviado;
    const local=context.local!==false;
    const remoteReady=local||context.remoteReady!==false;
    function feedback(){
      container.querySelectorAll('[data-calidad-lote]').forEach(el=>{const l=root.SIDE_EXCEL_PUNTAJES.evaluarLote(draft.lotes[Number(el.dataset.calidadLote)]);el.textContent=`Calidad ${format(l.calidad)} · Umbral ${format(l.umbral)} · ${l.resultado||'Elige un segmento'}. ${l.mensaje}`;});
      const preview=container.querySelector('[data-excel-preview]');if(!preview)return;
      try{const d=prepararDecisiones(draft);preview.innerHTML=resumenHtml(root.SIDE_EXCEL_CICLO.prepararEmpresa({...d,ciclo:context.round},context.historial||{}),{preview:true});}catch(error){preview.textContent='Completa los moldes y las decisiones para ver la proyección.';}
    }
    function render(){
      const frozen=locked||confirmed;
      container.innerHTML=`<section class="excel-editor" aria-labelledby="excelEditorTitle"><header><img src="assets/icons/categories/recursos_humanos.svg" alt=""><div><h2 id="excelEditorTitle">Plan de producción por lotes</h2><p>Organiza personal, materiales y segmento para cada lote.</p></div></header>
        <p class="excel-help">El docente cierra las ventas de todas las empresas participantes desde su panel. Caja, costos, compras y préstamos se registran una sola vez al cerrar el ciclo.</p>
        <label class="excel-toggle"><input type="checkbox" data-excel-enable ${enabled?'checked':''} ${locked||confirmed||!remoteReady||context.activationBlocked?'disabled':''}>Usar el modelo por lotes en esta empresa</label>
        ${context.activationBlocked?'<p>Este ciclo ya tiene compras o pagos confirmados. Activa el plan por lotes al comenzar el próximo ciclo, antes de registrar operaciones. Se conservarán caja, activos y deuda anteriores.</p>':''}
        ${!local?(remoteReady?'<p>Confirma el plan para sincronizarlo con la partida.</p>':'<p>Falta habilitar el cierre por lotes en el servidor. El flujo anterior permanece disponible. El docente debe aplicar supabase/migrations/2026-10-11_logica_excel.sql. También puede iniciar una partida local de prueba.</p>'):''}
        ${enabled?`<div class="excel-grid"><label>Régimen laboral<select data-excel-regimen ${frozen?'disabled':''}><option value="MYPE" ${draft.regimen==='MYPE'?'selected':''}>MYPE</option><option value="NO_MYPE" ${draft.regimen==='NO_MYPE'?'selected':''}>No MYPE</option></select></label><label>Inversión en marketing<select data-excel-marketing ${frozen?'disabled':''}><option value="">Elegir…</option>${Object.entries(cfg().MARKETING_BASE).map(([key,m])=>`<option value="${key}" ${draft.marketingNivel===key?'selected':''}>${e(key[0].toUpperCase()+key.slice(1))} · ${money(m.costo)}</option>`).join('')}</select></label><label>Préstamo solicitado (S/)<input type="number" min="0" step="0.01" value="${e(draft.montoPrestamo)}" data-excel-prestamo ${frozen?'disabled':''}></label></div>
          <details><summary>Tiendas</summary><p>Se conservan los distritos del juego. La equivalencia con zonas del Excel está pendiente de confirmación.</p><div class="excel-grid">${Object.entries(cfg().DISTRITOS_TIENDAS).map(([key,label])=>`<label>Tiendas en ${e(label)} (unidades)<input type="number" min="0" step="1" value="${draft.tiendasPorDistrito[key]}" data-excel-tienda="${key}" ${frozen?'disabled':''}></label>`).join('')}</div></details>
          <details><summary>Decisiones del ciclo</summary><p>Las opciones sin elegir aportan cero. Un material faltante también aporta cero a la calidad y puede impedir producir.</p><div class="excel-grid">${grupos().map((g,i)=>`<label>${e(g)}<select data-excel-grupo="${i}" ${frozen?'disabled':''}>${opciones(opcionesGrupo(g),draft.seleccion.find(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo===g))}</select></label>`).join('')}<label>Garantía de productos terminados<select data-excel-garantia ${frozen?'disabled':''}><option value="">Elegir…</option>${cfg().GARANTIA_DIAS_BASE.map(d=>`<option value="${d}" ${Number(draft.garantiaDias)===d?'selected':''}>Cobertura comercial ${d} días</option>`).join('')}</select></label><label><input type="checkbox" data-excel-mantenimiento ${draft.mantenimientoPreventivo?'checked':''} ${frozen?'disabled':''}> Mantenimiento preventivo opcional (${money(cfg().COSTO_MANTENIMIENTO_BASE)})</label></div><p>La equivalencia Excel de la garantía de 180 días y del mantenimiento de S/ 200 está pendiente de definición.</p></details>
          <details><summary>Personal por nivel y máquina</summary><p>La cantidad corresponde a operarios. Corte utiliza la columna manual.</p><button type="button" data-excel-importar class="side-button" ${frozen?'disabled':''}>Importar personal de mis decisiones</button><div class="excel-table-wrap"><table><thead><tr><th>Área y nivel</th>${maquinas.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${Object.entries(areas).flatMap(([a,label])=>[0,1,2].map(n=>`<tr><th>${label} N${n+1}</th>${[0,1,2].map(m=>`<td><input aria-label="${label} nivel ${n+1} ${maquinas[m]}" data-personal="${a},${n},${m}" type="number" min="0" step="1" value="${draft.personal[a][n][m]}" ${frozen||a==='corte'&&m!==0?'disabled':''}></td>`).join('')}</tr>`)).join('')}</tbody></table></div></details>
          <details><summary>Compras de materiales y maquinaria</summary><p>Declara cantidades de compra: rollos, pieles completas, juegos y carretes. La materia prima sobrante se conserva.</p><div class="excel-grid"><label><input type="checkbox" data-excel-analista ${draft.analistaCompras?'checked':''} ${frozen?'disabled':''}> Contratar analista de compras (${money(cfg().ANALISTA_BASE.costo)} por ciclo)</label><label>Garantía de proveedores<select data-excel-garantia-proveedor ${frozen?'disabled':''}>${cfg().GARANTIA_PROVEEDOR_BASE.map(p=>`<option value="${p}" ${Number(draft.garantiaProveedor)===p?'selected':''}>${p?p+'% de devolución':'Sin garantía'}</option>`).join('')}</select></label></div><p>El analista negocia ${format(root.SIDE_EXCEL_COSTOS.descuentoAnalista(context.round))}% en materiales este ciclo. La garantía se conserva; las devoluciones requieren un evento de falla cubierto, que el Excel no define.</p><div class="excel-grid">${Object.keys(cfg().CONVERSION_COMPRA).map(k=>`<label>${e(root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)}<input type="number" min="0" step="1" data-compra="${k}" value="${e(draft.comprasUnidades[k]||0)}" ${frozen?'disabled':''}><small>1 compra = ${cfg().CONVERSION_COMPRA[k]} ${k.startsWith('INS-0')&&['INS-01','INS-02','INS-03'].includes(k)?'m²':['INS-04','INS-05'].includes(k)?'u':'m'}</small></label>`).join('')}</div><p>Activos disponibles en el ciclo</p><div class="excel-grid">${Object.keys(cfg().MAQUINARIA).map(k=>`<label>${e(k==='mesa'?'Mesa de corte':root.SIDE_EXCEL_PUNTAJES.indice[k]?.opcion)}<input type="number" min="0" step="1" data-activo="${k}" value="${e(draft.maquinaria[k]||0)}" ${frozen?'disabled':''}></label>`).join('')}</div></details>
          <div data-excel-lotes>${draft.lotes.map((l,i)=>loteHtml(l,i,frozen)).join('')}</div><button type="button" class="side-button" data-agregar-lote ${frozen||draft.lotes.length>=cfg().MAX_LOTES?'disabled':''}>Agregar lote</button>
          <div data-excel-preview></div><div class="excel-actions"><button type="button" data-excel-guardar class="side-button" ${frozen?'disabled':''}>Guardar borrador de lotes</button><button type="button" data-excel-enviar class="side-button side-button--primary" ${frozen?'disabled':''}>Confirmar plan del ciclo</button></div><p data-excel-status role="status">${confirmed?'Plan del ciclo confirmado.':stored.round?'Último guardado: ciclo '+e(stored.round):'Completa y confirma el plan para participar en el cierre.'}</p>`:''}</section>`;
      feedback();
    }
    container.oninput=event=>{
      const el=event.target;if(locked||confirmed)return;
      if(el.dataset.lote!==undefined){const campo=el.dataset.campo;draft.lotes[Number(el.dataset.lote)][campo]=['cantidad','precio'].includes(campo)?numero(el.value):el.value;}
      else if(el.dataset.personal){const [a,n,m]=el.dataset.personal.split(',');draft.personal[a][n][m]=Math.floor(numero(el.value));}
      else if(el.dataset.compra)draft.comprasUnidades[el.dataset.compra]=numero(el.value);
      else if(el.dataset.activo){const owned=numero(context.historial?.maquinariaActivos?.[el.dataset.activo]);draft.maquinaria[el.dataset.activo]=Math.max(owned,Math.floor(numero(el.value)));el.value=draft.maquinaria[el.dataset.activo];}
      else if(el.dataset.excelGrupo!==undefined){const g=grupos()[Number(el.dataset.excelGrupo)];draft.seleccion=draft.seleccion.filter(k=>root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo!==g);if(el.value)draft.seleccion.push(el.value);}
      else if(el.matches('[data-excel-regimen]'))draft.regimen=el.value;
      else if(el.matches('[data-excel-prestamo]'))draft.montoPrestamo=numero(el.value);
      else if(el.dataset.excelTienda&&Object.hasOwn(cfg().DISTRITOS_TIENDAS,el.dataset.excelTienda))draft.tiendasPorDistrito[el.dataset.excelTienda]=Math.floor(numero(el.value));
      else if(el.matches('[data-excel-garantia]'))draft.garantiaDias=cfg().GARANTIA_DIAS_BASE.includes(Number(el.value))?Number(el.value):null;
      else if(el.matches('[data-excel-mantenimiento]'))draft.mantenimientoPreventivo=!!el.checked;
      else if(el.matches('[data-excel-marketing]'))draft.marketingNivel=Object.hasOwn(cfg().MARKETING_BASE,el.value)?el.value:null;
      else if(el.matches('[data-excel-analista]'))draft.analistaCompras=!!el.checked;
      else if(el.matches('[data-excel-garantia-proveedor]'))draft.garantiaProveedor=cfg().GARANTIA_PROVEEDOR_BASE.includes(Number(el.value))?Number(el.value):0;
      feedback();
    };
    container.onchange=event=>{if(event.target.matches('[data-excel-enable]')){enabled=event.target.checked;stored={...stored,habilitado:enabled,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:false};context.save(stored);render();}else container.oninput(event);};
    container.onclick=event=>{
      const el=event.target.closest('button');if(!el||el.disabled)return;
      if(el.hasAttribute('data-agregar-lote')){draft.lotes.push(nuevoLote());render();}
      if(el.dataset.quitarLote!==undefined){draft.lotes.splice(Number(el.dataset.quitarLote),1);render();}
      if(el.hasAttribute('data-excel-importar')){const imported=context.importar?.();if(imported){draft.personal=imported.personal;draft.seleccion=[...draft.seleccion.filter(k=>!imported.seleccion.some(v=>root.SIDE_EXCEL_PUNTAJES.indice[v]?.grupo===root.SIDE_EXCEL_PUNTAJES.indice[k]?.grupo)),...imported.seleccion];}render();}
      if(el.hasAttribute('data-excel-guardar')||el.hasAttribute('data-excel-enviar')){
        const enviar=el.hasAttribute('data-excel-enviar'),error=enviar?validar(draft):'';
        if(error){container.querySelector('[data-excel-status]').textContent=error;return;}
        stored={...stored,habilitado:true,version:1,round:context.round,decisiones:prepararDecisiones(draft),enviado:enviar};if(enviar)stored.planesPorCiclo={...stored.planesPorCiclo,[context.round]:clone(stored.decisiones)};context.save(stored);confirmed=enviar;render();container.querySelector('[data-excel-status]').textContent=enviar?'Plan del ciclo confirmado.':'Borrador guardado.';
      }
    };
    render();
  }
  const cierreKey=(game,ciclo)=>`SIDE_EXCEL_CIERRE_${game}_${ciclo}`;
  const historiaKey=game=>`SIDE_EXCEL_HISTORIAL_${game}`;
  function leer(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
  function historial(game,id){return leer(historiaKey(game),{})[id]||{};}
  function resultado(game,ciclo,id){return leer(cierreKey(game,ciclo),{}).resultadosPorEmpresa?.[id]||null;}
  function cerrarLocal({game,ciclo,reports}){
    const participantes=reports.filter(r=>r.partida===game&&r.excelDecisionState?.habilitado&&Number(r.excelDecisionState.cicloActivacion??1)<=Number(ciclo));
    if(!participantes.length)return null;
    const previo=leer(cierreKey(game,ciclo),null);let cierre=previo;
    if(!cierre){
      const decisionesPorEmpresa={};participantes.forEach(r=>{const d=r.excelDecisionState,plan=d.planesPorCiclo?.[ciclo]||(Number(d.round)===Number(ciclo)&&d.enviado?d.decisiones:null);if(plan)decisionesPorEmpresa[r.id]=prepararDecisiones(plan);});
      const baseHistoria=leer(historiaKey(game),{}),historialAnterior=root.SIDE_EXCEL_CAJA?root.SIDE_EXCEL_CAJA.sembrarTransicion(baseHistoria,participantes.map(r=>({id:r.id,envelope:r.excelDecisionState}))):baseHistoria;
      cierre=root.SIDE_EXCEL_CICLO.cerrarCiclo({ciclo,empresas:participantes.map(r=>r.id),decisionesPorEmpresa,historialPorEmpresa:historialAnterior});
      if(root.SIDE_EXCEL_CAJA)cierre=root.SIDE_EXCEL_CAJA.adjuntarCaja(cierre,{capitalPorEmpresa:Object.fromEntries(participantes.map(r=>[r.id,r.capital])),baseCajaPorEmpresa:Object.fromEntries(participantes.map(r=>[r.id,r.excelDecisionState.cajaTransicion??r.capital])),historialAnterior});
      localStorage.setItem(cierreKey(game,ciclo),JSON.stringify(cierre));localStorage.setItem(historiaKey(game),JSON.stringify(cierre.historialPorEmpresa));
    }
    participantes.forEach(r=>{const value=cierre.resultadosPorEmpresa[r.id];if(value){r.estadoResultados={...r.estadoResultados,excel:value,ingresos:value.ingresos,costos:value.costosTotales,utilidad:value.utilidad};Object.assign(r,{ingresos:value.ingresos,costos:value.costosTotales,utilidad:value.utilidad,ronda:ciclo,updatedAt:new Date().toISOString()});root.SIDE_EXCEL_CAJA?.aplicarReporte(r,value);}if(cierre.eliminadas.includes(r.id))r.estado='eliminada';});
    localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));return cierre;
  }
  root.SIDE_EXCEL_UI=Object.freeze({mountEditor,nuevasDecisiones,prepararDecisiones,resumenHtml,validar,cerrarLocal,historial,resultado,cierreKey,historiaKey});
}(typeof globalThis!=='undefined'?globalThis:this));
