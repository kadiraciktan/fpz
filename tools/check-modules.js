#!/usr/bin/env node
/**
 * tools/check-modules.js
 * Static ESM import checker: every RELATIVE import specifier used anywhere
 * under src/, models/, textures/ and dev/ must resolve to a real file.
 * Catches renamed/moved modules that would only blow up in the browser.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'models', 'textures', 'dev', 'tests', 'tools'];

const IMPORT_RE = /(?:\bfrom\s+|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.js') || p.endsWith('.html')) yield p;
  }
}

const errors = [];
let checked = 0;
for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue; // bare/CDN
      checked++;
      const target = resolve(dirname(file), spec);
      if (!existsSync(target)) errors.push(`${file}: missing module '${spec}'`);
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} broken import(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`✓ all ${checked} relative imports resolve`);
