/**
 * models/shotgun.js
 * WaW Trench Gun model definition for buildModel().
 * Units: metres.
 *
 * Structure:
 *  - stock:        wooden stock block
 *  - body:         metal receiver / trigger block
 *  - barrel:       long barrel (-Z)
 *  - heat_shield:  perforated top barrel shield
 *  - bayonet_lug:  under-barrel lug
 *  - pump:         grooved wooden forend
 *  - muzzle:       muzzle marker
 */
export const shotgunModel = {
  elements: [
    {
      name: 'stock',
      from: [-0.032, -0.018, 0.055],
      to: [0.032, 0.058, 0.31],
      faces: {
        east: { uv: [2, 29, 14, 32] },
        west: { uv: [2, 29, 14, 32] },
        up: { uv: [2, 29, 14, 32] },
        down: { uv: [2, 29, 14, 32] },
        south: { uv: [2, 29, 14, 32] },
        north: { uv: [2, 29, 14, 32] },
      },
    },
    {
      name: 'body',
      from: [-0.034, -0.004, -0.105],
      to: [0.034, 0.072, 0.055],
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
      from: [-0.024, 0.014, -0.52],
      to: [0.024, 0.046, -0.105],
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
      name: 'heat_shield',
      from: [-0.031, 0.036, -0.43],
      to: [0.031, 0.062, -0.18],
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
      name: 'bayonet_lug',
      from: [-0.012, -0.004, -0.47],
      to: [0.012, 0.014, -0.43],
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
      from: [-0.019, 0.016, -0.53],
      to: [0.019, 0.044, -0.52],
    },
    {
      name: 'pump',
      from: [-0.031, -0.012, -0.31],
      to: [0.031, 0.048, -0.16],
      faces: {
        east: { uv: [2, 29, 14, 32] },
        west: { uv: [2, 29, 14, 32] },
        up: { uv: [2, 29, 14, 32] },
        down: { uv: [2, 29, 14, 32] },
        south: { uv: [2, 29, 14, 32] },
        north: { uv: [2, 29, 14, 32] },
      },
    },
    {
      name: 'buttplate',
      from: [-0.034, -0.022, 0.305],
      to: [0.034, 0.062, 0.32],
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
      duration: 0.15,
      loop: false,
      tracks: {
        barrel: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.35, pos: [0, 0.006, 0.03] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        heat_shield: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.35, pos: [0, 0.004, 0.03] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
    reload: {
      duration: 2.5,
      loop: false,
      tracks: {
        pump: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.55, pos: [0, 0, 0.12] },
          { t: 0.95, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        body: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.55, rot: [0.45, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
  },
  description:
    'WaW M1897 Trench Gun: uzun namlu, üstte delikli heat_shield, namlu altında ' +
    'bayonet_lug, yivli ahşap pump, ahşap stock ve metal receiver. Muzzle -Z metre ucundadır.',
};
