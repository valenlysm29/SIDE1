(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG);if(node)module.exports=api;else root.SIDE_EXCEL_CAJA=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const numero=v=>Number.isFinite(Number(v))?Number(v):0;
  const copiar=v=>JSON.parse(JSON.stringify(v));
  // Un único libro por empresa/ciclo. Cada movimiento declara su efecto en
  // efectivo y resultado; las partidas sin efectivo también quedan auditadas.
  function crearLibro({empresaId,ciclo,cajaInicial,ingresos,prestamos,pagosOperacion,comprasActivos,costos,intereses}){
    const movimientos=[];
    const agregar=(id,concepto,actividad,efectivo,resultado=0)=>movimientos.push({id:`${empresaId}:${ciclo}:${id}`,concepto,actividad,efectivo:numero(efectivo),resultado:numero(resultado)});
    agregar('ventas','Cobros por ventas','operacion',ingresos,ingresos);
    let pagosDesglosados=0;
    for(const [i,d] of (costos.detalles?.manoObra||[]).entries()){
      if(!numero(d.costo))continue;
      agregar('personal-'+i,d.rol==='local'?'Alquiler del local':d.rol==='limpieza'?'Limpieza y servicios generales':`Personal de ${d.rol} nivel ${d.nivel}`,'operacion',-d.costo,-d.costo);
      pagosDesglosados+=numero(d.costo);
    }
    for(const [campo,concepto] of [['valorCompradoNeto','Compra de materia prima'],['costoMantenimiento','Mantenimiento'],['costoPublicidad','Marketing'],['costoAnalistaCompras','Analista de compras'],['costoAlmacenaje','Almacenaje'],['costoHorasExtra','Horas extra'],['costoLeadTime','Transporte de proveedores']]){
      const monto=numero(costos[campo]);if(!monto)continue;
      agregar(campo,concepto,'operacion',-monto,-monto);pagosDesglosados+=monto;
    }
    if(intereses){agregar('intereses','Intereses del préstamo','operacion',-intereses,-intereses);pagosDesglosados+=intereses;}
    const otros=numero(pagosOperacion)-pagosDesglosados;
    if(Math.abs(otros)>1e-9)agregar('otros','Servicios y compromisos del ciclo','operacion',-otros,-otros);
    // Compra de MP es salida de caja; solo el consumo es gasto del ciclo.
    agregar('inventario','Variación de materia prima','sin_efectivo',0,numero(costos.valorCompradoNeto)-numero(costos.valorConsumidoNeto));
    agregar('depreciacion','Depreciación del ciclo','sin_efectivo',0,-numero(costos.depreciacion));
    agregar('activos','Compra e instalación de equipos','inversion',-comprasActivos);
    agregar('prestamo','Desembolso del préstamo','financiamiento',prestamos);
    return {version:1,empresaId:String(empresaId),ciclo,cajaInicial:numero(cajaInicial),movimientos};
  }
  function resumirLibro(libro){
    const suma=fn=>libro.movimientos.reduce((total,m)=>total+numero(fn(m)),0);
    const entradas=suma(m=>Math.max(0,m.efectivo)),salidas=suma(m=>Math.max(0,-m.efectivo));
    const operacion=suma(m=>m.actividad==='operacion'?m.efectivo:0),inversion=suma(m=>m.actividad==='inversion'?m.efectivo:0),financiamiento=suma(m=>m.actividad==='financiamiento'?m.efectivo:0);
    return {entradas,salidas,cajaFinal:libro.cajaInicial+entradas-salidas,operacion,inversion,financiamiento,utilidad:suma(m=>m.resultado)};
  }
  function sembrarTransicion(historial,empresas){
    const out=copiar(historial||{});
    for(const empresa of empresas){const id=String(empresa.id),t=empresa.envelope?.transicion;if(!out[id]&&t)out[id]=copiar(t);}
    return out;
  }
  /** Único registro monetario del cierre. El ledger anterior queda fuera del
   * modelo una vez activado; baseCaja permite una transición explícita. */
  function adjuntarCaja(cierre,{capitalPorEmpresa={},baseCajaPorEmpresa={},historialAnterior={},overrides={}}={}){
    const cfg=C.configurar(overrides);
    const out=copiar(cierre);
    for(const [id,r] of Object.entries(out.resultadosPorEmpresa)){
      const h=historialAnterior[id]||{},capital=numero(capitalPorEmpresa[id]);
      const cajaInicial=numero(h.cajaFinal??baseCajaPorEmpresa[id]??capital),c=r.costos;
      const maquinaria=r.decisiones.maquinaria||{},prev=h.maquinariaActivos||{},conservada={...prev};
      for(const [codigo,cantidad] of Object.entries(maquinaria))conservada[codigo]=Math.max(numero(prev[codigo]),numero(cantidad));
      const comprasActivos=(c.detalles?.maquinaria||[]).reduce((sum,d)=>sum+d.salidaCompra*Math.max(0,numero(conservada[d.codigo])-numero(prev[d.codigo])),0);
      const adquisicionNeta=(c.detalles?.maquinaria||[]).reduce((sum,d)=>sum+d.adquisicion*Math.max(0,numero(conservada[d.codigo])-numero(prev[d.codigo])),0);
      const prestamos=numero(r.financiamiento?.montoPrestamo),depreciacion=numero(c.depreciacion);
      const tasaNuevoPrestamo=Math.pow(1+numero(r.financiamiento?.tasaTEA??cfg.TEA_BASE)/100,1/cfg.MESES_ANIO)-1;
      const tasaPrevia=numero(h.tasaMensualVigente??(Math.pow(1+numero(h.teaVigente??cfg.TEA_BASE)/100,1/cfg.MESES_ANIO)-1));
      const deudaPrevia=numero(h.deudaPrincipal),interesMensual=deudaPrevia*tasaPrevia+prestamos*tasaNuevoPrestamo;
      const tasaMensual=deudaPrevia+prestamos?interesMensual/(deudaPrevia+prestamos):0;
      const intereses=cfg.PRESTAMO_COBRAR_INTERES_CICLO?interesMensual*cfg.CICLO_EQUIVALE_A_MESES:0;
      const pagosOperacion=numero(r.costosTotales)-depreciacion-numero(c.valorConsumidoNeto)+numero(c.valorCompradoNeto)+intereses;
      const libro=crearLibro({empresaId:id,ciclo:out.ciclo,cajaInicial,ingresos:numero(r.ingresos),prestamos,pagosOperacion,comprasActivos,costos:c,intereses});
      const resumen=resumirLibro(libro),cajaFinal=cfg.NUEVO_MODELO?resumen.cajaFinal:cajaInicial+numero(r.ingresos)+prestamos-pagosOperacion-comprasActivos;
      const depAcumulada=numero(h.depreciacionAcumulada)+depreciacion,activosCosto=numero(h.activosCosto)+adquisicionNeta;
      const activosFijos=activosCosto-depAcumulada,deuda=numero(r.financiamiento?.deudaPrincipal??h.deudaPrincipal),inventarioMP=numero(c.valorInventarioNeto);
      const estadoResultados={ingresos:r.ingresos,ventasNetas:r.ingresos,costos:r.costosTotales+intereses,utilidad:cfg.NUEVO_MODELO?resumen.utilidad:r.utilidad-intereses,depreciacion,intereses,costosProduccion:r.costosTotales};
      const flujoCaja={cajaInicial,cobrosVentas:r.ingresos,pagosOperacion,compraActivos:comprasActivos,financiamiento:prestamos,operacion:cfg.NUEVO_MODELO?resumen.operacion:r.ingresos-pagosOperacion,inversion:-comprasActivos,flujoNeto:cajaFinal-cajaInicial,cajaFinal};
      const balanceGeneral={efectivo:cajaFinal,activosFijos,inventarioMP,activos:cajaFinal+activosFijos+inventarioMP,deuda,patrimonio:cajaFinal+activosFijos+inventarioMP-deuda,pasivoPatrimonio:cajaFinal+activosFijos+inventarioMP};
      r.libroMovimientos=libro;
      r.financial={estadoResultados,balanceCaja:{cajaInicial,entradas:cfg.NUEVO_MODELO?resumen.entradas:r.ingresos+prestamos,salidas:cfg.NUEVO_MODELO?resumen.salidas:pagosOperacion+comprasActivos,cajaFinal},flujoCaja,balanceGeneral,financiamiento:{...r.financiamiento,tasaMensual,intereses}};
      Object.assign(out.historialPorEmpresa[id],{cajaFinal,activosCosto,depreciacionAcumulada:depAcumulada,maquinariaActivos:conservada,tasaMensualVigente:tasaMensual,teaVigente:(Math.pow(1+tasaMensual,cfg.MESES_ANIO)-1)*100});
    }
    return out;
  }
  function aplicarReporte(reporte,r){
    if(!r?.financial)return reporte;
    const f=r.financial;
    Object.assign(reporte,{ingresos:f.estadoResultados.ingresos,costos:f.estadoResultados.costos,utilidad:f.estadoResultados.utilidad,caja:f.balanceCaja.cajaFinal,balanceCaja:f.balanceCaja,flujoCaja:f.flujoCaja,balanceGeneral:f.balanceGeneral,estadoResultados:{...f.estadoResultados,excel:r}});
    return reporte;
  }
  return {adjuntarCaja,aplicarReporte,sembrarTransicion,crearLibro,resumirLibro};
});
