import test from 'node:test';
import assert from 'node:assert/strict';
import {
  waveCount,
  waveParams,
  pickEnemyType,
  isBossRound,
  bossCount,
  isSprintRound,
  isHeadcrabRound,
  headcrabChance,
  waveIntensity,
} from '../src/game/waves.js';

test('waveCount grows linearly with the round', () => {
  assert.equal(waveCount(1), 6);
  assert.equal(waveCount(2), 9);
  assert.equal(waveCount(10), 28);
  const a = waveCount(1);
  const b = waveCount(2);
  const c = waveCount(10);
  assert.ok(a < b && b < c, 'monotonic');
});

test('waveParams scale hp, speed and damage monotonically', () => {
  const a = waveParams(1);
  const b = waveParams(5);
  const c = waveParams(20);
  assert.ok(b.hp > a.hp && c.hp > b.hp);
  assert.ok(b.spd > a.spd);
  assert.ok(c.spd <= 4.5, 'speed must cap at 1.5 + 3');
  assert.ok(b.dmg > a.dmg && c.dmg > b.dmg);
});

test('type mix unlocks sprinters r3, brutes r4, bombers r5', () => {
  assert.equal(pickEnemyType(1, 0.0), 'normal'); // even the best roll is plain
  assert.equal(pickEnemyType(3, 0.5), 'sprinter');
  assert.equal(pickEnemyType(3, 0.7), 'normal');
  assert.equal(pickEnemyType(4, 0.2), 'brute');
  assert.equal(pickEnemyType(5, 0.1), 'bomber');
  assert.equal(pickEnemyType(4, 0.1), 'brute', 'no bombers below round 5');
});

test('boss rounds every 5th from round 5, double from 15', () => {
  assert.equal(isBossRound(1), false);
  assert.equal(isBossRound(4), false);
  assert.equal(isBossRound(5), true);
  assert.equal(isBossRound(10), true);
  assert.equal(bossCount(5), 1);
  assert.equal(bossCount(14), 1);
  assert.equal(bossCount(15), 2);
});

test('sprint rounds never collide with boss rounds', () => {
  assert.equal(isSprintRound(7), true);
  assert.equal(isSprintRound(14), true);
  assert.equal(isSprintRound(35), false, '35 is both 5th and 7th multiple: boss wins');
  assert.equal(isSprintRound(6), false);
});

test('wave intensity ramps to 1 by round 12 and clamps', () => {
  assert.equal(waveIntensity(6), 0.5);
  assert.equal(waveIntensity(12), 1);
  assert.equal(waveIntensity(50), 1);
});

test('headcrab incursions every 4th round from 4, no boss/sprint clash', () => {
  assert.equal(isHeadcrabRound(3), false);
  assert.equal(isHeadcrabRound(4), true);
  assert.equal(isHeadcrabRound(6), false);
  assert.equal(isHeadcrabRound(8), true);
  assert.equal(isHeadcrabRound(20), false, '20 is a boss round');
  assert.equal(isHeadcrabRound(28), false, '28 is a sprint round');
  assert.equal(headcrabChance(4), 0.29);
  assert.equal(headcrabChance(7), 0, 'no crabs outside incursion rounds');
  assert.ok(headcrabChance(12) > headcrabChance(4), 'crab share grows with the round');
  assert.ok(headcrabChance(500) <= 0.45, 'crab share caps at 0.45');
});
