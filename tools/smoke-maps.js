// Headless smoke test: build every map through createScene (merge + light
// extraction pass) and print before/after scene statistics.
import * as THREE from 'three';

// Minimal DOM stubs for canvas-based textures.
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {},
      stroke() {}, clearRect() {}, fillText() {},
      set fillStyle(_) {}, set strokeStyle(_) {}, set font(_) {},
      set textAlign(_) {}, set textBaseline(_) {}, set lineWidth(_) {},
      set globalAlpha(_) {},
    }),
  }),
  getElementById: () => null,
};

const { createScene } = await import('../src/maps/index.js');

for (const id of ['street', 'factory', 'bunker', 'nacht']) {
  const t0 = performance.now();
  const built = createScene(id);
  const ms = (performance.now() - t0).toFixed(0);
  let meshes = 0;
  let visibleMeshes = 0;
  let merged = 0;
  let lights = 0;
  let matSet = new Set();
  let geoSet = new Set();
  built.scene.traverse((o) => {
    if (o.isLight) lights++;
    if (o.isMesh) {
      meshes++;
      if (o.visible) visibleMeshes++;
      if (o.userData.mergedStatic) merged++;
      matSet.add(o.material);
      geoSet.add(o.geometry);
    }
  });
  const staticMeshes = built.obstacles.filter((o) => o.isMesh).length;
  const frozen = (() => {
    let n = 0;
    built.scene.traverse((o) => { if (!o.matrixAutoUpdate) n++; });
    return n;
  })();
  console.log(
    `${id.padEnd(8)} ${ms}ms  meshes ${meshes} (visible ${visibleMeshes}, merged ${merged})` +
    `  mats ${matSet.size}  geos ${geoSet.size}  sceneLights ${lights}` +
    `  poolDefs ${built.pointLights.length}  obstacles ${built.obstacles.length}` +
    `  staticMeshObs ${staticMeshes}  frozen ${frozen}`
  );
  // sanity: a couple of collision probes
  const { isBlockedAt } = await import('../src/game/collision.js');
  if (!isBlockedAt(0, 0, built.obstacles, 0.4, 0.8) && id === 'nacht') console.log('  (nacht center free ok)');
}
console.log('OK');
