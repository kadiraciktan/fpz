import * as THREE from 'three';
import { createCrate, createTarget, createBarrier } from '../gfx/Prefabs.js';
import { flickerLights, addWindowBoards } from './kit.js';
import { extractPointLights, mergeStaticProps, freezeMatrices } from './statics.js';
import { meta as streetMeta, build as buildStreet } from './street.js';
import { meta as factoryMeta, build as buildFactory } from './factory.js';
import { meta as bunkerMeta, build as buildBunker } from './bunker.js';
import { meta as nachtMeta, build as buildNacht } from './nacht.js';

/**
 * maps/index.js
 * Map registry + scene factory. Each map module exports { meta, build }.
 */

export { flickerLights };

export const MAPS = [streetMeta, factoryMeta, bunkerMeta, nachtMeta];

const BUILDERS = {
  street: buildStreet,
  factory: buildFactory,
  bunker: buildBunker,
  nacht: buildNacht,
};

/**
 * Build a playable arena. Extra zones are sealed by point-buyable barriers
 * (CoD zombies style); paying one unlocks that zone for walking and spawns.
 *
 * @returns {{ scene, obstacles, targets, arenaHalf, lights, zones, barriers }}
 */
export function createScene(mapId = 'street') {
  const scene = new THREE.Scene();
  const obstacles = [];
  const targets = [];
  const zones = [];
  const barriers = [];
  const windows = [];
  flickerLights.length = 0;

  const sillMat = new THREE.MeshStandardMaterial({ color: 0x42463e, roughness: 0.95 });

  const ctx = {
    scene,
    obstacles,
    targets,
    zones,
    barriers,
    arenaHalf: 45,
    addZone(id, rect, gate = false) {
      zones.push({ id, rect, gate });
    },
    addGateBarrier({ x, z, width, rotY = 0, cost, zone, rect, style = 'wood' }) {
      const mesh = createBarrier(width, cost, style);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = rotY;
      mesh.userData.noMerge = true; // rescales / collapses at runtime
      scene.add(mesh);
      const along = Math.abs(Math.sin(rotY)) > 0.5;
      const collider = ctx.addCollisionBox(
        x, 1.15, z,
        new THREE.Vector3(along ? 0.6 : width, 2.3, along ? width : 0.6)
      );
      barriers.push({ mesh, collider, cost, zone });
      ctx.addZone(zone, rect, true);
      return mesh;
    },
    addBox(w, h, d, x, y, z, mat, { collide = true, rotY = 0 } = {}) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      if (collide) {
        m.userData.collision = { size: new THREE.Vector3(w, h, d), isStatic: true };
        obstacles.push(m);
      }
      return m;
    },
    addCollisionBox(x, y, z, size, rotY = 0) {
      const col = new THREE.Object3D();
      col.position.set(x, y, z);
      col.rotation.y = rotY;
      col.userData.collision = { size, isStatic: true };
      scene.add(col);
      obstacles.push(col);
      return col;
    },
    /**
     * Open window in a wall gap: low sill (player vaults, horde steps
     * over) + decorative boards with no collision. Registered as an AI
     * waypoint so outdoor zombies path through the opening.
     */
    addWindow({ x, z, rotY = 0, width = 2.2 }) {
      ctx.addBox(width, 0.75, 0.3, x, 0.375, z, sillMat, { rotY });
      addWindowBoards(ctx, x, z, rotY, width);
      windows.push({ x, z, rotY, width });
    },
    addCrateRing(positions, size = 1.5) {
      for (const [x, , z] of positions) {
        const crate = createCrate(size);
        crate.position.set(x, size / 2, z);
        crate.rotation.y = Math.random() * Math.PI;
        scene.add(crate);
        obstacles.push(crate);
      }
    },
    addTargets(positions) {
      for (const [x, y, z] of positions) {
        const target = createTarget();
        target.position.set(x, y, z);
        scene.add(target);
        targets.push(target);
      }
    },
  };

  const build = BUILDERS[mapId] || buildStreet;
  build(ctx);

  // Build-time optimization pass: map lights become "defs" driven by a
  // fixed-size pool in main.js, static props collapse into merged draw
  // calls, and the frozen world skips every per-frame matrix update.
  const pointLights = extractPointLights(scene);
  mergeStaticProps(scene, obstacles);
  freezeMatrices(scene);

  const lights = { ambient: null, hemi: null, sun: null };
  scene.traverse((o) => {
    if (o.isAmbientLight && !lights.ambient) lights.ambient = o;
    else if (o.isHemisphereLight && !lights.hemi) lights.hemi = o;
    else if (o.isDirectionalLight && !lights.sun) lights.sun = o;
  });

  return { scene, obstacles, targets, arenaHalf: ctx.arenaHalf, lights, zones, barriers, windows, pointLights };
}
