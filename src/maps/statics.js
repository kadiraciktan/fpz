import * as THREE from 'three';

/**
 * maps/statics.js
 * Post-build scene optimizations, run once per map after the builder
 * functions have placed everything:
 *
 *  1. extractPointLights — map point lights are pulled out of the scene
 *     graph and kept as "light defs" (position/color/intensity). main.js
 *     drives a small FIXED-SIZE pool of real PointLights from those defs:
 *     the visible-light count never changes, so the shader never
 *     recompiles mid-run and the per-fragment light loop stays tiny.
 *  2. mergeStaticProps — static prop meshes are baked into a handful of
 *     world-space BufferGeometry meshes (one per material + shadow-flag
 *     combo), collapsing ~2,000 draw calls into a few dozen. Colliders
 *     keep their exact OBB data: the collision mesh just turns invisible.
 *  3. freezeMatrices — the merged/frozen world never moves again, so
 *     matrixAutoUpdate=false removes the per-frame transform cost.
 */

/** Record each PointLight's world transform, then detach it from the scene. */
export function extractPointLights(scene) {
  scene.updateMatrixWorld(true);
  const defs = [];
  const lights = [];
  scene.traverse((o) => {
    if (o.isPointLight) lights.push(o);
  });
  for (const light of lights) {
    const wp = new THREE.Vector3();
    light.getWorldPosition(wp);
    light.parent.remove(light);
    light.position.copy(wp);
    light.matrixAutoUpdate = true; // pool slots move; defs stay parked
    defs.push(light);
  }
  return defs;
}

/** Material identity signature — meshes sharing one can share a draw call. */
function materialSignature(m) {
  return [
    m.type,
    m.color ? m.color.getHex() : 0,
    m.emissive ? m.emissive.getHex() : 0,
    m.emissiveIntensity ?? 0,
    m.roughness ?? 0,
    m.metalness ?? 0,
    m.transparent ? 1 : 0,
    m.opacity ?? 1,
    m.side ?? 0,
    m.wireframe ? 1 : 0,
    m.map ? m.map.uuid : '-',
    m.vertexColors ? 1 : 0,
    m.fog ? 1 : 0,
    m.depthWrite ? 1 : 0,
    m.blending ?? 0,
    m.alphaTest ?? 0,
  ].join('|');
}

/**
 * Bake every static prop mesh into merged world-space meshes grouped by
 * material + shadow flags. Meshes that also act as colliders stay in the
 * scene (invisible) so `userData.collision`, `position` and `rotation.y`
 * keep feeding the physics untouched. Groups that are themselves obstacles
 * (crates, lamps) are left intact — few meshes each.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D[]} obstacles
 */
export function mergeStaticProps(scene, obstacles) {
  scene.updateMatrixWorld(true);

  // Never merge: shooting targets and anything explicitly tagged. Group
  // obstacles (crates, lamps) DO get merged — the empty group stays in the
  // scene as a pure collider (see the cleanup guard below).
  const keep = new Set();
  scene.traverse((o) => {
    if (o.userData.isTarget || o.userData.noMerge) o.traverse((c) => keep.add(c));
  });

  const buckets = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || keep.has(o)) return;
    if (!o.geometry || !o.geometry.attributes.position || !o.geometry.attributes.normal) return;
    const key = `${materialSignature(o.material)}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) {
      b = { material: o.material, cast: o.castShadow, recv: o.receiveShadow, meshes: [] };
      buckets.set(key, b);
    }
    b.meshes.push(o);
  });

  const disposedGeos = new Set();
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue; // a lone mesh is already one draw call
    const posArrays = [];
    const normArrays = [];
    const uvArrays = [];
    let vCount = 0;
    let usable = true;
    for (const mesh of b.meshes) {
      const src = mesh.geometry;
      if (!src.attributes.uv) { usable = false; break; }
      const geo = src.index ? src.toNonIndexed() : src.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      posArrays.push(geo.attributes.position.array);
      normArrays.push(geo.attributes.normal.array);
      uvArrays.push(geo.attributes.uv.array);
      vCount += geo.attributes.position.count;
      geo.dispose();
    }
    if (!usable || vCount === 0) continue;

    const position = new Float32Array(vCount * 3);
    const normal = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    let vo = 0;
    for (let i = 0; i < posArrays.length; i++) {
      position.set(posArrays[i], vo * 3);
      normal.set(normArrays[i], vo * 3);
      uv.set(uvArrays[i], vo * 2);
      vo += posArrays[i].length / 3;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.computeBoundingSphere();

    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.userData.mergedStatic = true;
    scene.add(mesh);

    // Retire the originals: colliders go invisible (physics keeps reading
    // their transform), pure decor is dropped and its GPU data released.
    for (const old of b.meshes) {
      if (old.userData.collision) {
        old.visible = false;
        old.castShadow = false; // the merged mesh casts for it now
        old.userData.mergedAway = true;
        continue;
      }
      if (old.parent) old.parent.remove(old);
      if (old.geometry && !disposedGeos.has(old.geometry)) {
        disposedGeos.add(old.geometry);
        old.geometry.dispose();
      }
      if (old.material !== b.material) old.material.dispose();
    }
  }

  // Purge group shells left empty by the merge (barrel/facade/etc. groups),
  // but keep every collider — a group that only carries collision data is
  // still a live entry in the obstacles list.
  const colliders = new Set(obstacles);
  let purged = true;
  while (purged) {
    purged = false;
    const empties = [];
    scene.traverse((o) => {
      if (o !== scene && o.type === 'Group' && o.children.length === 0 && !colliders.has(o) && !o.userData.collision) {
        empties.push(o);
      }
    });
    for (const g of empties) {
      if (g.parent) { g.parent.remove(g); purged = true; }
    }
  }
}

/** The static world never moves again: one matrix compute, ever. */
export function freezeMatrices(scene) {
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    // Lights (and the sun's target proxy) and noMerge props DO move —
    // barriers sag with damage, and the day/night follow loop repositions
    // the sun every frame.
    if (o.isLight || o.userData.isSunTarget || o.userData.noMerge) return;
    o.matrixAutoUpdate = false;
  });
  scene.updateMatrixWorld(true);
}
