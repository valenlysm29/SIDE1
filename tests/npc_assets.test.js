const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
for(const id of ['chico1','chico2','chico3','mona'])test(`${id}: intact source, self-contained GLB, valid articulated weights`,()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,`tools/model-sources/${id}/manifest.json`),'utf8'));
  const source=fs.readFileSync(path.join(root,manifest.source)),bytes=fs.readFileSync(path.join(root,manifest.output));
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(hash(source),manifest.sourceSha256);assert.equal(hash(bytes),manifest.outputSha256);
  assert.ok(bytes.length<6_000_000);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+size)),start=28+size;
  assert.ok(doc.images.every(i=>!i.uri));assert.ok(doc.buffers.every(b=>!b.uri));
  assert.equal(doc.skins[0].joints.length,17);assert.equal(manifest.triangles,35000);
  const primitive=doc.meshes[0].primitives[0],count=doc.accessors[primitive.attributes.POSITION].count;
  for(const key of ['NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.equal(doc.accessors[primitive.attributes[key]].count,count);
  function data(id,Type,n){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],offset=start+(v.byteOffset||0)+(a.byteOffset||0);return new Type(bytes.buffer.slice(bytes.byteOffset+offset,bytes.byteOffset+offset+a.count*n*Type.BYTES_PER_ELEMENT))}
  const weights=data(primitive.attributes.WEIGHTS_0,Float32Array,4),joints=data(primitive.attributes.JOINTS_0,Uint16Array,4);
  for(let i=0;i<count;i++){
    let sum=0;for(let j=0;j<4;j++){const w=weights[i*4+j];assert.ok(Number.isFinite(w)&&w>=0&&w<=1);assert.ok(joints[i*4+j]<17);sum+=w}
    assert.ok(Math.abs(sum-1)<1e-6);
  }
  const indices=data(primitive.indices,Uint32Array,1),positions=data(primitive.attributes.POSITION,Float32Array,3);
  assert.ok([...indices].every(i=>i<count));
  // A trouser panel must not stretch between opposite legs below the crotch.
  const sides=Array.from({length:count},(_,i)=>{
    let left=0,right=0;for(let k=0;k<4;k++){const j=joints[i*4+k];if(j>=5&&j<=7)left+=weights[i*4+k];if(j>=11&&j<=13)right+=weights[i*4+k]}
    return left>right?-1:1;
  });
  for(let i=0;i<indices.length;i+=3){const vs=[indices[i],indices[i+1],indices[i+2]];if(vs.every(v=>positions[v*3+1]<manifest.height*.39))assert.equal(new Set(vs.map(v=>sides[v])).size,1,'cross-leg trouser triangle')}
});
