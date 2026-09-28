import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetManager, ASSET_PRIORITY} from '../services/asset_manager.mjs';
import {CharacterManager} from '../services/character_manager.mjs';

test('AssetManager comparte cargas concurrentes y permite reintentar un fallo', async () => {
  const assets = new AssetManager(); let calls = 0, fail = true;
  const loader = async () => { calls += 1; if (fail) throw Error('offline'); return {ok: true}; };
  await assert.rejects(Promise.all([assets.load('world', loader), assets.load('world', loader)]), /offline/);
  assert.equal(calls, 1); assert.equal(assets.has('world'), false);
  fail = false;
  assert.deepEqual(await assets.load('world', loader, {priority: ASSET_PRIORITY.CRITICAL}), {ok: true});
  assert.equal(calls, 2); assert.equal(assets.diagnostics().ready, 1);
});

test('CharacterManager persiste selección, deduplica template y evita NPC del jugador', async () => {
  const memory = new Map(), storage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)};
  const assets = new AssetManager(); let loads = 0;
  const manager = new CharacterManager({assetManager: assets, storage, storageKey: 'side:qa', loadTemplate: async descriptor => ({descriptor, token: ++loads})});
  manager.select('chico1');
  assert.equal(memory.get('side:qa'), 'chico1');
  const [a, b] = await Promise.all([manager.preload(), manager.preload()]);
  assert.equal(a, b); assert.equal(loads, 1); assert.equal(manager.shouldSpawnNpc('chico1'), false);
  assert.equal(manager.create('chico1', {role: 'npc', factory: () => ({})}), null);
  const player = manager.create('chico1', {role: 'player', factory: () => ({userData: {}})});
  assert.equal(manager.create('chico1', {role: 'player', factory: () => ({})}), player);
  assert.equal(manager.diagnostics().playerInstances, 1);
});

test('CharacterManager rechaza identidades inventadas y recupera una selección válida', () => {
  const storage = {getItem: () => 'mona', setItem() {}};
  const manager = new CharacterManager({storage, loadTemplate() {}});
  assert.equal(manager.selected().name, 'Valeria');
  assert.throws(() => manager.select('rpm-avatar'), /desconocido/);
});
