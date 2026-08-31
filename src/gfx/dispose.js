/**
 * gfx/dispose.js
 * Release the GPU memory of a finished scene. Three.js resources are NOT
 * reclaimed by the JS garbage collector — geometries/materials/textures
 * must be disposed explicitly, or every restart leaks another map's worth
 * of VRAM. Enemy pooled groups and cached gun assets are already out of
 * the scene by the time this runs (they're recycled across runs).
 */

export function disposeSceneAssets(root) {
  root.traverse((o) => {
    if (o.isLight) return;
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
    if (!mats) return;
    for (const m of mats) {
      // ModelLoader's DataTexture materials are cached and shared across
      // runs (enemy pools, legs viewmodel) — never dispose those.
      if (m.map && !m.map.isCanvasTexture) continue;
      if (m.map) m.map.dispose(); // scene-owned canvas texture
      m.dispose();
    }
  });
  if (root.background && root.background.dispose) root.background.dispose();
}
