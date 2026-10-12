'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPresenceTracker } = require('../services/teacher_sync');

function clock() {
  let time = Date.parse('2026-10-12T12:00:00Z');
  return { now: () => time, advance: ms => { time += ms; }, stamp: () => new Date(time).toISOString() };
}

test('a fresh heartbeat connects immediately and reconnects immediately after sustained inactivity', () => {
  const c = clock(), tracker = createPresenceTracker({ now: c.now, offlineMs: 120000, idleSustainMs: 15000 });
  const first = c.stamp();
  assert.equal(tracker.observe('empresa-a', first), 'online');
  c.advance(121000);
  assert.equal(tracker.observe('empresa-a', first), 'online');
  c.advance(15001);
  assert.equal(tracker.observe('empresa-a', first), 'idle');
  assert.equal(tracker.observe('empresa-a', c.stamp()), 'online');
});

test('an out-of-order polling response cannot overwrite a newer realtime heartbeat', () => {
  const c = clock(), tracker = createPresenceTracker({ now: c.now, offlineMs: 120000, idleSustainMs: 15000 });
  const stale = c.stamp();
  tracker.observe('empresa-a', stale); tracker.observe('empresa-a', stale);
  c.advance(180000);
  const fresh = c.stamp();
  assert.equal(tracker.observe('empresa-a', fresh), 'online');
  for (let i = 0; i < 6; i++) {
    c.advance(4000);
    assert.equal(tracker.observe('empresa-a', stale), 'online', 'late response must retain the maximum last_seen_at');
  }
});

test('duplicate callbacks do not count as sustained inactivity', () => {
  const c = clock(), tracker = createPresenceTracker({ now: c.now, offlineMs: 120000, idleSustainMs: 15000 });
  const first = c.stamp();
  tracker.observe('empresa-a', first); tracker.observe('empresa-a', first);
  c.advance(121000);
  for (let i = 0; i < 20; i++) assert.equal(tracker.observe('empresa-a', first), 'online');
  c.advance(14999);
  assert.equal(tracker.observe('empresa-a', first), 'online');
  c.advance(2);
  assert.equal(tracker.observe('empresa-a', first), 'idle');
});

test('two companies survive heartbeat jitter, delayed responses, missing fields and a brief disconnection', () => {
  const c = clock(), tracker = createPresenceTracker({ now: c.now, offlineMs: 120000, idleSustainMs: 15000 });
  let previous = c.stamp();
  for (const id of ['empresa-a', 'empresa-b']) { tracker.observe(id, previous); tracker.observe(id, previous); }
  for (const delay of [15000, 31000, 45000, 27000, 70000, 18000]) {
    c.advance(delay);
    const fresh = c.stamp();
    for (const id of ['empresa-a', 'empresa-b']) {
      assert.equal(tracker.observe(id, fresh), 'online');
      for (let i = 0; i < 3; i++) assert.equal(tracker.observe(id, previous), 'online');
      assert.equal(tracker.observe(id, null), 'online');
    }
    previous = fresh;
  }
});

test('clock ticks expire the retained heartbeat even when no new network response arrives', () => {
  const c = clock(), tracker = createPresenceTracker({ now: c.now, offlineMs: 120000, idleSustainMs: 15000 });
  const fresh = c.stamp();
  tracker.observe('empresa-a', fresh);
  c.advance(121000);
  assert.equal(tracker.get('empresa-a'), 'online');
  c.advance(15001);
  assert.equal(tracker.tick('empresa-a'), 'idle');
  assert.equal(tracker.observe('empresa-a', null), 'idle');
  assert.equal(tracker.lastSeen('empresa-a'), fresh);
  assert.equal(tracker.observe('empresa-a', c.stamp()), 'online');
});
