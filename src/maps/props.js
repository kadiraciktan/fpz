import * as THREE from 'three';
import { flickerLights } from './kit.js';

/**
 * maps/props.js
 * Second-wave environment prefabs: heavier set-dressing pieces that were
 * not part of the original kit. Same ctx conventions as kit.js — every
 * ground-level prop registers an OBB via ctx.addCollisionBox(x, y, z, size, rotY)
 * so collision, merge and light-extraction passes keep working untouched.
 */

// ── Shared material palettes (merge pass groups by material identity) ──

const mat = {
  concrete: () => new THREE.MeshStandardMaterial({ color: 0x5a5850, roughness: 0.95 }),
  concreteDark: () => new THREE.MeshStandardMaterial({ color: 0x45433c, roughness: 0.96 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.9 }),
  woodDark: () => new THREE.MeshStandardMaterial({ color: 0x3d3224, roughness: 0.92 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x50433a, roughness: 0.6, metalness: 0.6 }),
  metal: () => new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.5, metalness: 0.7 }),
  rust: () => new THREE.MeshStandardMaterial({ color: 0x6e4a2f, roughness: 0.9 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 }),
};

/**
 * Jersey barriers: a row of precast concrete blocks with faded warning
 * stripes. Chest-high hard cover that funnels hordes into lanes.
 */
export function addJerseyRow(ctx, x, z, count, rotY = 0) {
  const { scene } = ctx;
  const cMat = mat.concrete();
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xb8b090, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const L = count * 1.9;
  for (let i = 0; i < count; i++) {
    const cx = -L / 2 + i * 1.9 + 0.95;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.6), cMat);
    block.position.set(cx, 0.45, 0);
    block.rotation.z = (Math.random() - 0.5) * 0.02;
    block.castShadow = true;
    block.receiveShadow = true;
    g.add(block);
    // Sloped shoulder top.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.35), cMat);
    cap.position.set(cx, 0.98, 0);
    cap.castShadow = true;
    g.add(cap);
    // Faded stripe panel on the face.
    if (i % 2 === 0) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.06), stripeMat);
      stripe.position.set(cx, 0.55, 0.32);
      g.add(stripe);
    }
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(L, 1.1, 0.8), rotY);
}

/**
 * Barbed-wire fence: steel posts, three wire runs + a sagging strand.
 * Full-height blocker — the wire itself is Line geometry (never merged),
 * posts carry the collision box.
 */
export function addBarbedFence(ctx, x, z, len, rotY = 0) {
  const { scene } = ctx;
  const sMat = mat.metal();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const posts = Math.max(2, Math.round(len / 2.2) + 1);
  for (let i = 0; i < posts; i++) {
    const px = -len / 2 + i * (len / (posts - 1));
    const lean = (Math.random() - 0.5) * 0.06;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), sMat);
    post.position.set(px, 0.95, 0);
    post.rotation.z = lean;
    post.castShadow = true;
    g.add(post);
    // Y-branch head on the outer posts.
    if (i === 0 || i === posts - 1) {
      const branch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), sMat);
      branch.position.set(px + lean * 4, 2.05, 0);
      branch.rotation.z = -lean * 6;
      g.add(branch);
    }
  }
  // Wire runs as lines (decor; the box below is the blocker).
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a18 });
  for (const wy of [0.6, 1.1, 1.6]) {
    const sag = wy === 1.1 ? 0.14 : 0.06;
    const pts = [];
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      pts.push(new THREE.Vector3(-len / 2 + t * len, wy - Math.sin(t * Math.PI) * sag, 0));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }
  scene.add(g);
  ctx.addCollisionBox(x, 1.0, z, new THREE.Vector3(len, 2.0, 0.2), rotY);
}

/** Wooden crates on a fallen pallet — waist-to-shoulder corner cover. */
export function addCrateStack(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const wMat = mat.wood();
  const wDark = mat.woodDark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.2), wDark);
  base.position.set(0, 0.06, 0);
  g.add(base);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.0), wMat);
  c1.position.set(-0.15, 0.52, 0);
  c1.rotation.y = 0.08;
  c1.castShadow = true;
  c1.receiveShadow = true;
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.8), wDark);
  c2.position.set(0.35, 1.2, 0.1);
  c2.rotation.y = -0.35;
  c2.rotation.z = 0.05;
  c2.castShadow = true;
  g.add(c2);
  const c3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.6), wMat);
  c3.position.set(-0.4, 1.18, 0.35);
  c3.rotation.y = 0.5;
  c3.castShadow = true;
  g.add(c3);
  // Batten slats nailed on the big crate.
  for (const sy of [0.35, 0.7]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.05), wDark);
    slat.position.set(-0.15, sy, 0.52);
    g.add(slat);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.6, z, new THREE.Vector3(1.6, 1.2, 1.3), rotY);
}

/** Green dumpster with an open lid and spilled trash — street corner smell, visually. */
export function addDumpster(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 0.8, metalness: 0.3 });
  const dark = mat.dark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 1.3), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.1, 1.35), bodyMat);
  lid.position.set(0, 1.45, 0.15);
  lid.rotation.x = -0.55; // propped half-open
  lid.castShadow = true;
  g.add(lid);
  const ribGeo = new THREE.BoxGeometry(0.12, 1.1, 0.06);
  for (const rx of [-0.7, 0, 0.7]) {
    const rib = new THREE.Mesh(ribGeo, dark);
    rib.position.set(rx, 0.65, 0.66);
    g.add(rib);
  }
  // Spilled trash: papers and a couple of cans tumbling out.
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xa8a090, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.24), paperMat);
    paper.position.set(1.4 + Math.random() * 0.8, 0.02, (Math.random() - 0.5) * 1.4);
    paper.rotation.y = Math.random() * Math.PI;
    g.add(paper);
  }
  for (let i = 0; i < 2; i++) {
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 7), mat.metal());
    tin.position.set(1.5 + Math.random() * 0.6, 0.09, (Math.random() - 0.5) * 1.2);
    tin.rotation.z = 1.4;
    g.add(tin);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.7, z, new THREE.Vector3(2.6, 1.4, 1.5), rotY);
}

/** Water tower: riveted tank on four splayed legs with a ladder. */
export function addWaterTower(ctx, x, z) {
  const { scene } = ctx;
  const rust = mat.rust();
  const steel = mat.steel();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3, 14), rust);
  tank.position.y = 9;
  tank.castShadow = true;
  g.add(tank);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.5, 14), steel);
  cap.position.y = 11.2;
  cap.castShadow = true;
  g.add(cap);
  for (const bandY of [8.2, 9.8]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.48, 0.08, 6, 18), steel);
    band.rotation.x = Math.PI / 2;
    band.position.y = bandY;
    g.add(band);
  }
  // Four splayed legs + cross braces.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8, 0.25), steel);
    leg.position.set(Math.cos(a) * 1.9, 4, Math.sin(a) * 1.9);
    leg.rotation.z = -Math.cos(a) * 0.16;
    leg.rotation.x = Math.sin(a) * 0.16;
    leg.castShadow = true;
    g.add(leg);
  }
  const brace = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.07, 5, 4), steel);
  brace.rotation.x = Math.PI / 2;
  brace.rotation.z = Math.PI / 4;
  brace.position.y = 4.5;
  g.add(brace);
  // Ladder up one leg.
  for (let r = 0; r < 12; r++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), steel);
    rung.position.set(2.25, 0.6 + r * 0.6, 0);
    g.add(rung);
  }
  scene.add(g);
  // Legs are thin — collide the tank footprint ring, walk under the tower.
  ctx.addCollisionBox(x, 4, z, new THREE.Vector3(4.6, 8, 4.6));
}

/** Watchtower: wooden platform on four posts, stairs and a lean-to roof. */
export function addWatchtower(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const wood = mat.wood();
  const woodDark = mat.woodDark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 4.6, 0.28), wood);
    post.position.set(px, 2.3, pz);
    post.rotation.z = (Math.random() - 0.5) * 0.04;
    post.castShadow = true;
    g.add(post);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 3.6), woodDark);
  deck.position.y = 4.5;
  deck.castShadow = true;
  g.add(deck);
  // Sandbag parapet on the deck edge.
  const sbMat = new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.3), sbMat);
    bag.position.set(Math.cos(a) * 1.5, 4.72, Math.sin(a) * 1.5);
    bag.rotation.y = a;
    bag.castShadow = true;
    g.add(bag);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 4), woodDark);
  roof.position.y = 6.2;
  roof.rotation.z = 0.05;
  roof.castShadow = true;
  g.add(roof);
  for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), wood);
    mullion.position.set(px, 5.3, pz);
    g.add(mullion);
  }
  // Stairs up the +z face.
  for (let i = 0; i < 9; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.4), wood);
    step.position.set(0, 0.3 + i * 0.5, 2.2 + (8 - i) * 0.34);
    step.castShadow = true;
    g.add(step);
  }
  scene.add(g);
  // Collide the deck footprint only; the stair run is thin decoration.
  ctx.addCollisionBox(x, 2.3, z, new THREE.Vector3(3.4, 4.6, 3.4), rotY);
}

/** Factory conveyor line: legs, belt, rollers and a few cargo stubs. */
export function addConveyorLine(ctx, x, z, len, rotY = 0) {
  const { scene } = ctx;
  const steel = mat.steel();
  const dark = mat.dark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const legs = Math.max(2, Math.round(len / 4));
  for (let i = 0; i <= legs; i++) {
    const lx = -len / 2 + i * (len / legs);
    for (const sx of [-0.55, 0.55]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), steel);
      leg.position.set(lx, 0.47, sx);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 1.4), steel);
  frame.position.y = 0.95;
  frame.castShadow = true;
  g.add(frame);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(len - 0.2, 0.1, 1.1), dark);
  belt.position.y = 1.06;
  g.add(belt);
  const rollerGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.2, 8);
  for (let i = 0; i <= legs * 2; i++) {
    const roller = new THREE.Mesh(rollerGeo, steel);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(-len / 2 + 0.3 + i * ((len - 0.6) / (legs * 2)), 1.02, 0);
    g.add(roller);
  }
  // Half-transit cargo boxes riding the belt.
  const boxMat = mat.wood();
  for (let i = 0; i < 3; i++) {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), i % 2 ? boxMat : mat.woodDark());
    cargo.position.set(-len / 4 + i * (len / 5), 1.4, (Math.random() - 0.5) * 0.3);
    cargo.rotation.y = Math.random() * 0.4;
    cargo.castShadow = true;
    g.add(cargo);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.6, z, new THREE.Vector3(len, 1.15, 1.5), rotY);
}

/** Foundry furnace: brick dome, glowing mouth, chimney and ember light. */
export function addFurnace(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.95 });
  const steel = mat.steel();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 2.6), brickMat);
  base.position.y = 0.55;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), brickMat);
  dome.position.y = 1.1;
  dome.scale.set(1.05, 0.85, 0.85);
  dome.castShadow = true;
  g.add(dome);
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.8, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x4a1408, emissive: 0xff5a10, emissiveIntensity: 1.8 })
  );
  mouth.position.set(0, 0.85, 1.32);
  g.add(mouth);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 3.2, 10), steel);
  chimney.position.set(-1.1, 3.4, -0.6);
  chimney.rotation.z = 0.06;
  chimney.castShadow = true;
  g.add(chimney);
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x555550, transparent: true, opacity: 0.18, depthWrite: false })
  );
  smoke.position.set(-1.2, 5.3, -0.6);
  g.add(smoke);
  const glow = new THREE.PointLight(0xff6a20, 1.4, 10, 2);
  glow.position.set(0, 1.0, 2.0);
  g.add(glow);
  // Slag spill in front of the mouth (low trip-cover).
  const slagMat = new THREE.MeshStandardMaterial({ color: 0x26221e, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const s = 0.3 + Math.random() * 0.4;
    const slag = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.4, s), slagMat);
    slag.position.set((Math.random() - 0.5) * 1.6, s * 0.2, 1.9 + Math.random() * 1.2);
    slag.rotation.y = Math.random() * Math.PI;
    g.add(slag);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 1.1, z, new THREE.Vector3(3.4, 2.4, 2.8), rotY);
}

/** Locker row: dented steel lockers, a couple hanging open. */
export function addLockerRow(ctx, x, z, count, rotY = 0) {
  const { scene } = ctx;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3e4a4e, roughness: 0.55, metalness: 0.6 });
  const dark = mat.dark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const L = count * 0.6;
  for (let i = 0; i < count; i++) {
    const lx = -L / 2 + i * 0.6 + 0.3;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 2, 0.55), bodyMat);
    body.position.set(lx, 1, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // Vent slits.
    for (let v = 0; v < 3; v++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.03), dark);
      vent.position.set(lx, 1.6 - v * 0.1, 0.28);
      g.add(vent);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.05), dark);
    handle.position.set(lx + 0.18, 1.05, 0.29);
    g.add(handle);
    // One in five hangs open showing dark inside + a hanging coat.
    if (i % 5 === 2) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.56, 2, 0.05), bodyMat);
      door.position.set(lx - 0.42, 1, -0.18);
      door.rotation.y = 1.15;
      door.castShadow = true;
      g.add(door);
      const coat = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.9, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 })
      );
      coat.position.set(lx, 1.35, 0.05);
      g.add(coat);
    }
  }
  scene.add(g);
  ctx.addCollisionBox(x, 1, z, new THREE.Vector3(L, 2, 0.7), rotY);
}

/** Coolant pump unit: motor block, flywheel, riser pipe with a gauge. */
export function addPumpUnit(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const steel = mat.steel();
  const rust = mat.rust();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 1.4), mat.concreteDark());
  plinth.position.y = 0.17;
  plinth.receiveShadow = true;
  g.add(plinth);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), steel);
  motor.position.set(-0.4, 0.85, 0);
  motor.castShadow = true;
  g.add(motor);
  const flywheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 6, 14), rust);
  flywheel.position.set(0.45, 0.95, 0);
  flywheel.castShadow = true;
  g.add(flywheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8), steel);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0.45, 0.95, 0);
  g.add(hub);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 10), rust);
  riser.position.set(-0.4, 2.6, 0);
  riser.castShadow = true;
  g.add(riser);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), rust);
  elbow.position.set(-0.4, 3.9, 0);
  g.add(elbow);
  // Pressure gauge with a faint glow so dark corridors read the machinery.
  const gauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a2020, emissive: 0x33ff88, emissiveIntensity: 0.5 })
  );
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(-0.4, 1.5, 0.2);
  g.add(gauge);
  scene.add(g);
  ctx.addCollisionBox(x, 0.8, z, new THREE.Vector3(2.1, 1.4, 1.5), rotY);
}

/** Cinder-block wall: stacked hollow blocks, knee-to-waist improvised cover. */
export function addCinderCover(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const blockMat = mat.concreteDark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  for (let row = 0; row < 3; row++) {
    const offset = row % 2 ? 0.22 : 0;
    const n = 3 - row; // stepped pyramid, sniper-proof silhouette
    for (let i = 0; i < n; i++) {
      const bx = -0.7 + i * 0.46 + offset * 0.5;
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.85), blockMat);
      block.position.set(bx, 0.11 + row * 0.23, 0);
      block.rotation.y = (Math.random() - 0.5) * 0.06;
      block.castShadow = true;
      block.receiveShadow = true;
      g.add(block);
    }
  }
  // Rebar sticking out of the top block.
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), mat.dark());
  rod.position.set(0, 0.9, 0.1);
  rod.rotation.z = 0.15;
  g.add(rod);
  scene.add(g);
  ctx.addCollisionBox(x, 0.35, z, new THREE.Vector3(1.6, 0.7, 0.95), rotY);
}

/** Row of cemetery headstones with a toppled cross — manor garden dressing. */
export function addTombstoneRow(ctx, x, z, count, rotY = 0) {
  const { scene } = ctx;
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x565a5c, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const L = count * 1.6;
  for (let i = 0; i < count; i++) {
    const sx = -L / 2 + i * 1.6 + 0.8;
    const toppled = i % 4 === 1;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 1.1, 0.18),
      stoneMat
    );
    stone.position.set(sx, toppled ? 0.12 : 0.55, 0);
    stone.rotation.set(0, (Math.random() - 0.5) * 0.4, toppled ? 1.45 : (Math.random() - 0.5) * 0.1);
    stone.castShadow = true;
    g.add(stone);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.5), stoneMat);
    foot.position.set(sx, 0.09, 0);
    g.add(foot);
    // Round the top of the upright ones.
    if (!toppled) {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 10, 1, false, 0, Math.PI), stoneMat);
      crown.rotation.set(Math.PI / 2, 0, 0);
      crown.position.set(sx, 1.1, 0);
      g.add(crown);
    }
  }
  // One bent iron cross at the far end.
  const iron = mat.dark();
  const cross = new THREE.Group();
  const vert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), iron);
  vert.position.y = 0.65;
  const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), iron);
  horiz.position.y = 0.95;
  cross.add(vert, horiz);
  cross.position.set(L / 2 - 0.4, 0, 0.2);
  cross.rotation.z = 0.28;
  g.add(cross);
  scene.add(g);
  // Headstones are ankle-height decoration; the row still reads as cover.
  ctx.addCollisionBox(x, 0.55, z, new THREE.Vector3(L, 1.1, 0.5), rotY);
}

/** Trimmed hedge bushes: mossy green blobs for garden borders and courtyards. */
export function addBushCluster(ctx, x, z, r = 1.2, n = 3) {
  const { scene } = ctx;
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2a3d22, roughness: 1 });
  for (let i = 0; i < n; i++) {
    const s = 0.5 + Math.random() * 0.5;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), hedgeMat);
    bush.position.set(x + (Math.random() - 0.5) * r * 2, s * 0.6, z + (Math.random() - 0.5) * r * 2);
    bush.scale.y = 0.7;
    bush.castShadow = true;
    scene.add(bush);
  }
  ctx.addCollisionBox(x, 0.4, z, new THREE.Vector3(r * 2 + 1, 0.8, r * 2 + 1));
}

/** Bent road sign on a pole: arrow plate knocked sideways, still readable. */
export function addRoadSign(ctx, x, z, rotY = 0, plateColor = 0x7a4a1f) {
  const { scene } = ctx;
  const steel = mat.metal();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), steel);
  pole.position.y = 1.6;
  pole.rotation.z = 0.12;
  pole.castShadow = true;
  g.add(pole);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.6, 0.05),
    new THREE.MeshStandardMaterial({ color: plateColor, roughness: 0.7 })
  );
  plate.position.set(0.15, 2.9, 0.04);
  plate.rotation.z = -0.24;
  plate.castShadow = true;
  g.add(plate);
  const arrow = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.8 })
  );
  arrow.position.set(0.05, 2.9, 0.08);
  arrow.rotation.z = -0.24;
  g.add(arrow);
  scene.add(g);
  ctx.addCollisionBox(x, 1.6, z, new THREE.Vector3(0.25, 3.2, 0.25));
}

/** Pipe rack: elevated double pipe on A-frame trestles (factory runs). */
export function addPipeRack(ctx, x, z, len, rotY = 0, y = 2.2) {
  const { scene } = ctx;
  const steel = mat.steel();
  const rust = mat.rust();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const trestles = Math.max(2, Math.round(len / 6));
  for (let i = 0; i <= trestles; i++) {
    const tx = -len / 2 + i * (len / trestles);
    for (const sx of [-0.5, 0.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, y, 0.12), steel);
      leg.position.set(tx, y / 2, sx);
      leg.castShadow = true;
      g.add(leg);
    }
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 1.3), steel);
    saddle.position.set(tx, y, 0);
    g.add(saddle);
  }
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 10), rust);
  p1.rotation.z = Math.PI / 2;
  p1.position.set(0, y + 0.22, -0.28);
  p1.castShadow = true;
  g.add(p1);
  const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 10), steel);
  p2.rotation.z = Math.PI / 2;
  p2.position.set(0, y + 0.2, 0.28);
  p2.castShadow = true;
  g.add(p2);
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), rust);
  valve.position.set(len * 0.2, y + 0.5, -0.28);
  g.add(valve);
  scene.add(g);
  // Trestles only: player and horde walk under the pipes.
  for (let i = 0; i <= trestles; i++) {
    const tx = -len / 2 + i * (len / trestles);
    const wx = x + tx * Math.cos(rotY);
    const wz = z - tx * Math.sin(rotY);
    ctx.addCollisionBox(wx, y / 2, wz, new THREE.Vector3(0.3, y, 1.3), rotY);
  }
}

/** Makeshift field tent: canvas ridge with a rolled-open flap. */
export function addFieldTent(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0x5a5f46, roughness: 0.95 });
  const wood = mat.wood();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.7, 2.6), canvasMat);
  body.position.y = 0.85;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.14, 0.14), wood);
  ridge.position.y = 1.78;
  g.add(ridge);
  // Sloped front panel (the half that fell open).
  const flap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 2.4), canvasMat);
  flap.position.set(1.35, 1.2, 0);
  flap.rotation.z = 0.9;
  g.add(flap);
  // Supply crates + a stretcher bed inside sight.
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), wood);
  crate.position.set(-1.2, 0.25, 1.6);
  crate.castShadow = true;
  g.add(crate);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x8a8a72, roughness: 1 }));
  bed.position.set(0.2, 0.45, -1.7);
  bed.rotation.y = 0.15;
  g.add(bed);
  for (const lx of [-0.7, 1.1]) {
    const bLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), mat.metal());
    bLeg.position.set(lx, 0.2, -1.7 + (lx < 0 ? -0.3 : 0.3));
    g.add(bLeg);
  }
  scene.add(g);
  ctx.addCollisionBox(x, 0.85, z, new THREE.Vector3(3.6, 1.7, 2.6), rotY);
}

// ── Third wave: landmark-grade dressing ────────────────────────────────

/**
 * Bomb crater: scorched disc + a churned dirt lip + rim chunks that read
 * as walkable ground with ankle-to-knee cover on the edges.
 */
export function addCrater(ctx, x, z, r = 2.2) {
  const { scene } = ctx;
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x3a342a, roughness: 1 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(r, 18), dirtMat);
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.035; // rides above ground/road planes
  g.add(scorch);
  // Churned lip: a flattened torus heaped around the rim.
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.34, 6, 22), dirtMat);
  lip.rotation.x = Math.PI / 2;
  lip.scale.y = 0.55;
  lip.position.y = 0.12;
  g.add(lip);
  // Rim chunks thrown out of the hole — the only collision.
  const chunkMat = mat.concreteDark();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
    const d = r + 0.25 + Math.random() * 0.3;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const s = 0.55 + Math.random() * 0.4;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.55, s * 0.8), i % 2 ? chunkMat : dirtMat);
    chunk.position.set(cx, s * 0.24, cz);
    chunk.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
    chunk.castShadow = true;
    g.add(chunk);
    ctx.addCollisionBox(x + cx, s * 0.27, z + cz, new THREE.Vector3(s + 0.3, 0.5, s + 0.3));
  }
  scene.add(g);
}

/**
 * Jackknifed tram car across the street: solid walls and two ends, but
 * the near side is torn open — a walk-through husk, not a wall.
 */
export function addTramWreck(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const paint = new THREE.MeshStandardMaterial({ color: 0x4f5a4a, roughness: 0.75, metalness: 0.3 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xb8a878, roughness: 0.8 });
  const dark = mat.dark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const L = 10;
  // Sunken floor plate (walk-in level, no collision).
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 2.6), dark);
  floor.position.y = 0.28;
  g.add(floor);
  // Far side wall + window band.
  const far = new THREE.Mesh(new THREE.BoxGeometry(L, 2.2, 0.18), paint);
  far.position.set(0, 1.4, -1.25);
  far.castShadow = true;
  g.add(far);
  const farWin = new THREE.Mesh(new THREE.BoxGeometry(L - 0.6, 0.7, 0.06), dark);
  farWin.position.set(0, 1.95, -1.19);
  g.add(farWin);
  // Near side: two segments, torn-open gap in the middle.
  for (const [sx, sw] of [[-3.35, 3.3], [3.35, 3.3]]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(sw, 2.2, 0.18), paint);
    seg.position.set(sx, 1.4, 1.25);
    seg.castShadow = true;
    g.add(seg);
    const win = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.4, 0.7, 0.06), dark);
    win.position.set(sx, 1.95, 1.31);
    g.add(win);
  }
  // Torn edge frames at the breach.
  for (const ex of [-1.7, 1.7]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.3), stripe);
    edge.position.set(ex, 1.4, 1.25);
    edge.rotation.z = ex > 0 ? -0.08 : 0.06;
    g.add(edge);
  }
  // Step plank leaned against the breach so the 0.4 m lip reads as enterable.
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.3), mat.wood());
  plank.position.set(0.1, 0.35, 1.9);
  plank.rotation.x = 0.35;
  g.add(plank);
  // Ends.
  for (const ex of [-L / 2, L / 2]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 2.6), paint);
    end.position.set(ex, 1.4, 0);
    end.castShadow = true;
    g.add(end);
  }
  // Sagging roof with a dent.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.14, 2.8), paint);
  roof.position.set(0, 2.58, 0);
  roof.rotation.x = 0.05;
  roof.castShadow = true;
  g.add(roof);
  const dent = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.2), stripe);
  dent.position.set(2.4, 2.48, 0.6);
  dent.rotation.x = 0.2;
  g.add(dent);
  // Painted stripe along the far wall.
  const band = new THREE.Mesh(new THREE.BoxGeometry(L, 0.22, 0.05), stripe);
  band.position.set(0, 1.05, -1.36);
  g.add(band);
  // Bogeies half-buried under the floor.
  for (const bx of [-3.2, 3.2]) {
    const bogie = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2.2), dark);
    bogie.position.set(bx, 0.2, 0);
    g.add(bogie);
  }
  scene.add(g);
  // Collision: the walls and ends only — the interior stays walkable.
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const toW = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const farW = toW(0, -1.25);
  ctx.addCollisionBox(farW[0], 1.4, farW[1], new THREE.Vector3(L, 2.2, 0.3), rotY);
  for (const sx of [-3.35, 3.35]) {
    const w = toW(sx, 1.25);
    ctx.addCollisionBox(w[0], 1.4, w[1], new THREE.Vector3(3.3, 2.2, 0.3), rotY);
  }
  for (const ex of [-L / 2, L / 2]) {
    const w = toW(ex, 0);
    ctx.addCollisionBox(w[0], 1.4, w[1], new THREE.Vector3(0.3, 2.2, 2.6), rotY);
  }
}

/** Bare, lightning-struck tree: lean trunk + broken branches, fog silhouette bait. */
export function addDeadTree(ctx, x, z, h = 5) {
  const { scene } = ctx;
  const bark = mat.woodDark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const lean = (Math.random() - 0.5) * 0.14;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, h, 7), bark);
  trunk.position.y = h / 2;
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  g.add(trunk);
  // 3-4 branches snapping off the upper trunk; one always broken short.
  const nB = 3 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * Math.PI * 2 + Math.random();
    const by = h * (0.45 + Math.random() * 0.4);
    const bl = 1.1 + Math.random() * 1.1;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.11, bl, 5), bark);
    branch.position.set(
      Math.cos(a) * bl * 0.38 + lean * by,
      by + bl * 0.3,
      Math.sin(a) * bl * 0.38
    );
    branch.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9);
    branch.castShadow = true;
    g.add(branch);
  }
  scene.add(g);
  ctx.addCollisionBox(x, h / 2, z, new THREE.Vector3(0.8, h, 0.8));
}

/** Transformer bank: two finned cans, insulators and an arcing flicker light. */
export function addTransformerBank(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const steel = mat.metal();
  const rust = mat.rust();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 2.4), mat.concreteDark());
  pad.position.y = 0.1;
  pad.receiveShadow = true;
  g.add(pad);
  for (const canX of [-0.85, 0.85]) {
    const can = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 1.5), steel);
    can.position.set(canX, 1.0, 0);
    can.castShadow = true;
    g.add(can);
    // Radiator fins on the front face.
    for (let f = 0; f < 4; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.22), rust);
      fin.position.set(canX - 0.35 + f * 0.23, 1.0, 0.86);
      g.add(fin);
    }
    // Porcelain insulator stack on top.
    for (const ix of [canX - 0.28, canX + 0.28]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.6 }));
      ins.position.set(ix, 2.15, 0);
      g.add(ins);
    }
  }
  // The arc: a screaming blue point light on the shared bus bar.
  const arc = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xcfeaff, emissive: 0x8fc4ff, emissiveIntensity: 3 })
  );
  arc.position.set(0, 2.45, 0);
  g.add(arc);
  const pl = new THREE.PointLight(0x7fb0ff, 1.3, 9, 2);
  pl.position.set(0, 2.55, 0);
  pl.userData.flickerSeed = Math.random() * 100;
  flickerLights.push(pl);
  g.add(pl);
  // Warning plate.
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.7 })
  );
  plate.position.set(0, 1.1, 0.98);
  g.add(plate);
  scene.add(g);
  ctx.addCollisionBox(x, 1.1, z, new THREE.Vector3(3.5, 2.2, 2.4), rotY);
}

/** Pillbox: chest-high concrete blockhouse with dark firing slits. */
export function addPillbox(ctx, x, z, rotY = 0) {
  const { scene } = ctx;
  const concrete = mat.concrete();
  const dark = mat.dark();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), concrete);
  body.position.y = 1.1;
  body.rotation.z = (Math.random() - 0.5) * 0.02;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Overhanging roof slab.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 3.5), mat.concreteDark());
  roof.position.y = 2.3;
  roof.rotation.x = 0.02;
  roof.castShadow = true;
  g.add(roof);
  // Firing slits: front + both flanks (dark insets).
  const slitGeo = new THREE.BoxGeometry(1.1, 0.35, 0.1);
  const front = new THREE.Mesh(slitGeo, dark);
  front.position.set(0, 1.45, 1.52);
  g.add(front);
  for (const sx of [-1.52, 1.52]) {
    const side = new THREE.Mesh(slitGeo, dark);
    side.position.set(sx, 1.45, 0);
    side.rotation.y = Math.PI / 2;
    g.add(side);
  }
  // Blast-scoured base + a rebar stub on the roof.
  const scorch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.2), mat.concreteDark());
  scorch.position.set(0, 0.25, 1.55);
  g.add(scorch);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), mat.dark());
  rod.position.set(1, 2.8, -0.8);
  rod.rotation.z = 0.3;
  g.add(rod);
  scene.add(g);
  ctx.addCollisionBox(x, 1.15, z, new THREE.Vector3(3.2, 2.3, 3.2), rotY);
}
