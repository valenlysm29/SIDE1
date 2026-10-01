import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import { CITY_MAP, createHubWorld } from '../services/hub_world.js';
import { createWorldOrientation } from '../services/world_orientation.mjs';
import { createWorldWayfinding } from '../services/world_wayfinding.mjs';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.style = { removeProperty() {} };
    this.hidden = false; this.handlers = {}; this.attributes = {};
    this.classList = { toggle: (name, enabled) => {
      const classes = new Set((this.className || '').split(' ').filter(Boolean));
      if (enabled) classes.add(name); else classes.delete(name);
      this.className = [...classes].join(' ');
    }, contains: name => (this.className || '').split(' ').includes(name) };
  }
  append(...nodes) { for (const node of nodes) { this.children.push(node); node.parent = this; } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = node => selector.split(',').some(part => part[0] === '#' ? node.id === part.slice(1)
      : part[0] === '.' && node.classList.contains(part.slice(1)));
    return this.children.flatMap(node => [...(matches(node) ? [node] : []), ...node.querySelectorAll(selector)]);
  }
  getBoundingClientRect() { return { width: this.width || 390, height: 844, left: 0, top: 0 }; }
}

function installDOM(t) {
  const previous = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.document = { createElement: tag => new Element(tag) };
  globalThis.matchMedia = () => ({ matches: false });
  t.after(() => Object.assign(globalThis, previous));
  const root = new Element();
  for (const id of ['simCityMapArea', 'miniPlayer', 'simZoneLabels', 'simZoneBanner', 'simRouteMarker']) {
    const node = new Element(); node.id = id; node.hidden = id === 'simZoneBanner'; root.append(node);
  }
  return root;
}

for (const width of [390, 1366]) test(`HUD ${width}px conserva destinos solo en minimapa y mapa expandido`, t => {
  const root = installDOM(t); root.width = width;
  const navigated = [];
  const orientation = createWorldOrientation({ THREE, root, zones: CITY_MAP.zones, onNavigate: id => navigated.push(id) });
  const wayfinding = createWorldWayfinding({ THREE, root, zones: CITY_MAP.zones });
  const map = root.querySelector('#simCityMapArea');
  assert.equal(map.children.length, 7);
  for (const icon of map.children) {
    assert.equal(icon.children[0].tagName, 'img');
    assert.ok(icon.attributes['aria-label']);
    assert.equal(icon.parent, map);
  }
  orientation.setTarget('news');
  orientation.setActiveZone('store', false);
  for (let i = 0; i < 20; i++) {
    orientation.update({ player: { x: 166, z: 27 }, now: i * 150 });
    // A destination outside the camera cannot spawn another HUD marker.
    wayfinding.update({ player: { x: 166, z: 27 }, camera: {}, targetZone: 'bank', now: i * 150 });
  }
  assert.equal(root.querySelectorAll('.sim-zone-label,.sim-edge-guide,#simZoneLabels,#simRouteMarker').length, 0);
  assert.equal(map.children.find(node => node.dataset.zone === 'news').classList.contains('is-target'), true);
  assert.equal(map.children.find(node => node.dataset.zone === 'store').classList.contains('is-current'), true);
  const bank = map.children.find(node => node.dataset.zone === 'bank');
  bank.handlers.click();
  assert.deepEqual(navigated, ['bank']);
  assert.equal(orientation.targetZone, 'bank');
  assert.equal(bank.classList.contains('is-target'), true);
  assert.ok(root.querySelector('#miniPlayer').style.left);
  wayfinding.destroy(); orientation.destroy();
  assert.equal(map.children.length, 0);
});

test('altura de suelo usa geometría caminable mundial de plaza, pedestal y avenidas', t => {
  const previous = globalThis.document;
  const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => { target[key] = value; return true; } });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  t.after(() => { globalThis.document = previous; });
  const world = createHubWorld();
  t.after(() => world.dispose());
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);
  near(world.groundHeightAt(166, 27), .022);
  near(world.groundHeightAt(169, 19), .1245);
  near(world.groundHeightAt(171.6, 19), .1);
  near(world.groundHeightAt(150, 0), .030);
  near(world.groundHeightAt(221, 0), .020);
  near(world.groundHeightAt(320, 170), -.205);
  assert.equal(world.groundHeightAt(400, 250), null);
  world.group.position.y += .3;
  near(world.groundHeightAt(166, 27), .322);
});
