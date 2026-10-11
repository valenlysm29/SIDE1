'use strict';
const fs=require('node:fs');const path=require('node:path');
const {decision,crearSim3}=require('../escenarios_excel.cjs');
const {CONFIG}=require('../../js/engine/config_excel.js');
const {cerrarCiclo}=require('../../js/engine/ciclo.js');
const {adjuntarCaja}=require('../../js/engine/caja.js');
const {valoresDesdeResultados,comparar}=require('./comparar_pipeline.cjs');
function escenario(){
 const normal=crearSim3().ciclos[0].decisionesPorEmpresa.A;
 const sano=()=>decision({...normal,seleccion:['COM-01A','FIN-01B','INS-09A','INS-10B','INS-11C','RH-10B','FIN-02B','COM-06A','INF-11A','INS-12A'],jefes:0});
 const recuperado=sano(),prestamo=sano();prestamo.seleccion=prestamo.seleccion.filter(c=>c!=='FIN-01B').concat('FIN-01A');prestamo.montoPrestamo=5000;
 return {id:'BANCA',empresas:['A'],ciclos:[{decisionesPorEmpresa:{A:decision({seleccion:['FIN-01B','INS-10A','INV-02A'],montoPrestamo:0})}},{decisionesPorEmpresa:{A:recuperado}},{decisionesPorEmpresa:{A:prestamo}}]};
}
function escenarioMezcla(){const s=escenario();s.id='BANCAMEZCLA';const first=s.ciclos[0].decisionesPorEmpresa.A;first.seleccion=first.seleccion.filter(c=>c!=='FIN-01B').concat('FIN-01A');first.montoPrestamo=5000;return s;}
function exportar(){fs.writeFileSync(path.join(__dirname,'entradas_banca_recuperacion.json'),JSON.stringify({config:CONFIG,escenario:escenario()},null,2)+'\n');fs.writeFileSync(path.join(__dirname,'entradas_banca_mezcla.json'),JSON.stringify({config:CONFIG,escenario:escenarioMezcla()},null,2)+'\n');}
function ejecutar(mode="banca"){let history={};const results=[],s=mode==="bancamezcla"?escenarioMezcla():escenario();for(let i=0;i<s.ciclos.length;i++){const factory=cerrarCiclo({ciclo:i+1,empresas:s.empresas,...s.ciclos[i],historialPorEmpresa:history});const out=adjuntarCaja(factory,{historialAnterior:history,capitalPorEmpresa:{A:1000000}});history=out.historialPorEmpresa;results.push(out);}const values=valoresDesdeResultados(results);const expected=JSON.parse(fs.readFileSync(path.join(__dirname,`esperado_${mode}_pipeline.json`),'utf8').replace(/^\uFEFF/,''));const errors=comparar(values,expected);fs.writeFileSync(path.join(__dirname,`obtenido_${mode}_pipeline.json`),JSON.stringify({valores:values},null,2)+'\n');fs.writeFileSync(path.join(__dirname,`paridad_${mode}_pipeline.json`),JSON.stringify({comparaciones:Object.keys(expected.valores).length,diferencias:errors},null,2)+'\n');console.log(JSON.stringify({comparaciones:Object.keys(expected.valores).length,diferencias:errors.length}));if(errors.length){console.table(errors);process.exitCode=1;}return results;}
module.exports={escenario,escenarioMezcla,exportar,ejecutar};if(require.main===module){if(process.argv.includes('--exportar'))exportar();else ejecutar(process.argv.includes("--mezcla")?"bancamezcla":"banca");}
