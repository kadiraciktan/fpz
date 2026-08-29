/**
 * game/zombies.js
 * Pure game-system formulas (no THREE, no DOM) so they can be unit-tested:
 * difficulty modes, Pack-a-Punch stat boosts, grenade falloff, barrier
 * breach thresholds and the special-machine placement solver (wall guns +
 * Pack-a-Punch share the open core zone, never overlapping each other).
 */

// ════════════════════════ DIFFICULTY MODES ════════════════════════

export const DIFFICULTIES = [
  {
    key: 'normal',
    label: 'NEFER',
    icon: '🎖️',
    desc: 'Standart deneyim — zombiler tanıdık hız ve dayanıklılıkta.',
    hpMul: 1,
    dmgMul: 1,
    spdBonus: 0,
    scoreMul: 1,
    color: '#8bc34a',
  },
  {
    key: 'veteran',
    label: 'VETERAN',
    icon: '🔥',
    desc: '%50 daha dayanıklı, %50 daha vurdulu zombiler — puan x1.5.',
    hpMul: 1.5,
    dmgMul: 1.5,
    spdBonus: 0.5,
    scoreMul: 1.5,
    color: '#fb8c00',
  },
  {
    key: 'nightmare',
    label: 'KÂBUS',
    icon: '💀',
    desc: 'x2 can, x2 hasarı, +1 m/sn — puan x2. Sadece en cesurlar.',
    hpMul: 2,
    dmgMul: 2,
    spdBonus: 1,
    scoreMul: 2,
    color: '#e53935',
  },
];

/** Look up a difficulty by key (falls back to NEFER). */
export function difficultyByKey(key) {
  return DIFFICULTIES.find((d) => d.key === key) || DIFFICULTIES[0];
}

/** Scale a waveParams() result by the difficulty multipliers. */
export function applyDifficulty(params, diff) {
  return {
    hp: params.hp * (diff.hpMul ?? 1),
    spd: params.spd + (diff.spdBonus ?? 0),
    dmg: params.dmg * (diff.dmgMul ?? 1),
  };
}

// ════════════════════════ PACK-A-PUNCH ════════════════════════

export const PAP_COST = 5000;

/** Upgrade multipliers applied to a weapon def when Pack-a-Punched. */
export function papStats(def) {
  return {
    damage: def.damage * 2 + 1,
    magazineSize: Math.round(def.magazineSize * 1.5),
    range: Math.round(def.range * 1.15),
    fireRate: def.fireRate * 0.9,
    reloadTime: def.reloadTime * 0.85,
  };
}

/** Pack-a-Punch weapon display name (unique so HUD/labels change). */
export function papLabel(def) {
  return `★ ${def.label} Mk II`;
}

// ════════════════════════ GRENADES ════════════════════════

/** Linear damage falloff: full at the blast center, 0 at the radius edge. */
export function grenadeDamage(distance, radius = 5, max = 8) {
  if (distance >= radius) return 0;
  return Math.max(0, Math.round(max * (1 - distance / radius)));
}

/** Fuse + bounce window of a thrown frag before it detonates (seconds). */
export const GRENADE_FUSE = 1.6;

// ════════════════════════ BARRIER BREACH ════════════════════════

/** HP of an OPENED barrier's improvised barricade (zombies chew it back shut). */
export const BARRIER_HP = 240;

/** Rate at which one zombie tears an opened barrier apart (HP/s). */
export const BARRIER_CHEW_RATE = 9;

/** Points to patch a half-torn barrier back up before it reseals. */
export const BARRIER_REPAIR_COST = 150;

/** True when the barrier has taken damage but is not gone yet (repairable). */
export function barrierNeedsRepair(hp) {
  return hp < BARRIER_HP * 0.85 && hp > 0;
}

// ════════════════════════ SPECIAL MACHINE SPOTS ════════════════════════

const WALL_GUN_COUNT = 3;
const WALL_GUN_COSTS = [750, 1000, 1250];
const PAP_CLEAR = 5.5;
const GUN_CLEAR = 3.5;

/**
 * Pick ground spots for the wall guns and the Pack-a-Punch machine inside
 * the unlocked core zone. `isBlocked(x, z)` answers whether the point sits
 * inside static geometry. Deterministic scan (no RNG) so it is testable:
 * rings of increasing radius around the map center, clockwise offsets.
 *
 * @param {number} [spin] - ring rotation (rad) so spots shift between runs
 * @returns {{ pap: [x, z] | null, walls: Array<[x, z]> }}
 */
export function machineSpots({ zones, isBlocked, wallCount = WALL_GUN_COUNT, minDist = 2, centerKeepout = 2.5, spin = 0 }) {
  const core = zones.find((z) => z.unlocked) || zones[0];
  if (!core) return { pap: null, walls: [] };
  const [minX, minZ, maxX, maxZ] = core.rect;
  const taken = [];

  const inZone = (x, z) => x >= minX + 1.5 && x <= maxX - 1.5 && z >= minZ + 1.5 && z <= maxZ - 1.5;
  const free = (x, z, keepout) => {
    if (!inZone(x, z) || isBlocked(x, z)) return false;
    if (Math.hypot(x, z) < centerKeepout) return false;
    return !taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < keepout);
  };

  const candidates = [];
  for (let ring = 6; ring <= 26; ring += 2.5) {
    const n = Math.max(10, Math.round(ring * 2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + spin;
      candidates.push([Math.cos(a) * ring, Math.sin(a) * ring]);
    }
  }

  const take = (keepout, clear) => {
    for (const [x, z] of candidates) {
      if (free(x, z, clear)) {
        taken.push([x, z]);
        return [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
      }
    }
    return null;
  };

  // The Pack-a-Punch claims its lonely corner first (it must stay 5.5 m clear).
  const pap = take(minDist, PAP_CLEAR);
  const walls = [];
  for (let i = 0; i < wallCount; i++) walls.push(take(minDist, GUN_CLEAR));
  return { pap, walls: walls.filter(Boolean) };
}

/**
 * Mount spots flush on wall faces (the CoD "wall buy" look). Scans solid
 * obstacles for tall, THIN faces (perimeter walls & building facades — fat
 * blocks are skipped), and returns the mount position + Y rotation so the
 * mount's front (+Z) faces the player standing off the wall.
 *
 * @param {Array<{x:number,z:number,sx:number,sy:number,sz:number}>} obstacles
 * @returns {Array<{x:number,z:number,rotY:number}>} up to `count` spots
 */
export function wallGunSpots(obstacles, {
  isBlocked, zoneRects, arenaHalf = 45, count = 3, keepOut = [], spacing = 9,
} = {}) {
  const inZone = (x, z) => zoneRects.some(
    ([minX, minZ, maxX, maxZ]) => x > minX - 1 && x < maxX + 1 && z > minZ - 1 && z < maxZ + 1
  );
  const clear = (x, z) => keepOut.every(([kx, kz, r]) => Math.hypot(x - kx, z - kz) >= r);

  const cand = [];
  for (const o of obstacles) {
    if (o.sy < 1.8) continue; // needs a real wall height
    const thinZ = o.sx >= o.sz; // mount on the WIDE face: normal along the thin axis
    const half = (thinZ ? o.sz : o.sx) / 2;
    const long = thinZ ? o.sx : o.sz;
    if (half > 1.6 || long < 2.5) continue; // fat block or stub — no mount room
    const nx = thinZ ? 0 : 1;
    const nz = thinZ ? 1 : 0;
    for (const s of [1, -1]) {
      const dx = nx * s;
      const dz = nz * s;
      const mx = o.x + dx * (half + 0.18);
      const mz = o.z + dz * (half + 0.18);
      const sxp = o.x + dx * (half + 1.0); // where the player stands to buy
      const szp = o.z + dz * (half + 1.0);
      if (Math.abs(mx) > arenaHalf + 1.5 || Math.abs(mz) > arenaHalf + 1.5) continue;
      if (Math.abs(sxp) > arenaHalf - 0.5 || Math.abs(szp) > arenaHalf - 0.5) continue;
      if (!inZone(sxp, szp) || isBlocked(sxp, szp)) continue;
      if (!clear(mx, mz) || !clear(sxp, szp)) continue;
      const d = Math.hypot(mx, mz);
      if (d < 4 || d > arenaHalf + 5) continue;
      cand.push({ x: mx, z: mz, rotY: Math.atan2(dx, dz), score: Math.abs(d - 15) });
    }
  }
  // Prefer mid-distance walls, then spread the mounts apart — the spacing
  // requirement relaxes per pass so maps with sparse walls still fill all
  // three mounts instead of dropping down to floor spots.
  cand.sort((a, b) => a.score - b.score);
  const out = [];
  for (const sp of [spacing, 5.5, 3.5]) {
    for (const c of cand) {
      if (out.length >= count) break;
      if (out.includes(c)) continue;
      if (out.every((p) => Math.hypot(p.x - c.x, p.z - c.z) >= sp)) out.push(c);
    }
    if (out.length >= count) break;
  }
  return out;
}

/** Weapon names offered on the three wall mounts, per run (box gun excluded
 *  from being boring: the trio is drawn in a stable rotation). */
export function wallGunNames(allNames, runIndex = 0) {
  const out = [];
  for (let i = 0; i < WALL_GUN_COUNT; i++) {
    out.push(allNames[(runIndex + 1 + i * 2) % allNames.length]);
  }
  return out;
}

/** Price for the i-th wall mount (left to right gets pricier). */
export function wallGunCost(index) {
  return WALL_GUN_COSTS[Math.min(index, WALL_GUN_COSTS.length - 1)];
}

// ════════════════════════ DOWNED / LAST STAND ════════════════════════

/** Bleed-out seconds once the player is downed (crawling, not dead yet). */
export const DOWNED_DURATION = 12;

/** Seconds the bleed-out bar grows for every kill scored while downed. */
export const DOWNED_KILL_BONUS = 1.5;

/** HP restored when the player survives the whole bleed-out and stands up. */
export const DOWNED_REVIVE_HP = 40;

/** Move-speed multiplier while crawling (downed). */
export const DOWNED_SPEED_MUL = 0.32;

/** Camera eye height (m) while downed — the view drops to the floor. */
export const DOWNED_EYE = 0.55;

/** Fraction of the bleed-out bar each incoming zombie bite eats. */
export const DOWNED_BITE_BLEED = 0.3;

/** Cap the kill bonus so one wave-clear can't top the bar up forever. */
export function extendDowned(remaining, max = DOWNED_DURATION) {
  return Math.min(max, remaining + DOWNED_KILL_BONUS);
}

/** 0..1 bleed-out bar for the HUD. */
export function downedBar(remaining) {
  return Math.max(0, Math.min(1, remaining / DOWNED_DURATION));
}

// ════════════════════════ CARPET BOMBING ════════════════════════

/** Power-up: bombs the sky drops, spread and fallout (all reused FX). */
export const CARPET_BOMBS = 12;
export const CARPET_DURATION = 2.2; // seconds the run lasts
export const CARPET_MIN_R = 3; // keep the first ring off the player
export const CARPET_MAX_R = 16;
export const CARPET_BLAST_RADIUS = 5;
export const CARPET_BLAST_DAMAGE = 10;
