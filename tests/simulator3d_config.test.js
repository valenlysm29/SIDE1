'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const config=require('../simulator3d-config');

test('the reformed world has three separated business sectors',()=>{
  const {store,production,warehouse}=config.WORLD;
  assert.ok(store.minZ>production.maxZ);
  assert.ok(production.maxX<warehouse.minX);
  assert.ok(store.minZ>warehouse.maxZ);
});

test('the city contains a crosswalk between the store and customer spawn',()=>{
  const {crosswalk,customerSpawn,storeApproach}=config.WORLD;
  assert.ok(customerSpawn.z>crosswalk.maxZ);
  assert.ok(storeApproach.z<crosswalk.minZ);
  assert.ok(crosswalk.minX<0&&crosswalk.maxX>0);
});

test('the complete customer state machine is declared',()=>{
  for(const state of ['SPAWN','WALK_TO_STORE','ENTER_STORE','BROWSE','COMPARE','SEEK_SALES_ASSISTANT','WAIT_FOR_ASSISTANCE','TAKE_PRODUCT','WALK_TO_CHECKOUT','QUEUE','PAY','LEAVE_STORE','WAIT_CROSSWALK','CROSS_STREET','DESPAWN'])assert.equal(config.NPC_STATES[state],state);
});

test('every quality level sets finite simulation limits',()=>{
  for(const level of ['low','medium','high','auto']){
    const preset=config.PERFORMANCE[level];
    assert.ok(preset.pixelRatio>0&&preset.maxCustomers>0&&preset.maxCars>0&&preset.farAnimationFps>0);
  }
});

test('the local human avatar is a valid GLB with idle and walk clips',()=>{
  const data=fs.readFileSync(path.join(__dirname,'../assets/models/yuka.glb'));
  assert.equal(data.toString('ascii',0,4),'glTF');
  const jsonLength=data.readUInt32LE(12),json=JSON.parse(data.toString('utf8',20,20+jsonLength));
  const names=(json.animations||[]).map(animation=>animation.name);
  assert.ok(names.includes('Character_Idle'));
  assert.ok(names.includes('Character_Walk'));
});

test('simulator source connects events, production and financial sales',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8');
  assert.match(source,/activeEvents\?\.\(\)/);
  assert.match(source,/productionPlan\?\.\(\)/);
  assert.match(source,/recordSimulatedSale\?\.\(salePrice\)/);
  assert.match(source,/trafficLight==='pedestrians'/);
});
