import * as THREE from 'three';
import { createCrate, createTarget, createStreetLamp, createBarrier } from './Prefabs.js';

/**
 * Scene.js
 * Map factory: builds one of several playable arenas. Each map shares the
 * same skeleton (lights, sky, ground, obstacles/targets lists) but has its
 * own layout, palette and mood.
 *
 *   createScene('street')   — war-torn city street (default)
 *   createScene('factory')  — smoky industrial factory interior
 *   createScene('bunker')   — tight underground concrete bunker, dim lamps
 *
 * Maps start small and grow: extra zones are sealed off by point-buyable
 * barriers (CoD zombies style). `zones[i].gate` marks a locked zone; paying
 * the barrier removes it from the obstacle list and unlocks the zone so
 * enemies can spawn there too.
 *
 * Returns { scene, obstacles, targets, zones, barriers }.
 */

export const MAPS = [
  {
    id: 'street',
    name: 'Savaş Sokakları',
    desc: 'İki katlı yıkık cepheler, yanmış araçlar, telefon direkleri. Kuzey ve güney barikatlarını aç, sokağı genişlet.',
    swatch: 'linear-gradient(160deg, #8a8578 0%, #6e5a4a 55%, #4a463c 100%)',
  },
  {
    id: 'factory',
    name: 'Terk Edilmiş Fabrika',
    desc: 'Silolar, vinçler, makine bahçeleri. Doğu ve batı hangar kapıları puanla açılır.',
    swatch: 'linear-gradient(160deg, #5d4037 0%, #37474f 55%, #263238 100%)',
  },
  {
    id: 'bunker',
    name: 'Yeraltı Sığınağı',
    desc: 'Sunucu odaları, patlama kapıları, sarkan kablolar. Kuzey/güney kanatları barikat arkasında.',
    swatch: 'linear-gradient(160deg, #37474f 0%, #212121 60%, #000 100%)',
  },
];

/** Flickering bunker lamps, advanced by main.js each frame. */
export const flickerLights = [];

export function createScene(mapId = 'street') {
  const scene = new THREE.Scene();
  const obstacles = [];
  const targets = [];
  const zones = [];
  const barriers = [];
  // Reset the shared flicker-light registry for the new scene.
  flickerLights.length = 0;

  const ctx = {
    scene,
    obstacles,
    targets,
    zones,
    barriers,
    // Half-extent of the playable spawn area; maps with perimeter walls
    // override this so enemies never spawn outside them.
    arenaHalf: 45,
    /** Register a spawn zone. gate=true → locked until its barrier is bought. */
    addZone(id, rect, gate = false) {
      zones.push({ id, rect, gate });
    },
    /**
     * Seal a wall gap with a point-buyable barrier.
     * rect = bounds of the zone this barrier unlocks.
     */
    addGateBarrier({ x, z, width, rotY = 0, cost, zone, rect, style = 'wood' }) {
      const mesh = createBarrier(width, cost, style);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = rotY;
      scene.add(mesh);
      const along = Math.abs(Math.sin(rotY)) > 0.5; // width rotated onto Z axis
      const collider = ctx.addCollisionBox(
        x, 1.15, z,
        new THREE.Vector3(along ? 0.6 : width, 2.3, along ? width : 0.6)
      );
      barriers.push({ mesh, collider, cost, zone });
      ctx.addZone(zone, rect, true);
      return mesh;
    },
    addBox(w, h, d, x, y, z, mat, { collide = true, rotY = 0 } = {}) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      if (collide) {
        m.userData.collision = { size: new THREE.Vector3(w, h, d), isStatic: true };
        obstacles.push(m);
      }
      return m;
    },
    addCollisionBox(x, y, z, size, rotY = 0) {
      const col = new THREE.Object3D();
      col.position.set(x, y, z);
      col.rotation.y = rotY;
      col.userData.collision = { size, isStatic: true };
      scene.add(col);
      obstacles.push(col);
      return col;
    },
    addCrateRing(positions, size = 1.5) {
      for (const [x, , z] of positions) {
        const crate = createCrate(size);
        crate.position.set(x, size / 2, z);
        crate.rotation.y = Math.random() * Math.PI;
        scene.add(crate);
        obstacles.push(crate);
      }
    },
    addTargets(positions) {
      for (const [x, y, z] of positions) {
        const target = createTarget();
        target.position.set(x, y, z);
        scene.add(target);
        targets.push(target);
      }
    },
  };

  if (mapId === 'factory') buildFactory(ctx);
  else if (mapId === 'bunker') buildBunker(ctx);
  else buildStreet(ctx);

  // Capture the main lights so main.js can run a subtle day/night cycle.
  const lights = { ambient: null, hemi: null, sun: null };
  scene.traverse((o) => {
    if (o.isAmbientLight && !lights.ambient) lights.ambient = o;
    else if (o.isHemisphereLight && !lights.hemi) lights.hemi = o;
    else if (o.isDirectionalLight && !lights.sun) lights.sun = o;
  });

  return { scene, obstacles, targets, arenaHalf: ctx.arenaHalf, lights, zones, barriers };
}

// ── Shared atmosphere helpers ─────────────────────────────────────────

function addBaseLights(scene, { amb, hemiSky, hemiGround, sunColor, sunInt, fogColor, fogNear, fogFar }) {
  const ambient = new THREE.AmbientLight(amb, 0.7);
  ambient.layers.enable(1);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, 0.6);
  hemi.layers.enable(1);
  scene.add(hemi);

  if (sunColor) {
    const sun = new THREE.DirectionalLight(sunColor, sunInt);
    sun.layers.enable(1);
    sun.position.set(30, 50, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 36;
    sun.shadow.camera.bottom = -36;
    scene.add(sun);
    scene.add(sun.target);
  }

  const roomLight = new THREE.PointLight(0xffeecc, 0.6, 36, 2);
  roomLight.layers.enable(1);
  roomLight.position.set(0, 3, 0);
  scene.add(roomLight);

  if (fogColor != null) scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
}

function addGround(scene, color, size = 200) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

/** Add a burning barrel (mesh + fire + light + smoke) with collision. */
function addBurningBarrel(ctx, x, z) {
  const { scene, obstacles } = ctx;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.6 })
  );
  barrel.position.y = 0.45;
  barrel.castShadow = true;
  g.add(barrel);
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff4400, emissiveIntensity: 2.5 })
  );
  fire.position.y = 0.95;
  g.add(fire);
  const light = new THREE.PointLight(0xff6a00, 1.5, 10, 2);
  light.position.y = 1.1;
  g.add(light);
  for (let i = 0; i < 3; i++) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 + i * 0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.25 - i * 0.06, depthWrite: false })
    );
    smoke.position.y = 1.4 + i * 0.6;
    g.add(smoke);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.45, z, new THREE.Vector3(0.8, 0.9, 0.8));
}

/** Add a sandbag wall with collision. */
function addSandbagWall(ctx, x, z, count, rotY) {
  const { scene } = ctx;
  const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < count; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), sandbagMat);
      bag.position.set(i * 0.72 - (count * 0.72) / 2 + 0.36, 0.18 + row * 0.33, (row % 2) * 0.1 - 0.05);
      bag.rotation.y = (Math.random() - 0.5) * 0.15;
      bag.castShadow = true;
      bag.receiveShadow = true;
      g.add(bag);
    }
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.5, z, new THREE.Vector3(count * 0.72, 1.0, 0.8), rotY);
}

// ── Shared detail prefabs ─────────────────────────────────────────────

/**
 * Two-storey ruined building facade: a wall slab with dark window recesses,
 * a collapsed floor slab and broken masonry on top. Cheaper than full
 * buildings but reads as a real ruin from the street.
 */
function addFacade(ctx, x, z, w, h, rotY, mat) {
  const { scene } = ctx;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), mat);
  wall.position.y = h / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);

  const winMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4 });
  const litMat = new THREE.MeshStandardMaterial({ color: 0x3a2f1a, emissive: 0x8a6a30, emissiveIntensity: 0.35 });
  const cols = Math.max(2, Math.round(w / 2.2));
  for (let c = 0; c < cols; c++) {
    for (let f = 0; f < 2; f++) {
      if (Math.random() < 0.2) continue; // some holes just collapsed away
      const wx = -w / 2 + (c + 0.5) * (w / cols);
      const wy = h * 0.28 + f * h * 0.4;
      const win = new THREE.Mesh(
        new THREE.BoxGeometry((w / cols) * 0.55, h * 0.22, 0.1),
        Math.random() < 0.18 ? litMat : winMat
      );
      win.position.set(wx, wy, 0.32);
      g.add(win);
    }
  }

  // Exposed floor slab jutting out at mid height.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.25, 1.4), mat);
  slab.position.set(w * 0.08, h * 0.5, 0.5);
  slab.rotation.x = -0.08;
  slab.castShadow = true;
  g.add(slab);

  // Broken masonry crest.
  for (let i = 0; i < 4; i++) {
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 + Math.random() * 0.8, 0.4 + Math.random() * 0.5, 0.55),
      mat
    );
    chunk.position.set(-w / 2 + (i + 0.5) * (w / 4), h + 0.2, (Math.random() - 0.5) * 0.2);
    chunk.rotation.z = (Math.random() - 0.5) * 0.3;
    chunk.castShadow = true;
    g.add(chunk);
  }

  scene.add(g);
  ctx.addCollisionBox(x, h / 2, z, new THREE.Vector3(w, h, 0.8), rotY);
}

/** Burned-out car wreck: chassis, cabin, tilted wheels, popped boot. */
function addCarWreck(ctx, x, z, rotY, paint = 0x5a4a44) {
  const { scene } = ctx;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const paintMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.85, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.4), paintMat);
  chassis.position.y = 0.5;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  g.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 2.1), darkMat);
  cabin.position.set(0, 1.1, -0.3);
  cabin.rotation.z = 0.04; // sagging roof
  cabin.castShadow = true;
  g.add(cabin);

  const boot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.1), paintMat);
  boot.position.set(0.1, 0.95, 1.8);
  boot.rotation.z = 0.5; // blown-open boot lid
  boot.castShadow = true;
  g.add(boot);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  for (const [wx, wz, tilt] of [[-1.05, 1.4, 0], [1.05, 1.4, 0.5], [-1.05, -1.5, 0], [1.05, -1.5, 0]]) {
    if (!tilt && Math.random() < 0.25) continue; // a wheel blown off
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2 + tilt;
    wheel.position.set(wx, 0.42 - tilt * 0.3, wz);
    wheel.castShadow = true;
    g.add(wheel);
  }
  // Wheel gone: brick where it used to be.

  scene.add(g);
  ctx.addCollisionBox(x, 0.8, z, new THREE.Vector3(2.3, 1.6, 4.6), rotY);
}

/** Wooden post-and-plank fence (blocks movement). */
function addFence(ctx, x, z, len, rotY) {
  const { scene } = ctx;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const posts = Math.max(2, Math.round(len / 1.5) + 1);
  for (let i = 0; i < posts; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), woodMat);
    post.position.set(-len / 2 + i * (len / (posts - 1)), 0.7, 0);
    post.rotation.z = (Math.random() - 0.5) * 0.08;
    post.castShadow = true;
    g.add(post);
  }
  for (const rowY of [0.5, 1.05]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.06), woodMat);
    plank.position.y = rowY;
    plank.rotation.z = (Math.random() - 0.5) * 0.04;
    plank.castShadow = true;
    g.add(plank);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.7, z, new THREE.Vector3(len, 1.4, 0.15), rotY);
}

/** Bus-stop shack: three panels, a bench and a bent route sign. */
function addBusStop(ctx, x, z) {
  const { scene } = ctx;
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.5, metalness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fb4bd, transparent: true, opacity: 0.35, roughness: 0.2,
    userData: { isGlass: true },
  });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1.6), metal);
  roof.position.y = 2.35;
  roof.rotation.z = 0.04; // sagging
  roof.castShadow = true;
  g.add(roof);
  for (const [px, pz, pw, pd] of [[-1.45, 0, 0.12, 1.6], [1.45, -0.6, 0.12, 1], [0, -0.8, 2.9, 0.1]]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, 2.2, pd), pw < 0.2 ? metal : glassMat);
    panel.position.set(px, 1.15, pz);
    panel.castShadow = true;
    g.add(panel);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.9 }));
  bench.position.set(0, 0.55, -0.4);
  g.add(bench);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.08), metal);
  sign.position.set(1.9, 1.5, 0.7);
  sign.rotation.z = -0.12;
  g.add(sign);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x2a4a6a, emissive: 0x112233, emissiveIntensity: 0.4 })
  );
  plate.position.set(1.9, 2.85, 0.7);
  plate.rotation.z = -0.12;
  g.add(plate);
  scene.add(g);
  ctx.addCollisionBox(x, 1.2, z, new THREE.Vector3(3, 2.4, 1.7));
}

/** Collapsed market stall: awning on a lean, overturned crate goods. */
function addMarketStall(ctx, x, z, rotY) {
  const { scene } = ctx;
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), wood);
  counter.position.y = 0.45;
  counter.castShadow = true;
  counter.receiveShadow = true;
  g.add(counter);
  for (const sx of [-1.2, 1.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), wood);
    post.position.set(sx, 1.1, -0.45);
    post.rotation.z = sx * 0.08;
    g.add(post);
  }
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.08, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.95 })
  );
  awning.position.set(0, 2.1, -0.1);
  awning.rotation.x = 0.35;
  awning.rotation.z = 0.06;
  awning.castShadow = true;
  g.add(awning);
  // Canned goods + an overturned basket of produce.
  for (let i = 0; i < 5; i++) {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: [0x7a8a4a, 0x8a6a3a, 0x6a7a8a][i % 3], roughness: 0.6, metalness: 0.3 })
    );
    can.position.set(-1 + i * 0.45, 1.02, 0.15);
    g.add(can);
  }
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.28, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 1 })
  );
  basket.rotation.z = 1.5;
  basket.position.set(1.6, 0.25, 0.6);
  g.add(basket);
  for (let i = 0; i < 4; i++) {
    const apple = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x7a2a1a, roughness: 0.8 })
    );
    apple.position.set(1.9 + Math.random() * 0.8, 0.1, 0.5 + (Math.random() - 0.5) * 0.9);
    g.add(apple);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.6, z, new THREE.Vector3(2.8, 1.2, 1.3), rotY);
}

/** Derailed tram car lying askew across the yard — big walk-in cover. */
function addTramWreck(ctx, x, z, rotY) {
  const { scene } = ctx;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.85, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 9), bodyMat);
  body.position.y = 1.6;
  body.rotation.z = 0.28; // listing hard to one side
  body.rotation.x = -0.04;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 8.6), darkMat);
  roof.position.set(0.5, 2.95, 0);
  roof.rotation.z = 0.28;
  roof.castShadow = true;
  g.add(roof);
  const winMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 1.2), winMat);
      win.position.set(side * 1.32 + 0.14 * side, 1.9 + side * 0.1, -3.2 + i * 1.6);
      win.rotation.z = 0.28;
      g.add(win);
    }
  }
  // Bogies + a wheel that came loose.
  const bogie = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1.8), darkMat);
  bogie.position.set(0.2, 0.25, 3);
  g.add(bogie);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), darkMat);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(2.2, 0.45, -4);
  g.add(wheel);
  // Torn pantograph.
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), darkMat);
  arm.position.set(-0.2, 3.8, -2);
  arm.rotation.z = 0.6;
  g.add(arm);
  scene.add(g);
  ctx.addCollisionBox(x, 1.6, z, new THREE.Vector3(3.2, 3.2, 9.2), rotY);
}

/** Czech-hedgehog tank trap: three crossed steel beams. */
function addTankTrap(ctx, x, z) {
  const { scene } = ctx;
  const steel = new THREE.MeshStandardMaterial({ color: 0x37322e, roughness: 0.6, metalness: 0.6 });
  const g = new THREE.Group();
  g.position.set(x, 0.55, z);
  const beamGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.7, 8);
  const beams = [
    [0, 0, Math.PI / 2.4], [0, 0, -Math.PI / 2.4], [Math.PI / 2, 0, 0],
  ];
  for (const [rx, , rz] of beams) {
    const beam = new THREE.Mesh(beamGeo, steel);
    beam.rotation.set(rx, 0, rz);
    beam.castShadow = true;
    g.add(beam);
  }
  g.rotation.y = Math.random() * Math.PI;
  scene.add(g);
  ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(1.2, 1.1, 1.2));
}

/** Utility pole with cross-arm; addWires() strings cables between them. */
function addUtilityPole(ctx, x, z, broken = false) {
  const { scene } = ctx;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const h = broken ? 4.5 : 7;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, h, 8), woodMat);
  pole.position.y = h / 2;
  pole.rotation.z = broken ? 0.25 : 0;
  pole.castShadow = true;
  g.add(pole);
  if (!broken) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), woodMat);
    arm.position.y = h - 0.6;
    arm.castShadow = true;
    g.add(arm);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), woodMat);
    arm2.position.y = h - 1.3;
    g.add(arm2);
  }
  g.userData.top = new THREE.Vector3(x, h - 0.5, z);
  scene.add(g);
  ctx.addCollisionBox(x, h / 2, z, new THREE.Vector3(0.35, h, 0.35));
  return g;
}

/** Sagging catenary wires between successive pole tops. */
function addWires(scene, poles) {
  const mat = new THREE.LineBasicMaterial({ color: 0x111111 });
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i].userData.top;
    const b = poles[i + 1].userData.top;
    const pts = [];
    const segs = 10;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      pts.push(new THREE.Vector3(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.9,
        a.z + (b.z - a.z) * t
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    scene.add(new THREE.Line(geo, mat));
  }
}

/** Industrial silo: big rusted cylinder + cone cap + bands. */
function addSilo(ctx, x, z) {
  const { scene } = ctx;
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.9 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3d3630, roughness: 0.7, metalness: 0.5 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 7, 14), rustMat);
  body.position.y = 3.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.4, 14), bandMat);
  cap.position.y = 7.6;
  cap.castShadow = true;
  g.add(cap);
  for (const y of [1.6, 3.6, 5.6]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.07, 6, 18), bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    g.add(band);
  }
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.15), bandMat);
  hatch.position.set(0, 0.9, 2.1);
  g.add(hatch);
  scene.add(g);
  ctx.addCollisionBox(x, 3.5, z, new THREE.Vector3(4.2, 7, 4.2));
}

/** Horizontal pipe run with flanges; mount height y (no collision above 2 m). */
function addPipeRun(ctx, x, z, len, rotY, y, mat) {
  const { scene } = ctx;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 10), mat);
  pipe.rotation.z = Math.PI / 2;
  pipe.castShadow = true;
  g.add(pipe);
  const flangeGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10);
  const n = Math.max(2, Math.round(len / 6));
  for (let i = 0; i <= n; i++) {
    const fl = new THREE.Mesh(flangeGeo, mat);
    fl.rotation.z = Math.PI / 2;
    fl.position.x = -len / 2 + i * (len / n);
    g.add(fl);
  }
  // A drop pipe at one end into a small tank (only near the ground).
  if (y < 2.5) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, y, 8), mat);
    drop.position.set(len / 2 - 0.4, -y / 2, 0);
    g.add(drop);
  }
  scene.add(g);
}

/** Factory gantry: two posts + overhead beam + hoist trolley (visual only). */
function addGantry(ctx, x, z, span, rotY) {
  const { scene } = ctx;
  const steel = new THREE.MeshStandardMaterial({ color: 0x50433a, roughness: 0.6, metalness: 0.6 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), steel);
    post.position.set(sx * span / 2, 2.5, 0);
    post.castShadow = true;
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.4, 0.35, 0.4), steel);
  beam.position.y = 4.9;
  beam.castShadow = true;
  g.add(beam);
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.6), steel);
  trolley.position.set((Math.random() - 0.5) * span * 0.6, 4.6, 0);
  g.add(trolley);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), steel);
  hook.position.set(trolley.position.x, 3.8, 0);
  g.add(hook);
  scene.add(g);
}

/** Bunker server rack: dark cabinet with flickering status LEDs. */
function addServerRack(ctx, x, z, rotY) {
  const { scene } = ctx;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e2227, roughness: 0.6, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.7), bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  for (let r = 0; r < 7; r++) {
    const unit = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.2, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.8 })
    );
    unit.position.set(0, 0.35 + r * 0.24, 0.37);
    g.add(unit);
    const ledMat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.6 ? 0x33ff66 : 0xffaa22,
    });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), ledMat);
    led.position.set(0.36, 0.35 + r * 0.24, 0.41);
    g.add(led);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 1.05, z, new THREE.Vector3(1.2, 2.1, 0.8), rotY);
}

/** Bunker reactor: pulsing turbine core inside an open steel cage. */
function addReactor(ctx, x, z) {
  const { scene } = ctx;
  const steel = new THREE.MeshStandardMaterial({ color: 0x555b63, roughness: 0.4, metalness: 0.8 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 12), steel);
  base.position.y = 0.2;
  base.receiveShadow = true;
  g.add(base);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.15, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a2430, emissive: 0x2a9ad0, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 })
  );
  core.position.y = 1.6;
  core.castShadow = true;
  g.add(core);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.0, 0.35, 12), steel);
  cap.position.y = 2.95;
  g.add(cap);
  // Coil bands + cage posts.
  for (const cy of [1.1, 1.9, 2.6]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.06, 6, 16), steel);
    band.rotation.x = Math.PI / 2;
    band.position.y = cy;
    g.add(band);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), steel);
    post.position.set(Math.cos(a) * 1.7, 1.6, Math.sin(a) * 1.7);
    post.castShadow = true;
    g.add(post);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.07, 6, 20), steel);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3.2;
  g.add(ring);
  const glow = new THREE.PointLight(0x3ec0ff, 1.6, 12, 2);
  glow.position.y = 1.8;
  g.add(glow);
  scene.add(g);
  ctx.addCollisionBox(x, 1.6, z, new THREE.Vector3(3.4, 3.2, 3.4));
}

/** Half-open blast door: heavy steel leaf swung into the corridor. */
function addBlastDoor(ctx, x, z, rotY) {
  const { scene } = ctx;
  const steel = new THREE.MeshStandardMaterial({ color: 0x4f555e, roughness: 0.5, metalness: 0.75 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  // Frame jambs.
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4, 0.6), steel);
    jamb.position.set(sx * 1.6, 2, 0);
    jamb.castShadow = true;
    g.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 0.6), steel);
  lintel.position.y = 4.1;
  lintel.castShadow = true;
  g.add(lintel);
  // Warning-striped leaf, swung ~70 degrees open on one jamb.
  const leafGroup = new THREE.Group();
  leafGroup.position.set(-1.6, 0, 0);
  leafGroup.rotation.y = 1.2;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.8, 0.22), steel);
  leaf.position.set(1.5, 1.95, 0);
  leaf.castShadow = true;
  leafGroup.add(leaf);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd6a919, roughness: 0.8 });
  for (const sy of [0.8, 2.9]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.22, 0.24), stripeMat);
    stripe.position.set(1.5, sy, 0);
    leafGroup.add(stripe);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 14), steel);
  wheel.position.set(2.2, 1.9, 0.2);
  leafGroup.add(wheel);
  g.add(leafGroup);
  scene.add(g);
  // Collision for the open leaf (approximate AABB of the swung panel).
  const lx = -1.6 + 1.5 * Math.cos(1.2);
  const lz = -1.5 * Math.sin(1.2);
  ctx.addCollisionBox(
    x + lx * Math.cos(rotY) + lz * Math.sin(rotY),
    1.9,
    z - lx * Math.sin(rotY) + lz * Math.cos(rotY),
    new THREE.Vector3(1.6, 3.8, 1.6),
    0
  );
}

/** Field desk with radio set + antenna + glowing dials. */
function addRadioDesk(ctx, x, z, rotY) {
  const { scene } = ctx;
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3d2c, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.55, metalness: 0.6 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.75), wood);
  desk.position.y = 0.55;
  desk.castShadow = true;
  desk.receiveShadow = true;
  g.add(desk);
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.45), metal);
  radio.position.set(-0.3, 1.15, 0);
  radio.castShadow = true;
  g.add(radio);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 5), metal);
  antenna.position.set(-0.55, 1.85, 0);
  g.add(antenna);
  const dial = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x223322, emissive: 0x44ff66, emissiveIntensity: 0.8 })
  );
  dial.position.set(-0.15, 1.12, 0.24);
  g.add(dial);
  const papers = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.03, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 1 })
  );
  papers.position.set(0.45, 0.95, 0.05);
  papers.rotation.y = 0.4;
  g.add(papers);
  scene.add(g);
  ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(1.5, 1.1, 0.8), rotY);
}

/** Scattered rubble chips (decor only, no collision). */
function addDebris(scene, cx, cz, r, n, mats) {
  for (let i = 0; i < n; i++) {
    const s = 0.12 + Math.random() * 0.3;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s), mats[i % mats.length]);
    chunk.position.set(cx + (Math.random() - 0.5) * r * 2, s * 0.3, cz + (Math.random() - 0.5) * r * 2);
    chunk.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
    chunk.castShadow = true;
    scene.add(chunk);
  }
}

// ── MAP 1: war-torn street ────────────────────────────────────────────

function buildStreet(ctx) {
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

// ── MAP 2: abandoned factory ──────────────────────────────────────────

function buildFactory(ctx) {
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

// ── MAP 3: underground bunker ─────────────────────────────────────────

function buildBunker(ctx) {
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

/**
 * Savaş gökyüzü: kapalı, dumanlı, gri-bej; ufkta duman bulutları ve
 * duman filtreli soluk güneş. Prosedürel 6-yüz canvas CubeTexture.
 */
function createWarSkyCubeTexture() {
  const size = 256;
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#6a6a66');
    grad.addColorStop(0.55, '#8a8578');
    grad.addColorStop(1, '#a09a88');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    let seed = i * 1337 + 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let s = 0; s < 10; s++) {
      const x = rand() * size;
      const y = size * 0.35 + rand() * size * 0.5;
      const r = 18 + rand() * 30;
      const dark = rand() > 0.5;
      ctx.fillStyle = dark ? 'rgba(70, 65, 55, 0.25)' : 'rgba(160, 150, 130, 0.22)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (i === 0) {
      const mx = size * 0.7;
      const my = size * 0.35;
      const mr = 18;
      const glow = ctx.createRadialGradient(mx, my, 2, mx, my, mr * 3);
      glow.addColorStop(0, 'rgba(235, 225, 200, 0.55)');
      glow.addColorStop(0.4, 'rgba(220, 210, 185, 0.25)');
      glow.addColorStop(1, 'rgba(220, 210, 185, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240, 232, 210, 0.5)';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }

    faces.push(canvas);
  }

  const cubeTexture = new THREE.CubeTexture(faces);
  cubeTexture.needsUpdate = true;
  return cubeTexture;
}
