import * as THREE from 'three';
import { createStreetLamp } from '../gfx/Prefabs.js';
import {
  addBaseLights,
  addGround,
  addBurningBarrel,
  addSandbagWall,
  addFence,
  addTankTrap,
  addDebris,
  addHangingBulb,
  addRadioDesk,
  addWallStencil,
  addUtilityPole,
  addWires,
} from './kit.js';
import {
  addTombstoneRow,
  addBushCluster,
  addWatchtower,
  addBarbedFence,
  addCrateStack,
  addDeadTree,
  addCrater,
} from './props.js';

export const meta = {
  id: 'sunak',
  name: 'Sunak Köşkü',
  desc: 'BÖLÜM 4 · Bahçeden kryiptaya lineer ilerleyen gece köşkü. Üç kapı, bir sunak, bir son dalga.',
  swatch: 'linear-gradient(160deg, #1a1c14 0%, #4a3a58 45%, #0a0b08 100%)',
  missionOnly: true,
};

// ── MISSION MAP 4: linear night manor ─────────────────────────────────
//
//   ┌──────────────────────┐  z 76..94
//   │  KRYİPTA             │  final hold — sarcophagi + brazier ring
//   ├══════ gate 3 (1000) ═┤
//   │  ŞAPEL               │  z 44..64  pews, candles, the ALTAR
//   ├══════ gate 2 (750) ══┤
//   │  KÖŞK HOLÜ           │  z 18..38  fireplace, grand stair, tables
//   ├══════ gate 1 (500) ══┤
//   │  BAHÇE (spawn)       │  z -12..12  fountain, hedges, gazebo
//   └──────────────────────┘
//
// Nacht's mood, one straight line: the horde comes out of the garden and
// the player fights door by door toward the altar that is calling them.

export function build(ctx) {
  const { scene, obstacles } = ctx;

  scene.background = new THREE.Color(0x07080a);
  addBaseLights(scene, {
    amb: 0x2a2634, hemiSky: 0x3a3448, hemiGround: 0x14121a,
    sunColor: 0x9fb2d8, sunInt: 0.2, fogColor: 0x0b0a10, fogNear: 12, fogFar: 68,
  });
  addGround(scene, 0x242420, 220);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4a44, roughness: 0.96 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x38383a, roughness: 0.97 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0x5a5450, roughness: 0.98 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3d2c, roughness: 0.9 });
  const marble = new THREE.MeshStandardMaterial({ color: 0x6a6a64, roughness: 0.55, metalness: 0.1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x8a6a20, roughness: 0.35, metalness: 0.85 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x24361f, roughness: 1 });
  const debrisMats = [stoneMat, stoneDark, plaster, wood];

  const X = 22;
  const Z0 = -14;
  const Z1 = 96;
  ctx.arenaHalf = Z1;

  const TH = 0.7;
  const WH = 4.6;
  const Wy = WH / 2;

  // Perimeter: garden + halls inside one stone wall.
  ctx.addBox(1, 6, Z1 - Z0 + 2, -(X + 0.5), 3, (Z0 + Z1) / 2, stoneDark);
  ctx.addBox(1, 6, Z1 - Z0 + 2, X + 0.5, 3, (Z0 + Z1) / 2, stoneDark);
  ctx.addBox(X * 2 + 2, 6, 1, 0, 3, Z0 - 0.5, stoneDark);
  ctx.addBox(X * 2 + 2, 6, 1, 0, 3, Z1 + 0.5, stoneDark);

  const addGate = (z, cost, style, zone, rect) => {
    const GATE = 6;
    const wallW = X - GATE / 2;
    ctx.addBox(wallW, WH, TH, -(GATE / 2 + wallW / 2), Wy, z, stoneMat);
    ctx.addBox(wallW, WH, TH, (GATE / 2 + wallW / 2), Wy, z, stoneMat);
    ctx.addBox(GATE + 1.4, 1.2, TH + 0.2, 0, WH + 0.4, z, stoneMat); // arch lintel
    ctx.addGateBarrier({ x: 0, z, width: 6, cost, style, zone, rect });
  };

  // ══ ZONE 1: bahçe (spawn, z -12..12) ═══════════════════════════════
  // Dry fountain at the centre, hedge maze arms, a collapsed gazebo.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 20), marble);
  basin.position.set(0, 0.4, 2);
  basin.castShadow = true;
  basin.receiveShadow = true;
  scene.add(basin);
  const statue = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 2.6, 10), marble);
  statue.position.set(0, 1.7, 2);
  statue.castShadow = true;
  scene.add(statue);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), marble);
  head.position.set(0.5, 2.6, 2.3);
  head.rotation.z = 0.5; // toppled saint
  head.castShadow = true;
  scene.add(head);
  ctx.addCollisionBox(0, 0.8, 2, new THREE.Vector3(6.6, 0.8, 6.6));
  // Hedge walls (waist-high, walk-around cover).
  for (const [hx, hz, hw, hd] of [
    [-12, -4, 10, 1.2], [12, -4, 10, 1.2], [-12, 6, 1.2, 10], [12, 6, 1.2, 10],
    [-6, -11, 1.2, 8], [6, -11, 1.2, 8], [-18, 0, 6, 1.2],
  ]) {
    ctx.addBox(hw, 1.3, hd, hx, 0.65, hz, hedgeMat);
  }
  // Gazebo: posts + a domed roof that half survived.
  const gz = new THREE.Group();
  gz.position.set(15, 0, -8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), wood);
    post.position.set(Math.cos(a) * 2.2, 1.3, Math.sin(a) * 2.2);
    post.rotation.z = i === 2 ? 0.3 : 0; // one post snapped
    post.castShadow = true;
    gz.add(post);
  }
  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.3, 8), stoneDark);
  dome.position.y = 3.2;
  dome.rotation.z = 0.12;
  dome.castShadow = true;
  gz.add(dome);
  scene.add(gz);
  ctx.addCollisionBox(15, 1.3, -8, new THREE.Vector3(4.4, 2.6, 4.4));
  // Garden benches + lamps along the gravel path.
  for (const [bx, bz, brot] of [[-8, 8, 0], [8, 8, 0], [-16, -8, Math.PI / 2], [4, -12, 0]]) {
    ctx.addBox(2.2, 0.45, 0.6, bx, 0.25, bz, wood, { rotY: brot });
  }
  for (const [x, z] of [[-8, 10], [8, 10], [-18, -2], [18, 4], [0, -12]]) {
    const lamp = createStreetLamp((x + z) % 3 === 0);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    obstacles.push(lamp);
  }
  addSandbagWall(ctx, -6, 11, 4, 0);
  addSandbagWall(ctx, 7, 11, 4, 0);
  addFence(ctx, -19, 12, 6, 0.1);
  addFence(ctx, 19, -12, 5, -0.2);
  addTankTrap(ctx, -3, -6);
  addTankTrap(ctx, 4, 6);
  addTankTrap(ctx, -14, 10);
  // Props pass: the cult keeps a lookout tower over the garden and an
  // old tomb row by the east wall; wire blocks the south gravel path.
  addWatchtower(ctx, -12, -8, 0.5);
  addTombstoneRow(ctx, 16, -2, 3, 0.15);
  addBarbedFence(ctx, -6, -13, 6, 0);
  addBushCluster(ctx, -19, 4, 0.8, 2);
  addBushCluster(ctx, 19, -6, 1.0, 2);
  // Two lightning-dead trees flank the lawn; a shell hole craters the west grass.
  addDeadTree(ctx, -16, -2, 4.6);
  addDeadTree(ctx, 14, 10, 4.2);
  addCrater(ctx, -8, -4, 1.5);
  addBurningBarrel(ctx, -16, 6);
  addBurningBarrel(ctx, 16, -2);
  ctx.addCrateRing([[-19, 0, 8], [-17.6, 0, 8], [19, 0, 10], [20.4, 0, 10], [-4, 0, -10]], 1.2);
  addWires(scene, [
    addUtilityPole(ctx, -X + 2, -12),
    addUtilityPole(ctx, -X + 2, -2, true),
    addUtilityPole(ctx, -X + 2, 8),
  ]);
  addWallStencil(ctx, -X + 0.4, 2.4, 6, Math.PI / 2, 'İÇERİ GİRME', '#b39ddb');
  addDebris(scene, 0, 4, 11, 24, debrisMats);
  ctx.addTargets([[-8, 0, 6], [9, 0, 2], [-4, 0, -8], [16, 0, 8], [-16, 0, -6]]);

  ctx.addZone('bahce', [-X + 2, Z0 + 3, X - 2, 12]);
  addGate(14, 500, 'wood', 'hol', [-X + 2, 18, X - 2, 38]);

  // ══ ZONE 2: köşk holü (z 18..38) ═══════════════════════════════════
  ceiling(ctx, 18, 40);
  // Grand staircase climbing the north wall (decor — the fight stays down).
  for (let i = 0; i < 10; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 0.55), marble);
    step.position.set(0, 0.1 + i * 0.22, 36 - i * 0.55);
    step.receiveShadow = true;
    scene.add(step);
  }
  for (const sx of [-4.2, 4.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 6.2), wood);
    rail.position.set(sx, 1.7, 33.4);
    rail.rotation.x = -0.36;
    rail.castShadow = true;
    scene.add(rail);
  }
  const landing = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 3), marble);
  landing.position.set(0, 2.35, 37.4);
  scene.add(landing);
  // Fireplace on the west wall: stone stack + ember glow.
  const chim = new THREE.Group();
  chim.position.set(-X + 1.4, 0, 28);
  const stack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.4, 3.6), stoneMat);
  stack.position.y = 2.2;
  stack.castShadow = true;
  chim.add(stack);
  const hearth = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.4, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x3a1408, emissive: 0xff5a10, emissiveIntensity: 1.6 })
  );
  hearth.position.set(0.85, 0.9, 0);
  chim.add(hearth);
  const ember = new THREE.PointLight(0xff6a20, 1.6, 12, 2);
  ember.position.set(1.6, 1.1, 0);
  chim.add(ember);
  scene.add(chim);
  ctx.addCollisionBox(-X + 1.4, 2.2, 28, new THREE.Vector3(1.8, 4.4, 3.8));
  // Banquet tables: waist-high cover down the hall.
  for (const [tx, tz, tr] of [[-8, 22, 0.1], [8, 24, -0.1], [-6, 32, 0.3], [9, 33, -0.2]]) {
    ctx.addBox(4.4, 0.9, 1.6, tx, 0.45, tz, wood, { rotY: tr });
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8), plaster);
      plate.position.set(tx - 1.4 + i * 1.4, 0.93, tz);
      scene.add(plate);
    }
  }
  // Candelabra posts.
  for (const [cx, cz] of [[-14, 20], [14, 22], [-12, 34], [13, 36]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.9, 8), gold);
    pole.position.set(cx, 0.95, cz);
    pole.castShadow = true;
    scene.add(pole);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xffa030, emissiveIntensity: 2 })
    );
    flame.position.set(cx, 1.95, cz);
    scene.add(flame);
    const pl = new THREE.PointLight(0xffb060, 0.9, 9, 2);
    pl.position.set(cx, 2.05, cz);
    scene.add(pl);
    ctx.addCollisionBox(cx, 0.95, cz, new THREE.Vector3(0.5, 1.9, 0.5));
  }
  addHangingBulb(ctx, -6, 26, { flicker: true });
  addHangingBulb(ctx, 6, 30, { flicker: false });
  ctx.addCrateRing([[-18, 0, 19], [-16.6, 0, 19], [17, 0, 28], [18.4, 0, 28], [-2, 0, 37]], 1.2);
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  ctx.addBox(1.6, 0.8, 0.9, -17, 0.4, 30, ammoMat, { rotY: 0.3 });
  ctx.addBox(1.6, 0.8, 0.9, 16, 0.4, 19, ammoMat, { rotY: -0.3 });
  addBurningBarrel(ctx, -18, 24);
  addBurningBarrel(ctx, 18, 34);
  addCrateStack(ctx, 19, 21, -0.4);
  addWallStencil(ctx, X - 0.4, 2.6, 26, -Math.PI / 2, 'SESİ DUYUYORUM', '#b39ddb');
  addDebris(scene, 0, 28, 11, 26, debrisMats);
  ctx.addTargets([[-6, 0, 20], [7, 0, 27], [-14, 0, 32], [14, 0, 20], [0, 0, 34]]);

  addGate(40, 750, 'wood', 'sapel', [-X + 2, 44, X - 2, 64]);

  // ══ ZONE 3: şapel (z 44..64) — the altar ═══════════════════════════
  ceiling(ctx, 40, 66);
  // Pews: four rows of knee-high benches facing the altar.
  for (let row = 0; row < 4; row++) {
    const pz = 46 + row * 3.4;
    for (const px of [-6, 6]) {
      ctx.addBox(7, 0.9, 0.7, px, 0.45, pz, wood);
      const back = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 0.14), wood);
      back.position.set(px, 1.2, pz - 0.3);
      back.castShadow = true;
      scene.add(back);
    }
  }
  // The altar at the far end — the mission's interact point.
  const altar = new THREE.Group();
  altar.position.set(0, 0, 60);
  const stepA = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 4), marble);
  stepA.position.y = 0.12;
  altar.add(stepA);
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 1.6), marble);
  table.position.y = 0.85;
  table.castShadow = true;
  altar.add(table);
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.12, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x3a1030, roughness: 0.9 })
  );
  cloth.position.y = 1.5;
  altar.add(cloth);
  const idol = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), gold);
  idol.position.y = 2.25;
  idol.castShadow = true;
  altar.add(idol);
  const glow = new THREE.PointLight(0xb388ff, 1.8, 14, 2);
  glow.position.set(0, 2.4, 0.8);
  altar.add(glow);
  for (const sx of [-2.2, 2.2]) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), plaster);
    candle.position.set(sx, 1.85, 0.5);
    altar.add(candle);
    const fl = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xffa030, emissiveIntensity: 2.2 })
    );
    fl.position.set(sx, 2.2, 0.5);
    altar.add(fl);
  }
  scene.add(altar);
  ctx.addCollisionBox(0, 0.9, 60, new THREE.Vector3(3.4, 1.8, 1.8));
  // Stained-glass rose window (emissive disc, no collision) + columns.
  const rose = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x3a1a4a, emissive: 0x7a3aa0, emissiveIntensity: 1.1, side: THREE.DoubleSide })
  );
  rose.position.set(0, 3.4, 65.5);
  rose.rotation.y = Math.PI;
  scene.add(rose);
  for (const [cx, cz] of [[-10, 48], [10, 48], [-10, 58], [10, 58], [-14, 53], [14, 53]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, WH, 12), stoneMat);
    col.position.set(cx, Wy, cz);
    col.castShadow = true;
    scene.add(col);
    ctx.addCollisionBox(cx, Wy, cz, new THREE.Vector3(1.3, WH, 1.3));
  }
  // votive candle stand + brazier
  const votive = ctx.addBox(2.4, 1.1, 0.9, -14, 0.55, 47, wood);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xffa030, emissiveIntensity: 1.6 })
    );
    c.position.set(-15 + (i % 4) * 0.6, 1.22, 46.6 + Math.floor(i / 4) * 0.4);
    scene.add(c);
  }
  addBurningBarrel(ctx, 14, 47);
  addBurningBarrel(ctx, -12, 62);
  addBurningBarrel(ctx, 12, 62);
  addSandbagWall(ctx, -8, 45, 4, 0);
  addSandbagWall(ctx, 8, 45, 4, 0);
  addTankTrap(ctx, -4, 63);
  addTankTrap(ctx, 5, 63);
  ctx.addCrateRing([[-19, 0, 46], [-17.6, 0, 46], [18, 0, 60], [19.4, 0, 60]], 1.2);
  ctx.addBox(1.6, 0.8, 0.9, 16, 0.4, 52, ammoMat, { rotY: -0.2 });
  addHangingBulb(ctx, 0, 50, { flicker: true });
  addWallStencil(ctx, -X + 0.4, 2.6, 56, Math.PI / 2, 'MÜHÜRLE', '#b39ddb');
  addDebris(scene, 0, 54, 11, 26, debrisMats);
  ctx.addTargets([[-6, 0, 46], [6, 0, 50], [-12, 0, 56], [12, 0, 58], [0, 0, 63]]);

  addGate(66, 1000, 'steel', 'kripta', [-X + 2, 68, X - 2, Z1 - 3]);

  // ══ ZONE 4: kryipta (final hold, z 68..93) ═════════════════════════
  ceiling(ctx, 66, Z1);
  // Round burial floor + a ring of braziers (the hold fight circles these).
  const crypt = new THREE.Mesh(new THREE.CylinderGeometry(14, 14.5, 0.18, 28), stoneDark);
  crypt.position.set(0, 0.09, 80);
  crypt.receiveShadow = true;
  scene.add(crypt);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = Math.cos(a) * 8;
    const bz = 80 + Math.sin(a) * 8;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.5, 10), gold);
    bowl.position.set(bx, 1.1, bz);
    bowl.castShadow = true;
    scene.add(bowl);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.9, 6), gold);
    leg.position.set(bx, 0.45, bz);
    scene.add(leg);
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xff8a30, emissive: 0xff5500, emissiveIntensity: 2.2 })
    );
    fire.position.set(bx, 1.45, bz);
    scene.add(fire);
    const pl = new THREE.PointLight(0xff7a20, 1.3, 11, 2);
    pl.position.set(bx, 1.6, bz);
    scene.add(pl);
    ctx.addCollisionBox(bx, 0.8, bz, new THREE.Vector3(1.1, 1.6, 1.1));
  }
  // Sarcophagi: heavy stone cover slabs.
  for (const [sx, sz, sr] of [
    [-14, 72, 0.2], [14, 72, -0.2], [-15, 86, 0.5], [15, 86, -0.5], [0, 91, 0],
  ]) {
    ctx.addBox(2.4, 1.3, 4.2, sx, 0.65, sz, marble, { rotY: sr });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 4.4), stoneMat);
    lid.position.set(sx + 0.15, 1.4, sz);
    lid.rotation.set(0.04, sr, 0.06);
    lid.castShadow = true;
    scene.add(lid);
  }
  // Wall niches with skull shelves (decor rows).
  for (const nx of [-X + 1.2, X - 1.2]) {
    for (let i = 0; i < 4; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.6), stoneMat);
      shelf.position.set(nx, 1.2 + i * 0.8, 74 + i * 2);
      scene.add(shelf);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), plaster);
      skull.position.set(nx, 1.36 + i * 0.8, 74 + i * 2);
      scene.add(skull);
    }
  }
  addRadioDesk(ctx, -12, 90, Math.PI / 2);
  ctx.addCrateRing([[-19, 0, 69], [-17.6, 0, 69], [18, 0, 78], [19.4, 0, 78]], 1.2);
  ctx.addBox(1.6, 0.8, 0.9, 8, 0.4, 91, ammoMat, { rotY: 0.2 });
  addSandbagWall(ctx, -6, 69, 4, 0);
  addSandbagWall(ctx, 6, 69, 4, 0);
  // Props pass: an older grave row on the crypt's east lip + crate stack
  // for the last-ditch crouch.
  addTombstoneRow(ctx, 5, 71, 2, -0.3);
  addCrateStack(ctx, 10, 70, 0.6);
  addHangingBulb(ctx, 0, 72, { flicker: true });
  addHangingBulb(ctx, 0, 84, { flicker: false });
  addWallStencil(ctx, 0, 2.6, Z1 - 0.9, Math.PI, 'SESİ KES', '#b388ff');
  addDebris(scene, 0, 80, 12, 30, debrisMats);
  ctx.addTargets([[-8, 0, 70], [8, 0, 74], [-12, 0, 82], [12, 0, 84], [0, 0, 88]]);

  // ── local helper: stone ceiling over one hall span ──
  function ceiling(c, zFrom, zTo) {
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(X * 2 + 1, zTo - zFrom),
      new THREE.MeshStandardMaterial({ color: 0x1a1820, roughness: 1 })
    );
    slab.rotation.x = Math.PI / 2;
    slab.position.set(0, WH + 0.9, (zFrom + zTo) / 2);
    c.scene.add(slab);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.9 });
    for (let z = zFrom + 3; z < zTo; z += 6) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(X * 2, 0.3, 0.5), beamMat);
      beam.position.set(0, WH + 0.5, z);
      c.scene.add(beam);
    }
  }
}
