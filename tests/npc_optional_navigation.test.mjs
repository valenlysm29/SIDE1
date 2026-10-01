import test from 'node:test';
import assert from 'node:assert/strict';
import * as YUKA from '../vendor/yuka.module.js';
import {createOptionalNpcNavigator} from '../services/npc_optional_navigation.mjs';
import {segmentClear,expanded} from '../services/npc_navigation.mjs';

class Vector3{constructor(x,y,z){Object.assign(this,{x,y,z})}}
const THREE={Vector3};
const obstacle={minX:1,maxX:3,minZ:-.5,maxZ:.5};

test('three-pathfinding route is accepted only when complete and clear',()=>{
  class CompletePath{
    static createZone(){return {}}
    setZoneData(){}
    getGroup(){return 0}
    findPath(){return [new Vector3(0,0,1),new Vector3(4,0,1),new Vector3(4,0,0)]}
  }
  const nav=createOptionalNpcNavigator({THREE,Pathfinding:CompletePath,YUKA,geometry:{},obstacles:[obstacle]});
  assert.equal(nav.ready,true);
  assert.deepEqual(nav.plan({x:0,z:0},{x:4,z:0}),[[0,1],[4,1],[4,0]]);
  class BrokenPath extends CompletePath{findPath(){return [new Vector3(4,0,0)]}}
  const fallback=createOptionalNpcNavigator({THREE,Pathfinding:BrokenPath,YUKA,geometry:{},obstacles:[obstacle]});
  const route=fallback.plan({x:0,z:0},{x:4,z:0});
  assert.ok(route.length>1);
  let previous={x:0,z:0};
  for(const [x,z] of route){assert.ok(segmentClear(previous,{x,z},expanded([obstacle],.41)));previous={x,z}}
});

test('Yuka steering remains behind AABB and neighbor collision guard',()=>{
  const open=createOptionalNpcNavigator({YUKA});
  const walker={x:0,z:0,yaw:Math.PI/2,speed:0};
  for(let i=0;i<120;i++){
    const result=open.advance(walker,{x:4,z:0},.05,[],1.1);
    assert.equal(result.arrived,Math.hypot(4-walker.x,walker.z)<.10,
      'arrival must refer to the real waypoint, not the steering lookahead');
  }
  assert.ok(walker.x>3.8&&walker.x<=4,'Yuka did not move along a clear path');
  const nav=createOptionalNpcNavigator({YUKA,obstacles:[obstacle]});
  assert.equal(nav.ready,false);
  const state={x:0,z:0,yaw:Math.PI/2,speed:0};
  for(let i=0;i<120;i++)nav.advance(state,{x:4,z:0},.05,[],1.1);
  assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.z));
  assert.ok(state.x<.71,'steering crossed a solid obstacle');
});

test('navmesh spawn samples real triangles and exposes their interpolated height',()=>{
  const vertices=[0,.1,0, 3,.4,0, 0,.1,3, 5,.2,0, 8,.2,0, 5,.2,3];
  const attribute={count:6,getX:i=>vertices[i*3],getY:i=>vertices[i*3+1],getZ:i=>vertices[i*3+2]};
  const geometry={getAttribute:()=>attribute};
  const nav=createOptionalNpcNavigator({geometry,obstacles:[{minX:.5,maxX:1.5,minZ:.5,maxZ:1.5}]});
  const spawn=nav.sampleSpawn({x:0,z:0});
  assert.ok(spawn.x>5,'spawn used a blocked triangle');
  assert.ok(Math.abs(nav.groundAt(1,1)-.2)<1e-8);
  assert.equal(nav.groundAt(-3,-3),null);
  assert.equal(createOptionalNpcNavigator().sampleSpawn({x:0,z:0}),null);
});

test('Yuka separation steers around a stationary neighbor without overriding collision guards',()=>{
  const nav=createOptionalNpcNavigator({YUKA});
  const state={x:0,z:0,yaw:Math.PI/2,speed:0},neighbor={x:1,z:.15};
  let minimum=Infinity;
  for(let i=0;i<500;i++){
    nav.advance(state,{x:5,z:0},.05,[neighbor],1.1);
    minimum=Math.min(minimum,Math.hypot(state.x-neighbor.x,state.z-neighbor.z));
  }
  assert.ok(minimum>=.56-1e-6,'Yuka steering crossed the stationary neighbor');
  assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.z));
});
