import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {indexNpcClips} from '../services/npc_clip_controller.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'assets/models/npc/manifest.json'),'utf8'));

function readGLB(file){
  const data=fs.readFileSync(file);
  assert.equal(data.toString('ascii',0,4),'glTF');
  assert.equal(data.readUInt32LE(8),data.length);
  const jsonSize=data.readUInt32LE(12);
  const json=JSON.parse(data.toString('utf8',20,20+jsonSize));
  const binOffset=20+jsonSize+8;
  return {data,json,binOffset};
}

function floats(glb,index){
  const accessor=glb.json.accessors[index];
  assert.equal(accessor.componentType,5126);
  const view=glb.json.bufferViews[accessor.bufferView];
  const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type];
  const stride=view.byteStride||width*4;
  const start=glb.binOffset+(view.byteOffset||0)+(accessor.byteOffset||0);
  return Array.from({length:accessor.count},(_,row)=>
    Array.from({length:width},(_,column)=>glb.data.readFloatLE(start+row*stride+column*4)));
}

test('16 licensed city NPCs have same-file skinned idle, walk and in-place run',()=>{
  assert.ok(rows.length>=16,`only ${rows.length} NPCs released`);
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  for(const row of rows){
    assert.equal(row.licencia,'CC0',row.id);
    assert.ok(row.bytes<1_500_000,`${row.id}: exceeds 1.5 MB`);
    const glb=readGLB(path.join(root,row.archivo));
    const {json}=glb;
    assert.ok(json.skins?.length,`${row.id}: no skin`);
    const joints=new Set(json.skins.flatMap(skin=>skin.joints));
    const named=indexNpcClips((json.animations||[]).map(animation=>({name:animation.name})));
    for(const name of ['idle','walk','run']){
      assert.ok(named[name],`${row.id}: no ${name} clip`);
      const animation=json.animations.find(clip=>clip.name===named[name].name);
      let animatedJoint=false;
      for(const channel of animation.channels){
        const node=channel.target.node;
        if(joints.has(node)&&channel.target.path==='rotation'){
          const values=floats(glb,animation.samplers[channel.sampler].output);
          animatedJoint ||= values.length>2 && values.every(vector=>vector.every(Number.isFinite));
        }
        if(channel.target.path!=='translation'||!/root|hips|pelvis|humanarmature/i.test(json.nodes[node]?.name||''))continue;
        const values=floats(glb,animation.samplers[channel.sampler].output);
        const first=values[0],last=values.at(-1);
        assert.ok(Math.hypot(last[0]-first[0],last[2]-first[2])<.05,`${row.id}: ${name} has root motion`);
      }
      assert.ok(animatedJoint,`${row.id}: ${name} does not animate the skin rig`);
    }
  }
});
