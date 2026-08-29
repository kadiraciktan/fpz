import * as THREE from 'three';

/**
 * gfx/BloodDecals.js
 * Ground blood pools under fresh kills. One shared circle geometry and ONE
 * shared material for the whole pool: a kill only moves a mesh and nudges
 * its scale/rotation — zero allocation, zero material churn, `n` meshes max.
 * Ring buffer: the oldest splat is recycled, so late rounds never grow the
 * draw call count.
 */
export class BloodDecals {
  constructor(scene, n = 16) {
    this.geo = new THREE.CircleGeometry(0.5, 10);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x5c0e0e,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo, this.mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 1;
      scene.add(m);
      this.pool.push(m);
    }
    this.i = 0;
  }

  /** Stamp a pool at (x, z) with a size multiplier (big zombies bleed big). */
  splat(x, z, size = 1) {
    const m = this.pool[this.i];
    this.i = (this.i + 1) % this.pool.length;
    m.position.set(x, 0.02, z);
    m.rotation.z = Math.random() * Math.PI * 2;
    const s = size * (0.6 + Math.random() * 0.7);
    m.scale.set(s, s * (0.7 + Math.random() * 0.5), 1);
    m.visible = true;
  }

  clear() {
    for (const m of this.pool) m.visible = false;
  }

  /** Meshes live in the scene graph; only the shared GPU data is ours. */
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.pool.length = 0;
  }
}
