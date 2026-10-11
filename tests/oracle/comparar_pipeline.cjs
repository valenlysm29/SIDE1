'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {cerrarCiclo}=require(path.join(root,'js/engine/ciclo.js'));
const {adjuntarCaja}=require(path.join(root,'js/engine/caja.js'));
const escenarios=require(path.join(root,'tests/escenarios_excel.cjs'));
function valoresDesdeResultados(resultados,mapCompanyIds={}){const values={};
for(let i=0;i<resultados.length;i++){
 const out=resultados[i];
 for(const [id,r] of Object.entries(out.resultadosPorEmpresa)){
  const p=r.produccion,c=r.costos,q=r.puntajes,con=r.consecuencias;
  const row={calidad:q.calidadEmpresaMotor,puntajeEficiencia:q.puntajeEficiencia,reputacionMatriz:r.reputacionMatriz,saludFinanciera:q.saludFinanciera,capacidadDiaria:p.capacidadDiaria,capacidadCiclo:p.capacidadCiclo,factorEficiencia:p.factorEficienciaProduccion,produccionCapacidad:p.produccionCapacidad,producido:p.totalProducido,consumoCuero:p.consumoTotal.cuero,consumoAccesorios:p.consumoTotal.accesorios,consumoHilo:p.consumoTotal.hilo,costoMO:c.costoMOciclo,costoMP:c.costoMP,mantenimiento:c.costoMantenimiento,depreciacion:c.depreciacion,reputacionOperativa:c.reputacionOperativa,reputacionMercado:r.reputacionMercado,asignado:r.mercado[0].asignado,demandaAjustada:r.mercado[0].demandaAjustada,vendido:r.unidadesVendidas,ingresos:r.ingresos,inventarioProducto:r.inventarioSinVender,almacenaje:c.costoAlmacenaje,horasExtra:con.efectos.costoHorasExtra,costoGarantia:c.costoGarantia,costoRecurrente:c.costoDecisionesRecurrentes,costosTotales:r.costosTotales,utilidad:r.utilidad,ciclosReputacionBaja:con.efectos.ciclosReputacionBaja,tasaAdicionalPP:con.efectos.tasaAdicionalPP};
  for(const [code,stock] of Object.entries(p.inventarioFinal))row['stockMP_'+code]=stock;
  for(let n=1;n<=8;n++){const code='CONS-'+String(n).padStart(2,'0');row[code]=con.mensajes.some(m=>m.id===code);}
  for(const field of ['montoPrestamo','tasaTEA','deudaPrincipal','tasaAdicionalProximoPrestamo'])row['financiamiento.'+field]=r.financiamiento[field];
  for(const [group,fields] of Object.entries(r.financial||{}))for(const [field,val] of Object.entries(fields))if(typeof val==='number')row[`financial.${group}.${field}`]=val;
  // El reparto conserva id pero su segmento pertenece al orden de MERCADOS.
  const segmentos=[...new Set(Object.keys(require(path.join(root,'js/engine/config_excel.js')).CONFIG.MERCADOS))];
  const presentes=segmentos.filter(seg=>r.lotes.some(l=>l.segmento===seg&&l.cantidad>0)||Object.values(r.inventarioProductos).some(l=>l.segmento===seg&&l.cantidad>0)||r.ventas.some(l=>l.segmento===seg));
  for(const [mi,m] of (r.mercado||[]).entries())for(const field of ['puntajePrecio','puntajeTotal','porcentaje','asignado','demandaAjustada','calidadMercado','reputacionEscalada'])row[`mercado.${presentes[mi]}.${field}`]=m[field];
  for(const [li,l] of r.lotes.entries())for(const field of ['calidad','producido','capacidadAsignada','precioEfectivo'])row[`lote.${li}.${field}`]=l[field];
  for(const [key,val] of Object.entries(row))values[`ciclo.${i+1}.${mapCompanyIds[id]||id}.${key}`]=val;
 }
}
return values;}
function comparar(values,expected){
const errors=[];for(const [key,excel] of Object.entries(expected.valores)){
 const side=values[key],ok=typeof excel==='number'?(Number.isInteger(excel)?excel===side:typeof side==='number'&&Math.abs(excel-side)<=1e-9*Math.max(1,Math.abs(excel),Math.abs(side))):excel===side;
 if(!ok)errors.push({clave:key,Excel:excel,SIDE:side});
}
return errors;}
function ejecutar(name='sim3'){
 const scenario=escenarios['crear'+name[0].toUpperCase()+name.slice(1)]();let history={};const resultados=[];
 for(let i=0;i<scenario.ciclos.length;i++){const factory=cerrarCiclo({ciclo:i+1,empresas:scenario.empresas,decisionesPorEmpresa:scenario.ciclos[i].decisionesPorEmpresa,historialPorEmpresa:history},scenario.overrides);const out=adjuntarCaja(factory,{historialAnterior:history,capitalPorEmpresa:Object.fromEntries(scenario.empresas.map(id=>[typeof id==='string'?id:id.id,scenario.capitalInicial??1000000])),overrides:scenario.overrides});history=out.historialPorEmpresa;resultados.push(out);}
 const values=valoresDesdeResultados(resultados),expected=JSON.parse(fs.readFileSync(path.join(__dirname,`esperado_${name}_pipeline.json`),'utf8').replace(/^\uFEFF/,''));
 const errors=comparar(values,expected);
 fs.writeFileSync(path.join(__dirname,`obtenido_${name}_pipeline.json`),JSON.stringify({valores:values},null,2)+'\n');
 fs.writeFileSync(path.join(__dirname,`paridad_${name}_pipeline.json`),JSON.stringify({comparaciones:Object.keys(expected.valores).length,diferencias:errors},null,2)+'\n');
 console.log(JSON.stringify({comparaciones:Object.keys(expected.valores).length,diferencias:errors.length},null,2));if(errors.length){console.table(errors);process.exitCode=1;}
 return errors;
}
module.exports={valoresDesdeResultados,comparar,ejecutar};
if(require.main===module)ejecutar(process.argv[2]||'sim3');
