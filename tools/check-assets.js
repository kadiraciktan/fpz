#!/usr/bin/env node
/**
 * tools/check-assets.js
 * Validates all model + texture definitions in the project.
 *
 * Usage: node tools/check-assets.js
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Texture validation ─────────────────────────────────────────────
export function validateTexture(tex, label = 'texture') {
  const errors = [];
  if (!tex || !tex.size || !tex.palette || !Array.isArray(tex.pixels)) {
    return [`${label}: missing required fields (size, palette, pixels)`];
  }
  const { size, palette, pixels } = tex;
  if (!Number.isInteger(size) || size <= 0) {
    errors.push(`${label}: size must be a positive integer, got ${size}`);
    return errors;
  }
  if (pixels.length !== size) {
    errors.push(`${label}: expected ${size} pixel rows, got ${pixels.length}`);
  }
  for (let y = 0; y < pixels.length; y++) {
    const row = pixels[y];
    if (typeof row !== 'string') {
      errors.push(`${label}: row ${y} is not a string`);
      continue;
    }
    if (row.length !== size) {
      errors.push(`${label}: row ${y} has length ${row.length}, expected ${size}`);
    }
    for (let x = 0; x < row.length; x++) {
      if (!(row[x] in palette)) {
        errors.push(`${label}: row ${y} col ${x} uses unknown palette char '${row[x]}'`);
      }
    }
  }
  for (const [ch, hex] of Object.entries(palette)) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      errors.push(`${label}: palette['${ch}'] = '${hex}' is not a valid #RRGGBB color`);
    }
  }
  return errors;
}

// ── Model validation ───────────────────────────────────────────────
const VALID_FACES = ['east', 'west', 'up', 'down', 'south', 'north'];

export function validateModel(model, label = 'model', texSize = 32) {
  const errors = [];
  if (!model || !Array.isArray(model.elements) || model.elements.length === 0) {
    errors.push(`${label}: must have a non-empty 'elements' array`);
    return errors;
  }
  const seen = new Set();
  for (const el of model.elements) {
    const lbl = `${label}: element '${el.name || 'unnamed'}'`;
    if (!el.name) {
      errors.push(`${lbl}: missing name`);
    } else if (seen.has(el.name)) {
      errors.push(`${lbl}: duplicate element name '${el.name}'`);
    } else {
      seen.add(el.name);
    }
    if (!Array.isArray(el.from) || el.from.length !== 3 ||
        !Array.isArray(el.to) || el.to.length !== 3) {
      errors.push(`${lbl}: 'from' and 'to' must be [x,y,z] arrays`);
      continue;
    }
    for (const [i, coord] of el.from.concat(el.to).entries()) {
      if (typeof coord !== 'number' || !Number.isFinite(coord)) {
        errors.push(`${lbl}: coordinate at index ${i % 3} of ${i < 3 ? 'from' : 'to'} is not finite`);
      }
    }
    const w = el.to[0] - el.from[0];
    const h = el.to[1] - el.from[1];
    const d = el.to[2] - el.from[2];
    if (w <= 0 || h <= 0 || d <= 0) {
      errors.push(`${lbl}: element has non-positive dimensions (${w}, ${h}, ${d})`);
    }
    if (el.pivot && (el.pivot.length !== 3 || el.pivot.some((v) => typeof v !== 'number'))) {
      errors.push(`${lbl}: 'pivot' must be a [x,y,z] array of numbers`);
    }
    if (el.faces) {
      for (const [faceName, face] of Object.entries(el.faces)) {
        if (!VALID_FACES.includes(faceName)) {
          errors.push(`${lbl}: unknown face '${faceName}' (valid: ${VALID_FACES.join(', ')})`);
        }
        if (face && face.uv) {
          const [u0, v0, u1, v1] = face.uv;
          if (![u0, v0, u1, v1].every((n) => Number.isFinite(n))) {
            errors.push(`${lbl}.${faceName}: uv contains non-numeric values`);
          } else if (Math.min(u0, u1) < 0 || Math.max(u0, u1) > texSize ||
                     Math.min(v0, v1) < 0 || Math.max(v0, v1) > texSize) {
            errors.push(`${lbl}.${faceName}: uv [${u0},${v0},${u1},${v1}] out of range 0..${texSize}`);
          }
        }
      }
    }
  }
  return errors;
}

// ── CLI ──────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href;

if (isMain) {
  const texDir = join(ROOT, 'textures');
  const modelDir = join(ROOT, 'models');

  let allErrors = [];

  // Validate every texture
  const texFiles = readdirSync(texDir).filter((f) => f.endsWith('.js'));
  for (const file of texFiles) {
    const mod = await import(join(texDir, file));
    for (const [key, tex] of Object.entries(mod)) {
      if (tex && tex.pixels && tex.palette) {
        const errors = validateTexture(tex, file);
        allErrors.push(...errors);
        if (errors.length === 0) console.log(`  ✓ ${file} → ${key} (${tex.size}x${tex.size})`);
        else errors.forEach((e) => console.error(`  ✗ ${e}`));
      }
    }
  }

  // Validate every model against its texture size
  const MODEL_TEX_SIZE = {
    'pistol.js': 32, 'rifle.js': 32, 'shotgun.js': 32,
    'm4a1.js': 32, 'mp5.js': 32, 'cal50.js': 32, 'lsw.js': 32,
    'thompson.js': 32, 'zombie.js': 16, 'headcrab.js': 16, 'streetlamp.js': 16,
  };
  const modelFiles = readdirSync(modelDir).filter((f) => f.endsWith('.js'));
  for (const file of modelFiles) {
    const mod = await import(join(modelDir, file));
    for (const [key, model] of Object.entries(mod)) {
      if (!model || !model.elements) continue;
      const texSize = MODEL_TEX_SIZE[file] || 16;
      const errors = validateModel(model, `${file} → ${key}`, texSize);
      allErrors.push(...errors);
      if (errors.length === 0) console.log(`  ✓ ${file} → ${key} (${model.elements.length} parts)`);
      else errors.forEach((e) => console.error(`  ✗ ${e}`));
    }
  }

  if (allErrors.length > 0) {
    console.error(`\n❌ ${allErrors.length} error(s) found`);
    process.exit(1);
  } else {
    console.log('\nAll assets valid ✓');
  }
}
