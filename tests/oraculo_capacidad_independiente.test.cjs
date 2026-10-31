'use strict';
// Independent arithmetic oracle derived from documented SIDE rules, not from
// production_model.js. Constants are intentionally duplicated for comparison.
const test=require('node:test'),assert=require('node:assert/strict');
const actual=require('../js/production_model.js');
const temporal=require('../js/temporal_production.js');
const {catalog}=require('./economic_v19_fixture.cjs');
const rates=[[6,8,12],[6,8,12],[6,8,12]],multipliers=[[1],[1,1.2,1.5],[1,1.2,1.5]];
const staffIds=[['corte_basico','corte_exp','corte_maestro'],['ens_personal_basico','ens_personal_ind','ens_personal_esp'],['aca_personal_basico','aca_personal_tec','aca_personal_art']];
const machineIds=[['mesa'],['ens_basica','ens_semi','ens_ind'],['aca_basica','aca_semi','aca_ind']];
const staffKeys=['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'],machineKeys=['MESA_CORTE','ENSAMBLE','ACABADOS'];
const recipes=[[.3,1,6],[.4,1,7],[.7,1,13]];
function oracle(x){
 const eff=(90+x.workers.reduce((n,w)=>n+w[2],0)+(x.leadership?4:0))/100;
 const stages=x.workers.map((counts,i)=>{
  const workers=[];counts.forEach((q,j)=>{for(let k=0;k<q;k++)workers.push(rates[i][j]);});workers.sort((a,b)=>b-a);
  const machines=[];x.machines[i].forEach((q,j)=>{for(let k=0;k<q;k++)machines.push(multipliers[i][j]);});machines.sort((a,b)=>b-a);
  const daily=workers.slice(0,machines.length).reduce((s,v,j)=>s+v*machines[j],0);
  return Math.round(daily*30*eff);
 });
 const stock=x.materials.map((q,i)=>q+(x.opening||[0,0,0])[i]);let cap=Math.min(...stages),produced=[];
 for(let i=0;i<3;i++){
  const limits=recipes[i].map((q,j)=>Math.floor((stock[j]+1e-8)/q));
  const units=Math.max(0,Math.min(x.targets[i],cap,...limits));produced.push(units);cap-=units;
  for(let j=0;j<3;j++)stock[j]-=units*recipes[i][j];
 }
 return {stages,eff,produced,remaining:stock};
}
function input(x){
 const state={};for(let i=0;i<3;i++){
  state[staffKeys[i]]={round:1,quantities:Object.fromEntries(staffIds[i].map((id,j)=>[id,x.workers[i][j]]))};
  const counts=Object.fromEntries(machineIds[i].map((id,j)=>[id,x.machines[i][j]]));state[machineKeys[i]]={round:1,quantities:counts,purchases:{1:counts}};
 }
 for(const [i,id,sku] of [[0,'CUERO','cuero_sint'],[1,'ACCESORIOS','acc_eco'],[2,'HILO','hilo_std']])state[id]={round:1,quantities:{[sku]:x.materials[i]}};
 state.__inventarioMP={cuero_sint:(x.opening||[0,0,0])[0],acc_eco:(x.opening||[0,0,0])[1],hilo_std:(x.opening||[0,0,0])[2]};
 state.MOLDE={round:1,optionIds:['molde_1','molde_2','molde_3']};state.PRODUCCION_META={round:1,moldTargets:Object.fromEntries(x.targets.map((n,i)=>['molde_'+(i+1),n]))};
 state.JEFATURA={round:1,optionIds:[x.leadership?'si_jefatura':'no_jefatura']};return {state,catalog,round:1};
}
const base={workers:[[1,0,0],[1,0,0],[1,0,0]],machines:[[1],[1,0,0],[1,0,0]],targets:[10,0,0],materials:[10000,10000,100000]};
const cases=[
 ['meta inferior',{}],['igual capacidad',{targets:[162,0,0]}],['meta elevada',{targets:[2000,0,0]}],
 ['sin trabajador corte',{workers:[[0,0,0],[1,0,0],[1,0,0]]}],['sin máquina ensamble',{machines:[[1],[0,0,0],[1,0,0]]}],
 ['cuello corte',{workers:[[1,0,0],[2,0,0],[2,0,0]],machines:[[1],[2,0,0],[2,0,0]]}],
 ['trabajadores insuficientes',{workers:[[1,0,0],[1,0,0],[1,0,0]],machines:[[3],[3,0,0],[3,0,0]],targets:[1000,0,0]}],
 ['equipos insuficientes',{workers:[[3,0,0],[3,0,0],[3,0,0]],machines:[[1],[1,0,0],[1,0,0]],targets:[1000,0,0]}],
 ['cuello ensamblado',{workers:[[2,0,0],[1,0,0],[2,0,0]],machines:[[2],[1,0,0],[2,0,0]]}],
 ['cuello acabado',{workers:[[2,0,0],[2,0,0],[1,0,0]],machines:[[2],[2,0,0],[1,0,0]]}],
 ['cuero insuficiente',{targets:[100,0,0],materials:[3,100,1000]}],
 ['mezcla y prioridad',{targets:[10,20,30],materials:[40,100,1000]}],
 ['sobrantes anteriores',{targets:[10,0,0],materials:[0,0,0],opening:[3,10,60]}],
 ['niveles y jefatura',{workers:[[1,0,1],[0,1,1],[0,0,2]],machines:[[2],[0,1,1],[0,1,1]],leadership:true,targets:[1000,0,0]}]
];
for(const [name,overrides] of cases)test('oráculo independiente: '+name,()=>{
 const scenario={...base,...overrides},expected=oracle(scenario),result=actual.calculate(input(scenario));
 assert.deepEqual(result.processes.map(p=>p.cycleCapacity),expected.stages);assert.equal(result.efficiency,expected.eff);
 assert.deepEqual(result.productLines.map(p=>p.plannedUnits),expected.produced);
 result.materials.forEach((m,i)=>assert.ok(Math.abs(m.remaining-expected.remaining[i])<1e-7,`${m.id}: ${m.remaining} != ${expected.remaining[i]}`));
});
test('oráculo temporal: recepción parcial no adelanta pedidos ni reutiliza capacidad pasada',()=>{
 const out=temporal.calculateBySku({opening:{leather:0,accessories:10,thread:60},skuFamilies:{leather:'leather',accessories:'accessories',thread:'thread'},receipts:[{id:'a',day:2,sku:'leather',material:'leather',quantity:3},{id:'b',day:5,sku:'leather',material:'leather',quantity:3}],startDay:0,days:4,dailyCapacity:2,efficiency:1,targets:{basic:10,medium:0,premium:0},molds:{basic:true,medium:false,premium:false}});
 assert.equal(out.produced.basic,4);assert.equal(out.stockBySku.leather,1.8);assert.equal(out.pending.length,1);
});
test('oráculo temporal: prioriza básico, mejorado y premium con inventario de apertura',()=>{
 const out=temporal.calculateBySku({opening:{leather:5,accessories:8,thread:80},skuFamilies:{leather:'leather',accessories:'accessories',thread:'thread'},receipts:[],startDay:30,days:2,dailyCapacity:10,efficiency:1,targets:{basic:2,medium:3,premium:3},molds:{basic:true,medium:true,premium:true}});
 assert.deepEqual(out.produced,{basic:2,medium:3,premium:3});assert.equal(out.consumedBySku.leather,3.9);assert.equal(out.consumedBySku.thread,72);assert.equal(out.stockBySku.leather,1.1);assert.equal(out.stockBySku.thread,8);
});
test('el material limitante se identifica en mezcla con prioridad secuencial',()=>{
 const scenario={...base,targets:[10,0,10],materials:[5,100,1000]};
 const plan=actual.calculate(input(scenario));
 assert.deepEqual(plan.productLines.map(x=>x.plannedUnits),[10,0,2]);
 assert.deepEqual(plan.limitingMaterials,['Cuero']);
});
test('se informan empates de materiales y no se atribuyen faltantes si la meta se completa',()=>{
 const tied=actual.calculate(input({...base,targets:[20,0,0],materials:[3,10,600]}));
 assert.equal(tied.materialCapacity,10);assert.deepEqual(tied.limitingMaterials,['Cuero','Accesorios']);
 const enough=actual.calculate(input({...base,targets:[10,0,0],materials:[3,10,60]}));
 assert.equal(enough.materialCapacity,10);assert.deepEqual(enough.limitingMaterials,[]);
});
test('asignaciones históricas válidas se respetan sin exceder recursos',()=>{
 const scenario={...base,workers:[[1,0,0],[1,0,1],[1,0,0]],machines:[[1],[1,0,1],[1,0,0]]};
 const ctx=input(scenario);ctx.state.PERS_ENSAMBLE.assignments={ens_personal_basico:{ens_ind:1},ens_personal_esp:{ens_basica:1}};
 const plan=actual.calculate(ctx),stage=plan.processes[1];
 assert.equal(stage.dailyCapacity,6*1.5+12);assert.equal(stage.pairs,2);assert.equal(stage.cycleCapacity,Math.round(21*30*.91));
});
