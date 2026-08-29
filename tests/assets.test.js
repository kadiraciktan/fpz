import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTexture, validateModel } from '../tools/check-assets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const texDir = join(ROOT, 'textures');
const modelDir = join(ROOT, 'models');

const MODEL_TEX_SIZE = {
  pistol: 32,
  rifle: 32,
  shotgun: 32,
  thompson: 32,
  m4a1: 32,
  mp5: 32,
  cal50: 32,
  lsw: 32,
  zombie: 16,
  headcrab: 16,
  streetlamp: 16,
};

test('all textures in textures/ are valid', async () => {
  const files = readdirSync(texDir).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0, 'no texture files found');
  for (const file of files) {
    const mod = await import(join(texDir, file));
    for (const [name, tex] of Object.entries(mod)) {
      if (!tex || !tex.pixels || !tex.palette) continue;
      const errors = validateTexture(tex, file);
      assert.deepEqual(errors, [], `${file} (${name}): ${errors.join('; ')}`);
    }
  }
});

test('all models in models/ are valid and reference valid faces/UVs', async () => {
  const files = readdirSync(modelDir).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0, 'no model files found');
  for (const file of files) {
    const mod = await import(join(modelDir, file));
    for (const [name, model] of Object.entries(mod)) {
      if (!model || !Array.isArray(model.elements)) continue;
      const texSize = MODEL_TEX_SIZE[file.replace(/\.js$/, '')] || 16;
      const errors = validateModel(model, `${file}:${name}`, texSize);
      assert.deepEqual(errors, [], `${file} (${name}): ${errors.join('; ')}`);
    }
  }
});

test('zombie model exposes animatable part names', async () => {
  const { zombieModel } = await import('../models/zombie.js');
  const names = zombieModel.elements.map((e) => e.name);
  for (const required of ['body', 'head', 'armL', 'armR']) {
    assert.ok(names.includes(required), `zombie model missing part '${required}'`);
  }
  assert.ok(zombieModel.anims.walk, 'zombie model should define a walk anim');
  assert.ok(zombieModel.anims.death, 'zombie model should define a death anim');
});

test('headcrab model exposes animatable part names and hop clip', async () => {
  const { headcrabModel } = await import('../models/headcrab.js');
  const names = headcrabModel.elements.map((e) => e.name);
  for (const required of ['shell', 'head', 'legL', 'legR', 'armL', 'armR']) {
    assert.ok(names.includes(required), `headcrab model missing part '${required}'`);
  }
  for (const clip of ['idle', 'walk', 'hop', 'attack', 'death']) {
    assert.ok(headcrabModel.anims[clip], `headcrab model missing '${clip}' anim`);
  }
});
