/**
 * game/perf.js
 * Graphics quality presets (pure data) so the renderer can swap pixel ratio,
 * shadows and shadow-camera size without touching gameplay.
 */

export const QUALITY_PRESETS = {
  low: {
    key: 'low',
    label: 'DÜŞÜK',
    desc: 'Gölge kapalı, 1× çözünürlük',
    pixelRatio: 1,
    shadows: false,
    shadowType: 'pcf',
    shadowMap: 256,
    shadowFollow: 22,
    shadowCutoff: 16,
    enemyShadowCutoff: 12,
    shadowInterval: 0,
    pointPool: 3,
  },
  med: {
    key: 'med',
    label: 'ORTA',
    desc: 'PCF gölge, 1.25× çözünürlük',
    pixelRatio: 1.25,
    shadows: true,
    shadowType: 'pcf',
    shadowMap: 512,
    shadowFollow: 30,
    shadowCutoff: 26,
    enemyShadowCutoff: 20,
    shadowInterval: 2,
    pointPool: 5,
  },
  high: {
    key: 'high',
    label: 'YÜKSEK',
    desc: 'Yumuşak gölge, yüksek çözünürlük',
    pixelRatio: 1.75,
    shadows: true,
    shadowType: 'pcfsoft',
    shadowMap: 1024,
    shadowFollow: 36,
    shadowCutoff: 34,
    enemyShadowCutoff: 28,
    shadowInterval: 1,
    pointPool: 8,
  },
};

/** Resolve a preset; unknown keys fall back to medium (the FPS default). */
export function qualityByKey(key) {
  return QUALITY_PRESETS[key] || QUALITY_PRESETS.med;
}
