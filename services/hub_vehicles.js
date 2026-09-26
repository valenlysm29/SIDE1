import * as THREE from '../vendor/three/build/three.module.js';
import {stepVehicle,vehicleHits} from './vehicle_motion.mjs';

export function createHubVehicles(world,offsetX) {
  const resources=new Set(),cars=[];
  const geometry=new THREE.BoxGeometry(1,1,1);resources.add(geometry);
  const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.45,...extra});resources.add(m);return m;};
  const rubber=material(0x151723,{roughness:.9}),glass=material(0x243d59,{metalness:.8,roughness:.15}),chrome=material(0xbacbd3);
  const lamp=material(0xffe5ab,{emissive:0xffdb89,emissiveIntensity:2});
  function make(x,z,yaw,color,traffic=false) {
    const root=new THREE.Group(),body=new THREE.Group(),paint=material(color),wheels=[];
    const rear=material(0xfa335a,{emissive:0xff183c,emissiveIntensity:.7});
    root.add(body);
    function box(parent,x,y,z,w,h,d,mat){const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
    box(body,0,.62,0,1.8,.5,4.1,paint);box(body,0,.4,0,1.86,.18,4.2,rubber);
    const cabinGeometry=new THREE.BufferGeometry();
    cabinGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -.8,.86,-1.05,.8,.86,-1.05,-.68,1.43,-.52,.68,1.43,-.52,
      -.8,.86,1.2,.8,.86,1.2,-.68,1.43,.78,.68,1.43,.78
    ],3));
    cabinGeometry.setIndex([0,1,2,1,3,2,4,6,5,5,6,7,0,2,4,4,2,6,1,5,3,5,7,3,2,3,6,3,7,6].reverse());
    cabinGeometry.computeVertexNormals();resources.add(cabinGeometry);
    const cabin=new THREE.Mesh(cabinGeometry,glass);cabin.castShadow=true;body.add(cabin);
    box(body,0,1.45,.13,1.4,.08,1.34,paint);
    box(body,0,.91,-1.43,1.78,.15,1.18,paint);
    for(const side of [-1,1]) {
      box(body,side*.78,1.1,.28,.065,.68,.11,paint);
      const frontPillar=box(body,side*.74,1.15,-.78,.055,.78,.065,paint);frontPillar.rotation.x=.75;
      const rearPillar=box(body,side*.74,1.15,1,.065,.72,.085,paint);rearPillar.rotation.x=-.64;
      box(body,side*.93,1.04,-.56,.22,.15,.28,paint);
      box(body,side*.63,.76,-2.065,.47,.17,.04,lamp);
      box(body,side*.63,.74,2.065,.48,.16,.04,rear);
      box(body,side*.915,.88,.75,.035,.045,.27,chrome);
      for(const axle of [-1.28,1.28]) {
        const pivot=new THREE.Group();pivot.position.set(side*.94,.39,axle);root.add(pivot);
        const spin=new THREE.Group();pivot.add(spin);
        const geo=new THREE.CylinderGeometry(.36,.36,.22,16);resources.add(geo);
        const tire=new THREE.Mesh(geo,rubber);tire.rotation.z=Math.PI/2;tire.castShadow=true;spin.add(tire);
        box(spin,side*.12,0,0,.03,.48,.075,chrome);box(spin,side*.12,0,0,.03,.075,.48,chrome);
        wheels.push({pivot,spin,front:axle<0});
      }
    }
    box(body,0,.58,-2.09,.7,.17,.025,rubber);box(body,0,.57,2.09,.4,.14,.025,chrome);
    root.name=traffic?'City traffic':'SIDE cruiser';world.group.add(root);
    const car={x:offsetX+x,z,yaw,speed:0,steer:0,wheelAngle:0,root,body,wheels,rear,traffic,distance:0};cars.push(car);return car;
  }
  const cruiser=make(16,33.3,Math.PI/2,0x29c7bc);
  // Rounded rectangular boulevard, tangent-continuous at all four corners.
  const path=new THREE.CurvePath(),r=5,a=39,b=a-r;
  const point=(x,z)=>new THREE.Vector3(offsetX+x,0,z);
  path.add(new THREE.LineCurve3(point(-b,-a),point(b,-a)));
  const arc=(cx,cz,start)=>{const curve=new THREE.EllipseCurve(cx,cz,r,r,start,start+Math.PI/2,false,0);const pts=curve.getPoints(24).map(p=>point(p.x,p.y));for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(pts[i-1],pts[i]));};
  arc(b,-b,-Math.PI/2);path.add(new THREE.LineCurve3(point(a,-b),point(a,b)));arc(b,b,0);
  path.add(new THREE.LineCurve3(point(b,a),point(-b,a)));arc(-b,b,Math.PI/2);
  path.add(new THREE.LineCurve3(point(-a,b),point(-a,-b)));arc(-b,-b,Math.PI);
  const length=path.getLength();
  [0xf3c05e,0xc45c82,0x738cb8,0xf1e4cf].forEach((color,i)=>{const c=make(0,0,0,color,true);c.distance=i*length/4;placeTraffic(c);});
  function placeTraffic(c){const t=(c.distance%length)/length,p=path.getPoint(t),v=path.getTangent(t);c.x=p.x;c.z=p.z;c.yaw=Math.atan2(-v.x,-v.z);}
  function sync(c,dt){c.root.position.set(c.x-offsetX,.125,c.z);c.root.rotation.y=c.yaw;c.body.rotation.z+=(c.steer*c.speed*.009-c.body.rotation.z)*(1-Math.exp(-dt*7));for(const w of c.wheels){w.pivot.rotation.y=w.front?c.steer:0;w.spin.rotation.x=-c.wheelAngle;}}
  cars.forEach(c=>sync(c,1));
  function obstacles(except){return cars.filter(c=>c!==except).map(c=>({minX:c.x-1.1,maxX:c.x+1.1,minZ:c.z-1.1,maxZ:c.z+1.1}));}
  return {
    cars,cruiser,
    nearest(x,z){return Math.hypot(cruiser.x-x,cruiser.z-z)<3.5?cruiser:null;},
    occupied(x,z,r=.4){return cars.some(c=>vehicleHits(c.x,c.z,c.yaw,[{minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r}]));},
    update(dt,{active,input,player,people,bounds}) {
      for(const c of cars) {
        if(c.traffic){
          const ahead={x:c.x-Math.sin(c.yaw)*5,z:c.z-Math.cos(c.yaw)*5};
          const stop=[...people,...(active?[]:[player]),...cars.filter(o=>o!==c)].some(p=>Math.hypot(p.x-ahead.x,p.z-ahead.z)<3.5||Math.hypot(p.x-c.x,p.z-c.z)<2.7);
          const previous=c.speed;c.speed+=( (stop?0:6.5)-c.speed)*(1-Math.exp(-dt*(stop?12:1.2)));
          c.rear.emissiveIntensity=stop?3:.7;c.distance+=c.speed*dt;c.wheelAngle+=c.speed*dt/.36;
          const oldYaw=c.yaw;placeTraffic(c);c.steer=Math.atan2(Math.sin(c.yaw-oldYaw),Math.cos(c.yaw-oldYaw))*2.65/Math.max(.001,c.speed*dt);
          c.body.rotation.x=(previous-c.speed)*.015;
        }else{
          const blockers=[...world.colliders,...obstacles(c),...people.map(p=>({minX:p.x-.4,maxX:p.x+.4,minZ:p.z-.4,maxZ:p.z+.4}))];
          stepVehicle(c,active===c?input:{brake:true},dt,(x,z,yaw)=>vehicleHits(x,z,yaw,blockers,bounds));
          c.rear.emissiveIntensity=input.brake||input.throttle<0?3:.7;
        }
        sync(c,dt);
      }
    },
    dispose(){cars.forEach(c=>c.root.removeFromParent());resources.forEach(r=>r.dispose());}
  };
}
