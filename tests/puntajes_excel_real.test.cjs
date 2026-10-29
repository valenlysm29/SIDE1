'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),original=path.join(root,'tests/output/excel_fuente_actual/fuente_inmutable.xlsx'),out=path.join(root,'tests/output/puntajes_reales');
test('Motor de cierre: puntajes SUM del Excel con selección real, sin recortes',()=>{
 fs.mkdirSync(out,{recursive:true});const p=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/excel_v19_scenario.json'),'utf8'));p.nombre='puntajes_excel_original';p.entradas.Lotes_Produccion={'B2':'SEG-03','C2':90,'D2':'INS-03','E2':'INS-05','F2':'INS-08','G2':'INF-10','B3':'SEG-03','C3':90,'D3':'INS-01','E3':'INS-04','F3':'INS-06','G3':'INF-10','B4':'SEG-01','C4':90,'D4':'INS-01','E4':'INS-04','F4':'INS-06','G4':'INF-08'};p.salidas={calidad1:['Lotes_Produccion','I2'],calidad2:['Lotes_Produccion','I3'],calidad3:['Lotes_Produccion','I4'],eficiencia:['Motor_Puntajes','B9'],reputacion:['Motor_Puntajes','B10'],salud:['Motor_Puntajes','B11']};
 const plan=path.join(out,'plan.json'),result=path.join(out,'resultado.json');fs.writeFileSync(plan,JSON.stringify(p));
 cp.execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/oracle/recalcular_com.ps1'),'-Plan',plan,'-Modelo',original,'-LibroSalida',path.join(out,'calculado.xlsx'),'-JsonSalida',result],{cwd:root,timeout:90000});
 const excel=JSON.parse(fs.readFileSync(result,'utf8').replace(/^\uFEFF/,''));assert.equal(excel.metadatos.estadoCalculo,0);const actual=require('../js/engine/cierre').scores({__catalogSelection:Object.values(p.entradas.Seleccion_Ciclo0)});
 assert.equal(actual.efficiency,excel.valores.eficiencia);assert.equal(actual.reputation,excel.valores.reputacion);assert.equal(actual.health,excel.valores.salud);
 const F=require('./economic_v19_fixture.cjs'),E=require('../js/engine/cierre');
 const premium=F.state(1,{},2),low=F.state(1,{},2),basic=F.state(1,{},0);
 for(const state of [low,basic]){state.CUERO.quantities={cuero_sint:250};state.ACCESORIOS.quantities={acc_eco:1000};state.HILO.quantities={hilo_std:10000};}
 for(const [state,i,index] of [[premium,1,2],[low,2,2],[basic,3,0]])assert.equal(E.prepare({state,catalog:F.catalog,round:1}).lines[index].quality,excel.valores['calidad'+i]);
},{timeout:100000,skip:!fs.existsSync(original)&&'Falta la fuente Excel para recalcular'});
