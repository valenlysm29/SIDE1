'use strict';
// Offline asset build. The game loads only the resulting self-contained GLB.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const MeshoptSimplifier = require('./model-pipeline/meshoptimizer/meshopt_simplifier.js');
const sharp = require(process.env.SHARP_PATH || 'sharp');
const root = path.resolve(__dirname, '..');
const id = process.argv[2]; if (!['chico1','chico2','chico3','mona'].includes(id)) throw Error('Expected chico1/chico2/chico3/mona');
const input = path.join(root, `tools/model-sources/${id}/${id}.original.glb`);
const output = path.join(root, `assets/models3d/npcs/${id}.glb`);
const intermediate = path.join(root, `tools/model-sources/${id}/${id}.optimized.glb`);

(async () => {
  await MeshoptSimplifier.ready;
  const source = fs.readFileSync(input), jsonSize = source.readUInt32LE(12);
  if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) throw Error('Expected GLB 2');
  const gltf = JSON.parse(source.toString('utf8', 20, 20 + jsonSize));
  const binStart = 28 + jsonSize;
  const primitive = gltf.meshes[0].primitives[0];
  function readAccessor(id) {
    const accessor = gltf.accessors[id], view = gltf.bufferViews[accessor.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type];
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[accessor.componentType];
    if (!Type || (view.byteStride && view.byteStride !== size * Type.BYTES_PER_ELEMENT)) throw Error('Unsupported source accessor');
    const offset = binStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    return new Type(source.buffer.slice(source.byteOffset + offset, source.byteOffset + offset + accessor.count * size * Type.BYTES_PER_ELEMENT));
  }
  const positions = readAccessor(primitive.attributes.POSITION), normals = readAccessor(primitive.attributes.NORMAL), uv = readAccessor(primitive.attributes.TEXCOORD_0);
  const indices = new Uint32Array(readAccessor(primitive.indices));
  const attributes = new Float32Array(positions.length / 3 * 5);
  for (let v = 0; v < positions.length / 3; v++) {
    attributes.set(normals.subarray(v * 3, v * 3 + 3), v * 5);
    attributes.set(uv.subarray(v * 2, v * 2 + 2), v * 5 + 3);
  }
  const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, 5, [.5, .5, .5, 2, 2], null, 105000, .008);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(simplified);
  function compact(array, stride) {
    const result = new Float32Array(vertexCount * stride);
    for (let v = 0; v < remap.length; v++) if (remap[v] !== 0xffffffff) result.set(array.subarray(v * stride, v * stride + stride), remap[v] * stride);
    return result;
  }
  const p = compact(positions, 3), n = compact(normals, 3), t = compact(uv, 2);
  const chunks = [], views = [], accessors = []; let byteOffset = 0;
  function addBytes(bytes, target) {
    bytes = Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength ?? bytes.length);
    const id = views.length;
    views.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...(target ? { target } : {}) });
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4); chunks.push(bytes, padding); byteOffset += bytes.length + padding.length;
    return id;
  }
  function addAccessor(array, type, target, bounds = false) {
    const item = { bufferView: addBytes(array, target), componentType: array instanceof Float32Array ? 5126 : 5125, count: array.length / ({SCALAR:1,VEC2:2,VEC3:3}[type]), type };
    if (bounds) {
      item.min = [Infinity, Infinity, Infinity]; item.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < array.length; i++) { item.min[i % 3] = Math.min(item.min[i % 3], array[i]); item.max[i % 3] = Math.max(item.max[i % 3], array[i]); }
    }
    accessors.push(item); return accessors.length - 1;
  }
  const attrs = { POSITION: addAccessor(p, 'VEC3', 34962, true), NORMAL: addAccessor(n, 'VEC3', 34962), TEXCOORD_0: addAccessor(t, 'VEC2', 34962) };
  const indexId = addAccessor(simplified, 'SCALAR', 34963);
  const images = [];
  for (const [i, image] of gltf.images.entries()) {
    const view = gltf.bufferViews[image.bufferView], bytes = source.subarray(binStart + view.byteOffset, binStart + view.byteOffset + view.byteLength);
    const color = i === gltf.textures[gltf.materials[0].pbrMetallicRoughness.baseColorTexture.index].source;
    const processor = sharp(bytes).resize(color ? 2048 : 1024, color ? 2048 : 1024, {fit:'inside',withoutEnlargement:true});
    const encoded = await (color ? processor.jpeg({quality:92,chromaSubsampling:'4:4:4'}) : processor.png({compressionLevel:9})).toBuffer();
    images.push({name:image.name,bufferView:addBytes(encoded),mimeType:color?'image/jpeg':'image/png'});
  }
  gltf.asset.generator = 'SIDE NPC optimization / meshoptimizer 0.25.0';
  gltf.nodes[0].name = id; gltf.meshes[0].name = id;
  gltf.meshes[0].primitives = [{attributes:attrs,indices:indexId,material:0}];
  gltf.materials[0].extensions.KHR_materials_specular.specularColorFactor = [1,1,1];
  gltf.images = images; gltf.accessors = accessors; gltf.bufferViews = views; gltf.buffers = [{byteLength:byteOffset}];
  const binary = Buffer.concat(chunks), rawJson = Buffer.from(JSON.stringify(gltf));
  const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(20); header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28 + json.length + binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader = Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
  const result = Buffer.concat([header,json,binHeader,binary]);fs.writeFileSync(intermediate,result);
  const rig = require('./rig_npcs.cjs')(intermediate,output,id);
  const finalResult=fs.readFileSync(output);
  const report = {source:`tools/model-sources/${id}/${id}.original.glb`,output:`assets/models3d/npcs/${id}.glb`,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),outputSha256:crypto.createHash('sha256').update(finalResult).digest('hex'),sourceBytes:source.length,outputBytes:finalResult.length,sourceTriangles:indices.length/3,triangles:simplified.length/3,vertices:vertexCount,relativeError:error,animations:0,...rig,textures:'Color 2048px; normal and metallic/roughness 1024px',note:'Original supplied by the user. No new license is assigned to the model.'};
  fs.writeFileSync(path.join(root,`tools/model-sources/${id}/manifest.json`),JSON.stringify(report,null,2)+'\n');console.log(report);
})().catch(error=>{console.error(error);process.exitCode=1});
