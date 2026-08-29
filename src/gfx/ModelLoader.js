import * as THREE from 'three';

/**
 * ModelLoader.js
 * Builds a THREE.Group from a simple box-model definition and a
 * pixel-art texture (palette + rows).
 *
 * Each element can optionally specify a `pivot` point. The mesh is
 * then mounted inside a named Object3D "pivot" node placed at that
 * point so the mesh can rotate around it (joints, etc.).
 */

// ── Texture helpers ──────────────────────────────────────────────────

const textureCache = new Map();

/**
 * Convert a pixel texture definition into a THREE.DataTexture.
 * @param {object} tex - { size, palette, pixels }
 * @returns {THREE.DataTexture}
 */
export function buildTexture(tex) {
  if (textureCache.has(tex)) {
    return textureCache.get(tex);
  }

  const size = tex.size;
  const palette = tex.palette;
  const pixels = tex.pixels;

  if (!Number.isInteger(size) || size <= 0 || !Array.isArray(pixels) || pixels.length !== size || !palette) {
    throw new Error('buildTexture: invalid texture definition (size/pixels/palette)');
  }

  const data = new Uint8Array(size * size * 4);

  // flipY is ignored on WebGL ArrayBufferView; read from the bottom up
  // so row 0 of the definition ends up at the top of the texture.
  for (let y = 0; y < size; y++) {
    const row = pixels[size - 1 - y];
    if (typeof row !== 'string' || row.length !== size) {
      throw new Error(`buildTexture: row ${size - 1 - y} invalid (not a string or length ${size})`);
    }
    for (let x = 0; x < size; x++) {
      const ch = row[x];
      const hex = palette[ch];
      if (typeof hex !== 'string' || hex.length < 7) {
        throw new Error(`buildTexture: unknown palette char '${ch}' at (${x}, ${size - 1 - y})`);
      }
      const i = (y * size + x) * 4;
      data[i] = parseInt(hex.slice(1, 3), 16) || 0;
      data[i + 1] = parseInt(hex.slice(3, 5), 16) || 0;
      data[i + 2] = parseInt(hex.slice(5, 7), 16) || 0;
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.width = size;
  texture.height = size;
  textureCache.set(tex, texture);
  return texture;
}

// ── Model builder ───────────────────────────────────────────────────

const materialCache = new Map();

/**
 * Build a THREE.Group from a box-model definition.
 *
 * @param {object} model - { elements: [{ name, from:[x,y,z], to:[x,y,z],
 *                                   faces?, pivot? }], anims? }
 * @param {object} tex   - texture definition ({ size, palette, pixels })
 * @returns {THREE.Group}
 */
export function buildModel(model, tex) {
  const texture = buildTexture(tex);
  let material = materialCache.get(tex);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.75,
      metalness: 0.15,
    });
    materialCache.set(tex, material);
  }

  const group = new THREE.Group();

  for (const el of model.elements) {
    const from = el.from;
    const to = el.to;
    const w = to[0] - from[0];
    const h = to[1] - from[1];
    const d = to[2] - from[2];

    const geo = new THREE.BoxGeometry(w, h, d);

    // Per-face UV mapping:
    // BoxGeometry face order: 0=px(east) 1=nx(west) 2=py(up) 3=ny(down) 4=pz(south) 5=nz(north)
    if (el.faces) {
      const size = tex.size;
      const uvAttr = geo.attributes.uv;
      const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
      for (let fi = 0; fi < 6; fi++) {
        const faceName = faceOrder[fi];
        const faceDef = el.faces[faceName];
        if (!faceDef || !faceDef.uv) continue;
        const [x1, y1, x2, y2] = faceDef.uv;
        const u0 = x1 / size;
        const u1 = x2 / size;
        // y grows downward in the texture: y1 = top row → high v
        const v0 = 1 - y2 / size;
        const v1 = 1 - y1 / size;
        const base = fi * 4;
        uvAttr.setXY(base + 0, u0, v1);
        uvAttr.setXY(base + 1, u1, v1);
        uvAttr.setXY(base + 2, u0, v0);
        uvAttr.setXY(base + 3, u1, v0);
      }
      uvAttr.needsUpdate = true;
    }

    const mesh = new THREE.Mesh(geo, material);
    mesh.userData.partName = el.name;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (el.name === 'head') {
      mesh.userData.isHead = true;
    }

    // Determine pivot: default to element center
    const cx = (from[0] + to[0]) / 2;
    const cy = (from[1] + to[1]) / 2;
    const cz = (from[2] + to[2]) / 2;
    const px = el.pivot ? el.pivot[0] : cx;
    const py = el.pivot ? el.pivot[1] : cy;
    const pz = el.pivot ? el.pivot[2] : cz;

    const pivot = new THREE.Object3D();
    pivot.name = el.name;
    pivot.position.set(px, py, pz);
    mesh.position.set(cx - px, cy - py, cz - pz);
    pivot.add(mesh);
    group.add(pivot);
  }

  // Stash anims on the group so the Animator can find them
  if (model.anims) {
    group.userData.anims = model.anims;
  }

  return group;
}
