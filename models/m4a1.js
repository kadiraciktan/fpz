/**
 * models/m4a1.js
 * M4A1 carbine (CoD MW style) — buildModel() box definition.
 * Units: metres. Barrel = -Z.
 */

// Shared UV regions from the 32x32 weapon atlas.
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
const WOOD = F(2, 27, 14, 30);

export const m4a1Model = {
  elements: [
    { name: 'receiver', from: [-0.022, 0, -0.22], to: [0.022, 0.05, 0.06], faces: METAL },
    { name: 'rail', from: [-0.016, 0.05, -0.2], to: [0.016, 0.062, 0.02], faces: DARK },
    { name: 'handguard', from: [-0.02, 0.004, -0.42], to: [0.02, 0.048, -0.2], faces: DARK },
    { name: 'barrel', from: [-0.011, 0.018, -0.5], to: [0.011, 0.04, -0.42], faces: METAL },
    { name: 'muzzle', from: [-0.009, 0.02, -0.52], to: [0.009, 0.038, -0.5], faces: DARK },
    { name: 'mag', from: [-0.019, -0.1, -0.09], to: [0.019, 0, -0.03], faces: DARK },
    { name: 'grip', from: [-0.017, -0.1, 0.0], to: [0.017, 0, 0.04], faces: WOOD },
    { name: 'stock', from: [-0.016, 0.005, 0.06], to: [0.016, 0.045, 0.24], faces: DARK },
    { name: 'butt', from: [-0.022, -0.01, 0.24], to: [0.022, 0.055, 0.27], faces: DARK },
    {
      name: 'charging',
      from: [0.02, 0.04, 0.02],
      to: [0.032, 0.052, 0.06],
      pivot: [0.02, 0.046, 0.04],
      faces: METAL,
    },
  ],
  anims: {
    fire: {
      duration: 0.1,
      loop: false,
      tracks: {
        charging: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.25, pos: [0, 0, 0.022] },
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
          { t: 0.35, rot: [0.35, 0, 0] },
          { t: 0.55, rot: [0.35, 0, 0] },
          { t: 0.85, rot: [0.05, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        mag: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, -0.06, 0] },
          { t: 0.5, pos: [0, -0.06, 0] },
          { t: 0.75, pos: [0, 0, 0] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
      },
    },
  },
};
