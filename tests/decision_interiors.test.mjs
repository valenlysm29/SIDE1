import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { createHubWorld } from '../services/hub_world.js';
import { createBusinessInteriors, DECISION_INTERIOR_LAYOUTS } from '../services/business_interiors.mjs';
import { crossedEntrance } from '../services/world_portals.mjs';
import { stepPlayerMotion } from '../services/player_motion.mjs';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
  beginPath() {}, fillRect() {}, fillText() {}, lineTo() {}, moveTo() {}, stroke() {}, strokeRect() {}
}) }) };

function fixture() {
  const scene = new THREE.Scene(), hub = createHubWorld({ scene, offsetX: 150 });
  const world = createBusinessInteriors({ scene, createNpc: () => new THREE.Group(), animateNpc() {},
    onCollidersAdded: added => hub.colliders.push(...added) });
  const rooms = world.rooms.filter(room => DECISION_INTERIOR_LAYOUTS.some(layout => layout.id === room.id));
  const blocked = (x, z, radius = .32) => [...hub.colliders, ...world.colliders].some(box =>
    x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius);
  return { hub, world, rooms, blocked, close() { world.dispose(); hub.dispose(); } };
}

test('decision interiors allocate furniture once and preserve directed physical entry and exit', () => {
  const f = fixture();
  assert.ok(f.rooms.every(room => room.deferred && room.detail.children.length === 0));
  for (const room of f.rooms) {
    f.world.ensureRoom(room);
    const count = f.world.colliders.length, children = room.detail.children.length;
    f.world.ensureRoom(room);
    assert.equal(f.world.colliders.length, count); assert.equal(room.detail.children.length, children);
    const entrance = f.world.entrances.find(door => door.id === room.id), p = entrance.portal;
    const axis = p.axis, direction = p.direction;
    const player = { x: p.x, z: p.z, vx: 0, vz: 0, grounded: true };
    player[axis] -= direction * 1.5;
    const outside = { ...player };
    const input = axis === 'x' ? { side: direction, yaw: 0 } : { forward: -direction, yaw: 0 };
    for (let frame = 0; frame < 24; frame++) stepPlayerMotion(player, input, .05, f.blocked);
    assert.equal(f.world.zoneAt(player), room.id, `${room.id} walk inside`);
    assert.equal(crossedEntrance(outside, player, f.world.entrances)?.id, room.id);
    assert.equal(crossedEntrance(player, outside, [{ ...entrance, portal: { ...p, direction: -direction } }])?.id, room.id);
    const reverse = axis === 'x' ? { side: -direction, yaw: 0 } : { forward: direction, yaw: 0 };
    for (let frame = 0; frame < 26; frame++) stepPlayerMotion(player, reverse, .05, f.blocked);
    assert.equal(f.world.zoneAt(player), null, `${room.id} walk outside`);
  }
  f.close();
});

test('B E F interaction stations and queues are reachable while furniture blocks the player', () => {
  const f = fixture(), categories = { office: 'B', bank: 'E', suppliers: 'F' };
  for (const room of f.rooms) {
    f.world.ensureRoom(room);
    const station = f.world.hotspots.find(point => point.zone === room.id && point.type === 'decisionZone');
    assert.ok(station); assert.equal(station.category, categories[room.id]);
    assert.equal(f.blocked(station.x, station.z, .36), false, `${room.id} interaction clear`);
    for (const slot of room.queueSlots || []) assert.equal(f.blocked(slot.x, slot.z, .36), false, `${room.id} queue clear`);
    const furniture = f.world.colliders.filter(box => box.zone === room.id);
    assert.ok(furniture.length > 4);
    for (const box of furniture) {
      const player = { x: box.minX - .65, z: (box.minZ + box.maxZ) / 2, vx: 0, vz: 0, grounded: true };
      for (let frame = 0; frame < 40; frame++) stepPlayerMotion(player, { side: 1, yaw: 0, sprint: true }, .05, f.blocked);
      assert.ok(player.x <= box.minX - .32, `${room.id}/${box.kind} stops traversal`);
    }
  }
  f.close();
});

test('financial and order boards read immutable simulation state without creating stock', () => {
  const f = fixture(); f.rooms.forEach(room => f.world.ensureRoom(room));
  const source = Object.freeze({ cash: 1234, debt: 567, loan: 890, round: 3, pendingUnits: 42 });
  f.world.sync(source);
  for (const id of ['office', 'bank']) {
    const room = f.rooms.find(room => room.id === id), text = room.stateSigns[0].mesh.userData.stateText;
    assert.match(text, /1[,.]?234/); assert.match(text, /567/);
    assert.match(text, id === 'office' ? /Ciclo 3/ : /890/);
  }
  const suppliers = f.rooms.find(room => room.id === 'suppliers');
  assert.equal(suppliers.detail.userData.supplierState.pendingUnits, 42);
  assert.ok(f.rooms.every(room => room.stock.length === 0));
  f.world.sync({ cash: 10, debt: 0, loan: 0, round: 4, pendingUnits: 0 });
  assert.equal(suppliers.detail.userData.supplierState.pendingUnits, 0);
  assert.deepEqual(source, { cash: 1234, debt: 567, loan: 890, round: 3, pendingUnits: 42 });
  f.close();
});

test('repeated interior visits reuse distinct actors with clear unique positions', () => {
  const f = fixture(), references = [];
  for (const room of f.rooms) {
    const observer = { x: 150 + room.layout.x, z: room.layout.z };
    f.world.tick(.05, observer);
    assert.ok(room.actors.length >= 2);
    const actors = room.actors.map(actor => actor.object); references.push(...actors);
    assert.equal(new Set(actors.map(actor => `${actor.position.x.toFixed(3)},${actor.position.z.toFixed(3)}`)).size, actors.length);
    for (const object of actors) assert.equal(f.blocked(150 + object.position.x, object.position.z, .29), false, `${room.id} actor clear`);
    f.world.tick(.05, { x: 150, z: 0 }); f.world.tick(.05, observer);
    assert.deepEqual(room.actors.map(actor => actor.object), actors);
  }
  assert.equal(new Set(references).size, references.length);
  f.close();
});
