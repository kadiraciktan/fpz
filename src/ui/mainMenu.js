/**
 * ui/mainMenu.js
 * Main-menu selectors: map cards and difficulty cards. Selection state
 * lives in game/setup.js (persisted from there).
 */

import { MAPS } from '../gfx/Scene.js';
import { setup, saveSetup } from '../game/setup.js';
import { DIFFICULTIES } from '../game/zombies.js';

export function createMainMenu() {
  const mapCardsEl = document.getElementById('mapCards');
  const diffRowEl = document.getElementById('diffRow');

  // Map cards (with the per-map lifetime record line)
  for (const map of MAPS) {
    const card = document.createElement('div');
    card.className = 'mapCard' + (map.id === setup.mapId ? ' selected' : '');
    card.dataset.mapId = map.id;
    card.innerHTML = `
      <div class="swatch" style="background:${map.swatch}"></div>
      <div class="mapName">${map.name}</div>
      <div class="mapDesc">${map.desc}</div>
      <div class="mapRecord" id="rec-${map.id}"></div>`;
    card.addEventListener('click', () => {
      setup.mapId = map.id;
      mapCardsEl.querySelectorAll('.mapCard').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      saveSetup();
    });
    mapCardsEl.appendChild(card);
  }

  // Difficulty selector cards
  function buildDiffCards() {
    if (!diffRowEl) return;
    diffRowEl.innerHTML = '';
    for (const d of DIFFICULTIES) {
      const card = document.createElement('div');
      card.className = 'diffCard' + (d.key === setup.difficulty ? ' selected' : '');
      card.innerHTML = `<b style="color:${d.color}">${d.icon} ${d.label}</b><span>${d.desc}</span>`;
      card.addEventListener('click', () => {
        setup.difficulty = d.key;
        diffRowEl.querySelectorAll('.diffCard').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        saveSetup();
      });
      diffRowEl.appendChild(card);
    }
  }
  buildDiffCards();
}
