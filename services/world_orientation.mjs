// SIDE city orientation is a DOM overlay. It owns no Three.js scene objects.
export const CITY_ZONE_ICONS = Object.freeze({
  store: 'assets/icons/categories/canales_ventas.svg',
  warehouse: 'assets/icons/categories/insumos.svg',
  production: 'assets/icons/categories/infraestructura.svg',
  office: 'assets/icons/categories/recursos_humanos.svg',
  bank: 'assets/icons/categories/finanzas.svg',
  suppliers: 'assets/icons/categories/insumos.svg',
  news: 'assets/icons/teacher/rondas.svg'
});

export const DEFAULT_CITY_BOUNDS = Object.freeze({ minX: -88, maxX: 88, minZ: -88, maxZ: 88 });

export function mapPoint(x, z, bounds = DEFAULT_CITY_BOUNDS) {
  const width = bounds.maxX - bounds.minX || 1;
  const depth = bounds.maxZ - bounds.minZ || 1;
  return {
    x: Math.max(0, Math.min(100, (x - bounds.minX) / width * 100)),
    y: Math.max(0, Math.min(100, (z - bounds.minZ) / depth * 100))
  };
}

export function closestCityZone(x, z, zones, radius = 11) {
  let nearest = null, best = radius * radius;
  for (const zone of zones || []) {
    const d = (zone.x - x) ** 2 + (zone.z - z) ** 2;
    if (d < best) { best = d; nearest = zone.id; }
  }
  return nearest;
}

const labelHeight = zone => zone.id === 'news' ? 3.3 : 8;

const SHORT_ZONE_NAMES = Object.freeze({ suppliers: 'Proveed.', news: 'Noticias' });
const intersects = (a, b, gap = 5) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

/** Select label positions without touching the DOM, so mobile layouts can be tested. */
export function layoutZoneLabels({ candidates, width, height, obstacles = [], targetZone = null, currentZone = null, maxLabels = width <= 560 ? 3 : width <= 800 ? 5 : 7 }) {
  const margin = 12;
  const cap = Math.max(1, maxLabels);
  const occupied = [];
  const placements = [];
  const ordered = [...candidates].filter(item => item.point || item.zone.id === targetZone)
    .sort((a, b) => (b.zone.id === targetZone) - (a.zone.id === targetZone)
      || (b.zone.id === currentZone) - (a.zone.id === currentZone)
      || (a.point?.distance ?? Infinity) - (b.point?.distance ?? Infinity));
  const makeBox = (x, y, w, h) => ({ left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 });
  const fits = box => box.left >= margin && box.right <= width - margin && box.top >= margin && box.bottom <= height - margin
    && ![...obstacles, ...occupied].some(other => intersects(box, other));
  for (const { zone, point } of ordered) {
    if (placements.length >= cap) break;
    const full = zone.name;
    const short = SHORT_ZONE_NAMES[zone.id] || full;
    const names = full === short ? [full] : [full, short];
    const anchorX = point?.x ?? width / 2;
    const anchorY = point?.y ?? height * .32;
    const shifts = [[0, 0], [0, -36], [0, 36], [-64, 0], [64, 0], [-64, -36], [64, -36], [-64, 36], [64, 36]];
    let chosen = null;
    for (const name of names) {
      const boxWidth = Math.max(width <= 560 ? 88 : 98, 39 + name.length * (width <= 560 ? 7.4 : 7.8));
      const boxHeight = width <= 560 ? 34 : 30;
      const centers = shifts.map(([dx, dy]) => [Math.max(margin + boxWidth / 2, Math.min(width - margin - boxWidth / 2, anchorX + dx)), Math.max(margin + boxHeight / 2, Math.min(height - margin - boxHeight / 2, anchorY + dy))]);
      if (zone.id === targetZone) {
        for (let y = 110; y < height - 24; y += 38) for (let x = margin + boxWidth / 2; x <= width - margin - boxWidth / 2; x += 34) centers.push([x, y]);
      }
      for (const [x, y] of centers) {
        const box = makeBox(x, y, boxWidth, boxHeight);
        if (!fits(box)) continue;
        chosen = { id: zone.id, x, y, text: name, abbreviated: name !== full, box, distance: point?.distance ?? Infinity };
        break;
      }
      if (chosen) break;
    }
    if (chosen) { occupied.push(chosen.box); placements.push(chosen); }
  }
  return placements;
}

/**
 * Coordinates in `zones` and `bounds` are local to the city; player/camera
 * coordinates are absolute world coordinates. `onNavigate(id, zone)` is called
 * by a map click. The caller chooses whether to mark a walking destination or
 * focus the camera. No teleport or game state mutation happens in this module.
 */
export function createWorldOrientation({ THREE, root, zones, bounds = DEFAULT_CITY_BOUNDS, offsetX = 150, onNavigate = () => {} }) {
  if (!THREE || !root) throw new TypeError('THREE and root are required');
  const zoneList = [...(zones || [])];
  const byId = new Map(zoneList.map(zone => [zone.id, zone]));
  const map = root.querySelector('#simCityMapArea');
  const dot = root.querySelector('#miniPlayer');
  const labelsRoot = root.querySelector('#simZoneLabels');
  const banner = root.querySelector('#simZoneBanner');
  const routeMarker = root.querySelector('#simRouteMarker');
  const routeName = root.querySelector('#simRouteMarkerName');
  if (!map || !dot || !labelsRoot || !banner || !routeMarker || !routeName) throw new Error('Faltan elementos de orientación del mundo');

  const buttons = new Map(), labels = new Map();
  let currentZone = null, targetZone = null, bannerTimer = 0, lastRender = -Infinity;
  let latestPlayer = null, latestCamera = null;
  const projected = new THREE.Vector3();

  for (const zone of zoneList) {
    const point = mapPoint(zone.x, zone.z, bounds);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sim-city-zone';
    button.dataset.zone = zone.id;
    button.style.left = `${7 + point.x * .86}%`; button.style.top = `${7 + point.y * .86}%`;
    button.title = `Ir a ${zone.name}`;
    button.setAttribute('aria-label', `Ir a ${zone.name}`);
    const icon = document.createElement('img');
    icon.src = CITY_ZONE_ICONS[zone.id] || CITY_ZONE_ICONS.store;
    icon.alt = '';
    const name = document.createElement('span'); name.textContent = zone.name;
    button.append(icon, name);
    button.addEventListener('click', () => { setTarget(zone.id); onNavigate(zone.id, zone); });
    map.append(button); buttons.set(zone.id, button);

    const label = document.createElement('div');
    label.className = 'sim-zone-label'; label.dataset.zone = zone.id;
    const labelIcon = icon.cloneNode();
    const labelText = document.createElement('span'); labelText.textContent = zone.name;
    label.append(labelIcon, labelText);
    labelsRoot.append(label); labels.set(zone.id, label);
  }

  function setTarget(id) {
    targetZone = byId.has(id) ? id : null;
    buttons.forEach((button, key) => button.classList.toggle('is-target', key === targetZone));
    labels.forEach((label, key) => label.classList.toggle('is-target', key === targetZone));
    routeMarker.hidden = !targetZone;
    if (targetZone) routeName.textContent = byId.get(targetZone).name;
  }

  function setActiveZone(id, announce = true) {
    const next = byId.has(id) ? id : null;
    if (next === currentZone) return;
    currentZone = next;
    buttons.forEach((button, key) => button.classList.toggle('is-current', key === currentZone));
    labels.forEach((label, key) => label.classList.toggle('is-current', key === currentZone));
    if (!next || !announce) return;
    banner.textContent = byId.get(next).name;
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 2600);
  }

  function project(zone, camera, rect) {
    projected.set(zone.x + offsetX, labelHeight(zone), zone.z);
    const distance = projected.distanceTo(camera.position);
    projected.project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.12 || Math.abs(projected.y) > 1.12) return null;
    return { x: (projected.x + 1) * rect.width / 2, y: (1 - projected.y) * rect.height / 2, distance };
  }

  function renderLabels(camera) {
    const rect = root.getBoundingClientRect();
    const candidates = zoneList.map(zone => ({ zone, point: project(zone, camera, rect) }))
      .filter(item => item.zone.id === targetZone || item.zone.id === currentZone || (item.point && item.point.distance < 145));
    const obstacles = [];
    for (const element of root.querySelectorAll('.sim3d-stats,.sim3d-brand,.sim3d-actionbar,.sim3d-objective,.sim3d-controls,.sim3d-missions,.sim-world-location,.sim-city-map,.sim3d-touch-pad,.sim3d-touch-actions,.sim-drive-hud,.sim-zone-banner,.sim3d-message.show')) {
      if (element.hidden || !element.getClientRects().length) continue;
      const box = element.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      obstacles.push({ left: box.left - rect.left, right: box.right - rect.left, top: box.top - rect.top, bottom: box.bottom - rect.top });
    }
    const selected = layoutZoneLabels({ candidates, width: rect.width, height: rect.height, obstacles, targetZone, currentZone });
    labels.forEach(label => { label.hidden = true; });
    for (const item of selected) {
      const label = labels.get(item.id);
      label.querySelector('span').textContent = item.text;
      label.style.left = `${item.x}px`; label.style.top = `${item.y}px`;
      label.style.setProperty('--distance-scale', String(rect.width <= 800 ? 1 : Math.max(.85, Math.min(1.14, 32 / Math.max(28, item.distance)))));
      label.hidden = false;
    }
  }

  function renderRoute(player, camera) {
    if (!targetZone || !player || !camera) { routeMarker.hidden = true; return; }
    const zone = byId.get(targetZone);
    const rect = root.getBoundingClientRect();
    const point = project(zone, camera, rect);
    const localX = player.x - offsetX;
    const distance = Math.round(Math.hypot(zone.x - localX, zone.z - player.z));
    if (distance < 5) { routeMarker.hidden = true; return; }
    const centerX = rect.width / 2, centerY = rect.height / 2;
    const dx = point ? point.x - centerX : zone.x - localX;
    const dy = point ? point.y - centerY : zone.z - player.z;
    routeMarker.hidden = false;
    routeMarker.style.left = `${Math.max(85, Math.min(rect.width - 85, point ? point.x : centerX + Math.sign(dx) * rect.width * .38))}px`;
    routeMarker.style.top = `${Math.max(100, Math.min(rect.height - 95, point ? point.y : centerY + Math.sign(dy) * rect.height * .35))}px`;
    routeMarker.querySelector('span').style.rotate = `${Math.atan2(dy, dx) * 180 / Math.PI + 45}deg`;
    routeName.textContent = `${zone.name} · ${distance} m`;
  }

  function update({ player, camera, activeZone, targetZone: target, yaw = 0, now = performance.now() } = {}) {
    if (target !== undefined && target !== targetZone) setTarget(target);
    if (activeZone !== undefined) setActiveZone(activeZone);
    if (player) latestPlayer = player;
    if (camera) latestCamera = camera;
    if (!latestPlayer || !latestCamera || now - lastRender < 100) return;
    lastRender = now;
    const point = mapPoint(latestPlayer.x - offsetX, latestPlayer.z, bounds);
    // These coordinates match simulator3d.js's existing 7–93% mapping.
    dot.style.left = `${7 + point.x * .86}%`;
    dot.style.top = `${7 + point.y * .86}%`;
    dot.style.rotate = `${-yaw * 180 / Math.PI}deg`;
    renderLabels(latestCamera);
    renderRoute(latestPlayer, latestCamera);
  }

  function destroy() {
    clearTimeout(bannerTimer);
    buttons.forEach(button => button.remove()); labels.forEach(label => label.remove());
    routeMarker.hidden = true; banner.hidden = true;
  }

  return { update, setTarget, setActiveZone, destroy, get activeZone() { return currentZone; }, get targetZone() { return targetZone; } };
}
