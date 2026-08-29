import * as THREE from 'three';
import { createStreetLamp } from '../gfx/Prefabs.js';
import {
  addBaseLights,
  addGround,
  addBurningBarrel,
  addSandbagWall,
  addFacade,
  addCarWreck,
  addFence,
  addBusStop,
  addMarketStall,
  addTramWreck,
  addTankTrap,
  addUtilityPole,
  addWires,
  addDebris,
  createWarSkyCubeTexture,
} from './kit.js';

export const meta = {
  id: 'street',
  name: 'Savaş Sokakları',
  desc: 'İki katlı yıkık cepheler, yanmış araçlar, telefon direkleri. Kuzey ve güney barikatlarını aç, sokağı genişlet.',
  swatch: 'linear-gradient(160deg, #8a8578 0%, #6e5a4a 55%, #4a463c 100%)',
};

// ── MAP 1: war-torn street ────────────────────────────────────────────

export function build(ctx) {
  const { scene, obstacles } = ctx;

  scene.background = createWarSkyCubeTexture();
  addBaseLights(scene, {
    amb: 0xb8b4a8, hemiSky: 0x9a9a8f, hemiGround: 0x4a463c,
    sunColor: 0xd8d2c0, sunInt: 0.9, fogColor: 0x8a8578, fogNear: 40, fogFar: 160,
  });
  addGround(scene, 0x4a463c, 300);

  const brickMat = new THREE.MeshStandardMaterial({ color: 0x6e5a4a, roughness: 0.95 });
  const brickDarkMat = new THREE.MeshStandardMaterial({ color: 0x54453a, roughness: 0.95 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5850, roughness: 0.9 });
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 1.0 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.85 });
  const A = 60; // arena half-extent

  // Distant ruined skyline (decor only)
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x6a675e, roughness: 1.0 });
  const skylineMatFar = new THREE.MeshStandardMaterial({ color: 0x7d7a6e, roughness: 1.0 });
  const skylineDefs = [
    { pos: [0, 0, -135], w: 30, h: 18, d: 12, mat: skylineMat },
    { pos: [-60, 0, -128], w: 22, h: 14, d: 10, mat: skylineMatFar },
    { pos: [64, 0, -126], w: 26, h: 16, d: 10, mat: skylineMatFar },
    { pos: [-115, 0, -80], w: 20, h: 12, d: 9, mat: skylineMatFar },
    { pos: [115, 0, -80], w: 22, h: 13, d: 9, mat: skylineMatFar },
    { pos: [-128, 0, 20], w: 24, h: 15, d: 10, mat: skylineMatFar },
    { pos: [128, 0, 20], w: 24, h: 14, d: 10, mat: skylineMatFar },
    { pos: [-110, 0, 95], w: 21, h: 13, d: 9, mat: skylineMatFar },
    { pos: [112, 0, 96], w: 23, h: 15, d: 9, mat: skylineMatFar },
    { pos: [0, 0, 135], w: 34, h: 16, d: 12, mat: skylineMat },
    { pos: [-62, 0, 130], w: 24, h: 17, d: 11, mat: skylineMatFar },
    { pos: [62, 0, 128], w: 26, h: 15, d: 11, mat: skylineMatFar },
  ];
  for (const { pos, w, h, d, mat } of skylineDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(pos[0], h / 2 - 0.5, pos[2]);
    m.rotation.y = (Math.random() - 0.5) * 0.2;
    scene.add(m);
    // Lit windows in a few surviving far towers (cheap emissive dots).
    if (h > 14) {
      const litFar = new THREE.MeshStandardMaterial({ color: 0x2f2818, emissive: 0x8a6a30, emissiveIntensity: 0.5 });
      for (let i = 0; i < 6; i++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.1), litFar);
        win.position.set(
          pos[0] + (Math.random() - 0.5) * w * 0.8,
          1.5 + Math.random() * (h - 3),
          pos[2] + d / 2 + 0.06,
        );
        scene.add(win);
      }
    }
  }

  // Ruined buildings along the street
  const buildingDefs = [
    { pos: [-14, -18], w: 8, d: 6, h: 5.5, rot: 0.1 },
    { pos: [14, -14], w: 7, d: 5, h: 4.5, rot: -0.15 },
    { pos: [-15, 4], w: 6, d: 7, h: 6, rot: 0.05 },
    { pos: [15, 8], w: 8, d: 5, h: 4, rot: 0.2 },
    { pos: [-13, 24], w: 7, d: 6, h: 5, rot: -0.1 },
    { pos: [13, 26], w: 6, d: 5, h: 4.5, rot: 0.12 },
    { pos: [0, -33], w: 10, d: 6, h: 5, rot: 0 },
    { pos: [0, 34], w: 9, d: 5, h: 4, rot: 0.08 },
    { pos: [-24, -6], w: 7, d: 6, h: 4.5, rot: 0.35 },
    { pos: [24, 14], w: 8, d: 6, h: 5.5, rot: -0.3 },
    { pos: [-25, 18], w: 6, d: 5, h: 4, rot: 0.15 },
    { pos: [26, -24], w: 7, d: 5, h: 5, rot: -0.2 },
    { pos: [-22, -30], w: 8, d: 6, h: 6, rot: 0.05 },
    { pos: [20, 34], w: 7, d: 6, h: 4.5, rot: 0.25 },
  ];
  for (const b of buildingDefs) {
    const g = new THREE.Group();
    g.position.set(b.pos[0], 0, b.pos[1]);
    g.rotation.y = b.rot;

    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h * 0.6, b.d), brickMat);
    body.position.y = b.h * 0.3;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.7, b.h * 0.4, b.d * 0.8), brickDarkMat);
    top.position.set(b.w * 0.1, b.h * 0.75, -b.d * 0.1);
    top.rotation.z = 0.12;
    top.rotation.x = -0.06;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    for (let i = 0; i < 4; i++) {
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 + Math.random() * 0.8, 0.5 + Math.random() * 0.6, 0.6 + Math.random() * 0.6),
        i % 2 ? brickMat : brickDarkMat
      );
      chunk.position.set(
        (Math.random() - 0.5) * b.w * 0.8,
        0.3,
        b.d * 0.5 + 0.5 + Math.random() * 1.5
      );
      chunk.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      g.add(chunk);
    }

    scene.add(g);
    ctx.addCollisionBox(b.pos[0], b.h * 0.3, b.pos[1], new THREE.Vector3(b.w, b.h * 0.6, b.d), b.rot);
  }

  // Wooden barricades
  const barricadeDefs = [
    { pos: [-4, -8], w: 4, h: 1.6, d: 0.5, rot: 0.3 },
    { pos: [4, -6], w: 3.5, h: 1.4, d: 0.5, rot: -0.4 },
    { pos: [-5, 6], w: 4, h: 1.5, d: 0.5, rot: 0.1 },
    { pos: [5, 10], w: 3, h: 1.3, d: 0.5, rot: 0.5 },
    { pos: [0, 16], w: 5, h: 1.6, d: 0.5, rot: -0.1 },
    { pos: [-8, 14], w: 3, h: 1.4, d: 0.5, rot: 0.8 },
    { pos: [8, -20], w: 4, h: 1.5, d: 0.5, rot: 0.2 },
    { pos: [-9, -22], w: 3.5, h: 1.4, d: 0.5, rot: -0.2 },
    { pos: [-32, -14], w: 4, h: 1.5, d: 0.5, rot: 1.2 },
    { pos: [33, 6], w: 4.5, h: 1.6, d: 0.5, rot: -1.1 },
    { pos: [-30, 20], w: 3.5, h: 1.4, d: 0.5, rot: 0.4 },
    { pos: [31, -32], w: 4, h: 1.5, d: 0.5, rot: -0.3 },
    { pos: [-34, 34], w: 4.5, h: 1.6, d: 0.5, rot: 0.15 },
    { pos: [36, 36], w: 3.5, h: 1.4, d: 0.5, rot: -0.6 },
  ];
  for (const bd of barricadeDefs) {
    ctx.addBox(bd.w, bd.h, bd.d, bd.pos[0], bd.h / 2, bd.pos[1], woodMat, { rotY: bd.rot });
  }

  addSandbagWall(ctx, -3, -14, 5, 0.2);
  addSandbagWall(ctx, 4, 2, 4, -0.5);
  addSandbagWall(ctx, -6, 18, 5, 0.1);
  addSandbagWall(ctx, 6, 20, 4, 0.6);
  addSandbagWall(ctx, 0, -22, 6, 0);
  addSandbagWall(ctx, -28, 2, 4, 1.5);
  addSandbagWall(ctx, 30, -8, 4, 1.2);
  addSandbagWall(ctx, -32, -26, 5, 0.3);
  addSandbagWall(ctx, 34, 22, 4, -0.4);

  // Rubble piles
  const rubbleDefs = [
    { pos: [2, -12], r: 2.2 }, { pos: [-7, -4], r: 1.8 },
    { pos: [7, 4], r: 2.0 }, { pos: [-3, 12], r: 1.6 },
    { pos: [3, 26], r: 2.4 }, { pos: [-8, 26], r: 1.8 },
    { pos: [9, -10], r: 1.5 }, { pos: [-1, -28], r: 2.0 },
    { pos: [-20, -16], r: 2.2 }, { pos: [22, 2], r: 2.0 },
    { pos: [-26, 12], r: 1.9 }, { pos: [28, -18], r: 2.3 },
    { pos: [-18, 32], r: 2.0 }, { pos: [18, -32], r: 2.1 },
    { pos: [-36, -2], r: 1.8 }, { pos: [38, 12], r: 2.0 },
  ];
  for (const rd of rubbleDefs) {
    const g = new THREE.Group();
    g.position.set(rd.pos[0], 0, rd.pos[1]);
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const s = 0.4 + Math.random() * 0.7;
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s), i % 2 ? rubbleMat : concreteMat);
      chunk.position.set((Math.random() - 0.5) * rd.r, s * 0.3, (Math.random() - 0.5) * rd.r);
      chunk.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      g.add(chunk);
    }
    scene.add(g);
    ctx.addCollisionBox(rd.pos[0], 0.3, rd.pos[1], new THREE.Vector3(rd.r, 0.6, rd.r));
  }

  // Craters
  const craterDefs = [
    { pos: [0, -4], r: 2.5 }, { pos: [5, 8], r: 2.0 }, { pos: [-5, 20], r: 2.8 },
    { pos: [2, 30], r: 2.2 }, { pos: [-4, -20], r: 2.4 },
    { pos: [-24, -2], r: 2.6 }, { pos: [26, 24], r: 2.3 },
    { pos: [-30, -34], r: 2.7 }, { pos: [30, -28], r: 2.1 },
    { pos: [-38, 30], r: 2.4 }, { pos: [42, -4], r: 2.5 },
  ];
  for (const cd of craterDefs) {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(cd.r, 24),
      new THREE.MeshStandardMaterial({ color: 0x2e2a22, roughness: 1.0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cd.pos[0], 0.01, cd.pos[1]);
    floor.receiveShadow = true;
    scene.add(floor);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(cd.r + 0.4, cd.r + 0.4, 0.25, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3a352a, roughness: 1.0, side: THREE.DoubleSide })
    );
    rim.position.set(cd.pos[0], 0.12, cd.pos[1]);
    rim.castShadow = true;
    scene.add(rim);
  }

  for (const [x, z] of [[3, -16], [-6, 8], [8, 14], [-2, 28], [-26, -20], [28, 6], [-30, 34], [34, -18]]) addBurningBarrel(ctx, x, z);

  // ── Extra set dressing: road, ruins, wrecks, poles ──
  // Road strip down the middle + faded lane markings.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: 1.0 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 126), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.receiveShadow = true;
  scene.add(road);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x8a8468, roughness: 1 });
  for (let z = -60; z < 64; z += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.6), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    scene.add(dash);
  }
  // Cross street at the plaza (z ≈ ±18 intersection band) + sidewalk kerbs.
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(122, 6), roadMat);
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.set(0, 0.02, 18);
  crossRoad.receiveShadow = true;
  scene.add(crossRoad);
  const crossRoad2 = new THREE.Mesh(new THREE.PlaneGeometry(122, 5), roadMat);
  crossRoad2.rotation.x = -Math.PI / 2;
  crossRoad2.position.set(0, 0.02, -20);
  crossRoad2.receiveShadow = true;
  scene.add(crossRoad2);
  const kerbMat = new THREE.MeshStandardMaterial({ color: 0x6b675c, roughness: 0.95 });
  for (const sz of [21.8, 23.4]) {
    ctx.addBox(122, 0.18, 1.2, 0, 0.09, sz, kerbMat, { collide: false });
    ctx.addBox(122, 0.18, 1.2, 0, 0.09, -sz + 2, kerbMat, { collide: false });
  }

  // Two-storey ruined facades leaning over the street.
  addFacade(ctx, -11, -8, 7, 6.5, 0, brickMat);
  addFacade(ctx, 11.5, 2, 8, 7, -0.1, brickDarkMat);
  addFacade(ctx, -11.5, 15, 6, 5.5, 0.15, brickMat);
  addFacade(ctx, 12, -22, 7, 6, 0.1, brickDarkMat);
  addFacade(ctx, -24, 21, 8, 6.5, Math.PI / 2, brickMat);
  addFacade(ctx, 26, 21.5, 7, 6, -Math.PI / 2, brickDarkMat);
  addFacade(ctx, -36, -12, 7, 5.5, 0.25, brickMat);
  addFacade(ctx, 38, -6, 6, 6, -0.2, brickDarkMat);
  addFacade(ctx, -44, 10, 8, 6.5, 0, brickMat);
  addFacade(ctx, 44, 26, 7, 5.5, 0.12, brickDarkMat);
  addFacade(ctx, -20, -36, 7, 6, -0.15, brickMat);

  // Burned-out cars turning the street into a chokepoint.
  addCarWreck(ctx, -2.5, -10, 0.25, 0x5a4a44);
  addCarWreck(ctx, 2.8, 18, -0.35, 0x444f5a);
  addCarWreck(ctx, -8.5, -20, 1.35, 0x50463e);
  addCarWreck(ctx, 9.5, 20, 0.1, 0x5a4a44);
  addCarWreck(ctx, -20, -12, 0.9, 0x4a4f44);
  addCarWreck(ctx, 22, 30, -1.2, 0x5a4444);
  addCarWreck(ctx, -38, 4, 0.3, 0x444f5a);
  addCarWreck(ctx, 40, -16, 1.6, 0x50463e);
  addCarWreck(ctx, -14, 36, -0.6, 0x44504a);

  // Fences sealing side alleys.
  addFence(ctx, -3, -2, 4.5, 0.15);
  addFence(ctx, 6.5, -18, 3.5, 0.6);
  addFence(ctx, -8.5, 11, 4, -0.25);
  addFence(ctx, 8.5, 28, 3.5, 0.2);
  addFence(ctx, -18, -2, 5, 1.55);
  addFence(ctx, 18, 12, 4.5, 1.4);
  addFence(ctx, -32, 26, 5, -0.3);
  addFence(ctx, 34, -24, 4.5, 0.5);
  addFence(ctx, -46, -24, 5, 0.1);

  // Tank traps in the open lanes.
  addTankTrap(ctx, -6, -2);
  addTankTrap(ctx, 7, -8);
  addTankTrap(ctx, -9, 19);
  addTankTrap(ctx, 13, 17);
  addTankTrap(ctx, -13, -10);
  addTankTrap(ctx, -22, 12);
  addTankTrap(ctx, 24, -6);
  addTankTrap(ctx, -30, -18);
  addTankTrap(ctx, 32, 30);
  addTankTrap(ctx, -42, 18);
  addTankTrap(ctx, 46, 8);

  // Bus-stop shack + market stall at the cross-street plaza (landmark cover).
  addBusStop(ctx, -6, 22.5);
  addMarketStall(ctx, 7, 22.5, 0.2);
  addMarketStall(ctx, -16, 22.8, -0.15);

  // Utility poles + sagging wires down both sides of the road.
  const polesL = [
    addUtilityPole(ctx, -5, -52),
    addUtilityPole(ctx, -5, -34),
    addUtilityPole(ctx, -5, -30),
    addUtilityPole(ctx, -5, -12),
    addUtilityPole(ctx, -5, 6, true), // snapped pole
    addUtilityPole(ctx, -5, 24),
    addUtilityPole(ctx, -5, 44),
  ];
  const polesR = [
    addUtilityPole(ctx, 5, -44),
    addUtilityPole(ctx, 5, -24),
    addUtilityPole(ctx, 5, -4),
    addUtilityPole(ctx, 5, 16),
    addUtilityPole(ctx, 5, 34, true),
    addUtilityPole(ctx, 5, 52),
  ];
  addWires(scene, polesL);
  addWires(scene, polesR);

  // Fine debris everywhere the skyline dust has settled.
  const debrisMats = [rubbleMat, concreteMat, brickDarkMat];
  for (const [cx, cz, r, n] of [
    [0, -6, 5, 20], [0, 12, 6, 24], [-6, -24, 4, 14],
    [7, 2, 4, 12], [-4, 26, 5, 16], [10, -12, 4, 12],
    [-24, -8, 6, 18], [26, 10, 6, 18], [-34, 20, 6, 16],
    [36, -20, 5, 14], [-44, -14, 5, 14], [44, 14, 5, 14],
    [-40, 36, 6, 16], [40, 38, 5, 12], [-48, 0, 5, 12], [50, -2, 5, 12],
  ]) addDebris(scene, cx, cz, r, n, debrisMats);

  ctx.addCrateRing([
    [5, 0, -5], [-5, 0, -5], [5, 0, 5], [-5, 0, 5],
    [10, 0, 0], [-10, 0, 0], [0, 0, -10], [0, 0, 10],
    [15, 0, -10], [-15, 0, 10], [15, 0, 10], [-15, 0, -10],
    [-28, 0, -18], [28, 0, 18], [-36, 0, -6], [38, 0, 6],
    [-22, 0, 30], [24, 0, -34], [-48, 0, 24], [46, 0, -26],
  ]);

  // Street lamps, every other one burnt out
  const lampPositions = [
    [6, 0, -10], [-6, 0, -10], [6, 0, 10], [-6, 0, 10],
    [0, 0, -26], [0, 0, 28], [14, 0, 0], [-14, 0, 0],
    [0, 0, 18], [-20, 0, -20], [20, 0, 18], [-30, 0, 6],
    [32, 0, -8], [-38, 0, -28], [40, 0, 30], [0, 0, 44],
    [0, 0, -46], [-50, 0, 12],
  ];
  for (let i = 0; i < lampPositions.length; i++) {
    const [x, y, z] = lampPositions[i];
    const withLight = i % 2 === 0;
    const lamp = createStreetLamp(withLight);
    lamp.position.set(x, y, z);
    if (!withLight) lamp.rotation.z = 0.15;
    scene.add(lamp);
    obstacles.push(lamp);
  }

  ctx.addTargets([
    [8, 0, -8], [-8, 0, 8], [12, 0, 12], [-12, 0, -12],
    [0, 0, -15], [15, 0, 0], [-15, 0, 0],
    [-30, 0, -14], [32, 0, 14], [-44, 0, 26], [46, 0, -20],
  ]);

  // ── Progression expansion: perimeter + gated south/north districts ──
  ctx.arenaHalf = A;
  const perimeterMat = new THREE.MeshStandardMaterial({ color: 0x504c42, roughness: 0.95 });
  ctx.addBox(A * 2 + 6, 6, 1, 0, 3, -(A + 2), perimeterMat);
  ctx.addBox(A * 2 + 6, 6, 1, 0, 3, A + 2, perimeterMat);
  ctx.addBox(1, 6, A * 2 + 5, -(A + 2), 3, 0, perimeterMat);
  ctx.addBox(1, 6, A * 2 + 5, A + 2, 3, 0, perimeterMat);

  // Blast-partition walls across the road — 7.5 m gap so a horde can funnel
  // through after the barrier is bought (one body-width used to jam the old 5.5).
  const partMat = new THREE.MeshStandardMaterial({ color: 0x5a5850, roughness: 0.95 });
  const GATE = 7.5;
  for (const pz of [-26, 27]) {
    const wallW = A + 3 - GATE / 2;
    ctx.addBox(wallW, 3.5, 0.8, -(GATE / 2 + wallW / 2), 1.75, pz, partMat);
    ctx.addBox(wallW, 3.5, 0.8, (GATE / 2 + wallW / 2), 1.75, pz, partMat);
  }
  ctx.addZone('main', [-A, -25, A, 26]);
  ctx.addGateBarrier({
    x: 0, z: -26, width: 7, cost: 500, style: 'wood',
    zone: 'south', rect: [-A, -A, A, -27.5],
  });
  ctx.addGateBarrier({
    x: 0, z: 27, width: 7, cost: 700, style: 'wood',
    zone: 'north', rect: [-A, 28.5, A, A],
  });

  // South district: collapsed row houses + a supply depot.
  addFacade(ctx, -8, -33, 7, 5.5, 0.05, brickMat);
  addFacade(ctx, 8, -35, 6, 5, -0.1, brickDarkMat);
  addFacade(ctx, -26, -34, 8, 6, 0.1, brickMat);
  addFacade(ctx, 28, -32, 7, 5.5, -0.12, brickDarkMat);
  addFacade(ctx, -46, -50, 9, 6.5, 0, brickMat);
  addFacade(ctx, 46, -46, 8, 6, 0.08, brickDarkMat);
  addFacade(ctx, 0, -52, 8, 5.5, 0, brickMat);
  addCarWreck(ctx, -1, -31, 1.2, 0x4a4f44);
  addCarWreck(ctx, 3, -37, -0.2, 0x5a4a44);
  addCarWreck(ctx, -18, -44, 0.6, 0x50463e);
  addCarWreck(ctx, 20, -52, -1.1, 0x444f5a);
  addSandbagWall(ctx, -3, -38, 5, 0);
  addSandbagWall(ctx, -14, -30, 4, 0.9);
  addSandbagWall(ctx, 34, -40, 4, 0);
  addTankTrap(ctx, 5, -30);
  addTankTrap(ctx, -5, -37);
  addTankTrap(ctx, -30, -44);
  addTankTrap(ctx, 12, -46);
  addTankTrap(ctx, 40, -36);
  addBurningBarrel(ctx, 14, -33);
  addBurningBarrel(ctx, -14, -38);
  addBurningBarrel(ctx, -40, -32);
  addBurningBarrel(ctx, 36, -52);
  addFence(ctx, -16, -29, 5, 0.15);
  addFence(ctx, 30, -36, 5, 0.2);
  addFence(ctx, -50, -40, 6, -0.2);
  ctx.addCrateRing([
    [12, 0, -29], [13.4, 0, -29], [12, 0, -30.4],
    [-11, 0, -33], [-12.4, 0, -34], [0, 0, -40 + 2.2],
    [-22, 0, -50], [-20.6, 0, -50], [24, 0, -44], [44, 0, -56],
  ], 1.3);
  addMarketStall(ctx, 16, -40, 0.3);
  addMarketStall(ctx, -34, -52, -0.4);
  addDebris(scene, 0, -33, 8, 22, debrisMats);
  addDebris(scene, -30, -46, 8, 18, debrisMats);
  addDebris(scene, 34, -44, 8, 18, debrisMats);
  for (const [x, z] of [[6, -34], [-6, -28], [0, -37], [-30, -34], [30, -46], [-20, -54], [44, -34], [0, -58]]) {
    const lamp = createStreetLamp((x + z) % 4 === 0);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    obstacles.push(lamp);
  }
  ctx.addTargets([[0, 0, -36], [7, 0, -33], [-7, 0, -30], [-20, 0, -48], [26, 0, -52]]);

  // North district: a blocked tram yard — rails, a derailed tram, crates.
  addFacade(ctx, 9, 33, 8, 6, -0.08, brickMat);
  addFacade(ctx, -9, 35, 6, 5.5, 0.1, brickDarkMat);
  addFacade(ctx, 26, 36, 7, 6, -0.1, brickMat);
  addFacade(ctx, -28, 44, 8, 6.5, 0.06, brickDarkMat);
  addFacade(ctx, 44, 52, 8, 6, 0, brickMat);
  addFacade(ctx, -46, 54, 7, 5.5, 0, brickDarkMat);
  addCarWreck(ctx, -2, 31, 0.5, 0x50463e);
  addCarWreck(ctx, 4, 38, -1.4, 0x444f5a);
  addCarWreck(ctx, 34, 44, 0.9, 0x4a4f44);
  addSandbagWall(ctx, -6, 38, 4, 0.2);
  addSandbagWall(ctx, 22, 30, 4, 1.35);
  addSandbagWall(ctx, -38, 50, 5, 0);
  addTankTrap(ctx, -4, 31);
  addTankTrap(ctx, 6, 36);
  addTankTrap(ctx, -24, 38);
  addTankTrap(ctx, 20, 50);
  addTankTrap(ctx, 44, 40);
  addBurningBarrel(ctx, -13, 32);
  addBurningBarrel(ctx, 13, 38);
  addBurningBarrel(ctx, -34, 36);
  addBurningBarrel(ctx, 40, 54);
  addFence(ctx, 15, 30, 5, -0.2);
  addFence(ctx, -20, 42, 5, 0.15);
  addFence(ctx, 36, 34, 4.5, 1.4);
  ctx.addCrateRing([
    [-12, 0, 30], [-13.4, 0, 31], [-12, 0, 31.4],
    [10, 0, 37], [11.4, 0, 37],
    [-30, 0, 52], [-28.6, 0, 52], [30, 0, 46], [50, 0, 40],
  ], 1.3);
  addTramWreck(ctx, -14, 52, 0.08);
  // Twin tram rails cutting across the yard.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.5, metalness: 0.8 });
  for (const rx of [-15.4, -12.6]) {
    ctx.addBox(0.18, 0.12, 30, rx, 0.06, 46, railMat, { collide: false });
  }
  for (let tz = 32; tz <= 59; tz += 2) {
    const sleeper = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.08, 0.3),
      woodMat
    );
    sleeper.position.set(-14, 0.04, tz);
    scene.add(sleeper);
  }
  addMarketStall(ctx, 14, 44, -0.2);
  addDebris(scene, 0, 34, 8, 22, debrisMats);
  addDebris(scene, -30, 48, 8, 18, debrisMats);
  addDebris(scene, 34, 46, 8, 18, debrisMats);
  for (const [x, z] of [[-5, 33], [5, 30], [0, 38], [-30, 40], [30, 50], [20, 34], [-44, 34], [0, 58]]) {
    const lamp = createStreetLamp((x + z) % 3 === 0);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    obstacles.push(lamp);
  }
  ctx.addTargets([[0, 0, 36], [-7, 0, 32], [7, 0, 37], [-24, 0, 50], [28, 0, 44]]);
}

