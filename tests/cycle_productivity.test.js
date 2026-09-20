'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../production_model'),rules=require('../side_rules');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

test('cycle productivity uses recorded output and does not substitute planned units',()=>{
  const result=model.cycleProductivity({target:120,producibleUnits:110},{round:3,producedUnits:45},3);
  assert.equal(result.produced,45);assert.equal(result.compliance,37.5);assert.equal(result.difference,75);
});
test('changing the target updates percentage and signed difference without capping at 100',()=>{
  const record={round:1,producedUnits:150};
  assert.equal(model.cycleProductivity({target:200},record,1).compliance,75);
  const result=model.cycleProductivity({target:100},record,1);
  assert.equal(result.compliance,150);assert.equal(result.difference,-50);
});
test('zero or absent target, absent output and output from another cycle are safe',()=>{
  for(const target of [0,undefined,null,NaN,Infinity])assert.equal(model.cycleProductivity({target},{round:1,producedUnits:10},1).compliance,null);
  for(const record of [null,{round:2,producedUnits:30},{round:1,producedUnits:NaN},{round:1,producedUnits:null},{round:1,producedUnits:-2}]){
    const result=model.cycleProductivity({target:100},record,1);
    assert.equal(result.produced,null);assert.equal(result.compliance,null);assert.equal(result.difference,null);
  }
  assert.equal(model.cycleProductivity({target:100},{round:1,producedUnits:0},1).compliance,0);
});
test('legacy multiple stores normalize to one, keeping its district and first contract',()=>{
  const old={round:2,optionIds:['web','miraflores','sjl'],quantities:{miraflores:3,sjl:4},storeContracts:{miraflores:[{round:1,quantity:2},{round:2,quantity:1}]}};
  const snapshot=JSON.stringify(old),single=rules.singleStore(old);
  assert.deepEqual(single.optionIds,['web','miraflores']);assert.deepEqual(single.quantities,{miraflores:1});
  assert.equal(rules.storeCount(single),1);assert.equal(rules.committedQuantity(single,'miraflores',3),1);
  assert.deepEqual(rules.nextStoreBatches(single,'miraflores',1,3),[{round:1,quantity:1}]);
  assert.equal(JSON.stringify(old),snapshot);assert.deepEqual(rules.singleStore(single),single);
  assert.equal(rules.storeCount(rules.singleStore({optionIds:['web']})),1);
});
test('production record is scoped to active company and cycle, never reconstructed from inventory',()=>{
  const data=new Map();let round=1,company='Example';
  const context={window:{SIDE_GAME_BRIDGE:{currentRound:()=>round,companyName:()=>company}},document:{getElementById:()=>({textContent:'CODE'})},localStorage:{getItem:key=>data.get(key)||null}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8'),context);
  const read=context.window.SIDE3D.cycleProductionRecord;
  assert.equal(read(),null);
  data.set('side3d_inventory_CODE_Example_1',JSON.stringify({totalTarget:200,reserve:{esencial:100},sold:{esencial:20}}));
  assert.equal(read(),null);
  data.set('side3d_inventory_CODE_Example_1',JSON.stringify({producedUnits:65,reserve:{esencial:999}}));
  assert.equal(read().producedUnits,65);
  round=2;assert.equal(read(),null);round=1;company='Another';assert.equal(read(),null);
});

test('realized cycle output is recorded once on creation and added production, excluding supplied stock',()=>{
  const data=new Map();let target=80;
  const context={window:{SIDE_GAME_BRIDGE:{currentRound:()=>1,companyName:()=> 'Factory',productionPlan:()=>({producibleUnits:target,productLines:[{plannedUnits:target},{plannedUnits:0},{plannedUnits:0}]})}},document:{getElementById:()=>({textContent:'CODE'})},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)}};
  // Expose only the existing loader in this isolated VM, without starting WebGL.
  const source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8').replace('window.SIDE3D = { prepare,','window.SIDE3D = { loadInventory, prepare,');
  vm.runInNewContext(source,context);
  const simulator=context.window.SIDE3D;
  simulator.loadInventory();assert.equal(simulator.cycleProductionRecord().producedUnits,80);
  simulator.loadInventory();assert.equal(simulator.cycleProductionRecord().producedUnits,80);
  target=100;simulator.loadInventory();assert.equal(simulator.cycleProductionRecord().producedUnits,100);
  const key='side3d_inventory_CODE_Factory_1',inventory=JSON.parse(data.get(key));
  inventory.reserve.esencial+=25;data.set(key,JSON.stringify(inventory));
  simulator.loadInventory();assert.equal(simulator.cycleProductionRecord().producedUnits,100);
});
