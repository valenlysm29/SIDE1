'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),original=path.join(root,'tests/output/excel_fuente_actual/fuente_inmutable.xlsx'),out=path.join(root,'tests/output/puntajes_reales');
test('Motor de cierre: puntajes SUM del Excel con selección real, sin recortes',()=>{
 fs.mkdirSync(out,{recursive:true});const p=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/excel_v19_scenario.json'),'utf8'));p.nombre='puntajes_excel_original';p.salidas={eficiencia:['Motor_Puntajes','B9'],reputacion:['Motor_Puntajes','B10'],salud:['Motor_Puntajes','B11']};
 const plan=path.join(out,'plan.json'),result=path.join(out,'resultado.json');fs.writeFileSync(plan,JSON.stringify(p));
 cp.execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/oracle/recalcular_com.ps1'),'-Plan',plan,'-Modelo',original,'-LibroSalida',path.join(out,'calculado.xlsx'),'-JsonSalida',result],{cwd:root,timeout:90000});
 const excel=JSON.parse(fs.readFileSync(result,'utf8').replace(/^\uFEFF/,''));assert.equal(excel.metadatos.estadoCalculo,0);const actual=require('../js/engine/cierre').scores({__catalogSelection:Object.values(p.entradas.Seleccion_Ciclo0)});
 assert.equal(actual.efficiency,excel.valores.eficiencia);assert.equal(actual.reputation,excel.valores.reputacion);assert.equal(actual.health,excel.valores.salud);
},{timeout:100000,skip:!fs.existsSync(original)&&'Falta la fuente Excel para recalcular'});
