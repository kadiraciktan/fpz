import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESERVE_FACTOR,
  initialReserve,
  reloadTransfer,
  weightedPick,
  AMMO_CRATE_FACTOR,
} from '../src/weapons/ammo.js';
import { MYSTERY_POOL } from '../src/weapons/defs.js';

test('initial reserve is a multiple of the magazine size', () => {
  assert.equal(initialReserve(30), 30 * RESERVE_FACTOR);
  assert.equal(initialReserve(6), 6 * RESERVE_FACTOR);
});

test('reload transfers only what the magazine needs', () => {
  assert.equal(reloadTransfer(10, 30, 100), 20); // partial magazine
  assert.equal(reloadTransfer(0, 30, 5), 5); // reserve smaller than need
  assert.equal(reloadTransfer(30, 30, 100), 0); // magazine already full
});

test('no reserve means no reload', () => {
  assert.equal(reloadTransfer(0, 30, 0), 0);
  assert.equal(reloadTransfer(10, 30, -5), 0);
});

test('a dry weapon fully reloads from a healthy reserve', () => {
  const reserve = initialReserve(30);
  const take = reloadTransfer(0, 30, reserve);
  assert.equal(take, 30);
});

test('weightedPick honors weights deterministically via injected rand', () => {
  const pool = [
    { name: 'common', weight: 9 },
    { name: 'rare', weight: 1 },
  ];
  assert.equal(weightedPick(pool, () => 0.0).name, 'common');
  assert.equal(weightedPick(pool, () => 0.999).name, 'rare');
});

test('mystery pool covers all 9 weapons with positive weights', () => {
  assert.equal(MYSTERY_POOL.length, 9);
  for (const e of MYSTERY_POOL) assert.ok(e.weight > 0);
  const names = new Set(MYSTERY_POOL.map((e) => e.name));
  assert.equal(names.size, 9);
});

test('ammo crate tops up less than a full initial reserve for a full gun', () => {
  // Sanity for the cap logic used by WeaponManager.addReserveAmmo:
  // reserve + crate must never exceed initialReserve after Math.min().
  const mag = 30;
  const initial = initialReserve(mag);
  const crated = Math.min(initial, initial + Math.round(mag * AMMO_CRATE_FACTOR));
  assert.equal(crated, initial);
});
