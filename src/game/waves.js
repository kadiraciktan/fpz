/**
 * game/waves.js
 * Pure wave-scaling formulas (no THREE, no DOM) so they can be unit-tested.
 * main.js consumes these to build each wave.
 */

/** Total zombies for a round (bosses are counted separately). */
export function waveCount(round) {
  return 3 + round * 2;
}

/** Round-scaled base stats for a normal zombie. */
export function waveParams(round) {
  return {
    hp: 2 + Math.floor(round / 2),
    spd: 1.5 + Math.min(round * 0.2, 3),
    dmg: 5 + round,
  };
}

/**
 * Type mix gets nastier with the round: sprinters r3+, brutes r4+, bombers r5+.
 * @param {number} round
 * @param {number} roll - random in [0, 1)
 */
export function pickEnemyType(round, roll) {
  if (round >= 5 && roll < 0.15) return 'bomber';
  if (round >= 4 && roll < 0.35) return 'brute';
  if (round >= 3 && roll < 0.6) return 'sprinter';
  return 'normal';
}

/** Every 5th round from round 5 is a boss round. */
export function isBossRound(round) {
  return round >= 5 && round % 5 === 0;
}

/** Boss count per boss round: 2 from round 15. */
export function bossCount(round) {
  return round >= 15 ? 2 : 1;
}

/** Special sprint round: every 7th round, all sprinters, no boss overlap. */
export function isSprintRound(round) {
  return round >= 7 && round % 7 === 0 && !isBossRound(round);
}

/** 0..1 music/ambience tension for the round. */
export function waveIntensity(round) {
  return Math.min(1, round / 12);
}
