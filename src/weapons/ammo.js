/**
 * weapons/ammo.js
 * Pure ammo-economy math (no THREE, no DOM) so it can be unit-tested.
 * Reserve ammo: reloading draws from a finite per-weapon reserve that is
 * refilled only by ammo-crate / MAX ammo pickups.
 */

/** A run starts with RESERVE_FACTOR full magazines per weapon. */
export const RESERVE_FACTOR = 4;

/** An ammo crate tops up AMMO_CRATE_FACTOR magazines per weapon. */
export const AMMO_CRATE_FACTOR = 1.5;

export function initialReserve(magazineSize) {
  return Math.round(magazineSize * RESERVE_FACTOR);
}

/**
 * How many rounds a reload may transfer from the reserve into the magazine.
 * Returns 0 when the magazine is full or the reserve is dry.
 */
export function reloadTransfer(ammo, magazineSize, reserve) {
  const need = magazineSize - ammo;
  if (need <= 0 || reserve <= 0) return 0;
  return Math.min(need, Math.floor(reserve));
}

/**
 * Weighted random pick.
 * @param {Array<{ weight: number }>} entries - item objects carrying a weight
 * @param {() => number} [rand]
 */
export function weightedPick(entries, rand = Math.random) {
  let total = 0;
  for (const e of entries) total += e.weight;
  let r = rand() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}
