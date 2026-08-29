import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Enemy } from '../src/game/Enemy.js';

// Enemy is THREE-heavy but DOM-free: a bare Scene works as a stand-in.
const scene = new THREE.Scene();
const P0 = new THREE.Vector3();

function makeEnemy(options = {}, spawn = new THREE.Vector3(0, 0, 10)) {
  return new Enemy(scene, spawn, {
    type: 'normal', speed: 2, health: 999, damage: 10, getPeers: () => [], ...options,
  });
}

test('ignite banks burn DoT damage for main.js to consume', () => {
  const e = makeEnemy();
  e.ignite(4);
  let total = 0;
  const player = new THREE.Vector3(500, 0, 500); // far: no attack interference
  for (let i = 0; i < 200; i++) { // 10 simulated seconds
    e.update(0.05, player);
    total += e.burnDamage;
    e.burnDamage = 0;
  }
  // 4s × 2 dps = 8 (± float rounding, and nothing past the burn window).
  assert.ok(total >= 7 && total <= 8, `burn damage ≈ 8, got ${total}`);
  assert.equal(e.burnT <= 0, true, 'burn expires');
  e.dispose();
});

test('stun freezes movement and damage output', () => {
  const e = makeEnemy({ health: 999 });
  const player = new THREE.Vector3();
  const z0 = e.group.position.z;
  e.stun(2);
  let dmg = 0;
  for (let i = 0; i < 40; i++) dmg += e.update(0.05, player); // 2 seconds
  assert.equal(dmg, 0, 'no bites while stunned');
  assert.ok(Math.abs(e.group.position.z - z0) < 0.01, 'no crawl while stunned');
  // ...and it walks again once the stun lapses.
  for (let i = 0; i < 20; i++) e.update(0.05, player);
  assert.ok(e.group.position.z < z0 - 0.05, 'resumes the chase after stun');
  e.dispose();
});

test('takeDamage topples the corpse along the shot direction', () => {
  const e = makeEnemy({ health: 1 });
  const dir = new THREE.Vector3(0, 0, -1).normalize();
  assert.equal(e.takeDamage(5, dir), true);
  assert.equal(e.dying, true);
  // The death clip falls forward over +Z, so facing = atan2(dir.x, dir.z).
  assert.ok(Math.abs(e.group.rotation.y - Math.atan2(0, -1)) < 1e-6);
  assert.ok(Math.abs(e.group.rotation.z) <= 0.18, 'tumble stays subtle');
  e.dispose();
});

test('startDeath clears burn and stun state', () => {
  const e = makeEnemy({ health: 999 });
  e.ignite(4);
  e.stun(4);
  e.startDeath();
  assert.equal(e.burnT, 0);
  assert.equal(e.stunT, 0);
  e.dispose();
});

test('boss summons reinforcements and dashes at the player', () => {
  let summons = 0;
  let roars = 0;
  const e = makeEnemy({
    type: 'boss',
    health: 9999,
    onSummon: () => { summons++; },
    onBossRoar: () => { roars++; },
  });
  const player = new THREE.Vector3(); // ~10 m away: in dash + summon range
  let sawDash = false;
  const step = 0.05;
  for (let i = 0; i < 400; i++) { // 20 simulated seconds
    const before = e.group.position.clone();
    e.update(step, player);
    const hop = Math.hypot(e.group.position.x - before.x, e.group.position.z - before.z);
    if (hop > e.params.speed * step * 2.5) sawDash = true;
    if (e.group.position.length() < 1.5) {
      e.group.position.set(0, 0, 9); // stay in range for the whole window
    }
  }
  assert.ok(summons >= 1, `boss called reinforcements (${summons})`);
  assert.ok(roars >= 1, 'boss roars');
  assert.ok(sawDash, 'dash produced a fast lunge step');
  e.dispose();
});

test('normal zombies never summon or roar', () => {
  let called = 0;
  const e = makeEnemy({
    onSummon: () => { called++; },
    onBossRoar: () => { called++; },
  });
  const player = new THREE.Vector3(0, 0, 3);
  for (let i = 0; i < 400; i++) e.update(0.05, player);
  assert.equal(called, 0);
  e.dispose();
});
