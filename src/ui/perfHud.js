/**
 * ui/perfHud.js
 * Debug overlay (F3): fps + draw calls + triangles + live light/shadow
 * counts. Shift+F3 dumps a per-scene-object visible-mesh breakdown.
 */

import * as THREE from 'three';

export function createPerfHud({ renderer, getScene, getCamera, getFrameInfo }) {
  const perfHud = {
    el: null, on: /[?&]fpzPerf/.test(location.search), acc: 0, frames: 0, fps: 0,
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      if (e.shiftKey && getScene()) dumpSceneBreakdown();
      else {
        perfHud.on = !perfHud.on;
        if (perfHud.el) perfHud.el.style.display = perfHud.on ? 'block' : 'none';
      }
    }
  });

  /** Shift+F3: console breakdown of visible meshes per top-level scene child. */
  function dumpSceneBreakdown() {
    const scene = getScene();
    const camera = getCamera();
    camera.layers.set(0); // renderWorld leaves layers=1 (viewmodel pass)
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const fr = new THREE.Frustum();
    fr.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
    const rows = [];
    let enemyVis = 0;
    for (const child of scene.children) {
      let vis = 0, tot = 0;
      child.traverse((o) => {
        if (!o.isMesh) return;
        tot++;
        if (o.visible && o.layers.test(camera.layers) && fr.intersectsObject(o)) vis++;
      });
      if (!tot) continue;
      if (child.userData.isEnemy) enemyVis += vis;
      rows.push({ obj: child.name || `${child.type}#${child.id}`, meshes: tot, visible: vis });
    }
    rows.sort((a, b) => b.visible - a.visible);
    const visible = rows.reduce((s, r) => s + r.visible, 0);
    console.log(`%c[fpz perf] ~${visible} visible meshes (×2 shadow/world pass ≈ draw calls), enemies: ${enemyVis}`, 'color:#8f8;font-weight:bold');
    console.table(rows.slice(0, 25));
  }

  function update(dt) {
    if (!perfHud.on) return;
    perfHud.acc += dt;
    perfHud.frames++;
    if (perfHud.acc >= 0.5) {
      perfHud.fps = Math.round(perfHud.frames / perfHud.acc);
      perfHud.acc = 0;
      perfHud.frames = 0;
      if (!perfHud.el) {
        perfHud.el = document.createElement('div');
        perfHud.el.style.cssText =
          'position:fixed;top:8px;left:8px;z-index:9999;padding:6px 10px;' +
          'background:rgba(0,0,0,.65);color:#8f8;font:12px/1.5 monospace;' +
          'pointer-events:none;white-space:pre;border-radius:4px';
        document.body.appendChild(perfHud.el);
      }
      const info = renderer.info.render;
      const f = getFrameInfo();
      perfHud.el.textContent =
        `FPS ${perfHud.fps}\n` +
        `draw calls ${info.calls}  tris ${info.triangles}\n` +
        `lights ${f.lightsUsed}/${f.poolSize} pool (${f.poolDefs} defs)  shadowMESH ${f.shadowVis}/${f.shadowTotal}\n` +
        `enemies ${f.enemies}  gfx ${f.qualityLabel}`;
    }
  }

  return { update };
}
