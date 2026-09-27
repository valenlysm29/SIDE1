import test from 'node:test';
import assert from 'node:assert/strict';
import { crossedPortal, crossedEntrance, crossedInteriorExit } from '../services/world_portals.mjs';

test('walking across a facade threshold enters once without a button or cooldown', () => {
  const door = { x: 131, z: 24.75, halfWidth: 1.05 };
  assert.equal(crossedPortal({ x: 131, z: 25 }, { x: 131, z: 24.6 }, door), true);
  assert.equal(crossedPortal({ x: 131, z: 24.6 }, { x: 131, z: 24.6 }, door), false);
  assert.equal(crossedPortal({ x: 131, z: 24.6 }, { x: 131, z: 25 }, door), false);
  assert.equal(crossedPortal({ x: 131, z: 24.75 }, { x: 131, z: 24.6 }, door), false);
});

test('side walls and passing in front of a shop do not enter', () => {
  const door = { x: 131, z: 24.75, halfWidth: 1.05 };
  assert.equal(crossedPortal({ x: 133, z: 25 }, { x: 133, z: 24.6 }, door), false);
  assert.equal(crossedPortal({ x: 129, z: 25 }, { x: 133, z: 25 }, door), false);
  assert.equal(crossedPortal({ x: 130, z: 25 }, { x: 132, z: 24.5 }, door), true);
});

test('swept entrance chooses only the doorway crossed even during a long frame', () => {
  const entrances = [
    { id: 'store', portal: { x: 131, z: 24.75 } },
    { id: 'warehouse', portal: { x: 130, z: -11.1 } },
    { id: 'production', portal: { x: 170, z: -11.1 } }
  ];
  assert.equal(crossedEntrance({ x: 130, z: -10 }, { x: 130, z: -11.3 }, entrances)?.id, 'warehouse');
  assert.equal(crossedEntrance({ x: 170, z: -10 }, { x: 170, z: -11.3 }, entrances)?.id, 'production');
  assert.equal(crossedEntrance({ x: 150, z: -10 }, { x: 150, z: -11.3 }, entrances), null);
});

test('interior returns through the physical exit and arrival cannot bounce outside', () => {
  assert.equal(crossedInteriorExit({ x: 0, z: 7.3 }, { x: 0, z: 8.3 }), true);
  assert.equal(crossedInteriorExit({ x: 0, z: 8.3 }, { x: 0, z: 7.3 }), false);
  assert.equal(crossedInteriorExit({ x: 0, z: 7.3 }, { x: 0, z: 7.3 }), false);
  assert.equal(crossedInteriorExit({ x: 4, z: 7.3 }, { x: 4, z: 8.3 }), false);
});
