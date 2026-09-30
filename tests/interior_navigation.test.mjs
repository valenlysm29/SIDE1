import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three/build/three.module.js';
import * as YUKA from '../vendor/yuka.module.js';
import { createOptionalNpcNavigator } from '../services/npc_optional_navigation.mjs';
import { createInteriorNavigation } from '../services/interior_navigation.mjs';
import { expanded, segmentClear } from '../services/npc_navigation.mjs';

const room = { id: 'bank', layout: { x: 0, z: 0, width: 12, depth: 12 } };
const desk = { zone: 'bank', minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
const start = { x: -4, z: 0 }, end = { x: 4, z: 0 };

function clearPath(points) {
  assert.ok(points.length > 1, 'desk requires a detour');
  let previous = start;
  for (const [x, z] of points) {
    assert.ok(segmentClear(previous, { x, z }, expanded([desk])), 'path crossed desk clearance');
    previous = { x, z };
  }
  assert.ok(Math.hypot(previous.x - end.x, previous.z - end.z) < .25);
}

test('low interior navigation stays on AABB without building geometry', async () => {
  const navigation = createInteriorNavigation({ THREE, rooms: [room], colliders: [desk], offsetX: 0 });
  clearPath(navigation.plan(room, start, end, 'low'));
  assert.equal(await navigation.waitReady(room, 'low'), false);
  assert.equal(navigation.stats().initialized, 0);
  navigation.dispose();
});

test('room navmesh initializes lazily and routes around furniture', async () => {
  // Node has no browser import map; resolve the vendor's bare Three import.
  const source = (await readFile(new URL('../vendor/three-pathfinding.module.js', import.meta.url), 'utf8'))
    .replace('from"three"', `from${JSON.stringify(new URL('../vendor/three/build/three.module.js', import.meta.url).href)}`);
  const { Pathfinding } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const navigation = createInteriorNavigation({ THREE, rooms: [room], colliders: [desk], offsetX: 0,
    loadNavigator: async options => createOptionalNpcNavigator({ ...options, Pathfinding, YUKA }) });
  assert.equal(navigation.stats().initialized, 0);
  clearPath(navigation.plan(room, start, end, 'medium'));
  assert.equal(await navigation.waitReady(room), true, 'actual three-pathfinding zone must initialize');
  const status = navigation.stats();
  assert.equal(status.ready, 1);
  assert.ok(status.rooms[0].blocked > 0);
  clearPath(navigation.plan('bank', start, end, 'high'));
  const motion = { ...start, yaw: Math.PI / 2, speed: 0 };
  for (let i = 0; i < 180; i++) navigation.advance(room, motion, end, .05, [], 1.1, 'high');
  assert.ok(motion.x < desk.minX - .29, 'Yuka final-step guard must prevent crossing desk');
  navigation.dispose();
  assert.equal(navigation.stats().initialized, 0);
  assert.equal(await navigation.waitReady(room), false);
});
