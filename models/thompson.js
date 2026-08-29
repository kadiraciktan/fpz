/**
 * models/thompson.js
 * Thompson M1A1 submachine gun model definition for buildModel().
 * Units: metres.
 *
 * WaW Thompson M1A1: 50-round metal drum magazine (not box) and a
 * wooden front foregrip under the short barrel; barrel points -Z.
 *
 * Structure:
 *  - body:     receiver / action block
 *  - barrel:   short barrel extending forward (-Z)
 *  - grip:     pistol grip below body
 *  - foregrip: wooden front grip under barrel (UV [2,0,14,7])
 *  - drum:     metal drum magazine below body
 *  - muzzle:   small marker at barrel tip
 */
export const thompsonModel = {
  elements: [
    {
      name: 'body',
      from: [-0.03, 0, -0.09],
      to: [0.03, 0.07, 0.14],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
    {
      name: 'barrel',
      from: [-0.015, 0.012, -0.21],
      to: [0.015, 0.045, -0.09],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
    {
      name: 'foregrip',
      from: [-0.018, -0.055, -0.17],
      to: [0.018, 0.01, -0.12],
      faces: {
        east: { uv: [2, 27, 14, 30] },
        west: { uv: [2, 27, 14, 30] },
        up: { uv: [2, 27, 14, 30] },
        down: { uv: [2, 27, 14, 30] },
        south: { uv: [2, 27, 14, 30] },
        north: { uv: [2, 27, 14, 30] },
      },
    },
    {
      name: 'grip',
      from: [-0.02, -0.11, 0.05],
      to: [0.02, 0, 0.11],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
    {
      name: 'drum',
      from: [-0.04, -0.13, -0.05],
      to: [0.04, 0, 0.035],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
    {
      name: 'drum_lip',
      from: [-0.045, -0.02, -0.055],
      to: [0.045, 0.01, 0.04],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
    {
      name: 'muzzle',
      from: [-0.008, 0.015, -0.22],
      to: [0.008, 0.045, -0.21],
    },
    {
      name: 'buttstock',
      from: [-0.028, -0.01, 0.14],
      to: [0.028, 0.055, 0.3],
      faces: {
        east: { uv: [2, 27, 14, 30] },
        west: { uv: [2, 27, 14, 30] },
        up: { uv: [2, 27, 14, 30] },
        down: { uv: [2, 27, 14, 30] },
        south: { uv: [2, 27, 14, 30] },
        north: { uv: [2, 27, 14, 30] },
      },
    },
    {
      name: 'buttplate',
      from: [-0.03, -0.015, 0.295],
      to: [0.03, 0.06, 0.31],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
    {
      name: 'cock_handle',
      from: [-0.045, 0.07, 0.02],
      to: [-0.028, 0.082, 0.05],
      pivot: [-0.03, 0.075, 0.035],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [6, 8, 10, 16] },
        north: { uv: [6, 8, 10, 16] },
      },
    },
  ],
  anims: {
    fire: {
      duration: 0.1,
      loop: false,
      tracks: {
        body: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, 0, 0.018] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        barrel: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, 0, 0.008] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
    reload: {
      duration: 2.0,
      loop: false,
      tracks: {
        // Drum swap: drum dips down and away, then swings back into place.
        drum: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.45, pos: [0, -0.09, 0.06] },
          { t: 0.75, pos: [0, -0.09, 0.06] },
          { t: 0.95, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        drum_lip: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.45, pos: [0, -0.09, 0.06] },
          { t: 0.75, pos: [0, -0.09, 0.06] },
          { t: 0.95, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        body: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.45, rot: [0.3, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
  },
};
