import * as THREE from 'three';

/**
 * maps/kit.js
 * Shared atmosphere + set-dressing helpers used by every map builder.
 */

/** Flickering lamps, advanced by main.js each frame. */
export const flickerLights = [];

// ── Shared atmosphere helpers ─────────────────────────────────────────

export function addBaseLights(scene, { amb, hemiSky, hemiGround, sunColor, sunInt, fogColor, fogNear, fogFar }) {
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

export function addGround(scene, color, size = 200) {
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
export function addBurningBarrel(ctx, x, z) {
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
export function addSandbagWall(ctx, x, z, count, rotY) {
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
export function addFacade(ctx, x, z, w, h, rotY, mat) {
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
export function addCarWreck(ctx, x, z, rotY, paint = 0x5a4a44) {
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
export function addFence(ctx, x, z, len, rotY) {
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
export function addBusStop(ctx, x, z) {
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
export function addMarketStall(ctx, x, z, rotY) {
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
export function addTramWreck(ctx, x, z, rotY) {
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
export function addTankTrap(ctx, x, z) {
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
export function addUtilityPole(ctx, x, z, broken = false) {
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
export function addWires(scene, poles) {
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
export function addSilo(ctx, x, z) {
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
export function addPipeRun(ctx, x, z, len, rotY, y, mat) {
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
export function addGantry(ctx, x, z, span, rotY) {
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
export function addServerRack(ctx, x, z, rotY) {
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
export function addReactor(ctx, x, z) {
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
export function addBlastDoor(ctx, x, z, rotY) {
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
export function addRadioDesk(ctx, x, z, rotY) {
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

/**
 * A wall that runs along X (constant z) or Z (constant x) with cut-out
 * gaps for windows / doors. Gaps: [{ at, width }].
 */
export function addGappedWall(ctx, { axis, pos, from, to, y, h, thick, gaps, mat }) {
  const cuts = [...(gaps || [])].sort((a, b) => a.at - b.at);
  let cursor = from;
  const place = (a, b) => {
    const len = b - a;
    if (len < 0.2) return;
    const mid = (a + b) / 2;
    if (axis === 'x') ctx.addBox(len, h, thick, mid, y, pos, mat);
    else ctx.addBox(thick, h, len, pos, y, mid, mat);
  };
  for (const g of cuts) {
    place(cursor, g.at - g.width / 2);
    cursor = Math.max(cursor, g.at + g.width / 2);
  }
  place(cursor, to);
}

/** Decorative window boards in a gap — no collision, zombies walk through. */
export function addWindowBoards(ctx, x, z, rotY, width = 2.2) {
  const { scene } = ctx;
  const wood = new THREE.MeshStandardMaterial({ color: 0x3d3224, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.16, 0.07), wood);
    plank.position.set(0, 0.55 + i * 0.48, 0.04 * (i % 2 ? 1 : -1));
    plank.rotation.z = (i - 1.5) * 0.08;
    plank.castShadow = true;
    g.add(plank);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.07), wood);
  cross.position.set(width * 0.18, 1.2, 0.06);
  cross.rotation.z = 0.35;
  g.add(cross);
  scene.add(g);
}

/** Bare hanging bulb (Nacht's sickly yellow interior light). */
export function addHangingBulb(ctx, x, z, { flicker = false, y = 3.7 } = {}) {
  const { scene } = ctx;
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x1a1a16, roughness: 0.8 })
  );
  cord.position.set(x, y + 0.35, z);
  scene.add(cord);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c0, emissive: 0xffe082, emissiveIntensity: flicker ? 1.4 : 2.2,
    })
  );
  bulb.position.set(x, y, z);
  scene.add(bulb);
  const pl = new THREE.PointLight(0xffe2a0, flicker ? 10 : 16, 14, 2);
  pl.position.set(x, y - 0.15, z);
  if (flicker) {
    pl.userData.flickerSeed = Math.random() * 100;
    flickerLights.push(pl);
  }
  scene.add(pl);
}

/** Crashed Luftwaffe wreck on the airfield (decor + collision). */
export function addWreckedPlane(ctx, x, z, rotY) {
  const { scene } = ctx;
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5244, roughness: 0.7, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e28, roughness: 0.85, metalness: 0.3 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 8.5), metal);
  fuse.position.set(0, 1.1, 0);
  fuse.rotation.z = 0.12;
  fuse.castShadow = true;
  g.add(fuse);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 1.8), metal);
  wing.position.set(0.4, 1.15, -0.6);
  wing.rotation.z = -0.08;
  wing.castShadow = true;
  g.add(wing);
  const stub = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.2), dark);
  stub.position.set(-2.8, 0.35, 1.4);
  stub.rotation.set(0.4, 0.3, 0.8);
  g.add(stub);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 1.4), metal);
  tail.position.set(0.2, 2.1, 3.8);
  tail.rotation.x = 0.15;
  g.add(tail);
  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1.8, 6),
    dark
  );
  nose.rotation.z = Math.PI / 2;
  nose.position.set(0, 1.2, -4.4);
  g.add(nose);
  scene.add(g);
  ctx.addCollisionBox(x, 1.0, z, new THREE.Vector3(2.6, 2.0, 8.8), rotY);
}

/** Stencil graffiti on an interior wall (HELP / HILFE). */
export function addWallStencil(ctx, x, y, z, rotY, text, color = '#c4b48a') {
  const { scene } = ctx;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 96);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 52px sans-serif';
  g.fillStyle = color;
  g.globalAlpha = 0.7;
  g.fillText(text, 128, 48);
  const spr = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
  );
  spr.position.set(x, y, z);
  spr.rotation.y = rotY;
  scene.add(spr);
}

/** Scattered rubble chips (decor only, no collision). */
export function addDebris(scene, cx, cz, r, n, mats) {
  for (let i = 0; i < n; i++) {
    const s = 0.12 + Math.random() * 0.3;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s), mats[i % mats.length]);
    chunk.position.set(cx + (Math.random() - 0.5) * r * 2, s * 0.3, cz + (Math.random() - 0.5) * r * 2);
    chunk.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
    chunk.castShadow = true;
    scene.add(chunk);
  }
}


/**
 * Savaş gökyüzü: kapalı, dumanlı, gri-bej; ufkta duman bulutları ve
 * duman filtreli soluk güneş. Prosedürel 6-yüz canvas CubeTexture.
 */
export function createWarSkyCubeTexture() {
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

