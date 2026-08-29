/**
 * models/cal50.js
 * .50 CAL anti-materiel rifle (CoD MW style) — buildModel() box definition.
 * Units: metres. Barrel = -Z. Long barrel + muzzle brake + bipod + cheek riser.
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

export const cal50Model = {
  elements: [
    { name: 'receiver', from: [-0.026, 0, -0.28], to: [0.026, 0.06, 0.1], faces: DARK },
    { name: 'rail', from: [-0.018, 0.06, -0.26], to: [0.018, 0.072, 0.06], faces: DARK },
    { name: 'barrel', from: [-0.013, 0.022, -0.84], to: [0.013, 0.048, -0.28], faces: METAL },
    { name: 'muzzle', from: [-0.018, 0.018, -0.88], to: [0.018, 0.052, -0.84], faces: DARK },
    { name: 'mag', from: [-0.022, -0.08, -0.14], to: [0.022, 0, -0.05], faces: DARK },
    { name: 'grip', from: [-0.018, -0.1, 0.02], to: [0.018, 0, 0.06], faces: DARK },
    { name: 'stock', from: [-0.02, 0.005, 0.1], to: [0.02, 0.05, 0.42], faces: DARK },
    { name: 'cheek', from: [-0.018, 0.05, 0.16], to: [0.018, 0.075, 0.38], faces: DARK },
    { name: 'bipod_l', from: [-0.03, -0.14, -0.62], to: [-0.022, 0.02, -0.6], faces: METAL },
    { name: 'bipod_r', from: [0.022, -0.14, -0.62], to: [0.03, 0.02, -0.6], faces: METAL },
    {
      name: 'bolt',
      from: [0.024, 0.044, 0.02],
      to: [0.038, 0.058, 0.07],
      pivot: [0.024, 0.051, 0.045],
      faces: METAL,
    },
  ],
  anims: {
    fire: {
      duration: 0.35,
      loop: false,
      tracks: {
        bolt: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.2, pos: [0, 0, 0.05] },
          { t: 0.7, pos: [0, 0, 0.04] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        receiver: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.15, pos: [0, 0.008, 0.03] },
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
          { t: 0.35, rot: [0.3, 0, 0] },
          { t: 0.6, rot: [0.3, 0, 0] },
          { t: 0.9, rot: [0.04, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        mag: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.08, 0] },
          { t: 0.55, pos: [0, -0.08, 0] },
          { t: 0.85, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
  },
};
