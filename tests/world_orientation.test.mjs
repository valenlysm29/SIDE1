import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { closestCityZone, DEFAULT_CITY_BOUNDS, mapPoint, CITY_ZONE_ICONS, layoutZoneLabels } from '../services/world_orientation.mjs';
import { CITY_MAP } from '../services/hub_world.js';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

test('minimapa mantiene escala y orientación para la ciudad completa', () => {
  assert.deepEqual(CITY_MAP.bounds, DEFAULT_CITY_BOUNDS);
  assert.deepEqual(mapPoint(-88, -88), { x: 0, y: 0 });
  assert.deepEqual(mapPoint(88, 88), { x: 100, y: 100 });
  assert.deepEqual(mapPoint(0, 0), { x: 50, y: 50 });
  assert.deepEqual(mapPoint(200, -200), { x: 100, y: 0 });
});

test('todas las zonas poseen nombre, posición, ícono integrado y destino distinto', () => {
  assert.equal(CITY_MAP.zones.length, 7);
  assert.equal(new Set(CITY_MAP.zones.map(zone => `${zone.x}:${zone.z}`)).size, 7);
  for (const zone of CITY_MAP.zones) {
    assert.ok(zone.name);
    assert.ok(CITY_ZONE_ICONS[zone.id]);
    assert.equal(closestCityZone(zone.x, zone.z, CITY_MAP.zones), zone.id);
  }
  assert.equal(closestCityZone(0, 0, CITY_MAP.zones), null);
});

test('el escenario contiene controles accesibles para mapa, avisos y objetivo', () => {
  for (const id of ['simCityMapArea', 'miniPlayer', 'simZoneLabels', 'simZoneBanner', 'simRouteMarker']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="simCityMapArea"[^>]*role="group"/);
  assert.match(html, /id="simZoneBanner"[^>]*role="status"/);
});

test('rótulos móviles priorizan objetivo y zona actual sin cubrir controles', () => {
  const candidates = CITY_MAP.zones.map((zone, index) => ({ zone, point: { x: 180 + index * 2, y: 300, distance: 20 + index } }));
  const obstacles = [
    { left: 0, right: 360, top: 0, bottom: 110 },
    { left: 0, right: 145, top: 430, bottom: 640 },
    { left: 220, right: 360, top: 300, bottom: 640 }
  ];
  const placed = layoutZoneLabels({ candidates, width: 360, height: 640, obstacles, targetZone: 'news', currentZone: 'store' });
  assert.ok(placed.length <= 3);
  assert.equal(placed[0].id, 'news');
  assert.ok(placed.some(item => item.id === 'store'));
  for (const item of placed) {
    for (const obstacle of obstacles) assert.ok(item.box.right <= obstacle.left || item.box.left >= obstacle.right || item.box.bottom <= obstacle.top || item.box.top >= obstacle.bottom);
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i].box, b = placed[j].box;
    assert.ok(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }
});

test('el objetivo fuera de cámara conserva rótulo y abrevia si el espacio es estrecho', () => {
  const zone = CITY_MAP.zones.find(item => item.id === 'suppliers');
  const placed = layoutZoneLabels({
    candidates: [{ zone, point: null }], width: 360, height: 640, targetZone: 'suppliers',
    obstacles: [{ left: 0, right: 122, top: 0, bottom: 640 }, { left: 238, right: 360, top: 0, bottom: 640 }]
  });
  assert.equal(placed.length, 1);
  assert.equal(placed[0].text, 'Proveed.');
  assert.equal(placed[0].abbreviated, true);
});
