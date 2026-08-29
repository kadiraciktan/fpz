/**
 * models/headcrab.js
 * Little box-model headcrab: fleshy dome shell, front mouth-plate, two
 * side legs and two small front claws. Built at zombie scale — the enemy
 * preset shrinks it down (scale ~0.5).
 * Units: metres. Forward is +z.
 *
 * Structure:
 *  - shell:  the dome body (pivots at the base for a squish pulse)
 *  - head:   front-top plate with the mouth (pivots where it meets shell)
 *  - legL:   left leg (pivots at the hip on the shell edge)
 *  - legR:   right leg (pivots at the hip)
 *  - armL:   left front claw (pivots at the shoulder)
 *  - armR:   right front claw (pivots at the shoulder)
 */
export const headcrabModel = {
  elements: [
    {
      name: 'shell',
      from: [-0.35, 0.5, -0.45],
      to: [0.35, 0.95, 0.35],
      pivot: [0, 0.5, 0], // base of the dome
      faces: {
        east: { uv: [0, 0, 16, 6] },
        west: { uv: [0, 0, 16, 6] },
        up: { uv: [0, 0, 16, 6] },
        down: { uv: [0, 6, 16, 10] },
        south: { uv: [0, 0, 16, 6] },
        north: { uv: [0, 0, 16, 6] },
      },
    },
    {
      name: 'head',
      from: [-0.22, 0.58, 0.15],
      to: [0.22, 0.92, 0.48],
      pivot: [0, 0.58, 0.15], // where the plate meets the shell
      faces: {
        east: { uv: [0, 6, 16, 10] },
        west: { uv: [0, 6, 16, 10] },
        up: { uv: [0, 0, 16, 6] },
        down: { uv: [0, 6, 16, 10] },
        south: { uv: [0, 6, 16, 10] },
        north: { uv: [0, 6, 16, 10] },
      },
    },
    {
      name: 'legL',
      from: [-0.55, 0.05, -0.15],
      to: [-0.3, 0.6, 0.15],
      pivot: [-0.32, 0.6, 0], // hip on the shell edge
      faces: {
        east: { uv: [0, 10, 8, 16] },
        west: { uv: [0, 10, 8, 16] },
        up: { uv: [0, 10, 8, 16] },
        down: { uv: [0, 10, 8, 16] },
        south: { uv: [0, 10, 8, 16] },
        north: { uv: [0, 10, 8, 16] },
      },
    },
    {
      name: 'legR',
      from: [0.3, 0.05, -0.15],
      to: [0.55, 0.6, 0.15],
      pivot: [0.32, 0.6, 0], // hip on the shell edge
      faces: {
        east: { uv: [0, 10, 8, 16] },
        west: { uv: [0, 10, 8, 16] },
        up: { uv: [0, 10, 8, 16] },
        down: { uv: [0, 10, 8, 16] },
        south: { uv: [0, 10, 8, 16] },
        north: { uv: [0, 10, 8, 16] },
      },
    },
    {
      name: 'armL',
      from: [-0.2, 0.42, 0.3],
      to: [-0.05, 0.6, 0.6],
      pivot: [-0.12, 0.55, 0.3], // shoulder
      faces: {
        east: { uv: [8, 10, 16, 16] },
        west: { uv: [8, 10, 16, 16] },
        up: { uv: [8, 10, 16, 16] },
        down: { uv: [8, 10, 16, 16] },
        south: { uv: [8, 10, 16, 16] },
        north: { uv: [8, 10, 16, 16] },
      },
    },
    {
      name: 'armR',
      from: [0.05, 0.42, 0.3],
      to: [0.2, 0.6, 0.6],
      pivot: [0.12, 0.55, 0.3], // shoulder
      faces: {
        east: { uv: [8, 10, 16, 16] },
        west: { uv: [8, 10, 16, 16] },
        up: { uv: [8, 10, 16, 16] },
        down: { uv: [8, 10, 16, 16] },
        south: { uv: [8, 10, 16, 16] },
        north: { uv: [8, 10, 16, 16] },
      },
    },
  ],
  anims: {
    // Breathing dome: slow squish pulse, legs and claws twitch.
    idle: {
      duration: 2.0,
      loop: true,
      tracks: {
        shell: [
          { t: 0.0, scale: [1, 1, 1] },
          { t: 0.5, scale: [1.05, 0.93, 1.05] },
          { t: 1.0, scale: [1, 1, 1] },
        ],
        head: [
          { t: 0.0, rot: [0.05, 0, 0] },
          { t: 0.5, rot: [0.16, 0, 0] },
          { t: 1.0, rot: [0.05, 0, 0] },
        ],
        legL: [
          { t: 0.0, rot: [0, 0, 0.05] },
          { t: 0.5, rot: [0.12, 0, 0.1] },
          { t: 1.0, rot: [0, 0, 0.05] },
        ],
        legR: [
          { t: 0.0, rot: [0.12, 0, -0.1] },
          { t: 0.5, rot: [0, 0, -0.05] },
          { t: 1.0, rot: [0.12, 0, -0.1] },
        ],
      },
    },
    // Low scuttle: legs flick in anti-phase, dome rocks side to side.
    walk: {
      duration: 0.35,
      loop: true,
      tracks: {
        legL: [
          { t: 0.0, rot: [0.6, 0, 0.1] },
          { t: 0.5, rot: [-0.6, 0, 0.1] },
          { t: 1.0, rot: [0.6, 0, 0.1] },
        ],
        legR: [
          { t: 0.0, rot: [-0.6, 0, -0.1] },
          { t: 0.5, rot: [0.6, 0, -0.1] },
          { t: 1.0, rot: [-0.6, 0, -0.1] },
        ],
        shell: [
          { t: 0.0, rot: [0, 0, 0.06] },
          { t: 0.5, rot: [0, 0, -0.06] },
          { t: 1.0, rot: [0, 0, 0.06] },
        ],
      },
    },
    // One-shot leap: crouch, extend hard, legs tuck under mid-air.
    hop: {
      duration: 0.5,
      loop: false,
      tracks: {
        shell: [
          { t: 0.0, rot: [0.3, 0, 0] },
          { t: 0.25, rot: [-0.35, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        legL: [
          { t: 0.0, rot: [0.7, 0, 0.15] },
          { t: 0.25, rot: [-1.1, 0, 0.35] },
          { t: 1.0, rot: [0, 0, 0.1] },
        ],
        legR: [
          { t: 0.0, rot: [0.7, 0, -0.15] },
          { t: 0.25, rot: [-1.1, 0, -0.35] },
          { t: 1.0, rot: [0, 0, -0.1] },
        ],
        armL: [
          { t: 0.0, rot: [0, 0, 0.1] },
          { t: 0.25, rot: [-0.7, 0, 0.2] },
          { t: 1.0, rot: [0, 0, 0.1] },
        ],
        armR: [
          { t: 0.0, rot: [0, 0, -0.1] },
          { t: 0.25, rot: [-0.7, 0, -0.2] },
          { t: 1.0, rot: [0, 0, -0.1] },
        ],
      },
    },
    // Strike: both claws snap forward, dome lunges.
    attack: {
      duration: 0.35,
      loop: false,
      tracks: {
        armL: [
          { t: 0.0, rot: [-0.3, 0, 0.1] },
          { t: 0.4, rot: [1.5, 0, 0.15] },
          { t: 1.0, rot: [-0.3, 0, 0.1] },
        ],
        armR: [
          { t: 0.0, rot: [-0.3, 0, -0.1] },
          { t: 0.4, rot: [1.5, 0, -0.15] },
          { t: 1.0, rot: [-0.3, 0, -0.1] },
        ],
        shell: [
          { t: 0.0, rot: [0.15, 0, 0] },
          { t: 0.4, rot: [0.5, 0, 0] },
          { t: 1.0, rot: [0.15, 0, 0] },
        ],
      },
    },
    // Death: rolls onto its back, legs twitching, then sinks away.
    death: {
      duration: 1.0,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.3, rot: [0, 0, 0.9] },
          { t: 0.75, rot: [0, 0, 3.0], pos: [0, -0.05, 0] },
          { t: 1.0, rot: [0, 0, 3.14], pos: [0, -0.5, 0] },
        ],
        legL: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.45, rot: [-0.8, 0, 0.4] },
          { t: 0.8, rot: [0.5, 0, -0.2] },
          { t: 1.0, rot: [-0.3, 0, 0.2] },
        ],
        legR: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.5, rot: [0.6, 0, -0.5] },
          { t: 0.85, rot: [-0.7, 0, 0.3] },
          { t: 1.0, rot: [0.3, 0, -0.1] },
        ],
        armL: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.6, rot: [0.9, 0, 0.3] },
          { t: 1.0, rot: [0.2, 0, 0.1] },
        ],
        armR: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.65, rot: [0.7, 0, -0.4] },
          { t: 1.0, rot: [0.2, 0, -0.1] },
        ],
      },
    },
  },
};
