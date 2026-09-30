import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCityRoster, validCityManifest, npcHasRole } from '../services/npc_city_roster.mjs';

const model = id => ({ id, rol: 'banco', archivo: `assets/models/npc/${id}.glb`, altura: 1.7, licencia: 'CC0' });

test('strict staff draw reuses a safe outfit when remaining bag only contains nearby actors', () => {
  const roster = createCityRoster([model('a'), model('b')], { random: () => .5 });
  assert.equal(roster.draw('bank', 'banco', [], { unique: true }).model.id, 'a');
  assert.equal(roster.draw('bank', 'banco', ['b'], { unique: true }).model.id, 'a');
  assert.equal(roster.draw('bank', 'banco', [{ id: 'a' }], { unique: true }).model.id, 'b');
  assert.equal(roster.draw('bank', 'banco', ['a', 'b'], { unique: true }), null);
  assert.equal(roster.draw('bank', 'banco', ['a'], { unique: true }).model.id, 'b');
});

test('approved city manifest has 16 CC0 actors and strict roles exclude eligible avatars', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/models/npc/manifest.json', import.meta.url), 'utf8'));
  const rows = Array.isArray(manifest) ? manifest : manifest.personajes || manifest.npcs || manifest.models;
  const approved = validCityManifest(rows);
  assert.equal(approved.length, 16);
  assert.ok(approved.every(row => /^CC0(?:-1\.0)?$/i.test(row.licencia)));
  assert.ok(approved.every(row => !['chico1', 'chico2', 'chico3', 'mona'].includes(row.id)));
  const roster = createCityRoster(rows, { random: () => .5 });
  const nearby = [];
  for (const role of ['oficina', 'banco', 'cajero', 'proveedor']) {
    const selected = roster.draw('decision-interiors', role, nearby, { unique: true });
    assert.ok(selected, `approved outfit available for ${role}`);
    assert.ok(npcHasRole(selected.model, role));
    assert.ok(!nearby.includes(selected.model.id));
    nearby.push(selected.model.id);
  }
});
