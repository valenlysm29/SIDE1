import test from 'node:test';
import assert from 'node:assert/strict';
import {stepPlayerMotion} from '../services/player_motion.mjs';
import {advance,NPC_RADIUS,resolveCircleMotion} from '../services/npc_navigation.mjs';
import * as vehicleMotion from '../services/vehicle_motion.mjs';
import * as THREE from '../vendor/three/build/three.module.js';
import {createBusinessInteriors} from '../services/business_interiors.mjs';

const player=(x=0,z=0)=>({x,z,vx:0,vz:0,grounded:true,radius:.36});
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
test('a player already overlapping a person separates gradually and can escape',()=>{
  const p=player(),npc={x:0,z:0,radius:NPC_RADIUS};let biggest=0;
  for(let frame=0;frame<120;frame++){
    const old={...p};stepPlayerMotion(p,{},1/60,()=>false,{neighbors:[npc]});
    biggest=Math.max(biggest,gap(p,old));
  }
  assert.ok(gap(p,npc)>=p.radius+npc.radius-1e-5,'overlap trapped the player');
  assert.ok(biggest<.025,'separation teleported the player');
  const old={...p};for(let i=0;i<60;i++)stepPlayerMotion(p,{forward:-1},1/60,()=>false,{neighbors:[npc]});
  assert.ok(gap(p,old)>.8,'player could not walk away');
});
test('player slides around a person without penetrating and releases contact on reverse',()=>{
  const p=player(-.1,1),npc={x:0,z:0,radius:NPC_RADIUS};
  for(let i=0;i<150;i++){
    stepPlayerMotion(p,{side:1,forward:1},1/60,()=>false,{neighbors:[npc]});
    assert.ok(gap(p,npc)>=p.radius+npc.radius-1e-6,'player crossed person');
  }
  assert.ok(p.x>2&&p.z<-1,'contact blocked tangential walking');
});
test('sliding between three people preserves every contact instead of reintroducing overlap',()=>{
  const start={x:0,z:0},desired={x:-.02374441078589561,z:.07433087225591725};
  const neighbors=[{x:.7077050796200355,z:.5151021605199954,radius:.29},
    {x:-.6469932984438943,z:-.1664983798339415,radius:.29},
    {x:.4054462538889237,z:.5262554623293002,radius:.29}];
  const next=resolveCircleMotion(start,desired,{radius:.36,neighbors});
  for(const other of neighbors)assert.ok(gap(next,other)>=.65-1e-7,'a later contact undid previous separation');
});
test('separation against an obstacle corner never pushes a player through a wall or bounds',()=>{
  const p=player(.1,.7),npc={x:.2,z:.7,radius:NPC_RADIUS};
  const blocked=(x,z)=>x<0||z<0||x>2||z>2;
  for(let i=0;i<120;i++){
    stepPlayerMotion(p,{side:1},1/60,blocked,{neighbors:[npc]});
    assert.equal(blocked(p.x,p.z),false);
  }
  assert.ok(gap(p,npc)>=p.radius+npc.radius-1e-5,'corner trapped the player');
});
test('NPC respects a player radius and walks past without a teleport',()=>{
  const state={x:0,z:0,yaw:0,speed:0},p=player(0,1.5);let travelled=0;
  for(let i=0;i<900;i++){
    const moved=advance(state,{x:0,z:6},1/60,[],[p],1.1);
    assert.ok(gap(state,p)>=NPC_RADIUS+p.radius-1e-6,'NPC penetrated player');
    assert.ok(moved.distance<=1.1/60+1e-8,'NPC teleported');
    assert.ok(Math.abs(moved.turnRate)<=2.6+1e-8);
    travelled+=moved.distance;
  }
  assert.ok(state.z>4&&travelled>4,'stationary player froze the NPC');
});
test('vehicle chassis checks pedestrian circles and stops before contact in either heading',()=>{
  assert.equal(typeof vehicleMotion.vehicleHitsPeople,'function');
  for(const yaw of [0,Math.PI/2]){
    const car={x:0,z:0,yaw,speed:19,steer:0},p=player(-Math.sin(yaw)*6,-Math.cos(yaw)*6);
    for(let i=0;i<120;i++){
      vehicleMotion.stepVehicle(car,{throttle:1},1/60,(x,z,heading)=>vehicleMotion.vehicleHitsPeople(x,z,heading,[p]));
      assert.equal(vehicleMotion.vehicleHitsPeople(car.x,car.z,car.yaw,[p]),false,'bumper crossed person');
    }
    assert.equal(car.speed,0);
    assert.equal(gap(p,player(-Math.sin(yaw)*6,-Math.cos(yaw)*6)),0,'car pushed player');
  }
});
test('an interior walker near the player keeps moving while workers retain their station',()=>{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
  const interiors=createBusinessInteriors({scene:new THREE.Scene(),createNpc:()=>new THREE.Group()});
  try{
    interiors.tick(.05,player(130,18));
    const room=interiors.rooms.find(room=>room.id==='store'),actor=room.actors.find(actor=>!actor.route.stationary);
    assert.ok(actor,'store walker exists');
    const p=player(actor.object.position.x+150-.8,actor.object.position.z);
    const fixed=room.actors.filter(actor=>actor.route.stationary).map(actor=>({actor,x:actor.object.position.x,z:actor.object.position.z}));
    let travelled=0;
    for(let i=0;i<120;i++){
      const old={x:actor.object.position.x,z:actor.object.position.z};
      interiors.tick(.05,p);
      travelled+=gap(old,actor.object.position);
      assert.ok(gap({x:actor.object.position.x+150,z:actor.object.position.z},p)>=NPC_RADIUS+p.radius-1e-6);
    }
    assert.ok(travelled>.3,'interior proximity gate froze the walker');
    for(const entry of fixed){assert.equal(entry.actor.object.position.x,entry.x);assert.equal(entry.actor.object.position.z,entry.z)}
  }finally{interiors.dispose()}
});
