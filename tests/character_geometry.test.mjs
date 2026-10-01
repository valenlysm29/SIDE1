import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/build/three.module.js';
import {PLAYER_HEIGHT_METERS, characterTargetHeight, normalizeCharacterGeometry, anchorCharacterToGround, clipsWithoutRootMotion} from '../services/character_geometry.mjs';

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function model(height, pivotY = 0) {
  const group = new THREE.Group(), avatar = new THREE.Group(); avatar.name = 'Avatar';
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, height, .35)); body.position.y = height / 2;
  avatar.position.y = pivotY; avatar.add(body); group.add(avatar);
  return {group, avatar};
}

test('all NPC geometries including unusual GLB units are at most the player height', () => {
  const player = model(2.1); normalizeCharacterGeometry(THREE, player.group, characterTargetHeight('player'));
  for (const sourceHeight of [.018, 1.25, 1.9, 195]) for (const variation of [.7, .95, 1, 1.04, 2]) {
    const {group} = model(sourceHeight, -.13);
    group.position.set(160, .025, 20);
    group.add(new THREE.Sprite()); group.children.at(-1).position.y = 50;
    normalizeCharacterGeometry(THREE, group, characterTargetHeight('npc', variation));
    const geometry = group.userData.characterPivot;
    const bounds = new THREE.Box3().setFromObject(geometry, true);
    assert.ok(bounds.max.y - bounds.min.y <= PLAYER_HEIGHT_METERS + 1e-6);
    assert.ok(bounds.max.y - bounds.min.y >= PLAYER_HEIGHT_METERS * .95 - 1e-6);
    near(bounds.min.y, group.position.y);
    near(group.position.x, 160); near(group.position.z, 20);
  }
});

test('floor pivot survives repeated animation writes to the GLB root for 60 seconds', () => {
  const {group, avatar} = model(210, 23);
  normalizeCharacterGeometry(THREE, group, characterTargetHeight('npc'));
  const source = new THREE.AnimationClip('Walk', 1, [new THREE.VectorKeyframeTrack('Avatar.position', [0, .5, 1], [0, 23, 0, 1, 30, 3, 2, 32, 5])]);
  const mixer = new THREE.AnimationMixer(avatar);
  mixer.clipAction(clipsWithoutRootMotion([source], avatar.name)[0]).play();
  const parent = new THREE.Group(); parent.position.set(150, -.125, 0); parent.add(group);
  for (let frame = 0; frame < 60 * 60; frame++) {
    const ground = .022 + .003 * Math.sin(frame / 60);
    anchorCharacterToGround(group, ground, parent.position.y);
    mixer.update(1 / 60); parent.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group.userData.characterPivot, true);
    near(bounds.min.y, ground);
    near(group.getWorldPosition(new THREE.Vector3()).y, ground);
  }
  assert.deepEqual([...source.tracks[0].values], [0, 23, 0, 1, 30, 3, 2, 32, 5]);
});

test('pelvis clip keeps its vertical gait bounce without travel or vertical drift', () => {
  const source = new THREE.AnimationClip('Walk', 1, [new THREE.VectorKeyframeTrack('mixamorig:Hips.position', [0, .5, 1], [0, 1, 0, 2, 1.2, 1, 4, 1.1, 2])]);
  const clean = clipsWithoutRootMotion([source], 'Avatar')[0];
  const values = clean.tracks[0].values;
  near(values[1], values[7]); assert.ok(values[4] > values[1]);
  for (const index of [0, 2, 3, 5, 6, 8]) near(values[index], 0);
});

test('normalizing again is idempotent and grounding retains player jumps', () => {
  const {group} = model(1.9, -.35);
  normalizeCharacterGeometry(THREE, group);
  const scale = group.scale.clone(), pivot = group.userData.characterPivot.position.clone();
  normalizeCharacterGeometry(THREE, group);
  assert.deepEqual(group.scale, scale); assert.deepEqual(group.userData.characterPivot.position, pivot);
  near(anchorCharacterToGround(group, .025, 0, .7), .725);
  near(anchorCharacterToGround(group, .025, 0, -.1), .025);
});

test('the shipped public NPC GLBs normalize using their actual skinned mesh bounds', async () => {
  // Resolve the browser import map for Node without adding a second Three copy.
  const threeURL = new URL('../vendor/three/build/three.module.js', import.meta.url).href;
  const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const geometryUtils = moduleURL((await readFile(new URL('../vendor/three/examples/jsm/utils/BufferGeometryUtils.js', import.meta.url), 'utf8')).replace("from 'three'", `from '${threeURL}'`));
  const loaderSource = (await readFile(new URL('../vendor/three/examples/jsm/loaders/GLTFLoader.js', import.meta.url), 'utf8'))
    .replace("from 'three'", `from '${threeURL}'`).replace("from '../utils/BufferGeometryUtils.js'", `from '${geometryUtils}'`);
  const {GLTFLoader} = await import(moduleURL(loaderSource));
  const manifest = JSON.parse(await readFile(new URL('../assets/models/npc/manifest.json', import.meta.url), 'utf8'));
  for (const entry of manifest) {
    const bytes = await readFile(new URL(`../${entry.archivo}`, import.meta.url));
    const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    // Node has no image decoder. Preserve geometry, hierarchy, skin and clips,
    // and omit material assignments solely in this in-memory test document.
    for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) delete primitive.material;
    const text = JSON.stringify(json), paddedLength = Math.ceil(Buffer.byteLength(text) / 4) * 4;
    const binary = bytes.subarray(20 + jsonLength), packed = Buffer.alloc(20 + paddedLength + binary.length, 0x20);
    bytes.copy(packed, 0, 0, 12); packed.writeUInt32LE(packed.length, 8);
    packed.writeUInt32LE(paddedLength, 12); packed.writeUInt32LE(0x4e4f534a, 16);
    packed.write(text, 20); binary.copy(packed, 20 + paddedLength);
    const gltf = await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.length), '');
    const group = new THREE.Group(); group.add(gltf.scene);
    normalizeCharacterGeometry(THREE, group, characterTargetHeight('npc', 1));
    const bounds = new THREE.Box3().setFromObject(group.userData.characterPivot, true);
    near(bounds.max.y - bounds.min.y, characterTargetHeight('npc', 1), 1e-5);
    near(bounds.min.y, 0, 1e-5);
    assert.ok(group.userData.characterGeometry.sourceHeight > 0, entry.id);
  }
});
