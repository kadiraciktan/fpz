import test from 'node:test';
import assert from 'node:assert/strict';
import { cellKey, cellOf, insertHash, queryHash } from '../src/game/spatial.js';

test('cellKey is unique for nearby cells and stable', () => {
  assert.equal(cellKey(0, 0), cellKey(0, 0));
  assert.notEqual(cellKey(0, 0), cellKey(1, 0));
  assert.notEqual(cellKey(0, 0), cellKey(0, 1));
  assert.notEqual(cellKey(-1, -1), cellKey(0, 0));
});

test('insert + query finds neighbours and skips distant cells', () => {
  const map = new Map();
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  insertHash(map, 0.4, 0.4, 2, a);
  insertHash(map, 1.8, 0.2, 2, b);
  insertHash(map, 20, 20, 2, c);

  const near = queryHash(map, 0, 0, 2, 1, []);
  assert.ok(near.includes(a) && near.includes(b));
  assert.ok(!near.includes(c));

  const far = queryHash(map, 20, 20, 2, 0, []);
  assert.deepEqual(far, [c]);
});

test('queryHash reuses the output array', () => {
  const map = new Map();
  insertHash(map, 0, 0, 2, 1);
  const out = [99];
  const got = queryHash(map, 0, 0, 2, 0, out);
  assert.equal(got, out);
  assert.deepEqual(out, [1]);
});

test('cellOf matches floor division of the cell size', () => {
  assert.equal(cellOf(5.9, -2.1, 2), cellKey(2, -2));
});
