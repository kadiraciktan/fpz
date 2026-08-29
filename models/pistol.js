/**
 * models/pistol.js
 * M1911A1 pistol model definition for buildModel().
 * Units: metres.
 *
 * WaW M1911 referansı: M1911A1, .45 ACP yarı otomatik tabanca; kısa namlu,
 * eğik ahşap kabza ve tetik koruması ile tanınır.
 *
 * Structure:
 *  - body:   main receiver block
 *  - barrel: short barrel extending forward
 *  - grip:   angled grip below body
 *  - muzzle: small marker at barrel tip
 */
export const pistolModel = {
  elements: [
    {
      name: 'body',
      from: [-0.025, 0, -0.14],
      to: [0.025, 0.055, 0.04],
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
      from: [-0.015, 0.012, -0.24],
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
      name: 'grip',
      from: [-0.02, -0.11, -0.01],
      to: [0.02, 0, 0.035],
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
      name: 'muzzle',
      from: [-0.008, 0.015, -0.25],
      to: [0.008, 0.045, -0.24],
    },
    {
      name: 'trigger_guard',
      from: [-0.012, -0.035, -0.07],
      to: [0.012, 0, -0.025],
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
      name: 'hammer',
      from: [0.018, 0.02, 0.025],
      to: [0.03, 0.05, 0.04],
      pivot: [0.024, 0.02, 0.035],
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
      name: 'trigger',
      from: [-0.005, -0.03, -0.058],
      to: [0.005, -0.004, -0.046],
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
      name: 'mag_base',
      from: [-0.019, -0.122, -0.012],
      to: [0.019, -0.108, 0.038],
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
      name: 'serr_l',
      from: [-0.027, 0.008, 0.005],
      to: [-0.024, 0.05, 0.032],
      faces: {
        east: { uv: [2, 2, 14, 4] },
        west: { uv: [2, 2, 14, 4] },
        up: { uv: [2, 2, 14, 4] },
        down: { uv: [2, 2, 14, 4] },
        south: { uv: [2, 2, 14, 4] },
        north: { uv: [2, 2, 14, 4] },
      },
    },
    {
      name: 'serr_r',
      from: [0.024, 0.008, 0.005],
      to: [0.027, 0.05, 0.032],
      faces: {
        east: { uv: [2, 2, 14, 4] },
        west: { uv: [2, 2, 14, 4] },
        up: { uv: [2, 2, 14, 4] },
        down: { uv: [2, 2, 14, 4] },
        south: { uv: [2, 2, 14, 4] },
        north: { uv: [2, 2, 14, 4] },
      },
    },
    {
      name: 'slide_stop',
      from: [-0.029, 0.004, -0.03],
      to: [-0.024, 0.014, 0.0],
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
      duration: 0.12,
      loop: false,
      tracks: {
        barrel: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.01, 0.018] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        hammer: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [0.6, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
    reload: {
      duration: 1.2,
      loop: false,
      tracks: {
        body: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [0.5, 0, 0] },
          { t: 0.5, rot: [0.6, 0, 0] },
          { t: 0.8, rot: [0.1, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        grip: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.04, 0.02] },
          { t: 0.5, pos: [0, -0.04, 0.02] },
          { t: 0.8, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
  },
};
