import * as THREE from 'three';
import {
  addBaseLights,
  addGround,
  addBurningBarrel,
  addPipeRun,
  addServerRack,
  addReactor,
  addBlastDoor,
  addRadioDesk,
  addDebris,
  flickerLights,
} from './kit.js';

export const meta = {
  id: 'bunker',
  name: 'Yeraltı Sığınağı',
  desc: 'Sunucu odaları, patlama kapıları, sarkan kablolar. Kuzey/güney kanatları barikat arkasında.',
  swatch: 'linear-gradient(160deg, #37474f 0%, #212121 60%, #000 100%)',
};

export function build(ctx) {
  const { scene } = ctx;

  scene.background = new THREE.Color(0x0a0a0c);
  addBaseLights(scene, {
    amb: 0x4a4e56, hemiSky: 0x3a3e45, hemiGround: 0x14161a,
    sunColor: null, sunInt: 0, fogColor: 0x0c0d10, fogNear: 18, fogFar: 95,
  });
  // Extra fill so the bunker reads as dim-but-playable (no sun down here).
  const fill = new THREE.PointLight(0x9fb2d0, 40, 80, 2);
  fill.position.set(0, 4, 0);
  scene.add(fill);
  addGround(scene, 0x23262b, 140);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x44484f, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x555b63, roughness: 0.4, metalness: 0.8 });

  // Ceiling (dark slab so it feels underground) — extended to cover the
  // gated north/south wings added at the end of this builder.
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 124),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4.5;
  scene.add(ceil);

  // Perimeter — north/south sides leave a 7 m gate gap at x=0 for the wings.
  const R = 32;
  const GATE = 7;
  ctx.arenaHalf = R - 2;
  ctx.addBox((R * 2 - GATE) / 2, 5, 1, -(GATE / 2 + (R * 2 - GATE) / 4), 2.5, -R, wallMat);
  ctx.addBox((R * 2 - GATE) / 2, 5, 1, (GATE / 2 + (R * 2 - GATE) / 4), 2.5, -R, wallMat);
  ctx.addBox((R * 2 - GATE) / 2, 5, 1, -(GATE / 2 + (R * 2 - GATE) / 4), 2.5, R, wallMat);
  ctx.addBox((R * 2 - GATE) / 2, 5, 1, (GATE / 2 + (R * 2 - GATE) / 4), 2.5, R, wallMat);
  ctx.addBox(1, 5, R * 2 + 2, -R, 2.5, 0, wallMat);
  ctx.addBox(1, 5, R * 2 + 2, R, 2.5, 0, wallMat);

  // Corridor walls forming a bunker layout
  const innerWalls = [
    { pos: [-12, -12], w: 17, d: 1 },
    { pos: [12, -12], w: 17, d: 1 },
    { pos: [-12, 12], w: 17, d: 1 },
    { pos: [12, 12], w: 17, d: 1 },
    { pos: [0, -23], w: 1, d: 14 },
    { pos: [0, 23], w: 1, d: 14 },
    { pos: [-23, 0], w: 1, d: 17 },
    { pos: [23, 0], w: 1, d: 17 },
    // Extra rooms: side bays off the east-west corridors.
    { pos: [-27.5, -12], w: 9, d: 1 },
    { pos: [27.5, 12], w: 9, d: 1 },
    { pos: [-27.5, 26], w: 1, d: 10 },
    { pos: [27.5, -26], w: 1, d: 10 },
    { pos: [-18, 24], w: 1, d: 12 },
    { pos: [18, -24], w: 1, d: 12 },
    { pos: [0, -16], w: 6, d: 1 },
    { pos: [0, 16], w: 6, d: 1 },
  ];
  for (const w of innerWalls) {
    ctx.addBox(w.w, 4, w.d, w.pos[0], 2, w.pos[1], concreteMat);
  }

  // Support pillars (center kept clear for the player spawn)
  for (const [x, z] of [
    [-20, -20], [20, -20], [-20, 20], [20, 20],
    [0, -14], [0, 14], [-14, 0], [14, 0],
    [-27, 6], [27, -6],
  ]) {
    const pillar = ctx.addBox(1.2, 4.5, 1.2, x, 2.25, z, steelMat);
    pillar.castShadow = true;
  }

  // Reactor room: glowing turbine block in a steel cage (landmark cover).
  addReactor(ctx, -27.5, -20);
  addReactor(ctx, 27.5, 20);

  // Crates & supply stacks
  ctx.addCrateRing([
    [-6, 0, -17], [-4, 0, -17], [-6, 0, -15.6],
    [17, 0, 6], [17, 0, 7.4], [15.6, 0, 6],
    [-17, 0, 17], [-15.6, 0, 17],
    [6, 0, -6], [-6, 0, 6],
    [-26, 0, -27], [-24.6, 0, -27], [26, 0, 27], [26, 0, 28.4],
    [29, 0, -14], [-29, 0, 14],
  ], 1.3);

  // Ammo crates (low cover)
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  for (const [x, z, rot] of [
    [9, -17, 0.3], [-9, 17, -0.4], [26, -26, 0], [-26, 26, 0.7],
    [20, 4, -0.3], [-20, -4, 0.5], [30, 14, 0.2], [-30, -14, -0.2],
  ]) {
    ctx.addBox(1.6, 0.8, 0.9, x, 0.4, z, ammoMat, { rotY: rot });
  }

  // Dim ceiling lamps along the corridors
  const lampPositions = [
    [0, -17], [0, 17], [-17, 0], [17, 0], [0, 0],
    [-22, -22], [22, 22], [-27, 10], [27, -10],
    [-27, -27], [27, 27], [0, -28], [0, 28],
  ];
  for (let i = 0; i < lampPositions.length; i++) {
    const [x, z] = lampPositions[i];
    const flicker = i % 3 === 0; // some lamps flicker
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.12, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0xfff2c8, emissive: 0xffe9a0,
        emissiveIntensity: flicker ? 1.2 : 2.2,
      })
    );
    fixture.position.set(x, 4.35, z);
    scene.add(fixture);
    const pl = new THREE.PointLight(0xffe2a8, flicker ? 14 : 22, 16, 2);
    pl.position.set(x, 4.1, z);
    if (flicker) {
      pl.userData.flickerSeed = Math.random() * 100;
      flickerLights.push(pl);
    }
    scene.add(pl);
  }
  // A couple of burning barrels for menace
  addBurningBarrel(ctx, -26, -6);
  addBurningBarrel(ctx, 26, 8);
  addBurningBarrel(ctx, -8, 28);
  addBurningBarrel(ctx, 8, -28);

  // ── Extra set dressing: racks, blast doors, pipes, cables ──
  // Server racks humming along the outer walls.
  addServerRack(ctx, -30.4, -8, Math.PI / 2);
  addServerRack(ctx, -30.4, 6, Math.PI / 2);
  addServerRack(ctx, -30.4, 18, Math.PI / 2);
  addServerRack(ctx, 30.4, -6, -Math.PI / 2);
  addServerRack(ctx, 30.4, 8, -Math.PI / 2);
  addServerRack(ctx, 30.4, -18, -Math.PI / 2);
  addServerRack(ctx, -8, -30.4, 0);
  addServerRack(ctx, 7, -30.4, 0);
  addServerRack(ctx, -6, 30.4, Math.PI);
  addServerRack(ctx, 8, 30.4, Math.PI);

  // Command desks with still-working radios.
  addRadioDesk(ctx, 5, -27, 0.2);
  addRadioDesk(ctx, -14, 27, Math.PI - 0.3);
  addRadioDesk(ctx, 28, -20, -Math.PI / 2);

  // Half-open blast doors sealing two corridor mouths.
  addBlastDoor(ctx, 0, -8, 0);
  addBlastDoor(ctx, 0, 8, Math.PI);
  addBlastDoor(ctx, 8, 0, Math.PI / 2);
  addBlastDoor(ctx, -8, 0, -Math.PI / 2);

  // Ceiling pipes running down the four corridor arms.
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.5, metalness: 0.7 });
  addPipeRun(ctx, 2.6, -20, 26, Math.PI / 2, 4.1, pipeMat);
  addPipeRun(ctx, 2.6, 20, 26, Math.PI / 2, 4.1, pipeMat);
  addPipeRun(ctx, -20, 2.6, 26, 0, 4.1, pipeMat);
  addPipeRun(ctx, 20, 2.6, 26, 0, 4.1, pipeMat);
  addPipeRun(ctx, 0, -30.5, 30, 0, 3.6, pipeMat);
  addPipeRun(ctx, 0, 30.5, 30, 0, 3.6, pipeMat);

  // Yellow warning stripes on the central pillars.
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd6a919, roughness: 0.8 });
  for (const [x, z] of [[0, -14], [0, 14], [-14, 0], [14, 0]]) {
    for (const sy of [0.6, 1.8, 3.0]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), stripeMat);
      stripe.position.set(x, sy, z);
      scene.add(stripe);
    }
  }

  // Cables drooping from the ceiling in the corners (creepy detail).
  const cableMat = new THREE.LineBasicMaterial({ color: 0x0c0d10 });
  for (const [ax, az, bx, bz] of [
    [-20, -20, -14, -24], [20, -20, 24, -14], [-20, 20, -24, 14], [20, 20, 14, 24],
    [-27, -14, -22, -18], [27, 14, 22, 18],
  ]) {
    const pts = [];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      pts.push(new THREE.Vector3(
        ax + (bx - ax) * t,
        4.4 - Math.sin(t * Math.PI) * 1.3,
        az + (bz - az) * t
      ));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
  }

  // Concrete dust and chip debris around the pillar bases.
  const debrisMats = [concreteMat, wallMat, steelMat];
  for (const [cx, cz, r, n] of [
    [-20, -20, 3, 10], [20, 20, 3, 10], [0, -14, 2.5, 8], [0, 14, 2.5, 8],
    [-22, 10, 3, 8], [22, -10, 3, 8], [-27, 27, 3, 8], [27, -27, 3, 8],
    [14, 0, 2, 6], [-14, 0, 2, 6],
  ]) addDebris(scene, cx, cz, r, n, debrisMats);

  ctx.addTargets([
    [0, 0, -26], [0, 0, 26], [-26, 0, 0], [26, 0, 0],
    [-17, 0, -17], [17, 0, 17], [-28, 0, 22], [28, 0, -22],
  ]);

  // ── Progression expansion: gated north/south wings ──
  const WR = 50; // wing far walls
  ctx.addBox(62, 5, 1, 0, 2.5, -WR, wallMat);
  ctx.addBox(62, 5, 1, 0, 2.5, WR, wallMat);
  for (const sx of [-1, 1]) {
    ctx.addBox(1, 5, 18, sx * 31, 2.5, -(WR - 9), wallMat);
    ctx.addBox(1, 5, 18, sx * 31, 2.5, WR - 9, wallMat);
  }
  ctx.addZone('main', [-R + 2, -R + 2, R - 2, R - 2]);
  ctx.addGateBarrier({
    x: 0, z: -R, width: 6.5, cost: 500, style: 'steel',
    zone: 'south', rect: [-30, -(WR - 2), 30, -(R + 3)],
  });
  ctx.addGateBarrier({
    x: 0, z: R, width: 6.5, cost: 700, style: 'steel',
    zone: 'north', rect: [-30, R + 3, 30, WR - 2],
  });

  // South wing: reactor storage — racks, barrels, a spare reactor, lamps.
  addServerRack(ctx, -29, -36, Math.PI / 2);
  addServerRack(ctx, -29, -42, Math.PI / 2);
  addServerRack(ctx, 29, -36, -Math.PI / 2);
  addServerRack(ctx, 29, -42, -Math.PI / 2);
  addRadioDesk(ctx, -8, -47, 0.15);
  addReactor(ctx, 14, -40);
  addBurningBarrel(ctx, 10, -34);
  addBurningBarrel(ctx, -16, -46);
  addBurningBarrel(ctx, 24, -48);
  ctx.addCrateRing([
    [-6, 0, -38], [-4.6, 0, -38], [-6, 0, -36.6],
    [18, 0, -44], [16.6, 0, -44], [0, 0, -46],
    [-22, 0, -33], [8, 0, -42],
  ], 1.3);
  const ammoMatS = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  ctx.addBox(1.6, 0.8, 0.9, 6, 0.4, -45, ammoMatS, { rotY: 0.4 });
  ctx.addBox(1.6, 0.8, 0.9, -10, 0.4, -38, ammoMatS, { rotY: -0.2 });
  ctx.addBox(1.6, 0.8, 0.9, -24, 0.4, -44, ammoMatS, { rotY: 0.9 });
  addPipeRun(ctx, 0, -33, 40, 0, 4.1, pipeMat);
  // Wing partition with its own blast-door pinch point.
  ctx.addBox(12, 4, 1, -14, 2, -40, concreteMat);
  ctx.addBox(12, 4, 1, 14, 2, -40, concreteMat);

  // North wing: barracks — bunks, desks, supply stacks.
  addServerRack(ctx, -29, 36, Math.PI / 2);
  addServerRack(ctx, 29, 40, -Math.PI / 2);
  addServerRack(ctx, -29, 44, Math.PI / 2);
  addRadioDesk(ctx, 9, 47, Math.PI + 0.2);
  addRadioDesk(ctx, -18, 38, Math.PI / 2);
  addBurningBarrel(ctx, -10, 34);
  addBurningBarrel(ctx, 18, 46);
  addBurningBarrel(ctx, 2, 40);
  ctx.addCrateRing([
    [6, 0, 36], [7.4, 0, 36], [6, 0, 37.4],
    [-18, 0, 45], [-16.6, 0, 45], [0, 0, 44], [22, 0, 33],
    [-6, 0, 48], [14, 0, 39],
  ], 1.3);
  const ammoMatN = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  ctx.addBox(1.6, 0.8, 0.9, -6, 0.4, 42, ammoMatN, { rotY: 0.3 });
  ctx.addBox(1.6, 0.8, 0.9, 14, 0.4, 35, ammoMatN, { rotY: -0.5 });
  ctx.addBox(1.6, 0.8, 0.9, 24, 0.4, 44, ammoMatN, { rotY: 0.4 });
  // Barracks bunks: two-tier steel frames as waist-high cover rows.
  const bunkMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.5, metalness: 0.7 });
  const matMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 1 });
  for (const bx of [-16, -8, 16]) {
    ctx.addBox(2.2, 0.5, 5, bx, 0.55, 40, bunkMat);
    ctx.addBox(2.0, 0.18, 4.6, bx, 0.9, 40, matMat);
    ctx.addBox(2.2, 0.5, 5, bx, 0.55, 46, bunkMat);
    ctx.addBox(2.0, 0.18, 4.6, bx, 0.9, 46, matMat);
  }

  // Wing lamps: flickering fixtures down both corridors.
  for (const wz of [-36, -44, 36, 44]) {
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.12, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0xfff2c8, emissive: 0xffe9a0,
        emissiveIntensity: wz === -36 || wz === 44 ? 1.2 : 2.2,
      })
    );
    fixture.position.set(0, 4.35, wz);
    scene.add(fixture);
    const pl = new THREE.PointLight(0xffe2a8, wz === -36 || wz === 44 ? 14 : 22, 16, 2);
    pl.position.set(0, 4.1, wz);
    if (wz === -36 || wz === 44) {
      pl.userData.flickerSeed = Math.random() * 100;
      flickerLights.push(pl);
    }
    scene.add(pl);
  }
  addDebris(scene, 0, -40, 7, 16, debrisMats);
  addDebris(scene, 0, 40, 7, 16, debrisMats);
  ctx.addTargets([[0, 0, -38], [-14, 0, -46], [0, 0, 38], [14, 0, 44], [-20, 0, -40], [20, 0, 42]]);
}
