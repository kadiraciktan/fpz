import * as THREE from 'three';
import {
  addBaseLights,
  addGround,
  addBurningBarrel,
  addSandbagWall,
  addCarWreck,
  addFence,
  addTankTrap,
  addRadioDesk,
  addGappedWall,
  addHangingBulb,
  addWreckedPlane,
  addWallStencil,
  addDebris,
  addUtilityPole,
  addWires,
} from './kit.js';

export const meta = {
  id: 'nacht',
  name: 'Nacht der Untoten',
  desc: 'Gece, sis, havaalanı sığınağı. Pencerelerden atlayarak sızıyorlar; iki kapıyı da aç, sığınağın çevresinde döngü kur.',
  swatch: 'linear-gradient(160deg, #1a1c14 0%, #4a5a28 45%, #0a0b08 100%)',
};

// ── MAP 4: Nacht der Untoten ──────────────────────────────────────────
//
// One two-storey bunker in the middle of a fenced night airfield.
//
//        N (help room, windows)
//   ┌────────┬──────────┬────────┐
//   │  west  ═   north   ═  east │   ═ open connector
//   │  wing  │   room    │  wing │
//   ├──▒▒────┴───────────┴──▒▒───┤   ▒ buyable door (750 / 1000)
//   │        spawn "HILFE"       │
//   └──══════─────────────══════─┘   ══ open window (zombies climb
//              S (runway)             through, player can jump the sill)
//
// Buying ONE door opens a kite loop: wing → north room → other wing.
// Buying the second completes the circuit back through spawn.

export function build(ctx) {
  const { scene } = ctx;

  scene.background = new THREE.Color(0x070806);
  addBaseLights(scene, {
    amb: 0x2a2e24, hemiSky: 0x3a4234, hemiGround: 0x141610,
    sunColor: 0x9fb2d8, sunInt: 0.22, fogColor: 0x0c0e0a, fogNear: 10, fogFar: 60,
  });
  addGround(scene, 0x2a2a22, 160);

  const conc = new THREE.MeshStandardMaterial({ color: 0x4a4e46, roughness: 0.96 });
  const concDark = new THREE.MeshStandardMaterial({ color: 0x383c36, roughness: 0.97 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0x5a584c, roughness: 0.98 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3d2c, roughness: 0.9 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2e2e28, roughness: 1 });

  const A = 28;
  ctx.arenaHalf = A;
  const TH = 0.7; // wall thickness
  const WH = 4.0; // wall height
  const Wy = WH / 2;

  // Open windows: decorative boards, low sill. The horde climbs through;
  // the player vaults with a jump.
  const addWindow = (x, z, rotY, width = 2.2) => ctx.addWindow({ x, z, rotY, width });

  // ── Bunker shell: x ∈ [-11, 11], z ∈ [-8, 23] ─────────────────────
  // South wall (spawn room, 2 windows onto the runway)
  addGappedWall(ctx, {
    axis: 'x', pos: -8, from: -11.35, to: 11.35, y: Wy, h: WH, thick: TH, mat: conc,
    gaps: [{ at: -5, width: 2.2 }, { at: 5, width: 2.2 }],
  });
  addWindow(-5, -8, 0);
  addWindow(5, -8, 0);

  // North wall (help room, 2 windows)
  addGappedWall(ctx, {
    axis: 'x', pos: 23, from: -11.35, to: 11.35, y: Wy, h: WH, thick: TH, mat: conc,
    gaps: [{ at: -5.5, width: 2.2 }, { at: 5.5, width: 2.2 }],
  });
  addWindow(-5.5, 23, 0);
  addWindow(5.5, 23, 0);

  // West wall (one window per room)
  addGappedWall(ctx, {
    axis: 'z', pos: -11, from: -8.35, to: 23.35, y: Wy, h: WH, thick: TH, mat: conc,
    gaps: [{ at: -2, width: 2.2 }, { at: 10, width: 2.2 }, { at: 19.5, width: 2.0 }],
  });
  addWindow(-11, -2, Math.PI / 2);
  addWindow(-11, 10, Math.PI / 2);
  addWindow(-11, 19.5, Math.PI / 2, 2.0);

  // East wall (mirror)
  addGappedWall(ctx, {
    axis: 'z', pos: 11, from: -8.35, to: 23.35, y: Wy, h: WH, thick: TH, mat: conc,
    gaps: [{ at: -2, width: 2.2 }, { at: 10, width: 2.2 }, { at: 19.5, width: 2.0 }],
  });
  addWindow(11, -2, -Math.PI / 2);
  addWindow(11, 10, -Math.PI / 2);
  addWindow(11, 19.5, -Math.PI / 2, 2.0);

  // ── Interior partitions ────────────────────────────────────────────
  // Spawn / wings divider with the two buyable door gaps.
  addGappedWall(ctx, {
    axis: 'x', pos: 4, from: -11, to: 11, y: Wy, h: WH, thick: TH, mat: concDark,
    gaps: [{ at: -5.5, width: 3.0 }, { at: 5.5, width: 3.0 }],
  });
  // Spine between the wings.
  addGappedWall(ctx, {
    axis: 'z', pos: 0, from: 4.35, to: 16, y: Wy, h: WH, thick: TH, mat: concDark,
    gaps: [],
  });
  // Wings / help-room divider — connectors stay open (free loop).
  addGappedWall(ctx, {
    axis: 'x', pos: 16, from: -11, to: 11, y: Wy, h: WH, thick: TH, mat: concDark,
    gaps: [{ at: -5.5, width: 2.4 }, { at: 5.5, width: 2.4 }],
  });

  // ── Zones & doors ──────────────────────────────────────────────────
  // Spawns are OUTDOOR-only: the horde always arrives through windows or
  // the fields, never materializes inside the bunker with the player.
  ctx.addZone('field-s', [-A, -A, A, -9]);
  ctx.addZone('field-w', [-A, -9, -12, A]);
  ctx.addZone('field-e', [12, -9, A, A]);
  ctx.addZone('field-n', [-11, 24, 11, A]);

  ctx.addGateBarrier({
    x: -5.5, z: 4, width: 3.0, cost: 750, style: 'wood',
    zone: 'west', rect: [-11, 4, 0, 23],
  });
  ctx.addGateBarrier({
    x: 5.5, z: 4, width: 3.0, cost: 1000, style: 'wood',
    zone: 'east', rect: [0, 4, 11, 23],
  });

  // ── Roof & upper-storey silhouette (visual only, no collision) ─────
  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(23.4, 0.25, 32.4),
    new THREE.MeshStandardMaterial({ color: 0x1c1e18, roughness: 1 })
  );
  ceil.position.set(0, 4.15, 7.5);
  scene.add(ceil);
  for (const [w, d, x, z] of [
    [23.4, 0.55, 0, -8], [23.4, 0.55, 0, 23],
    [0.55, 31.9, -11, 7.5], [0.55, 31.9, 11, 7.5],
  ]) {
    ctx.addBox(w, 2.4, d, x, 5.4, z, concDark, { collide: false });
  }
  const nightGlass = new THREE.MeshStandardMaterial({
    color: 0x1a1810, emissive: 0x3a3010, emissiveIntensity: 0.15, roughness: 0.4,
  });
  for (const [x, z, rotY] of [[-5, -8.2, 0], [5, -8.2, 0], [0, 23.2, Math.PI], [-11.2, 7, Math.PI / 2]]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.12), nightGlass);
    win.position.set(x, 5.4, z);
    win.rotation.y = rotY;
    scene.add(win);
  }

  // ── Interiors ──────────────────────────────────────────────────────
  // Spawn "HILFE" room
  addWallStencil(ctx, 0, 2.4, -7.55, 0, 'HILFE', '#c9b27a');
  addRadioDesk(ctx, -6.5, 1.2, 0.2);
  ctx.addCrateRing([[7.6, 0, -5.6], [8.6, 0, -4.4], [-8.4, 0, -5.2]], 1.15);
  ctx.addBox(1.8, 0.85, 0.7, 3.2, 0.45, 1.6, wood, { rotY: 0.25 });
  ctx.addBox(0.55, 0.9, 0.55, 4.4, 0.45, 0.7, wood);
  addHangingBulb(ctx, -4, -2, { flicker: true });
  addHangingBulb(ctx, 4.5, -0.5, { flicker: false });

  // West wing (hallway)
  addWallStencil(ctx, -10.6, 2.4, 13, Math.PI / 2, 'RAUS', '#8a7a55');
  ctx.addCrateRing([[-8.9, 0, 6.4], [-2.2, 0, 13.8]], 1.2);
  ctx.addBox(1.6, 0.8, 0.7, -7.4, 0.4, 14.6, wood, { rotY: -0.2 });
  addHangingBulb(ctx, -6, 9.5, { flicker: true });
  addHangingBulb(ctx, -4.5, 14.5, { flicker: false });

  // East wing (stairs room): a flight climbing to the blown-out upper
  // floor. Decorative — the fight stays downstairs.
  for (let i = 0; i < 8; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.44), wood);
    step.position.set(9.1, 0.12 + i * 0.24, 6.8 + i * 0.42);
    scene.add(step);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 3.4), wood);
  rail.position.set(8.3, 1.05, 8.4);
  scene.add(rail);
  const landing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.2), wood);
  landing.position.set(9.2, 2.1, 11.4);
  scene.add(landing);
  ctx.addCrateRing([[3.2, 0, 6.2], [8.2, 0, 14.2]], 1.2);
  addHangingBulb(ctx, 5.5, 9, { flicker: false });
  addHangingBulb(ctx, 4, 14.5, { flicker: true });

  // North help room: field bunks + a dead radio.
  addRadioDesk(ctx, 0, 21.6, Math.PI);
  for (const bx of [-8, 8]) {
    ctx.addBox(2.2, 0.5, 4.4, bx, 0.3, 19.5, wood);
    ctx.addBox(2.0, 0.16, 4.0, bx, 0.62, 19.5, plaster);
  }
  ctx.addCrateRing([[-3.6, 0, 21.4], [3.8, 0, 17.6]], 1.1);
  addHangingBulb(ctx, -3, 19.5, { flicker: true });
  addHangingBulb(ctx, 3.5, 20.5, { flicker: false });

  // ── Airfield ───────────────────────────────────────────────────────
  // East-west runway across the south field.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(52, 9), asphalt);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.02, -17);
  scene.add(strip);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x6a6550, roughness: 1 });
  for (let x = -24; x <= 24; x += 5) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.03, -17);
    scene.add(dash);
  }

  addWreckedPlane(ctx, -16, -17, 1.35);
  addWreckedPlane(ctx, 15, -21, -1.9);
  addCarWreck(ctx, 15, -6, 0.4, 0x3a3e34);
  addCarWreck(ctx, -17, 3, -1.2, 0x40443a);

  // Defenses hugging the bunker windows.
  addSandbagWall(ctx, -5, -10.2, 4, 0.05);
  addSandbagWall(ctx, 5, -10.2, 4, -0.08);
  addSandbagWall(ctx, -13.2, -2, 3, Math.PI / 2);
  addSandbagWall(ctx, 13.2, 10, 3, -Math.PI / 2);
  addSandbagWall(ctx, 0, 25.4, 5, 0);
  addTankTrap(ctx, -9, -12);
  addTankTrap(ctx, 8, -13);
  addTankTrap(ctx, -20, -22);
  addTankTrap(ctx, 19, 16);
  addFence(ctx, -19, -7, 8, 0.2);
  addFence(ctx, 18, 0, 7, -0.15);
  addFence(ctx, -16, 18, 6, 1.35);

  // Night light: scattered fires draw the eye (and the horde silhouettes).
  addBurningBarrel(ctx, -13.5, -11);
  addBurningBarrel(ctx, 12.5, -15);
  addBurningBarrel(ctx, -16, 12);
  addBurningBarrel(ctx, 15, 20);
  addBurningBarrel(ctx, 0, -24);

  // Telegraph poles fading into the fog down the west field.
  addWires(scene, [
    addUtilityPole(ctx, -23, -20),
    addUtilityPole(ctx, -23, -8),
    addUtilityPole(ctx, -23, 4, true),
    addUtilityPole(ctx, -23, 16),
  ]);

  // Perimeter (concrete ring so nothing kites out of the arena).
  ctx.addBox(A * 2 + 2, 3.2, 1, 0, 1.6, -(A + 0.4), concDark);
  ctx.addBox(A * 2 + 2, 3.2, 1, 0, 1.6, A + 0.4, concDark);
  ctx.addBox(1, 3.2, A * 2 + 1, -(A + 0.4), 1.6, 0, concDark);
  ctx.addBox(1, 3.2, A * 2 + 1, A + 0.4, 1.6, 0, concDark);

  const debrisMats = [conc, concDark, plaster, wood];
  addDebris(scene, 0, -13, 8, 20, debrisMats);
  addDebris(scene, -16, 6, 5, 12, debrisMats);
  addDebris(scene, 16, 8, 5, 12, debrisMats);
  addDebris(scene, 0, 0, 6, 12, debrisMats);
  addDebris(scene, 0, 19, 5, 10, debrisMats);

  ctx.addTargets([
    [-6, 0, -4], [6.5, 0, 1], [-5, 0, 10], [5, 0, 12], [0, 0, 20],
    [-14, 0, -12], [12, 0, -16], [0, 0, -21],
  ]);
}
