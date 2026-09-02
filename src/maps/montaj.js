import * as THREE from 'three';
import {
  addBaseLights,
  addGround,
  addBurningBarrel,
  addSandbagWall,
  addSilo,
  addPipeRun,
  addGantry,
  addFence,
  addTankTrap,
  addServerRack,
  addDebris,
  addRadioDesk,
  addWallStencil,
} from './kit.js';
import {
  addBarbedFence,
  addCrateStack,
  addCinderCover,
  addDumpster,
  addLockerRow,
  addPumpUnit,
  addConveyorLine,
  addCrater,
} from './props.js';

export const meta = {
  id: 'montaj',
  name: 'Montaj Hattı',
  desc: 'BÖLÜM 2 · Rampadan kontrol odasına lineer ilerleyen dört salonlu fabrika. Kapıları kır, kuzeye yürü.',
  swatch: 'linear-gradient(160deg, #4e342e 0%, #455a64 50%, #1c2429 100%)',
  outdoor: true,
  missionOnly: true,
};

// ── MISSION MAP 2: linear assembly plant ──────────────────────────────
//
//   ┌──────────────────────┐  z 78..94
//   │  KONTROL ODASI       │  final hold — console bank + key terminal
//   ├══════ gate 3 (1000) ═┤
//   │  ERİTME OCAĞI        │  z 44..66  boss floor — furnace + slag
//   ├══════ gate 2 (750) ══┤
//   │  MONTAJ HATTI        │  z 16..36  conveyor line + container maze
//   ├══════ gate 1 (500) ══┤
//   │  YÜKLEME RAMPASI     │  z -12..12 spawn — dock, hauler, crates
//   └──────────────────────┘
//
// One axis (south→north), four sequential halls. The conveyor belt is a
// literal production line running the length of the second hall.

export function build(ctx) {
  const { scene } = ctx;

  scene.background = new THREE.Color(0x241f1b);
  addBaseLights(scene, {
    amb: 0x6a5f52, hemiSky: 0x5d4a3a, hemiGround: 0x2a2420,
    sunColor: 0xc9a878, sunInt: 0.45, fogColor: 0x30271e, fogNear: 26, fogFar: 120,
  });
  addGround(scene, 0x3a332c, 240);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4e443c, roughness: 0.95 });
  const partMat = new THREE.MeshStandardMaterial({ color: 0x544a40, roughness: 0.92 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.45, metalness: 0.7 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.85 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x4a463e, roughness: 0.92 });
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.6, metalness: 0.4 });
  const debrisMats = [rustMat, metalMat, crateMat, concreteMat];

  const X = 26;        // hall half-width
  const Z0 = -14;      // south end (loading dock)
  const Z1 = 96;       // north end (control room)
  ctx.arenaHalf = Z1;

  // Perimeter shell.
  ctx.addBox(1, 6, Z1 - Z0 + 2, -(X + 0.5), 3, (Z0 + Z1) / 2, wallMat);
  ctx.addBox(1, 6, Z1 - Z0 + 2, X + 0.5, 3, (Z0 + Z1) / 2, wallMat);
  ctx.addBox(X * 2 + 2, 6, 1, 0, 3, Z0 - 0.5, wallMat);
  ctx.addBox(X * 2 + 2, 6, 1, 0, 3, Z1 + 0.5, wallMat);
  // Sawtooth factory roof (decor silhouette, no collision).
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 1 });
  for (let z = Z0 + 4; z < Z1; z += 12) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(X * 2 + 1, 0.3, 9), roofMat);
    roof.position.set(0, 6.4, z);
    roof.rotation.x = 0.18;
    scene.add(roof);
  }
  // Ceiling light strips along the spine (pool-driven).
  for (let z = Z0 + 6; z < Z1; z += 11) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a0, emissiveIntensity: 1.8 })
    );
    strip.position.set(0, 5.7, z);
    scene.add(strip);
    const pl = new THREE.PointLight(0xffe0a0, 1.0, 20, 2);
    pl.position.set(0, 5.4, z);
    scene.add(pl);
  }

  const addGate = (z, cost, style, zone, rect) => {
    const GATE = 7;
    const wallW = X - GATE / 2;
    ctx.addBox(wallW, 4.5, 0.9, -(GATE / 2 + wallW / 2), 2.25, z, partMat);
    ctx.addBox(wallW, 4.5, 0.9, (GATE / 2 + wallW / 2), 2.25, z, partMat);
    ctx.addBox(GATE + 1.2, 1.1, 0.9, 0, 5.0, z, partMat); // gate lintel
    ctx.addGateBarrier({ x: 0, z, width: 7, cost, style, zone, rect });
  };

  // ══ ZONE 1: yükleme rampası (spawn, z -12..12) ═════════════════════
  const ramp = ctx.addBox(10, 0.7, 6, -14, 0.35, -8, concreteMat, { rotY: 0.1 });
  ramp.receiveShadow = true;
  addCarHauler(ctx, 12, -6, -0.35);
  ctx.addCrateRing([
    [-20, 0, -2], [-18.6, 0, -2], [-20, 0, -0.6],
    [20, 0, 4], [21.4, 0, 4], [-8, 0, 8], [8, 0, -10], [17, 0, 9], [-17, 0, 10],
  ], 1.4);
  ctx.addBox(1.6, 0.8, 0.9, -6, 0.4, 4, ammoMat, { rotY: 0.3 });
  ctx.addBox(1.6, 0.8, 0.9, 16, 0.4, -10, ammoMat, { rotY: -0.5 });
  for (const [x, z] of [[-22, 2], [22, -8], [0, -12]]) addBurningBarrel(ctx, x, z);
  addFence(ctx, -10, 11, 6, 0);
  addFence(ctx, 8, -12, 5, 0.2);
  addTankTrap(ctx, -3, 10);
  addTankTrap(ctx, 10, 6);
  addGantry(ctx, 0, -4, 20, 0);
  addPipeRun(ctx, -X + 2, -6, 20, Math.PI / 2, 3.6, rustMat);
  // Props pass: a short spur conveyor feeding the dock, crate/cinder
  // cover in the open, wire segment closing the west edge.
  addConveyorLine(ctx, 18, 0, 8, Math.PI / 2);
  addCrateStack(ctx, -21, -6, 0.8);
  addCinderCover(ctx, -2, 0, 0.2);
  addDumpster(ctx, 21, -12, -0.4);
  addBarbedFence(ctx, -22, 6, 8, Math.PI / 2);
  addWallStencil(ctx, -X + 0.4, 2.6, 12.4, Math.PI / 2, 'KUZEY ↓ HAT', '#ffb74d');
  addDebris(scene, 0, -4, 10, 26, debrisMats);
  ctx.addTargets([[-10, 0, 4], [10, 0, -2], [0, 0, 10], [-18, 0, -8], [18, 0, 6]]);

  ctx.addZone('rampa', [-X + 2, Z0 + 3, X - 2, 12]);
  addGate(14, 500, 'metal', 'hat', [-X + 2, 16, X - 2, 36]);

  // ══ ZONE 2: montaj hattı (z 16..36) ════════════════════════════════
  // The conveyor: two rails + slats running the hall's whole length.
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.85, metalness: 0.4 });
  for (const bx of [-7.9, -6.1]) {
    ctx.addBox(0.25, 0.9, 20, bx, 0.45, 26, beltMat, { collide: false });
  }
  for (let z = 17; z <= 35; z += 1.1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.7), metalMat);
    slat.position.set(-7, 0.92, z);
    scene.add(slat);
  }
  // Crates riding the belt (waist-high cover along the line).
  for (const cz of [20, 25, 30]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), crateMat);
    box.position.set(-7, 1.4, cz);
    box.rotation.y = (Math.random() - 0.5) * 0.4;
    box.castShadow = true;
    scene.add(box);
  }
  // Container maze flanking the line.
  const containerColors = [0x6a4a3a, 0x3a4a5a, 0x4a5a3a, 0x5a5a5a];
  for (const [x, z, rot] of [
    [8, 19, 0], [8, 33, 0], [-16, 18, 0.2], [-18, 34, -0.2],
    [18, 26, Math.PI / 2], [-20, 26, Math.PI / 2], [14, 17, 0.15], [16, 35, -0.15],
  ]) {
    const mat = new THREE.MeshStandardMaterial({
      color: containerColors[Math.abs(Math.round(x + z)) % containerColors.length],
      roughness: 0.85, metalness: 0.25,
    });
    ctx.addBox(8, 2.6, 2.4, x, 1.3, z, mat, { rotY: rot });
    if (Math.abs(z) % 3 === 0) ctx.addBox(8, 2.6, 2.4, x, 3.9, z, mat, { rotY: rot });
  }
  // Robotic press stations: posts + arms straddling the belt.
  for (const pz of [21, 28]) {
    for (const sx of [-9.6, -4.4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), metalMat);
      post.position.set(sx, 1.7, pz);
      post.castShadow = true;
      scene.add(post);
      ctx.addCollisionBox(sx, 1.0, pz, new THREE.Vector3(0.6, 2.0, 0.6));
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 0.5), rustMat);
    arm.position.set(-7, 3.4, pz);
    arm.castShadow = true;
    scene.add(arm);
    const ram = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1), metalMat);
    ram.position.set(-7, 2.8, pz);
    ram.castShadow = true;
    scene.add(ram);
  }
  for (const [x, z] of [[-22, 20], [22, 24], [-14, 35], [20, 34]]) addBurningBarrel(ctx, x, z);
  addTankTrap(ctx, 2, 18);
  addTankTrap(ctx, 4, 34);
  addTankTrap(ctx, -2, 27);
  addGantry(ctx, 12, 26, 12, Math.PI / 2);
  addDumpster(ctx, -23, 32, 1.5);
  addPipeRun(ctx, X - 2, 26, 20, Math.PI / 2, 3.2, rustMat);
  addPipeRun(ctx, -2, 36, 18, 0, 2.6, metalMat);
  addDebris(scene, 0, 26, 12, 30, debrisMats);
  ctx.addTargets([[2, 0, 20], [6, 0, 30], [-14, 0, 24], [18, 0, 20], [0, 0, 34]]);

  addGate(38, 750, 'metal', 'oca', [-X + 2, 44, X - 2, 66]);

  // ══ ZONE 3: eritme ocağı (boss floor, z 44..66) ════════════════════
  // Furnace: glowing mouth + slag channel across the aisle.
  const furnaceMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.8, metalness: 0.5 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff4400, emissiveIntensity: 2.2 });
  const furnace = new THREE.Group();
  furnace.position.set(0, 0, 55);
  const fbody = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 4), furnaceMat);
  fbody.position.y = 2.5;
  fbody.castShadow = true;
  furnace.add(fbody);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.3), glowMat);
  mouth.position.set(0, 1.6, -2.1);
  furnace.add(mouth);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 4, 10), furnaceMat);
  stack.position.set(1.6, 6.6, 0);
  stack.castShadow = true;
  furnace.add(stack);
  const fglow = new THREE.PointLight(0xff6a20, 2.2, 18, 2);
  fglow.position.set(0, 2, -3);
  furnace.add(fglow);
  scene.add(furnace);
  ctx.addCollisionBox(0, 2.5, 55, new THREE.Vector3(6.4, 5, 4.4));
  // Slag channel (glowing gutter in the floor, decor).
  const slag = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 10), glowMat);
  slag.position.set(0, 0.05, 48);
  scene.add(slag);
  // Boss-arena cover: pig-iron stacks.
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.6, metalness: 0.7 });
  for (const [x, z] of [[-10, 47], [-10, 57], [10, 47], [10, 57], [-17, 62], [17, 62]]) {
    ctx.addBox(3, 1.1, 2, x, 0.55, z, ironMat, { rotY: (Math.random() - 0.5) * 0.4 });
  }
  addSilo(ctx, -21, 46);
  addSilo(ctx, 21, 46);
  addSilo(ctx, -21, 64);
  addSilo(ctx, 21, 64);
  for (const [x, z] of [[-6, 45], [7, 46], [-13, 52], [14, 53], [-5, 64], [6, 65]]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), drumMat);
    drum.position.set(x, 0.55, z);
    drum.castShadow = true;
    scene.add(drum);
    ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(0.9, 1.1, 0.9));
  }
  for (const [x, z] of [[-8, 50], [8, 60], [0, 64]]) addBurningBarrel(ctx, x, z);
  addPipeRun(ctx, 0, 66, 40, 0, 3.8, rustMat);
  addPipeRun(ctx, -12, 60, 10, Math.PI / 2, 1.6, rustMat);
  addPipeRun(ctx, 12, 60, 10, Math.PI / 2, 1.6, rustMat);
  addGantry(ctx, 0, 50, 18, 0);
  // Coolant pump nursing the furnace + a cinder knee-wall off the slag line.
  addPumpUnit(ctx, 0, 60, 0.15);
  addCinderCover(ctx, -4, 62, -0.3);
  // Something heavy came through the sawtooth roof here during the fall.
  addCrater(ctx, -5, 50, 1.6);
  addFence(ctx, -18, 50, 6, Math.PI / 2);
  addFence(ctx, 18, 58, 6, Math.PI / 2);
  addTankTrap(ctx, -4, 44);
  addTankTrap(ctx, 5, 65);
  addWallStencil(ctx, X - 0.4, 2.6, 46, -Math.PI / 2, 'PATRON · 1. HAT', '#ff8a65');
  addDebris(scene, 0, 55, 12, 30, debrisMats);
  ctx.addTargets([[-6, 0, 46], [7, 0, 52], [-13, 0, 60], [13, 0, 62], [0, 0, 62]]);

  addGate(68, 1000, 'steel', 'kontrol', [-X + 2, 78, X - 2, Z1 - 3]);

  // ══ ZONE 4: kontrol odası (final hold, z 78..93) ═══════════════════
  // Raised operator deck with a wall of consoles at the north end.
  const deck = ctx.addBox(20, 0.5, 10, 0, 0.25, 86, concreteMat);
  deck.receiveShadow = true;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x50433a, roughness: 0.6, metalness: 0.6 });
  for (const rx of [-10, 10]) {
    ctx.addBox(0.15, 1.1, 10, rx, 1.05, 86, railMat, { collide: false });
  }
  for (const rz of [81, 91]) {
    ctx.addBox(20, 1.1, 0.15, 0, 1.05, rz, railMat, { collide: false });
  }
  // Console bank: desk + blinking boards (the "key terminal" of the brief).
  addRadioDesk(ctx, 0, 91, Math.PI);
  const consoleMat = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.6, metalness: 0.5 });
  for (const cx of [-8, -4, 4, 8]) {
    ctx.addBox(3.2, 1.9, 0.8, cx, 1.45, 92.5, consoleMat);
    for (let i = 0; i < 5; i++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.05),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x33ff66 : 0xffaa22 })
      );
      led.position.set(cx - 1.2 + i * 0.6, 2.0, 92.05);
      scene.add(led);
    }
  }
  const keyGlow = new THREE.PointLight(0x4fc3f7, 1.6, 12, 2);
  keyGlow.position.set(0, 2.2, 90);
  scene.add(keyGlow);
  for (const rz of [80, 84, 88]) {
    addServerRack(ctx, -22, rz, Math.PI / 2);
    addServerRack(ctx, 22, rz, -Math.PI / 2);
  }
  ctx.addBox(1.6, 0.8, 0.9, -14, 0.4, 79, ammoMat, { rotY: 0.4 });
  ctx.addBox(1.6, 0.8, 0.9, 14, 0.4, 79, ammoMat, { rotY: -0.4 });
  ctx.addCrateRing([[-20, 0, 82], [-18.6, 0, 82], [20, 0, 82], [21.4, 0, 82]], 1.3);
  for (const [x, z] of [[-16, 86], [16, 86]]) addBurningBarrel(ctx, x, z);
  addSandbagWall(ctx, -6, 79, 4, 0);
  addSandbagWall(ctx, 6, 79, 4, 0);
  // Operator lockers on the deck apron + a bin by the east stair gap.
  addLockerRow(ctx, -16, 79, 6, Math.PI / 2);
  addDumpster(ctx, 16, 80, Math.PI / 2);
  addPipeRun(ctx, -X + 2, 86, 18, Math.PI / 2, 3.4, metalMat);
  addPipeRun(ctx, X - 2, 86, 18, Math.PI / 2, 3.4, metalMat);
  addWallStencil(ctx, X - 0.4, 2.6, 78.6, -Math.PI / 2, 'SİSTEM KİLİDİ', '#4fc3f7');
  addDebris(scene, 0, 82, 10, 22, debrisMats);
  ctx.addTargets([[0, 0, 80], [-8, 0, 86], [8, 0, 86], [-16, 0, 90], [16, 0, 90]]);
}

// ── Local helper: docked hauler (this map's own dressing) ────────────

function addCarHauler(ctx, x, z, rotY) {
  const paintMat = new THREE.MeshStandardMaterial({ color: 0x4a5444, roughness: 0.85, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.6), paintMat);
  cab.position.set(0, 1.3, 1.8);
  cab.castShadow = true;
  g.add(cab);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 8), darkMat);
  trailer.position.set(0, 0.8, -3.4);
  trailer.castShadow = true;
  g.add(trailer);
  const load = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.9 }));
  load.position.set(0, 2.1, -3.6);
  load.rotation.y = 0.05;
  load.castShadow = true;
  g.add(load);
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 10);
  for (const [wx, wz] of [[-1.2, 2.2], [1.2, 2.2], [-1.2, -2.5], [1.2, -2.5], [-1.2, -5], [1.2, -5]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.55, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  ctx.scene.add(g);
  ctx.addCollisionBox(x, 1.4, z, new THREE.Vector3(2.8, 2.8, 11), rotY);
}
