/**
 * game/progress.js
 * Persistent progression: XP unlocks + lifetime stats (localStorage),
 * plus attachment unlock tracking driven by total XP.
 */

import { ATTACHMENTS } from '../weapons/defs.js';
import { showToast } from '../ui/toast.js';

const XP_KEY = 'zombieFront.xp';
const STATS_KEY = 'zombieFront.stats';

export const ATTACH_UNLOCKED = new Set();
export let totalXp = 0;
export let stats = { kills: 0, headshots: 0, bestRound: 0, bestScore: 0, runs: 0, bestRuns: {} };

export function loadProgress() {
  try {
    totalXp = Number(localStorage.getItem(XP_KEY)) || 0;
    stats = { ...stats, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
  } catch { /* private mode / corrupt data: start fresh */ }
  for (const [key, meta] of Object.entries(ATTACHMENTS)) {
    if (totalXp >= (meta.xp || 0)) ATTACH_UNLOCKED.add(key);
  }
}

export function saveProgress() {
  try {
    localStorage.setItem(XP_KEY, String(totalXp));
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

/** Award XP and toast newly-unlocked attachments. */
export function addXp(n) {
  totalXp += n;
  for (const [key, meta] of Object.entries(ATTACHMENTS)) {
    if ((meta.xp || 0) > 0 && totalXp >= meta.xp && !ATTACH_UNLOCKED.has(key)) {
      ATTACH_UNLOCKED.add(key);
      showToast(`🔓 YENİ AKSESUAR: ${meta.label}`);
    }
  }
  saveProgress();
}

/** Record the current run under its map+difficulty record slot. */
export function recordBestRun(mapId, difficultyKey, round, score) {
  stats.bestRuns = stats.bestRuns || {};
  const key = `${mapId}:${difficultyKey}`;
  const cur = stats.bestRuns[key] || { round: 0, score: 0 };
  stats.bestRuns[key] = {
    round: Math.max(cur.round, round),
    score: Math.max(cur.score, score),
  };
}

export function resetProgress() {
  stats = { kills: 0, headshots: 0, bestRound: 0, bestScore: 0, runs: 0, bestRuns: {} };
  totalXp = 0;
  ATTACH_UNLOCKED.clear();
  for (const [key, meta] of Object.entries(ATTACHMENTS)) {
    if ((meta.xp || 0) === 0) ATTACH_UNLOCKED.add(key);
  }
  saveProgress();
}
