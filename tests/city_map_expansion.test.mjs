import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { CITY_MAP, createHubWorld } from '../services/hub_world.js';
import { planPath } from '../services/npc_navigation.mjs';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
  beginPath() {}, fillRect() {}, fillText() {}, lineTo() {}, moveTo() {}, stroke() {}, strokeRect() {}
}) }) };

test('the city grid expands without moving existing business entrances', () => {
  const world = createHubWorld({ scene: new THREE.Scene(), offsetX: 150 });
  assert.deepEqual(CITY_MAP.bounds, { minX: -88, maxX: 88, minZ: -88, maxZ: 88 });
  assert.deepEqual(world.entrances.map(({ id, x, z }) => [id, x, z]), [
    ['store', 131, 26], ['warehouse', 130, -9], ['production', 170, -9]
  ]);
  for (const id of ['office', 'bank', 'suppliers']) {
    const zone = CITY_MAP.zones.find(item => item.id === id);
    assert.ok(zone, `${id} has a map coordinate`);
    assert.ok(world.colliders.some(item => item.kind === id), `${id} has a physical footprint`);
  }
  assert.ok(world.group.userData.geometryInstances > 1000, 'large city geometry remains instanced');
  world.dispose();
});

test('outer destinations have collision-free approaches on the connected streets', () => {
  const world = createHubWorld({ scene: new THREE.Scene(), offsetX: 150 });
  const start = { x: 150, z: 0 };
  for (const goal of [{ x: 169, z: 65 }, { x: 215, z: 19 }, { x: 85, z: -19 }]) {
    const route = planPath(start, goal, world.colliders);
    assert.ok(route.length, `destination ${goal.x},${goal.z} is reachable`);
  }
  world.dispose();
});
