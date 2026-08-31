/**
 * ui/pauseOptions.js
 * Pause-menu settings: sensitivity / volume / FOV sliders + quality
 * buttons. The opts object is mutated in place; callers provide the
 * apply callbacks so this module stays free of game/engine references.
 */

import { QUALITY_PRESETS, qualityByKey } from '../game/perf.js';

export function createPauseOptions(opts, { applyOpts, applyQuality, saveOpts }) {
  const panel = document.getElementById('pauseOptions');
  const optSensEl = document.getElementById('optSens');
  const optVolEl = document.getElementById('optVol');
  const optFovEl = document.getElementById('optFov');
  const optSensVal = document.getElementById('optSensVal');
  const optVolVal = document.getElementById('optVolVal');
  const optFovVal = document.getElementById('optFovVal');
  const optQualityEl = document.getElementById('optQuality');
  const optQualityVal = document.getElementById('optQualityVal');

  function sync() {
    if (!panel) return;
    optSensEl.value = opts.sens;
    optVolEl.value = opts.volume;
    optFovEl.value = opts.fov;
    optSensVal.textContent = `${Math.round(opts.sens * 100)}%`;
    optVolVal.textContent = `${Math.round(opts.volume * 100)}%`;
    optFovVal.textContent = `${Math.round(opts.fov)}°`;
    const q = qualityByKey(opts.quality);
    if (optQualityVal) optQualityVal.textContent = q.label;
    if (optQualityEl) {
      optQualityEl.querySelectorAll('.qualBtn').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.quality === q.key);
      });
    }
  }

  if (panel) {
    optSensEl.addEventListener('input', () => { opts.sens = Number(optSensEl.value); applyOpts(); sync(); saveOpts(); });
    optVolEl.addEventListener('input', () => { opts.volume = Number(optVolEl.value); applyOpts(); sync(); saveOpts(); });
    optFovEl.addEventListener('input', () => { opts.fov = Number(optFovEl.value); applyOpts(); sync(); saveOpts(); });
    optQualityEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('.qualBtn');
      if (!btn || !QUALITY_PRESETS[btn.dataset.quality]) return;
      opts.quality = btn.dataset.quality;
      applyQuality();
      sync();
      saveOpts();
    });
  }
  sync();

  return { sync, panel };
}
