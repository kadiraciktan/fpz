import * as THREE from 'three';
import { buildModel } from './ModelLoader.js';
import { woodTexture } from '../textures/wood.js';
import { lampTexture } from '../textures/lamp.js';
import { streetLampModel } from '../models/streetlamp.js';

/**
 * Prefabs.js
 * Reusable object factories for the FPS game.
 * Each factory returns a new THREE.Object3D (usually a Group)
 * that can be cloned / placed anywhere in the scene.
 */

/**
 * A wooden crate. Used as a simple obstacle / cover.
 * @param {number} size - edge length of the cube
 * @returns {THREE.Group}
 */
export function createCrate(size = 1) {
  const half = size / 2;
  const crateModel = {
    elements: [
      {
        name: 'crate',
        from: [-half, -half, -half],
        to: [half, half, half],
      },
    ],
  };

  const group = buildModel(crateModel, woodTexture);

  // A thin darker wireframe frame to make it look like a crate
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(size * 1.01, size * 1.01, size * 1.01),
    new THREE.MeshStandardMaterial({
      color: 0x5a4527,
      roughness: 1.0,
      wireframe: true,
    })
  );
  group.add(frame);

  // Collision data (AABB) for the player controller
  group.userData.collision = {
    size: new THREE.Vector3(size, size, size),
    isStatic: true,
  };
  group.userData.type = 'crate';

  return group;
}

/**
 * A wall / block.
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @returns {THREE.Group}
 */
export function createWall(width = 4, height = 3, depth = 0.5) {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x7a7f87,
    roughness: 0.8,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  group.userData.collision = {
    size: new THREE.Vector3(width, height, depth),
    isStatic: true,
  };
  group.userData.type = 'wall';

  return group;
}

/**
 * A target that can be shot.
 * @returns {THREE.Group}
 */
export function createTarget() {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 })
  );
  base.position.y = 0.05;
  base.castShadow = true;
  group.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 })
  );
  pole.position.y = 0.5;
  group.add(pole);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xe53935,
      roughness: 0.4,
      emissive: 0x330000,
    })
  );
  head.position.y = 1.0;
  head.castShadow = true;
  group.add(head);

  group.userData.type = 'target';
  group.userData.health = 1;
  group.userData.isTarget = true;

  return group;
}

/**
 * A simple first-person gun model (attached to the camera).
 * @returns {THREE.Group}
 */
export function createGun() {
  const group = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({
    color: 0x2b2b2b,
    roughness: 0.4,
    metalness: 0.8,
  });
  const grip = new THREE.MeshStandardMaterial({
    color: 0x4a3520,
    roughness: 0.8,
    metalness: 0.1,
  });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), metal);
  body.position.set(0, 0, -0.2);
  group.add(body);

  // Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 12), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.55);
  group.add(barrel);

  // Grip
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.08), grip);
  gripMesh.position.set(0, -0.12, -0.05);
  gripMesh.rotation.x = 0.3;
  group.add(gripMesh);

  // Muzzle marker (used for tracer origin)
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.72);
  muzzle.name = 'muzzle';
  group.add(muzzle);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  group.userData.type = 'gun';
  group.userData.muzzle = muzzle;

  return group;
}

/**
 * A tracer / bullet visual (a thin stretched box).
 * @returns {THREE.Mesh}
 */
export function createBullet() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe082,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.6), mat);
  mesh.userData.type = 'bullet';
  return mesh;
}

/**
 * A small impact spark (used when a bullet hits something).
 * @returns {THREE.Group}
 */
export function createImpact() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc107,
    transparent: true,
    opacity: 1,
  });
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat);
  group.add(spark);
  group.userData.type = 'impact';
  return group;
}

/**
 * A street lamp with a warm point light.
 * @returns {THREE.Group}
 */
/**
 * @param {boolean} [withLight=true] - PointLight ekle (yalnızca yakın lambalar için)
 * @returns {THREE.Group}
 */
export function createStreetLamp(withLight = true) {
  const group = buildModel(streetLampModel, lampTexture);

  // Emissive bulb material override (mesh carries userData.partName after pivot restructure)
  group.traverse((o) => {
    if (o.isMesh && o.userData.partName === 'bulb') {
      o.material = new THREE.MeshStandardMaterial({
        color: 0xfff4c0,
        emissive: 0xffe082,
        emissiveIntensity: 2.0,
      });
    }
    if (o.isMesh) o.castShadow = true;
  });

  // Warm point light at bulb position (no shadow to keep light count low)
  if (withLight) {
    const light = new THREE.PointLight(0xffe082, 2.5, 14, 1.8);
    light.position.set(0.625, 3.09, 0);
    group.add(light);
  }

  // Işık havuzu: lamba altındaki zeminde sıcak yama (ışık "veriyor" hissi)
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffe082,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 8), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.625, 0.02, 0);
  group.add(pool);

  group.userData.type = 'streetLamp';
  group.userData.collision = {
    size: new THREE.Vector3(0.3, 3.3, 0.3),
    isStatic: true,
  };

  return group;
}
/**
 * A stackable sandbag wall segment (player-buildable cover).
 * Placed axis-aligned: the AABB collision assumes no rotation.
 * @returns {THREE.Group}
 */
export function createSandbag() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7d7154, roughness: 1.0 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x665c44, roughness: 1.0 });

  // Two rows of saggy bags (slightly squashed boxes, alternating tint).
  const rows = [
    { y: 0.11, count: 3, zoff: 0 },
    { y: 0.32, count: 2, zoff: 0 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.21, 0.5),
        i % 2 ? matDark : mat
      );
      bag.position.set((i - (row.count - 1) / 2) * 0.37, row.y, row.zoff);
      bag.rotation.z = (Math.random() - 0.5) * 0.08;
      bag.castShadow = true;
      bag.receiveShadow = true;
      group.add(bag);
    }
  }

  group.userData.type = 'sandbag';
  group.userData.collision = {
    size: new THREE.Vector3(1.12, 0.45, 0.52),
    isStatic: true,
  };

  return group;
}

/**
 * Perk vending machine (CoD zombies "perk-a-cola" style).
 * @param {string} label  - machine name painted on the header sign
 * @param {number} cost   - point cost shown on the sign
 * @param {number} color  - brand color (hex)
 * @returns {THREE.Group}
 */
export function createPerkMachine(label, cost, color = 0x2e7d32) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.7, metalness: 0.3 })
  );
  body.position.y = 0.8;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Glowing brand panel on the front face (+Z).
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.7, 0.06),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 })
  );
  panel.position.set(0, 1.15, 0.32);
  group.add(panel);

  // Dispenser knob + coin slot details.
  const knob = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.3, metalness: 0.8 })
  );
  knob.position.set(0.2, 0.6, 0.33);
  group.add(knob);

  // Glowing cap lamp.
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.12, 0.64),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 })
  );
  cap.position.y = 1.66;
  group.add(cap);

  // Header sign: canvas text sprite (name + cost).
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,12,10,0.85)';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 90);
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, 128, 42);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`${cost} PUAN`, 128, 80);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  sign.scale.set(1.6, 0.6, 1);
  sign.position.y = 2.15;
  group.add(sign);

  group.userData.type = 'perkMachine';
  // Kept for the sold-out visual state.
  group.userData.sign = sign;
  group.userData.lampMats = [panel.material, cap.material];
  group.userData.bodyMat = body.material;
  group.userData.collision = {
    size: new THREE.Vector3(0.72, 1.6, 0.62),
    isStatic: true,
  };

  return group;
}

/**
 * Point-buyable gate barrier (CoD zombies "open the door" style).
 * Blocks a wall gap until the player pays its cost. No collision on the
 * group itself — Scene.js registers a separate collision box so removing
 * the barrier is a single obstacle-list splice.
 * @param {number} width - barrier width along local X
 * @param {number} cost  - points shown on the sign
 * @param {string} style - 'wood' | 'metal' | 'steel'
 * @returns {THREE.Group}
 */
export function createBarrier(width = 5, cost = 500, style = 'wood') {
  const group = new THREE.Group();

  const plankMat = style === 'wood'
    ? new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.95 })
    : style === 'metal'
      ? new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.8, metalness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: 0x4f555e, roughness: 0.5, metalness: 0.75 });
  const postMat = style === 'wood'
    ? new THREE.MeshStandardMaterial({ color: 0x43341f, roughness: 0.95 })
    : plankMat;

  const posts = Math.max(2, Math.round(width / 1.6) + 1);
  for (let i = 0; i < posts; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.18), postMat);
    post.position.set(-width / 2 + i * (width / (posts - 1)), 1.15, 0);
    post.rotation.z = (Math.random() - 0.5) * 0.06;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }
  for (const rowY of [0.55, 1.15, 1.75]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, 0.1), plankMat);
    plank.position.set(0, rowY, 0.09 * (rowY === 1.15 ? -1 : 1));
    plank.rotation.z = (Math.random() - 0.5) * 0.04;
    plank.castShadow = true;
    group.add(plank);
  }
  // X cross-braces.
  const braceLen = Math.hypot(width * 0.85, 1.7);
  const braceAngle = Math.atan2(1.7, width * 0.85);
  for (const sign of [1, -1]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(braceLen, 0.2, 0.08), plankMat);
    brace.position.set(0, 1.15, 0.17 * sign);
    brace.rotation.z = braceAngle * sign;
    brace.castShadow = true;
    group.add(brace);
  }
  // Warning stripe along the crest.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.14, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xaa2222, emissive: 0x881111, emissiveIntensity: 0.7, roughness: 0.8 })
  );
  stripe.position.y = 2.2;
  group.add(stripe);

  // Glowing lock sign.
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,8,8,0.85)';
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#e53935';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 90);
  g.textAlign = 'center';
  g.font = 'bold 30px sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText('🔒 KILITLI', 128, 38);
  g.font = 'bold 28px sans-serif';
  g.fillStyle = '#ffd54f';
  g.fillText(`E · ${cost} PUAN`, 128, 78);
  const sign2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  sign2.scale.set(1.7, 0.64, 1);
  sign2.position.y = 2.85;
  group.add(sign2);

  group.userData.type = 'barrier';
  group.userData.cost = cost;
  return group;
}

/**
 * Canvas text sign sprite (two lines: title + amber subtitle).
 * Shared by wall guns, the Pack-a-Punch machine and their state updates.
 */
export function makeLabelSign(title, sub, colorHex = '#ffd54f', w = 256, h = 96) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,12,10,0.85)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, w / 2, h * 0.42);
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(sub, w / 2, h * 0.8);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
}

/** Repaint an existing label sign in place (used for SOLD / USED states). */
export function retintLabelSign(sign, title, sub, colorHex = '#9e9e9e') {
  if (!sign) return;
  const fresh = makeLabelSign(title, sub, colorHex);
  sign.material.map.dispose();
  sign.material.map = fresh.material.map;
  fresh.material.dispose();
  sign.material.needsUpdate = true;
}

/**
 * Wall weapon mount (CoD zombies "wall buy" style): a gun silhouette on a
 * wall bracket with a glowing price sign above it.
 * @param {string} label - weapon display name on the sign
 * @param {number} cost  - point cost shown on the sign
 * @returns {THREE.Group}
 */
export function createWallGun(label, cost) {
  const group = new THREE.Group();

  const steel = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.55, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.7, metalness: 0.4 });

  // Backboard + bracket.
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.08), dark);
  board.position.y = 1.25;
  board.castShadow = true;
  group.add(board);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.16), steel);
  rail.position.set(0, 1.12, 0.1);
  group.add(rail);

  // Stylised gun silhouette (receiver + barrel + stock + grip).
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 0.09), steel);
  gun.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), steel);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.42, 0.01, 0);
  gun.add(barrel);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.07), dark);
  stock.position.set(-0.36, -0.02, 0);
  stock.rotation.z = -0.12;
  gun.add(stock);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.06), dark);
  grip.position.set(-0.1, -0.13, 0);
  grip.rotation.z = 0.35;
  gun.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.05), dark);
  mag.position.set(0.06, -0.13, 0);
  gun.add(mag);
  gun.position.set(0, 1.25, 0.12);
  gun.rotation.z = 0.06;
  gun.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(gun);
  group.userData.gun = gun;

  // Glow strip under the rail — goes dark once bought.
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffb300, emissiveIntensity: 1.2 })
  );
  glow.position.set(0, 0.87, 0.12);
  group.add(glow);
  group.userData.glowMat = glow.material;

  const sign = makeLabelSign(label, `E · ${cost} PUAN`, '#ffd54f');
  sign.scale.set(1.7, 0.64, 1);
  sign.position.y = 1.95;
  group.add(sign);
  group.userData.sign = sign;

  group.userData.type = 'wallGun';
  return group;
}

/**
 * Pack-a-Punch machine: a hulking purple-rimmed upgrade station with a
 * Tesla-coil arch. E to pay, upgrades the ACTIVE weapon once per run.
 * @param {number} cost - points shown on the sign
 * @returns {THREE.Group}
 */
export function createPapMachine(cost) {
  const group = new THREE.Group();
  const purple = 0x9c27b0;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e2126, roughness: 0.6, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.9), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Angled top console with glowing readout.
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.7), bodyMat);
  console_.position.set(0, 1.65, 0.1);
  console_.rotation.x = -0.3;
  console_.castShadow = true;
  group.add(console_);
  const readout = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.18, 0.05),
    new THREE.MeshStandardMaterial({ color: purple, emissive: purple, emissiveIntensity: 1.1 })
  );
  readout.position.set(0, 1.68, 0.42);
  readout.rotation.x = -0.3;
  group.add(readout);

  // Energy arch (two coils + top ring) around the work platform.
  const coilMat = new THREE.MeshStandardMaterial({ color: purple, emissive: purple, emissiveIntensity: 0.8, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.3, 10), coilMat);
    coil.position.set(side * 0.95, 1.15, -0.15);
    coil.castShadow = true;
    group.add(coil);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), coilMat);
    cap.position.set(side * 0.95, 2.4, -0.15);
    group.add(cap);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 24, Math.PI), coilMat);
  ring.position.set(0, 2.4, -0.15);
  group.add(ring);

  // Front work tray where the gun goes in.
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5b5f66, roughness: 0.35, metalness: 0.8 })
  );
  tray.position.set(0, 0.95, 0.65);
  group.add(tray);

  const sign = makeLabelSign('PACK-A-PUNCH', `E · ${cost} PUAN`, '#ce93d8');
  sign.scale.set(2.0, 0.75, 1);
  sign.position.y = 3.1;
  group.add(sign);
  group.userData.sign = sign;
  group.userData.glowMats = [readout.material, coilMat];

  group.userData.type = 'papMachine';
  group.userData.collision = {
    size: new THREE.Vector3(1.8, 1.6, 1.0),
    isStatic: true,
  };
  return group;
}

/** Dim a perk machine after purchase (sold-out look). */
export function markMachineSold(mesh) {
  const sign = mesh.userData.sign;
  const lampMats = mesh.userData.lampMats;
  for (const m of lampMats) {
    m.emissiveIntensity = 0.05;
    m.color.setHex(0x3a3d40);
  }
  if (sign) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,12,10,0.85)';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 90);
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9e9e9e';
    ctx.fillText('SOLD', 128, 50);
    sign.material.map.dispose();
    sign.material.map = new THREE.CanvasTexture(c);
    sign.material.needsUpdate = true;
  }
}
