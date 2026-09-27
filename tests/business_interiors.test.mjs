import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { BUSINESS_LAYOUTS, createBusinessInteriors, stockVisualLevel } from '../services/business_interiors.mjs';
import { crossedEntrance } from '../services/world_portals.mjs';
import { stepPlayerMotion, constrainCamera } from '../services/player_motion.mjs';

// Only CanvasTexture labels require a DOM; all geometry, matrices and routes
// below use the shipped Three.js implementation, without a fake 3D engine.
globalThis.document = { createElement: () => ({ width: 0, height: 0,
  getContext: () => ({ fillRect() {}, fillText() {} }) }) };

function fixture(options = {}) {
  const scene = new THREE.Scene();
  const world = createBusinessInteriors({ scene, ...options });
  return { scene, world, close: () => world.dispose() };
}
function blocked(world, x, z, radius = .32) {
  return world.colliders.some(b => x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius);
}
function assertClearSegment(world, from, to, label) {
  const count = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .08);
  for (let i = 0; i <= count; i++) {
    const t = count ? i / count : 0;
    assert.equal(blocked(world, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t), false, label);
  }
}

test('all three businesses belong to one world group with same-coordinate door crossings', () => {
  const f = fixture();
  assert.equal(f.scene.children.length, 1);
  assert.equal(f.world.group.userData.connectedWorld, true);
  for (const door of f.world.entrances) {
    const from = { x: door.portal.x, z: door.portal.z + 1.5 };
    const to = { x: door.portal.x, z: door.portal.z - 1.5 };
    assertClearSegment(f.world, from, to, `${door.id} doorway`);
    assert.equal(crossedEntrance(from, to, f.world.entrances)?.id, door.id);
    assert.equal(f.world.zoneAt(to), door.id);
    assert.equal(f.world.zoneAt(from), null);
  }
  f.close();
});

test('player can physically walk in and out of each real doorway', () => {
  const f = fixture();
  for (const door of f.world.entrances) {
    const player = { x: door.portal.x, z: door.portal.z + 1.5, vx: 0, vz: 0, grounded: true };
    for (let i = 0; i < 30; i++) stepPlayerMotion(player, { forward: 1, yaw: 0 }, .05, (x, z) => blocked(f.world, x, z));
    assert.equal(f.world.zoneAt(player), door.id);
    for (let i = 0; i < 32; i++) stepPlayerMotion(player, { forward: -1, yaw: 0 }, .05, (x, z) => blocked(f.world, x, z));
    assert.equal(f.world.zoneAt(player), null);
    assert.equal(player.x, door.portal.x);
  }
  f.close();
});

test('every worker route and customer browse/checkout route avoids solid furniture', () => {
  const f = fixture();
  for (const route of f.world.npcRoutes) {
    for (let i = 0; i < route.points.length; i++) {
      assertClearSegment(f.world, route.points[i], route.points[(i + 1) % route.points.length], `${route.zone}/${route.role}`);
    }
  }
  const door = f.world.entrances.find(e => e.id === 'store').portal;
  const entry = { x: door.x, z: door.z - 1 };
  for (const browse of f.world.browsePoints) {
    assertClearSegment(f.world, entry, browse, 'door to browse');
    for (const slot of f.world.queueSlots) assertClearSegment(f.world, browse, slot, 'browse to checkout');
  }
  for (const slot of f.world.queueSlots) assertClearSegment(f.world, slot, entry, 'checkout to exit');
  for (const point of f.world.hotspots) assert.equal(blocked(f.world,point.x,point.z,.36),false,`${point.id} is accessible on foot`);
  assert.deepEqual(f.world.hotspots.filter(p=>p.type==='product').map(p=>p.productId),['esencial','urbano','premium']);
  f.close();
});

test('walls, racks, sewing machines and cash counter stop moving player', () => {
  const f = fixture();
  for (const kind of ['wall', 'shelf', 'machine', 'counter']) {
    const box = f.world.colliders.find(c => c.kind === kind);
    assert.ok(box, kind);
    const player = { x: box.minX - .65, z: (box.minZ + box.maxZ) / 2, vx: 0, vz: 0, grounded: true };
    for (let i = 0; i < 50; i++) stepPlayerMotion(player, { side: 1, yaw: 0, sprint: true }, .05, (x, z) => blocked(f.world, x, z));
    assert.ok(player.x <= box.minX - .32, kind);
  }
  f.close();
});

test('current financial snapshot changes visible display and reserve tiers independently', () => {
  const f = fixture();
  const projection = { storeFill: .5, warehouseFill: .75, producedUnits: 20, plannedUnits: 80, pendingUnits: 0 };
  f.world.sync(projection);
  assert.deepEqual(f.world.stats().stockLevels, { store: 2, warehouse: 3, production: 1 });
  for (const room of f.world.rooms) for (const tier of room.stock) assert.equal(tier.group.visible, tier.tier <= room.stockLevel);
  assert.deepEqual(projection, { storeFill: .5, warehouseFill: .75, producedUnits: 20, plannedUnits: 80, pendingUnits: 0 });
  f.world.sync({ storeFill: 0, warehouseFill: 0, producedUnits: 0, plannedUnits: 80 });
  for (const room of f.world.rooms) for (const stock of room.stock) assert.equal(stock.group.visible, false);
  f.close();
});

test('pending supplier delivery is a marker and never available reserve inventory', () => {
  const f = fixture();
  const room = f.world.rooms.find(r => r.id === 'warehouse');
  f.world.sync({ pendingUnits: 30, warehouseFill: 0 });
  assert.equal(room.pending.visible, true);
  assert.match(room.pending.name, /Pending delivery/);
  assert.equal(room.stockLevel, 0);
  f.world.sync({ pendingUnits: 0, warehouseFill: .25 });
  assert.equal(room.pending.visible, false);
  assert.equal(room.stockLevel, 1);
  f.close();
});

test('stock levels clamp valid ratios and malformed values safely', () => {
  assert.deepEqual([0, .01, .25, .5, .75, 1, 8, -1, NaN, Infinity].map(stockVisualLevel), [0, 1, 1, 2, 3, 4, 4, 0, 0, 0]);
});

test('only current room lights and NPCs run; revisiting never duplicates actors', () => {
  let created = 0, animated = 0;
  const f = fixture({ createNpc: () => { created++; return new THREE.Group(); }, animateNpc: () => animated++ });
  f.world.tick(.05, { x: 131, z: 27 });
  assert.equal(created, 0); assert.equal(f.world.stats().activeLights, 0);
  f.world.tick(.05, { x: 131, z: 20 });
  assert.equal(created, 4); assert.equal(f.world.stats().activeLights, 2);
  const before = animated;
  f.world.tick(.05, { x: 150, z: 0 });
  assert.equal(animated, before);
  assert.equal(f.world.stats().activeLights, 0);
  assert.ok(f.world.rooms[0].actors.every(a => !a.object.visible));
  f.world.tick(.05, { x: 131, z: 20 });
  assert.equal(created, 4); assert.equal(f.world.stats().activeNpcs, 4);
  f.close();
});

test('shared instancing batches stock per room/tier; furniture has metre-scale ceilings', () => {
  const f = fixture();
  const geometry = new Set(); let instances = 0;
  f.world.group.traverse(object => {
    if (object.isInstancedMesh) { geometry.add(object.geometry); instances += object.count; }
  });
  assert.equal(geometry.size, 2);
  assert.ok(instances > 500);
  for (const room of f.world.rooms) {
    assert.equal(room.stock.length, 4);
    assert.ok(room.stock.every(s => s.group.children.length <= 5));
  }
  for (const layout of BUSINESS_LAYOUTS) assert.ok(layout.height >= 4 && layout.doorWidth >= 2.8);
  const position = { x: 131, y: 1.5, z: 20 };
  const camera = constrainCamera(position, { x: 120, y: 3.5, z: 20 }, f.world.colliders);
  assert.ok(camera.x > 123.2);
  f.close();
});

test('repeat business model updates retain one scene and disposal is idempotent', () => {
  const f = fixture();
  const original = [...f.world.group.children], meshes = [];
  f.world.group.traverse(o => { if (o.isInstancedMesh) meshes.push(o); });
  let disposed = 0; meshes.forEach(o => o.addEventListener('dispose', () => disposed++));
  for (let cycle = 0; cycle < 50; cycle++) {
    f.world.sync({ storeFill: cycle % 5 / 4, warehouseFill: .5 });
    f.world.tick(.05, { x: 131, z: 20 });
  }
  assert.deepEqual(f.world.group.children, original);
  assert.equal(f.scene.children.length, 1);
  f.close(); f.close();
  assert.equal(f.scene.children.length, 0);
  assert.equal(disposed, meshes.length);
});
