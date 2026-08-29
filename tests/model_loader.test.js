import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTexture } from '../src/gfx/ModelLoader.js';
import { zombieTexture } from '../textures/zombie.js';
import { hudRoundTexture } from '../textures/hud-round.js';

test('buildTexture: valid texture', () => {
  const tex = {
    size: 2,
    palette: { '.': '#000000', 'd': '#111111' },
    pixels: ['..', 'dd'],
  };
  const out = buildTexture(tex);
  assert.equal(out.width, 2);
  assert.equal(out.height, 2);
  // RGBA buffer is fully populated
  assert.equal(out.image.data.length, 2 * 2 * 4);
});

test('buildTexture: missing palette throws', () => {
  const tex = {
    size: 2,
    pixels: ['..', 'dd'],
  };
  assert.throws(() => buildTexture(tex), /palette/i);
});

test('buildTexture: missing row throws', () => {
  const tex = {
    size: 2,
    palette: { '.': '#000000', 'd': '#111111' },
    pixels: ['..'],
  };
  assert.throws(() => buildTexture(tex), /pixels|row/i);
});

test('zombie texture: 16x16 with valid palette', () => {
  assert.equal(zombieTexture.size, 16);
  assert.equal(zombieTexture.pixels.length, 16);
  for (const row of zombieTexture.pixels) {
    assert.equal(row.length, 16);
    for (const ch of row) {
      assert.ok(zombieTexture.palette[ch], `unknown char '${ch}'`);
    }
  }
});

test('hud-round texture: 16x16 with valid palette', () => {
  assert.equal(hudRoundTexture.size, 16);
  assert.equal(hudRoundTexture.pixels.length, 16);
  for (const row of hudRoundTexture.pixels) {
    assert.equal(row.length, 16);
    for (const ch of row) {
      assert.ok(hudRoundTexture.palette[ch], `unknown char '${ch}'`);
    }
  }
});
