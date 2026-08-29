/**
 * game/collision.js
 * Yaw-aware circle vs oriented box (OBB) tests on the XZ plane.
 *
 * Scene props store `userData.collision.size` in LOCAL axes and put yaw on
 * `object.rotation.y`. Treating that size as a world AABB makes a 90° wall
 * occupy the wrong axis — thin fences become 5 m invisible slabs across
 * alleys, and zombies jam in "gaps" that were never actually blocked.
 */

// Scratch pairs so the hot paths (circleHitsOBB / resolveCircleOBB) never
// allocate. Pass an `out` array from your own hot loop to stay allocation-free.
const _pairA = [0, 0];
const _pairB = [0, 0];

/** World (wx, wz) → obstacle-local (lx, lz). Inverse of Three.js rotation.y. */
export function toLocalXZ(wx, wz, ox, oz, rotY, out) {
  const dx = wx - ox;
  const dz = wz - oz;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  // Matrix4.makeRotationY is column-major [c,0,-s / s,0,c]; inverse uses -s.
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  if (out) {
    out[0] = lx;
    out[1] = lz;
    return out;
  }
  return [lx, lz];
}

/** Obstacle-local (lx, lz) → world (wx, wz). Same basis as Object3D.rotation.y. */
export function toWorldXZ(lx, lz, ox, oz, rotY, out) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const wx = ox + lx * c + lz * s;
  const wz = oz - lx * s + lz * c;
  if (out) {
    out[0] = wx;
    out[1] = wz;
    return out;
  }
  return [wx, wz];
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
  const [lx, lz] = toLocalXZ(px, pz, obs.position.x, obs.position.z, yawOf(obs), _pairA);
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
  toLocalXZ(px, pz, obs.position.x, obs.position.z, rotY, _pairA);
  const lx = _pairA[0];
  const lz = _pairA[1];
  const hx = col.size.x / 2 + r;
  const hz = col.size.z / 2 + r;
  if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return false;
  const penX = hx - Math.abs(lx);
  const penZ = hz - Math.abs(lz);
  let nlx = lx;
  let nlz = lz;
  if (penX < penZ) nlx = lx >= 0 ? hx : -hx;
  else nlz = lz >= 0 ? hz : -hz;
  toWorldXZ(nlx, nlz, obs.position.x, obs.position.z, rotY, _pairB);
  out.x = _pairB[0];
  out.z = _pairB[1];
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
