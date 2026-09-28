import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { createHubWorld } from '../services/hub_world.js';

// The hub creates deterministic procedural CanvasTextures for its fallback
// city. Geometry and prop assertions below use the shipped Three.js module.
const context2d = () => ({
  beginPath() {}, fillRect() {}, fillText() {}, lineTo() {}, moveTo() {}, stroke() {}, strokeRect() {}
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => context2d() })
};

const PROP_KEYS = [
  'treeDefault', 'treeOak', 'treeTall', 'bush', 'bench', 'fountain',
  'trafficLight', 'streetLight', 'planter', 'trashcan', 'stopSign', 'birdBrown'
];

function fixture(options = {}) {
  const scene = new THREE.Scene();
  const world = createHubWorld({ scene, ...options });
  return { scene, world, close: () => world.dispose() };
}

function propTemplate(name, geometry = new THREE.BoxGeometry(.5, .5, .5), material = new THREE.MeshStandardMaterial()) {
  const root = new THREE.Group();
  root.name = name;
  root.add(new THREE.Mesh(geometry, material));
  return root;
}

function allTemplates(geometry = new THREE.BoxGeometry(.5, .5, .5), material = new THREE.MeshStandardMaterial()) {
  return Object.fromEntries(PROP_KEYS.map(key => [key, propTemplate(key, geometry, material)]));
}

function physicalSnapshot(world) {
  return JSON.stringify({
    colliders: world.colliders,
    entrances: world.entrances,
    patrolRoutes: world.patrolRoutes
  });
}

function propRoot(world) {
  return world.group.getObjectByName('SIDE streamed outdoor props');
}

function matrixSnapshot(world) {
  return propRoot(world).children.map(batch => ({
    kind: batch.userData.kind,
    category: batch.userData.category,
    matrices: batch.children.filter(child => child.isInstancedMesh).map(mesh => {
      const matrix = new THREE.Matrix4();
      return Array.from({ length: mesh.count }, (_, index) => {
        mesh.getMatrixAt(index, matrix);
        return matrix.toArray();
      });
    })
  }));
}

test('outdoor GLBs are instanced by category and quality tiers cap detail without changing physics', () => {
  const geometry = new THREE.BoxGeometry(.5, .5, .5);
  const material = new THREE.MeshStandardMaterial();
  const templates = allTemplates(geometry, material);
  const f = fixture();
  const physical = physicalSnapshot(f.world);

  let state = f.world.installOutdoorProps(templates, 'low');
  assert.equal(physicalSnapshot(f.world), physical, 'visual replacement must not add colliders, entrances or routes');
  assert.deepEqual(state.installed, [
    'benches', 'birds', 'bushes', 'fountain', 'planters', 'signage',
    'streetLights', 'trafficSignals', 'trashcans', 'trees'
  ]);
  assert.equal(state.batches, 12, 'three tree models plus nine shared prop batches');
  assert.equal(state.instances, 70);
  assert.equal(state.visibleBatches, 7);
  assert.equal(state.visibleInstances, 37);
  assert.equal(state.drawables, 7);
  assert.equal(state.birds, 0);
  assert.equal(state.shadows, 0);
  assert.deepEqual(state.fallbackVisible, []);

  const root = propRoot(f.world);
  assert.ok(root.children.every(batch => batch.children.every(mesh => mesh.isInstancedMesh)));
  assert.ok(root.children.every(batch => batch.children.every(mesh => mesh.geometry === geometry && mesh.material === material)));
  assert.equal(root.children.filter(batch => batch.userData.category === 'trees').length, 3);

  f.world.setQuality('medium');
  state = f.world.outdoorProps();
  assert.equal(state.visibleBatches, 12);
  assert.equal(state.visibleInstances, 68);
  assert.equal(state.drawables, 12);
  assert.equal(state.birds, 2);
  assert.equal(state.categories.fountain, 1, 'the expensive fountain has exactly one instance');
  assert.equal(state.shadows, 1);

  f.world.setQuality('high');
  state = f.world.stats().outdoorProps;
  assert.equal(state.visibleInstances, 70);
  assert.equal(state.birds, 4);
  assert.equal(state.shadows, 4);

  f.close();
  geometry.dispose();
  material.dispose();
});

test('partial outdoor loading preserves category fallbacks and installation is idempotent', () => {
  const geometry = new THREE.BoxGeometry(.5, .5, .5);
  const material = new THREE.MeshStandardMaterial();
  let geometryDisposed = 0;
  let materialDisposed = 0;
  geometry.addEventListener('dispose', () => geometryDisposed++);
  material.addEventListener('dispose', () => materialDisposed++);
  const bench = propTemplate('bench', geometry, material);
  const f = fixture();

  let state = f.world.installOutdoorProps({ bench }, 'medium');
  assert.equal(state.batches, 1);
  assert.equal(state.categories.benches, 6);
  assert.ok(!state.fallbackVisible.includes('benches'), 'loaded category hides its procedural equivalent');
  for (const category of ['trees', 'bushes', 'fountain', 'trafficSignals', 'streetLights', 'planters', 'trashcans', 'signage', 'birds']) {
    assert.ok(state.fallbackVisible.includes(category), `${category} retains its fallback when its GLB is missing`);
  }

  const first = [...propRoot(f.world).children];
  f.world.installOutdoorProps({ bench }, 'high');
  assert.deepEqual(propRoot(f.world).children, first, 'reinstalling cached templates must not allocate duplicate batches');

  state = f.world.installOutdoorProps({}, 'low');
  assert.equal(state.batches, 0);
  assert.ok(state.fallbackVisible.includes('benches'));
  for (const decorative of ['birds', 'bushes', 'fountain', 'planters', 'signage']) {
    assert.ok(!state.fallbackVisible.includes(decorative), `${decorative} stays disabled on low`);
  }

  f.close();
  assert.equal(geometryDisposed, 0, 'world disposal does not own cached GLB geometry');
  assert.equal(materialDisposed, 0, 'world disposal does not own cached GLB material');
  geometry.dispose();
  material.dispose();
});

test('outdoor placement is deterministic across worlds and birds use transform animation only', () => {
  const geometry = new THREE.BoxGeometry(.5, .5, .5);
  const material = new THREE.MeshStandardMaterial();
  const templates = allTemplates(geometry, material);
  const a = fixture();
  const b = fixture();
  a.world.installOutdoorProps(templates, 'high');
  b.world.installOutdoorProps(templates, 'high');

  assert.equal(a.world.outdoorProps().seed, 4107);
  assert.equal(a.world.outdoorProps().placementSignature, b.world.outdoorProps().placementSignature);
  assert.deepEqual(matrixSnapshot(a.world), matrixSnapshot(b.world));

  const before = matrixSnapshot(a.world).find(batch => batch.category === 'birds');
  a.world.tickOutdoorProps(.016, { x: 169, z: 19 }, 3.5);
  const after = matrixSnapshot(a.world).find(batch => batch.category === 'birds');
  assert.notDeepEqual(after, before, 'bird flight updates instance transforms');
  const birdBatch = propRoot(a.world).children.find(batch => batch.userData.category === 'birds');
  assert.ok(birdBatch.children.every(mesh => mesh.isInstancedMesh && !mesh.isSkinnedMesh));

  a.close();
  b.close();
  geometry.dispose();
  material.dispose();
});
