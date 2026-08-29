import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalXZ, toWorldXZ, circleHitsOBB, resolveCircleOBB, isBlockedAt,
} from '../src/game/collision.js';

function box(x, z, sx, sz, rotY = 0, sy = 2) {
  return {
    position: { x, y: 1, z },
    rotation: { y: rotY },
    userData: { collision: { size: { x: sx, y: sy, z: sz } } },
  };
}

test('toLocal / toWorld are inverses', () => {
  const [lx, lz] = toLocalXZ(4, 1, 1, 1, Math.PI / 2);
  const [wx, wz] = toWorldXZ(lx, lz, 1, 1, Math.PI / 2);
  assert.ok(Math.abs(wx - 4) < 1e-9 && Math.abs(wz - 1) < 1e-9);
});

test('axis-aligned wall still blocks along its long axis', () => {
  const wall = box(0, 0, 8, 0.8);
  assert.equal(circleHitsOBB(3, 0, 0.3, wall), true);
  assert.equal(circleHitsOBB(0, 2, 0.3, wall), false);
});

test('a 90° thin wall occupies Z, not X (the AABB bug)', () => {
  // Visual: 8 m along Z, 0.8 m along X. World-AABB of the unrotated size
  // would wrongly claim (3, 0) is inside an 8×0.8 slab on X.
  const wall = box(0, 0, 8, 0.8, Math.PI / 2);
  assert.equal(circleHitsOBB(3, 0, 0.3, wall), false, 'alley beside a N/S wall is open');
  assert.equal(circleHitsOBB(0, 3, 0.3, wall), true, 'standing on the wall is blocked');
  assert.equal(circleHitsOBB(0.9, 0, 0.2, wall), false, 'just off the thin face is free');
});

test('yaw matches Three.js makeRotationY, not the mirrored sign', () => {
  // A +0.5 rad wall's +Z face sits at world (sin, cos). The old sign error
  // put the collider on the opposite diagonal — you could walk through one
  // side of the mesh and bounce off empty air on the other.
  const yaw = 0.5;
  const wall = box(0, 0, 8, 0.8, yaw);
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  assert.equal(circleHitsOBB(0.55 * s, 0.55 * c, 0.05, wall), false, 'just outside visual +Z is free');
  assert.equal(circleHitsOBB(0.2 * s, 0.2 * c, 0.05, wall), true, 'inside visual +Z is solid');
  assert.equal(circleHitsOBB(3 * c, -3 * s, 0.05, wall), true, 'local +X end is still on the wall');
});

test('resolveCircleOBB pushes out along the thin face after a 90° rotate', () => {
  const wall = box(0, 0, 8, 0.8, Math.PI / 2);
  const out = { x: 0, z: 0 };
  assert.equal(resolveCircleOBB(0.1, 2, 0.3, wall, out), true);
  // Local Z is world -X, so the push is along X.
  assert.ok(Math.abs(out.x) >= 0.4, `expected |x|≥0.4, got ${out.x}`);
  assert.ok(Math.abs(out.z - 2) < 0.05, `should keep Z, got ${out.z}`);
});

test('isBlockedAt skips low rubble and honors rotation', () => {
  const rubble = box(0, 0, 4, 4, 0, 0.4);
  const wall = box(0, 0, 8, 0.8, Math.PI / 2, 3);
  assert.equal(isBlockedAt(0, 0, [rubble], 0.5, 0.8), false);
  assert.equal(isBlockedAt(3, 0, [wall], 0.3, 0.8), false);
  assert.equal(isBlockedAt(0, 3, [wall], 0.3, 0.8), true);
});
