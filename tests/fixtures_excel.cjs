/* Entradas comunes del Excel. Fórmulas/caches esperadas nunca se usan como entradas. */
'use strict';
const assert=require('node:assert/strict');
const fixtures=require('../docs/logica_excel/fixtures_excel.json');
const celdas=require('../docs/logica_excel/celdas_excel.json');
const copia=v=>JSON.parse(JSON.stringify(v));
const contenidos=Object.fromEntries(Object.entries(celdas).map(([hoja,rows])=>[hoja,Object.fromEntries(rows.map(c=>[c.celda,c.contenido]))]));
function literal(hoja,celda){const v=contenidos[hoja]?.[celda];if(v===undefined||v===null)return 0;assert.equal(typeof v,'number',`${hoja}!${celda} debe ser entrada literal`);return v;}
function entradaPersonal(hoja){return {corte:[5,6,7].map(r=>[literal(hoja,'F'+r),0,0]),ensamble:[11,12,13].map(r=>['F','G','H'].map(c=>literal(hoja,c+r))),acabado:[17,18,19].map(r=>['F','G','H'].map(c=>literal(hoja,c+r)))};}
function entradaProduccionLiteral(){const hoja='CANTIDAD DE PRODUCCIÓN';return {personal:entradaPersonal(hoja),jefes:literal(hoja,'F21'),lotes:[0,1,2].map(i=>({cantidad:literal(hoja,'D'+(37+i)),molde:['INF-08','INF-09','INF-10'][i],asignacion:{cuero:['D','E','F'].map(c=>literal(hoja,c+(49+i))),accesorios:['G','H'].map(c=>literal(hoja,c+(49+i))),hilo:['J','K','L'].map(c=>literal(hoja,c+(49+i)))}}))};}
function mercadosDorados(){const hoja='Costos De Producción';return [{segmento:'SEG-01',inicio:118,inicioLegado:73},{segmento:'SEG-02',inicio:131,inicioLegado:87},{segmento:'SEG-03',inicio:144,inicioLegado:101}].map(m=>({...m,precios:[0,1,2,3].map(i=>literal(hoja,'C'+(m.inicio+i))),reputaciones:[0,1,2,3].map(i=>literal(hoja,'D'+(m.inicio+i)))}));}
function lotesMotor(){const f=fixtures.lotes_motor;return {seleccion:copia(f.seleccion),lotes:f.lotes.map(l=>Object.fromEntries(['segmento','cantidad','cuero','accesorios','hilo','molde'].map(k=>[k,l[k]])))};}
module.exports={fixtures,celdas,contenidos,literal,entradaPersonal,entradaProduccionLiteral,mercadosDorados,lotesMotor};
