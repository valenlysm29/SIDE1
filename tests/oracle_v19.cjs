/* Expected numbers are fresh spreadsheet caches, never JavaScript-generated. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),E=require('../js/engine/cierre.js'),C=require('../js/engine/costos.js');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'reports/excel_v19_oracle.json'),'utf8'));
assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.missing_numeric_caches,[]);
let checks=0;
function equal(actual,expected,label){assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),`${label}: actual ${actual}; Excel ${expected}`);checks++;}
const names=[...new Set(fixture.market_cases.map(row=>row.caso))];
for(const name of names){
 const rows=fixture.market_cases.filter(row=>row.caso===name),input=rows.map(r=>({id:r.empresa,precio:r.precio,reputacion:r.reputacion,calidad:r.calidad0a10,stock:r.stock,producido:r.producido,bajaPrevios:r.bajaPrevios}));
 const got=E.settleMarketCompanies(input,rows[0].segmento);
 for(let i=0;i<rows.length;i++)for(const key of ['precioScore','puntaje','participacion','demanda','vendidas','precioEfectivo','ingresos','reputacionFinal'])equal(got[i][key],rows[i][key],`${name}/${rows[i].empresa}/${key}`);
}
const scenarioPath=path.join(root,'tests/fixtures/excel_v19_expected.json');
if(!fs.existsSync(scenarioPath))throw Error('Fresh COM scenario required: run tests/oracle/recalcular_com.ps1 with tests/output/excel_v19/scenario.json and v19');
const scenario=JSON.parse(fs.readFileSync(scenarioPath,'utf8').replace(/^\uFEFF/,'')),plan=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/excel_v19_scenario.json'),'utf8'));
const chosen=Object.values(plan.entradas.Seleccion_Ciclo0),scores=E.scores({__catalogSelection:chosen});
for(const [js,excel] of [['efficiency','eficiencia'],['reputation','reputacion'],['health','saludFinanciera']])equal(scores[js],scenario.valores[excel],`scores/${js}`);
const maps={INS01:'cuero_sint',INS02:'cuero_std',INS03:'cuero_prem',INS04:'acc_eco',INS05:'acc_prem',INS06:'hilo_std',INS07:'hilo_ref',INS08:'hilo_prem'};
for(let r=2;r<=4;r++){
 const inp=plan.entradas.Lotes_Produccion,state={};
 for(const [col,family] of [['D','CUERO'],['E','ACCESORIOS'],['F','HILO']]){const id=maps[inp[col+r].replace('-','')];state[family]={round:1,quantities:{[id]:1}};}
 const mold={'INF-08':'molde_1','INF-09':'molde_2','INF-10':'molde_3'}[inp['G'+r]];
 equal(E.quality(state,mold),scenario.valores[`lote${r-1}_calidad`],`quality/lote${r-1}`);
}
for(const role of ['corte','ensamble','acabado'])for(let level=1;level<=3;level++)equal(C.costoLaboral(role,level,'MYPE').pagoMensual,scenario.valores[`mo_${role}_${level}`],`costos/${role}/${level}`);
const F=require('./economic_v19_fixture.cjs'),closed=E.closeMany([0,1,2,3].map(type=>({id:String(type),state:F.state(1,{},type),round:1,catalog:F.catalog})));
for(let level=0;level<3;level++){const state=F.state(),ids=[['PERS_CORTE',['corte_basico','corte_exp','corte_maestro']],['PERS_ENSAMBLE',['ens_personal_basico','ens_personal_ind','ens_personal_esp']],['PERS_ACABADO',['aca_personal_basico','aca_personal_tec','aca_personal_art']]];for(const [key,options]of ids)state[key]={round:1,quantities:{[options[level]]:4},optionIds:[options[level]]};const plan=E.prepare({id:'level',state,round:1,catalog:F.catalog}).plan;equal(plan.processCapacity,fixture.components.find(row=>row[1]===`nivel${level+1}_capacidad`)[2],`capacity/nivel${level+1}`);}
for(const row of fixture.closure_cases){const company=closed[row.empresa],i=['SEG-01','SEG-02','SEG-03'].indexOf(row.segmento),sale=company.sales[i];
 for(const [actual,key] of [[company.plan.processCapacity,'capacidad'],[sale.produced,'producido'],[sale.quality,'calidad'],[company.scores.reputation,'reputacion'],[sale.chosenPrice,'precio'],[sale.assignedDemand,'asignado'],[sale.sold,'vendido'],[sale.price,'precioEfectivo'],[sale.revenue,'ingresos'],[company.revenue,'ingresoEmpresa'],[company.receivable,'cuentasCobrar'],[company.cashRevenue,'ingresoCaja'],[company.storage,'almacenaje'],[company.scores.efficiency,'eficiencia'],[company.scores.health,'saludFinanciera']])equal(actual,row[key],`closeMany/${row.empresa}/${row.segmento}/${key}`);
}
for(const [id,result]of Object.entries(closed)){const rows=fixture.closure_cases.filter(r=>r.empresa===id);for(const [family,key]of [['CUERO','consumoCuero'],['ACCESORIOS','consumoAccesorios'],['HILO','consumoHilo']])equal(result.plan.materials.find(m=>m.id===family).consumption,rows.reduce((s,r)=>s+r[key],0),`closeMany/${id}/${key}`);}
const result={source:fixture.source,engine:fixture.recalculation_engine,marketCases:names.length,checks,differences:0};
fs.writeFileSync(path.join(root,'reports/excel_v19_parity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
