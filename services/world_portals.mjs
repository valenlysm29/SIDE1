// A directed threshold crossing needs no cooldown: arriving on either side,
// standing in the doorway, or walking away cannot trigger a second transfer.
export function crossedPortal(previous, next, portal) {
  if (!previous || !next || !portal) return false;
  const direction = portal.direction ?? -1;
  const before = (previous.z - portal.z) * direction;
  const after = (next.z - portal.z) * direction;
  if (!(before < 0 && after >= 0)) return false;
  const t = -before / (after - before);
  const x = previous.x + (next.x - previous.x) * t;
  return Math.abs(x - portal.x) <= (portal.halfWidth ?? 1.05);
}

export function crossedEntrance(previous, next, entrances) {
  return entrances.find(entrance => crossedPortal(previous, next, entrance.portal)) || null;
}

export const INTERIOR_EXIT = Object.freeze({ x: 0, z: 8.1, halfWidth: 1.25, direction: 1 });

export function crossedInteriorExit(previous, next) {
  return crossedPortal(previous, next, INTERIOR_EXIT);
}
