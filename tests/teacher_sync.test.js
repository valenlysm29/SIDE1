'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPresenceTracker, createGradeQueue } = require('../services/teacher_sync');
const fs = require('node:fs');
const path = require('node:path');
const { database, config, createGame, rpc } = require('./lifecycle_db_fixture.cjs');

test('presence needs two readings and a wider timeout before going idle', () => {
  let time = Date.parse('2026-09-29T12:00:00Z');
  const tracker = createPresenceTracker({ now: () => time });
  const seen = new Date(time).toISOString();
  assert.equal(tracker.observe('a', seen), 'unconfirmed');
  assert.equal(tracker.observe('a', seen), 'online');
  time += 95000;
  assert.equal(tracker.observe('a', seen), 'online');
  assert.equal(tracker.observe('a', null), 'online');
  time += 26000;
  assert.equal(tracker.observe('a', seen), 'online');
  assert.equal(tracker.observe('a', seen), 'idle');
  const refreshed = new Date(time).toISOString();
  assert.equal(tracker.observe('a', refreshed), 'idle');
  assert.equal(tracker.observe('a', refreshed), 'online');
});

test('grade queue retries, persists, and only acknowledges the latest edit', async () => {
  const values = new Map(), callbacks = [], statuses = [];
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let resolveFirst, calls = 0;
  const queue = createGradeQueue({ storage, retryMs: [1, 2, 3],
    schedule: callback => { callbacks.push(callback); return callbacks.length; },
    clearSchedule: () => {},
    onStatus: (key, status) => statuses.push([key, status]),
    save: async ({ score }) => {
      calls++;
      if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
      return score === 19 ? { success: false, error: 'backend detail' } : { success: true };
    }
  });
  queue.enqueue('partida:empresa', { score: 19 });
  queue.enqueue('partida:empresa', { score: 18 });
  resolveFirst({ success: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queue.pending(), 1);
  assert.equal(statuses.some(([, status]) => status === 'saved'), false);
  callbacks.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queue.pending(), 0);
  assert.deepEqual(statuses.at(-1), ['partida:empresa', 'saved']);
  assert.deepEqual(JSON.parse(values.get('SIDE_TEACHER_GRADE_QUEUE')), {});
});

test('grade queue shows failure only after repeated retries and keeps job locally', async () => {
  const values = new Map(), callbacks = [], statuses = [];
  const queue = createGradeQueue({
    storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    retryMs: [1, 2, 3], schedule: callback => { callbacks.push(callback); return callbacks.length; },
    clearSchedule: () => {}, onStatus: (_, status) => statuses.push(status),
    save: async () => ({ success: false, error: 'backend detail' })
  });
  const prior = console.error;
  console.error = () => {};
  try {
    queue.enqueue('a', { score: 15 });
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setImmediate(resolve));
      if (i < 2) callbacks.shift()();
    }
    assert.deepEqual(statuses, ['saving', 'retrying', 'retrying', 'failed']);
    assert.equal(queue.pending(), 1);
  } finally { console.error = prior; }
});

test('grade migration persists only for the owner and a company in that game', async () => {
  const db = await database();
  try {
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260929_guardar_puntaje_docente.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const first = await createGame(db, config());
    const second = await createGame(db, config());
    const company = (await db.query("insert into empresas(nombre_legal,nombre_comercial) values('Legal','Comercial') returning id")).rows[0];
    await db.query('insert into participantes(partida_id,empresa_id,nombre,empresa) values($1,$2,$3,$4)', [first.id, company.id, 'Alumno', 'Comercial']);
    const save = await rpc(db, 'guardar_puntaje_docente', { p_partida_id: first.id, p_empresa_id: company.id, p_puntaje: 18.75 });
    assert.equal(save.success, true);
    assert.equal(Number((await db.query('select puntaje_docente from participantes where empresa_id=$1', [company.id])).rows[0].puntaje_docente), 18.75);
    const wrongGame = await rpc(db, 'guardar_puntaje_docente', { p_partida_id: second.id, p_empresa_id: company.id, p_puntaje: 4 });
    assert.ok(wrongGame.error);
    await db.query("select set_config('test.uid',$1,false)", ['22222222-2222-2222-2222-222222222222']);
    const wrongTeacher = await rpc(db, 'guardar_puntaje_docente', { p_partida_id: first.id, p_empresa_id: company.id, p_puntaje: 4 });
    assert.ok(wrongTeacher.error);
    assert.equal(Number((await db.query('select puntaje_docente from participantes where empresa_id=$1', [company.id])).rows[0].puntaje_docente), 18.75);
  } finally { await db.close(); }
});
