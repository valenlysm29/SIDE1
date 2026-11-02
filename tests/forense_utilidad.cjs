'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const F=require('../js/financial_model'),{catalog}=require('./economic_v19_fixture.cjs');
const rows=JSON.parse(fs.readFileSync('tests/output/forense_utilidad/cierres_reales.json'));
const output=[];
for(const row of rows){
 const r=row.cierre.resultadosPorEmpresa['188'],state=structuredClone(r.state);
 delete state.__financialSnapshots;
 const f=F.calculate({capital:100000,round:row.ciclo,ledger:r.ledger,sectionsByRound:r.financialSections,catalog,state,financialPolicy:r.receipt.financialPolicy});
 for(const section of ['estadoResultados','balanceGeneral','flujoCaja'])assert.deepEqual(f[section],r.financial[section],`reconstrucción real C${row.ciclo} ${section}`);
 for(const [round,sections] of Object.entries(r.financialSections))for(const [cat,s] of Object.entries(sections))assert.ok(Math.abs(s.items.reduce((a,i)=>a+Number(i.net||0),0)-r.ledger[`${round}:${cat}`])<1e-8);
 output.push({real:true,cycle:row.ciclo,net:f.estadoResultados.utilidadNeta,admin:f.estadoResultados.gastosAdministrativos,replayedWithoutSnapshots:true});
}
// Escenarios contables controlados: no sustituyen el cierre real.
const cat=[{items:[{id:'CUERO',material:true,options:[{id:'mp',label:'MP',cost:10}]},{id:'PERS_CORTE'},{id:'LOCAL_PROD'}]}];
function scenario(name,{produced=10,sold=10,labor=20,admin=10,price=30,cycles=1}={}){
 const ledger={},sectionsByRound={},state={__cycleSettlements:{}};
 for(let r=1;r<=cycles;r++){
  ledger[`${r}:B`]=-100-labor-admin;ledger[`${r}:SIM_VENTAS`]=sold*price;ledger[`${r}:COMISION_VENTAS`]=-sold*price*.01;
  sectionsByRound[r]={B:{recordedNet:ledger[`${r}:B`],items:[{id:'CUERO',outflow:100,rows:[{label:'MP',quantity:10,outflow:100}]},{id:'PERS_CORTE',outflow:labor},{id:'LOCAL_PROD',outflow:admin}]}};
  state.__cycleSettlements[r]={inventory:{mp:r*(10-produced)},sales:[{id:'esencial',produced,available:r*(produced-sold)+sold,sold}],goods:{esencial:r*(produced-sold)}};
 }
 const f=F.calculate({capital:10000,round:cycles,catalog:cat,ledger,sectionsByRound,state,financialPolicy:{cycles}});
 for(const h of f.history){const e=h.estadoResultados,b=h.balanceGeneral;assert.ok(Math.abs(b.activos-b.pasivoPatrimonio)<.02);assert.equal(e.costoVentas,produced?sold*12:0);assert.equal(e.gastosAdministrativos,admin+(produced?0:labor));}
 if(sold===0)assert.equal(f.estadoResultados.gastosVentas,0);
 output.push({name,simulated:true,cycles,produced,sold,net:f.estadoResultados.utilidadNeta,cogs:f.estadoResultados.costoVentas,goods:f.balanceGeneral.inventarioPT});
}
scenario('sin producción',{produced:0,sold:0});scenario('sin ventas',{sold:0});scenario('ventas parciales',{sold:4});scenario('ventas completas');scenario('fijos elevados',{admin:1000});
// Distinta combinación de recursos contables, manteniendo costo de fabricación verificable.
scenario('recursos alternativos',{labor:20,admin:40,price:50});scenario('continuidad tres ciclos',{cycles:3});scenario('continuidad seis ciclos',{cycles:6});
fs.writeFileSync('tests/output/forense_utilidad/resultados.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
