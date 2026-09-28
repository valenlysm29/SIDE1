import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { createBusinessInteriors } from '../services/business_interiors.mjs';

globalThis.document = { createElement: () => ({ width: 0, height: 0,
  getContext: () => ({ fillRect() {}, fillText() {} }) }) };

const STORE_KEYS = ['entryDoor', 'windowPanel', 'ceilingLight', 'atm'];
const PRODUCTION_KEYS = [
  'cuttingTable', 'sewingMachine', 'overlockMachine', 'ironingStation', 'fabricRolls',
  'rackTall', 'pendantLight', 'mannequin', 'garmentRack'
];

function fixture(options = {}) {
  const scene = new THREE.Scene();
  const world = createBusinessInteriors({ scene, ...options });
  return { scene, world, close: () => world.dispose() };
}

function propTemplate(name, geometry, material) {
  const root = new THREE.Group(); root.name = name;
  root.add(new THREE.Mesh(geometry, material));
  return root;
}

function templates(keys, geometry = new THREE.BoxGeometry(.4, .4, .4), material = new THREE.MeshStandardMaterial()) {
  return Object.fromEntries(keys.map(key => [key, propTemplate(key, geometry, material)]));
}

function physicalSnapshot(world) {
  return JSON.stringify({
    colliders: world.colliders,
    entrances: world.entrances,
    npcRoutes: world.npcRoutes,
    hotspots: world.hotspots
  });
}

function isBlocked(world, x, z, radius = .32) {
  return world.colliders.some(box => x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius);
}

function assertClearPortal(world, entrance) {
  for (let step = 0; step <= 30; step++) {
    const z = entrance.portal.z - 1.5 + step * .1;
    assert.equal(isBlocked(world, entrance.portal.x, z), false, `${entrance.id} portal remains walkable`);
  }
}

function batches(room, marker) {
  return room.propRoot.children.filter(batch => batch.userData[marker]);
}

function firstInstancePosition(batch) {
  const mesh = batch.children.find(child => child.isInstancedMesh);
  assert.ok(mesh, `${batch.userData.category} uses instancing`);
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}

function matrixSnapshot(room, marker) {
  return batches(room, marker).map(batch => ({
    category: batch.userData.category,
    kind: batch.userData.kind,
    count: batch.userData.instanceCount,
    matrices: batch.children.filter(child => child.isInstancedMesh).map(mesh => {
      const result = [], matrix = new THREE.Matrix4();
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix);
        result.push(matrix.toArray().map(value => Number(value.toFixed(6))));
      }
      return result;
    })
  }));
}

test('store facade, emissive lights and ATM preserve the physical doorway contract', () => {
  const f = fixture(), geometry = new THREE.BoxGeometry(.4, .4, .4), material = new THREE.MeshStandardMaterial();
  const before = physicalSnapshot(f.world);
  const state = f.world.installStoreProps(templates(STORE_KEYS, geometry, material), 'auto');
  const room = f.world.rooms.find(value => value.id === 'store');
  const storeBatches = batches(room, 'storePropBatch');

  assert.ok(state.installed.includes('doors'));
  assert.ok(state.installed.includes('windows'));
  assert.ok(state.installed.includes('lighting'));
  assert.ok(state.installed.includes('atm'));
  assert.ok([...room.auxFallbacks.values()].every(entry => !entry.group.visible),
    'loaded ATM and luminaires hide only their auxiliary procedural fallbacks');
  assert.equal(physicalSnapshot(f.world), before, 'visual replacements never mutate physics or navigation');
  assertClearPortal(f.world, f.world.entrances.find(value => value.id === 'store'));

  const atm = storeBatches.find(batch => batch.userData.category === 'atm');
  assert.ok(atm, 'ATM is installed as a visual-only prop');
  const local = firstInstancePosition(atm), portal = f.world.entrances.find(value => value.id === 'store').portal;
  const worldX = local.x + f.world.group.position.x;
  assert.ok(Math.abs(worldX - portal.x) > portal.halfWidth + .25 || Math.abs(local.z - portal.z) > 1,
    'ATM stays outside the pedestrian portal');
  assert.ok(storeBatches.filter(batch => batch.userData.instanceCount > 1)
    .every(batch => batch.children.every(mesh => mesh.isInstancedMesh && mesh.count === batch.userData.instanceCount)));

  f.close();
  geometry.dispose(); material.dispose();
});

test('production props respect tier density, instancing and real-light limits', () => {
  const f = fixture(), geometry = new THREE.BoxGeometry(.4, .4, .4), material = new THREE.MeshStandardMaterial();
  const before = physicalSnapshot(f.world);
  const state = f.world.installProductionProps(templates(PRODUCTION_KEYS, geometry, material), 'auto');
  const room = f.world.rooms.find(value => value.id === 'production');
  const productionBatches = batches(room, 'productionPropBatch');

  assert.deepEqual(state.installed, ['cutting', 'decor', 'ironing', 'lighting', 'packing', 'sewing', 'storage']);
  assert.equal(physicalSnapshot(f.world), before);
  assert.ok([...room.propFallbacks.values()].every(entry => !entry.group.visible));
  assert.ok(productionBatches.filter(batch => batch.userData.instanceCount > 1)
    .every(batch => batch.children.every(mesh => mesh.isInstancedMesh && mesh.count === batch.userData.instanceCount)));

  const inside = { x: f.world.group.position.x + room.layout.x, z: room.layout.z };
  for (const [quality, expectedLights] of [['low', 0], ['medium', 1], ['auto', 1], ['high', 2]]) {
    f.world.setQuality(quality); f.world.tick(.016, inside);
    const current = f.world.stats().productionProps;
    assert.equal(current.realLights, expectedLights, `${quality} real-light budget`);
    assert.equal(room.lights.filter(light => light.visible).length, expectedLights, `${quality} visible PointLights`);
    const visibleCategories = new Set(productionBatches.filter(batch => batch.visible).map(batch => batch.userData.category));
    const streamedEssentials = quality === 'low' ? ['cutting', 'packing']
      : ['cutting', 'sewing', 'ironing', 'packing', 'storage', 'lighting'];
    for (const essential of streamedEssentials) {
      assert.ok(visibleCategories.has(essential), `${essential} remains visible in ${quality}`);
    }
    for (const efficient of ['sewing', 'ironing', 'storage', 'lighting']) {
      assert.equal(room.propFallbacks.get(efficient).group.visible, quality === 'low',
        `${efficient} uses its cheap fallback only in low`);
    }
    assert.equal(visibleCategories.has('decor'), quality !== 'low', `decor density in ${quality}`);
  }

  f.close();
  geometry.dispose(); material.dispose();
});

test('production installation is idempotent with category fallback and cached resources survive disposal', () => {
  const geometry = new THREE.BoxGeometry(.5, .5, .5), material = new THREE.MeshStandardMaterial();
  let geometryDisposed = 0, materialDisposed = 0;
  geometry.addEventListener('dispose', () => geometryDisposed++);
  material.addEventListener('dispose', () => materialDisposed++);
  const f = fixture(), room = f.world.rooms.find(value => value.id === 'production');
  const partial = templates(['ironingStation'], geometry, material);

  f.world.installProductionProps(partial, 'auto');
  assert.equal(room.propFallbacks.get('ironing').group.visible, false);
  for (const category of ['cutting', 'sewing', 'packing', 'storage', 'lighting', 'decor']) {
    assert.equal(room.propFallbacks.get(category).group.visible, true, category);
  }
  const first = [...room.propRoot.children];
  f.world.installProductionProps(partial, 'high');
  assert.deepEqual(room.propRoot.children, first, 'same cached templates do not allocate duplicate batches');
  f.world.installProductionProps({}, 'auto');
  assert.equal(room.propRoot.children.length, 0);
  assert.ok([...room.propFallbacks.values()].every(entry => entry.group.visible));

  f.close();
  assert.equal(geometryDisposed, 0); assert.equal(materialDisposed, 0);
  geometry.dispose(); material.dispose();
});

test('production placement matrices are deterministic between independent worlds', () => {
  const geometry = new THREE.BoxGeometry(.35, .35, .35), material = new THREE.MeshStandardMaterial();
  const shared = templates(PRODUCTION_KEYS, geometry, material);
  const a = fixture(), b = fixture();
  a.world.installProductionProps(shared, 'high');
  b.world.installProductionProps(shared, 'high');
  const roomA = a.world.rooms.find(value => value.id === 'production');
  const roomB = b.world.rooms.find(value => value.id === 'production');

  assert.deepEqual(matrixSnapshot(roomA, 'productionPropBatch'), matrixSnapshot(roomB, 'productionPropBatch'));
  assert.ok(batches(roomA, 'productionPropBatch').some(batch => batch.userData.instanceCount > 1));

  a.close(); b.close();
  geometry.dispose(); material.dispose();
});
