/**
 * models/rifle.js
 * Karabiner 98k rifle model definition for buildModel().
 * Units: metres.
 *
 * Kar98k: German bolt-action rifle adopted in 1935 as the standard service
 * rifle of the Wehrmacht; it retained the Gewehr 98 bolt-action system with
 * a shorter barrel and overall length.
 *
 * Structure:
 *  - stock:   wooden stock block (UV [2,0,14,7])
 *  - body:    receiver / action block (metal UV [6,8,10,16])
 *  - bolt:    bolt handle / operating lever
 *  - barrel:  long barrel extending forward (-Z)
 *  - muzzle:  small marker at barrel tip
 */
export const rifleModel = {
  elements: [
    {
      name: 'stock',
      from: [-0.035, -0.015, 0.1],
      to: [0.035, 0.055, 0.34],
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
      name: 'body',
      from: [-0.03, 0, -0.14],
      to: [0.03, 0.07, 0.1],
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
      name: 'bolt',
      from: [0.025, 0.02, 0.02],
      to: [0.05, 0.055, 0.07],
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
      from: [-0.015, 0.012, -0.54],
      to: [0.015, 0.045, -0.14],
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
      from: [-0.008, 0.015, -0.55],
      to: [0.008, 0.045, -0.54],
    },
    {
      name: 'buttstock',
      from: [-0.04, -0.03, 0.3],
      to: [0.04, 0.07, 0.38],
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
      from: [-0.042, -0.035, 0.375],
      to: [0.042, 0.075, 0.39],
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
      name: 'handguard',
      from: [-0.022, 0.04, -0.45],
      to: [0.022, 0.055, -0.14],
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
      name: 'bolt_handle',
      from: [0.03, 0.03, 0.04],
      to: [0.06, 0.06, 0.09],
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
        barrel: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, 0, 0.02] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        bolt_handle: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [0, 0, -0.5] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
    reload: {
      duration: 2.0,
      loop: false,
      tracks: {
        bolt_handle: [
          { t: 0.0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.35, pos: [0.03, 0.02, 0.06], rot: [0, 0, -0.7] },
          { t: 0.7, pos: [0.03, 0.02, 0.06], rot: [0, 0, -0.7] },
          { t: 0.9, pos: [0.02, 0.01, 0.05], rot: [0, 0, -0.35] },
          { t: 1.0, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        body: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.4, rot: [0.35, 0, 0] },
          { t: 0.8, rot: [0.1, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
  },
};
