/**
 * game/drones.js
 * Kamikaze drone strike: a stock of small quadrotors the player launches by
 * hand. Launch animation = rotors spin up while the drone hops out nose-up
 * and climbs to patrol altitude; it then hunts the nearest zombie flat and
 * breaks into a fast dive inside the trigger radius, detonating on impact —
 * the world damage pass runs through the onDetonate callback in main.js
 * (same pattern as grenades / carpet).
 */

import * as THREE from 'three';

export const DRONE_STOCK = 2;        // drones restocked each prep phase
export const DRONE_MAX_CARRIED = 4;  // carry cap between resupplies
export const DRONE_SPEED = 17;       // hunt cruise speed m/s
export const DRONE_DIVE_SPEED = 27;  // terminal dive speed m/s
export const DRONE_DIVE_TRIGGER = 9; // lock range at which the dive begins
export const DRONE_ALT = 4.5;        // patrol altitude gained right after launch
export const DRONE_LIFETIME = 7;     // seconds before the warhead self-cooks off
export const DRONE_BLAST_RADIUS = 4.5;
export const DRONE_BLAST_DAMAGE = 9;
export const DRONE_RANGE = 40;       // target-lock radius

const SPINUP_TIME = 0.5;             // rotor ramp-up after the hand launch
const CLIMB_RATE = 5.5;              // extra vertical climb m/s (launch phase)

const BODY_GEO = new THREE.BoxGeometry(0.34, 0.12, 0.34);
const ARM_GEO = new THREE.BoxGeometry(0.5, 0.03, 0.05);
const ROTOR_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.015, 8);
const LED_GEO = new THREE.SphereGeometry(0.045, 6, 6);

/** Build one quadrotor: body + cross arms + spinning rotors + red warhead LED. */
export function createDroneMesh() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(BODY_GEO, metal);
  g.add(body);
  const armA = new THREE.Mesh(ARM_GEO, metal);
  const armB = new THREE.Mesh(ARM_GEO, metal);
  armB.rotation.y = Math.PI / 2;
  g.add(armA, armB);
  const rotors = [];
  const dark = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.8 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = new THREE.Mesh(ROTOR_GEO, dark);
    r.position.set(sx * 0.25, 0.05, sz * 0.25);
    g.add(r);
    rotors.push(r);
  }
  const led = new THREE.Mesh(LED_GEO, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  // Mesh lookAt points +Z at the flight target, so the nose is +Z.
  led.position.set(0, 0.02, 0.19);
  g.add(led);
  g.userData.rotors = rotors;
  g.userData.led = led;
  g.traverse((o) => { o.castShadow = true; });
  led.castShadow = false;
  return g;
}

/**
 * Launch a drone from the player's chest toward the camera's facing.
 * It hops out nose-up, climbs to patrol altitude, hunts and finally dives.
 * Returns the live drone record (pushed onto the caller's list).
 */
export function launchDrone(scene, camera, controller) {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const mesh = createDroneMesh();
  mesh.position.copy(controller.position).addScaledVector(dir, 0.7);
  mesh.position.y = 1.25; // pops out of the hand, below eye level
  scene.add(mesh);
  return {
    mesh, dir, life: DRONE_LIFETIME, spin: Math.random() * 10,
    age: 0, phase: 'climb', // climb → hunt → dive (one-way, it's kamikaze)
  };
}

/**
 * Fly every drone, home onto the nearest zombie and report detonations
 * through onDetonate(position). Returns the number of drones consumed
 * (contact, lifetime expiry or leaving the arena).
 */
export function updateDrones(drones, dt, {
  scene, enemies, camera, arenaHalf, onDetonate,
}) {
  const tmp = new THREE.Vector3();
  let used = 0;
  for (let i = drones.length - 1; i >= 0; i--) {
    const d = drones[i];
    d.life -= dt;
    d.age += dt;
    // Rotor spin-up after the hand launch, then steady wash + warhead LED blink.
    const spinRate = 55 * Math.min(1, d.age / SPINUP_TIME);
    for (const r of d.mesh.userData.rotors) r.rotation.y += dt * spinRate;
    d.mesh.userData.led.visible = (performance.now() * 0.008 + d.spin) % 1 < 0.6;

    // Nearest live zombie in lock range — the drone hunts it down.
    let target = null;
    let near = DRONE_RANGE;
    for (const e of enemies) {
      if (!e.alive || e.dying) continue;
      const dist = e.group.position.distanceTo(d.mesh.position);
      if (dist < near) { near = dist; target = e; }
    }

    let speed = DRONE_SPEED;
    if (d.phase === 'climb') {
      // Launch hop: steep nose-up climb, throttled forward speed.
      tmp.copy(d.dir).multiplyScalar(1);
      tmp.y += 1.6; // big up-component → the nose pitches skyward
      tmp.normalize();
      d.dir.lerp(tmp, Math.min(1, dt * 5)).normalize();
      d.mesh.position.y += CLIMB_RATE * dt;
      speed = DRONE_SPEED * 0.35;
      if (d.mesh.position.y >= DRONE_ALT) d.phase = 'hunt';
    } else {
      if (target) {
        tmp.copy(target.group.position);
        tmp.y = 1.1; // aim for chest height so the dive reads on screen
        tmp.sub(d.mesh.position).normalize();
        if (d.phase !== 'dive' && near < DRONE_DIVE_TRIGGER) d.phase = 'dive';
        const turn = (d.phase === 'dive' ? 10 : 4.5) * dt;
        d.dir.lerp(tmp, Math.min(1, turn)).normalize();
      }
      if (d.phase === 'dive') {
        speed = DRONE_DIVE_SPEED; // terminal dive — full 3D descent on dir
      } else {
        // Hunt: stay flat on patrol altitude while cruising toward the lock.
        d.dir.y = THREE.MathUtils.lerp(d.dir.y, 0, Math.min(1, dt * 3));
        d.dir.normalize();
        d.mesh.position.y = THREE.MathUtils.lerp(d.mesh.position.y, DRONE_ALT, dt * 1.5);
      }
    }

    d.mesh.position.addScaledVector(d.dir, speed * dt);
    d.mesh.lookAt(tmp.copy(d.mesh.position).add(d.dir));

    const hitTarget = target
      && d.mesh.position.distanceTo(target.group.position) < 1.4;
    const outOfBounds = Math.abs(d.mesh.position.x) > arenaHalf
      || Math.abs(d.mesh.position.z) > arenaHalf
      || d.mesh.position.y < 0.3;
    if (d.life <= 0 || hitTarget || outOfBounds) {
      onDetonate(d.mesh.position.clone(), hitTarget);
      scene.remove(d.mesh);
      for (const o of d.mesh.children) o.material.dispose?.();
      drones.splice(i, 1);
      used++;
    }
  }
  return used;
}
