'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const PRO=require('../js/engine/produccion.js'),P=require('../js/engine/puntajes.js'),MER=require('../js/engine/mercado.js'),INV=require('../js/engine/inventario.js');
const fixtures=require('../docs/logica_excel/fixtures_excel.json');
function valoresBase(){
  const out={},entrada={personal:{corte:[1,1,1],ensamble:[[0,0,1],[1,0,0],[0,1,0]],acabado:[[0,1,0],0,1]},jefes:1,lotes:[
    {cantidad:250,molde:'INF-08',asignacion:{cuero:[60,10,0],accesorios:[0,200],hilo:[1600,0,0]}},
    {cantidad:180,molde:'INF-09',asignacion:{cuero:[0,50,0],accesorios:[0,150],hilo:[0,0,1200]}},
    {cantidad:90,molde:'INF-10',asignacion:{cuero:[0,0,70],accesorios:[0,50],hilo:[0,0,1100]}}
  ]},r=PRO.calcularProduccion(entrada);
  const capacidad={I8:r.capacidadPorArea.corte,I14:r.capacidadPorArea.ensamble,I20:r.capacidadPorArea.acabado,K5:r.capacidadDiaria,L5:r.capacidadCiclo,M5:r.factorEficienciaProduccion,N5:r.produccionCapacidad,L9:r.totalTrabajadores,L10:r.trabajadoresN3,M10:r.proporcionN3};
  for(const [celda,v] of Object.entries(capacidad))out['produccion.'+celda]=v;
  for(let i=0;i<3;i++){const l=r.lotes[i];out['produccion.D'+(37+i)]=l.cantidad;out['produccion.E'+(37+i)]=l.capacidadAsignada;for(const [col,v] of Object.entries({D:l.produccionSinRedondeo,E:l.producido,G:l.consumo.cuero,H:l.consumo.accesorios,I:l.consumo.hilo}))out['produccion.'+col+(56+i)]=v;}
  // La tabla original de inventario es un ejemplo independiente: consume requisitos planeados.
  const tabla=fixtures.produccion.rangos['D63:G71'],initial={},compras={},consumo={};
  const valoresRequeridos=['cuero','accesorios','hilo'].flatMap(f=>r.lotes.map(l=>l.requerimiento[f]));
  for(let i=0;i<9;i++){const row=63+i;initial[row]=tabla['D'+row];compras[row]=tabla['E'+row];consumo[row]=valoresRequeridos[i];}
  const final=INV.actualizarInventario(initial,compras,consumo);for(let row=63;row<=71;row++)for(const [col,v] of Object.entries({D:initial[row],E:compras[row],F:consumo[row],G:final[row]}))out['produccion.'+col+row]=v;
  const p=P.calcularPuntajes(fixtures.lotes_motor);for(let i=0;i<3;i++){const l=p.lotes[i];for(const [col,v] of Object.entries({H:l.costoUnitario,I:l.calidad,J:l.umbral,K:l.resultado,L:l.mensaje}))out['lotes.'+col+(2+i)]=v;}
  out['lotes.C5']=p.totalCantidades;out['lotes.H5']=p.costoInsumos;
  for(const [row,v,nivel] of [[6,p.calidadEmpresaMotor,p.niveles.calidad],[9,p.puntajeEficiencia,p.niveles.eficiencia],[10,p.reputacionMatriz,p.niveles.reputacion],[11,p.saludFinanciera,p.niveles.salud]]){out['motor.B'+row]=v;out['motor.D'+row]=nivel;}
  for(const [segmento,start,precios] of [['SEG-01',118,[40,45,43,41]],['SEG-02',131,[120,150,190,200]],['SEG-03',144,[250,300,220,400]]]){
    const empresas=precios.map((precio,i)=>({precio,reputacionMercado:[7,8.3,10.2,9][i]}));const rows=MER.repartoMercado(empresas,segmento,{CALIDAD_MERCADO_MODO:'excel_literal'});
    rows.forEach((e,i)=>{for(const [col,v] of Object.entries({E:e.calidadMercado,F:e.puntajePrecio,G:e.reputacionEscalada,H:e.puntajeTotal,I:e.porcentaje,J:e.asignado}))out['ventas_modelo2.'+col+(start+i)]=v;});
    const legacy=MER.repartoModelo1(empresas,rows[0].mercadoReal);const inicio=segmento==='SEG-01'?73:segmento==='SEG-02'?87:101,suma=legacy.reduce((a,e)=>a+e.puntajeTotal,0);
    legacy.forEach((e,i)=>{for(const [col,v] of Object.entries({E:e.puntajePrecio,F:e.puntajeTotal,G:e.puntajeTotal/suma,H:e.asignado}))out['ventas_modelo1.'+col+(inicio+i)]=v;});
  }
  return out;
}
function comparar(esperado,obtenido){const filas=[];for(const [clave,e] of Object.entries(esperado)){const o=obtenido[clave];const ok=typeof e==='number'?typeof o==='number'&&Number.isFinite(o)&&(Number.isInteger(e)?o===e:Math.abs(e-o)<=1e-9*Math.max(1,Math.abs(e))):o===e;filas.push({clave,Excel:e,SIDE:o??'AUSENTE',ok});}return filas;}
function ejecutar(){const esperado=require('./oracle/esperado_base.json').valores;const obtenido={...valoresBase(),...require('./paridad_costos.cjs').calcularValoresCostos()};const filas=comparar(esperado,obtenido);fs.writeFileSync(path.join(__dirname,'oracle/obtenido_base.json'),JSON.stringify({valores:obtenido},null,2));fs.writeFileSync(path.join(__dirname,'output/paridad_base.json'),JSON.stringify({total:filas.length,diferencias:filas.filter(f=>!f.ok)},null,2));console.table(filas);assert.equal(filas.filter(f=>!f.ok).length,0,'Paridad Excel base');return filas;}
if(require.main===module)ejecutar();module.exports={valoresBase,comparar,ejecutar};
