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
  addTankTrap,
  addUtilityPole,
  addWires,
  addDebris,
  addRadioDesk,
  addWallStencil,
  createWarSkyCubeTexture,
} from './kit.js';
import {
  addJerseyRow,
  addBarbedFence,
  addCrateStack,
  addDumpster,
  addRoadSign,
  addWaterTower,
  addFieldTent,
  addCrater,
  addTramWreck,
  addDeadTree,
  addPillbox,
} from './props.js';

export const meta = {
  id: 'konvoy',
  name: 'Konvoy Geçidi',
  desc: 'BÖLÜM 1 · Karakoldan verici meydanına uzanan lineer konvoy hattı. İki kapıyı kır, kuzeye ilerle.',
  swatch: 'linear-gradient(160deg, #7d8471 0%, #5c5a4a 55%, #3a3d34 100%)',
  outdoor: true,
  missionOnly: true, // story-campaign map: hidden from the classic map grid
};

// ── MISSION MAP 1: linear convoy route ────────────────────────────────
//
//   ┌──────────────────────┐
//   │   MEYDAN (verici)    │  z 45..68 — relay pad + fountain
//   ├══════ gate 2 (750) ══┤
//   │   KONVOY SOKAĞI      │  z 18..42 — jackknifed hauler, tram, stalls
//   ├══════ gate 1 (500) ══┤
//   │   KARAKOL (spawn)    │  z -24..14 — sandbags, wrecks, tents
//   └──────────────────────┘
//
// One road runs south→north; each gate is a point-buyable barrier, so the
// bölüm advances forward in a straight line instead of a radial arena.

export function build(ctx) {
  const { scene, obstacles } = ctx;

  scene.background = createWarSkyCubeTexture();
  addBaseLights(scene, {
    amb: 0xb0aca0, hemiSky: 0x93938a, hemiGround: 0x46423a,
    sunColor: 0xd8d2c0, sunInt: 0.85, fogColor: 0x8a8578, fogNear: 45, fogFar: 170,
  });
  addGround(scene, 0x4a463c, 300);

  const brickMat = new THREE.MeshStandardMaterial({ color: 0x6e5a4a, roughness: 0.95 });
  const brickDarkMat = new THREE.MeshStandardMaterial({ color: 0x54453a, roughness: 0.95 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5850, roughness: 0.9 });
  const partMat = new THREE.MeshStandardMaterial({ color: 0x5a5850, roughness: 0.95 });
  const perimeterMat = new THREE.MeshStandardMaterial({ color: 0x4d4a42, roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.85 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.5, metalness: 0.65 });
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0x5a5f46, roughness: 0.95 });
  const debrisMats = [brickMat, brickDarkMat, concreteMat, woodMat];

  const X = 26;          // half-width of the corridor
  const Z0 = -26;        // south end
  const Z1 = 70;         // north end
  ctx.arenaHalf = Z1;

  // Perimeter: a long walled corridor, not an open field.
  ctx.addBox(1, 6, Z1 - Z0 + 2, -(X + 0.5), 3, (Z0 + Z1) / 2, perimeterMat);
  ctx.addBox(1, 6, Z1 - Z0 + 2, X + 0.5, 3, (Z0 + Z1) / 2, perimeterMat);
  ctx.addBox(X * 2 + 2, 6, 1, 0, 3, Z0 - 0.5, perimeterMat);
  ctx.addBox(X * 2 + 2, 6, 1, 0, 3, Z1 + 0.5, perimeterMat);

  // The road itself: one asphalt ribbon cutting the whole length.
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 1 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(15, Z1 - Z0 - 2), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, (Z0 + Z1) / 2);
  road.receiveShadow = true;
  scene.add(road);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x6a6550, roughness: 1 });
  for (let z = Z0 + 4; z < Z1 - 2; z += 5) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    scene.add(dash);
  }

  // Distant ruined skyline (decor only)
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x6a675e, roughness: 1 });
  for (const [sx, sz, w, h] of [
    [-60, -60, 24, 14], [62, -58, 26, 16], [-70, 30, 22, 13], [70, 34, 24, 15],
    [-64, 90, 22, 14], [64, 96, 26, 16], [0, 105, 30, 17],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 11), skylineMat);
    m.position.set(sx, h / 2 - 0.5, sz);
    m.rotation.y = (Math.random() - 0.5) * 0.2;
    scene.add(m);
  }

  // ══ ZONE 1: karakol (spawn, z -24..14) ═════════════════════════════
  addSandbagWall(ctx, -8, -4, 5, 0.08);
  addSandbagWall(ctx, 8, -2, 4, -0.06);
  addSandbagWall(ctx, 0, -13, 5, 0);
  addSandbagWall(ctx, -14, 8, 4, 1.45);
  addSandbagWall(ctx, 14, 10, 4, -1.45);
  addCarWreck(ctx, -15, -11, 1.5, 0x4a5444);
  addCarWreck(ctx, 13, -15, -1.2, 0x50463e);
  addCarWreck(ctx, 17, 2, 0.3, 0x444f5a);
  addBusStop(ctx, -17, 6);
  addMarketStall(ctx, 15, 7, 0.3);
  addTankTrap(ctx, -4, 9);
  addTankTrap(ctx, 5, 11);
  // Props pass: jersey block mid-road funnels the horde into the lanes,
  // hard cover on the sidewalks, one supply tent behind the line.
  addJerseyRow(ctx, -2, 6, 3, 0);
  addCrateStack(ctx, -19, -8, 0.6);
  addDumpster(ctx, 21, 8, -1.6);
  addFieldTent(ctx, -20, 12, 0.3);
  addRoadSign(ctx, -9, 13, -0.2);
  // Landmarks: two pillboxes cover the gate-1 approach, one shell hole
  // pocks the road, a dead tree marks the west edge of the outpost.
  addPillbox(ctx, -10, 12, 0.2);
  addPillbox(ctx, 10, 12, -0.2);
  addCrater(ctx, 4.5, -4, 1.6);
  addDeadTree(ctx, -21, -12, 5.5);
  addTankTrap(ctx, -12, -1);
  addTankTrap(ctx, 12, -5);
  addBurningBarrel(ctx, -10, -17);
  addBurningBarrel(ctx, 10, -19);
  addBurningBarrel(ctx, 0, 12);
  addFence(ctx, -20, -18, 6, 0.15);
  addFence(ctx, 20, -22, 5, -0.2);
  ctx.addCrateRing([
    [-20, 0, -2], [-18.6, 0, -2], [-20, 0, -0.6],
    [20, 0, 12], [21.4, 0, 12], [-6, 0, 12], [7, 0, -20],
  ], 1.3);
  const ammoMat = new THREE.MeshStandardMaterial({ color: 0x3f4a33, roughness: 0.8 });
  ctx.addBox(1.6, 0.8, 0.9, -18, 0.4, 12, ammoMat, { rotY: 0.3 });
  ctx.addBox(1.6, 0.8, 0.9, 19, 0.4, -12, ammoMat, { rotY: -0.4 });
  // Supply tents behind the sandbag line.
  for (const [tx, tz, tr] of [[-8, -19, 0.1], [-2, -21, -0.15], [5, -22, 0.05]]) {
    const tent = new THREE.Group();
    tent.position.set(tx, 0, tz);
    tent.rotation.y = tr;
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 2.4), canvasMat);
    body.position.y = 0.8;
    body.castShadow = true;
    tent.add(body);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.12), canvasMat);
    ridge.position.y = 1.68;
    tent.add(ridge);
    scene.add(tent);
    ctx.addCollisionBox(tx, 0.8, tz, new THREE.Vector3(3.4, 1.6, 2.4), tr);
  }
  addWallStencil(ctx, -X + 1.2, 2.2, -14, Math.PI / 2, 'KUZEY ↓', '#c9b27a');
  for (const [x, z] of [[-6, 13], [6, 13], [-16, -6], [16, -10], [0, -24]]) {
    const lamp = createStreetLamp((x + z) % 3 === 0);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    obstacles.push(lamp);
  }
  addWires(scene, [
    addUtilityPole(ctx, -22, -20),
    addUtilityPole(ctx, -22, -8),
    addUtilityPole(ctx, -22, 4, true),
    addUtilityPole(ctx, -22, 14),
  ]);
  addDebris(scene, 0, -8, 9, 22, debrisMats);
  addDebris(scene, -14, 4, 6, 14, debrisMats);
  ctx.addTargets([[-8, 0, 6], [9, 0, 4], [0, 0, -18], [-16, 0, -14], [18, 0, 14]]);

  ctx.addZone('karakol', [-X + 2, Z0 + 2, X - 2, 14]);

  // ── Gate 1 (z=16): blast partition with a 7 m gap ──
  const GATE = 7;
  const wallW = X - GATE / 2;
  for (const gz of [16]) {
    ctx.addBox(wallW, 3.5, 0.8, -(GATE / 2 + wallW / 2), 1.75, gz, partMat);
    ctx.addBox(wallW, 3.5, 0.8, (GATE / 2 + wallW / 2), 1.75, gz, partMat);
  }
  ctx.addGateBarrier({
    x: 0, z: 16, width: 7, cost: 500, style: 'wood',
    zone: 'konvoy', rect: [-X + 2, 18, X - 2, 42],
  });

  // ══ ZONE 2: konvoy sokağı (z 18..42) ═══════════════════════════════
  addFacade(ctx, -22, 22, 8, 6, Math.PI / 2, brickMat);
  addFacade(ctx, 22, 26, 7, 5.5, -Math.PI / 2, brickDarkMat);
  addFacade(ctx, -23, 34, 8, 6.5, Math.PI / 2, brickDarkMat);
  addFacade(ctx, 23, 38, 7, 5, -Math.PI / 2, brickMat);
  addFacade(ctx, -10, 41, 8, 5.5, Math.PI, brickMat);
  addFacade(ctx, 11, 42, 7, 5, Math.PI, brickDarkMat);
  // Jackknifed hauler: cab + detached trailer across the road.
  addCarWreck(ctx, -6, 24, 1.35, 0x4a5444);
  ctx.addBox(2.4, 2.6, 8, 2, 1.3, 27, metalMat, { rotY: 0.5 });
  addCarWreck(ctx, 12, 32, -0.9, 0x50463e);
  addCarWreck(ctx, -12, 38, 0.4, 0x444f5a);
  addSandbagWall(ctx, 4, 20, 4, 0.25);
  addSandbagWall(ctx, -5, 30, 4, -0.15);
  addSandbagWall(ctx, 16, 38, 4, 1.3);
  addTankTrap(ctx, -2, 21);
  addTankTrap(ctx, 7, 27);
  addTankTrap(ctx, -9, 26);
  addTankTrap(ctx, 3, 35);
  addTankTrap(ctx, -16, 33);
  addBurningBarrel(ctx, 8, 22);
  addBurningBarrel(ctx, -9, 33);
  addBurningBarrel(ctx, 14, 27);
  addFence(ctx, -18, 26, 5, 1.4);
  addFence(ctx, 18, 34, 5, -1.4);
  addMarketStall(ctx, -15, 21, -0.3);
  addMarketStall(ctx, 16, 22, 0.2);
  // Props pass: jersey + wire squeeze the alley, dumpster and crate cover
  // the flank routes around the hauler.
  addJerseyRow(ctx, 10, 21, 3, 0.15);
  addBarbedFence(ctx, -20, 30, 8, Math.PI / 2);
  // The street's signature piece: a jackknifed tram blocking the road,
  // torn open on the near side so you can fight (or hide) inside it.
  addTramWreck(ctx, 1, 33.5, 0.45);
  addCrater(ctx, 9, 23.5, 1.5);
  addDumpster(ctx, -19, 23, 1.5);
  addCrateStack(ctx, 2, 40.5, -0.5);
  addRoadSign(ctx, 4, 38, -0.4);
  ctx.addCrateRing([
    [-14, 0, 28], [-12.6, 0, 28], [-14, 0, 29.4],
    [13, 0, 37], [14.4, 0, 37], [10, 0, 20], [-4, 0, 41],
  ], 1.3);
  addWires(scene, [
    addUtilityPole(ctx, 22, 18),
    addUtilityPole(ctx, 22, 30, true),
    addUtilityPole(ctx, 22, 41),
  ]);
  for (const [x, z] of [[-5, 19], [5, 25], [-6, 33], [6, 40], [-18, 30], [18, 20]]) {
    const lamp = createStreetLamp((x + z) % 4 === 0);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    obstacles.push(lamp);
  }
  addDebris(scene, 0, 24, 9, 24, debrisMats);
  addDebris(scene, -10, 36, 7, 16, debrisMats);
  ctx.addTargets([[0, 0, 22], [-10, 0, 27], [11, 0, 30], [-6, 0, 39], [16, 0, 24]]);

  // ── Gate 2 (z=44) ──
  for (const gz of [44]) {
    ctx.addBox(wallW, 3.5, 0.8, -(GATE / 2 + wallW / 2), 1.75, gz, partMat);
    ctx.addBox(wallW, 3.5, 0.8, (GATE / 2 + wallW / 2), 1.75, gz, partMat);
  }
  ctx.addGateBarrier({
    x: 0, z: 44, width: 7, cost: 750, style: 'metal',
    zone: 'meydan', rect: [-X + 2, 46, X - 2, Z1 - 3],
  });

  // ══ ZONE 3: meydan — the relay pad (z 46..68) ══════════════════════
  // Raised concrete pad where the mission transmitter stands.
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.18, 24), concreteMat);
  pad.position.set(0, 0.09, 56);
  pad.receiveShadow = true;
  scene.add(pad);
  addRadioDesk(ctx, 0, 56, 0);
  // Antenna mast with a blinking beacon.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 9, 8), metalMat);
  mast.position.set(1.8, 4.5, 57.2);
  mast.castShadow = true;
  scene.add(mast);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff2211, emissiveIntensity: 2.4 })
  );
  beacon.position.set(1.8, 9.1, 57.2);
  scene.add(beacon);
  const beaconLight = new THREE.PointLight(0xff4422, 1.4, 14, 2);
  beaconLight.position.set(1.8, 9, 57.2);
  scene.add(beaconLight);
  // Generator + fuel drums feeding the transmitter.
  ctx.addBox(1.4, 1.1, 0.9, -2.6, 0.55, 58, metalMat, { rotY: 0.2 });
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.6, metalness: 0.4 });
  for (const [dx, dz] of [[-3.6, 58.8], [-3.2, 59.6]]) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), drumMat);
    drum.position.set(dx, 0.55, dz);
    drum.castShadow = true;
    scene.add(drum);
    ctx.addCollisionBox(dx, 0.55, dz, new THREE.Vector3(0.9, 1.1, 0.9));
  }
  // Sandbag U around the pad — the hold fight digs in here.
  addSandbagWall(ctx, -5.5, 56, 5, Math.PI / 2);
  addSandbagWall(ctx, 5.5, 56, 5, Math.PI / 2);
  addSandbagWall(ctx, 0, 50.5, 5, 0);
  // Facade ring closing the square.
  addFacade(ctx, -14, 66, 9, 6.5, Math.PI, brickMat);
  addFacade(ctx, 0, 67, 10, 6, Math.PI, brickDarkMat);
  addFacade(ctx, 14, 66, 9, 6, Math.PI, brickMat);
  addFacade(ctx, -24, 52, 7, 5.5, Math.PI / 2, brickDarkMat);
  addFacade(ctx, 24, 60, 8, 6, -Math.PI / 2, brickMat);
  // Dry fountain at the square's east side.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.8, 16), concreteMat);
  basin.position.set(14, 0.4, 60);
  basin.castShadow = true;
  basin.receiveShadow = true;
  scene.add(basin);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.4, 10), concreteMat);
  column.position.set(14, 1.6, 60);
  column.castShadow = true;
  scene.add(column);
  ctx.addCollisionBox(14, 0.8, 60, new THREE.Vector3(5, 0.8, 5));
  addMarketStall(ctx, -13, 60, 0.4);
  addMarketStall(ctx, 12, 50, -0.25);
  // Props pass: the water tower anchors the square's west corner as the
  // skyline landmark for the hold fight; wire closes the east flank.
  addWaterTower(ctx, -20, 60);
  addBarbedFence(ctx, 20, 50, 8, Math.PI / 2);
  addRoadSign(ctx, 8, 47, 0.3);
  addCrater(ctx, 7, 48.5, 1.7);
  addDeadTree(ctx, 19, 47.5, 5.2);
  addBurningBarrel(ctx, -8, 62);
  addBurningBarrel(ctx, 9, 63);
  addBurningBarrel(ctx, -17, 49);
  addTankTrap(ctx, -10, 48);
  addTankTrap(ctx, 11, 47);
  addTankTrap(ctx, 19, 52);
  addFence(ctx, -19, 64, 6, 0.1);
  addFence(ctx, 20, 66, 5, -0.15);
  ctx.addCrateRing([
    [-20, 0, 56], [-18.6, 0, 56], [20, 0, 58], [21.4, 0, 58], [17, 0, 47],
  ], 1.3);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x4a3d2c, roughness: 0.9 });
  for (const [bx, bz, brot] of [[-8, 52, 0], [8, 52, 0], [-9, 60, Math.PI], [9, 60, Math.PI]]) {
    ctx.addBox(2.2, 0.45, 0.6, bx, 0.25, bz, benchMat, { rotY: brot });
  }
  for (const [x, z] of [[-12, 50], [12, 50], [-16, 62], [16, 62], [0, 66]]) {
    const lamp = createStreetLamp((x + z) % 3 === 0);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
    obstacles.push(lamp);
  }
  addDebris(scene, 0, 52, 9, 22, debrisMats);
  addDebris(scene, -14, 62, 7, 14, debrisMats);
  ctx.addTargets([[0, 0, 49], [-9, 0, 58], [10, 0, 58], [-16, 0, 47], [18, 0, 60], [0, 0, 64]]);
}
