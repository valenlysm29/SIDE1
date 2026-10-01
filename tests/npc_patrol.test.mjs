import test from 'node:test';
import assert from 'node:assert/strict';
import {createNpcPatrol} from '../services/npc_patrol.mjs';
import {NPC_RADIUS,segmentClear,expanded} from '../services/npc_navigation.mjs';

const bounds={minX:-12,maxX:12,minZ:-12,maxZ:12};
const solids=[{minX:-1,maxX:1,minZ:-2,maxZ:2}];
const points=[[-7,-7],[7,-7],[7,7],[-7,7]];

test('patrols move for sixty seconds, bound pauses and never cross a solid collider',()=>{
  const actors=Array.from({length:4},(_,i)=>{
    const route=points.slice(i).concat(points.slice(0,i));
    const patrol=createNpcPatrol({points:route,obstacles:solids,bounds,random:()=>.5,maxSpeed:1.05});
    const spawn=patrol.spawn(route[0]);
    return {patrol,state:{...spawn,yaw:Math.PI/2,speed:0},distance:0,windowDistance:0};
  });
  for(let tick=0;tick<1200;tick++)for(const actor of actors){
    const before={...actor.state};
    const result=actor.patrol.update(actor.state,.05,{neighbors:actors.filter(a=>a!==actor).map(a=>a.state)});
    actor.distance+=result.distance;actor.windowDistance+=result.distance;
    assert.ok(segmentClear(before,actor.state,expanded(solids)),'actor crossed a wall');
    assert.ok(result.pause>=0&&result.pause<=1.5,'pause exceeds short stop budget');
    assert.ok(actor.state.x>=bounds.minX&&actor.state.x<=bounds.maxX);
    assert.ok(actor.state.z>=bounds.minZ&&actor.state.z<=bounds.maxZ);
    if(tick%120===119){assert.ok(actor.windowDistance>.12,'actor stayed static for six seconds');actor.windowDistance=0}
  }
  for(const actor of actors)assert.ok(actor.distance>35,'patrol did not keep walking');
});

test('spawn uses a valid navmesh node and never spawns inside a solid',()=>{
  const nav={sampleSpawn:()=>({x:-4,z:-4,y:.02})};
  const patrol=createNpcPatrol({points,navigator:nav,obstacles:solids,bounds});
  assert.deepEqual(patrol.spawn({x:0,z:0}),{x:-4,z:-4,y:.02});
  const invalidNav={sampleSpawn:()=>({x:0,z:0})};
  const fallback=createNpcPatrol({points,navigator:invalidNav,obstacles:solids,bounds});
  assert.ok(Math.hypot(fallback.spawn({x:0,z:0}).x,fallback.spawn({x:0,z:0}).z)>3);
  assert.equal(createNpcPatrol({points:[[0,0]],obstacles:solids}).spawn({x:0,z:0}),null);
});

test('null and partial navmesh paths recover through the authoritative safe planner',()=>{
  for(const badPath of [null,[],[[0,0]]]){
    const patrol=createNpcPatrol({points,navigator:{plan:()=>badPath},obstacles:solids,bounds,random:()=>0});
    const state={x:-7,z:-7,yaw:Math.PI/2,speed:0};let moved=0;
    for(let tick=0;tick<400;tick++)moved+=patrol.update(state,.05).distance;
    assert.ok(moved>15,'bad optional route froze the patrol');
  }
});

test('an obstructing player causes a new destination without teleports or overlap',()=>{
  const player={x:.7,z:0,radius:.32};
  const patrol=createNpcPatrol({points:[[0,0],[7,0],[-5,4]],bounds,random:()=>0});
  const state={x:0,z:0,yaw:Math.PI/2,speed:0};let travelled=0,maxStep=0;
  for(let tick=0;tick<600;tick++){
    const result=patrol.update(state,.05,{neighbors:[player]});
    travelled+=result.distance;maxStep=Math.max(maxStep,result.distance);
    assert.ok(Math.hypot(state.x-player.x,state.z-player.z)>=NPC_RADIUS+player.radius-.04,
      'actor crossed the player');
  }
  assert.ok(travelled>12,'player blocked the patrol indefinitely');
  assert.ok(maxStep<.1,'recovery teleported the actor');
  assert.ok(patrol.snapshot.replans>2,'patrol did not replace its blocked route');
});

test('motion distance follows real movement, including zero distance during stops',()=>{
  const patrol=createNpcPatrol({points:[[0,0],[.8,0],[-.8,0]],random:()=>.99});
  const state={x:0,z:0,yaw:Math.PI/2,speed:0};let stopped=false;
  for(let tick=0;tick<200;tick++){
    const before={...state},result=patrol.update(state,.05);
    assert.ok(Math.abs(result.distance-Math.hypot(state.x-before.x,state.z-before.z))<1e-9);
    if(result.pause>0&&result.distance===0){stopped=true;assert.equal(state.speed,0)}
  }
  assert.equal(stopped,true);
});
