import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Animator } from '../src/Animation.js';
import { buildModel } from '../src/ModelLoader.js';
import { zombieModel } from '../models/zombie.js';
import { zombieTexture } from '../textures/zombie.js';

// Minimal THREE stub is NOT needed here because we import the real module.
// But Animator only depends on Object3D's .position/.rotation/.scale/.scale,
// so we can use plain THREE objects.

function makeRoot(parts) {
  const root = new THREE.Group();
  for (const [name, obj] of Object.entries(parts)) {
    const o = new THREE.Object3D();
    o.name = name;
    root.add(o);
  }
  return root;
}

test('Animator: play + update interpolates position', () => {
  const root = makeRoot({ limb: new THREE.Object3D() });
  const clips = {
    move: {
      duration: 2,
      loop: true,
      tracks: {
        limb: [
          { t: 0, pos: [0, 0, 0] },
          { t: 1, pos: [0, 0, -2] },
        ],
      },
    },
  };
  const a = new Animator(root, clips);
  a.play('move');
  a.update(1); // halfway
  const p = root.getObjectByName('limb').position;
  assert.ok(Math.abs(p.z - -1) < 1e-6, `expected z≈-1, got ${p.z}`);
  a.update(1); // wraps around to 0
  assert.ok(Math.abs(root.getObjectByName('limb').position.z) < 1e-6);
});

test('Animator: non-looping clip calls onEnd and stops', () => {
  const root = makeRoot({ part: new THREE.Object3D() });
  let ended = false;
  const clips = {
    hit: {
      duration: 1,
      loop: false,
      tracks: { part: [{ t: 0, rot: [0, 0, 0] }, { t: 1, rot: [1, 0, 0] }] },
    },
  };
  const a = new Animator(root, clips);
  a.play('hit', { onEnd: () => (ended = true) });
  a.update(0.5);
  assert.equal(ended, false);
  a.update(0.5);
  assert.equal(ended, true);
  assert.equal(a.playing, false);
  // part should be at end pose
  const p = root.getObjectByName('part');
  assert.ok(Math.abs(p.rotation.x - 1) < 1e-4);
});

test('Animator: stop() restores rest pose', () => {
  const root = makeRoot({ limb: new THREE.Object3D() });
  const clips = {
    swing: {
      duration: 1,
      loop: true,
      tracks: { limb: [{ t: 0, rot: [0, 0, 0] }, { t: 1, rot: [1, 0, 0] }] },
    },
  };
  const a = new Animator(root, clips);
  a.play('swing');
  a.update(0.5);
  assert.ok(Math.abs(root.getObjectByName('limb').rotation.x - 0.5) < 1e-3);
  a.stop();
  assert.ok(Math.abs(root.getObjectByName('limb').rotation.x) < 1e-6);
});

test('Animator: update is no-op when no clip is active', () => {
  const root = makeRoot({ limb: new THREE.Object3D() });
  const a = new Animator(root, {});
  a.update(10); // should not throw
  assert.equal(a.playing, false);
});

test('Animator drives a real buildModel(zombie) model', () => {
  const root = buildModel(zombieModel, zombieTexture);
  const a = new Animator(root, zombieModel.anims);

  // All animated part names resolve to pivots inside the built group.
  for (const part of ['armL', 'armR', 'head', 'body', 'root']) {
    const obj = part === 'root' ? root : root.getObjectByName(part);
    assert.ok(obj, `missing part: ${part}`);
  }

  // Walk swings the left arm from its shoulder pivot.
  a.play('walk');
  a.update(zombieModel.anims.walk.duration); // a full loop returns to t=0
  const armL = root.getObjectByName('armL');
  assert.ok(armL, 'armL pivot present');

  // Death: play once, step to the end, verify it falls over and fires onEnd.
  let ended = false;
  a.play('death', { onEnd: () => (ended = true) });
  a.update(zombieModel.anims.death.duration + 0.001);
  assert.equal(ended, true);
  assert.equal(a.playing, false);
  assert.ok(Math.abs(root.rotation.x - 1.5) < 1e-4, `root fell: x=${root.rotation.x}`);
});
