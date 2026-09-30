import {planPath,segmentClear,advance as safeAdvance,expanded} from './npc_navigation.mjs';

// Optional adapter for a finished BufferGeometry navmesh. The existing AABB
// planner remains authoritative when a mesh, library, or route is unavailable.
export function createOptionalNpcNavigator({THREE,Pathfinding,YUKA,geometry,obstacles=[]}={}){
  let currentObstacles=obstacles;
  let pathfinder=null;
  if(THREE?.Vector3&&Pathfinding?.createZone&&geometry){
    try{
      pathfinder=new Pathfinding();
      pathfinder.setZoneData('city',Pathfinding.createZone(geometry));
    }catch{pathfinder=null}
  }
  const vehicles=new WeakMap();
  function plan(start,end){
    if(pathfinder){
      try{
        const a=new THREE.Vector3(start.x,0,start.z),b=new THREE.Vector3(end.x,0,end.z);
        const group=pathfinder.getGroup('city',a);
        const found=pathfinder.findPath(a,b,'city',group);
        const points=(found||[]).map(point=>[point.x,point.z]);
        // three-pathfinding may return a partial path to the closest polygon.
        if(points.length&&Math.hypot(points.at(-1)[0]-end.x,points.at(-1)[1]-end.z)<.25&&
           points.every((point,index)=>segmentClear(index?{x:points[index-1][0],z:points[index-1][1]}:start,
             {x:point[0],z:point[1]},expanded(currentObstacles))))return points;
      }catch{/* use the safe route below */}
    }
    return planPath(start,end,currentObstacles);
  }
  function advance(state,target,dt,neighbors=[],maxSpeed=1.1,final=true){
    if(!YUKA?.Vehicle||!YUKA?.SeekBehavior||!YUKA?.Vector3)return safeAdvance(state,target,dt,currentObstacles,neighbors,maxSpeed,final);
    let agent=vehicles.get(state);
    if(!agent){
      const vehicle=new YUKA.Vehicle();
      const destination=new YUKA.Vector3();
      vehicle.steering.add(new YUKA.SeekBehavior(destination));
      agent={vehicle,destination};vehicles.set(state,agent);
    }
    agent.vehicle.position.set(state.x,0,state.z);
    agent.vehicle.velocity.set(Math.sin(state.yaw)*(state.speed||0),0,Math.cos(state.yaw)*(state.speed||0));
    agent.vehicle.maxSpeed=Math.max(0,maxSpeed);
    agent.destination.set(target.x,0,target.z);
    agent.vehicle.update(Math.max(0,Math.min(.05,Number(dt)||0)));
    const steered={x:agent.vehicle.position.x,z:agent.vehicle.position.z};
    if(!Number.isFinite(steered.x)||!Number.isFinite(steered.z))return safeAdvance(state,target,dt,currentObstacles,neighbors,maxSpeed,final);
    const dx=steered.x-state.x,dz=steered.z-state.z,length=Math.hypot(dx,dz);
    const remaining=Math.hypot(target.x-state.x,target.z-state.z);
    if(length>1e-6){
      const lookahead=Math.min(remaining,Math.max(.5,length*10));
      steered.x=state.x+dx/length*lookahead;
      steered.z=state.z+dz/length*lookahead;
    }else return safeAdvance(state,target,dt,currentObstacles,neighbors,maxSpeed,final);
    // AABB movement and neighbor separation still guard the final step.
    const result=safeAdvance(state,steered,dt,currentObstacles,neighbors,maxSpeed,final);
    return {...result,arrived:Math.hypot(target.x-state.x,target.z-state.z)<.10};
  }
  return {ready:!!pathfinder,plan,advance,setObstacles(next){currentObstacles=Array.isArray(next)?next:[]}};
}

export async function loadOptionalNpcNavigator(options){
  try{
    const [{Pathfinding},YUKA]=await Promise.all([
      import('../vendor/three-pathfinding.module.js'),
      import('../vendor/yuka.module.js')
    ]);
    return createOptionalNpcNavigator({...options,Pathfinding,YUKA});
  }catch{return createOptionalNpcNavigator(options)}
}
