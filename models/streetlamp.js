/**
 * models/streetlamp.js
 * Street lamp model definition for buildModel().
 * Units: metres.
 *
 * Structure:
 *  - base:   small concrete base at ground level
 *  - pole:   vertical pole
 *  - arm:    horizontal arm extending from top of pole
 *  - head:   lamp head (box) at end of arm
 *  - bulb:   small emissive box inside head (visual glow)
 */
export const streetLampModel = {
  elements: [
    {
      name: 'base',
      from: [-0.15, 0, -0.15],
      to: [0.15, 0.1, 0.15],
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
      name: 'pole',
      from: [-0.04, 0.1, -0.04],
      to: [0.04, 3.2, 0.04],
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
      name: 'arm',
      from: [0, 3.1, 0],
      to: [0.6, 3.2, 0.04],
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
      name: 'head',
      from: [0.5, 3.05, -0.08],
      to: [0.75, 3.25, 0.08],
      faces: {
        east: { uv: [6, 8, 10, 16] },
        west: { uv: [6, 8, 10, 16] },
        up: { uv: [6, 8, 10, 16] },
        down: { uv: [6, 8, 10, 16] },
        south: { uv: [5, 2, 10, 6] },
        north: { uv: [5, 2, 10, 6] },
      },
    },
    {
      name: 'bulb',
      from: [0.55, 3.06, -0.04],
      to: [0.7, 3.12, 0.04],
    },
  ],
};
