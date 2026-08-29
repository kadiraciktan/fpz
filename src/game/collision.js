/**
 * game/collision.js
 * Yaw-aware circle vs oriented box (OBB) tests on the XZ plane.
 *
 * Scene props store `userData.collision.size` in LOCAL axes and put yaw on
 * `object.rotation.y`. Treating that size as a world AABB makes a 90° wall
 * occupy the wrong axis — thin fences become 5 m invisible slabs across
 * alleys, and zombies jam in "gaps" that were never actually blocked.
 */

/** World (wx, wz) → obstacle-local (lx, lz). Inverse of Three.js rotation.y. */
export function toLocalXZ(wx, wz, ox, oz, rotY) {
  const dx = wx - ox;
  const dz = wz - oz;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  // Matrix4.makeRotationY is column-major [c,0,-s / s,0,c]; inverse uses -s.
  return [dx * c - dz * s, dx * s + dz * c];
}

/** Obstacle-local (lx, lz) → world (wx, wz). Same basis as Object3D.rotation.y. */
export function toWorldXZ(lx, lz, ox, oz, rotY) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [ox + lx * c + lz * s, oz - lx * s + lz * c];
}

export function yawOf(obs) {
  return obs.rotation ? obs.rotation.y : 0;
}

/**
 * True if a circle at (px, pz) with radius `r` overlaps the obstacle's
 * XZ OBB. Low rubble (size.y <= minH) is ignored when minH is set.
 */
export function circleHitsOBB(px, pz, r, obs, minH = 0) {
  const col = obs.userData && obs.userData.collision;
  if (!col) return false;
  if (minH && col.size.y <= minH) return false;
  const [lx, lz] = toLocalXZ(px, pz, obs.position.x, obs.position.z, yawOf(obs));
  return Math.abs(lx) < col.size.x / 2 + r && Math.abs(lz) < col.size.z / 2 + r;
}

/**
 * If the circle overlaps the OBB, push it out along the smaller local
 * penetration and write the world position into `out` ({x,z}).
 * @returns {boolean} true when a correction was applied
 */
export function resolveCircleOBB(px, pz, r, obs, out) {
  const col = obs.userData && obs.userData.collision;
  if (!col) return false;
  const rotY = yawOf(obs);
  const [lx, lz] = toLocalXZ(px, pz, obs.position.x, obs.position.z, rotY);
  const hx = col.size.x / 2 + r;
  const hz = col.size.z / 2 + r;
  if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return false;
  const penX = hx - Math.abs(lx);
  const penZ = hz - Math.abs(lz);
  let nlx = lx;
  let nlz = lz;
  if (penX < penZ) nlx = lx >= 0 ? hx : -hx;
  else nlz = lz >= 0 ? hz : -hz;
  const [wx, wz] = toWorldXZ(nlx, nlz, obs.position.x, obs.position.z, rotY);
  out.x = wx;
  out.z = wz;
  return true;
}

/** True if (x, z) sits inside any tall obstacle (spawn / path queries). */
export function isBlockedAt(x, z, obstacles, r = 0.5, minH = 0.8) {
  if (!obstacles) return false;
  for (let i = 0; i < obstacles.length; i++) {
    if (circleHitsOBB(x, z, r, obstacles[i], minH)) return true;
  }
  return false;
}
