import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  GUNSHIP_DURATION, GUNSHIP_AMMO, GUNSHIP_RATE, GUNSHIP_ALT, GUNSHIP_ORBIT_RATE,
  gunshipRadius, orbitPoint, orbitHeading, clampAim,
  AIM_YAW_MIN, AIM_YAW_MAX, AIM_PITCH_MIN, AIM_PITCH_MAX,
  createGunshipSequence,
} from '../src/game/gunship.js';

const TAU = Math.PI * 2;

test('orbitPoint keeps a constant radius around the map centre', () => {
  for (const a of [0, 0.7, 2.3, 4.9, TAU - 0.1]) {
    const p = orbitPoint(a, 38, 5, -7);
    assert.ok(Math.abs(Math.hypot(p.x - 5, p.z + 7) - 38) < 1e-9, `radius at ${a}`);
  }
});

test('orbitHeading is tangent to the CCW orbit (nose = local -Z)', () => {
  for (const a of [0, 1.2, 3.3, 5.5]) {
    const h = orbitHeading(a);
    // Camera-forward from yaw h, vs the analytic tangent of the orbit.
    const fwd = [-Math.sin(h), -Math.cos(h)];
    const tan = [-Math.sin(a), Math.cos(a)];
    assert.ok(Math.abs(fwd[0] - tan[0]) < 1e-9 && Math.abs(fwd[1] - tan[1]) < 1e-9);
  }
});

test('gunshipRadius hugs the arena and never dips below the floor value', () => {
  assert.equal(gunshipRadius(45), Math.round(45 * 0.85));
  assert.equal(gunshipRadius(20), 24); // tiny maps clamp to the minimum
});

test('clampAim keeps the gunner cone over the port door', () => {
  assert.equal(clampAim(-9, 0).aimYaw, AIM_YAW_MIN);
  assert.equal(clampAim(9, 0).aimYaw, AIM_YAW_MAX);
  assert.equal(clampAim(1, 5).pitch, AIM_PITCH_MAX);
  assert.equal(clampAim(1, -5).pitch, AIM_PITCH_MIN);
  assert.deepEqual(clampAim(1.5, -0.75), { aimYaw: 1.5, pitch: -0.75 });
});

function makeSequence(arenaHalf = 45) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const controller = { position: new THREE.Vector3(5, 1.6, -7) };
  return createGunshipSequence({
    scene, camera, controller, gamepad: { lastPad: null }, arenaHalf,
  });
}

test('unattended sequence flies its full duration and ends on the timer', () => {
  const gs = makeSequence();
  const handlers = { enemies: [], onGroundHit: () => {} };
  let t = 0;
  let res = 'active';
  while (res === 'active' && t < (GUNSHIP_DURATION + 5) * 60) {
    res = gs.update(1 / 60, handlers);
    assert.ok(gs.state.time >= -1 / 60, 'loiter clock never runs silly negative');
    t++;
  }
  assert.equal(res, 'ended');
  const expected = Math.round(GUNSHIP_DURATION * 60);
  assert.ok(Math.abs(t - expected) <= 2, `ran ${t} frames, expected ~${expected}`);
  assert.equal(gs.ammo, GUNSHIP_AMMO, 'nobody shot the belt');
});

test('orbit, altitude, gunner cone and camera stay inside their lanes', () => {
  const gs = makeSequence();
  const handlers = { enemies: [], onGroundHit: () => {} };
  const r = gunshipRadius(45);
  for (let i = 0; i < 60; i++) {
    gs.update(1 / 60, handlers);
    const { x, z } = gs.plane.position;
    assert.ok(Math.abs(Math.hypot(x - 5, z + 7) - r) < 1e-6, 'plane on its ring');
    assert.ok(Math.abs(gs.plane.position.y - GUNSHIP_ALT) < 1e-6);
    assert.ok(gs.state.aimYaw >= AIM_YAW_MIN - 1e-6 && gs.state.aimYaw <= AIM_YAW_MAX + 1e-6);
    assert.ok(gs.state.pitch >= AIM_PITCH_MIN && gs.state.pitch <= AIM_PITCH_MAX);
    const cam = gs.gun.parent.position;
    assert.ok(cam.y > GUNSHIP_ALT - 3 && cam.y < GUNSHIP_ALT + 3, 'camera rides the airframe');
  }
  gs.end();
  assert.equal(gs.gun.parent, null); // viewmodel detached from the camera
});

test('rounds aimed at a zombie under the nose register as body hits', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const gs = createGunshipSequence({
    scene, camera, controller: { position: new THREE.Vector3(0, 1.6, 0) },
    gamepad: { lastPad: null }, arenaHalf: 45,
  });
  gs.state.pitch = -1.2;
  gs.state.aimYaw = 1.5;
  gs.update(1 / 60, { enemies: [], onEnemyShot: () => {}, onGroundHit: () => {} });
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const groundT = camera.position.y / -dir.y;
  const spot = camera.position.clone().addScaledVector(dir, groundT);
  const enemy = {
    alive: true, dying: false, type: 'normal', shot: 0,
    group: { position: new THREE.Vector3(spot.x, 0, spot.z) },
    takeDamage: () => false,
  };
  const handlers = { enemies: [enemy], onEnemyShot: (e) => { e.shot++; }, onGroundHit: () => {} };
  gs.setFiring(true);
  const ammo0 = gs.ammo;
  for (let i = 0; i < 60; i++) {
    gs.update(1 / 60, handlers);
    const d = camera.getWorldDirection(new THREE.Vector3());
    const p = camera.position.clone().addScaledVector(d, camera.position.y / -d.y);
    enemy.group.position.set(p.x, 0, p.z); // hold the target on the aim line
  }
  const shots = ammo0 - gs.ammo;
  assert.ok(shots >= 10, 'the belt was running');
  assert.ok(enemy.shot > 0 && enemy.shot <= shots, 'body hits land inside the round count');
  gs.end();
});

test('held trigger drains the belt and prints ground impacts until the clock stops it', () => {
  const gs = makeSequence();
  let ground = 0;
  const handlers = { enemies: [], onGroundHit: () => { ground++; } };
  gs.setFiring(true);
  let res = 'active';
  let guard = 0;
  while (res === 'active' && guard++ < GUNSHIP_DURATION * 60 + 60) {
    res = gs.update(1 / 60, handlers);
  }
  assert.equal(res, 'ended');
  const expected = GUNSHIP_DURATION * GUNSHIP_RATE;
  assert.ok(ground >= expected * 0.95 && ground <= expected + 3,
    `fired ${ground} rounds, expected ~${expected}`);
  assert.equal(gs.ammo, GUNSHIP_AMMO - ground, 'belt count matches rounds fired');
  assert.ok(ground < GUNSHIP_AMMO, 'timer, not the belt, ends the run');
  assert.ok(GUNSHIP_ORBIT_RATE > 0);
  gs.end();
});
