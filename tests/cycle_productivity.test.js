'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../js/production_model'),rules=require('../js/side_rules');
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
  const snapshot=JSON.stringify(old),single=rules.singleStoreSelection(old,3);
  assert.deepEqual(single.optionIds,['web','miraflores']);assert.deepEqual(single.quantities,{miraflores:1});
  assert.equal(rules.storeCount(single),1);assert.equal(rules.committedQuantity(single,'miraflores',3),1);
  assert.deepEqual(rules.nextStoreBatches(single,'miraflores',1,3),[{round:1,quantity:1}]);
  assert.equal(JSON.stringify(old),snapshot);assert.deepEqual(rules.singleStoreSelection(single,3),single);
  // A web-only channel never creates a physical store or a store commission.
  assert.equal(rules.storeCount(rules.singleStoreSelection({optionIds:['web']})),0);
});
test('world exposes no production record back to the economic model',()=>{
 const data=new Map();let round=1,company='Example';
 const context={window:{SIDE_WORLD_BRIDGE:{getWorldSnapshot:()=>({company:{name:company,gameCode:'CODE'},cycle:round,approximateStock:80,products:[],storeLevel:{visual:{}}})}},document:{getElementById:()=>({textContent:'CODE'})},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)}};
 const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8').replace('window.SIDE3D = { prepare,','window.SIDE3D = { loadInventory, prepare,');
 vm.runInNewContext(source,context);
 const world=context.window.SIDE3D;assert.equal(world.cycleProductionRecord,undefined);
 world.loadInventory();const key='side3d_fun_inventory_CODE_Example_1';
 assert.equal(JSON.parse(data.get(key)).producedUnits,80);
 world.loadInventory();assert.equal(JSON.parse(data.get(key)).producedUnits,80);
 round=2;world.loadInventory();assert.ok(data.has('side3d_fun_inventory_CODE_Example_2'));
 company='Another';world.loadInventory();assert.ok(data.has('side3d_fun_inventory_CODE_Another_2'));
});
test('local display production and supplier stock never provide economic productivity',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
 assert.doesNotMatch(source,/SIDE3D\.cycleProductionRecord/);
 assert.equal(model.cycleProductivity({target:100},null,1).produced,null);
});
