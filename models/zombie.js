/**
 * models/zombie.js
 * Simple box-model zombie: body, head, two arms.
 * Units: metres.
 *
 * Each part carries a `pivot` (the joint it rotates around when animated).
 *
 * Structure:
 *  - body:   torso + legs block (pivots at the waist)
 *  - head:   head block (pivots at the neck)
 *  - armL:   left arm (pivots at the shoulder)
 *  - armR:   right arm (pivots at the shoulder)
 */
export const zombieModel = {
  elements: [
    {
      name: 'body',
      from: [-0.225, 0.4, -0.125],
      to: [0.225, 1.4, 0.125],
      pivot: [0, 0.4, 0], // waist
      faces: {
        east: { uv: [0, 10, 16, 16] },
        west: { uv: [0, 10, 16, 16] },
        up: { uv: [0, 10, 16, 16] },
        down: { uv: [0, 10, 16, 16] },
        south: { uv: [0, 10, 16, 16] },
        north: { uv: [0, 10, 16, 16] },
      },
    },
    {
      name: 'head',
      from: [-0.15, 1.4, -0.2],
      to: [0.15, 2.0, 0.2],
      pivot: [0, 1.4, 0], // neck
      faces: {
        north: { uv: [0, 0, 16, 8] },
        south: { uv: [0, 0, 16, 8] },
        east: { uv: [4, 0, 8, 4] },
        west: { uv: [4, 0, 8, 4] },
        up: { uv: [4, 0, 8, 4] },
        down: { uv: [4, 0, 8, 4] },
      },
    },
    {
      name: 'armL',
      from: [-0.45, 0.8, 0.1],
      to: [-0.3, 1.4, 0.25],
      pivot: [-0.375, 1.4, 0.175], // shoulder
      faces: {
        east: { uv: [0, 10, 16, 16] },
        west: { uv: [0, 10, 16, 16] },
        up: { uv: [0, 10, 16, 16] },
        down: { uv: [0, 10, 16, 16] },
        south: { uv: [0, 10, 16, 16] },
        north: { uv: [0, 10, 16, 16] },
      },
    },
    {
      name: 'armR',
      from: [0.3, 0.8, 0.1],
      to: [0.45, 1.4, 0.25],
      pivot: [0.375, 1.4, 0.175], // shoulder
      faces: {
        east: { uv: [0, 10, 16, 16] },
        west: { uv: [0, 10, 16, 16] },
        up: { uv: [0, 10, 16, 16] },
        down: { uv: [0, 10, 16, 16] },
        south: { uv: [0, 10, 16, 16] },
        north: { uv: [0, 10, 16, 16] },
      },
    },
  ],
  anims: {
    // Slow idle sway: arms held out, slight head/body drift.
    idle: {
      duration: 2.4,
      loop: true,
      tracks: {
        armL: [
          { t: 0.0, rot: [0.55, 0, 0.1] },
          { t: 0.5, rot: [0.75, 0, 0.18] },
          { t: 1.0, rot: [0.55, 0, 0.1] },
        ],
        armR: [
          { t: 0.0, rot: [0.55, 0, -0.1] },
          { t: 0.5, rot: [0.75, 0, -0.18] },
          { t: 1.0, rot: [0.55, 0, -0.1] },
        ],
        head: [
          { t: 0.0, rot: [0.1, 0, 0.05] },
          { t: 0.5, rot: [0.16, 0.08, -0.05] },
          { t: 1.0, rot: [0.1, 0, 0.05] },
        ],
      },
    },
    // Walk cycle: arms swing in anti-phase, body bobs and leans slightly.
    walk: {
      duration: 0.8,
      loop: true,
      tracks: {
        armL: [
          { t: 0.0, rot: [0.45, 0, 0.1] },
          { t: 0.5, rot: [1.05, 0, 0.1] },
          { t: 1.0, rot: [0.45, 0, 0.1] },
        ],
        armR: [
          { t: 0.0, rot: [1.05, 0, -0.1] },
          { t: 0.5, rot: [0.45, 0, -0.1] },
          { t: 1.0, rot: [1.05, 0, -0.1] },
        ],
        body: [
          { t: 0.0, pos: [0, 0, 0], rot: [0.1, 0, 0.04] },
          { t: 0.5, pos: [0, 0.05, 0], rot: [0.1, 0, -0.04] },
          { t: 1.0, pos: [0, 0, 0], rot: [0.1, 0, 0.04] },
        ],
      },
    },
    // Lunge: right arm snaps forward as it strikes.
    attack: {
      duration: 0.4,
      loop: false,
      tracks: {
        armR: [
          { t: 0.0, rot: [0.5, 0, -0.1] },
          { t: 0.3, rot: [1.5, 0, -0.2] },
          { t: 1.0, rot: [0.5, 0, -0.1] },
        ],
        body: [
          { t: 0.0, rot: [0.1, 0, 0] },
          { t: 0.3, rot: [0.35, 0, 0] },
          { t: 1.0, rot: [0.1, 0, 0] },
        ],
      },
    },
    // Death: topple backwards and sink into the ground.
    death: {
      duration: 0.9,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.35, rot: [0.2, 0, 0] },
          { t: 0.75, rot: [1.45, 0, 0] },
          { t: 1.0, rot: [1.5, 0, 0], pos: [0, -0.4, 0] },
        ],
        head: [
          { t: 0.0, rot: [0.1, 0, 0] },
          { t: 1.0, rot: [0.5, 0, 0.2] },
        ],
        armL: [
          { t: 0.0, rot: [0.55, 0, 0.1] },
          { t: 1.0, rot: [0.2, 0, -0.5] },
        ],
        armR: [
          { t: 0.0, rot: [0.55, 0, -0.1] },
          { t: 1.0, rot: [0.2, 0, 0.5] },
        ],
      },
    },
  },
};
