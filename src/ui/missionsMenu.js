/**
 * ui/missionsMenu.js
 * Main-menu mode selector (KLASİK / OPERASYON) + the story campaign card
 * grid. Selection lives in game/setup.js; completion comes from
 * stats.missions (game/progress.js). Cards reuse .mapCard so the gamepad
 * menu navigator picks them up for free.
 */

import { setup, saveSetup } from '../game/setup.js';
import { MISSIONS, missionUnlocked, missionIndex } from '../game/missions.js';
import { stats } from '../game/progress.js';
import { MAPS } from '../gfx/Scene.js';
import { showToast } from '../ui/toast.js';

export function createMissionMenu() {
  const modeRowEl = document.getElementById('modeRow');
  const missionSectionEl = document.getElementById('missionSection');
  const missionCardsEl = document.getElementById('missionCards');
  const mapSectionEl = document.getElementById('mapSection');

  const MODES = [
    { key: 'classic', label: '⚔️ KLASİK', desc: 'Sonsuz dalga — skor avı. Harita + zorluk senin seçimin.' },
    { key: 'mission', label: '🎖️ OPERASYON', desc: 'SON NEFES: 4 bölümlük hikaye görevi, kilit sırasıyla açılır.' },
  ];

  function completedIds() {
    const m = stats.missions || {};
    return MISSIONS.filter((x) => m[x.id]).map((x) => x.id);
  }

  function applyModeVisibility() {
    const mission = setup.mode === 'mission';
    missionSectionEl.classList.toggle('hidden', !mission);
    if (mapSectionEl) mapSectionEl.classList.toggle('hidden', mission);
    for (const card of modeRowEl.querySelectorAll('.mapCard')) {
      card.classList.toggle('selected', card.dataset.mode === setup.mode);
    }
  }

  function buildModeCards() {
    modeRowEl.innerHTML = '';
    for (const m of MODES) {
      const card = document.createElement('div');
      card.className = 'mapCard modeCard';
      card.dataset.mode = m.key;
      card.innerHTML = `<div class="mapName">${m.label}</div><div class="mapDesc">${m.desc}</div>`;
      card.addEventListener('click', () => {
        setup.mode = m.key;
        saveSetup();
        applyModeVisibility();
      });
      modeRowEl.appendChild(card);
    }
  }

  function buildMissionCards() {
    missionCardsEl.innerHTML = '';
    const done = completedIds();
    MISSIONS.forEach((mission, i) => {
      const unlocked = missionUnlocked(i, done);
      const isDone = done.includes(mission.id);
      const map = MAPS.find((m) => m.id === mission.mapId);
      const card = document.createElement('div');
      card.className = 'mapCard missionCard'
        + (isDone ? ' done' : '')
        + (!unlocked ? ' locked' : '')
        + (setup.missionId === mission.id && unlocked ? ' selected' : '');
      card.innerHTML = `
        <div class="missionNo" style="color:${mission.color}">BÖLÜM ${i + 1}${isDone ? ' · ✓' : !unlocked ? ' · 🔒' : ''}</div>
        <div class="mapName">${mission.name}</div>
        <div class="mapDesc">${map ? map.name : mission.mapId}</div>
        <div class="missionObjs">${mission.objectives.length} hedef · +${mission.rewardXp} XP</div>`;
      card.addEventListener('click', () => {
        if (!unlocked) {
          showToast('🔒 Önce önceki bölümü tamamla');
          return;
        }
        setup.missionId = mission.id;
        saveSetup();
        buildMissionCards();
      });
      missionCardsEl.appendChild(card);
    });
    // Keep the deployment pointed at a playable bölüm.
    if (!MISSIONS.some((m) => m.id === setup.missionId) || !missionUnlocked(missionIndex(setup.missionId), done)) {
      setup.missionId = done.length === MISSIONS.length ? MISSIONS[0].id : MISSIONS[done.length].id;
    }
  }

  /** Re-read completions + selection (menu open / mission finished). */
  function update() {
    buildMissionCards();
    applyModeVisibility();
  }

  buildModeCards();
  update();

  return { update };
}
