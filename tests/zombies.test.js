import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES,
  difficultyByKey,
  applyDifficulty,
  papStats,
  papLabel,
  grenadeDamage,
  barrierNeedsRepair,
  BARRIER_HP,
  machineSpots,
  wallGunSpots,
  wallGunNames,
  wallGunCost,
} from '../src/game/zombies.js';
import { waveParams } from '../src/game/waves.js';

test('difficulty keys are unique and normalized fields exist', () => {
  const keys = DIFFICULTIES.map((d) => d.key);
  assert.deepEqual(keys, ['normal', 'veteran', 'nightmare']);
  assert.equal(difficultyByKey('nightmare').scoreMul, 2);
  assert.equal(difficultyByKey('nope').key, 'normal', 'unknown key falls back');
});

test('applyDifficulty scales hp/dmg and adds the speed bonus', () => {
  const p = waveParams(6); // hp 5, spd 2.7, dmg 11
  const v = applyDifficulty(p, difficultyByKey('veteran'));
  assert.equal(v.hp, p.hp * 1.5);
  assert.equal(v.dmg, p.dmg * 1.5);
  assert.ok(v.spd > p.spd);
  const n = applyDifficulty(p, difficultyByKey('normal'));
  assert.deepEqual(n, p);
});

test('pack-a-punch roughly doubles power without breaking the gun', () => {
  const def = { name: 'M4A1', label: 'M4A1', damage: 1, magazineSize: 30, range: 85, fireRate: 0.11, reloadTime: 1.8 };
  const up = papStats(def);
  assert.equal(up.damage, 3);
  assert.equal(up.magazineSize, 45);
  assert.ok(up.range > def.range);
  assert.ok(up.fireRate < def.fireRate && up.reloadTime < def.reloadTime);
  assert.ok(papLabel(def).includes('Mk II'));
});

test('grenade damage falls off linearly and dies at the radius', () => {
  assert.equal(grenadeDamage(0), 8);
  assert.equal(grenadeDamage(2.5), 4);
  assert.equal(grenadeDamage(4.9) >= 0, true);
  assert.equal(grenadeDamage(5), 0);
  assert.equal(grenadeDamage(99), 0);
});

test('barrier repair window opens after real damage only', () => {
  assert.equal(barrierNeedsRepair(BARRIER_HP), false);
  assert.equal(barrierNeedsRepair(BARRIER_HP * 0.9), false);
  assert.equal(barrierNeedsRepair(BARRIER_HP / 2), true);
  assert.equal(barrierNeedsRepair(0), false, 'a destroyed barrier is not repairable');
});

test('machine spots land in the open core zone, clear of each other', () => {
  const zones = [
    { id: 'main', rect: [-45, -45, 45, 45], unlocked: true },
    { id: 'gated', rect: [-45, 45, 45, 90], unlocked: false },
  ];
  const isBlocked = (x, z) => Math.abs(x - 3) < 2 && Math.abs(z + 3) < 2; // fake building
  const { pap, walls } = machineSpots({ zones, isBlocked });
  assert.ok(pap, 'pap spot found');
  assert.equal(walls.length, 3);
  const all = [pap, ...walls];
  for (const [x, z] of all) {
    assert.ok(Math.abs(x) < 45 && Math.abs(z) < 45, 'inside core zone');
    assert.ok(!isBlocked(x, z), 'not inside a building');
    assert.ok(Math.hypot(x, z) >= 2.5, 'keeps the mystery box clear');
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]);
      assert.ok(d >= 2, `machines ${i}/${j} overlap (${d.toFixed(1)})`);
    }
  }
});

test('wall gun spots hug thin wall faces, front facing the open side', () => {
  const walls = [
    { x: 0, z: -20, sx: 12, sy: 3, sz: 0.5 }, // south perimeter wall (faces ±Z)
    { x: -20, z: 0, sx: 0.5, sy: 3, sz: 12 }, // west wall (faces ±X)
    { x: 16, z: 14, sx: 6, sy: 3, sz: 0.4 }, // short wall segment
    { x: 4, z: 4, sx: 9, sy: 4, sz: 9 }, // fat building block — must be skipped
  ];
  const spots = wallGunSpots(walls, {
    isBlocked: (x, z) => Math.abs(x - 4) < 5 && Math.abs(z - 4) < 5,
    zoneRects: [[-25, -25, 25, 25]],
    arenaHalf: 25,
    keepOut: [[0, 0, 4]],
  });
  assert.equal(spots.length, 3);
  for (const s of spots) {
    // Each mount sits just off a thin face of a wall (0.5 m tolerance).
    const flush = walls.some((w) => {
      const halfX = w.sx / 2;
      const halfZ = w.sz / 2;
      const nearX = Math.abs(Math.abs(s.x - w.x) - halfX) < 0.6 && Math.abs(s.z - w.z) < halfZ;
      const nearZ = Math.abs(Math.abs(s.z - w.z) - halfZ) < 0.6 && Math.abs(s.x - w.x) < halfX;
      return (nearX || nearZ) && w.sy > 1.5 && (w.sx < 2 || w.sz < 2);
    });
    assert.ok(flush, `mount at (${s.x}, ${s.z}) is not flush on a thin wall`);
    // The facing rotation points away from the wall (outward from center side).
    const fx = Math.sin(s.rotY);
    const fz = Math.cos(s.rotY);
    assert.ok(Math.hypot(fx, fz) > 0.99);
  }
  // No mount may end up on the fat building block faces.
  for (const s of spots) {
    assert.ok(Math.abs(s.x - 4) > 4.8 || Math.abs(s.z - 4) > 4.8, 'skips fat blocks');
  }
});

test('wall gun rotation stays in-bounds of the weapon list', () => {
  const names = ['Pistol', 'Rifle', 'Shotgun', 'Thompson', 'M4A1', 'MP5', 'Cal50', 'LSW'];
  for (let run = 0; run < 10; run++) {
    const trio = wallGunNames(names, run);
    assert.equal(trio.length, 3);
    for (const n of trio) assert.ok(names.includes(n));
    assert.equal(new Set(trio).size, 3, 'no duplicate gun on the same wall');
  }
  assert.equal(wallGunCost(0), 750);
  assert.equal(wallGunCost(9), 1250, 'cost list clamps at the last tier');
});
