/**
 * game/ammoTypes.js
 * Pure special-ammo formulas (no THREE, no DOM) so they can be unit-tested:
 * CoD-style power-up ammo mods that ride on the NORMAL guns:
 *  dragon — Dragon's Breath: ignites the hit zombie (burn damage over time)
 *  shock  — Shock Round: stuns the hit zombie and arcs to nearby ones
 *  frag   — Frag Round: mini grenade blast at the impact point
 * State is a tiny { key, rounds } bag kept by the WeaponManager; every
 * helper here is a pure function of that bag.
 */

export const SPECIAL_AMMO = {
  dragon: {
    key: 'dragon',
    label: 'EJDER NEFESİ',
    icon: '🔥',
    rounds: 10,
    burnSeconds: 4,
    burnDps: 2,
    hint: 'Yanan zombiler zamanla can kaybeder',
  },
  shock: {
    key: 'shock',
    label: 'ŞOK MERMİ',
    icon: '⚡',
    rounds: 12,
    stunSeconds: 1.3,
    chainRadius: 4,
    chainTargets: 3,
    chainDamage: 1,
    hint: 'Sersemletir, yakındakilere ark atlar',
  },
  frag: {
    key: 'frag',
    label: 'PATLAYICI MERMİ',
    icon: '💥',
    rounds: 6,
    blastRadius: 3,
    blastDamage: 4,
    hint: 'İsabet noktasında küçük patlama',
  },
};

/** Fresh grant/stack result: same type stacks rounds, another type replaces. */
export function addSpecial(current, key) {
  const def = SPECIAL_AMMO[key];
  if (!def) return current;
  if (current && current.key === key) {
    return { key, rounds: current.rounds + def.rounds };
  }
  return { key, rounds: def.rounds };
}

/** Consume one round; returns the next state (null when the bag empties). */
export function consumeSpecial(current) {
  if (!current || current.rounds <= 0) return null;
  const rounds = current.rounds - 1;
  return rounds > 0 ? { key: current.key, rounds } : null;
}

/** True when a special type rides on shots right now. */
export function specialActive(current) {
  return !!current && current.rounds > 0;
}

/**
 * Burn damage tick: accumulates fractional seconds and returns whole HP
 * chunks so the enemy never dies from float dust.
 * @returns {{ acc: number, damage: number }}
 */
export function burnTick(acc, dt, dps) {
  acc += dt * dps;
  const damage = Math.floor(acc);
  return { acc: acc - damage, damage };
}

/**
 * Shock chain picker: up to `count` nearest candidates within `radius` of
 * (x, z). `others` is an array of { x, z, ref }-ish plain objects; returns
 * the refs sorted by squared distance. Allocation-light and deterministic.
 */
export function pickChainTargets(others, x, z, radius, count) {
  const r2 = radius * radius;
  const hits = [];
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    const dx = o.x - x;
    const dz = o.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    hits.push({ ref: o.ref ?? o, d2 });
  }
  hits.sort((a, b) => a.d2 - b.d2);
  return hits.slice(0, count).map((h) => h.ref);
}

/** HUD icon for the current bag ('' when empty). */
export function specialIcon(current) {
  if (!specialActive(current)) return '';
  const def = SPECIAL_AMMO[current.key];
  return def ? `${def.icon}${current.rounds}` : '';
}
