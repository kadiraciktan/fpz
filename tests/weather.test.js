import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEATHER_STATES, rollWeather, weatherIntensity, lightningDelay, rainDrops, createRain,
} from '../src/game/weather.js';

test('weather states are the three expected keys', () => {
  assert.deepEqual(WEATHER_STATES, ['clear', 'rain', 'storm']);
});

test('rollWeather is clear in round 1 and returns a valid state after', () => {
  assert.equal(rollWeather(1, () => 0.99), 'clear', 'first round never storms in');
  for (const r of [2, 5, 8, 12]) {
    assert.ok(WEATHER_STATES.includes(rollWeather(r, () => 0.0)), `round ${r} low roll valid`);
    assert.ok(WEATHER_STATES.includes(rollWeather(r, () => 0.99)), `round ${r} high roll valid`);
  }
});

test('rollWeather escalates toward wet states as rounds rise', () => {
  // A mid roll that is "dry" early should become wet later (monotonic wetness).
  const early = rollWeather(2, () => 0.1);
  const late = rollWeather(20, () => 0.1);
  const wet = new Set(['rain', 'storm']);
  // Low roll always picks the wettest bucket available at that round.
  assert.ok(wet.has(late), 'late rounds with a low roll go wet');
  assert.ok(WEATHER_STATES.includes(early));
});

test('weatherIntensity maps storm>rain>clear', () => {
  assert.equal(weatherIntensity('clear'), 0);
  assert.equal(weatherIntensity('rain'), 0.55);
  assert.equal(weatherIntensity('storm'), 1);
  assert.equal(weatherIntensity('bogus'), 0);
});

test('lightningDelay only fires during a storm', () => {
  assert.equal(lightningDelay('clear'), 0);
  assert.equal(lightningDelay('rain'), 0);
  const d = lightningDelay('storm', () => 0.5);
  assert.ok(d >= 4 && d <= 12, `storm delay in range (${d})`);
});

test('rainDrops scales with quality preset', () => {
  assert.equal(rainDrops('low'), 0, 'no rain on the low preset');
  assert.ok(rainDrops('med') > 0);
  assert.ok(rainDrops('high') > rainDrops('med'));
  assert.ok(rainDrops('unknown') > 0, 'falls back to med');
});

test('createRain allocates a 2-vertex streak per drop and updates in place', () => {
  const rain = createRain(50);
  assert.ok(rain.points, 'returns a mesh');
  assert.equal(rain.points.visible, false, 'hidden until a rain state shows it');
  const pos = rain.points.geometry.attributes.position;
  assert.equal(pos.count, 100, 'two vertices per streak');
  // Update advances the fall and keeps every value finite in place.
  const before = Float32Array.from(pos.array);
  for (let i = 0; i < 20; i++) rain.update(0.016, 0, 0);
  assert.equal(pos.array.length, before.length, 'buffer reused, not reallocated');
  assert.ok(pos.array.every(Number.isFinite), 'no NaN positions leaked');
});
