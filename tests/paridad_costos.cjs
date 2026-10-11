'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const COS=require('../js/engine/costos.js'),PRO=require('../js/engine/produccion.js'),{CONFIG}=require('../js/engine/config_excel.js');
// Solo se leen entradas literales del original, nunca valores esperados/caché.
const celdas=Object.fromEntries(require('../docs/logica_excel/celdas_excel.json')['Costos De Producción'].map(c=>[c.celda,c.contenido]));
function literal(celda){const valor=celdas[celda];if(valor===undefined||valor===null)return 0;assert.equal(typeof valor,'number',`${celda} debe ser entrada literal`);return valor;}
function calcularValoresCostos(){
  const salida={},put=(celda,valor)=>{salida['costos.'+celda]=valor;};
  const personal={corte:[5,6,7].map(fila=>[literal('F'+fila),0,0]),ensamble:[11,12,13].map(fila=>['F','G','H'].map(col=>literal(col+fila))),acabado:[17,18,19].map(fila=>['F','G','H'].map(col=>literal(col+fila)))};
  const capacidad=PRO.calcularCapacidad({personal,jefes:literal('F21')},{DIAS_CICLO:30,PRODUCTIVIDAD:{corte:[6,8,12],ensamble:[6,8,12],acabado:[6,8,12]}});
  for(const [celda,valor] of Object.entries({I8:capacidad.capacidadPorArea.corte,I14:capacidad.capacidadPorArea.ensamble,I20:capacidad.capacidadPorArea.acabado,K5:capacidad.capacidadDiaria,L5:capacidad.capacidadCiclo,M5:capacidad.factorEficienciaProduccion,N5:capacidad.produccionCapacidad,L9:capacidad.totalTrabajadores,L10:capacidad.trabajadoresN3,M10:capacidad.proporcionN3}))put(celda,valor);
  // D46:E48 son ejemplos escritos a mano en Excel; son entradas del modelo de costos.
  const lotes=[46,47,48].map((fila,i)=>({molde:['INF-08','INF-09','INF-10'][i],cantidad:literal('D'+fila),producido:literal('E'+fila)}));
  const totalDeseado=lotes.reduce((s,l)=>s+l.cantidad,0),totalProducido=lotes.reduce((s,l)=>s+l.producido,0),necesidad={cuero:0,accesorios:0,hilo:0},usoReal={cuero:0,accesorios:0,hilo:0};
  for(const [i,lote] of lotes.entries()){
    const fila=46+i,consumo=CONFIG.CONSUMO_MOLDE[lote.molde];put('D'+fila,lote.cantidad);put('E'+fila,lote.producido);put('F'+fila,lote.producido/totalProducido);
    for(const [familia,colNecesidad,colReal] of [['cuero','H','L'],['accesorios','I','M'],['hilo','J','N']]){put(colNecesidad+fila,lote.cantidad*consumo[familia]);put(colReal+fila,lote.producido*consumo[familia]);necesidad[familia]+=lote.cantidad*consumo[familia];usoReal[familia]+=lote.producido*consumo[familia];}
  }
  put('D49',totalDeseado);put('E49',totalProducido);put('F49',lotes.reduce((s,l)=>s+l.producido/totalProducido,0));
  for(const [familia,colNecesidad,colReal] of [['cuero','H','L'],['accesorios','I','M'],['hilo','J','N']]){put(colNecesidad+'49',necesidad[familia]);put(colReal+'49',usoReal[familia]);}
  const codigos=Object.keys(CONFIG.PRECIO_MP),compras={},inventarioInicial={};
  for(const [i,codigo] of codigos.entries()){compras[codigo]=literal('DEFGHIJK'[i]+'31')*CONFIG.CONVERSION_COMPRA[codigo];inventarioInicial[codigo]=literal('D'+(54+i));}
  const almacen=COS.consumirAlmacen({compras,inventarioInicial,necesidad});
  for(const [i,codigo] of codigos.entries())for(const [col,valor] of Object.entries({D:inventarioInicial[codigo],E:compras[codigo],F:almacen.consumoMP[codigo],G:almacen.inventarioFinal[codigo]}))put(col+(54+i),valor);
  const reputacion=COS.reputacionOperativa({produccion:{lotes,totalProducido,proporcionN3:capacidad.proporcionN3},consumoMP:almacen.consumoMP,publicidad:literal('B63')});
  for(const [celda,valor] of Object.entries({C65:reputacion.factorProduccion,D65:reputacion.factorMO,E65:reputacion.factorMP,F65:reputacion.factorPublicidad,G65:reputacion.valor}))put(celda,valor);
  // AB88:95 son ocho fórmulas precio*cantidad literal, independientes de F54:61.
  const consumoValoracion={};
  for(const [i,codigo] of codigos.entries()){
    const formula=celdas['AB'+(88+i)],match=/^=([0-9.]+)\*([0-9.]+)$/.exec(formula);assert.ok(match,`Valorización literal ${formula}`);assert.equal(Number(match[1]),CONFIG.PRECIO_MP[codigo]);consumoValoracion[codigo]=Number(match[2]);
  }
  const valor=COS.calcularCostos({compras,inventarioInicial,consumoMP:consumoValoracion});
  for(const [celda,numero] of Object.entries({V95:valor.valorComprado,W95:valor.valorCompradoNeto,AB96:valor.valorConsumido,AC96:valor.valorConsumidoNeto,V100:valor.valorInventario,W100:valor.valorInventarioNeto}))put(celda,numero);
  for(const [area,columnas] of [['corte',['U','V']],['ensamble',['Y','Z']],['acabado',['AC','AD']]])for(const [indice,regimen] of ['MYPE','NO_MYPE'].entries())for(const [nivel,fila] of [11,20,29].entries())put(columnas[indice]+fila,COS.costoLaboral(area,nivel+1,regimen).pagoMensual);
  for(const [indice,regimen] of ['MYPE','NO_MYPE'].entries()){put(['U','V'][indice]+'38',COS.costoLaboral('jefatura',1,regimen).sumaAnual);put(['Y','Z'][indice]+'38',COS.costoLaboral('limpieza',1,regimen).sumaAnual);}
  const bloques=[['mesa',['U','V'],45,false],['INF-08',['U','V'],53,true],['INF-09',['U','V'],60,true],['INF-10',['U','V'],67,true],['INF-02',['Y','Z'],45,false],['INF-03',['Y','Z'],53,false],['INF-04',['Y','Z'],61,false],['INF-05',['AC','AD'],45,false],['INF-06',['AC','AD'],53,false],['INF-07',['AC','AD'],61,false]];
  for(const [codigo,columnas,inicio,molde] of bloques)for(const [indice,regimen] of ['MYPE','NO_MYPE'].entries()){
    const equipo=COS.costoMaquinaria(codigo,regimen),campos=molde?['adquisicion','capacitacion','mantenimientoAnual','depreciacionAnual','sumaAnual']:['adquisicion','instalacion','capacitacion','mantenimientoAnual','depreciacionAnual','sumaAnual'];
    campos.forEach((campo,offset)=>put(columnas[indice]+(inicio+offset),equipo[campo]));
  }
  return salida;
}
if(require.main===module){
  const calculados=calcularValoresCostos(),esperado=require('./oracle/esperado_base.json').valores;
  const claves=Object.keys(esperado).filter(k=>k.startsWith('costos.')),obtenido=Object.fromEntries(claves.map(k=>[k,calculados[k]]));
  fs.writeFileSync(path.join(__dirname,'oracle/obtenido_costos.json'),JSON.stringify({metadatos:{motor:'SIDE_EXCEL_COSTOS',cobertura:'Solo celdas costos del oráculo base'},valores:obtenido},null,2));
  const diferencias=[];for(const clave of claves){const a=obtenido[clave],b=esperado[clave];if(typeof a!=='number'||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(b)))diferencias.push({clave,Excel:b,SIDE:a});}
  console.log(JSON.stringify({celdas:claves.length,diferencias},null,2));assert.equal(diferencias.length,0);
}
module.exports={calcularValoresCostos};
