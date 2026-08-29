/**
 * models/legs.js
 * A single first-person leg (box model) pointing straight down (-Y), pivoted
 * at the hip. Built by buildModel() then assembled into a hip->thigh->shin->boot
 * hierarchy in createLegsMesh() so the knee can bend.
 *
 * Structure (rest pose, straight down):
 *  - thigh: upper leg (hip at y=0, knee at y=-0.34)
 *  - shin:  lower leg (knee to ankle)
 *  - boot:  foot (toe points forward -Z)
 *
 * UVs: thigh + shin use the pants band [0,0,16,10], boot uses [0,10,16,16]
 * (see textures/legs.js).
 */
export const legModel = {
  elements: [
    {
      name: 'thigh',
      from: [-0.055, -0.34, -0.055],
      to: [0.055, 0, 0.055],
      pivot: [0, 0, 0],
      faces: {
        east: { uv: [0, 0, 16, 10] },
        west: { uv: [0, 0, 16, 10] },
        up: { uv: [0, 0, 16, 10] },
        down: { uv: [0, 0, 16, 10] },
        south: { uv: [0, 0, 16, 10] },
        north: { uv: [0, 0, 16, 10] },
      },
    },
    {
      name: 'shin',
      from: [-0.045, -0.62, -0.045],
      to: [0.045, -0.32, 0.045],
      pivot: [0, -0.34, 0],
      faces: {
        east: { uv: [0, 0, 16, 10] },
        west: { uv: [0, 0, 16, 10] },
        up: { uv: [0, 0, 16, 10] },
        down: { uv: [0, 0, 16, 10] },
        south: { uv: [0, 0, 16, 10] },
        north: { uv: [0, 0, 16, 10] },
      },
    },
    {
      name: 'boot',
      from: [-0.05, -0.74, -0.15],
      to: [0.05, -0.6, 0.1],
      pivot: [0, -0.62, 0],
      faces: {
        east: { uv: [0, 10, 16, 16] },
        west: { uv: [0, 10, 16, 16] },
        up: { uv: [0, 10, 16, 16] },
        down: { uv: [0, 10, 16, 16] },
        south: { uv: [0, 10, 16, 16] },
        north: { uv: [0, 10, 16, 16] },
      },
    },
  ],
};
