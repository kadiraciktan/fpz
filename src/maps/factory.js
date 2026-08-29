import * as THREE from 'three';
import {
  addBaseLights,
  addGround,
  addBurningBarrel,
  addCarWreck,
  addFence,
  addMarketStall,
  addTankTrap,
  addSilo,
  addPipeRun,
  addGantry,
  addDebris,
} from './kit.js';

export const meta = {
  id: 'factory',
  name: 'Terk Edilmiş Fabrika',
  desc: 'Silolar, vinçler, makine bahçeleri. Doğu ve batı hangar kapıları puanla açılır.',
  swatch: 'linear-gradient(160deg, #5d4037 0%, #37474f 55%, #263238 100%)',
  outdoor: true, // weather + full day/night cycle run here
};

export function build(ctx) {
  const { scene } = ctx;

  scene.background = new THREE.Color(0x2a241f);
  addBaseLights(scene, {
    amb: 0x6a5f52, hemiSky: 0x5d4a3a, hemiGround: 0x2a2420,
    sunColor: 0xc9a878, sunInt: 0.55, fogColor: 0x33291f, fogNear: 24, fogFar: 110,
  });
  addGround(scene, 0x3a332c, 200);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4e443c, roughness: 0.95 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.45, metalness: 0.7 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.85 });
  const A = 44; // arena half-extent of the enclosed hall

  // Perimeter walls (enclosed arena, 88x88) — east/west sides leave a
  // 7 m gate gap at z=0 for the expansion hangars.
  const R = A;
  const GATE = 7;
  ctx.arenaHalf = R - 2;
  ctx.addBox(R * 2, 6, 1, 0, 3, -R, wallMat);
  ctx.addBox(R * 2, 6, 1, 0, 3, R, wallMat);
  ctx.addBox(1, 6, R - GATE / 2, -R, 3, -(R + GATE / 2) / 2, wallMat);
  ctx.addBox(1, 6, R - GATE / 2, -R, 3, (R + GATE / 2) / 2, wallMat);
  ctx.addBox(1, 6, R - GATE / 2, R, 3, -(R + GATE / 2) / 2, wallMat);
  ctx.addBox(1, 6, R - GATE / 2, R, 3, (R + GATE / 2) / 2, wallMat);

  // Interior container walls — corridor maze feel (spawn center kept clear)
  const containers = [
    { pos: [-16, -14], w: 12, h: 3, d: 1, rot: 0 },
    { pos: [14, -18], w: 10, h: 3, d: 1, rot: 0.4 },
    { pos: [0, 8], w: 14, h: 3.2, d: 1, rot: 0 },
    { pos: [-20, 10], w: 1, h: 3, d: 12, rot: 0 },
    { pos: [20, 8], w: 1, h: 3, d: 14, rot: 0 },
    { pos: [-6, 24], w: 10, h: 3, d: 1, rot: -0.25 },
    { pos: [26, -6], w: 1, h: 3, d: 10, rot: 0 },
    { pos: [0, -12], w: 9, h: 3, d: 1, rot: 0 },
    { pos: [-28, -2], w: 1, h: 3, d: 12, rot: 0 },
    { pos: [28, 22], w: 12, h: 3, d: 1, rot: 0.15 },
    { pos: [-30, 26], w: 10, h: 3, d: 1, rot: -0.1 },
    { pos: [30, -28], w: 1, h: 3, d: 12, rot: 0 },
    { pos: [-8, -32], w: 12, h: 3, d: 1, rot: 0.05 },
    { pos: [12, 34], w: 1, h: 3, d: 10, rot: 0 },
    { pos: [-34, -26], w: 10, h: 3.4, d: 1, rot: Math.PI / 2 },
    { pos: [34, 6], w: 8, h: 3.4, d: 1, rot: Math.PI / 2 },
  ];
  for (const c of containers) {
    ctx.addBox(c.w, c.h, c.d, c.pos[0], c.h / 2, c.pos[1], c.w === 1 || c.d === 1 ? metalMat : rustMat, { rotY: c.rot });
  }

  // Shipping-container stacks (two-high cover with a walkable gap).
  const containerColors = [0x6a4a3a, 0x3a4a5a, 0x4a5a3a, 0x5a5a5a];
  for (const [x, z, rot] of [
    [-24, -16, 0], [22, 14, 0.2], [-26, 20, -0.3], [24, -20, 0.1],
    [8, -34, 0], [-12, 34, 0.25], [36, -4, -0.2], [-36, -12, 0.15],
  ]) {
    const mat = new THREE.MeshStandardMaterial({
      color: containerColors[Math.abs(Math.round(x + z)) % containerColors.length],
      roughness: 0.85, metalness: 0.25,
    });
    ctx.addBox(6, 2.6, 2.4, x, 1.3, z, mat, { rotY: rot });
    if (Math.abs(x) % 3 === 0) ctx.addBox(6, 2.6, 2.4, x, 3.9, z, mat, { rotY: rot });
  }

  // Machine blocks: dark metal boxes with a "chimney"
  const machineDefs = [
    [-8, -24], [10, 8], [-22, -4], [20, 22], [-14, 28], [5, -8],
    [32, -18], [-32, 8], [6, 36], [-36, -32], [26, 32], [36, 18],
  ];
  for (const [x, z] of machineDefs) {
    const body = ctx.addBox(3, 2, 2.2, x, 1, z, metalMat);
    body.material = metalMat;
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 2.4, 8), rustMat);
    chimney.position.set(x + 1, 3.2, z);
    chimney.castShadow = true;
    scene.add(chimney);
    const steam = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.18, depthWrite: false })
    );
    steam.position.set(x + 1, 4.7, z);
    scene.add(steam);
  }

  // Oil drums clusters
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.6, metalness: 0.4 });
  const drumDefs = [
    [-10, -18], [-9.2, -17.4], [16, -10], [16.8, -9.2], [-20, 20], [8, 28], [28, 4],
    [-30, -14], [34, -30], [-18, 36], [38, 34], [2, -40],
  ];
  for (const [x, z] of drumDefs) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), drumMat);
    drum.position.set(x, 0.55, z);
    drum.castShadow = true;
    drum.receiveShadow = true;
    scene.add(drum);
    ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(0.9, 1.1, 0.9));
  }

  // Conveyor-style long table (cover) — two crossing lines.
  ctx.addBox(10, 0.9, 1.6, -3, 0.45, 12, crateMat, { rotY: 0.15 });
  ctx.addBox(8, 0.9, 1.6, 14, 0.45, -3, crateMat, { rotY: -0.6 });
  ctx.addBox(12, 0.9, 1.6, 18, 0.45, 26, crateMat, { rotY: 0 });
  ctx.addBox(9, 0.9, 1.6, -20, 0.45, -28, crateMat, { rotY: -0.2 });

  // Burning barrels + hanging work lights
  for (const [x, z] of [[-3, -24], [14, 16], [-20, 28], [30, -8], [-34, 18], [36, 30]]) addBurningBarrel(ctx, x, z);

  const hangLightMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.8 });
  for (const [x, z] of [
    [-14, 0], [14, 0], [0, -20], [0, 20],
    [-26, -26], [26, 26], [26, -26], [-26, 26], [0, -38], [0, 38],
  ]) {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 10, 1, true), hangLightMat);
    shade.position.set(x, 5.4, z);
    shade.rotation.x = Math.PI;
    scene.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 2 })
    );
    bulb.position.set(x, 5.15, z);
    scene.add(bulb);
    const pl = new THREE.PointLight(0xffe0a0, 1.1, 18, 2);
    pl.position.set(x, 5, z);
    scene.add(pl);
  }

  ctx.addCrateRing([
    [-4, 0, -4], [4, 0, -4], [4, 0, 4], [-4, 0, 4],
    [-28, 0, -22], [28, 0, 22], [30, 0, -28], [-30, 0, 14],
    [-40, 0, 36], [40, 0, -36], [18, 0, -40], [-18, 0, 40],
  ], 1.4);

  // ── Extra set dressing: silos, pipes, gantries, traps ──
  addSilo(ctx, -36, -36);
  addSilo(ctx, 36, 36);
  addSilo(ctx, 36, -38);
  addSilo(ctx, -38, 38);

  // Pipe runs along the perimeter walls + a low line feeding the machines.
  addPipeRun(ctx, 0, -41, 80, 0, 3.4, rustMat);
  addPipeRun(ctx, -41, 0, 80, Math.PI / 2, 3.4, rustMat);
  addPipeRun(ctx, 41, 6, 56, Math.PI / 2, 2.8, metalMat);
  addPipeRun(ctx, -8, -20, 16, 0, 1.2, rustMat);
  addPipeRun(ctx, 0, 30, 40, 0, 3.8, metalMat);

  // Overhead gantries spanning the work aisles (visual, no collision).
  addGantry(ctx, 3, -28, 16, 0);
  addGantry(ctx, -26, 18, 14, Math.PI / 2);
  addGantry(ctx, 24, 10, 14, Math.PI / 2);
  addGantry(ctx, 0, 34, 18, 0);

  // Tank traps + a fence line corral around the machine yard.
  addTankTrap(ctx, 0, -5);
  addTankTrap(ctx, 9, 18);
  addTankTrap(ctx, -8, 3);
  addTankTrap(ctx, -28, -28);
  addTankTrap(ctx, 30, 8);
  addTankTrap(ctx, -12, -38);
  addFence(ctx, 20, -20, 6, 0);
  addFence(ctx, -20, 30, 5, 0.35);
  addFence(ctx, 34, 28, 5, -0.4);
  addFence(ctx, -38, -6, 5, 1.5);

  // Sawdust-and-rust floor litter.
  const debrisMats = [rustMat, metalMat, crateMat];
  for (const [cx, cz, r, n] of [
    [0, 0, 8, 30], [-14, -18, 6, 16], [18, 12, 6, 16], [10, -6, 4, 12], [-20, 6, 4, 12],
    [-32, -20, 6, 16], [30, 20, 6, 16], [-24, 30, 5, 12], [28, -32, 5, 12], [0, 24, 5, 14],
  ]) addDebris(scene, cx, cz, r, n, debrisMats);

  // Second row of hanging work lights over the silos aisle.
  for (const [x, z] of [[-20, -20], [20, 20], [20, -20], [-20, 20], [-38, 0], [38, 0]]) {
    const pl = new THREE.PointLight(0xffd9a0, 0.8, 14, 2);
    pl.position.set(x, 5, z);
    scene.add(pl);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 2 })
    );
    bulb.position.set(x, 5.1, z);
    scene.add(bulb);
  }

  ctx.addTargets([
    [10, 0, -26], [-10, 0, 26], [26, 0, 10], [-26, 0, -10],
    [0, 0, 32], [32, 0, 0], [-36, 0, 20], [36, 0, -20],
  ]);

  // ── Progression expansion: gated east/west hangars ──
  const HR = 82; // hangar far wall
  for (const sx of [-1, 1]) {
    ctx.addBox(HR - A, 6, 1, sx * (A + HR) / 2, 3, -A, wallMat); // hall side walls
    ctx.addBox(HR - A, 6, 1, sx * (A + HR) / 2, 3, A, wallMat);
    ctx.addBox(1, 6, A * 2, sx * HR, 3, 0, wallMat); // hall far wall
  }
  ctx.addZone('main', [-A + 2, -A + 2, A - 2, A - 2]);
  ctx.addGateBarrier({
    x: -A - 1, z: 0, width: 6.5, rotY: Math.PI / 2, cost: 500, style: 'metal',
    zone: 'west', rect: [-(HR - 2), -A + 2, -(A + 3), A - 2],
  });
  ctx.addGateBarrier({
    x: A + 1, z: 0, width: 6.5, rotY: Math.PI / 2, cost: 500, style: 'metal',
    zone: 'east', rect: [A + 3, -A + 2, HR - 2, A - 2],
  });

  // East hangar: silo line + packing machines + a rail siding stub.
  addSilo(ctx, 64, -20);
  addSilo(ctx, 64, 20);
  addSilo(ctx, 74, 0);
  for (const [x, z] of [[52, -10], [52, 10], [68, -8], [68, 8], [76, -24], [76, 24]]) {
    ctx.addBox(3, 2, 2.2, x, 1, z, metalMat);
  }
  for (const [x, z] of [[49, 0], [72, -16], [72, 16], [58, 30], [58, -30], [78, 8]]) {
    addBurningBarrel(ctx, x, z);
  }
  ctx.addCrateRing([
    [58, 0, -28], [59.4, 0, -28], [58, 0, -26.6],
    [72, 0, 28], [70.6, 0, 28], [76, 0, -8], [50, 0, 24],
  ], 1.4);
  addPipeRun(ctx, 66, 0, 30, Math.PI / 2, 3.2, rustMat);
  addPipeRun(ctx, 55, -34, 24, 0, 2.6, metalMat);
  addFence(ctx, 56, 22, 6, 0.2);
  addFence(ctx, 70, -30, 5, 0);
  addTankTrap(ctx, 50, 0);
  addTankTrap(ctx, 66, -32);
  addGantry(ctx, 62, 0, 14, 0);
  addMarketStall(ctx, 54, -18, 0.4);
  // Rail siding: two short rails + a derailed flatcar inside the hangar.
  const railMat2 = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.5, metalness: 0.8 });
  for (const rz of [-37.4, -34.6]) {
    ctx.addBox(30, 0.12, 0.18, 62, 0.06, rz, railMat2, { collide: false });
  }
  const flatcar = ctx.addBox(2.6, 1.4, 8, 60, 0.9, -36, rustMat, { rotY: 0.06 });
  flatcar.castShadow = true;
  for (const [x, z] of [[54, 0], [72, 0], [64, -28], [64, 28], [76, 20], [76, -20]]) {
    const pl = new THREE.PointLight(0xffd9a0, 0.9, 16, 2);
    pl.position.set(x, 5, z);
    scene.add(pl);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 2 })
    );
    bulb.position.set(x, 5.1, z);
    scene.add(bulb);
  }
  addDebris(scene, 64, 0, 11, 30, debrisMats);
  ctx.addTargets([[58, 0, 0], [76, 0, -10], [64, 0, 26]]);

  // West hangar: scrap yard — drums, crates, a wrecked hauler frame.
  for (const [x, z] of [
    [-52, -8], [-52, 8], [-58, -18], [-58, 18], [-70, 0], [-72, -14], [-72, 14],
    [-64, -30], [-64, 30], [-78, -24], [-78, 24],
  ]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), drumMat);
    drum.position.set(x, 0.55, z);
    drum.castShadow = true;
    drum.receiveShadow = true;
    scene.add(drum);
    ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(0.9, 1.1, 0.9));
  }
  ctx.addCrateRing([
    [-64, 0, -24], [-65.4, 0, -24], [-64, 0, -22.6],
    [-48, 0, 24], [-49.4, 0, 23], [-72, 0, 28], [-70, 0, -28],
    [-78, 0, 6], [-78, 0, -6],
  ], 1.5);
  addSilo(ctx, -76, 30);
  addSilo(ctx, -76, -30);
  // Wrecked hauler: cab + empty trailer frame.
  addCarWreck(ctx, -56, 0, 1.45, 0x4a5444);
  ctx.addBox(2.4, 0.5, 10, -64, 0.3, 4, metalMat, { rotY: 0.1 });
  for (const tz of [-60, -60, -68, -68]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(tz < -64 ? -68.6 : -59.4, 0.5, (tz + 64) * 2.4);
    scene.add(wheel);
  }
  addBurningBarrel(ctx, -50, 0);
  addBurningBarrel(ctx, -68, 10);
  addBurningBarrel(ctx, -74, -18);
  addFence(ctx, -58, -34, 6, 0);
  addFence(ctx, -46, 30, 5, 0.3);
  addTankTrap(ctx, -50, 0);
  addTankTrap(ctx, -68, -10);
  addTankTrap(ctx, -76, 12);
  addGantry(ctx, -62, 16, 12, Math.PI / 2);
  addPipeRun(ctx, -65, 34, 26, 0, 2.8, rustMat);
  for (const [x, z] of [
    [-54, 0], [-72, 0], [-64, 28], [-64, -28], [-78, -12], [-78, 12],
  ]) {
    const pl = new THREE.PointLight(0xffd9a0, 0.9, 16, 2);
    pl.position.set(x, 5, z);
    scene.add(pl);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 2 })
    );
    bulb.position.set(x, 5.1, z);
    scene.add(bulb);
  }
  addDebris(scene, -64, 0, 11, 30, debrisMats);
  ctx.addTargets([[-56, 0, 0], [-76, 0, 10], [-64, 0, -26]]);
}

