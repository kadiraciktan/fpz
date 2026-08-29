/**
 * models/hands.js
 * First-person hands (box model) that grip the active weapon.
 * Units: metres. Built in the weapon's local space (grip at +z, barrel at -z)
 * so the same model works for every gun.
 *
 * Structure:
 *  - handR:   right hand wrapping the pistol grip
 *  - sleeveR: right forearm (sleeve) toward the camera
 *  - handL:   left support hand on the foregrip / barrel
 *  - sleeveL: left forearm (sleeve) toward the camera
 *
 * UVs: forearms use the sleeve band [0,0,16,8], hands use the skin band
 * [0,8,16,16] (see textures/hands.js).
 */
export const handsModel = {
  elements: [
    // Right palm: wraps the grip. Slightly wider than the grip so it reads as
    // holding it; the grip emerges from the top of the palm.
    {
      name: 'handR',
      from: [-0.04, -0.13, -0.02],
      to: [0.04, -0.04, 0.1],
      faces: {
        east: { uv: [0, 8, 16, 16] },
        west: { uv: [0, 8, 16, 16] },
        up: { uv: [0, 8, 16, 16] },
        down: { uv: [0, 8, 16, 16] },
        south: { uv: [0, 8, 16, 16] },
        north: { uv: [0, 8, 16, 16] },
      },
    },
    // Right thumb: curls on the near (+x) side toward the trigger.
    {
      name: 'thumbR',
      from: [0.03, -0.1, 0.0],
      to: [0.058, -0.05, 0.06],
      faces: {
        east: { uv: [0, 8, 16, 16] },
        west: { uv: [0, 8, 16, 16] },
        up: { uv: [0, 8, 16, 16] },
        down: { uv: [0, 8, 16, 16] },
        south: { uv: [0, 8, 16, 16] },
        north: { uv: [0, 8, 16, 16] },
      },
    },
    // Right forearm: thin box pointing toward the camera, pivoted at the hand
    // and rotated down-and-out (see anims) to form the right side of the V.
    {
      name: 'sleeveR',
      from: [-0.025, -0.115, 0.06],
      to: [0.025, -0.045, 0.4],
      pivot: [0.0, -0.08, 0.06],
      faces: {
        east: { uv: [0, 0, 16, 8] },
        west: { uv: [0, 0, 16, 8] },
        up: { uv: [0, 0, 16, 8] },
        down: { uv: [0, 0, 16, 8] },
        south: { uv: [0, 0, 16, 8] },
        north: { uv: [0, 0, 16, 8] },
      },
    },
    // Left palm: cradles under the foregrip / barrel.
    {
      name: 'handL',
      from: [-0.045, -0.1, -0.26],
      to: [0.035, -0.02, -0.12],
      faces: {
        east: { uv: [0, 8, 16, 16] },
        west: { uv: [0, 8, 16, 16] },
        up: { uv: [0, 8, 16, 16] },
        down: { uv: [0, 8, 16, 16] },
        south: { uv: [0, 8, 16, 16] },
        north: { uv: [0, 8, 16, 16] },
      },
    },
    // Left thumb: on the near (-x) side of the support hand.
    {
      name: 'thumbL',
      from: [-0.058, -0.07, -0.22],
      to: [-0.03, -0.02, -0.16],
      faces: {
        east: { uv: [0, 8, 16, 16] },
        west: { uv: [0, 8, 16, 16] },
        up: { uv: [0, 8, 16, 16] },
        down: { uv: [0, 8, 16, 16] },
        south: { uv: [0, 8, 16, 16] },
        north: { uv: [0, 8, 16, 16] },
      },
    },
    // Left forearm: thin box pointing toward the camera, pivoted at the hand
    // and rotated down-and-out (see createHandsMesh) to form the left side of
    // the V (mirror of sleeveR).
    {
      name: 'sleeveL',
      from: [-0.02, -0.09, -0.19],
      to: [0.02, -0.04, 0.15],
      pivot: [-0.005, -0.065, -0.19],
      faces: {
        east: { uv: [0, 0, 16, 8] },
        west: { uv: [0, 0, 16, 8] },
        up: { uv: [0, 0, 16, 8] },
        down: { uv: [0, 0, 16, 8] },
        south: { uv: [0, 0, 16, 8] },
        north: { uv: [0, 0, 16, 8] },
      },
    },
  ],
  anims: {
    // Subtle breathing sway so the hands don't look frozen.
    idle: {
      duration: 2.2,
      loop: true,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.5, pos: [0, -0.008, 0.004] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
    // Recoil: hands kick back and up with the shot.
    fire: {
      duration: 0.12,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, 0.014, 0.022] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handR: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [0.12, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        thumbR: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [0.1, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
    // Reload: hands dip and the left hand reaches to the magazine, then back.
    // Duration is 1.0s; played at speed = 1 / reloadTime so it lasts exactly
    // the weapon's reload duration.
    reload: {
      duration: 1.0,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, -0.05, 0.03] },
          { t: 0.5, pos: [0, -0.06, 0.04] },
          { t: 0.8, pos: [0, -0.02, 0.01] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0.03, -0.07, 0.06] },
          { t: 0.5, pos: [0.03, -0.07, 0.06] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        thumbL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0.02, -0.05, 0.04] },
          { t: 0.5, pos: [0.02, -0.05, 0.04] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        sleeveL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0.02, -0.04, 0.03] },
          { t: 0.5, pos: [0.02, -0.04, 0.03] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
    // ── Weapon-specific reloads (each 1.0s, played at 1 / reloadTime) ──
    // Pistol (M1911): tilt the gun down-right, left hand pulls the mag out
    // and seats a fresh one, right hand rakes the slide.
    reloadPistol: {
      duration: 1.0,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.2, pos: [0.02, -0.05, 0.03], rot: [0.35, 0, 0.15] },
          { t: 0.5, pos: [0.02, -0.06, 0.04], rot: [0.4, 0, 0.15] },
          { t: 0.8, pos: [0, -0.02, 0.01], rot: [0.1, 0, 0.05] },
          { t: 1.0, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        handL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.02, -0.08, 0.05] },
          { t: 0.4, pos: [0.02, -0.11, 0.06] },
          { t: 0.6, pos: [0.02, -0.08, 0.05] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        thumbL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.06, 0.04] },
          { t: 0.4, pos: [0.01, -0.09, 0.05] },
          { t: 0.6, pos: [0.01, -0.06, 0.04] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        sleeveL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.05, 0.03] },
          { t: 0.4, pos: [0.01, -0.07, 0.04] },
          { t: 0.6, pos: [0.01, -0.05, 0.03] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handR: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.6, rot: [0.1, 0, 0] },
          { t: 0.8, rot: [0.2, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
    // Rifle (Kar98k bolt-action): left hand works the bolt — reach to the
    // right side, pull it back, seat a round, push it forward.
    reloadRifle: {
      duration: 1.0,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.03, 0.02] },
          { t: 0.7, pos: [0, -0.03, 0.02] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.05, -0.02, 0.02] },
          { t: 0.4, pos: [0.05, -0.02, 0.09] },
          { t: 0.6, pos: [0.05, -0.02, 0.09] },
          { t: 0.8, pos: [0.05, -0.02, -0.02] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        thumbL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.04, -0.01, 0.01] },
          { t: 0.4, pos: [0.04, -0.01, 0.07] },
          { t: 0.6, pos: [0.04, -0.01, 0.07] },
          { t: 0.8, pos: [0.04, -0.01, -0.01] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        sleeveL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.03, -0.01, 0.01] },
          { t: 0.4, pos: [0.03, -0.01, 0.06] },
          { t: 0.6, pos: [0.03, -0.01, 0.06] },
          { t: 0.8, pos: [0.03, -0.01, -0.01] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
    // Shotgun (pump-action): left hand pumps the forend back, then forward,
    // while the right hand feeds a shell.
    reloadShotgun: {
      duration: 1.0,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.03, 0.02] },
          { t: 0.7, pos: [0, -0.03, 0.02] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, -0.02, 0.08] },
          { t: 0.5, pos: [0, -0.02, 0.08] },
          { t: 0.75, pos: [0, -0.02, -0.06] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        thumbL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, -0.01, 0.06] },
          { t: 0.5, pos: [0, -0.01, 0.06] },
          { t: 0.75, pos: [0, -0.01, -0.04] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        sleeveL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, -0.01, 0.05] },
          { t: 0.5, pos: [0, -0.01, 0.05] },
          { t: 0.75, pos: [0, -0.01, -0.04] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handR: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.5, rot: [0.12, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
    // Thompson (drum mag): left hand reaches down, pulls the drum, seats a
    // fresh one — a bigger, lower swap than the pistol.
    reloadThompson: {
      duration: 1.0,
      loop: false,
      tracks: {
        root: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.05, 0.03] },
          { t: 0.5, pos: [0.01, -0.06, 0.04] },
          { t: 0.8, pos: [0, -0.02, 0.01] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        handL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.09, 0.05] },
          { t: 0.4, pos: [0.01, -0.12, 0.06] },
          { t: 0.6, pos: [0.01, -0.09, 0.05] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        thumbL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.07, 0.04] },
          { t: 0.4, pos: [0.01, -0.1, 0.05] },
          { t: 0.6, pos: [0.01, -0.07, 0.04] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        sleeveL: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.06, 0.03] },
          { t: 0.4, pos: [0.01, -0.08, 0.04] },
          { t: 0.6, pos: [0.01, -0.06, 0.03] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
  },
};
