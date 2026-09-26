import test from 'node:test';
import assert from 'node:assert/strict';
import {stepVehicle,vehicleHits} from '../services/vehicle_motion.mjs';
const make=()=>({x:0,z:0,yaw:0,speed:0,steer:0,wheelAngle:0});
function run(car,input,seconds,hz=60,blocked){for(let i=0;i<seconds*hz;i++)stepVehicle(car,input,1/hz,blocked);return car;}
test('acceleration and steering are stable across frame rates',()=>{
  const a=run(make(),{throttle:1,steer:.3},3,30),b=run(make(),{throttle:1,steer:.3},3,120);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.5);assert.ok(a.speed>10&&a.speed<=19);assert.ok(a.x<0);
});
test('brake stops without reversing; reverse is limited',()=>{
  const car=run(make(),{throttle:1},2);run(car,{brake:true},2);
  assert.equal(car.speed,0);run(car,{throttle:-1},3);assert.ok(car.speed>=-6&&car.speed<0);
});
test('swept substeps stop the bumper at a thin wall',()=>{
  const wall={minX:-10,maxX:10,minZ:-6.1,maxZ:-6},car=make();
  run(car,{throttle:1},4,30,(x,z,yaw)=>vehicleHits(x,z,yaw,[wall]));
  assert.ok(car.z>-3.72);assert.equal(car.speed,0);assert.equal(vehicleHits(car.x,car.z,car.yaw,[wall]),false);
});
test('rotated chassis and world bounds are respected',()=>{
  const wall={minX:2,maxX:3,minZ:-.3,maxZ:.3};
  assert.equal(vehicleHits(0,0,Math.PI/2,[wall]),true);
  assert.equal(vehicleHits(0,0,0,[wall]),false);
  assert.equal(vehicleHits(0,9,0,[],{minX:-10,maxX:10,minZ:-10,maxZ:10}),true);
});
