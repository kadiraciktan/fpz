/**
 * models/raygun.js
 * Ray Gun — the classic mystery-box wonder weapon, built from boxes.
 * Chunky sci-fistolet: fat receiver, glowing energy core on top and three
 * emitter rings hugging the barrel that flare when firing.
 * Uses the shared 32×32 gun texture (steel / wood / red-glow strips).
 */

const STEEL = { uv: [6, 8, 10, 16] };
const DARK = { uv: [2, 2, 14, 4] };
const WOOD = { uv: [2, 27, 14, 30] };
const GLOW = { uv: [3, 31, 29, 32] };

const steelFaces = {
  east: STEEL, west: STEEL, up: STEEL, down: STEEL, south: STEEL, north: STEEL,
};
const darkFaces = {
  east: DARK, west: DARK, up: DARK, down: DARK, south: DARK, north: DARK,
};
const woodFaces = {
  east: WOOD, west: WOOD, up: WOOD, down: WOOD, south: WOOD, north: WOOD,
};
const glowFaces = {
  east: GLOW, west: GLOW, up: GLOW, down: GLOW, south: GLOW, north: GLOW,
};

export const raygunModel = {
  elements: [
    { name: 'body', from: [-0.032, 0, -0.13], to: [0.032, 0.062, 0.06], faces: steelFaces },
    { name: 'core', from: [-0.018, 0.062, -0.07], to: [0.018, 0.088, 0.01], pivot: [0, 0.062, -0.03], faces: glowFaces },
    { name: 'barrel', from: [-0.017, 0.012, -0.27], to: [0.017, 0.046, -0.13], faces: darkFaces },
    { name: 'ring1', from: [-0.03, -0.002, -0.165], to: [0.03, 0.06, -0.145], faces: glowFaces },
    { name: 'ring2', from: [-0.03, -0.002, -0.215], to: [0.03, 0.06, -0.195], faces: glowFaces },
    { name: 'ring3', from: [-0.03, -0.002, -0.255], to: [0.03, 0.06, -0.235], faces: glowFaces },
    { name: 'muzzle', from: [-0.009, 0.015, -0.28], to: [0.009, 0.043, -0.27], faces: glowFaces },
    { name: 'grip', from: [-0.021, -0.11, 0.005], to: [0.021, 0, 0.05], faces: woodFaces },
    { name: 'trigger_guard', from: [-0.012, -0.035, -0.075], to: [0.012, 0, -0.03], faces: steelFaces },
    { name: 'stock', from: [-0.02, -0.02, 0.06], to: [0.02, 0.045, 0.13], faces: woodFaces },
  ],
  anims: {
    fire: {
      duration: 0.16,
      loop: false,
      tracks: {
        barrel: [
          { t: 0.0, pos: [0, 0, 0] },
          { t: 0.3, pos: [0, 0, 0.02] },
          { t: 1.0, pos: [0, 0, 0] },
        ],
        ring1: [{ t: 0.0, scale: [1, 1, 1] }, { t: 0.25, scale: [1.25, 1.25, 1] }, { t: 1.0, scale: [1, 1, 1] }],
        ring2: [{ t: 0.0, scale: [1, 1, 1] }, { t: 0.4, scale: [1.25, 1.25, 1] }, { t: 1.0, scale: [1, 1, 1] }],
        ring3: [{ t: 0.0, scale: [1, 1, 1] }, { t: 0.55, scale: [1.25, 1.25, 1] }, { t: 1.0, scale: [1, 1, 1] }],
        core: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.3, rot: [-0.3, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
    reload: {
      duration: 1.4,
      loop: false,
      tracks: {
        body: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.35, rot: [0.55, 0, 0] },
          { t: 0.6, rot: [0.55, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
        core: [
          { t: 0.0, rot: [0, 0, 0] },
          { t: 0.35, rot: [0.4, 0, 0] },
          { t: 0.6, rot: [0.4, 0, 0] },
          { t: 1.0, rot: [0, 0, 0] },
        ],
      },
    },
  },
};
