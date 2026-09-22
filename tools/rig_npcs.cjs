'use strict';
// Deterministic skinning for the four supplied, single-mesh, posed scans.
// Artistic constraints (pocket/hip hands) stay attached to the torso.
const fs = require('node:fs');
const profiles = require('./model-pipeline/npc_profiles.json');
const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
module.exports = function rigNpc(input, output, id) {
  const profile=profiles[id], source=fs.readFileSync(input), jsonSize=source.readUInt32LE(12);
  const doc=JSON.parse(source.toString('utf8',20,20+jsonSize)), bin=source.subarray(28+jsonSize);
  if (doc.skins?.length) throw Error('Expected an unrigged intermediate');
  const primitive=doc.meshes[0].primitives[0];
  function read(index) {
    const a=doc.accessors[index], v=doc.bufferViews[a.bufferView], start=(v.byteOffset||0)+(a.byteOffset||0);
    return new Float32Array(bin.buffer.slice(bin.byteOffset+start,bin.byteOffset+start+a.count*3*4));
  }
  const p=read(primitive.attributes.POSITION), n=read(primitive.attributes.NORMAL);
  const bounds=doc.accessors[primitive.attributes.POSITION], scale=profile.height/(bounds.max[2]-bounds.min[2]);
  for(let i=0;i<p.length;i+=3) {
    const y=p[i+1], ny=n[i+1];
    p[i]*=scale; p[i+1]=(-p[i+2]+bounds.max[2])*scale; p[i+2]=(y-.015)*scale;
    n[i+1]=-n[i+2]; n[i+2]=ny;
  }
  const chunks=[bin];let offset=bin.length;
  function append(array,type,components,target) {
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength), view=doc.bufferViews.length;
    doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});
    const pad=Buffer.alloc((4-bytes.length%4)%4);chunks.push(bytes,pad);offset+=bytes.length+pad.length;
    const accessor={bufferView:view,componentType:array instanceof Uint16Array?5123:5126,count:array.length/components,type};
    if(type==='VEC3') {
      accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];
      array.forEach((v,i)=>{accessor.min[i%3]=Math.min(accessor.min[i%3],v);accessor.max[i%3]=Math.max(accessor.max[i%3],v)});
    }
    doc.accessors.push(accessor);return doc.accessors.length-1;
  }
  primitive.attributes.POSITION=append(p,'VEC3',3,34962);
  primitive.attributes.NORMAL=append(n,'VEC3',3,34962);
  doc.nodes=[{name:id,children:[1,2],extras:{sideRig:{...profile,version:1}}},{name:id+'_mesh',mesh:0,skin:0}];
  const joints=[], absolute=[], named={};
  function bone(name,parent,x,y,z=0) {
    const pos=[x,y,z].map(v=>v*profile.height), index=doc.nodes.length, joint=joints.length;
    const parentPos=parent===null?[0,0,0]:absolute[named[parent]];
    doc.nodes.push({name,translation:pos.map((v,i)=>v-parentPos[i]),children:[]});
    if(parent!==null)doc.nodes[joints[named[parent]]].children.push(index);
    joints.push(index);absolute.push(pos);named[name]=joint;return joint;
  }
  bone('Hips',null,0,profile.hip);
  bone('Spine','Hips',0,.61);bone('Chest','Spine',0,.73);
  bone('Neck','Chest',0,.826);bone('Head','Neck',0,.876);
  for(const [side,sign] of [['L',-1],['R',1]]) {
    bone('Thigh'+side,'Hips',profile.legX*sign,profile.hip);
    bone('Shin'+side,'Thigh'+side,profile.legX*sign,profile.knee,.005);
    bone('Foot'+side,'Shin'+side,profile.legX*sign,profile.ankle);
    bone('UpperArm'+side,'Chest',profile.shoulderX*sign,profile.shoulderY);
    bone('Forearm'+side,'UpperArm'+side,profile.elbowX*sign,profile.elbowY);
    bone('Hand'+side,'Forearm'+side,profile.handX*sign,profile.handY,.016);
  }
  const jointData=new Uint16Array(p.length/3*4), weights=new Float32Array(jointData.length);
  // A scan's trouser leg can cross the body's X=0 plane. Classify by welded
  // mesh connectivity below the crotch, not by the sign of each vertex's X.
  // This preserves Mona's flared trousers without stretching a panel between feet.
  const parent=new Int32Array(p.length/3);parent.fill(-1);
  const weld=new Map();
  const find=i=>{let j=i;while(parent[j]!==j)j=parent[j];while(i!==j){const next=parent[i];parent[i]=j;i=next}return j};
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a};
  for(let i=0;i<parent.length;i++)if(p[i*3+1]<profile.height*.40){
    parent[i]=i;
    const key=[p[i*3],p[i*3+1],p[i*3+2]].map(v=>Math.round(v*1e5)).join(',');
    if(weld.has(key))join(i,weld.get(key));else weld.set(key,i);
  }
  const ia=doc.accessors[primitive.indices],iv=doc.bufferViews[ia.bufferView],io=(iv.byteOffset||0)+(ia.byteOffset||0);
  const indices=new Uint32Array(bin.buffer.slice(bin.byteOffset+io,bin.byteOffset+io+ia.count*4));
  for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){
    const a=indices[i+k],b=indices[i+(k+1)%3];if(parent[a]>=0&&parent[b]>=0)join(a,b);
  }
  const components=new Map();
  for(let i=0;i<parent.length;i++)if(parent[i]>=0){
    const key=find(i),part=components.get(key)||{count:0,x:0,minY:Infinity};
    part.count++;part.x+=p[i*3];part.minY=Math.min(part.minY,p[i*3+1]);components.set(key,part);
  }
  for(let i=0;i<p.length/3;i++) {
    const x=p[i*3]/profile.height,y=p[i*3+1]/profile.height;
    const component=parent[i]>=0?components.get(find(i)):null;
    const legX=component&&component.minY<.13*profile.height&&component.count>100?component.x/component.count:x;
    const side=legX<0?'L':'R', sign=x<0?-1:1;
    const w=new Map();
    const put=(name,amount)=>{if(amount>0)w.set(named[name],(w.get(named[name])||0)+amount)};
    // Arm boundaries track the silhouette, rather than capturing the jacket/hips.
    const threshold=y<.54?.104:(y<.67?.107:.082);
    const arm=profile.freeArms.includes(sign)
      ? smooth(threshold,threshold+.020,Math.abs(x))*(1-smooth(.765,.814,y))*smooth(.395,.44,y) : 0;
    if(arm>0) {
      const elbow=smooth(profile.elbowY-.035,profile.elbowY+.035,y);
      const wrist=1-smooth(profile.handY+.015,profile.handY+.045,y);
      put('UpperArm'+side,arm*elbow);put('Forearm'+side,arm*(1-elbow)*(1-wrist));put('Hand'+side,arm*(1-elbow)*wrist);
    }
    const body=1-arm;
    if(y<profile.hip+.035) {
      const fade=profile.legFade||[profile.hip-.04,profile.hip+.035];
      const leg=1-smooth(fade[0],fade[1],y);
      const knee=smooth(profile.knee-.035,profile.knee+.040,y);
      const ankle=1-smooth(profile.ankle+.015,profile.ankle+.055,y);
      put('Hips',body*(1-leg));put('Thigh'+side,body*leg*knee);
      put('Shin'+side,body*leg*(1-knee)*(1-ankle));put('Foot'+side,body*leg*(1-knee)*ankle);
    } else if(y<.69) {
      const t=smooth(.55,.69,y);put('Spine',body*(1-t));put('Chest',body*t);
    } else {
      const head=smooth(.81,.86,y);put('Chest',body*(1-head));put('Head',body*head);
    }
    const selected=[...w].sort((a,b)=>b[1]-a[1]).slice(0,4), sum=selected.reduce((s,a)=>s+a[1],0);
    selected.forEach(([j,v],k)=>{jointData[i*4+k]=j;weights[i*4+k]=v/sum});
  }
  primitive.attributes.JOINTS_0=append(jointData,'VEC4',4,34962);
  primitive.attributes.WEIGHTS_0=append(weights,'VEC4',4,34962);
  const inverse=new Float32Array(joints.length*16);
  absolute.forEach((v,i)=>{const k=i*16;inverse[k]=inverse[k+5]=inverse[k+10]=inverse[k+15]=1;inverse[k+12]=-v[0];inverse[k+13]=-v[1];inverse[k+14]=-v[2]});
  doc.skins=[{name:id+'_skeleton',skeleton:2,joints,inverseBindMatrices:append(inverse,'MAT4',16)}];
  doc.scenes=[{name:id,nodes:[0]}];doc.scene=0;
  doc.asset.generator='SIDE articulated NPC pipeline / meshoptimizer 0.25.0';
  // Runtime uses distance-driven IK; the file carries the reusable skin, not a drifting in-place clip.
  doc.animations=[];
  // Drop the replaced position/normal accessors and their orphaned binary data.
  const used=[...Object.values(primitive.attributes),primitive.indices,doc.skins[0].inverseBindMatrices];
  const accessorMap=new Map([...new Set(used)].map((old,i)=>[old,i]));
  doc.accessors=[...accessorMap.keys()].map(old=>doc.accessors[old]);
  for(const key of Object.keys(primitive.attributes))primitive.attributes[key]=accessorMap.get(primitive.attributes[key]);
  primitive.indices=accessorMap.get(primitive.indices);doc.skins[0].inverseBindMatrices=accessorMap.get(doc.skins[0].inverseBindMatrices);
  const usedViews=[...new Set([...doc.accessors.map(a=>a.bufferView),...doc.images.map(i=>i.bufferView)])];
  const viewMap=new Map(usedViews.map((old,i)=>[old,i])), assembled=Buffer.concat(chunks), packed=[];
  let packedSize=0;
  doc.bufferViews=usedViews.map(old=>{
    const v=doc.bufferViews[old],data=assembled.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),pad=Buffer.alloc((4-data.length%4)%4);
    const result={...v,byteOffset:packedSize};packed.push(data,pad);packedSize+=data.length+pad.length;return result;
  });
  for(const a of doc.accessors)a.bufferView=viewMap.get(a.bufferView);
  for(const image of doc.images)image.bufferView=viewMap.get(image.bufferView);
  doc.buffers=[{byteLength:packedSize}];
  const raw=Buffer.from(JSON.stringify(doc)), json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]), binary=Buffer.concat(packed);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
  fs.writeFileSync(output,Buffer.concat([header,json,bh,binary]));
  return {bones:joints.length,height:profile.height,rigged:true,animation:'Distance-driven procedural IK in services/npc_motion.js',freeArms:profile.freeArms};
};
