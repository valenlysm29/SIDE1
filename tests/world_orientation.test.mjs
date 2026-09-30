import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { closestCityZone, DEFAULT_CITY_BOUNDS, mapPoint, CITY_ZONE_ICONS } from '../services/world_orientation.mjs';
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
