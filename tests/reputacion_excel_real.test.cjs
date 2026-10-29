'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),book=path.join(root,'output/SIDE_prueba_cantidad_produccion_corregido.xlsx'),out=path.join(root,'tests/output/reputacion_excel');
test('suma comercial real de Excel y conversión de escala para demanda',()=>{
 fs.mkdirSync(out,{recursive:true});const sheet='Costos De Producción',cells=['C113','D113','E113','F113','G113'],p={nombre:'reputacion',entradas:{},salidas:Object.fromEntries(cells.map(c=>[c,[sheet,c]]))};
 const file=path.join(out,'plan.json'),res=path.join(out,'resultado.json');fs.writeFileSync(file,JSON.stringify(p));cp.execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/oracle/recalcular_com.ps1'),'-Plan',file,'-Modelo',book,'-LibroSalida',path.join(out,'resultado.xlsx'),'-JsonSalida',res],{cwd:root,timeout:90000});
 const x=JSON.parse(fs.readFileSync(res,'utf8').replace(/^\uFEFF/,''));assert.equal(x.metadatos.estadoCalculo,0);const e=x.valores;
 const scope={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),scope);const catalog=scope.window.SIDE_DECISION_CATALOG,state={};
 const counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1,ens_semi:1,ens_ind:1},ACABADOS:{aca_basica:1,aca_ind:1},PERS_CORTE:{corte_basico:1,corte_exp:1},PERS_ENSAMBLE:{ens_personal_basico:1,ens_personal_ind:1,ens_personal_esp:1},PERS_ACABADO:{aca_personal_tec:1,aca_personal_art:1},CUERO:{cuero_sint:60,cuero_std:110,cuero_prem:30},ACCESORIOS:{acc_eco:200,acc_prem:190},HILO:{hilo_ref:1500,hilo_prem:1400}};
 for(const [id,quantities] of Object.entries(counts))state[id]={round:1,quantities,...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
 state.PERS_ENSAMBLE.assignments={ens_personal_basico:{ens_ind:1},ens_personal_ind:{ens_basica:1},ens_personal_esp:{ens_semi:1}};state.PERS_ACABADO.assignments={aca_personal_tec:{aca_ind:1},aca_personal_art:{aca_basica:1}};
 state.MOLDE={round:1,optionIds:['molde_1','molde_2','molde_3']};state.PRODUCCION_META={round:1,moldTargets:{molde_1:150,molde_2:140,molde_3:95}};state.INV_MARKETING={round:1,value:3000};state.CANALES={round:1,optionIds:['web']};
 const prepared=require('../js/engine/cierre').prepare({id:'a',state,catalog,round:1}),r=prepared.reputation;
 for(const [a,b] of [[r.factorProduccion,e.C113],[r.factorMO,e.D113],[r.factorMP,e.E113],[r.factorPublicidad,e.F113],[r.valor,e.G113],[prepared.scores.reputation,e.G113/4]])assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
},{timeout:100000,skip:!fs.existsSync(book)&&'Falta copia del Excel'});
