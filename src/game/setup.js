/**
 * game/setup.js
 * Main-menu deployment config (map / difficulty / attachments / skins /
 * 4-slot loadout) with localStorage persistence.
 */

import { MAPS } from '../gfx/Scene.js';
import { ATTACHMENTS, WEAPON_DEFS, DEFAULT_LOADOUT } from '../weapons/defs.js';
import { DIFFICULTIES } from './zombies.js';

export const setup = {
  mapId: 'street',
  difficulty: 'normal',
  attachments: {},
  skins: {},
};

// Attachment + skin state per weapon (all slots off / default skin),
// plus the 4-slot loadout (CoD-style: choose a weapon per slot).
for (const d of WEAPON_DEFS) {
  setup.attachments[d.name] = {};
  for (const key of Object.keys(ATTACHMENTS)) setup.attachments[d.name][key] = false;
  setup.skins[d.name] = 'default';
}
setup.loadout = [...DEFAULT_LOADOUT];

// Restore the last deployment (map / difficulty / loadout / attachments).
const SETUP_KEY = 'zombieFront.setup';
try {
  const saved = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null');
  if (saved) {
    if (MAPS.some((m) => m.id === saved.mapId)) setup.mapId = saved.mapId;
    if (DIFFICULTIES.some((d) => d.key === saved.difficulty)) setup.difficulty = saved.difficulty;
    for (const [w, v] of Object.entries(saved.attachments || {})) {
      if (setup.attachments[w]) Object.assign(setup.attachments[w], v);
    }
    for (const [w, v] of Object.entries(saved.skins || {})) {
      if (setup.skins[w]) setup.skins[w] = v;
    }
    if (Array.isArray(saved.loadout) && saved.loadout.length === 4) setup.loadout = saved.loadout;
  }
} catch { /* corrupt setup blob: defaults */ }

export function saveSetup() {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch { /* ignore */ }
}
