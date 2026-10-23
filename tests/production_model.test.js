'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../js/production_model');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/decision_catalog.js'),'utf8'),sandbox);
const catalog=JSON.parse(JSON.stringify(sandbox.window.SIDE_DECISION_CATALOG));

function context(drafts={},patch={}){return {catalog,state:{},drafts,round:1,workingDays:24,...patch};}
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

test('physical persisted inventory adds to current purchases without a second pack conversion or charge',()=>{
  const drafts=completeLine({CUERO:{quantities:{cuero_std:10}},ACCESORIOS:{quantities:{acc_eco:90}},HILO:{quantities:{hilo_std:1}}});
  const withoutStock=model.calculate(context(drafts));
  const plan=model.calculate(context(drafts,{state:{__inventarioMP:{'INS-02':10.5,'INS-04':10,'INS-06':330}}}));
  const leather=plan.materials.find(row=>row.id==='CUERO'),thread=plan.materials.find(row=>row.id==='HILO');
  assert.equal(leather.inventoryAvailable,10.5);assert.equal(leather.purchasesAvailable,20);assert.equal(leather.available,30.5);
  assert.deepEqual(leather.inventoryByCode,{'INS-02':10.5});
  assert.equal(thread.inventoryAvailable,330);assert.equal(thread.purchasesAvailable,270);assert.equal(thread.available,600);
  assert.equal(plan.producibleUnits,100);
  const comparison=plan.comparison.items.find(row=>row.id==='CUERO');
  assert.equal(comparison.inventoryAvailable,10.5);assert.equal(comparison.purchasesAvailable,20);
  assert.equal(comparison.available,30.5);assert.equal(comparison.missing,0);assert.equal(comparison.surplus,0.5);
  assert.deepEqual(plan.requirements,withoutStock.requirements);
  assert.deepEqual(plan.costs,withoutStock.costs);assert.equal(plan.comparison.currentCost,withoutStock.comparison.currentCost);
});

test('material stock accepts only explicit valid physical codes and never infers old purchases',()=>{
  const drafts=completeLine({CUERO:{quantities:{}},ACCESORIOS:{quantities:{}},HILO:{quantities:{}}});
  const state={__inventarioMP:{'INS-01':-5,'INS-02':Infinity,'INS-03':'2.5','INS-04':'bad','INS-99':99999,cuero_sint:99999},
    CUERO:{round:1,quantities:{cuero_sint:500},purchases:{1:{cuero_std:500}}}};
  const plan=model.calculate(context(drafts,{round:2,state}));
  assert.equal(plan.materials.find(row=>row.id==='CUERO').available,2.5);
  assert.deepEqual(plan.materials.find(row=>row.id==='CUERO').inventoryByCode,{'INS-01':0,'INS-03':2.5});
  assert.equal(plan.materials.find(row=>row.id==='ACCESORIOS').available,0);
  assert.equal(plan.materials.find(row=>row.id==='HILO').available,0);
  assert.equal(plan.producibleUnits,0);
});

test('workers and machines are paired and the slowest process is the bottleneck',()=>{
  const plan=model.calculate(context(completeLine({
    PERS_CORTE:{quantities:{corte_basico:1}},MESA_CORTE:{quantities:{mesa:1}},PRODUCCION_META:{value:500},
    CUERO:{quantities:{cuero_sint:200}},ACCESORIOS:{quantities:{acc_eco:500}},HILO:{quantities:{hilo_std:20}}
  })));
  // CAMBIOS_DOP_Y_PRODUCCION.md: 24 productive days; current basic cutting rate is 5/day.
  // Two level-three workers and leadership yield 96%: round(5 * 24 * 0.96) = 115.
  assert.equal(plan.days,24);
  assert.equal(plan.processes.find(p=>p.id==='cut').dailyCapacity,5);
  assert.equal(plan.efficiency,0.96);
  assert.equal(plan.processCapacity,115);assert.equal(plan.producibleUnits,115);
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
  assert.equal(plan.productLines.find(line=>line.id==='molde_1').productionPercent,93);
  assert.equal(plan.productLines.find(line=>line.id==='molde_3').plannedUnits,0);
});
