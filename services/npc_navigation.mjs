// Pure geometry/motion helpers; shared by the game and deterministic tests.
export const NPC_RADIUS=.29;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const inside=(p,r)=>p.x>r.minX&&p.x<r.maxX&&p.z>r.minZ&&p.z<r.maxZ;
export function expanded(obstacles,radius=NPC_RADIUS) {
  return obstacles.map(r=>({minX:r.minX-radius,maxX:r.maxX+radius,minZ:r.minZ-radius,maxZ:r.maxZ+radius}));
}
export function segmentClear(a,b,obstacles) {
  for(const r of obstacles) {
    let lo=0,hi=1;
    for(const axis of ['x','z']) {
      const d=b[axis]-a[axis], min=r[axis==='x'?'minX':'minZ'], max=r[axis==='x'?'maxX':'maxZ'];
      if(Math.abs(d)<1e-9){if(a[axis]<=min||a[axis]>=max){lo=2;break}continue}
      let t1=(min-a[axis])/d,t2=(max-a[axis])/d;if(t1>t2)[t1,t2]=[t2,t1];
      lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>=hi)break;
    }
    if(lo<hi&&hi>0&&lo<1)return false;
  }
  return true;
}
function projectOut(p,obstacles) {
  p={...p};
  for(let i=0;i<8;i++) {
    const r=obstacles.find(r=>inside(p,r));if(!r)return p;
    const candidates=[{x:r.minX-.012,z:p.z},{x:r.maxX+.012,z:p.z},{x:p.x,z:r.minZ-.012},{x:p.x,z:r.maxZ+.012}];
    candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
    p=candidates.find(c=>!obstacles.some(o=>inside(c,o)))||candidates[0];
  }
  return p;
}
export function planPath(start,end,obstacles,radius=NPC_RADIUS+.12) {
  let blocks=expanded(obstacles,radius);
  // The extra corner margin may contain a perfectly valid starting position.
  if(radius>NPC_RADIUS&&blocks.some(r=>inside(start,r)))blocks=expanded(obstacles,NPC_RADIUS);
  const goal=projectOut(end,blocks);
  if(segmentClear(start,goal,blocks))return [[goal.x,goal.z]];
  const nodes=[start,goal];
  for(const r of blocks)for(const x of [r.minX-.08,r.maxX+.08])for(const z of [r.minZ-.08,r.maxZ+.08]) {
    const p={x,z};if(!blocks.some(o=>inside(p,o)))nodes.push(p);
  }
  const costs=nodes.map(()=>Infinity), previous=nodes.map(()=>-1),closed=new Set();costs[0]=0;
  for(let it=0;it<nodes.length;it++) {
    let current=-1,best=Infinity;
    for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&costs[i]<best){best=costs[i];current=i}
    if(current<0)break;
    if(current===1){const route=[];for(let i=1;i>0;i=previous[i])route.unshift([nodes[i].x,nodes[i].z]);return route}
    closed.add(current);
    for(let i=1;i<nodes.length;i++)if(!closed.has(i)) {
      const distance=Math.hypot(nodes[i].x-nodes[current].x,nodes[i].z-nodes[current].z), cost=best+distance;
      if(cost<costs[i]&&segmentClear(nodes[current],nodes[i],blocks)){costs[i]=cost;previous[i]=current}
    }
  }
  // Never replace an unreachable route with a line through a wall.
  return [];
}

export function advance(state,target,dt,obstacles,neighbors=[],maxSpeed=1.1,final=true) {
  dt=clamp(dt,0,.05);const dx=target.x-state.x,dz=target.z-state.z, distance=Math.hypot(dx,dz);
  const desired=Math.atan2(dx,dz), turn=wrap(desired-state.yaw), oldYaw=state.yaw;
  state.yaw+=clamp(turn,-2.6*dt,2.6*dt);
  // Turn first when the destination is behind the body. Slow into tight corners.
  const facing=Math.max(0,Math.cos(wrap(desired-state.yaw)));
  let goalSpeed=Math.min(maxSpeed,Math.sqrt(2*2.3*Math.max(0,distance-(final ? .025 : 0))))*facing;
  let avoidance=0;
  for(const other of neighbors) {
    const ox=other.x-state.x,oz=other.z-state.z,d=Math.hypot(ox,oz);
    if(d<1.2&&d>.001) {
      const ahead=(ox*Math.sin(state.yaw)+oz*Math.cos(state.yaw))/d;
      if(ahead>.25) {
        goalSpeed*=clamp((d-.58)/.55,0,1);
        // Consistent right-hand passing avoids reciprocal left/right oscillation.
        if(d>.57)avoidance=Math.max(avoidance,.38*(1-d/1.2));
      }
    }
  }
  const speed=state.speed||0;state.speed=speed+clamp(goalSpeed-speed,-3.5*dt,1.8*dt);
  let step=Math.min(distance,state.speed*dt), yaw=state.yaw+avoidance;
  let next={x:state.x+Math.sin(yaw)*step,z:state.z+Math.cos(yaw)*step};
  const blocks=expanded(obstacles);
  if(!segmentClear(state,next,blocks)||neighbors.some(o=>{
    const distance=Math.hypot(next.x-o.x,next.z-o.z);
    return distance<.56&&distance<=Math.hypot(state.x-o.x,state.z-o.z);
  })) {
    next={x:state.x,z:state.z};state.speed=0;
  }
  const moved=Math.hypot(next.x-state.x,next.z-state.z);state.x=next.x;state.z=next.z;
  return {distance:moved,arrived:distance<.10,turnRate:wrap(state.yaw-oldYaw)/Math.max(.001,dt)};
}
