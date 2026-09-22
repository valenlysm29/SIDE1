import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let shadowGeometry,shadowMaterial;
function contactShadow() {
  if(!shadowMaterial) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,32);
    gradient.addColorStop(0,'rgba(0,0,0,.30)');gradient.addColorStop(.5,'rgba(0,0,0,.13)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false});
    shadowGeometry=new THREE.PlaneGeometry(.65,.75);
  }
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.name='ContactShadow';
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.006;shadow.userData.sharedCharacterResource=true;return shadow;
}

export async function loadTemplate(GLTFLoader, url) {
  const gltf=await new GLTFLoader().loadAsync(url);
  let profile;
  gltf.scene.traverse(node=>{
    if(node.userData.sideRig)profile=node.userData.sideRig;
    if(!node.isMesh)return;
    node.userData.sharedCharacterResource=true;
    // A posed scan's resting bounds do not include every animated foot position.
    node.frustumCulled=false;
    node.castShadow=true;node.receiveShadow=true;
    // Each file owns its texture set. Identical source texture names are not identities.
    for(const material of (Array.isArray(node.material)?node.material:[node.material])) {
      for(const key of ['map','normalMap','metalnessMap','roughnessMap'])if(material[key])material[key].anisotropy=4;
    }
  });
  if(!profile)throw Error('El modelo no contiene el esqueleto SIDE.');
  return {scene:gltf.scene,profile,height:profile.height,animations:0};
}

export function createNpc(template, kind) {
  const group=new THREE.Group(), avatar=clone(template.scene), bones={};group.add(avatar,contactShadow());
  avatar.traverse(node=>{if(node.isBone)bones[node.name]=node});
  group.name=kind;
  const rest={};for(const [name,bone] of Object.entries(bones))rest[name]=bone.position.clone();
  group.userData={modelKind:kind,modelAvatar:avatar,motion:{bones,rest,profile:template.profile,phase:0,blend:0,pivotPhase:0,pivotBlend:0,lastYaw:null,time:0,lastPosition:null,distance:0,speed:0}};
  animateNpc(group,1/60,false);
  return group;
}

export function resetMotion(group) {
  const m=group.userData.motion;
  if(m){m.lastPosition=null;m.lastYaw=null;m.blend=0;m.pivotBlend=0;m.pivotPhase=0;m.phase=0;m.speed=0;m.distance=0}
}

// Two-bone sagittal IK. Rest axes follow the supplied pose; feet counter-rotate
// against hips/knees so the soles stay level during the support part of a step.
function legIK(m,side,footZ,lift,blend) {
  const b=m.bones, r=m.rest, thigh=b['Thigh'+side], shin=b['Shin'+side], foot=b['Foot'+side];
  const upper=r['Shin'+side], lower=r['Foot'+side];
  const l1=Math.hypot(upper.y,upper.z),l2=Math.hypot(lower.y,lower.z);
  const dy=m.profile.ankle*m.profile.height+lift-(b.Hips.position.y+thigh.position.y);
  const dz=footZ, length=clamp(Math.hypot(dy,dz),.001,l1+l2-.0001);
  const forward=Math.atan2(dz,-dy), bend=Math.acos(clamp((l1*l1+length*length-l2*l2)/(2*l1*length),-1,1));
  const upperAngle=forward+bend;
  const kneeY=-Math.cos(upperAngle)*l1,kneeZ=Math.sin(upperAngle)*l1;
  const lowerAngle=Math.atan2(dz-kneeZ,-(dy-kneeY));
  const hipAngle=-upperAngle-Math.atan2(-upper.z,-upper.y);
  const kneeAngle=-lowerAngle-Math.atan2(-lower.z,-lower.y)-hipAngle;
  thigh.rotation.x=wrap(hipAngle)*blend;shin.rotation.x=wrap(kneeAngle)*blend;
  foot.rotation.x=-(thigh.rotation.x+shin.rotation.x);
}

export function animateNpc(group,dt,moving=true) {
  const m=group.userData.motion;if(!m)return;
  dt=clamp(dt,0,.1);if(!dt)return;
  const p=group.position;
  const distance=m.lastPosition?Math.hypot(p.x-m.lastPosition.x,p.z-m.lastPosition.z):0;
  // Repositioning/pooling is not walking. It must not advance the gait.
  const travelled=distance<.5&&moving?distance:0;
  m.lastPosition={x:p.x,z:p.z};m.distance+=travelled;m.time+=dt;
  m.speed=travelled/dt;
  const turn=m.lastYaw===null?0:Math.abs(wrap(group.rotation.y-m.lastYaw));m.lastYaw=group.rotation.y;
  m.pivotPhase=(m.pivotPhase+turn/2.8)%1;
  const pivotTarget=clamp(turn/dt/2.6,0,1)*(m.speed<.1?1:0);
  m.pivotBlend+=(pivotTarget-m.pivotBlend)*(1-Math.exp(-dt*12));
  const target=m.speed>.025?1:0;
  m.blend+=(target-m.blend)*(1-Math.exp(-dt*(target?10:13)));
  const stride=.93*m.profile.height/1.75;
  m.phase=(m.phase+travelled/stride)%1;
  const b=m.bones, r=m.rest, h=m.profile.height, w=m.blend;
  for(const [name,bone] of Object.entries(b)){bone.position.copy(r[name]);bone.rotation.set(0,0,0)}
  b.Hips.position.y-=h*(.030+.004*Math.cos(m.phase*TAU*2))*w+.008*m.pivotBlend;
  for(const [side,offset] of [['L',0],['R',.5]]) {
    const phase=(m.phase+offset)%1, stance=.60;
    let z,lift=0;
    if(phase<stance)z=stride*(stance*.5-phase);
    else {const t=(phase-stance)/(1-stance);z=stride*stance*(smooth(t)-.5);lift=.070*h/1.75*Math.sin(Math.PI*t)**2}
    const pivot=m.pivotBlend*(1-w),weight=Math.max(w,pivot);
    const pivotLift=.035*Math.max(0,Math.sin((m.pivotPhase+offset)*TAU))**2*pivot;
    legIK(m,side,z*(weight?w/weight:0),lift+ pivotLift,weight);
    const sign=side==='L'?-1:1;
    if(m.profile.freeArms.includes(sign)) {
      b['UpperArm'+side].rotation.x=Math.sin(phase*TAU)*.23*w;
      b['Forearm'+side].rotation.x=-.05*w-.08*Math.max(0,Math.sin(phase*TAU))*w;
    }
  }
  b.Spine.rotation.y=Math.sin(m.phase*TAU)*.026*w;
  b.Chest.rotation.y=-Math.sin(m.phase*TAU)*.045*w;
  b.Chest.rotation.x=.006*Math.sin(m.time*1.8)+.018*w;
  b.Head.rotation.y=.018*Math.sin(m.time*.63)*(1-w);
  b.Head.rotation.x=-.006*Math.sin(m.time*1.8)-.009*w;
  group.updateMatrixWorld(true);
}
