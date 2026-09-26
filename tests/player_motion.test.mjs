import test from 'node:test';
import assert from 'node:assert/strict';
import {stepPlayerMotion,constrainCamera,advanceVehicleTransition} from '../services/player_motion.mjs';
const make=()=>({x:0,z:0,vx:0,vz:0,grounded:true});
function run(p,input,seconds,hz=60,blocked){for(let i=0;i<seconds*hz;i++)stepPlayerMotion(p,input,1/hz,blocked);return p;}
test('camera-relative walking and normalized diagonal keep matching speed',()=>{
  const straight=run(make(),{forward:1},2),diagonal=run(make(),{forward:1,side:1},2);
  assert.ok(Math.abs(Math.hypot(straight.x,straight.z)-Math.hypot(diagonal.x,diagonal.z))<.001);
  const turned=run(make(),{forward:1,yaw:Math.PI/2},2);assert.ok(turned.x<-4);assert.ok(Math.abs(turned.z)<.001);
});
test('idle walk run and reverse transitions accelerate and settle without drift',()=>{
  const p=make();stepPlayerMotion(p,{forward:1},1/60);assert.ok(p.speed>0&&p.speed<2.65);
  run(p,{forward:1},1);assert.equal(p.locomotion,'WALK');
  run(p,{forward:1,sprint:true},1);assert.equal(p.locomotion,'RUN');
  run(p,{forward:1},1);assert.equal(p.locomotion,'WALK');
  run(p,{},1);assert.equal(p.locomotion,'IDLE');assert.equal(p.vz,0);
});
test('locomotion is stable at 30/120 Hz and cannot cross a thin wall',()=>{
  const a=run(make(),{forward:1,sprint:true},2,30),b=run(make(),{forward:1,sprint:true},2,120);
  assert.ok(Math.abs(a.z-b.z)<.025);
  const wall=run(make(),{forward:1,sprint:true},2,30,(x,z)=>z<-1&&z>-1.08);
  assert.ok(wall.z>=-1);assert.equal(wall.speed,0);
});
test('camera clamps exact wall intersection, including smoothed endpoint behind wall',()=>{
  const f={x:0,y:1.5,z:0},wall={minX:-2,maxX:2,minZ:2,maxZ:2.01};
  const safe=constrainCamera(f,{x:0,y:4,z:7},[wall]);assert.ok(safe.z<1.78);assert.ok(safe.z>1);
  const sideways=constrainCamera(f,{x:4,y:3,z:1},[wall]);assert.deepEqual(sideways,{x:4,y:3,z:1});
});
test('vehicle transition approaches door over time and completes once',()=>{
  const t={from:{x:0,z:0},to:{x:2,z:1},elapsed:0,duration:.55};
  let result=advanceVehicleTransition(t,1/60);assert.ok(result.x>0&&result.x<2);assert.equal(result.done,false);
  for(let i=0;i<40;i++)result=advanceVehicleTransition(t,1/60);
  assert.deepEqual(result,{x:2,z:1,done:true});
});
