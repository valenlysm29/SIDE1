/* Small state machines used by the teacher roster. No DOM access here. */
(function (global) {
  'use strict';

  function createPresenceTracker(options = {}) {
    const now = options.now || Date.now;
    const onlineMs = options.onlineMs ?? 90000;
    const offlineMs = options.offlineMs ?? 120000;
    const confirmations = options.confirmations ?? 2;
    const entries = new Map();

    function observe(id, lastSeenAt) {
      let entry = entries.get(id);
      if (!entry) {
        entry = { status: 'unconfirmed', candidate: null, count: 0, seen: false };
        entries.set(id, entry);
      }
      const stamp = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
      if (Number.isFinite(stamp)) entry.seen = true;
      // A missing heartbeat in one response must not erase an earlier one.
      if (!Number.isFinite(stamp)) return entry.status;

      const age = Math.max(0, now() - stamp);
      const candidate = entry.status === 'online'
        ? (age >= offlineMs ? 'idle' : 'online')
        : (age <= onlineMs ? 'online' : 'idle');
      if (candidate === entry.status) {
        entry.candidate = null;
        entry.count = 0;
      } else {
        entry.count = entry.candidate === candidate ? entry.count + 1 : 1;
        entry.candidate = candidate;
        if (entry.count >= confirmations) {
          entry.status = candidate;
          entry.candidate = null;
          entry.count = 0;
        }
      }
      return entry.status;
    }

    return { observe, clear(id) { if (id === undefined) entries.clear(); else entries.delete(id); } };
  }

  function createGradeQueue(options) {
    const { storage, save, onStatus = () => {}, schedule = setTimeout, clearSchedule = clearTimeout } = options;
    const storageKey = options.storageKey || 'SIDE_TEACHER_GRADE_QUEUE';
    const retryMs = options.retryMs || [2000, 5000, 15000];
    let jobs;
    try { jobs = JSON.parse(storage.getItem(storageKey) || '{}') || {}; }
    catch { jobs = {}; }
    let busy = false, timer = null;
    const persist = () => storage.setItem(storageKey, JSON.stringify(jobs));
    const pending = () => Object.keys(jobs).length;

    function plan(delay) {
      if (timer !== null) clearSchedule(timer);
      timer = schedule(() => { timer = null; flush(); }, delay);
    }

    function enqueue(key, payload) {
      if (!key) throw new Error('Grade queue key is required');
      jobs[key] = { payload, revision: (jobs[key]?.revision || 0) + 1, attempts: 0 };
      persist();
      onStatus(key, 'saving');
      void flush();
    }

    async function flush() {
      if (busy || !pending()) return;
      busy = true;
      let retryDelay = null;
      try {
        for (const [key, snapshot] of Object.entries(jobs)) {
          try {
            const result = await save(snapshot.payload);
            if (!result?.success) throw new Error(result?.error || 'Grade save failed');
            // A newer edit takes priority over the result of this request.
            if (jobs[key]?.revision === snapshot.revision) {
              delete jobs[key];
              persist();
              onStatus(key, 'saved');
            }
          } catch (error) {
            console.error('SIDE: no se pudo sincronizar el puntaje docente', error);
            if (jobs[key]?.revision !== snapshot.revision) continue;
            const attempts = ++jobs[key].attempts;
            persist();
            onStatus(key, attempts >= retryMs.length ? 'failed' : 'retrying');
            const wait = retryMs[Math.min(attempts - 1, retryMs.length - 1)];
            retryDelay = retryDelay === null ? wait : Math.min(retryDelay, wait);
          }
        }
      } finally {
        busy = false;
      }
      if (pending()) plan(retryDelay ?? 0);
    }

    return { enqueue, flush, pending, has: key => Boolean(jobs[key]) };
  }

  const api = { createPresenceTracker, createGradeQueue };
  global.SIDE = global.SIDE || {};
  global.SIDE.TeacherSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
