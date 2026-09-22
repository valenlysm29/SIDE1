const test=require('node:test'),assert=require('node:assert/strict');
const navigation=import('../services/npc_navigation.mjs');
test('NPC path goes around furniture with body clearance',async()=>{
  const {planPath,segmentClear,expanded}=await navigation,obstacles=[{minX:-1,maxX:1,minZ:1,maxZ:3}];
  const route=planPath({x:0,z:0},{x:0,z:5},obstacles);assert.ok(route.length>1);
  let from={x:0,z:0};for(const [x,z] of route){assert.ok(segmentClear(from,{x,z},expanded(obstacles)));from={x,z}}
});
test('NPC cannot take an unreachable route through a wall',async()=>{
  const {planPath}=await navigation;
  const walls=[{minX:-2,maxX:2,minZ:-2,maxZ:-1.7},{minX:-2,maxX:2,minZ:1.7,maxZ:2},{minX:-2,maxX:-1.7,minZ:-2,maxZ:2},{minX:1.7,maxX:2,minZ:-2,maxZ:2}];
  assert.deepEqual(planPath({x:0,z:0},{x:4,z:0},walls),[]);
});
test('NPC completes a furniture detour without collision or teleportation',async()=>{
  const {planPath,advance,expanded,segmentClear}=await navigation,blocks=[{minX:-1,maxX:1,minZ:1,maxZ:3}];
  const route=planPath({x:0,z:0},{x:0,z:5},blocks),state={x:0,z:0,yaw:0,speed:0};let index=0;
  for(let i=0;i<1500&&index<route.length;i++){
    const before={...state},target={x:route[index][0],z:route[index][1]};
    const result=advance(state,target,1/60,blocks,[],1.1,index===route.length-1);
    assert.ok(result.distance<=1.1/60+1e-8);assert.ok(Math.abs(result.turnRate)<=2.6+1e-8);
    assert.ok(segmentClear(before,state,expanded(blocks)));if(result.arrived)index++;
  }
  assert.equal(index,route.length,JSON.stringify({state,route,index}));
});
test('NPC stops before another person and resumes when the path clears',async()=>{
  const {advance}=await navigation,state={x:0,z:0,yaw:0,speed:0};
  for(let i=0;i<180;i++)advance(state,{x:0,z:5},1/60,[],[{x:0,z:1.5}],1);
  assert.ok(Math.hypot(state.x,state.z-1.5)>=.56);
  const oldZ=state.z;for(let i=0;i<120;i++)advance(state,{x:0,z:5},1/60,[],[],1);
  assert.ok(state.z>oldZ+1.4);
});
test('NPC turns before moving backwards and brakes at destination',async()=>{
  const {advance}=await navigation,state={x:0,z:0,yaw:0,speed:0};
  const first=advance(state,{x:0,z:-2},1/60,[],[],1);
  assert.equal(first.distance,0);
  let arrived=false;for(let i=0;i<600&&!arrived;i++)arrived=advance(state,{x:0,z:-2},1/60,[],[],1).arrived;
  assert.equal(arrived,true);assert.ok(state.speed<.65);
});
test('NPC can detour from a stop beside a person blocking the entrance',async()=>{
  const {advance,planPath}=await navigation,person={x:0,z:11.4},state={x:-.04,z:11.978,yaw:Math.PI,speed:0};
  const route=planPath(state,{x:0,z:8.55},[{minX:-.27,maxX:.27,minZ:11.13,maxZ:11.67}],.29);
  assert.ok(route.length>1);let index=0;
  for(let i=0;i<1800&&index<route.length;i++) {
    const result=advance(state,{x:route[index][0],z:route[index][1]},1/60,[],[person],1);
    assert.ok(Math.hypot(state.x-person.x,state.z-person.z)>=.56);if(result.arrived)index++;
  }
  assert.equal(index,route.length,JSON.stringify({state,route,index}));
});
