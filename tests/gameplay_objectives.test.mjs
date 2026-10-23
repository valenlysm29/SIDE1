import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveObjective} from '../services/gameplay_objectives.mjs';

test('operational tasks supersede the tour without changing financial state', () => {
  const snapshot = Object.freeze({visited: Object.freeze([]), queue: 2, stockKnown: true, display: 0, reserve: 12});
  assert.equal(deriveObjective(snapshot).id, 'checkout');
  assert.equal(deriveObjective({...snapshot, queue: 0}).id, 'restock');
  assert.equal(snapshot.reserve, 12);
});
test('stockout distinguishes delivery from procurement and never invents transactions', () => {
  const snapshot = {stockKnown: true, display: 0, reserve: 0, deliveryPending: true};
  assert.equal(deriveObjective(snapshot).id, 'delivery');
  assert.equal(deriveObjective({...snapshot, deliveryPending: false}).id, 'supply');
  assert.equal(deriveObjective({...snapshot, reserve: 5}).id, 'restock');
});
test('tour only counts supported unique destinations and continues to operation', () => {
  assert.equal(deriveObjective().id, 'explore-store');
  assert.equal(deriveObjective({visited: ['store', 'store', 'unknown']}).title, 'CONOCE TU EMPRESA · 1/3');
  assert.equal(deriveObjective({visited: ['store']}).region, 'production');
  assert.equal(deriveObjective({visited: ['store', 'production']}).region, 'warehouse');
  assert.equal(deriveObjective({visited: ['store', 'production', 'warehouse']}).id, 'operate');
});
test('shift closure always supersedes live tasks and removes navigation', () => {
  const result = deriveObjective({shiftEnded: true, queue: 3, stockKnown: true, display: 0, reserve: 0});
  assert.equal(result.id, 'results');
  assert.equal(result.region, null);
});
test('unloaded inventory is not mistaken for a stockout', () => {
  assert.equal(deriveObjective({display: 0, reserve: 0}).id, 'explore-store');
});
