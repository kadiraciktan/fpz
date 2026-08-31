/**
 * game/gunship.js
 * AC-130 gunship sequence (CoD4 "Death from Above" style): a spectre
 * circles the map on a fixed left-bank orbit while the player works the
 * port-side gatling gun. The camera is slaved to the plane for the whole
 * sequence — mouse look is captured (and blocked from the FPS controller)
 * and clamped to a gunner cone over the left door. Every round is a ray:
 * nearest zombie under the ray takes the hit, everything else walks away
 * under a ground impact which main.js resolves through the shared blast.
 * The sequence is strictly time-boxed (GUNSHIP_DURATION) or ends early
 * when the belt runs dry.
 */

import * as THREE from 'three';

export const GUNSHIP_DURATION = 25;        // seconds of loiter time
export const GUNSHIP_AMMO = 400;           // belt rounds available
export const GUNSHIP_RATE = 14;            // rounds per second
export const GUNSHIP_DAMAGE = 3;           // damage per round on a body hit
export const GUNSHIP_ALT = 42;             // orbit altitude (m)
export const GUNSHIP_ORBIT_RATE = 0.17;    // rad/s — constant left turn
export const GUNSHIP_SPREAD = 0.03;        // aim jitter cone (rad)
export const GUNSHIP_HIT_R = 1.4;          // ray-to-body hit radius (m)
export const GUNSHIP_HIT_R_BIG = 2.4;      // boss / brute hit radius
export const GUNSHIP_GROUND_BLAST_R = 2.4; // ground impact splash radius
export const GUNSHIP_GROUND_BLAST_DMG = 3; // ground impact splash damage
export const GUNSHIP_FOV = 48;             // scoped gunner sight

export function gunshipRadius(arenaHalf) {
  return Math.max(24, Math.round(arenaHalf * 0.85));
}

// ── Pure orbit / gunner-cone math (unit-tested without a scene) ──
export function orbitPoint(angle, radius, cx = 0, cz = 0, out = { x: 0, z: 0 }) {
  out.x = cx + Math.cos(angle) * radius;
  out.z = cz + Math.sin(angle) * radius;
  return out;
}

/** Yaw (model nose = local -Z) tangent to the CCW orbit. */
export function orbitHeading(angle) {
  return Math.PI - angle;
}

export const AIM_YAW_MIN = 0.12;  // relative to the nose; + = toward the port door
export const AIM_YAW_MAX = 2.85;
export const AIM_PITCH_MIN = -1.45;
export const AIM_PITCH_MAX = -0.1;
export const AIM_BANK = 0.26;

export function clampAim(aimYaw, pitch) {
  return {
    aimYaw: THREE.MathUtils.clamp(aimYaw, AIM_YAW_MIN, AIM_YAW_MAX),
    pitch: THREE.MathUtils.clamp(pitch, AIM_PITCH_MIN, AIM_PITCH_MAX),
  };
}

// ── Geometry ──
const HULL = new THREE.BoxGeometry(2.2, 2.2, 9);
const NOSE = new THREE.BoxGeometry(1.6, 1.4, 2.6);
const WING = new THREE.BoxGeometry(15, 0.28, 2.2);
const FIN = new THREE.BoxGeometry(0.3, 2.6, 1.8);
const STAB = new THREE.BoxGeometry(5.2, 0.22, 1.4);
const NACELLE = new THREE.BoxGeometry(0.7, 0.8, 2.4);
const PROP = new THREE.CircleGeometry(1.05, 10);
const DOOR = new THREE.BoxGeometry(0.1, 1.6, 1.7);

/** Blocky C-130: fuselage + shoulder wings + four props + big tail fin. */
export function createGunshipMesh() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x49515b, roughness: 0.8, metalness: 0.35, emissive: 0x1c2129,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2b3138, roughness: 0.7, metalness: 0.5, emissive: 0x12151a,
  });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(HULL, hullMat, 0, 0, 1.2);
  add(NOSE, hullMat, 0, -0.15, -4.6);
  add(WING, hullMat, 0, 0.9, 0.6);
  add(FIN, hullMat, 0, 1.9, 6.1);
  add(STAB, hullMat, 0, 1.4, 6.3);
  const props = [];
  for (const x of [-3, -6, 3, 6]) {
    add(NACELLE, darkMat, x, 0.45, 0.2);
    const p = add(PROP, new THREE.MeshBasicMaterial({
      color: 0xbfd4e6, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    }), x, 0.45, -1.2);
    props.push(p);
  }
  // Open port cargo door — a dark frame the gunner "sits" beside.
  add(DOOR, new THREE.MeshBasicMaterial({ color: 0x0a0c0f }), -1.14, -0.1, 2.4);
  g.userData.props = props;
  g.userData.materials = [hullMat, darkMat];
  return g;
}

const BARREL = new THREE.CylinderGeometry(0.045, 0.045, 1.25, 6);
const TRUNION = new THREE.BoxGeometry(0.55, 0.5, 0.7);
const FLASH = new THREE.PlaneGeometry(0.55, 0.55);

/** Gatling viewmodel for the gunner camera (layer 1 = viewmodel pass). */
export function createGunnerGun() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0x3a4047, roughness: 0.45, metalness: 0.8, emissive: 0x15181c,
  });
  const trunnion = new THREE.Mesh(TRUNION, steel);
  trunnion.position.set(0, -0.42, -0.75);
  g.add(trunnion);
  const barrels = new THREE.Group();
  for (const [x, y] of [[0, 0], [0.11, 0.06], [-0.11, 0.06]]) {
    const b = new THREE.Mesh(BARREL, steel);
    b.rotation.x = Math.PI / 2;
    b.position.set(x, y, 0);
    barrels.add(b);
  }
  barrels.position.set(0, -0.36, -1.35);
  g.add(barrels);
  const flash = new THREE.Mesh(FLASH, new THREE.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  flash.position.set(0, -0.36, -1.98);
  flash.visible = false;
  g.add(flash);
  g.traverse((o) => { if (o.isMesh) o.layers.set(1); });
  g.userData.flash = flash;
  g.userData.materials = [steel, flash.material];
  return g;
}

const TRACER_GEO = new THREE.BufferGeometry(); // positions uploaded per shot
const TRACER_POOL_MAX = 18;

/**
 * Start one sequence. main.js drives it: bindInput() on start,
 * update(dt, handlers) every frame, end() on finish or teardown.
 */
export function createGunshipSequence({ scene, camera, controller, gamepad, arenaHalf }) {
  const plane = createGunshipMesh();
  scene.add(plane);
  const gun = createGunnerGun();
  camera.add(gun);

  const state = {
    time: GUNSHIP_DURATION,
    ammo: GUNSHIP_AMMO,
    angle: Math.random() * Math.PI * 2,
    aimYaw: 1.45,
    pitch: -0.72,
    fireCd: 0,
    firing: false,
    ended: false,
    vib: Math.random() * 10,
  };
  const cx = controller.position.x;
  const cz = controller.position.z;
  const radius = gunshipRadius(arenaHalf);

  const tracers = [];
  const scratchPos = new THREE.Vector3();
  const scratchDir = new THREE.Vector3();
  const camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const planeEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  // ── Input capture: registered in the window CAPTURE phase so
  // stopImmediatePropagation starves the FPS controller / weapon manager
  // for the duration of the sequence. ──
  const locked = () => typeof document !== 'undefined' && document.pointerLockElement;
  let bound = false;
  const onMove = (e) => {
    if (!locked()) return;
    const s = 0.0021 * (state.firing ? 0.7 : 1); // slight steadying while firing
    state.aimYaw = THREE.MathUtils.clamp(
      state.aimYaw - e.movementX * s, AIM_YAW_MIN, AIM_YAW_MAX);
    state.pitch = THREE.MathUtils.clamp(
      state.pitch - e.movementY * s, AIM_PITCH_MIN, AIM_PITCH_MAX);
    e.stopImmediatePropagation();
  };
  const onDown = (e) => {
    if (e.button === 0 && locked()) { state.firing = true; e.stopImmediatePropagation(); }
  };
  const onUp = (e) => {
    if (e.button === 0) { state.firing = false; e.stopImmediatePropagation(); }
  };
  const onKey = (e) => {
    if (e.code !== 'Escape') e.stopImmediatePropagation(); // freeze gameplay keys
  };
  function bindInput() {
    if (bound || typeof window === 'undefined') return;
    bound = true;
    window.addEventListener('mousemove', onMove, { capture: true });
    window.addEventListener('mousedown', onDown, { capture: true });
    window.addEventListener('mouseup', onUp, { capture: true });
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('keyup', onKey, { capture: true });
  }
  function unbindInput() {
    if (!bound) return;
    bound = false;
    window.removeEventListener('mousemove', onMove, { capture: true });
    window.removeEventListener('mousedown', onDown, { capture: true });
    window.removeEventListener('mouseup', onUp, { capture: true });
    window.removeEventListener('keydown', onKey, { capture: true });
    window.removeEventListener('keyup', onKey, { capture: true });
  }

  // ── Firing ──
  const padDead = (v) => (Math.abs(v) < 0.18 ? 0 : v);

  function spawnTracer(from, to) {
    let t = tracers.find((x) => !x.line.visible);
    if (!t && tracers.length < TRACER_POOL_MAX) {
      const mat = new THREE.LineBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(TRACER_GEO.clone(), mat);
      line.layers.set(0);
      line.frustumCulled = false;
      scene.add(line);
      t = { line, ttl: 0 };
      tracers.push(t);
    }
    if (!t) return;
    t.line.geometry.setFromPoints([from, to]);
    t.line.material.opacity = 1;
    t.line.visible = true;
    t.ttl = 0.11;
  }

  function fireOnce(enemies, handlers) {
    camera.getWorldDirection(scratchDir);
    // Spray cone: random jitter inside GUNSHIP_SPREAD.
    scratchDir.x += (Math.random() - 0.5) * GUNSHIP_SPREAD;
    scratchDir.z += (Math.random() - 0.5) * GUNSHIP_SPREAD;
    scratchDir.normalize();
    if (scratchDir.y > -0.05) return; // aimed at the sky — wastes the belt quietly
    const groundT = camera.position.y / -scratchDir.y;

    // Nearest live body under the ray (before the ground point).
    let hit = null;
    let hitT = groundT;
    for (const e of enemies) {
      if (!e.alive || e.dying) continue;
      scratchPos.copy(e.group.position);
      scratchPos.y += 1.0; // chest line
      const rel = scratchPos.clone().sub(camera.position);
      const t = rel.dot(scratchDir);
      if (t <= 0 || t >= hitT) continue;
      const perp = Math.sqrt(Math.max(0, rel.lengthSq() - t * t));
      const r = (e.type === 'boss' || e.type === 'brute') ? GUNSHIP_HIT_R_BIG : GUNSHIP_HIT_R;
      if (perp < r) { hit = e; hitT = t; }
    }

    const point = scratchDir.clone().multiplyScalar(hitT).add(camera.position);
    point.y = Math.max(0.15, point.y);
    scratchPos.copy(camera.position);
    scratchPos.y -= 0.35; // tracers leave the belly, not the eyeball
    spawnTracer(scratchPos.clone(), point.clone());

    if (hit) handlers.onEnemyShot(hit, point);
    else handlers.onGroundHit(point);
  }

  /**
   * One tick. handlers: { enemies, onEnemyShot(enemy, point), onGroundHit(point) }.
   * Returns 'active' or 'ended'.
   */
  function update(dt, handlers) {
    // Gamepad: right stick aims, RT fires (mouse capture only exists for
    // keyboard/mouse players).
    const gp = gamepad && gamepad.lastPad;
    if (gp) {
      const rx = padDead(gp.axes[2] || 0);
      const ry = padDead(gp.axes[3] || 0);
      if (rx) state.aimYaw = THREE.MathUtils.clamp(state.aimYaw - rx * dt * 1.6, AIM_YAW_MIN, AIM_YAW_MAX);
      if (ry) state.pitch = THREE.MathUtils.clamp(state.pitch - ry * dt * 1.4, AIM_PITCH_MIN, AIM_PITCH_MAX);
      if (gp.buttons[7]?.value > 0.5 || gp.buttons[7]?.pressed) state.firing = true;
      else if (gp.buttons[7]) state.firing = false;
    }

    state.time -= dt;
    if (state.time <= 0 || state.ammo <= 0) state.ended = true;

    // Orbit: constant left bank, tangent heading.
    state.angle += GUNSHIP_ORBIT_RATE * dt;
    orbitPoint(state.angle, radius, cx, cz, plane.position);
    plane.position.y = GUNSHIP_ALT;
    const heading = orbitHeading(state.angle);
    planeEuler.set(0, heading, AIM_BANK, 'YXZ');
    plane.quaternion.setFromEuler(planeEuler);
    for (const p of plane.userData.props) p.rotation.z += dt * 30;

    // Engine vibration (worse while the gatling shakes the airframe).
    state.vib += dt * (36 + (state.firing ? 22 : 0));
    const shake = 0.02 + (state.firing ? 0.035 : 0);

    // Gunner sits in the open port door; camera rides the airframe.
    const q = plane.quaternion;
    scratchPos.set(-1.55, 0.55, 1.4).applyQuaternion(q).add(plane.position);
    camera.position.copy(scratchPos);
    camEuler.set(
      state.pitch + Math.sin(state.vib) * shake * 0.12,
      heading + state.aimYaw,
      AIM_BANK * 0.65 + Math.sin(state.vib * 1.7) * shake * 0.1,
      'YXZ',
    );
    camera.quaternion.setFromEuler(camEuler);

    // Belt feed.
    state.fireCd -= dt;
    let shots = 0;
    while (state.firing && state.ammo > 0 && state.fireCd <= 0 && !state.ended) {
      state.ammo--;
      state.fireCd += 1 / GUNSHIP_RATE;
      fireOnce(handlers.enemies, handlers);
      gun.userData.flash.visible = Math.random() < 0.7;
      gun.userData.flash.rotation.z = Math.random() * Math.PI;
      gun.userData.flash.scale.setScalar(0.8 + Math.random() * 0.5);
      handlers.onShot?.();
      if (++shots > 4) break; // frame-spike guard
    }
    if (!state.firing || state.ammo <= 0) gun.userData.flash.visible = false;

    // Tracers burn out.
    for (const t of tracers) {
      if (!t.line.visible) continue;
      t.ttl -= dt;
      t.line.material.opacity = Math.max(0, t.ttl / 0.11);
      if (t.ttl <= 0) t.line.visible = false;
    }

    return state.ended ? 'ended' : 'active';
  }

  /** Tear the rig out of the scene/camera (safe from teardown mid-flight). */
  function end() {
    unbindInput();
    scene.remove(plane);
    for (const m of plane.userData.materials) m.dispose?.();
    camera.remove(gun);
    for (const m of gun.userData.materials) m.dispose?.();
    for (const t of tracers) {
      scene.remove(t.line);
      t.line.material.dispose();
      t.line.geometry.dispose();
    }
    tracers.length = 0;
    state.ended = true;
  }

  return {
    plane, gun, state, bindInput, update, end,
    get time() { return Math.max(0, state.time); },
    get ammo() { return state.ammo; },
    get ended() { return state.ended; },
    setFiring(on) { state.firing = !!on; },
  };
}
