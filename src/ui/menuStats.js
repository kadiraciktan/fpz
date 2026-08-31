/**
 * ui/menuStats.js
 * Menu meta line (XP) + lifetime stats screen: per-map record lines on
 * the map cards, the stats overlay and the progress-reset button.
 */

import { MAPS } from '../gfx/Scene.js';
import { difficultyByKey } from '../game/zombies.js';
import { totalXp, stats, resetProgress } from '../game/progress.js';

export function createMenuStats() {
  const xpLineEl = document.getElementById('xpLine');
  const statsScreenEl = document.getElementById('statsScreen');
  const statsBodyEl = document.getElementById('statsBody');

  function updateMenuMeta() {
    if (xpLineEl) {
      xpLineEl.textContent = `⭐ ${totalXp} XP — aksesuarlar XP ile açılır (kill: 10 · headshot: 15 · dalga: 20×N)`;
    }
    // Per-map record line: best round across difficulties (with the mode tag).
    for (const map of MAPS) {
      const el = document.getElementById(`rec-${map.id}`);
      if (!el) continue;
      const entries = Object.entries(stats.bestRuns || {}).filter(([k]) => k.startsWith(`${map.id}:`));
      if (!entries.length) {
        el.textContent = 'Henüz kayıt yok';
        continue;
      }
      let best = { round: 0, score: 0, key: '' };
      for (const [k, v] of entries) {
        if (v.round > best.round) best = { ...v, key: k.split(':')[1] };
      }
      const diff = difficultyByKey(best.key);
      el.textContent = `🏆 Rekor: ${best.round}. tur · ${best.score} puan (${diff.label})`;
    }
  }

  function showStats() {
    if (!statsBodyEl || !statsScreenEl) return;
    const hsPct = stats.kills ? Math.round((stats.headshots / stats.kills) * 100) : 0;
    const runRows = Object.entries(stats.bestRuns || {}).map(([k, v]) => {
      const [mapId, dKey] = k.split(':');
      const map = MAPS.find((m) => m.id === mapId);
      const diff = difficultyByKey(dKey);
      return `<div class="statRow"><span>${map ? map.name : mapId} · ${diff.icon} ${diff.label}</span><b>${v.round}. tur · ${v.score} p</b></div>`;
    }).join('');
    statsBodyEl.innerHTML = `
      <div class="statRow"><span>Toplam Kill</span><b>${stats.kills}</b></div>
      <div class="statRow"><span>Headshot</span><b>${stats.headshots} (%${hsPct})</b></div>
      <div class="statRow"><span>En İyi Tur</span><b>${stats.bestRound}</b></div>
      <div class="statRow"><span>En Yüksek Skor</span><b>${stats.bestScore}</b></div>
      <div class="statRow"><span>Toplam XP</span><b>${totalXp}</b></div>
      <div class="statRow"><span>Toplam Koşu</span><b>${stats.runs || 0}</b></div>
      ${runRows}`;
    statsScreenEl.classList.remove('hidden');
  }

  const statsBtn = document.getElementById('statsBtn');
  if (statsBtn) statsBtn.addEventListener('click', showStats);
  document.getElementById('statsCloseBtn')?.addEventListener('click', () => {
    statsScreenEl.classList.add('hidden');
  });
  document.getElementById('statsResetBtn')?.addEventListener('click', () => {
    resetProgress();
    updateMenuMeta();
    showStats();
  });

  updateMenuMeta();
  return { updateMenuMeta };
}
