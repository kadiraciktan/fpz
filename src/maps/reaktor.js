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
  addGappedWall,
  addHangingBulb,
  addWallStencil,
  flickerLights,
} from './kit.js';
import {
  addBarbedFence,
  addCrateStack,
  addCinderCover,
  addDumpster,
  addLockerRow,
  addPumpUnit,
  addJerseyRow,
  addTransformerBank,
} from './props.js';

export const meta = {
  id: 'reaktor',
  name: 'Reaktör İnişi',
  desc: 'BÖLÜM 3 · Karanlık merdivenlerden reaktör çekirdeğine lineer iniş. Üç kapı, dört katman.',
  swatch: 'linear-gradient(160deg, #263238 0%, #101418 55%, #000 100%)',
  missionOnly: true,
};

// ── MISSION MAP 3: linear reactor descent ─────────────────────────────
//
//   ┌──────────────────────┐  z 76..94
//   │  REAKTÖR ÇEKİRDEĞİ   │  round containment floor — boss + hold
//   ├══════ gate 3 (1000) ═┤
//   │  POMPA GALERİSİ      │  z 40..60  pumps, pipes, drums
//   ├══════ gate 2 (750) ══┤
//   │  KORİDOR ZONASI      │  z 16..36  server bays, dim lamps
//   ├══════ gate 1 (500) ══┤
//   │  İNİŞ HOLÜ (spawn)   │  z -12..12 stairwell mouth, lockers
//   └──────────────────────┘
//
// Same spine idea as the outdoor maps but underground: a sealed concrete
// tube with four halls. Only ceiling lamps light it — no sun, no weather.

export function build(ctx) {
  const { scene } = ctx;

  scene.background = new THREE.Color(0x0a0a0c);
  addBaseLights(scene, {
    amb: 0x44484f, hemiSky: 0x363a41, hemiGround: 0x121418,
    sunColor: null, sunInt: 0, fogColor: 0x0c0d10, fogNear: 16, fogFar: 85,
  });
  const fill = new THREE.PointLight(0x9fb2d0, 26, 70, 2);
  fill.position.set(0, 4, 0);
  scene.add(fill);
  addGround(scene, 0x23262b, 200);

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x44484f, roughness: 0.9 });
  const partMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.93 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x555b63, roughness: 0.4, metalness: 0.8 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.9 });
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.6, metalness: 0.4 });
  const debrisMats = [concreteMat, wallMat, steelMat, rustMat];

  const X = 20;        // corridor half-width — tight, claustrophobic
  const Z0 = -14;
  const Z1 = 96;
  ctx.arenaHalf = Z1;

  // Perimeter + ceiling slab.
  ctx.addBox(1, 5, Z1 - Z0 + 2, -(X + 0.5), 2.5, (Z0 + Z1) / 2, wallMat);
  ctx.addBox(1, 5, Z1 - Z0 + 2, X + 0.5, 2.5, (Z0 + Z1) / 2, wallMat);
  ctx.addBox(X * 2 + 2, 5, 1, 0, 2.5, Z0 - 0.5, wallMat);
  ctx.addBox(X * 2 + 2, 5, 1, 0, 2.5, Z1 + 0.5, wallMat);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(X * 2 + 1, Z1 - Z0 + 1),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 4.5, (Z0 + Z1) / 2);
  scene.add(ceil);

  // Corridor lamps down the spine — every third one flickers.
  let lampIdx = 0;
  const addLamp = (x, z) => {
    const flicker = lampIdx++ % 3 === 0;
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
  };

  const addGate = (z, cost, style, zone, rect) => {
    const GATE = 6;
    const wallW = X - GATE / 2;
    ctx.addBox(wallW, 4.2, 0.9, -(GATE / 2 + wallW / 2), 2.1, z, partMat);
    ctx.addBox(wallW, 4.2, 0.9, (GATE / 2 + wallW / 2), 2.1, z, partMat);
    ctx.addBox(GATE + 1.2, 1.0, 0.9, 0, 4.6, z, partMat); // lintel
    ctx.addGateBarrier({ x: 0, z, width: 6, cost, style, zone, rect });
  };

  // ══ ZONE 1: iniş holü (spawn, z -12..12) ═══════════════════════════
  // Stairwell coming down from the surface, at the south end.
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.7, metalness: 0.4 });
  for (let i = 0; i < 9; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(6, 0.22, 0.9), stairMat);
    step.position.set(0, 0.11 + i * 0.22, -12 + i * 0.9);
    step.receiveShadow = true;
    scene.add(step);
  }
  for (const sx of [-3.2, 3.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 8.4), steelMat);
    rail.position.set(sx, 1.6, -8);
    rail.rotation.x = 0.24;
    rail.castShadow = true;
    scene.add(rail);
  }
  addRadioDesk(ctx, -12, 8, 0.4);
  // Locker rows along the north wall of the hall.
  const lockerMat = new THREE.MeshStandardMaterial({ color: 0x3f4650, roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 6; i++) {
    ctx.addBox(1.1, 2, 0.6, -3 + i * 1.2, 1, 11.4, lockerMat);
  }
  ctx.addCrateRing([
    [-16, 0, -6], [-14.6, 0, -6], [-16, 0, -4.6],
    [15, 0, 2], [16.4, 0, 2], [10, 0, 8], [-8, 0, 6],
  ], 1.3);
  ctx.addBox(1.6, 0.8, 0.9, -6, 0.4, 2, ammoMat, { rotY: 0.2 });
  // Props pass: kit lockers and a waste bin dress the east wall, crate
  // and cinder cover break up the open hall (all under the 4.5 m ceiling).
  addLockerRow(ctx, 17, 4, 4, Math.PI / 2);
  addDumpster(ctx, 17, -10, -0.4);
  addCrateStack(ctx, -12, -4, 0.5);
  addCinderCover(ctx, 6, 8, 0.4);
  addBurningBarrel(ctx, -10, 10);
  addBurningBarrel(ctx, 12, -8);
  addBlastDoor(ctx, 12, 6, Math.PI / 2); // decorative half-open checkpoint door
  addPipeRun(ctx, -X + 1.4, 0, 22, Math.PI / 2, 3.6, rustMat);
  addWallStencil(ctx, -X + 0.4, 2.4, 4, Math.PI / 2, '↓ REAKTÖR', '#4fc3f7');
  addDebris(scene, 0, 2, 9, 20, debrisMats);
  for (const z of [-8, 0, 8]) addLamp(0, z);
  ctx.addTargets([[-8, 0, 4], [9, 0, -2], [0, 0, 9], [-14, 0, 8], [14, 0, -6]]);

  ctx.addZone('inis', [-X + 2, Z0 + 3, X - 2, 12]);
  addGate(14, 500, 'steel', 'koridor', [-X + 2, 16, X - 2, 36]);

  // ══ ZONE 2: koridor zonasi (z 16..36) ══════════════════════════════
  // Server bays behind wall gaps + pinch-point pillars.
  addGappedWall(ctx, {
    axis: 'z', pos: -10, from: 16, to: 36, y: 2, h: 4, thick: 0.8, mat: concreteMat,
    gaps: [{ at: 22, width: 3 }, { at: 32, width: 2.6 }],
  });
  addGappedWall(ctx, {
    axis: 'z', pos: 10, from: 16, to: 36, y: 2, h: 4, thick: 0.8, mat: concreteMat,
    gaps: [{ at: 26, width: 3 }, { at: 19, width: 2.6 }],
  });
  for (const rz of [20, 24, 28, 33]) {
    addServerRack(ctx, -15, rz, Math.PI / 2);
    addServerRack(ctx, 15, rz, -Math.PI / 2);
  }
  for (const [px, pz] of [[-6, 18], [6, 24], [-6, 30], [6, 35]]) {
    const pillar = ctx.addBox(1.2, 4.5, 1.2, px, 2.25, pz, steelMat);
    pillar.castShadow = true;
  }
  addHangingBulb(ctx, -14, 26, { flicker: true });
  addHangingBulb(ctx, 14, 31, { flicker: false });
  ctx.addCrateRing([
    [-3, 0, 19], [-1.6, 0, 19], [4, 0, 30], [5.4, 0, 30], [-14, 0, 34], [13, 0, 21],
  ], 1.2);
  ctx.addBox(1.6, 0.8, 0.9, 0, 0.4, 27, ammoMat, { rotY: 0.5 });
  // Cinder knee-walls in the aisle: extra peek-cover between the pillars.
  addCinderCover(ctx, 2, 22, -0.2);
  addCinderCover(ctx, -2, 28, 0.6);
  addPipeRun(ctx, X - 1.4, 26, 20, Math.PI / 2, 3.4, rustMat);
  addPipeRun(ctx, 0, 17, 18, 0, 3.9, steelMat);
  addBurningBarrel(ctx, -16, 18);
  addBurningBarrel(ctx, 16, 35);
  addWallStencil(ctx, X - 0.4, 2.4, 28, -Math.PI / 2, 'YETKİ GEREKİR', '#c9b27a');
  addDebris(scene, 0, 26, 10, 24, debrisMats);
  for (const z of [18, 26, 34]) addLamp(0, z);
  ctx.addTargets([[-4, 0, 20], [5, 0, 28], [-12, 0, 32], [12, 0, 22], [0, 0, 35]]);

  addGate(38, 750, 'steel', 'pompa', [-X + 2, 40, X - 2, 60]);

  // ══ ZONE 3: pompa galerisi (z 40..60) ══════════════════════════════
  // Pump blocks + heavy pipe runs + drum stacks.
  const pumpMat = new THREE.MeshStandardMaterial({ color: 0x40474f, roughness: 0.5, metalness: 0.7 });
  for (const [px, pz] of [[-10, 44], [10, 44], [-10, 54], [10, 54]]) {
    ctx.addBox(4, 2.2, 3, px, 1.1, pz, pumpMat);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 10), steelMat);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(px, 2.6, pz);
    motor.castShadow = true;
    scene.add(motor);
  }
  addPipeRun(ctx, 0, 42, 34, 0, 1.4, rustMat);
  addPipeRun(ctx, 0, 49, 34, 0, 2.2, rustMat);
  addPipeRun(ctx, 0, 59, 34, 0, 3.0, steelMat);
  for (const [x, z] of [[-17, 42], [-16, 43], [16, 47], [17, 48], [-15, 58], [14, 41]]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), drumMat);
    drum.position.set(x, 0.55, z);
    drum.castShadow = true;
    scene.add(drum);
    ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(0.9, 1.1, 0.9));
  }
  ctx.addCrateRing([[-4, 0, 47], [-2.6, 0, 47], [5, 0, 56], [-17, 0, 52]], 1.2);
  // Props pass: working coolant pumps on the centre line, a jersey row
  // pinching the west aisle, wire sealing the drum corner.
  addPumpUnit(ctx, 0, 46, 0);
  addPumpUnit(ctx, 0, 55, Math.PI);
  // Transformer banks hum against both walls, arcing into the dark.
  addTransformerBank(ctx, -18, 46, Math.PI / 2);
  addTransformerBank(ctx, 17, 57, Math.PI / 2);
  addJerseyRow(ctx, -6, 51, 3, 0.1);
  addBarbedFence(ctx, 18, 52, 8, Math.PI / 2);
  ctx.addBox(1.6, 0.8, 0.9, 3, 0.4, 43, ammoMat, { rotY: 0.1 });
  addBurningBarrel(ctx, 0, 53);
  addBurningBarrel(ctx, -16, 48);
  addBlastDoor(ctx, -14, 59, Math.PI / 2);
  addDebris(scene, 0, 50, 9, 22, debrisMats);
  for (const z of [42, 50, 58]) addLamp(0, z);
  ctx.addTargets([[-4, 0, 43], [5, 0, 49], [-12, 0, 55], [12, 0, 58], [0, 0, 41]]);

  addGate(62, 1000, 'steel', 'cekirdek', [-X + 2, 64, X - 2, Z1 - 3]);

  // ══ ZONE 4: reaktör çekirdeği (z 64..93) ═══════════════════════════
  // Round concrete containment floor with the reactor dead-centre.
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.5, 0.2, 32), concreteMat);
  floor.position.set(0, 0.1, 79);
  floor.receiveShadow = true;
  scene.add(floor);
  addReactor(ctx, 0, 79);
  // Coolant pipes ringing the chamber.
  for (const [px, pz, pr] of [
    [-12, 70, 0.5], [12, 70, -0.5], [-12, 88, 2.6], [12, 88, -2.6],
  ]) {
    addPipeRun(ctx, px, pz, 12, Math.PI / 2 + pr, 3.2, rustMat);
  }
  // Console ring: low cover facing the core (the hold fight circles it).
  const consoleMat = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.6, metalness: 0.5 });
  for (const [cx, cz, cr] of [
    [-9, 73, 0.6], [9, 73, -0.6], [-9, 86, -0.6], [9, 86, 0.6], [0, 90, 0],
  ]) {
    ctx.addBox(3.4, 1.4, 1, cx, 0.7, cz, consoleMat, { rotY: cr });
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x33ff66 })
    );
    led.position.set(cx, 1.15, cz + 0.53);
    led.rotation.y = cr;
    scene.add(led);
  }
  addRadioDesk(ctx, -15, 79, Math.PI / 2);
  addServerRack(ctx, 15, 76, -Math.PI / 2);
  addServerRack(ctx, 15, 82, -Math.PI / 2);
  ctx.addCrateRing([
    [-14, 0, 68], [-12.6, 0, 68], [14, 0, 89], [15.4, 0, 89], [-6, 0, 91],
  ], 1.3);
  ctx.addBox(1.6, 0.8, 0.9, 6, 0.4, 91, ammoMat, { rotY: 0.2 });
  // Props pass: crate cover by the entry arc, maintenance lockers on the east wall.
  addCrateStack(ctx, -8, 67, 0.4);
  addLockerRow(ctx, 17, 72, 5, Math.PI / 2);
  addBurningBarrel(ctx, -14, 90);
  addBurningBarrel(ctx, 14, 67);
  addWallStencil(ctx, 0, 2.6, Z1 - 0.9, Math.PI, 'KRİTİK SOĞUTMA', '#ff8a65');
  addDebris(scene, 0, 79, 13, 30, debrisMats);
  for (const [x, z] of [[-10, 72], [10, 72], [-10, 86], [10, 86]]) addLamp(x, z);
  ctx.addTargets([[-8, 0, 70], [8, 0, 74], [-13, 0, 84], [13, 0, 82], [0, 0, 88]]);
}
