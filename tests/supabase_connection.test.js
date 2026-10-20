'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture(fetch) {
  let options, expire, cancelled = 0;
  const window = {
    SIDE_CONFIG: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test' },
    fetch, AbortController,
    setTimeout(fn, ms) { assert.equal(ms, 15000); expire = fn; return 1; },
    clearTimeout() { cancelled++; },
    supabase: { createClient(_url, _key, config) { options = config; return {}; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/supabase_client.js'), 'utf8'), { window, console });
  window.SIDE.SupabaseClient.get();
  return { fetch: options.global.fetch, expire: () => expire(), cancelled: () => cancelled };
}

test('hung Supabase request aborts, releases the caller and allows a subsequent request', async () => {
  let calls = 0, signal;
  const f = fixture((_url, options) => {
    signal = options.signal;
    return ++calls === 1 ? new Promise(() => {}) : Promise.resolve(new Response('{"ok":true}'));
  });
  const first = f.fetch('https://test.supabase.co/rest/v1/example');
  await Promise.resolve(); f.expire();
  await assert.rejects(first, { code: 'CONEXION_TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.deepEqual(await (await f.fetch('https://test.supabase.co/rest/v1/example')).json(), { ok: true });
  assert.equal(calls, 2, 'the transport must never automatically replay a write');
  assert.equal(f.cancelled(), 2);
});

test('Supabase deadline covers a stalled body after headers arrived', async () => {
  let signal;
  const f = fixture(async (_url, options) => {
    signal = options.signal;
    return { clone: () => ({ arrayBuffer: () => new Promise(() => {}) }) };
  });
  const pending = f.fetch('https://test.supabase.co/rest/v1/example');
  await Promise.resolve(); await Promise.resolve(); f.expire();
  await assert.rejects(pending, { code: 'CONEXION_TIMEOUT' });
  assert.equal(signal.aborted, true);
});

test('bounded transport preserves caller cancellation and HTTP error bodies', async () => {
  let signal;
  const f = fixture(async (_url, options) => {
    signal = options.signal;
    return new Response('{"code":"42501"}', { status: 403 });
  });
  const controller = new AbortController();
  controller.abort();
  const response = await f.fetch('https://test.supabase.co/rest/v1/example', { signal: controller.signal });
  assert.equal(signal.aborted, true);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { code: '42501' });
  assert.equal(f.cancelled(), 1);
});
