'use strict';
// Oráculo: Microsoft Excel recalcula la copia corregida para cada escenario.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tests/output/excel_equivalencia_actual'),book=path.join(root,'output/SIDE_prueba_cantidad_produccion_corregido.xlsx'),P=require('../js/production_model.js'),C=require('../js/cycle_model.js'),BUS=require('../js/business_rules.js');
const scope={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'js/decision_catalog.js'),'utf8'),scope);const catalog=scope.window.SIDE_DECISION_CATALOG;
fs.mkdirSync(out,{recursive:true});
const cases=[
 {id:'base',targets:[150,140,95],ref:1500,prem:1400},
 {id:'meta_cero',targets:[0,0,0],ref:1500,prem:1400},
 {id:'material_insuficiente',targets:[150,140,95],ref:250,prem:0,j31:1,k31:0},
 {id:'premium',targets:[0,0,100],ref:1500,prem:1400},
 {id:'capacidad_limitada',targets:[300,300,300],ref:1500,prem:1400}
];
for(const item of cases)test('Excel real y producción SIDE: '+item.id,()=>{
 const sheet='Costos De Producción',inputs={D46:item.targets[0],D47:item.targets[1],D48:item.targets[2]};if(item.j31!=null)inputs.J31=item.j31;if(item.k31!=null)inputs.K31=item.k31;
 const cells=['M5','N5','I8','I14','I20','E46','E47','E48','L49','M49','N49','F54','F55','F56','F57','F58','F59','F60','F61','G54','G55','G56','G57','G58','G59','G60','G61',...Array.from({length:8},(_,i)=>'AC'+(88+i))];
 const plan={nombre:item.id,entradas:{[sheet]:inputs},salidas:Object.fromEntries(cells.map(c=>[c,[sheet,c]]))},file=path.join(out,item.id+'.json'),res=path.join(out,item.id+'-valores.json');fs.writeFileSync(file,JSON.stringify(plan));
 cp.execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/oracle/recalcular_com.ps1'),'-Plan',file,'-Modelo',book,'-LibroSalida',path.join(out,item.id+'.xlsx'),'-JsonSalida',res],{cwd:root,timeout:90000,stdio:'pipe'});
 const excel=JSON.parse(fs.readFileSync(res,'utf8').replace(/^\uFEFF/,''));assert.equal(excel.metadatos.estadoCalculo,0);const e=excel.valores;
 const state={},counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1,ens_semi:1,ens_ind:1},ACABADOS:{aca_basica:1,aca_ind:1},PERS_CORTE:{corte_basico:1,corte_exp:1},PERS_ENSAMBLE:{ens_personal_basico:1,ens_personal_ind:1,ens_personal_esp:1},PERS_ACABADO:{aca_personal_tec:1,aca_personal_art:1},CUERO:{cuero_sint:60,cuero_std:110,cuero_prem:30},ACCESORIOS:{acc_eco:200,acc_prem:190},HILO:{hilo_ref:item.ref,hilo_prem:item.prem}};
 for(const [id,quantities] of Object.entries(counts))state[id]={round:1,quantities,...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
 state.PERS_ENSAMBLE.assignments={ens_personal_basico:{ens_ind:1},ens_personal_ind:{ens_basica:1},ens_personal_esp:{ens_semi:1}};state.PERS_ACABADO.assignments={aca_personal_tec:{aca_ind:1},aca_personal_art:{aca_basica:1}};
 state.MOLDE={round:1,optionIds:['molde_1','molde_2','molde_3']};state.PRODUCCION_META={round:1,moldTargets:Object.fromEntries(item.targets.map((n,i)=>['molde_'+(i+1),n]))};
 const side=P.calculate({state,catalog,round:1}),pairs=[['M5',side.efficiency],['N5',side.processCapacity],['I8',side.processes[0].dailyCapacity],['I14',side.processes[1].dailyCapacity],['I20',side.processes[2].dailyCapacity],...side.productLines.map((x,i)=>['E'+(46+i),x.plannedUnits]),...side.materials.map((x,i)=>[['L49','M49','N49'][i],x.consumption])];
 state.CANALES={round:1,optionIds:['web']};const receipt=C.close({state,catalog,round:1,capital:200000,production:side}).receipt;
 const materialOptions=[['CUERO','cuero_sint'],['CUERO','cuero_std'],['CUERO','cuero_prem'],['ACCESORIOS','acc_eco'],['ACCESORIOS','acc_prem'],['HILO','hilo_std'],['HILO','hilo_ref'],['HILO','hilo_prem']];
 materialOptions.forEach(([family,id],i)=>{const bought=counts[family][id]||0,remaining=Number(receipt.inventory[id]||0),option=catalog.flatMap(c=>c.items||[]).find(x=>x.id===family).options.find(o=>o.id===id);pairs.push(['F'+(54+i),bought-remaining],['G'+(54+i),remaining],['AC'+(88+i),(bought-remaining)*BUS.materialUnitPrice(option,bought,0,{materials:{quantityDiscountThreshold:0}})]);});
 for(const [cell,actual] of pairs)assert.ok(Math.abs(Number(e[cell])-actual)<1e-8,`${item.id} ${cell}: Excel ${e[cell]}, SIDE ${actual}`);
},{timeout:100000,skip:!fs.existsSync(book) && 'Falta generar la copia del Excel fuente'});
test('Excel real y SIDE: inventario arrastrado durante tres ciclos',()=>{
 const sheet='Costos De Producción',ids=['cuero_sint','cuero_std','cuero_prem','acc_eco','acc_prem','hilo_std','hilo_ref','hilo_prem'];
 const purchase={cuero_sint:60,cuero_std:110,cuero_prem:30,acc_eco:200,acc_prem:190,hilo_std:0,hilo_ref:1500,hilo_prem:1400};
 const counts={MESA_CORTE:{mesa:1},ENSAMBLE:{ens_basica:1,ens_semi:1,ens_ind:1},ACABADOS:{aca_basica:1,aca_ind:1},PERS_CORTE:{corte_basico:1,corte_exp:1},PERS_ENSAMBLE:{ens_personal_basico:1,ens_personal_ind:1,ens_personal_esp:1},PERS_ACABADO:{aca_personal_tec:1,aca_personal_art:1}};
 let state={},ledger={},excelOpening=Object.fromEntries(ids.map(id=>[id,0]));
 for(let round=1;round<=3;round++){
  const inputs={D46:50,D47:30,D48:20};ids.forEach((id,i)=>{inputs['D'+(54+i)]=excelOpening[id];if(round>1)inputs[String.fromCharCode(68+i)+'31']=0;});
  const cells=['M5','N5','E46','E47','E48','L49','M49','N49',...ids.map((_,i)=>'G'+(54+i))],plan={nombre:'arrastre_'+round,entradas:{[sheet]:inputs},salidas:Object.fromEntries(cells.map(c=>[c,[sheet,c]]))};
  const name='arrastre_'+round,file=path.join(out,name+'.json'),res=path.join(out,name+'-valores.json');fs.writeFileSync(file,JSON.stringify(plan));
  cp.execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tests/oracle/recalcular_com.ps1'),'-Plan',file,'-Modelo',book,'-LibroSalida',path.join(out,name+'.xlsx'),'-JsonSalida',res],{cwd:root,timeout:90000,stdio:'pipe'});
  const e=JSON.parse(fs.readFileSync(res,'utf8').replace(/^\uFEFF/,''));assert.equal(e.metadatos.estadoCalculo,0);
  for(const [id,quantities] of Object.entries(counts))state[id]={...state[id],round,quantities,...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
  state.PERS_ENSAMBLE.assignments={ens_personal_basico:{ens_ind:1},ens_personal_ind:{ens_basica:1},ens_personal_esp:{ens_semi:1}};state.PERS_ACABADO.assignments={aca_personal_tec:{aca_ind:1},aca_personal_art:{aca_basica:1}};
  for(const [family,options] of [['CUERO',ids.slice(0,3)],['ACCESORIOS',ids.slice(3,5)],['HILO',ids.slice(5)]])state[family]={round,quantities:Object.fromEntries(options.map(id=>[id,round===1?purchase[id]:0]))};
  state.MOLDE={round:1,optionIds:['molde_1','molde_2','molde_3'],purchases:{1:{molde_1:1,molde_2:1,molde_3:1}}};state.CANALES={round,optionIds:['web']};state.PRODUCCION_META={round,moldTargets:{molde_1:50,molde_2:30,molde_3:20}};
  const planSide=P.calculate({state,catalog,round}),result=C.close({state,ledger,catalog,round,capital:200000,production:planSide});state=result.state;ledger=result.ledger;
  const pairs=[['M5',planSide.efficiency],['N5',planSide.processCapacity],...planSide.productLines.map((line,i)=>['E'+(46+i),line.plannedUnits]),...planSide.materials.map((m,i)=>[['L49','M49','N49'][i],m.consumption])];
  ids.forEach((id,i)=>{excelOpening[id]=Number(e.valores['G'+(54+i)]);pairs.push(['G'+(54+i),Number(result.receipt.inventory[id]||0)]);});
  for(const [cell,actual] of pairs)assert.ok(Math.abs(Number(e.valores[cell])-actual)<1e-8,`ciclo ${round} ${cell}: Excel ${e.valores[cell]}, SIDE ${actual}`);
 }
},{timeout:270000,skip:!fs.existsSync(book) && 'Falta generar la copia del Excel fuente'});
