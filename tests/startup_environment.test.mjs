import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/build/three.module.js';
import {decodeStudioEnvironment} from '../services/startup_environment.mjs';

test('baked studio is a valid HDR CubeUV atlas without runtime convolution',()=>{
  const bytes=fs.readFileSync(new URL('../assets/environments/studio-128.bin',import.meta.url));
  const texture=decodeStudioEnvironment(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.equal(texture.mapping,THREE.CubeUVReflectionMapping);assert.equal(texture.type,THREE.HalfFloatType);
  assert.equal(texture.image.width,384);assert.equal(texture.image.height,512);
  assert.equal(texture.generateMipmaps,false);assert.equal(texture.flipY,false);
  let energy=0;for(let i=0;i<texture.image.data.length;i++){
    const value=THREE.DataUtils.fromHalfFloat(texture.image.data[i]);assert.ok(Number.isFinite(value));
    if(i%4!==3)energy+=value;
  }
  assert.ok(energy>400000&&energy<500000,'lighting is populated with studio radiance, not an empty buffer');texture.dispose();
});

test('invalid or truncated environment data is rejected before texture allocation',()=>{
  for(const bytes of [new ArrayBuffer(0),new ArrayBuffer(15),new ArrayBuffer(16)])assert.throws(()=>decodeStudioEnvironment(bytes));
  const bytes=new ArrayBuffer(16),view=new DataView(bytes);view.setUint32(0,0x53494445,false);view.setUint32(4,1,true);view.setUint32(8,384,true);view.setUint32(12,512,true);
  assert.throws(()=>decodeStudioEnvironment(bytes),/incompleto/);
});
