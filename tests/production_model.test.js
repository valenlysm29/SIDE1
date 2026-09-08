'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../production_model');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../decision_catalog.js'),'utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));

function context(drafts={},patch={}){return {catalog,state:{},drafts,round:1,workingDays:30,...patch};}
function completeLine(extra={}){
  return {
    MESA_CORTE:{quantities:{mesa:1}},ENSAMBLE:{quantities:{ens_ind:1}},ACABADOS:{quantities:{aca_ind:1}},
    PERS_CORTE:{quantities:{corte_maestro:1}},PERS_ENSAMBLE:{quantities:{ens_personal_esp:1}},PERS_ACABADO:{quantities:{aca_personal_art:1}},
    JEFATURA:{optionIds:['si_jefatura']},MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{value:100},
    CUERO:{quantities:{cuero_sint:30}},ACCESORIOS:{quantities:{acc_eco:100}},HILO:{quantities:{hilo_std:3}},...extra
  };
}

test('workbook conversions turn purchases into usable raw material',()=>{
  const plan=model.calculate(context(completeLine()));
  assert.equal(plan.materials.find(m=>m.id==='CUERO').available,30);
  assert.equal(plan.materials.find(m=>m.id==='HILO').available,810);
  assert.equal(plan.materialCapacity,100);assert.equal(plan.producibleUnits,100);
});

test('a raw-material shortage limits all three production processes',()=>{
  const plan=model.calculate(context(completeLine({CUERO:{quantities:{cuero_sint:29}}})));
  assert.equal(plan.materialCapacity,96);assert.equal(plan.producibleUnits,96);assert.equal(plan.productionGap,4);
  assert.deepEqual(plan.processes.map(process=>process.plannedUnits),[96,96,96]);
});

test('workers and machines are paired and the slowest process is the bottleneck',()=>{
  const plan=model.calculate(context(completeLine({
    PERS_CORTE:{quantities:{corte_basico:1}},MESA_CORTE:{quantities:{mesa:1}},PRODUCCION_META:{value:500},
    CUERO:{quantities:{cuero_sint:200}},ACCESORIOS:{quantities:{acc_eco:500}},HILO:{quantities:{hilo_std:20}}
  })));
  assert.equal(plan.processes.find(p=>p.id==='cut').dailyCapacity,6);
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

test('industrial DOP exposes operations and inspections in sequence',()=>{
  const plan=model.calculate(context(completeLine()));
  assert.equal(plan.dop.length,9);assert.equal(plan.dop.filter(step=>step.type==='operation').length,5);
  assert.equal(plan.dop.filter(step=>step.type==='inspection').length,4);
  assert.deepEqual(plan.dop.map(step=>step.sequence),[1,2,3,4,5,6,7,8,9]);
});
