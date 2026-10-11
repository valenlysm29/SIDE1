'use strict';
const fs=require('node:fs');const path=require('node:path');
const {decision,crearSim3}=require('../escenarios_excel.cjs');
const {CONFIG}=require('../../js/engine/config_excel.js');
const {cerrarCiclo}=require('../../js/engine/ciclo.js');
const {valoresDesdeResultados,comparar}=require('./comparar_pipeline.cjs');
function escenario(){
 const normal=crearSim3().ciclos[0].decisionesPorEmpresa.A;
 const sano=()=>decision({...normal,seleccion:['COM-01A','FIN-01B','INS-09A','INS-10B','INS-11C','RH-10B','FIN-02B','COM-06A','INF-11A','INS-12A'],jefes:0});
 const recuperado=sano(),prestamo=sano();prestamo.seleccion=prestamo.seleccion.filter(c=>c!=='FIN-01B').concat('FIN-01A');prestamo.montoPrestamo=5000;
 return {id:'BANCA',empresas:['A'],ciclos:[{decisionesPorEmpresa:{A:decision({seleccion:['FIN-01B','INS-10A','INV-02A'],montoPrestamo:0})}},{decisionesPorEmpresa:{A:recuperado}},{decisionesPorEmpresa:{A:prestamo}}]};
}
function exportar(){fs.writeFileSync(path.join(__dirname,'entradas_banca_recuperacion.json'),JSON.stringify({config:CONFIG,escenario:escenario()},null,2)+'\n');}
function ejecutar(){let history={};const results=[],s=escenario();for(let i=0;i<s.ciclos.length;i++){const out=cerrarCiclo({ciclo:i+1,empresas:s.empresas,...s.ciclos[i],historialPorEmpresa:history});history=out.historialPorEmpresa;results.push(out);}const values=valoresDesdeResultados(results);const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'esperado_banca_pipeline.json'),'utf8').replace(/^\uFEFF/,''));const errors=comparar(values,expected);fs.writeFileSync(path.join(__dirname,'obtenido_banca_pipeline.json'),JSON.stringify({valores:values},null,2)+'\n');fs.writeFileSync(path.join(__dirname,'paridad_banca_pipeline.json'),JSON.stringify({comparaciones:Object.keys(expected.valores).length,diferencias:errors},null,2)+'\n');console.log(JSON.stringify({comparaciones:Object.keys(expected.valores).length,diferencias:errors.length}));if(errors.length){console.table(errors);process.exitCode=1;}return results;}
module.exports={escenario,exportar,ejecutar};if(require.main===module){if(process.argv.includes('--exportar'))exportar();else ejecutar();}
