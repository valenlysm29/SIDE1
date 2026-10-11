'use strict';
const copia=value=>JSON.parse(JSON.stringify(value));
const baja=['INF-02','INF-05','INF-08','RH-01','RH-04','RH-07','RH-10B','INS-11C','INF-11A','INS-12A','FIN-01A','INV-02A'];
const alta=['INF-03','INF-06','INF-09','RH-02','RH-05','RH-08','RH-10A','COM-01C','FIN-01B','INS-09B','INS-10A','INS-11B','INV-01B','INV-02B'];
function decision(patch={}){
  const d={regimen:'MYPE',personal:{corte:[1,0,0],ensamble:[1,0,0],acabado:[1,0,0]},jefes:0,maquinaria:{mesa:1,'INF-02':1,'INF-05':1,'INF-08':1},seleccion:[...baja],compras:{'INS-01':300,'INS-04':1000,'INS-06':6000},lotes:[{segmento:'SEG-01',cantidad:200,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:40}],publicidad:0,...patch};
  // Las simulaciones representan el menú congelado, no selectores internos del catálogo.
  const {CONFIG}=require('../js/engine/config_excel.js'),catalogo=require('../js/engine/catalogo_excel.js');
  const index=Object.fromEntries(catalogo.map(row=>[row.codigo,row]));
  d.garantiaDias=patch.garantiaDias??(d.seleccion.includes('COM-06C')?90:30);
  d.mantenimientoPreventivo=patch.mantenimientoPreventivo??d.seleccion.some(code=>['INF-11B','INF-11C'].includes(code));
  d.tiendasPorDistrito=patch.tiendasPorDistrito??{los_olivos:0,miraflores:0,sjl:0};
  d.marketingNivel=patch.marketingNivel??(d.seleccion.includes('INV-02C')?'alta':d.seleccion.includes('INV-02B')?'media':d.seleccion.includes('INV-02A')?'baja':null);
  d.analistaCompras=patch.analistaCompras??false;d.garantiaProveedor=patch.garantiaProveedor??0;
  d.seleccion=d.seleccion.filter(code=>CONFIG.DECISIONES_VISIBLES.includes(index[code]?.grupo));
  const garantia=CONFIG.GARANTIA_MAPEO_EXACTO[d.garantiaDias];if(garantia)d.seleccion.push(garantia);
  const marketing=CONFIG.MARKETING_BASE[d.marketingNivel];d.publicidad=marketing?.costo||0;if(marketing)d.seleccion.push(marketing.codigo);
  return d;
}
function mercados(unidades=20){return {'SEG-01':{unidades,penetracion:1,pesos:[0.7,0.2,0.1]},'SEG-02':{unidades,penetracion:1,pesos:[0.4,0.35,0.25],precioIdeal:100},'SEG-03':{unidades,penetracion:1,pesos:[0.1,0.5,0.4],precioIdeal:250}};}
function crearSim2(){
  const premium=decision({seleccion:[...alta],jefes:1,compras:{'INS-03':500,'INS-05':1000,'INS-08':15000},lotes:[{segmento:'SEG-03',cantidad:200,cuero:'INS-03',accesorios:'INS-05',hilo:'INS-08',molde:'INF-10',precio:250}]});
  const insuficiente=decision({seleccion:baja.filter(code=>!['INF-02','INF-05'].includes(code)),montoPrestamo:5000,lotes:[{segmento:'SEG-03',cantidad:200,cuero:'INS-01',molde:'INF-08',precio:250},{segmento:'SEG-03',cantidad:100,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:250}]});
  const faltaMP=decision({compras:{},lotes:[{segmento:'SEG-02',cantidad:100,cuero:'INS-03',accesorios:'INS-05',hilo:'INS-08',molde:'INF-09',precio:100}]});
  return {id:'SIM-2',empresas:['A','B'],overrides:{MERCADOS:mercados(10)},ciclos:[{decisionesPorEmpresa:{A:copia(premium),B:copia(insuficiente)}},{decisionesPorEmpresa:{A:copia(premium),B:copia(insuficiente)}},{decisionesPorEmpresa:{A:copia(premium),B:faltaMP}}]};
}
function crearSim3(){
  const a=decision({seleccion:[...alta.filter(c=>!c.startsWith('INV-01')&&!c.startsWith('INV-02')&&!c.startsWith('FIN-02')), 'FIN-02A','INS-09A'].filter((c,i,x)=>x.indexOf(c)===i&&!['INS-09B'].includes(c)),jefes:1});
  const b=decision({seleccion:[...alta,'FIN-02B','INS-12B'],jefes:1,compras:{'INS-02':300,'INS-04':1000,'INS-07':6000},lotes:[{segmento:'SEG-02',cantidad:200,cuero:'INS-02',accesorios:'INS-04',hilo:'INS-07',molde:'INF-09',precio:110}]});
  const c=decision({regimen:'NO_MYPE',seleccion:[...alta,'FIN-02C','COM-06C'],jefes:1,compras:{'INS-03':300,'INS-05':1000,'INS-08':6000},lotes:[{segmento:'SEG-03',cantidad:200,cuero:'INS-03',accesorios:'INS-05',hilo:'INS-08',molde:'INF-10',precio:260}]});
  const d=decision({seleccion:[...alta,'FIN-02A','COM-06B'],garantiaDias:180,mantenimientoPreventivo:true,analistaCompras:true,garantiaProveedor:80,tiendasPorDistrito:{los_olivos:1,miraflores:0,sjl:0},jefes:1,lotes:[{segmento:'SEG-01',cantidad:200,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:45}]});
  const inicial={A:a,B:b,C:c,D:d};
  return {id:'SIM-3',empresas:['A','B','C','D','E'],overrides:{MERCADOS:mercados(40)},ciclos:[{decisionesPorEmpresa:copia(inicial)},{decisionesPorEmpresa:{A:copia(a),C:copia(c),D:copia(d)}},{decisionesPorEmpresa:copia(inicial)}]};
}
function ejecutarEscenario(escenario,cerrarCiclo){let historialPorEmpresa={},resultados=[];for(const [indice,entrada] of escenario.ciclos.entries()){const resultado=cerrarCiclo({ciclo:indice+1,empresas:escenario.empresas,...copia(entrada),historialPorEmpresa},escenario.overrides);historialPorEmpresa=resultado.historialPorEmpresa;resultados.push(resultado);}return resultados;}
function crearSim1(){
 const empresas=['A','B','C','D'],carga=require('./fixtures_excel.cjs'),produccion=carga.entradaProduccionLiteral(),mercados=carga.mercadosDorados();
 return {id:'SIM-1',empresas,overrides:{REPUTACION_FUENTE_MERCADO:'excel_literal',CALIDAD_MERCADO_MODO:'excel_literal'},ciclos:[{decisionesPorEmpresa:Object.fromEntries(empresas.map((id,i)=>[id,decision({seleccion:[...alta],reputacionLiteral:mercados[0].reputaciones[i],jefes:1,personal:produccion.personal,compras:{'INS-01':100,'INS-02':100,'INS-03':100,'INS-04':1000,'INS-05':1000,'INS-06':6000,'INS-07':6000,'INS-08':6000},lotes:[{segmento:'SEG-01',cantidad:produccion.lotes[0].cantidad,cuero:'INS-01',accesorios:'INS-04',hilo:'INS-06',molde:'INF-08',precio:mercados[0].precios[i]},{segmento:'SEG-02',cantidad:produccion.lotes[1].cantidad,cuero:'INS-02',accesorios:'INS-04',hilo:'INS-07',molde:'INF-09',precio:mercados[1].precios[i]},{segmento:'SEG-03',cantidad:produccion.lotes[2].cantidad,cuero:'INS-03',accesorios:'INS-05',hilo:'INS-08',molde:'INF-10',precio:mercados[2].precios[i]}]})]))}]};
}
module.exports={decision,mercados,crearSim1,crearSim2,crearSim3,ejecutarEscenario};
