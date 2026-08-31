/**
 * game/sky.js
 * Day/night cycle + weather frame drive. Outdoor maps run a real sun arc
 * (a full day every DAY_CYCLE_LEN seconds); indoor maps keep the old
 * ~3-minute intensity breathing. The rain column, fog squeeze and
 * lightning flash ride the weather state.
 */

import * as THREE from 'three';
import { weatherIntensity, lightningDelay } from './weather.js';

export const DAY_CYCLE_LEN = 240; // seconds for a full day

export function createDayNight() {
  const dn = {
    t: 0, sun: null, hemi: null, ambient: null,
    sunBase: 0, hemiBase: 0, ambBase: 0,
    mode: 'breathe', phase: 0.18,
  };

  /** Remember the scene's base light intensities for a fresh run. */
  function configure({ sun, hemi, ambient, outdoor }) {
    dn.t = 0;
    dn.sun = sun ?? null;
    dn.hemi = hemi ?? null;
    dn.ambient = ambient ?? null;
    dn.sunBase = dn.sun ? dn.sun.intensity : 0;
    dn.hemiBase = dn.hemi ? dn.hemi.intensity : 0;
    dn.ambBase = dn.ambient ? dn.ambient.intensity : 0;
    // Outdoor maps run a real sun arc (dawn → dusk); the rest just breathe
    // (the bunker has no sun at all anyway).
    dn.mode = outdoor ? 'cycle' : 'breathe';
    dn.phase = 0.16; // early morning — night falls deep into a run
  }

  /** Tick the cycle and push the resulting intensities into the lights. */
  function update(dt) {
    dn.t += dt;
    if (dn.mode === 'cycle' && dn.sun) {
      dn.phase = (dn.phase + dt / DAY_CYCLE_LEN) % 1;
      const elev = Math.sin(dn.phase * Math.PI * 2); // +1 noon … -1 midnight
      const dayK = THREE.MathUtils.clamp(elev * 1.15 + 0.22, 0.12, 1); // moonlit floor
      dn.sun.intensity = dn.sunBase;
      if (dn.hemi) dn.hemi.intensity = dn.hemiBase * dayK;
      if (dn.ambient) dn.ambient.intensity = dn.ambBase * (0.55 + 0.45 * dayK);
    } else {
      const dayK = 0.72 + 0.28 * Math.sin(dn.t * 0.03);
      if (dn.sun) dn.sun.intensity = dn.sunBase * dayK;
      if (dn.hemi) dn.hemi.intensity = dn.hemiBase * dayK;
      if (dn.ambient) dn.ambient.intensity = dn.ambBase * (0.85 + 0.15 * dayK);
    }
  }

  /** Lightning flash: multiply every scene light intensity by (1 + f*3). */
  function flash(f) {
    const boost = 1 + f * 3;
    if (dn.sun) dn.sun.intensity *= boost;
    if (dn.hemi) dn.hemi.intensity *= boost;
    if (dn.ambient) dn.ambient.intensity *= boost;
  }

  /** Shadow camera rides the player (sun arc in cycle mode, fixed else). */
  function followSun(p, shadowFollow) {
    const sun = dn.sun;
    if (!sun || !sun.castShadow) return;
    if (dn.mode === 'cycle') {
      // Sun rides an arc around the follow target (phase 0..1 = full day).
      const a = dn.phase * Math.PI * 2;
      sun.position.set(p.x + Math.cos(a) * 34, Math.max(14, Math.sin(a) * 52), p.z + 12);
    } else {
      sun.position.set(p.x + 28, 48, p.z + 12);
    }
    sun.target.position.set(p.x, 0, p.z);
    sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    if (cam.right !== shadowFollow) {
      cam.left = -shadowFollow;
      cam.right = shadowFollow;
      cam.top = shadowFollow;
      cam.bottom = -shadowFollow;
      cam.updateProjectionMatrix();
    }
  }

  return { state: dn, configure, update, flash, followSun };
}

/**
 * Per-frame weather drive (outdoor maps only): rain column follow, fog
 * squeeze, thunder cadence. `weather` is the caller-owned state machine
 * ({ enabled, state, rain, fog, flashT, boltT }). Returns the current
 * lightning flash fraction (0..1) for the caller to feed DayNight.flash().
 */
export function driveWeather(weather, scene, sfx, dt, playerPos) {
  const wi = weatherIntensity(weather.state);
  if (weather.rain) {
    weather.rain.points.visible = wi > 0;
    if (wi > 0) weather.rain.update(dt, playerPos.x, playerPos.z);
  }
  if (weather.fog && scene.fog) {
    // wet air: sightlines collapse toward the fog centre
    const farT = weather.fog.far * (wi > 0 ? (weather.state === 'storm' ? 0.45 : 0.65) : 1);
    const nearT = weather.fog.near * (wi > 0 ? 0.6 : 1);
    scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, farT, Math.min(1, dt * 1.2));
    scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, nearT, Math.min(1, dt * 1.2));
  }
  sfx.setRain(wi * 0.85);
  if (weather.state === 'storm') {
    weather.boltT -= dt;
    if (weather.boltT <= 0) {
      weather.flashT = 0.18;
      weather.boltT = lightningDelay('storm');
      sfx.thunder();
    }
  }
  if (weather.flashT > 0) {
    weather.flashT -= dt;
    return Math.max(0, weather.flashT / 0.18);
  }
  return 0;
}
