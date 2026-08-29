import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIAL_AMMO, addSpecial, consumeSpecial, specialActive, burnTick, pickChainTargets, specialIcon,
} from '../src/game/ammoTypes.js';

test('three special ammo types are defined with rounds', () => {
  assert.deepEqual(Object.keys(SPECIAL_AMMO).sort(), ['dragon', 'frag', 'shock']);
  for (const def of Object.values(SPECIAL_AMMO)) {
    assert.ok(def.rounds > 0, `${def.key} has a round count`);
    assert.ok(def.icon && def.label, `${def.key} has icon + label`);
  }
});

test('addSpecial stacks matching types and replaces different ones', () => {
  assert.deepEqual(addSpecial(null, 'dragon'), { key: 'dragon', rounds: SPECIAL_AMMO.dragon.rounds });
  const first = addSpecial(null, 'shock');
  const stacked = addSpecial(first, 'shock');
  assert.equal(stacked.rounds, first.rounds * 2);
  const swapped = addSpecial(stacked, 'frag');
  assert.equal(swapped.key, 'frag');
  assert.equal(swapped.rounds, SPECIAL_AMMO.frag.rounds);
});

test('addSpecial ignores unknown keys', () => {
  assert.equal(addSpecial(null, 'nope'), null);
  const cur = addSpecial(null, 'dragon');
  assert.equal(addSpecial(cur, 'nope'), cur);
});

test('consumeSpecial decrements and clears at zero', () => {
  const a = { key: 'dragon', rounds: 2 };
  assert.deepEqual(consumeSpecial(a), { key: 'dragon', rounds: 1 });
  assert.deepEqual(consumeSpecial({ key: 'dragon', rounds: 1 }), null);
  assert.equal(consumeSpecial(null), null);
  assert.equal(consumeSpecial({ key: 'dragon', rounds: 0 }), null);
});

test('specialActive is only true with rounds left', () => {
  assert.equal(specialActive({ key: 'frag', rounds: 3 }), true);
  assert.equal(specialActive({ key: 'frag', rounds: 0 }), false);
  assert.equal(specialActive(null), false);
});

test('burnTick banks whole damage and keeps the remainder', () => {
  let acc = 0;
  let total = 0;
  for (let i = 0; i < 100; i++) {
    const r = burnTick(acc, 0.05, 2); // 0.05s * 2dps = 0.1 dmg/tick → ~10 over 100
    acc = r.acc;
    total += r.damage;
  }
  // Floating-point residue makes the exact boundary ±1; assert the band.
  assert.ok(total >= 9 && total <= 10, `total damage in [9,10], got ${total}`);
  assert.ok(acc >= 0 && acc < 1, 'leftover accumulator stays below 1');
});

test('specialIcon mirrors the active bag', () => {
  assert.equal(specialIcon({ key: 'dragon', rounds: 3 }), `${SPECIAL_AMMO.dragon.icon}3`);
  assert.equal(specialIcon(null), '');
});

test('pickChainTargets selects nearest within radius, capped', () => {
  const targets = [
    { x: 1, z: 0, ref: 'near' },
    { x: 2, z: 0, ref: 'mid' },
    { x: 10, z: 0, ref: 'far' },
    { x: 0, z: 3, ref: 'side' },
  ];
  const picks = pickChainTargets(targets, 0, 0, 3, 2);
  assert.deepEqual(picks, ['near', 'mid'], 'two nearest inside radius');
  assert.deepEqual(pickChainTargets(targets, 0, 0, 100, 2), ['near', 'mid'], 'sorted by distance');
  assert.deepEqual(pickChainTargets([], 0, 0, 5, 3), []);
});
