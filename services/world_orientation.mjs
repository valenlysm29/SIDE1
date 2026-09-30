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
      .filter(item => item.point && item.point.distance < 145)
      .sort((a, b) => a.point.distance - b.point.distance);
    const occupied = [];
    labels.forEach(label => { label.hidden = true; });
    for (const { zone, point } of candidates) {
      const label = labels.get(zone.id);
      // The CSS minimum size is used before first paint, so collision checks
      // are stable when a label has previously been hidden.
      const width = Math.max(98, label.offsetWidth || 98);
      const height = Math.max(26, label.offsetHeight || 26);
      const box = { left: point.x - width / 2, right: point.x + width / 2, top: point.y - height / 2, bottom: point.y + height / 2 };
      if (occupied.some(other => box.left < other.right + 7 && box.right > other.left - 7 && box.top < other.bottom + 7 && box.bottom > other.top - 7)) continue;
      occupied.push(box);
      label.style.left = `${point.x}px`; label.style.top = `${point.y}px`;
      label.style.setProperty('--distance-scale', String(Math.max(.85, Math.min(1.14, 32 / Math.max(28, point.distance)))));
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
