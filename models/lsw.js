/**
 * models/lsw.js
 * LSW light machine gun (CoD MW style) — buildModel() box definition.
 * Units: metres. Barrel = -Z. Heavy barrel + box mag + bipod + carry handle.
 */

const F = (x1, y1, x2, y2) => ({
  east: { uv: [x1, y1, x2, y2] },
  west: { uv: [x1, y1, x2, y2] },
  up: { uv: [x1, y1, x2, y2] },
  down: { uv: [x1, y1, x2, y2] },
  south: { uv: [x1, y1, x2, y2] },
  north: { uv: [x1, y1, x2, y2] },
});
const METAL = F(6, 8, 10, 16);
const DARK = F(2, 2, 14, 4);

export const lswModel = {
  elements: [
    { name: 'receiver', from: [-0.024, 0, -0.24], to: [0.024, 0.055, 0.08], faces: DARK },
    { name: 'handguard', from: [-0.022, 0.004, -0.42], to: [0.022, 0.05, -0.24], faces: DARK },
    { name: 'barrel', from: [-0.014, 0.02, -0.56], to: [0.014, 0.044, -0.42], faces: METAL },
    { name: 'muzzle', from: [-0.011, 0.022, -0.58], to: [0.011, 0.042, -0.56], faces: METAL },
    { name: 'boxmag', from: [-0.062, -0.03, -0.1], to: [0.01, 0.03, 0.01], faces: DARK },
    { name: 'grip', from: [-0.017, -0.1, 0.02], to: [0.017, 0, 0.058], faces: DARK },
    { name: 'stock', from: [-0.018, 0.004, 0.08], to: [0.018, 0.05, 0.3], faces: DARK },
    { name: 'butt', from: [-0.024, -0.01, 0.3], to: [0.024, 0.06, 0.33], faces: DARK },
    {
      name: 'handle',
      from: [-0.014, 0.055, -0.14],
      to: [0.014, 0.085, -0.06],
      pivot: [0, 0.055, -0.1],
      faces: DARK,
    },
    { name: 'bipod', from: [-0.026, -0.14, -0.5], to: [0.026, 0.02, -0.47], faces: METAL },
    {
      name: 'bolt',
      from: [0.022, 0.04, 0.03],
      to: [0.034, 0.05, 0.07],
      pivot: [0.022, 0.045, 0.05],
      faces: METAL,
    },
  ],
  anims: {
    fire: {
      duration: 0.13,
      loop: false,
      tracks: {
        bolt: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, 0, 0.024] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        receiver: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0, 0, 0.012] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
    reload: {
      duration: 1.0,
      loop: false,
      tracks: {
        receiver: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [0.25, 0, 0] },
          { t: 0.6, rot: [0.25, 0, 0] },
          { t: 0.9, rot: [0.04, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        boxmag: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [-0.02, -0.08, 0] },
          { t: 0.55, pos: [-0.02, -0.08, 0] },
          { t: 0.85, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
  },
};
