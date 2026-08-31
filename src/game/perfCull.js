/**
 * game/perfCull.js
 * Distance-based render optimization helpers:
 *  - shadow culling: distant props skip the shadow pass;
 *  - point-light pool: the map's point lights live as data-only "defs"
 *    (extracted at build), and a FIXED-SIZE pool of real PointLights always
 *    sits in the scene. Each update retargets the pool slots at the nearest
 *    defs. The visible light count never changes, so three.js never
 *    re-compiles the material shaders mid-run (the old light.visible
 *    toggling invalidated every program every 200 ms).
 */

import * as THREE from 'three';

export function collectShadowCasters(scene) {
  const casters = [];
  if (!scene) return casters;
  const wp = new THREE.Vector3();
  scene.traverse((o) => {
    // Merged static props always cast (one draw call for the whole map),
    // so they are excluded.
    if (o.isMesh && o.castShadow && !o.userData.isEnemy && !o.userData.mergedStatic) {
      o.getWorldPosition(wp);
      o.userData._cullX = wp.x;
      o.userData._cullZ = wp.z;
      casters.push(o);
    }
  });
  return casters;
}

/** Cull per quality preset: props + horde members beyond the cutoff drop
 *  their shadow casters (refreshed on a slow cadence, not per frame). */
export function updateShadowCulling(casters, enemies, p, q) {
  const shadowCutoffSq = q.shadowCutoff * q.shadowCutoff;
  for (const m of casters) {
    const dx = (m.userData._cullX ?? m.position.x) - p.x;
    const dz = (m.userData._cullZ ?? m.position.z) - p.z;
    m.castShadow = q.shadows && (dx * dx + dz * dz) < shadowCutoffSq;
  }
  // Zombies too: distant horde members skip the shadow pass. Re-evaluated
  // every tick so pooled (recycled) groups never come back shadowless.
  const enemyCutoffSq = q.enemyShadowCutoff * q.enemyShadowCutoff;
  for (const e of enemies) {
    const ep = e.group.position;
    const dx = ep.x - p.x, dz = ep.z - p.z;
    const near = q.shadows && (dx * dx + dz * dz) < enemyCutoffSq;
    const meshes = e._meshes;
    for (let i = 0; i < meshes.length; i++) meshes[i].castShadow = near;
  }
}

export function createLightPool() {
  const pool = { defs: [], slots: [], used: [], size: -1 };
  let scene = null;

  function setSize(n) {
    if (!scene || pool.size === n) return;
    for (const s of pool.slots) scene.remove(s);
    pool.slots.length = 0;
    for (let i = 0; i < n; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 16, 2);
      pl.layers.enable(1); // viewmodel pass shares the pool lighting
      pl.position.set(0, -50, 0);
      scene.add(pl);
      pool.slots.push(pl);
    }
    pool.size = n;
  }

  /** Re-target the pool slots at the `size` nearest in-range light defs. */
  function refresh(p) {
    const { defs, slots, size } = pool;
    if (size <= 0) return;
    const used = pool.used;
    used.length = defs.length;
    used.fill(0);
    for (let s = 0; s < size; s++) {
      const slot = slots[s];
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < defs.length; i++) {
        if (used[i]) continue;
        const d = defs[i];
        const dx = d.position.x - p.x;
        const dz = d.position.z - p.z;
        const range = (d.distance || 20) + 6;
        const dd = dx * dx + dz * dz;
        if (dd > range * range) continue;
        if (dd < bestD) { bestD = dd; best = i; }
      }
      if (best < 0) {
        slot.intensity = 0;
        continue;
      }
      used[best] = 1;
      const d = defs[best];
      slot.position.copy(d.position);
      slot.color.copy(d.color);
      slot.distance = d.distance;
      slot.decay = d.decay;
      slot.intensity = d.intensity;
    }
  }

  /** Drop references to the old scene's slots (they die with the scene). */
  function reset() {
    pool.defs = [];
    pool.slots.length = 0;
    pool.size = -1;
    scene = null;
  }

  return {
    pool,
    bind(s) { scene = s; },
    setSize,
    refresh,
    reset,
  };
}
