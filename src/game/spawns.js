/**
 * game/spawns.js
 * Run-scoped spawn placement: zombie spawn picking (inside unlocked zones,
 * clear of obstacles, away from the player), perk machine scattering and
 * wall-gun / Pack-a-Punch mounting on real wall faces.
 */

import * as THREE from 'three';
import { createPerkMachine, createWallGun, createPapMachine } from '../gfx/Prefabs.js';
import { machineSpots, wallGunSpots, wallGunNames, wallGunCost, PAP_COST } from './zombies.js';
import { WEAPON_LABELS } from '../weapons/defs.js';

export class Spawner {
  constructor({ scene, controller, zones, arenaHalf, isBlocked, machines, wallGuns, setPap, showToast }) {
    this.scene = scene;
    this.controller = controller;
    this.zones = zones;
    this.arenaHalf = arenaHalf;
    this.isBlocked = isBlocked;
    this.machines = machines;
    this.wallGuns = wallGuns;
    this.setPap = setPap;
    this.showToast = showToast;
  }

  /** Find a spawn point: inside an UNLOCKED zone (never through a barrier),
   *  outside buildings/rubble, and at least 8 m from the player. */
  findSpawnPos() {
    const pos = new THREE.Vector3();
    const openZones = this.zones.filter((z) => z.unlocked);
    for (let tries = 0; tries < 30; tries++) {
      const zone = openZones[Math.floor(Math.random() * openZones.length)] || this.zones[0];
      const [minX, minZ, maxX, maxZ] = zone.rect;
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);
      const dx = x - this.controller.position.x;
      const dz = z - this.controller.position.z;
      if (dx * dx + dz * dz < 64) continue;
      if (!this.isBlocked(x, z)) return pos.set(x, 0, z);
    }
    // Last resort: a ring around the map center — the main zone always
    // keeps that area free of obstacles, so the zombie always spawns
    // somewhere the player can reach.
    const a = Math.random() * Math.PI * 2;
    return pos.set(Math.cos(a) * 12, 0, Math.sin(a) * 12);
  }

  /** A clear spawn spot near a point (falls back to the global picker). */
  findSpawnPosNear(pos) {
    const out = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 3;
      const x = pos.x + Math.cos(a) * r;
      const z = pos.z + Math.sin(a) * r;
      if (Math.abs(x) > this.arenaHalf - 1 || Math.abs(z) > this.arenaHalf - 1) continue;
      if (!this.isBlocked(x, z)) return out.set(x, 0, z);
    }
    return this.findSpawnPos();
  }

  /** Scatter one perk machine per perk on open ground, facing map center. */
  spawnPerkMachines(perks, papMachine) {
    const spots = [];
    for (const perk of perks) {
      for (let tries = 0; tries < 80; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 9;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(x) > this.arenaHalf - 2 || Math.abs(z) > this.arenaHalf - 2) continue;
        if (this.isBlocked(x, z)) continue;
        // Keep off the mystery box (0,0), the wall-Thompson spot (5,-11) and
        // every wall-gun / Pack-a-Punch mount placed before this loop.
        if (x * x + z * z < 9) continue;
        if ((x - 5) ** 2 + (z + 11) ** 2 < 9) continue;
        if (papMachine && (papMachine.mesh.position.x - x) ** 2 + (papMachine.mesh.position.z - z) ** 2 < 12) continue;
        if (this.wallGuns.some((g) => (g.mesh.position.x - x) ** 2 + (g.mesh.position.z - z) ** 2 < 8)) continue;
        if (spots.some(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < 16)) continue;
        const mesh = createPerkMachine(perk.label, perk.cost, perk.color);
        mesh.position.set(x, 0, z);
        mesh.rotation.y = Math.atan2(-x, -z); // brand panel faces the center
        this.scene.add(mesh);
        this.controller.obstacles.push(mesh);
        spots.push([x, z]);
        this.machines.push({ mesh, perk, used: false });
        break;
      }
    }
    if (this.machines.length) {
      this.showToast(`${this.machines.length} perk makinesi haritada — yaklaşıp E bas`);
    }
  }

  /**
   * Mount the three wall guns FLUSH on real wall faces and place the
   * Pack-a-Punch station on open ground in the core zone (pure solvers in
   * game/zombies.js). Each mount offers a different weapon for points; the
   * PaP upgrades the ACTIVE gun once per run.
   */
  spawnSpecialMachines({ names, runIndex, unlockedRects }) {
    const spots = machineSpots({ zones: this.zones, isBlocked: this.isBlocked, spin: runIndex * 0.7 });
    const trio = wallGunNames(names, runIndex);

    // Wall guns: hug building/perimeter walls, front facing the walkable side.
    const solids = [];
    for (const o of this.controller.obstacles) {
      const col = o.userData.collision;
      if (col) solids.push({ x: o.position.x, z: o.position.z, sx: col.size.x, sy: col.size.y, sz: col.size.z });
    }
    const mounts = wallGunSpots(solids, {
      isBlocked: this.isBlocked,
      zoneRects: unlockedRects,
      arenaHalf: this.arenaHalf,
      keepOut: [[0, 0, 4], [5, -11, 4], ...(spots.pap ? [[spots.pap[0], spots.pap[1], 6]] : [])],
    });
    // Fallback: on maps with few usable wall faces, top the trio up with
    // free-standing floor mounts (facing the map center).
    for (const [wx, wz] of spots.walls) {
      if (mounts.length >= trio.length) break;
      mounts.push({ x: wx, z: wz, rotY: Math.atan2(-wx, -wz) });
    }
    mounts.forEach((m, i) => {
      const weapon = trio[i % trio.length];
      const cost = wallGunCost(i);
      const label = WEAPON_LABELS[weapon] || weapon;
      const mesh = createWallGun(label, cost);
      mesh.position.set(m.x, 0, m.z);
      mesh.rotation.y = m.rotY; // flush on the wall, front off the face
      this.scene.add(mesh);
      this.wallGuns.push({ mesh, weapon, cost, used: false });
    });
    if (spots.pap) {
      const [x, z] = spots.pap;
      const mesh = createPapMachine(PAP_COST);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.atan2(-x, -z);
      this.scene.add(mesh);
      this.controller.obstacles.push(mesh);
      this.setPap({ mesh, used: false });
    }
    if (this.wallGuns.length || spots.pap) {
      this.showToast('🔫 Duvarda silahlar + PACK-A-PUNCH haritada — E ile kullan');
    }
  }
}
