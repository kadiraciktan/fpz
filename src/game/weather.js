import * as THREE from 'three';

/**
 * game/weather.js
 * Weather state machine + GPU-cheap rain.
 *
 * The state machine is PURE (rolls in, state out) so it is unit-tested;
 * the rain is ONE THREE.Points object: positions live in a single
 * Float32Array that recycles inside a column following the player — no
 * per-drop objects, no per-frame allocation, one draw call.
 */

export const WEATHER_STATES = ['clear', 'rain', 'storm'];

/** Early rounds stay clear; rain gets likelier as the front heats up. */
export function rollWeather(round, rand = Math.random) {
  if (round < 2) return 'clear';
  const r = rand();
  const wetness = Math.min(0.7, 0.15 + round * 0.03);
  if (r < wetness * 0.65) return 'rain';
  if (r < wetness) return 'storm';
  return 'clear';
}

/** Rain intensity per state (0..1). */
export function weatherIntensity(state) {
  return state === 'storm' ? 1 : state === 'rain' ? 0.55 : 0;
}

/** Seconds between lightning strikes while storming (0 = none). */
export function lightningDelay(state, rand = Math.random) {
  if (state !== 'storm') return 0;
  return 4 + rand() * 8;
}

/** Drop count per quality preset — low GPUs get a light drizzle. */
export const RAIN_DROPS = { low: 0, med: 700, high: 1200 };

export function rainDrops(qualityKey) {
  return RAIN_DROPS[qualityKey] ?? RAIN_DROPS.med;
}

// ── Rain particle column (single draw call) ──────────────────────────

const COLUMN = 26; // half-width of the falling column around the player
const COLUMN_H = 18;
const TERMINAL = 16; // m/s fall speed
const WIND = 1.6; // slight lateral drift (m/s)

/**
 * Build the rain pool. `update(dt, px, pz)` drops every streak, wraps it
 * back to the top when it leaves the ground, and recentres the column on
 * the player (streaks outside the column wrap in). All in-place math.
 * @param {number} count
 * @returns {{ points: THREE.Points, update(dt, px, pz): void }}
 */
export function createRain(count) {
  const positions = new Float32Array(count * 2 * 3); // 2 verts per streak
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 2 - 1) * COLUMN;
    const y = Math.random() * COLUMN_H;
    const z = (Math.random() * 2 - 1) * COLUMN;
    const o = i * 6;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
    positions[o + 3] = x + 0.03;
    positions[o + 4] = y - 0.55; // streak length
    positions[o + 5] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x9db4c8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const points = new THREE.LineSegments(geo, mat);
  points.frustumCulled = false; // the column always surrounds the camera
  points.visible = false;
  points.layers.set(0);

  let ox = 0;
  let oz = 0;

  function update(dt, px, pz) {
    const attr = geo.attributes.position;
    const arr = attr.array;
    const fall = TERMINAL * dt;
    const drift = WIND * dt;
    const recenterX = px - ox;
    const recenterZ = pz - oz;
    ox = px;
    oz = pz;
    for (let i = 0; i < arr.length; i += 6) {
      let x = arr[i];
      let y = arr[i + 1];
      let z = arr[i + 2];
      y -= fall;
      x += drift;
      // recentre + wrap the column around the player
      x += recenterX;
      z += recenterZ;
      if (y < -1.5) y += COLUMN_H;
      if (x - px > COLUMN) x -= COLUMN * 2;
      else if (x - px < -COLUMN) x += COLUMN * 2;
      if (z - pz > COLUMN) z -= COLUMN * 2;
      else if (z - pz < -COLUMN) z += COLUMN * 2;
      arr[i] = x;
      arr[i + 1] = y;
      arr[i + 2] = z;
      arr[i + 3] = x + 0.03;
      arr[i + 4] = y - 0.55;
      arr[i + 5] = z;
    }
    attr.needsUpdate = true;
  }

  return { points, update };
}
