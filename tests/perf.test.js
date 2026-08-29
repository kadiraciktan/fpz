import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_PRESETS, qualityByKey } from '../src/game/perf.js';

test('quality presets cover low/med/high with unique keys', () => {
  assert.deepEqual(Object.keys(QUALITY_PRESETS), ['low', 'med', 'high']);
  const keys = Object.values(QUALITY_PRESETS).map((p) => p.key);
  assert.deepEqual(keys, ['low', 'med', 'high']);
});

test('qualityByKey falls back to medium', () => {
  assert.equal(qualityByKey('nope').key, 'med');
  assert.equal(qualityByKey(undefined).key, 'med');
  assert.equal(qualityByKey('high').shadows, true);
  assert.equal(qualityByKey('low').shadows, false);
});

test('higher presets spend more pixels and a larger shadow map', () => {
  const { low, med, high } = QUALITY_PRESETS;
  assert.ok(low.pixelRatio < med.pixelRatio && med.pixelRatio < high.pixelRatio);
  assert.ok(med.shadowMap < high.shadowMap);
  assert.ok(low.shadowFollow < med.shadowFollow);
  assert.equal(high.shadowInterval, 1, 'high updates shadows every frame');
  assert.ok(med.shadowInterval > 1, 'med skips some shadow frames');
});
