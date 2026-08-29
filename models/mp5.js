/**
 * models/mp5.js
 * MP5 submachine gun (CoD MW style) — buildModel() box definition.
 * Units: metres. Barrel = -Z.
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

export const mp5Model = {
  elements: [
    { name: 'receiver', from: [-0.018, 0, -0.17], to: [0.018, 0.045, 0.05], faces: DARK },
    { name: 'forend', from: [-0.017, 0.002, -0.28], to: [0.017, 0.04, -0.17], faces: DARK },
    { name: 'barrel', from: [-0.009, 0.014, -0.33], to: [0.009, 0.034, -0.28], faces: METAL },
    { name: 'muzzle', from: [-0.007, 0.016, -0.34], to: [0.007, 0.032, -0.33], faces: METAL },
    { name: 'sightblock', from: [-0.01, 0.045, -0.27], to: [0.01, 0.06, -0.24], faces: DARK },
    { name: 'mag', from: [-0.015, -0.11, -0.07], to: [0.015, 0, -0.025], faces: DARK },
    { name: 'grip', from: [-0.015, -0.1, 0.005], to: [0.015, 0, 0.04], faces: DARK },
    { name: 'stock', from: [-0.012, 0.006, 0.05], to: [0.012, 0.03, 0.2], faces: METAL },
    { name: 'butt', from: [-0.018, -0.005, 0.2], to: [0.018, 0.045, 0.225], faces: DARK },
    {
      name: 'bolt',
      from: [0.016, 0.036, -0.02],
      to: [0.028, 0.046, 0.015],
      pivot: [0.016, 0.041, 0],
      faces: METAL,
    },
  ],
  anims: {
    fire: {
      duration: 0.09,
      loop: false,
      tracks: {
        bolt: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, 0, 0.018] },
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
          { t: 0.55, rot: [0.3, 0, 0] },
          { t: 0.85, rot: [0.05, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        mag: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.07, 0] },
          { t: 0.5, pos: [0, -0.07, 0] },
          { t: 0.75, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
  },
};
