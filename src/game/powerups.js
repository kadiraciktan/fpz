/**
 * game/powerups.js
 * Kill-drop power-up table + drop placement. Drops are Octahedron meshes
 * sharing one geometry (only the colour changes); pickups are applied by
 * the game loop via powerUpType().
 */

import * as THREE from 'three';
import { weightedPick } from '../weapons/ammo.js';

export const POWERUP_TYPES = [
  { key: 'Ammo', color: 0xffa726, label: 'CEP', weight: 24 },
  { key: 'MaxAmmo', color: 0x00ff88, label: 'MAX', weight: 8 },
  { key: 'InstaKill', color: 0xffff00, label: 'IK', weight: 12 },
  { key: 'Nuke', color: 0xffaa00, label: 'NUK', weight: 7 },
  { key: 'DoublePoints', color: 0x00ff00, label: 'x2', weight: 14 },
  { key: 'MedKit', color: 0xff5252, label: 'MED', weight: 14 },
  { key: 'Carpet', color: 0x8d6e63, label: 'CARPET', weight: 6 },
  { key: 'DoubleAmmo', color: 0xffb300, label: 'x2CEP', weight: 8 },
  { key: 'Dragon', color: 0xff6d00, label: 'EJDER', weight: 9 },
  { key: 'Shock', color: 0x40c4ff, label: 'ŞOK', weight: 9 },
  { key: 'FragRound', color: 0xef5350, label: 'PATLAR', weight: 6 },
];

export function powerUpType(key) {
  return POWERUP_TYPES.find((p) => p.key === key);
}

// One shared pickup mesh geometry — only the material is per-drop.
const POWERUP_GEO = new THREE.OctahedronGeometry(0.3, 0);

/** Drop one power-up in open ground near `pos` (already added to scene). */
export function spawnPowerUp(scene, pos, isBlocked, forcedKey = null) {
  const t = forcedKey ? powerUpType(forcedKey) : weightedPick(POWERUP_TYPES);
  const mat = new THREE.MeshStandardMaterial({
    color: t.color,
    emissive: t.color,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(POWERUP_GEO, mat);
  // Zombies walk through walls while dying — nudge the drop back toward the
  // map center until it sits in open ground the player can actually reach.
  let { x, z } = pos;
  if (isBlocked && isBlocked(x, z)) {
    const len = Math.hypot(x, z) || 1;
    const stepX = -x / len;
    const stepZ = -z / len;
    for (let i = 0; i < 40; i++) {
      x += stepX;
      z += stepZ;
      if (!isBlocked(x, z)) break;
    }
  }
  mesh.position.set(x, 0.5, z);
  mesh.castShadow = true;
  mesh.userData.key = t.key;
  scene.add(mesh);
  return mesh;
}
