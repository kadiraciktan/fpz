/**
 * ui/pauseOptions.js
 * Pause-menu settings: sensitivity / volume (master + category mix) / FOV
 * sliders + quality buttons. The opts object is mutated in place; callers
 * provide the apply callbacks so this module stays free of game/engine
 * references.
 */

import { QUALITY_PRESETS, qualityByKey } from '../game/perf.js';

/** opts key → { slider, value, label, suffix } for the range rows. */
const RANGE_ROWS = [
  { key: 'sens', el: 'optSens', val: 'optSensVal', scale: 100, suffix: '%' },
  { key: 'volume', el: 'optVol', val: 'optVolVal', scale: 100, suffix: '%' },
  { key: 'volSfx', el: 'optVolSfx', val: 'optVolSfxVal', scale: 100, suffix: '%' },
  { key: 'volMusic', el: 'optVolMusic', val: 'optVolMusicVal', scale: 100, suffix: '%' },
  { key: 'volAmb', el: 'optVolAmb', val: 'optVolAmbVal', scale: 100, suffix: '%' },
  { key: 'fov', el: 'optFov', val: 'optFovVal', scale: 1, suffix: '°' },
];

export function createPauseOptions(opts, { applyOpts, applyQuality, saveOpts }) {
  const panel = document.getElementById('pauseOptions');
  const rows = RANGE_ROWS.map((r) => ({
    ...r,
    input: document.getElementById(r.el),
    label: document.getElementById(r.val),
  })).filter((r) => r.input && r.label);
  const optQualityEl = document.getElementById('optQuality');
  const optQualityVal = document.getElementById('optQualityVal');

  function sync() {
    if (!panel) return;
    for (const r of rows) {
      r.input.value = opts[r.key];
      r.label.textContent = `${Math.round(opts[r.key] * r.scale)}${r.suffix}`;
    }
    const q = qualityByKey(opts.quality);
    if (optQualityVal) optQualityVal.textContent = q.label;
    if (optQualityEl) {
      optQualityEl.querySelectorAll('.qualBtn').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.quality === q.key);
      });
    }
  }

  if (panel) {
    for (const r of rows) {
      r.input.addEventListener('input', () => {
        opts[r.key] = Number(r.input.value);
        applyOpts();
        sync();
        saveOpts();
      });
    }
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
