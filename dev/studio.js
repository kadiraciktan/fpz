/**
 * dev/studio.js
 * Asset Studio: dev aracı.
 * Tüm model + texture'ları GERÇEK buildModel/buildTexture pipeline'ı ile
 * oluşturur, turntable üzerinde gösterir, parça seçimi + texture preview sunar.
 *
 * Kullanım:
 *   python3 -m http.server 8080
 *   tarayıcıda: http://localhost:8080/dev/studio.html
 */
import * as THREE from 'three';
import { buildModel, buildTexture } from '../src/ModelLoader.js';
import { pistolModel } from '../models/pistol.js';
import { rifleModel } from '../models/rifle.js';
import { shotgunModel } from '../models/shotgun.js';
import { thompsonModel } from '../models/thompson.js';
import { zombieModel } from '../models/zombie.js';
import { streetLampModel } from '../models/streetlamp.js';
import { weaponTexture } from '../textures/weapon.js';
import { shotgunTexture } from '../textures/shotgun.js';
import { zombieTexture } from '../textures/zombie.js';
import { woodTexture } from '../textures/wood.js';
import { lampTexture } from '../textures/lamp.js';
import { hudRoundTexture } from '../textures/hud-round.js';

// --- Renderer / Scene / Camera ---------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f12);

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
let camRadius = 3.2;
let camTheta = 0.6; // yaw
let camPhi = 0.4;   // pitch (0 = horizontal)
let camTarget = new THREE.Vector3(0, 0.9, 0);

function updateCamera() {
  const x = camTarget.x + camRadius * Math.cos(camPhi) * Math.sin(camTheta);
  const y = camTarget.y + camRadius * Math.sin(camPhi);
  const z = camTarget.z + camRadius * Math.cos(camPhi) * Math.cos(camTheta);
  camera.position.set(x, y, z);
  camera.lookAt(camTarget);
}

// Lighting
scene.add(new THREE.HemisphereLight(0x8899bb, 0x223311, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
scene.add(keyLight);

const grid = new THREE.GridHelper(8, 16, 0x2a313c, 0x1a1f26);
scene.add(grid);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.001;
ground.receiveShadow = true;
scene.add(ground);

// --- Asset registry ----------------------------------------------------------
const ASSETS = [
  { id: 'pistol', label: 'Pistol (M1911)', model: pistolModel, texture: weaponTexture, color: '#888888', height: 0.5 },
  { id: 'rifle', label: 'Rifle (M1 Garand)', model: rifleModel, texture: weaponTexture, color: '#555555', height: 0.5 },
  { id: 'shotgun', label: 'Shotgun (M1897)', model: shotgunModel, texture: shotgunTexture, color: '#3a3a3a', height: 0.5 },
  { id: 'thompson', label: 'Thompson (M1A1)', model: thompsonModel, texture: weaponTexture, color: '#444444', height: 0.5 },
  { id: 'zombie', label: 'Zombie', model: zombieModel, texture: zombieTexture, color: '#6a5a2a', height: 1.2 },
  { id: 'streetlamp', label: 'Street Lamp', model: streetLampModel, texture: lampTexture, color: '#3d443a', height: 2.5 },
];
const TEX_ASSETS = [
  { id: 'weapon', label: 'weapon', tex: weaponTexture },
  { id: 'shotgun', label: 'shotgun', tex: shotgunTexture },
  { id: 'zombie', label: 'zombie', tex: zombieTexture },
  { id: 'wood', label: 'wood', tex: woodTexture },
  { id: 'lamp', label: 'lamp', tex: lampTexture },
  { id: 'hud-round', label: 'hud-round', tex: hudRoundTexture },
];

// --- Build all models once ---------------------------------------------------
const groups = new Map();
for (const a of ASSETS) {
  const g = buildModel(a.model, a.texture);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  groups.set(a.id, g);
}

let currentAsset = null;
let currentMesh = null;
let selectedPart = null;

function selectAsset(id) {
  // cleanup old
  if (currentMesh) {
    scene.remove(currentMesh);
  }
  selectedPart = null;
  const asset = ASSETS.find((a) => a.id === id);
  currentAsset = asset;
  currentMesh = groups.get(id);
  // recenter: compute bbox and offset so pivot sits at origin-ish
  scene.add(currentMesh);

  // highlight UI
  document.querySelectorAll('#assetList li').forEach((li) => {
    li.classList.toggle('active', li.dataset.id === id);
  });

  // Details panel
  const meta = document.getElementById('meta');
  const partsEl = document.getElementById('parts');
  const tex = asset.texture;
  meta.innerHTML = `
    <div>Name: <span>${asset.model.name || asset.id}</span></div>
    <div>Texture: <span>${tex ? tex.palette ? `sprite ${tex.size}x${tex.size}` : 'flat' : 'none'}</span></div>
    <div>Parts: <span>${asset.model.elements.length}</span></div>
    <div>Anims: <span>${asset.model.anims ? Object.keys(asset.model.anims).join(', ') : 'none'}</span></div>
  `;
  const names = asset.model.elements.map((e) => e.name).join(', ');
  partsEl.innerHTML = `<b>${names}</b>`;
  document.getElementById('metaTitle').style.display = '';
  document.getElementById('partsTitle').style.display = '';

  // Texture preview
  showTexture(asset.texture, asset.id);
}

function showTexture(texDef, label) {
  const wrap = document.getElementById('texWrap');
  const labelEl = document.getElementById('texLabel');
  if (!texDef || !texDef.palette) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  const canvas = document.getElementById('texCanvas');
  const s = texDef.size;
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(s, s);
  const palette = {};
  for (const ch of texDef.palette) palette[ch] = new THREE.Color(ch);
  for (let y = 0; y < s; y++) {
    const row = texDef.pixels[s - 1 - y]; // flip Y
    for (let x = 0; x < s; x++) {
      const hex = row[x];
      if (hex === ' ') continue;
      const c = palette[hex];
      if (!c) continue;
      const i = (y * s + x) * 4;
      img.data[i] = Math.round(c.r * 255);
      img.data[i + 1] = Math.round(c.g * 255);
      img.data[i + 2] = Math.round(c.b * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  labelEl.textContent = `${label} — ${s}×${s} px (${texDef.palette.length} colors)`;
}

// --- Sidebar build -----------------------------------------------------------
const listEl = document.getElementById('assetList');
for (const a of ASSETS) {
  const li = document.createElement('li');
  li.dataset.id = a.id;
  li.innerHTML = `<span class="swatch" style="background:${a.color}"></span>${a.label}`;
  li.addEventListener('click', () => selectAsset(a.id));
  listEl.appendChild(li);
}

// --- Interaction (turntable + orbit + pick) ----------------------------------
let dragging = false;
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('pointerup', () => (dragging = false));
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  camTheta += dx * 0.008;
  camPhi = Math.max(-0.5, Math.min(1.4, camPhi + dy * 0.008));
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camRadius = Math.max(0.3, Math.min(12, camRadius + e.deltaY * 0.003));
}, { passive: false });

// Part picking (raycast)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('click', (e) => {
  if (!currentMesh) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(currentMesh, true);
  selectedPart = null;
  if (hits.length > 0) {
    const hit = hits[0];
    // find the pivot part (named Object3D) or mesh
    let obj = hit.object;
    while (obj && obj !== currentMesh && !obj.userData.partName) obj = obj.parent;
    if (obj && obj !== currentMesh) {
      selectedPart = obj.userData.partName || obj.name || 'unknown';
    }
  }
  document.getElementById('parts').innerHTML =
    `<b>${currentAsset.model.elements.map((el) => el.name).join(', ')}</b>` +
    (selectedPart ? `<div style="color:var(--accent);margin-top:4px">Selected: <b>${selectedPart}</b></div>` : '');
});

// Toggles
document.getElementById('turntable').addEventListener('change', (e) => { turntableOn = e.target.checked; });
document.getElementById('wireframe').addEventListener('change', (e) => {
  if (!currentMesh) return;
  currentMesh.traverse((o) => {
    if (o.isMesh) o.material.wireframe = e.target.checked;
  });
});
document.getElementById('grid').addEventListener('change', (e) => {
  grid.visible = e.target.checked;
});

let turntableOn = true;

// --- Resize ------------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// --- Main loop ---------------------------------------------------------------
let lastT = performance.now();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;

  if (turntableOn && !dragging) camTheta += dt * 0.4;
  updateCamera();
  resize();
  renderer.render(scene, camera);
}

// --- Init --------------------------------------------------------------------
selectAsset('zombie');
document.getElementById('status').textContent = `${ASSETS.length} models · ${TEX_ASSETS.length} textures loaded`;
tick();
