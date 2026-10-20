(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG,node?require('./puntajes.js'):root.SIDE_EXCEL_PUNTAJES,node?require('./produccion.js'):root.SIDE_EXCEL_PRODUCCION,node?require('./costos.js'):root.SIDE_EXCEL_COSTOS,node?require('./consecuencias.js'):root.SIDE_EXCEL_CONSECUENCIAS,node?require('./mercado.js'):root.SIDE_EXCEL_MERCADO);if(node)module.exports=api;else root.SIDE_EXCEL_CICLO=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,P,PRO,COS,CON,MER){
  'use strict';
  const copia=v=>JSON.parse(JSON.stringify(v));
  const claveLote=l=>[l.segmento,l.molde,l.cuero||'',l.accesorios||'',l.hilo||'',Number(l.precio||0)].join('|');
  // Al vencer un ciclo no se inventan compras, préstamos ni producción.
  // Los compromisos recurrentes conservan vigencia incluso sin un nuevo envío.
  function decisionesSinEnvio(historial={}){
    return {...copia(historial.decisiones||{}),seleccion:(historial.decisiones?.seleccion||[]).filter(k=>k!=='FIN-01A'),lotes:[],compras:{},comprasUnidades:{},montoPrestamo:0,garantiaDias:historial.decisiones?.garantiaDias??null,mantenimientoPreventivo:!!historial.decisiones?.mantenimientoPreventivo,marketingNivel:historial.decisiones?.marketingNivel??null,local:true,limpieza:true};
  }
  function normalizarActual(decisiones,historial,c){
    const d={...decisiones,local:true,limpieza:true,garantiaDias:decisiones.garantiaDias??null,mantenimientoPreventivo:!!decisiones.mantenimientoPreventivo};
    const ocultos=['Numero de proveedores','Politica de pago a proveedores','Lead time','Mantenimiento de maquinaria','Política de inventarios','Método de depreciación'];
    d.seleccion=[...new Set(d.seleccion||[])].filter(k=>!ocultos.includes(P.indice[k]?.grupo));
    d.montoPrestamo=Math.max(0,Number(d.montoPrestamo)||0);
    d.seleccion=d.seleccion.filter(k=>!['FIN-01A','FIN-01B'].includes(k)).concat(d.montoPrestamo>0?'FIN-01A':'FIN-01B');
    d.maquinaria={...d.maquinaria};if(d.maquinaria.mesa!==undefined)d.maquinaria.mesa=Math.min(1,Math.max(0,Math.floor(Number(d.maquinaria.mesa)||0)));
    d.tiendasPorDistrito={};d.contratosTiendas={...historial.contratosTiendas};
    for(const distrito of Object.keys(c.COSTOS_TIENDAS)){
      const previo=historial.contratosTiendas?.[distrito],dentro=previo&&Number(d.ciclo||1)<previo.desde+c.CONTRATO_TIENDA_CICLOS;
      const cantidad=Math.max(dentro?previo.cantidad:0,Math.max(0,Math.floor(Number(decisiones.tiendasPorDistrito?.[distrito])||0)));
      d.tiendasPorDistrito[distrito]=cantidad;
      if(cantidad>(previo?.cantidad||0))d.contratosTiendas[distrito]={cantidad,desde:Number(d.ciclo||1)};
    }
    // Un borrador incompleto permanece registrado; solo lotes fabricables pasan
    // al motor y los activos no comprados nunca producen por el mero selector.
    const activos={...historial.maquinariaActivos,...d.maquinaria};
    d.lotes=(d.lotes||[]).filter(l=>c.CONSUMO_MOLDE[l.molde]&&Number(l.cantidad)>0&&Number(l.precio)>0).map(l=>({...l}));
    if(!(Number(activos.mesa)>=1))d.lotes=[];
    d.lotes=d.lotes.filter(l=>Number(activos[l.molde])>=1);
    return d;
  }
  function prepararEmpresa(decisiones,historial={},overrides={}){
    const c=C.configurar(overrides);
    if(c.NUEVO_MODELO)decisiones=normalizarActual(decisiones,historial,c);
    const maquinaria={...historial.maquinariaActivos};
    for(const [codigo,cantidad] of Object.entries(decisiones.maquinaria||{}))maquinaria[codigo]=Math.max(Number(maquinaria[codigo]||0),Number(cantidad)||0);
    decisiones={...decisiones,maquinaria};
    const puntajes=P.calcularPuntajes(decisiones,overrides);
    const produccion=PRO.calcularProduccion({...decisiones,inventarioInicial:historial.inventarioMP||decisiones.inventarioInicial||{}},overrides);
    const pre=CON.evaluarConsecuencias({puntajes,lotes:puntajes.lotes,jefes:decisiones.jefes,planeado:produccion.totalPlaneado,capacidad:produccion.produccionCapacidad},historial,overrides);
    // El factor reduce cada lote ya limitado por capacidad y MP; solo se consume lo que se fabrica.
    for(const l of produccion.lotes){const anterior=l.producido;l.producido=C.excelRoundDown(Number((anterior*pre.efectos.factorProduccion).toPrecision(c.PRECISION_INVENTARIO)));const ratio=anterior?l.producido/anterior:0;for(const [codigo,valor] of Object.entries(l.consumoPorInsumo)){const nuevo=valor*ratio;produccion.consumoPorInsumo[codigo]-=valor-nuevo;produccion.inventarioFinal[codigo]+=valor-nuevo;l.consumoPorInsumo[codigo]=nuevo;}for(const familia of Object.keys(l.consumo)){produccion.consumoTotal[familia]-=l.consumo[familia]*(1-ratio);l.consumo[familia]*=ratio;}}
    for(const mapa of [produccion.consumoTotal,produccion.consumoPorInsumo,produccion.inventarioFinal,...produccion.lotes.flatMap(l=>[l.consumo,l.consumoPorInsumo])])for(const k of Object.keys(mapa))mapa[k]=Number(mapa[k].toPrecision(c.PRECISION_INVENTARIO));
    produccion.totalProducido=produccion.lotes.reduce((a,l)=>a+l.producido,0);
    const costos=COS.calcularCostos({...decisiones,compras:produccion.compras,consumoMP:produccion.consumoPorInsumo,inventarioInicial:produccion.inventarioInicial,produccion},overrides);
    if(c.NUEVO_MODELO){
      costos.detallesRecurrentes=COS.costosCanales(decisiones,c).detalles.concat((decisiones.seleccion||[]).filter(k=>c.CODIGOS_COSTO_RECURRENTE.includes(k)&&P.indice[k]?.grupo==='Inversion en RR.HH.').map(codigo=>({codigo,costo:Number(P.indice[codigo]?.costo||0)})));
      costos.costosEstimados=costos.totalCostos+costos.detallesRecurrentes.reduce((s,d)=>s+d.costo,0);
    }
    const consecuencias=CON.evaluarConsecuencias({puntajes,lotes:puntajes.lotes,jefes:decisiones.jefes,planeado:produccion.totalPlaneado,capacidad:produccion.produccionCapacidad,costoMOciclo:costos.costoMOciclo},historial,overrides);
    let reputacionMercado=c.REPUTACION_FUENTE_MERCADO==='motor'?puntajes.reputacionMatriz:costos.reputacionOperativa;
    if(c.REPUTACION_FUENTE_MERCADO==='excel_literal')reputacionMercado=Number(decisiones.reputacionLiteral||0);
    reputacionMercado+=consecuencias.efectos.reputacionCambio;
    return {puntajes,produccion,costos,consecuencias,reputacionMercado,reputacionMatriz:consecuencias.efectos.reputacionFinal,decisionesAplicadas:decisiones,lotes:produccion.lotes.map((l,i)=>({...l,...puntajes.lotes[i],producido:l.producido,precioEfectivo:Number(l.precio||0)*consecuencias.efectos.precios[i]}))};
  }
  function cerrarCiclo({ciclo=1,empresas=[],decisionesPorEmpresa={},borradoresPorEmpresa={},historialPorEmpresa={}},overrides={}){
    const c=C.configurar(overrides),resultadosPorEmpresa={},historialNuevo=copia(historialPorEmpresa),eliminadas=[],replicadas=[],autoenviadas=[];
    for(const empresa of empresas){const id=typeof empresa==='string'?empresa:empresa.id;if(typeof empresa==='object'&&empresa.eliminada)continue;const anterior=historialPorEmpresa[id]||{};let d=decisionesPorEmpresa[id];if(!d){if(c.NUEVO_MODELO){d=borradoresPorEmpresa[id]?copia(borradoresPorEmpresa[id]):decisionesSinEnvio(anterior);if(borradoresPorEmpresa[id])autoenviadas.push(id);}else{if(ciclo===1||!anterior.decisiones){eliminadas.push(id);historialNuevo[id]={...anterior,eliminada:true};continue;}d=copia(anterior.decisiones);replicadas.push(id);}}
      if(anterior.eliminada){eliminadas.push(id);continue;}
      const r=prepararEmpresa({...d,ciclo},anterior,overrides);r.id=id;r.decisiones=copia(c.NUEVO_MODELO?r.decisionesAplicadas:d);r.envioAutomatico=autoenviadas.includes(id);r.ciclo=ciclo;r.ventas=[];r.inventarioProductos=copia(anterior.inventarioProductos||{});
      for(const l of r.lotes){const key=claveLote(l),stock=r.inventarioProductos[key]||{...l,cantidad:0};stock.cantidad+=l.producido;r.inventarioProductos[key]=stock;}
      resultadosPorEmpresa[id]=r;
    }
    for(const segmento of Object.keys(c.MERCADOS)){
      const participantes=Object.values(resultadosPorEmpresa).flatMap(r=>{
        const lotes=r.lotes.filter(l=>l.segmento===segmento&&l.cantidad>0);const stock=Object.values(r.inventarioProductos).filter(l=>l.segmento===segmento&&l.cantidad>0);if(!lotes.length&&!stock.length)return [];
        const usados=lotes.length?lotes:stock,total=usados.reduce((a,l)=>a+l.cantidad,0);
        return [{id:r.id,precio:usados.reduce((a,l)=>a+Number(l.precio||0)*l.cantidad,0)/total,reputacionMercado:r.reputacionMercado,calidadEmpresaMotor:r.puntajes.calidadEmpresaMotor}];
      });
      const reparto=MER.repartoMercado(participantes,segmento,overrides);
      for(const asignacion of reparto){const r=resultadosPorEmpresa[asignacion.id];let pendiente=Math.max(0,C.excelRoundDown(asignacion.asignado*r.consecuencias.efectos.factorDemanda*((r.decisiones.seleccion||[]).includes('INV-02B')?1+c.BONO_DEMANDA_MARKETING:1)));const asignado=pendiente;
        for(const [key,stock] of Object.entries(r.inventarioProductos)){if(stock.segmento!==segmento||stock.cantidad<=0)continue;const vendido=Math.min(stock.cantidad,pendiente),actual=r.lotes.find(l=>claveLote(l)===key),precioEfectivo=actual?.precioEfectivo??stock.precioEfectivo??Number(stock.precio||0);r.ventas.push({clave:key,segmento,vendido,precioEfectivo,ingreso:vendido*precioEfectivo});stock.cantidad-=vendido;pendiente-=vendido;}
        (r.mercado||=([])).push({...asignacion,demandaAjustada:asignado});
      }
    }
    for(const [id,r] of Object.entries(resultadosPorEmpresa)){
      r.unidadesVendidas=r.ventas.reduce((a,l)=>a+l.vendido,0);r.ingresos=r.ventas.reduce((a,l)=>a+l.ingreso,0);r.inventarioSinVender=Object.values(r.inventarioProductos).reduce((a,l)=>a+l.cantidad,0);
      const extra=CON.evaluarConsecuencias({puntajes:r.puntajes,lotes:r.puntajes.lotes,jefes:r.decisiones.jefes,producido:r.produccion.totalProducido,demanda:r.unidadesVendidas},historialPorEmpresa[id]||{},overrides);
      const almacenaje=r.inventarioSinVender*c.COSTO_ALMACENAJE_UNIDAD;r.consecuencias.mensajes.push(...extra.mensajes.filter(m=>m.id==='CONS-07'));r.costos.costoAlmacenaje=almacenaje;
      const garantia=c.GRUPOS_MOTOR.includes('Garantía del producto')&&(r.decisiones.seleccion||[]).map(k=>P.indice[k]).find(o=>o?.grupo==='Garantía del producto');r.costos.costoGarantia=Object.hasOwn(r.decisiones,'garantiaDias')?0:(garantia?.costo||0)*r.unidadesVendidas;
      r.costos.detallesRecurrentes=(r.decisiones.seleccion||[]).filter(codigo=>c.CODIGOS_COSTO_RECURRENTE.includes(codigo)&&c.GRUPOS_MOTOR.includes(P.indice[codigo]?.grupo)&&!(c.NUEVO_MODELO&&P.indice[codigo]?.grupo==='Canal de venta')&&!(Object.hasOwn(r.decisiones,'marketingNivel')&&P.indice[codigo]?.grupo==='Inversion en marketing')).map(codigo=>({codigo,costo:Number(P.indice[codigo]?.costo||0)*c.CICLO_EQUIVALE_A_MESES}));
      if(c.NUEVO_MODELO){const canales=COS.costosCanales(r.decisiones,c);r.costos.detallesRecurrentes.push(...canales.detalles);r.costos.costoComisionVentas=canales.tiendas>0?r.ingresos*c.COMISION_VENTAS_TIENDA:0;r.costos.detallesRecurrentes.push({codigo:'comisionVentas',costo:r.costos.costoComisionVentas});}
      r.costos.costoDecisionesRecurrentes=r.costos.detallesRecurrentes.reduce((total,detalle)=>total+detalle.costo,0);
      r.costosTotales=r.costos.totalCostos+almacenaje+r.consecuencias.efectos.costoHorasExtra+r.costos.costoGarantia+r.costos.costoDecisionesRecurrentes;r.utilidad=r.ingresos-r.costosTotales;
      // El Excel no define calendario de cuotas: la tasa se informa al préstamo siguiente.
      const montoPrestamo=(r.decisiones.seleccion||[]).includes('FIN-01A')?Math.max(0,Number(r.decisiones.montoPrestamo)||0):0;
      const penalizacionPendiente=montoPrestamo>0?r.consecuencias.efectos.tasaAdicionalPP:Math.max(Number(historialPorEmpresa[id]?.tasaAdicionalPP||0),r.consecuencias.efectos.tasaAdicionalPP);
      r.financiamiento={montoPrestamo,tasaTEA:Number(r.decisiones.teaBase??c.TEA_BASE)+Number(historialPorEmpresa[id]?.tasaAdicionalPP||0),tasaAdicionalProximoPrestamo:penalizacionPendiente,deudaPrincipal:Number(historialPorEmpresa[id]?.deudaPrincipal||0)+montoPrestamo};
      r.puntajes.niveles.reputacion=P.nivel(r.reputacionMatriz,overrides);
      historialNuevo[id]={decisiones:copia(r.decisiones),contratosTiendas:copia(r.decisiones.contratosTiendas||{}),inventarioMP:copia(r.produccion.inventarioFinal),inventarioProductos:copia(r.inventarioProductos),ciclosReputacionBaja:r.consecuencias.efectos.ciclosReputacionBaja,tasaAdicionalPP:penalizacionPendiente,deudaPrincipal:r.financiamiento.deudaPrincipal,ultimoCiclo:ciclo};
    }
    return {ciclo,motor_version:c.VERSION,resultadosPorEmpresa,historialPorEmpresa:historialNuevo,eliminadas,replicadas,autoenviadas};
  }
  return {prepararEmpresa,cerrarCiclo,claveLote,decisionesSinEnvio};
});


