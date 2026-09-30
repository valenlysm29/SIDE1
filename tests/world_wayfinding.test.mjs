import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBannerPosition, computeEdgeArrow } from '../services/world_wayfinding.mjs';

const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('flecha de objetivo respeta área segura y borde en móvil vertical', () => {
  const result = computeEdgeArrow({ width: 360, height: 640, dx: 2, dy: 0,
    safe: { top: 35, bottom: 24, left: 4, right: 4 } });
  assert.equal(result.side, 'right');
  assert.ok(result.box.left >= 16 && result.box.right <= 344);
  assert.ok(result.box.top >= 47 && result.box.bottom <= 604);
});

test('flecha evita minimapa y controles táctiles en orientación vertical', () => {
  const obstacles = [
    { left: 205, right: 355, top: 190, bottom: 340 }, // minimapa
    { left: 0, right: 150, top: 450, bottom: 620 }, // joystick
    { left: 215, right: 360, top: 450, bottom: 620 }, // acciones
    { left: 0, right: 360, top: 0, bottom: 125 } // estadísticas y botones
  ];
  const result = computeEdgeArrow({ width: 360, height: 640, dx: 3, dy: -.5, obstacles });
  assert.ok(result);
  assert.ok(obstacles.every(obstacle => !intersects(result.box, obstacle)));
});

test('flecha halla tramo libre de borde en orientación horizontal', () => {
  const obstacles = [
    { left: 0, right: 180, top: 240, bottom: 390 },
    { left: 650, right: 844, top: 240, bottom: 390 },
    { left: 0, right: 844, top: 0, bottom: 82 }
  ];
  const result = computeEdgeArrow({ width: 844, height: 390, dx: 0, dy: 1,
    safe: { left: 32, right: 20, bottom: 18 }, obstacles });
  assert.ok(result);
  assert.ok(result.box.bottom <= 360);
  assert.ok(obstacles.every(obstacle => !intersects(result.box, obstacle)));
});

test('objetivo detrás de cámara tiene dirección estable y viewport inviable no dibuja flecha', () => {
  const result = computeEdgeArrow({ width: 390, height: 844, dx: 0, dy: 0 });
  assert.equal(result.side, 'bottom');
  assert.equal(result.angle, 90);
  assert.equal(computeEdgeArrow({ width: 100, height: 100, dx: 1, dy: 0 }), null);
});

test('aviso de zona busca espacio entre estadísticas y minimapa', () => {
  const obstacles = [
    { left: 0, right: 390, top: 0, bottom: 135 },
    { left: 230, right: 390, top: 140, bottom: 330 },
    { left: 0, right: 140, top: 650, bottom: 844 }
  ];
  const result = computeBannerPosition({ width: 390, height: 844, bannerWidth: 190,
    bannerHeight: 42, obstacles, safe: { top: 30, bottom: 20 } });
  assert.ok(result);
  assert.ok(obstacles.every(obstacle => !intersects(result.box, obstacle)));
});
