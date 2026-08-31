/**
 * ui/scorePopups.js
 * CoD-style floating score numbers near the crosshair. A small pool of
 * absolutely-positioned spans rides one CSS keyframe (popRise in
 * styles.css); each spawn grabs a free slot, retints it and restarts the
 * animation through the Web Animations API — zero DOM churn mid-fight.
 */

import { restartCssAnim } from './util.js';

const POOL = 14;
const LIFE_MS = 880; // matches the 0.85s keyframe + a hair of slack

export function createScorePopups() {
  const layer = document.getElementById('popups');
  const slots = [];
  if (layer) {
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement('span');
      el.className = 'scorePop';
      layer.appendChild(el);
      slots.push({ el, timer: 0 });
    }
  }
  let next = 0;

  /** text like '+10'; kind: hit | hs | kill | killhs */
  function spawn(text, kind = 'hit') {
    if (!layer) return;
    const s = slots[next % POOL];
    next++;
    s.el.className = `scorePop ${kind} show`;
    s.el.textContent = text;
    // Fan them out around the crosshair so a full-auto burst stays readable.
    s.el.style.left = `${Math.round(Math.random() * 90 - 45)}px`;
    s.el.style.top = `${Math.round(18 + Math.random() * 42)}px`;
    restartCssAnim(s.el);
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.el.classList.remove('show');
    }, LIFE_MS);
  }

  function clear() {
    for (const s of slots) {
      clearTimeout(s.timer);
      s.el.classList.remove('show');
    }
  }

  return { spawn, clear };
}
