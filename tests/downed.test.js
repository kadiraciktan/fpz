import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOWNED_DURATION, DOWNED_KILL_BONUS, DOWNED_REVIVE_HP, DOWNED_SPEED_MUL, DOWNED_EYE,
  DOWNED_BITE_BLEED, extendDowned, downedBar,
  CARPET_BOMBS, CARPET_DURATION, CARPET_MIN_R, CARPET_MAX_R, CARPET_BLAST_RADIUS,
} from '../src/game/zombies.js';

test('downed constants are sane', () => {
  assert.ok(DOWNED_DURATION > 0 && DOWNED_DURATION <= 30);
  assert.ok(DOWNED_KILL_BONUS > 0);
  assert.ok(DOWNED_REVIVE_HP > 0 && DOWNED_REVIVE_HP <= 100);
  assert.ok(DOWNED_SPEED_MUL > 0 && DOWNED_SPEED_MUL < 1);
  assert.ok(DOWNED_EYE > 0 && DOWNED_EYE < 1.6, 'downed eye height below standing');
});

test('extendDowned adds the kill bonus but caps at the max', () => {
  assert.equal(extendDowned(5), Math.min(DOWNED_DURATION, 5 + DOWNED_KILL_BONUS));
  assert.equal(extendDowned(DOWNED_DURATION), DOWNED_DURATION, 'no overflow past the bar');
  assert.equal(extendDowned(DOWNED_DURATION - 0.1), DOWNED_DURATION, 'clamped');
});

test('downedBar is a 0..1 fraction of remaining bleed-out', () => {
  assert.equal(downedBar(DOWNED_DURATION), 1);
  assert.equal(downedBar(0), 0);
  assert.equal(downedBar(DOWNED_DURATION / 2), 0.5);
  assert.equal(downedBar(-5), 0, 'negative clamps to 0');
});

test('DOWNED_BITE_BLEED is a positive seconds-per-damage drain', () => {
  assert.ok(DOWNED_BITE_BLEED > 0);
});

test('carpet bombing constants form a valid spread', () => {
  assert.ok(CARPET_BOMBS >= 4);
  assert.ok(CARPET_DURATION > 0);
  assert.ok(CARPET_MIN_R < CARPET_MAX_R, 'min ring inside max ring');
  assert.ok(CARPET_MIN_R > 0, 'keeps the first bomb off the player');
  assert.ok(CARPET_BLAST_RADIUS > 0);
});
