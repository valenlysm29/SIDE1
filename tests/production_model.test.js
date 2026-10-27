'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../js/production_model');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/decision_catalog.js'),'utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));

function context(drafts={},patch={}){return {catalog,state:{},drafts,round:1,...patch};}
function completeLine(extra={}){
  return {
    MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_ind:1}},ACABADOS:{quantities:{aca_ind:1}},
    PERS_CORTE:{quantities:{corte_maestro:1}},PERS_ENSAMBLE:{quantities:{ens_personal_esp:1}},PERS_ACABADO:{quantities:{aca_personal_art:1}},
    JEFATURA:{optionIds:['si_jefatura']},MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{value:100},
    CUERO:{quantities:{cuero_sint:30}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:600}},...extra
  };
}

test('purchase fields use physical material units without multiplying by packs',()=>{
  const plan=model.calculate(context(completeLine()));
  assert.equal(plan.materials.find(m=>m.id==='CUERO').available,30);
  assert.equal(plan.materials.find(m=>m.id==='HILO').available,600);
  assert.equal(plan.materialCapacity,100);assert.equal(plan.producibleUnits,100);
});

test('a raw-material shortage limits all three production processes',()=>{
  const plan=model.calculate(context(completeLine({CUERO:{quantities:{cuero_sint:29}}})));
  assert.equal(plan.materialCapacity,96);assert.equal(plan.producibleUnits,96);assert.equal(plan.productionGap,4);
  assert.deepEqual(plan.processes.map(process=>process.plannedUnits),[96,96,96]);
});

test('physical inventory adds to current purchases without charging inventory again',()=>{
  const drafts=completeLine({CUERO:{quantities:{cuero_std:20}},ACCESORIOS:{quantities:{acc_eco:90}},HILO:{quantities:{hilo_std:270}}});
  const withoutStock=model.calculate(context(drafts));
  const plan=model.calculate(context(drafts,{state:{__inventarioMP:{cuero_std:10.5,acc_eco:10,hilo_std:330}}}));
  const leather=plan.materials.find(row=>row.id==='CUERO'),thread=plan.materials.find(row=>row.id==='HILO');
  assert.equal(leather.inventoryAvailable,10.5);assert.equal(leather.purchasesAvailable,20);assert.equal(leather.available,30.5);
  assert.equal(thread.inventoryAvailable,330);assert.equal(thread.purchasesAvailable,270);assert.equal(thread.available,600);
  assert.equal(plan.producibleUnits,100);assert.deepEqual(plan.costs,withoutStock.costs);
});
test('stock ignores invalid values and never infers old purchases',()=>{
  const drafts=completeLine({CUERO:{quantities:{}},ACCESORIOS:{quantities:{}},HILO:{quantities:{}}});
  const state={__inventarioMP:{cuero_sint:-5,cuero_std:Infinity,cuero_prem:'2.5',acc_eco:'bad',unknown:99999},CUERO:{round:1,quantities:{cuero_sint:500}}};
  const plan=model.calculate(context(drafts,{round:2,state}));
  assert.equal(plan.materials.find(row=>row.id==='CUERO').available,2.5);
  assert.equal(plan.materials.find(row=>row.id==='ACCESORIOS').available,0);assert.equal(plan.producibleUnits,0);
});

test('workers and machines are paired and the slowest process is the bottleneck',()=>{
  const plan=model.calculate(context(completeLine({
    PERS_CORTE:{quantities:{corte_basico:1}},MESA_CORTE:{quantities:{mesa:1}},PRODUCCION_META:{value:500},
    CUERO:{quantities:{cuero_sint:200}},ACCESORIOS:{quantities:{acc_eco:500}},HILO:{quantities:{hilo_std:3000}}
  })));
  // Source Markdown: 30 days, basic cutting 6/day, two N3 and leadership = 96%.
  assert.equal(plan.days,30);
  assert.equal(plan.processes.find(p=>p.id==='cut').dailyCapacity,6);
  assert.equal(plan.efficiency,0.96);
  assert.equal(plan.processCapacity,173);assert.equal(plan.producibleUnits,173);
});

test('level-three staff and production leadership reproduce the efficiency bonuses',()=>{
  const plan=model.calculate(context(completeLine()));
  assert.equal(plan.levelThree,3);assert.equal(plan.efficiency,0.97);
});

test('equipment acquired in a previous cycle remains available',()=>{
  const drafts=completeLine({MESA_CORTE:{quantities:{}},ENSAMBLE:{quantities:{}},ACABADOS:{quantities:{}}});
  const state={MESA_CORTE:{purchases:{1:{mesa:1}}},ENSAMBLE:{purchases:{1:{ens_ind:1}}},ACABADOS:{purchases:{1:{aca_ind:1}}}};
  const plan=model.calculate(context(drafts,{round:2,state}));
  assert.equal(plan.processes.every(process=>process.machines===1),true);assert.equal(plan.producibleUnits,100);
});

test('calculator keeps one target and material requirement for every mold',()=>{
  const drafts=completeLine({PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:20,molde_3:5}},MOLDE:{optionIds:['molde_2']},
    CUERO:{quantities:{cuero_sint:100}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:10}}});
  const plan=model.calculate(context(drafts));
  assert.equal(plan.target,35);assert.deepEqual(plan.productLines.map(line=>line.target),[10,20,5]);
  assert.equal(plan.materials.find(material=>material.id==='CUERO').neededForTarget,14.5);
  assert.equal(plan.materials.find(material=>material.id==='ACCESORIOS').neededForTarget,35);
  assert.equal(plan.materials.find(material=>material.id==='HILO').neededForTarget,265);
  assert.equal(plan.productLines.find(line=>line.id==='molde_2').selectedThisCycle,true);
});

test('industrial DOP separates operations, inspection and combined activity',()=>{
  const plan=model.calculate(context(completeLine()));
  // Explicit sequence documented in CAMBIOS_DOP_Y_PRODUCCION.md; preserve the delivered DOP.
  assert.deepEqual(plan.dop.map(({id,type,number})=>({id,type,number})),[
    {id:'cut',type:'operation',number:1},
    {id:'accessories_classification',type:'inspection',number:1},
    {id:'accessories_preparation',type:'operation',number:2},
    {id:'assembly_accessories',type:'combined',number:1},
    {id:'finish',type:'combined',number:2}
  ]);
  assert.equal(plan.dop.filter(step=>step.type==='operation').length,2);
  assert.equal(plan.dop.filter(step=>step.type==='inspection').length,1);
  assert.equal(plan.dop.filter(step=>step.type==='combined').length,2);
});

test('DOP data includes purchased material qualities and cycle yield by mold',()=>{
  const plan=model.calculate(context(completeLine({PRODUCCION_META:{moldTargets:{molde_1:80,molde_2:20,molde_3:0}}})));
  assert.equal(plan.materials.find(material=>material.id==='CUERO').selections[0].label,'Cuero sintético');
  assert.equal(plan.productLines.find(line=>line.id==='molde_1').productionPercent,100);
  assert.equal(plan.productLines.find(line=>line.id==='molde_2').plannedUnits,0);
  assert.equal(plan.productLines.find(line=>line.id==='molde_3').plannedUnits,0);
});

test('no available mold means no production despite complete staff and stock',()=>{const plan=model.calculate(context(completeLine({MOLDE:{optionIds:[]}})));assert.equal(plan.producibleUnits,0);assert.ok(plan.productLines.every(line=>line.plannedUnits===0));});
