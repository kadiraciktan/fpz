/**
 * game/fx.js
 * Explosion FX (bomber detonation): expanding additive orb. Orbs are
 * pooled (each keeps its own material so overlapping blasts never fade
 * each other) — bombers used to alloc a sphere per detonation.
 */

import * as THREE from 'three';

const ORB_GEO = new THREE.SphereGeometry(0.5, 12, 12);

export function createFx() {
  const fxList = [];
  const orbPool = [];

  function spawn(scene, sfx, pos, playSound = true, color = 0xff9944) {
    if (!scene) return;
    if (playSound && sfx) sfx.explosion();
    let orb = orbPool.pop();
    if (!orb) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff9944,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      orb = new THREE.Mesh(ORB_GEO, mat);
    }
    orb.material.color.setHex(color);
    orb.material.opacity = 0.95;
    orb.visible = true;
    orb.position.copy(pos).setY(0.8);
    orb.scale.setScalar(1);
    scene.add(orb);
    fxList.push({ orb, mat: orb.material, t: 0 });
  }

  function update(scene, dt) {
    for (let i = fxList.length - 1; i >= 0; i--) {
      const f = fxList[i];
      f.t += dt;
      const k = f.t / 0.45;
      f.orb.scale.setScalar(1 + k * 6);
      f.mat.opacity = 0.95 * (1 - k);
      if (k >= 1) {
        scene.remove(f.orb);
        f.orb.visible = false;
        // ORB_GEO is shared across every orb — only the material is per-orb.
        if (orbPool.length >= 6) f.mat.dispose();
        else orbPool.push(f.orb);
        fxList.splice(i, 1);
      }
    }
  }

  /** Run teardown: retire every live orb and release the pooled materials. */
  function clear(scene) {
    for (const f of fxList) {
      scene.remove(f.orb);
      f.orb.visible = false;
      orbPool.push(f.orb);
    }
    // Geometry is the shared ORB_GEO — only per-orb materials are released.
    for (const orb of orbPool) orb.material.dispose();
    orbPool.length = 0;
    fxList.length = 0;
  }

  return { spawn, update, clear };
}
