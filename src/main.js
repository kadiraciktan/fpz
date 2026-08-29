import * as THREE from 'three';
import { createScene, flickerLights, MAPS } from './gfx/Scene.js';
import { FPSController } from './input/FPSController.js';
import { WeaponManager, createLegsMesh, ATTACHMENTS, WEAPON_DEFS, WEAPON_LABELS, DEFAULT_LOADOUT, MYSTERY_POOL } from './weapons/Weapons.js';
import { createGunsmithScreen } from './ui/gunsmith.js';
import { Enemy } from './game/Enemy.js';
import { createSandbag, createPerkMachine, markMachineSold, createWallGun, createPapMachine, retintLabelSign } from './gfx/Prefabs.js';
import { GamepadInput, GamepadMenuNav } from './input/Gamepad.js';
import { waveCount, waveParams, pickEnemyType, isBossRound, bossCount, isSprintRound, isHeadcrabRound, headcrabChance, waveIntensity } from './game/waves.js';
import { weightedPick } from './weapons/ammo.js';
import {
  DIFFICULTIES, difficultyByKey, applyDifficulty,
  PAP_COST, papLabel,
  machineSpots, wallGunSpots, wallGunNames, wallGunCost,
  BARRIER_HP, BARRIER_REPAIR_COST, barrierNeedsRepair,
} from './game/zombies.js';
import { QUALITY_PRESETS, qualityByKey } from './game/perf.js';
import { isBlockedAt } from './game/collision.js';

/**
 * main.js
 * Entry point: main menu (map + attachment selection), then the game —
 * renderer, camera, scene, player, weapons, enemy waves and the HUD.
 */

// --- Renderer ---
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;

// --- Camera (persistent across games) ---
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// Camera sees both the world (layer 0) and the gun (layer 1).
camera.layers.enable(1);

// --- Persistent DOM refs ---
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const hudScore = document.getElementById('score');
const hudHealth = document.getElementById('health');
const hudRound = document.getElementById('round');
const toastsEl = document.getElementById('toasts');
const hudGear = document.getElementById('gear');
const hudPrep = document.getElementById('prep');
const hudPerks = document.getElementById('perks');
const hudBuffs = document.getElementById('buffs');
const compassEl = document.getElementById('compass');
const compassCtx = compassEl ? compassEl.getContext('2d') : null;

// ════════════════════════════ MAIN MENU ════════════════════════════

const menuEl = document.getElementById('mainMenu');
const mapCardsEl = document.getElementById('mapCards');
const diffRowEl = document.getElementById('diffRow');

const setup = {
  mapId: 'street',
  difficulty: 'normal',
  attachments: {},
  skins: {},
};

// Attachment + skin state per weapon (all slots off / default skin),
// plus the 4-slot loadout (CoD-style: choose a weapon per slot).
for (const d of WEAPON_DEFS) {
  setup.attachments[d.name] = {};
  for (const key of Object.keys(ATTACHMENTS)) setup.attachments[d.name][key] = false;
  setup.skins[d.name] = 'default';
}
setup.loadout = [...DEFAULT_LOADOUT];

// Restore the last deployment (map / difficulty / loadout / attachments).
const SETUP_KEY = 'zombieFront.setup';
try {
  const saved = JSON.parse(localStorage.getItem(SETUP_KEY) || 'null');
  if (saved) {
    if (MAPS.some((m) => m.id === saved.mapId)) setup.mapId = saved.mapId;
    if (DIFFICULTIES.some((d) => d.key === saved.difficulty)) setup.difficulty = saved.difficulty;
    for (const [w, v] of Object.entries(saved.attachments || {})) {
      if (setup.attachments[w]) Object.assign(setup.attachments[w], v);
    }
    for (const [w, v] of Object.entries(saved.skins || {})) {
      if (setup.skins[w]) setup.skins[w] = v;
    }
    if (Array.isArray(saved.loadout) && saved.loadout.length === 4) setup.loadout = saved.loadout;
  }
} catch { /* corrupt setup blob: defaults */ }

function saveSetup() {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch { /* ignore */ }
}

// Map cards (with the per-map lifetime record line)
for (const map of MAPS) {
  const card = document.createElement('div');
  card.className = 'mapCard' + (map.id === setup.mapId ? ' selected' : '');
  card.dataset.mapId = map.id;
  card.innerHTML = `
    <div class="swatch" style="background:${map.swatch}"></div>
    <div class="mapName">${map.name}</div>
    <div class="mapDesc">${map.desc}</div>
    <div class="mapRecord" id="rec-${map.id}"></div>`;
  card.addEventListener('click', () => {
    setup.mapId = map.id;
    mapCardsEl.querySelectorAll('.mapCard').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    saveSetup();
  });
  mapCardsEl.appendChild(card);
}

// Difficulty selector cards
function buildDiffCards() {
  if (!diffRowEl) return;
  diffRowEl.innerHTML = '';
  for (const d of DIFFICULTIES) {
    const card = document.createElement('div');
    card.className = 'diffCard' + (d.key === setup.difficulty ? ' selected' : '');
    card.innerHTML = `<b style="color:${d.color}">${d.icon} ${d.label}</b><span>${d.desc}</span>`;
    card.addEventListener('click', () => {
      setup.difficulty = d.key;
      diffRowEl.querySelectorAll('.diffCard').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      saveSetup();
    });
    diffRowEl.appendChild(card);
  }
}
buildDiffCards();

// ── Gunsmith screen (extracted to src/ui/gunsmith.js; wires its own buttons) ──
createGunsmithScreen(setup, () => totalXp);

// ── Deployment transition: menu → game cinematic handoff ──
const transitionEl = document.getElementById('transition');
const trStatusEl = document.getElementById('trStatus');
const trBarEl = document.getElementById('trBarFill');
const trHintEl = document.getElementById('trHint');
let trTimers = [];

const trLater = (fn, ms) => trTimers.push(setTimeout(fn, ms));
const trClear = () => { for (const t of trTimers) clearTimeout(t); trTimers = []; };

function showTransition(mapName) {
  trClear();
  transitionEl.classList.remove('hidden', 'out');
  trHintEl.textContent = '';
  trBarEl.classList.remove('run');
  void trBarEl.offsetWidth; // restart the fill animation
  trBarEl.classList.add('run');
  const steps = [
    `HARİTA YÜKLENİYOR: ${mapName}`,
    'CEPHANE DAĞITILIYOR...',
    'SİPERLER KURULUYOR...',
    'ZOMBİLER GELİYOR...',
  ];
  steps.forEach((s, i) => trLater(() => { trStatusEl.textContent = s; }, i * 280));
}

function endTransition() {
  if (transitionEl.classList.contains('hidden')) return;
  transitionEl.classList.add('out');
  trLater(() => {
    transitionEl.classList.add('hidden');
    transitionEl.classList.remove('out');
  }, 650);
}

// Fallback: if the browser didn't auto-lock the mouse, clicking the
// transition screen requests the lock (keeps the cinematic flow).
transitionEl.addEventListener('click', () => {
  if (!transitionEl.classList.contains('hidden')) requestLock();
});

document.getElementById('startGameBtn').addEventListener('click', () => {
  saveSetup();
  const map = MAPS.find((m) => m.id === setup.mapId);
  showTransition(map ? map.name : setup.mapId);
  menuEl.classList.add('hidden');
  trLater(() => { teardownGame(); buildGame(); }, 80);
  trLater(() => requestLock(), 1100);
  trLater(() => {
    if (document.pointerLockElement !== canvas && !transitionEl.classList.contains('hidden')) {
      trHintEl.textContent = '▶ Başlamak için ekrana tıkla';
    }
  }, 2000);
});

// ════════════════════════════ GAME STATE ════════════════════════════

let scene = null;
let controller = null;
let weaponManager = null;

let enemies = [];
let round = 1;

// Distance-based shadow/light culling: distant props skip the shadow pass
// and lights beyond their reach are hidden, cutting draw calls + per-fragment
// light loops. Refreshed on a slow cadence (0.2s), not per frame.
const perfCull = { shadowCasters: [], pointLights: [], acc: 0 };

function collectPerfCullables() {
  perfCull.shadowCasters.length = 0;
  perfCull.pointLights.length = 0;
  if (!scene) return;
  const wp = _cullPos2;
  scene.traverse((o) => {
    if (o.isMesh && o.castShadow && !o.userData.isEnemy) {
      o.getWorldPosition(wp);
      o.userData._cullX = wp.x;
      o.userData._cullZ = wp.z;
      perfCull.shadowCasters.push(o);
    } else if (o.isPointLight) {
      perfCull.pointLights.push(o);
    }
  });
}

const _cullPos = new THREE.Vector3();
const _cullPos2 = new THREE.Vector3();
function updatePerfCulling() {
  if (!controller) return;
  const q = qualityByKey(opts.quality);
  const p = controller.position;
  _cullPos.set(p.x, 0, p.z);
  const shadowCutoffSq = q.shadowCutoff * q.shadowCutoff;
  for (const m of perfCull.shadowCasters) {
    const dx = (m.userData._cullX ?? m.position.x) - p.x;
    const dz = (m.userData._cullZ ?? m.position.z) - p.z;
    m.castShadow = q.shadows && (dx * dx + dz * dz) < shadowCutoffSq;
  }
  for (const l of perfCull.pointLights) {
    l.getWorldPosition(_cullPos2);
    _cullPos2.y = 0;
    const range = (l.distance || 20) + 14;
    l.visible = _cullPos2.distanceToSquared(_cullPos) < range * range;
  }
  // Zombies too: distant horde members skip the shadow pass. Re-evaluated
  // every tick so pooled (recycled) groups never come back shadowless.
  const enemyCutoffSq = q.enemyShadowCutoff * q.enemyShadowCutoff;
  for (const e of enemies) {
    const ep = e.group.position;
    const dx = ep.x - p.x, dz = ep.z - p.z;
    const near = q.shadows && (dx * dx + dz * dz) < enemyCutoffSq;
    const meshes = e._meshes;
    for (let i = 0; i < meshes.length; i++) meshes[i].castShadow = near;
  }
}
let score = 0;
let playerHealth = 100;
// Set on death: freezes the loop until the player clicks "Play Again",
// which rebuilds the run via teardownGame() + buildGame().
let pendingRestart = false;

const powerUps = [];
let instaKillUntil = 0;
let doublePointsUntil = 0;

let thompsonMesh = null;
let mysteryBox = null;
let mysteryLabel = null;
let onInteractKey = null;
// Gamepad "Y" routes here while a run is live (set by buildGame).
let interactFn = null;
// Half-extent of the playable area (from the scene) — keeps enemy spawns
// inside the perimeter walls on enclosed maps.
let arenaHalf = 45;

// ── Point-buyable map barriers (CoD zombies style): pay score to open a
// sealed zone; enemies only spawn inside zones that are already unlocked.
// The horde funnels through an opened barrier and slowly tears it back
// shut — hold the chokepoint or pay to patch it (E). ──
const barriers = []; // { mesh, collider, cost, zone, open, hp, collapsed }
const zones = []; // { id, rect: [minX, minZ, maxX, maxZ], unlocked }

// Open window waypoints (Nacht): horde pathfinding only, no repair.
const windows = [];

// ── Wall guns (point-buy mounts) + the Pack-a-Punch station ──
const wallGuns = []; // { mesh, weapon, cost, used }
let papMachine = null; // { mesh, used }
let difficulty = difficultyByKey('normal');

// ── Wave rhythm: 'prep' (build/heal) then 'active' (fight) ──
let waveState = 'active';
let prepTimer = 0;

// ── Player buildables: sandbag walls (B) + noisemakers (G, on WeaponManager) ──
let sandbagStock = 0;
const sandbags = []; // scene groups with userData.hp — zombies chew through them

// ── Perk machines (CoD zombies style): one of each per map, bought with points ──
const PERKS = [
  { key: 'speedCola', label: 'SPEED COLA', icon: '⚡', cost: 1200, color: 0x43a047, hint: '%40 daha hızlı şarjör' },
  { key: 'doubleTap', label: 'DOUBLE TAP', icon: '🎯', cost: 1500, color: 0xe53935, hint: 'x2 silah hasarı' },
  { key: 'juggerNog', label: 'JUGGER-NOG', icon: '❤️', cost: 1500, color: 0x8e24aa, hint: '+50 maksimum can' },
  { key: 'quickRevive', label: 'QUICK REVIVE', icon: '🚑', cost: 1000, color: 0x00acc1, hint: 'Ölümden bir kez döndürür' },
  { key: 'staminUp', label: 'STAMIN-UP', icon: '🏃', cost: 800, color: 0xfb8c00, hint: '+%15 yürüyüş, +%25 koşu' },
];
const machines = []; // { mesh, perk, used }
const perksHeld = {}; // owned perks for the HUD strip
let maxHealth = 100;

// ── Heartbeat / growl ambience timers ──
let beatTimer = 0;
let growlTimer = 0;

// ── Day/night cycle (light intensities from the scene) ──
const dayCycle = { t: 0, sun: null, hemi: null, ambient: null, sunBase: 0, hemiBase: 0, ambBase: 0 };

// ── Persistent progression: XP unlocks + lifetime stats (localStorage) ──
const XP_KEY = 'zombieFront.xp';
const STATS_KEY = 'zombieFront.stats';
const ATTACH_UNLOCKED = new Set();
let totalXp = 0;
let stats = { kills: 0, headshots: 0, bestRound: 0, bestScore: 0, runs: 0, bestRuns: {} };

/** Record the current run under its map+difficulty record slot. */
function recordBestRun() {
  stats.bestRuns = stats.bestRuns || {};
  const key = `${setup.mapId}:${difficulty.key}`;
  const cur = stats.bestRuns[key] || { round: 0, score: 0 };
  stats.bestRuns[key] = {
    round: Math.max(cur.round, round),
    score: Math.max(cur.score, score),
  };
}

function loadPersisted() {
  try {
    totalXp = Number(localStorage.getItem(XP_KEY)) || 0;
    stats = { ...stats, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
  } catch { /* private mode / corrupt data: start fresh */ }
  for (const [key, meta] of Object.entries(ATTACHMENTS)) {
    if (totalXp >= (meta.xp || 0)) ATTACH_UNLOCKED.add(key);
  }
}

function savePersisted() {
  try {
    localStorage.setItem(XP_KEY, String(totalXp));
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

/** Award XP and toast newly-unlocked attachments. */
function addXp(n) {
  totalXp += n;
  for (const [key, meta] of Object.entries(ATTACHMENTS)) {
    if ((meta.xp || 0) > 0 && totalXp >= meta.xp && !ATTACH_UNLOCKED.has(key)) {
      ATTACH_UNLOCKED.add(key);
      showToast(`🔓 YENİ AKSESUAR: ${meta.label}`);
    }
  }
  savePersisted();
}

loadPersisted();

// ── Player settings (pause menu): sensitivity / volume / FOV / quality ──
const OPTS_KEY = 'zombieFront.opts';
const opts = { sens: 1, volume: 0.5, fov: 75, quality: 'med' };

function loadOpts() {
  try {
    Object.assign(opts, JSON.parse(localStorage.getItem(OPTS_KEY) || '{}'));
  } catch { /* corrupt data: defaults */ }
  if (!QUALITY_PRESETS[opts.quality]) opts.quality = 'med';
}

function saveOpts() {
  try { localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
}

/** Push the settings into controller / audio / camera. Safe any time. */
function applyOpts() {
  if (controller) controller.params.mouseSensitivity = 0.002 * opts.sens;
  if (weaponManager) {
    weaponManager.hipFov = opts.fov;
    weaponManager.sfx.setVolume(opts.volume);
  }
  if (Math.abs(camera.fov - opts.fov) > 0.01 && !document.pointerLockElement) {
    camera.fov = opts.fov;
    // Safe while the pause overlay is up; in-game the ADS lerp eases to it.
    camera.updateProjectionMatrix();
  }
}

let shadowTick = 0;
/** Pixel ratio, shadow map and sun follow — live-swappable from the pause menu. */
function applyQuality() {
  const q = qualityByKey(opts.quality);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = q.shadowType === 'pcfsoft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = q.shadows && q.shadowInterval <= 1;
  if (dayCycle.sun) {
    dayCycle.sun.castShadow = q.shadows;
    if (q.shadows) {
      const sm = dayCycle.sun.shadow;
      if (sm.mapSize.x !== q.shadowMap) {
        if (sm.map) {
          sm.map.dispose();
          sm.map = null;
        }
        sm.mapSize.set(q.shadowMap, q.shadowMap);
      }
    }
  }
  if (scene && controller) updatePerfCulling();
}

function applyShadowCadence() {
  const q = qualityByKey(opts.quality);
  if (!q.shadows) {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    return;
  }
  if (q.shadowInterval <= 1) {
    renderer.shadowMap.autoUpdate = true;
    return;
  }
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = (++shadowTick % q.shadowInterval) === 0;
}

function updateSunFollow() {
  const sun = dayCycle.sun;
  if (!sun || !sun.castShadow) return;
  const q = qualityByKey(opts.quality);
  const p = controller.position;
  sun.position.set(p.x + 28, 48, p.z + 12);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
  const cam = sun.shadow.camera;
  const h = q.shadowFollow;
  if (cam.right !== h) {
    cam.left = -h;
    cam.right = h;
    cam.top = h;
    cam.bottom = -h;
    cam.updateProjectionMatrix();
  }
}

loadOpts();
applyQuality();

/** True if a ground position is inside any static obstacle (buildings, rubble...). */
function isBlocked(x, z) {
  return isBlockedAt(x, z, controller.obstacles, 0.5, 0.8);
}

/** Find a spawn point: inside an UNLOCKED zone (never through a barrier),
 *  outside buildings/rubble, and at least 8 m from the player. */
function findSpawnPos() {
  const pos = new THREE.Vector3();
  const openZones = zones.filter((z) => z.unlocked);
  for (let tries = 0; tries < 30; tries++) {
    const zone = openZones[Math.floor(Math.random() * openZones.length)] || zones[0];
    const [minX, minZ, maxX, maxZ] = zone.rect;
    const x = minX + Math.random() * (maxX - minX);
    const z = minZ + Math.random() * (maxZ - minZ);
    const dx = x - controller.position.x;
    const dz = z - controller.position.z;
    if (dx * dx + dz * dz < 64) continue;
    if (!isBlocked(x, z)) return pos.set(x, 0, z);
  }
  // Last resort: a ring around the map center — the main zone always
  // keeps that area free of obstacles, so the zombie always spawns
  // somewhere the player can reach.
  const a = Math.random() * Math.PI * 2;
  return pos.set(Math.cos(a) * 12, 0, Math.sin(a) * 12);
}

function spawnWave() {
  waveState = 'active';
  weaponManager.sfx.setMusicIntensity(waveIntensity(round));
  const boss = isBossRound(round);
  const sprint = isSprintRound(round);
  const crabs = isHeadcrabRound(round);
  gamepad.rumble(0.4, 0.6, 220);
  showToast(
    boss ? `WAVE ${round} - PATRON!`
      : sprint ? `WAVE ${round} - SPRINT DALGASI!`
        : crabs ? `WAVE ${round} - HEADCRAB İSTİLASI!`
          : `Wave ${round}`
  );
  const count = waveCount(round);
  const { hp, spd, dmg } = applyDifficulty(waveParams(round), difficulty);
  for (let i = 0; i < count; i++) {
    const pos = findSpawnPos();
    // Type mix gets nastier with the round (pure sprinters on sprint rounds,
    // a crab infestation mixed in on incursion rounds).
    const type = sprint ? 'sprinter'
      : crabs && Math.random() < headcrabChance(round) ? 'headcrab'
        : pickEnemyType(round, Math.random());
    const enemy = new Enemy(scene, pos, {
      type,
      speed: spd,
      health: hp,
      damage: dmg,
      obstacles: controller.obstacles,
      sandbags,
      barriers,
      windows,
      getPeers: () => enemies,
    });
    enemies.push(enemy);
  }
  // Boss round: heavy red elites walk in — big HP pool, big payout.
  if (boss) {
    for (let b = 0; b < bossCount(round); b++) {
      const enemy = new Enemy(scene, findSpawnPos(), {
        type: 'boss',
        speed: spd,
        health: hp,
        damage: dmg,
        obstacles: controller.obstacles,
        sandbags,
        barriers,
        windows,
        getPeers: () => enemies,
      });
      enemies.push(enemy);
    }
    weaponManager.sfx.zombieScream();
    gamepad.rumble(1, 1, 500);
  }
  weaponManager.setTargets(enemies.map(e => e.group));
}

/** Scatter one perk machine per perk on open ground, facing map center. */
function spawnPerkMachines() {
  const spots = [];
  for (const perk of PERKS) {
    for (let tries = 0; tries < 80; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 9;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) > arenaHalf - 2 || Math.abs(z) > arenaHalf - 2) continue;
      if (isBlocked(x, z)) continue;
      // Keep off the mystery box (0,0), the wall-Thompson spot (5,-11) and
      // every wall-gun / Pack-a-Punch mount placed before this loop.
      if (x * x + z * z < 9) continue;
      if ((x - 5) ** 2 + (z + 11) ** 2 < 9) continue;
      if (papMachine && (papMachine.mesh.position.x - x) ** 2 + (papMachine.mesh.position.z - z) ** 2 < 12) continue;
      if (wallGuns.some((g) => (g.mesh.position.x - x) ** 2 + (g.mesh.position.z - z) ** 2 < 8)) continue;
      if (spots.some(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 < 16)) continue;
      const mesh = createPerkMachine(perk.label, perk.cost, perk.color);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.atan2(-x, -z); // brand panel faces the center
      scene.add(mesh);
      controller.obstacles.push(mesh);
      spots.push([x, z]);
      machines.push({ mesh, perk, used: false });
      break;
    }
  }
  if (machines.length) {
    showToast(`${machines.length} perk makinesi haritada — yaklaşıp E bas`);
  }
}

/**
 * Mount the three wall guns FLUSH on real wall faces and place the
 * Pack-a-Punch station on open ground in the core zone (pure solvers in
 * game/zombies.js). Each mount offers a different weapon for points; the
 * PaP upgrades the ACTIVE gun once per run.
 */
function spawnSpecialMachines() {
  const spots = machineSpots({ zones, isBlocked, spin: (stats.runs || 0) * 0.7 });
  const names = WEAPON_DEFS.map((d) => d.name);
  const trio = wallGunNames(names, stats.runs || 0);

  // Wall guns: hug building/perimeter walls, front facing the walkable side.
  const solids = [];
  for (const o of controller.obstacles) {
    const col = o.userData.collision;
    if (col) solids.push({ x: o.position.x, z: o.position.z, sx: col.size.x, sy: col.size.y, sz: col.size.z });
  }
  const mounts = wallGunSpots(solids, {
    isBlocked,
    zoneRects: zones.filter((z) => z.unlocked).map((z) => z.rect),
    arenaHalf,
    keepOut: [[0, 0, 4], [5, -11, 4], ...(spots.pap ? [[spots.pap[0], spots.pap[1], 6]] : [])],
  });
  // Fallback: on maps with few usable wall faces, top the trio up with
  // free-standing floor mounts (facing the map center).
  for (const [wx, wz] of spots.walls) {
    if (mounts.length >= trio.length) break;
    mounts.push({ x: wx, z: wz, rotY: Math.atan2(-wx, -wz) });
  }
  mounts.forEach((m, i) => {
    const weapon = trio[i % trio.length];
    const cost = wallGunCost(i);
    const label = WEAPON_LABELS[weapon] || weapon;
    const mesh = createWallGun(label, cost);
    mesh.position.set(m.x, 0, m.z);
    mesh.rotation.y = m.rotY; // flush on the wall, front off the face
    scene.add(mesh);
    wallGuns.push({ mesh, weapon, cost, used: false });
  });
  if (spots.pap) {
    const [x, z] = spots.pap;
    const mesh = createPapMachine(PAP_COST);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.atan2(-x, -z);
    scene.add(mesh);
    controller.obstacles.push(mesh);
    papMachine = { mesh, used: false };
  }
  if (wallGuns.length || papMachine) {
    showToast('🔫 Duvarda silahlar + PACK-A-PUNCH haritada — E ile kullan');
  }
}

/** Grant a perk's effect immediately. */
function applyPerk(key) {
  if (key === 'speedCola' || key === 'doubleTap' || key === 'quickRevive') {
    weaponManager.perks[key] = true;
  } else if (key === 'juggerNog') {
    maxHealth += 50;
    playerHealth = Math.min(maxHealth, playerHealth + 50);
  } else if (key === 'staminUp') {
    controller.params.speed *= 1.15;
    controller.params.sprintSpeed *= 1.25;
  }
  perksHeld[key] = true;
  updateHUD();
}

/** Enter the between-waves build phase: refill gear and count down. */
function startPrep(seconds) {
  waveState = 'prep';
  prepTimer = seconds;
  sandbagStock = 4;
  if (weaponManager) {
    weaponManager.noisemakers = 2;
    weaponManager.grenadesReady = Math.max(weaponManager.grenadesReady, 1);
  }
  showToast(`Hazırlık: ${seconds} sn — B kum torbası · G ses bombası · H el bombası`);
  updateHUD();
}

/** Place a sandbag wall 1.4 m in front of the player (B key). */
function placeSandbag() {
  if (!scene || !document.pointerLockElement) return;
  if (sandbagStock <= 0) {
    showToast('Kum torbası kalmadı!');
    return;
  }
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const x = controller.position.x + dir.x * 1.4;
  const z = controller.position.z + dir.z * 1.4;
  if (Math.abs(x) > arenaHalf || Math.abs(z) > arenaHalf || isBlocked(x, z)) {
    showToast('Buraya kurulamaz!');
    return;
  }
  const bag = createSandbag();
  bag.position.set(x, 0, z);
  bag.userData.hp = 60;
  scene.add(bag);
  controller.obstacles.push(bag);
  sandbags.push(bag);
  sandbagStock--;
  weaponManager.sfx.reloadEnd(); // satisfying sand thud
  updateHUD();
}

// --- Power-ups (drop on kill ~25%, pick up by proximity) ---
const POWERUP_TYPES = [
  { key: 'Ammo', color: 0xffa726, label: 'CEP', weight: 30 },
  { key: 'MaxAmmo', color: 0x00ff88, label: 'MAX', weight: 10 },
  { key: 'InstaKill', color: 0xffff00, label: 'IK', weight: 14 },
  { key: 'Nuke', color: 0xffaa00, label: 'NUK', weight: 10 },
  { key: 'DoublePoints', color: 0x00ff00, label: 'x2', weight: 18 },
  { key: 'MedKit', color: 0xff5252, label: 'MED', weight: 18 },
];

function addScore(base) {
  const mult = (performance.now() < doublePointsUntil ? 2 : 1) * difficulty.scoreMul;
  score += Math.round(base * mult);
  updateHUD();
}

function spawnPowerUp(pos, forcedKey = null) {
  const t = forcedKey
    ? POWERUP_TYPES.find((p) => p.key === forcedKey)
    : weightedPick(POWERUP_TYPES);
  const mat = new THREE.MeshStandardMaterial({
    color: t.color,
    emissive: t.color,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat);
  // Zombies walk through walls while dying — nudge the drop back toward the
  // map center until it sits in open ground the player can actually reach.
  let { x, z } = pos;
  if (isBlocked(x, z)) {
    const len = Math.hypot(x, z) || 1;
    const stepX = -x / len;
    const stepZ = -z / len;
    for (let i = 0; i < 40; i++) {
      x += stepX;
      z += stepZ;
      if (!isBlocked(x, z)) break;
    }
  }
  mesh.position.set(x, 0.5, z);
  mesh.castShadow = true;
  mesh.userData.key = t.key;
  scene.add(mesh);
  powerUps.push(mesh);
}

function applyPowerUp(key) {
  const t = POWERUP_TYPES.find((p) => p.key === key);
  if (t) {
    showToast(`${t.label} Picked`);
    weaponManager.sfx.powerUp();
    gamepad.rumble(0.5, 0.7, 140);
  }
  if (key === 'MaxAmmo') {
    weaponManager.fillAllAmmo();
  } else if (key === 'Ammo') {
    weaponManager.addReserveAmmo();
  } else if (key === 'InstaKill') {
    instaKillUntil = performance.now() + 10000;
  } else if (key === 'Nuke') {
    for (let i = enemies.length - 1; i >= 0; i--) {
      enemies[i].release();
      enemies.splice(i, 1);
      addScore(400);
    }
    weaponManager.setTargets([]);
    if (enemies.length === 0 && waveState === 'active') {
      showToast('Wave Cleared');
      if (round > stats.bestRound) stats.bestRound = round;
      recordBestRun();
      savePersisted();
      round++;
      startPrep(8);
    }
  } else if (key === 'DoublePoints') {
    doublePointsUntil = performance.now() + 30000;
  } else if (key === 'MedKit') {
    playerHealth = Math.min(maxHealth, playerHealth + 40);
  }
  updateHUD();
}

// ── Explosion FX (bomber detonation): expanding additive orb ──
const fxList = [];

function spawnExplosion(pos, playSound = true) {
  if (!scene) return;
  if (playSound) weaponManager.sfx.explosion();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff9944,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), mat);
  orb.position.copy(pos).setY(0.8);
  scene.add(orb);
  fxList.push({ orb, mat, t: 0 });
}

function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i];
    f.t += dt;
    const k = f.t / 0.45;
    f.orb.scale.setScalar(1 + k * 6);
    f.mat.opacity = 0.95 * (1 - k);
    if (k >= 1) {
      scene.remove(f.orb);
      f.orb.geometry.dispose();
      f.mat.dispose();
      fxList.splice(i, 1);
    }
  }
}

// ── Directional audio helper: stereo pan (-1..1) of a world point relative
// to the camera's facing. Zombies groan from the side / behind they're on. ──
const _fwdV = new THREE.Vector3();
const _toV = new THREE.Vector3();

function audioPan(worldPos) {
  camera.getWorldDirection(_fwdV);
  _fwdV.y = 0;
  if (_fwdV.lengthSq() < 1e-6) return 0;
  _fwdV.normalize();
  _toV.copy(worldPos).sub(camera.position);
  _toV.y = 0;
  if (_toV.lengthSq() < 1e-6) return 0;
  _toV.normalize();
  // Camera right in world XZ = (-fwd.z, fwd.x)
  return THREE.MathUtils.clamp(_toV.x * -_fwdV.z + _toV.z * _fwdV.x, -1, 1);
}

/** Show a short-lived toast notification (e.g. "Wave Cleared", "MAX Picked"). */
function showToast(text) {
  if (!toastsEl) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastsEl.appendChild(el);
  // Keep the stack short; remove after the fade-out animation.
  setTimeout(() => el.remove(), 2700);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
}

function updateHUD() {
  if (hudScore) hudScore.textContent = String(score);
  if (hudHealth) hudHealth.textContent = String(Math.max(0, playerHealth));
  if (hudRound) hudRound.textContent = String(round);
  if (hudGear && weaponManager) {
    hudGear.textContent = `💣 ${weaponManager.noisemakers}  🧱 ${sandbagStock}  🧨 ${weaponManager.grenadesReady}  [G/B/H]`;
  }
  if (hudPerks) {
    const owned = PERKS.filter((p) => perksHeld[p.key]);
    hudPerks.textContent = owned.length
      ? owned.map((p) => `${p.icon} ${p.label}`).join('  ·  ')
      : '';
  }
}

// ── Buff countdown strip (insta-kill / double points / difficulty tag) ──
function updateBuffs(now) {
  if (!hudBuffs) return;
  const parts = [];
  if (difficulty.scoreMul > 1) parts.push(`${difficulty.icon} ${difficulty.label} x${difficulty.scoreMul}`);
  if (now < instaKillUntil) parts.push(`☠ INSTA-KILL ${Math.ceil((instaKillUntil - now) / 1000)}s`);
  if (now < doublePointsUntil) parts.push(`✕2 PUAN ${Math.ceil((doublePointsUntil - now) / 1000)}s`);
  const txt = parts.join('   ·   ');
  if (hudBuffs.textContent !== txt) hudBuffs.textContent = txt;
}

// ── Compass strip: world cardinals + live POI markers (box, PaP, walls,
// breached barriers) projected by bearing onto a flat ±100° ribbon. ──
const COMPASS_SPAN = (100 * Math.PI) / 180;
const CARDINALS = [[0, 'K'], [Math.PI / 2, 'D'], [Math.PI, 'G'], [-Math.PI / 2, 'B']];

function drawCompass() {
  if (!compassCtx || !controller) return;
  const w = compassEl.width;
  const h = compassEl.height;
  const ctx = compassCtx;
  ctx.clearRect(0, 0, w, h);

  camera.getWorldDirection(_fwdV);
  _fwdV.y = 0;
  if (_fwdV.lengthSq() < 1e-6) return;
  _fwdV.normalize();
  const rx = -_fwdV.z;
  const rz = _fwdV.x;
  const heading = Math.atan2(_fwdV.x, -_fwdV.z); // 0 = world north (-Z)

  // Cardinal ticks
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  for (const [a, label] of CARDINALS) {
    let d = a - heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > COMPASS_SPAN) continue;
    ctx.fillStyle = label === 'K' ? '#ef5350' : '#cfc9b5';
    ctx.fillText(label, w / 2 + (d / COMPASS_SPAN) * (w / 2), 14);
  }

  // POI dots
  const pois = [];
  if (mysteryBox) pois.push([mysteryBox.position.x, mysteryBox.position.z, '#ffee58', '?']);
  if (papMachine && !papMachine.used) {
    pois.push([papMachine.mesh.position.x, papMachine.mesh.position.z, '#ce93d8', 'P']);
  }
  for (const g of wallGuns) {
    if (!g.used) pois.push([g.mesh.position.x, g.mesh.position.z, '#90caf9', 'G']);
  }
  for (const b of barriers) {
    if (b.open && !b.collapsed && barrierNeedsRepair(b.hp)) {
      pois.push([b.mesh.position.x, b.mesh.position.z, '#ff8a65', '!']);
    }
  }
  ctx.font = 'bold 11px monospace';
  for (const [px, pz, col, label] of pois) {
    const dx = px - controller.position.x;
    const dz = pz - controller.position.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const ang = Math.atan2((dx * rx + dz * rz) / len, (dx * _fwdV.x + dz * _fwdV.z) / len);
    if (Math.abs(ang) > COMPASS_SPAN) continue;
    const x = w / 2 + (ang / COMPASS_SPAN) * (w / 2);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, h - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141410';
    ctx.fillText(label, x, h - 6);
  }
}

// ════════════════════════ BUILD / TEARDOWN ════════════════════════

function buildGame() {
  const built = createScene(setup.mapId);
  scene = built.scene;
  arenaHalf = built.arenaHalf ?? 45;

  // Zones & barriers: gated zones stay locked (and spawn-inert) until bought.
  barriers.length = 0;
  for (const b of built.barriers || []) barriers.push({ ...b, open: false, hp: BARRIER_HP, collapsed: false });
  zones.length = 0;
  for (const z of built.zones || []) zones.push({ id: z.id, rect: z.rect, unlocked: !z.gate });
  if (!zones.some((z) => z.unlocked)) {
    zones.unshift({ id: 'main', rect: [-arenaHalf, -arenaHalf, arenaHalf, arenaHalf], unlocked: true });
  }

  windows.length = 0;
  for (const w of built.windows || []) windows.push(w);

  difficulty = difficultyByKey(setup.difficulty);
  wallGuns.length = 0;
  papMachine = null;

  controller = new FPSController(camera, scene, null, canvas, {
    speed: 6,
    sprintSpeed: 10,
    jumpForce: 7,
    gravity: 20,
    eyeHeight: 1.6,
    playerRadius: 0.4,
    playerHeight: 1.8,
    mouseSensitivity: 0.002 * opts.sens,
  });
  controller.setObstacles(built.obstacles);
  camera.fov = opts.fov;
  camera.updateProjectionMatrix();
  controller.attachLegs(createLegsMesh());

  weaponManager = new WeaponManager(scene, camera, controller, {
    onEnemyHit: (enemy, isHeadshot) => {
      addScore(10);
      weaponManager.sfx.enemyHit();
    },
    onEnemyKilled: (enemy, isHeadshot) => {
      gamepad.rumble(0.25, 0.45, 70);
      addScore(Math.round(enemy.params.score * (isHeadshot ? 1.5 : 1)));
      addXp(isHeadshot ? 15 : 10);
      stats.kills++;
      if (isHeadshot) stats.headshots++;
      if (stats.kills % 5 === 0) savePersisted();
      weaponManager.sfx.enemyDeath();
      if (enemy.type === 'headcrab') weaponManager.sfx.headcrabChirp(0.3);
      else weaponManager.sfx.zombieScream();
      enemy.startDeath();
      // Remove from targets immediately so it can't be shot again
      weaponManager.setTargets(enemies.filter(e => e.alive).map(e => e.group));
      if (enemy.type === 'brute') spawnPowerUp(enemy.group.position, 'MedKit');
      else if (enemy.type === 'boss') spawnPowerUp(enemy.group.position, 'MaxAmmo');
      else if (Math.random() < 0.25) spawnPowerUp(enemy.group.position);
    },
    // Grenade throw / detonation: refresh the gear readout right away.
    onAmmoChange: () => updateHUD(),
    // Reserve ran dry — point the player at ammo crates / MAX pickups.
    onOutOfAmmo: () => {
      gamepad.rumble(0.3, 0.8, 120);
      showToast('YEDEK MERMI YOK — cephane kutusu bekle!');
    },
    // Noisemaker landed: every zombie nearby shambles over to investigate.
    onLure: (pos) => {
      let lured = 0;
      for (const e of enemies) {
        if (e.alive && !e.dying && e.group.position.distanceTo(pos) < 16) {
          e.lureAt(pos, 5);
          lured++;
        }
      }
      if (lured > 0) showToast(`${lured} zombi sesi duydu!`);
    },
    // Frag grenade detonated: AoE kill pass over the horde + self damage.
    onGrenade: (pos) => {
      spawnExplosion(pos, false); // explosion SFX already played by the thrower
      gamepad.rumble(1, 0.8, 320);
      let kills = 0;
      for (const e of enemies) {
        if (!e.alive || e.dying) continue;
        if (e.group.position.distanceTo(pos) < 5 && e.applyExplosion(pos, 5, 8)) {
          kills++;
          stats.kills++;
          addXp(5);
        }
      }
      if (kills) {
        addScore(60 * kills);
        showToast(`💣 ${kills} zombi paramparça!`);
      }
      weaponManager.setTargets(enemies.filter((e) => e.alive && !e.dying).map((e) => e.group));
      const selfD = pos.distanceTo(controller.position);
      if (selfD < 4) {
        const selfDmg = Math.max(1, Math.round(20 * (1 - selfD / 4)));
        playerHealth = Math.max(1, playerHealth - selfDmg);
        controller.addHitFlinch();
        weaponManager.sfx.playerHurt();
        gamepad.rumble(0.7, 1, 200);
        showToast('💣 Kendi bombası!');
        updateHUD();
      }
    },
  }, setup.attachments, setup.skins, setup.loadout);
  weaponManager.hipFov = opts.fov;
  weaponManager.sfx.setVolume(opts.volume);
  weaponManager.setTargets(built.targets);

  // --- Wall weapon: Thompson (E to grab, costs 1500) ---
  thompsonMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.15, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6 })
  );
  thompsonMesh.position.set(5, 1.2, -11);
  thompsonMesh.castShadow = true;
  scene.add(thompsonMesh);

  // --- Mystery box (E to open) ---
  mysteryBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
  );
  mysteryBox.position.set(0, 0.5, 0);
  mysteryBox.castShadow = true;
  scene.add(mysteryBox);

  mysteryLabel = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: (() => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');
        ctx.font = 'bold 90px sans-serif';
        ctx.fillStyle = '#ffeb3b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('??', 64, 64);
        return new THREE.CanvasTexture(c);
      })()
    })
  );
  mysteryLabel.scale.set(0.5, 0.5, 1);
  mysteryLabel.position.set(0, 1.1, 0);
  scene.add(mysteryLabel);

  onInteractKey = (e) => {
    if (e.code === 'KeyB') {
      placeSandbag();
      return;
    }
    if (e.code !== 'KeyE') return;
    interactPrimary();
  };
  interactFn = interactPrimary;
  document.addEventListener('keydown', onInteractKey);

  /** E / gamepad-Y: nearest interaction (perk → barrier → wall gun → box). */
  function interactPrimary() {
    if (!controller) return;
    // Perk machines take priority over wall purchases.
    for (const m of machines) {
      if (m.mesh.position.distanceTo(controller.position) > 2.2) continue;
      if (m.used) {
        showToast(`${m.perk.label} zaten alındı`);
        return;
      }
      if (score < m.perk.cost) {
        showToast(`Puan yetmez — ${m.perk.label}: ${m.perk.cost} puan`);
        return;
      }
      score -= m.perk.cost;
      m.used = true;
      markMachineSold(m.mesh);
      applyPerk(m.perk.key);
      weaponManager.sfx.powerUp();
      gamepad.rumble(0.5, 0.7, 160);
      showToast(`${m.perk.icon} ${m.perk.label} — ${m.perk.hint}`);
      return;
    }
    // Pack-a-Punch: upgrade the ACTIVE weapon once per run.
    if (papMachine && !papMachine.used
        && papMachine.mesh.position.distanceTo(controller.position) < 2.8) {
      const baseName = weaponManager.activeDef.name;
      if (weaponManager.papHeld.has(baseName)) {
        showToast('Bu silah zaten PACK-A-PUNCH — başka silahla gel');
        return;
      }
      if (score < PAP_COST) {
        showToast(`Puan yetmez — Pack-a-Punch: ${PAP_COST} puan`);
        return;
      }
      const upgraded = weaponManager.packAPunch();
      if (!upgraded) {
        showToast('Silah şu an yükseltilemiyor (şarjör/swap bekleyin)');
        return;
      }
      score -= PAP_COST;
      papMachine.used = true;
      retintLabelSign(papMachine.mesh.userData.sign, 'PACK-A-PUNCH', 'KULLANILDI');
      weaponManager.sfx.powerUp();
      gamepad.rumble(1, 1, 450);
      const def = WEAPON_DEFS.find((d) => d.name === upgraded);
      showToast(`⚡ PACK-A-PUNCH! ${def ? papLabel(def) : upgraded}`);
      addXp(50);
      updateHUD();
      return;
    }
    // Damaged (opened) barriers: patch them back before the horde rips them shut.
    for (const b of barriers) {
      if (!b.open || b.collapsed || !barrierNeedsRepair(b.hp)) continue;
      if (b.mesh.position.distanceTo(controller.position) > 2.8) continue;
      if (score < BARRIER_REPAIR_COST) {
        showToast(`Puan yetmez — barikat tamiri: ${BARRIER_REPAIR_COST} puan`);
        return;
      }
      score -= BARRIER_REPAIR_COST;
      b.hp = BARRIER_HP;
      weaponManager.sfx.clatter(false);
      weaponManager.sfx.powerUp();
      showToast(`🔧 Barikat onarıldı (−${BARRIER_REPAIR_COST})`);
      updateHUD();
      return;
    }
    // Map barriers: pay points to tear down and open the sealed zone.
    // A torn-down (auto-resealed) barrier can be bought again to clear the
    // rubble path — otherwise zombies stuck behind it could never be killed.
    for (const b of barriers) {
      if (b.open && !b.collapsed) continue;
      if (b.mesh.position.distanceTo(controller.position) > 2.8) continue;
      if (score < b.cost) {
        showToast(`Puan yetmez — barikat: ${b.cost} puan`);
        return;
      }
      const wasCollapsed = b.collapsed;
      score -= b.cost;
      b.open = true;
      b.collapsed = false;
      b.hp = BARRIER_HP;
      if (wasCollapsed) {
        scene.remove(b.mesh); // rubble path cleared (mesh already torn down)
      } else {
        // Knocked-down look: the frame stays as a low barrier the horde
        // will chew back down — its height reads the remaining HP.
        b.mesh.scale.y = 0.35;
        const lockSign = b.mesh.children.find((c) => c.isSprite);
        if (lockSign) lockSign.visible = false;
      }
      const oi = controller.obstacles.indexOf(b.collider);
      if (oi !== -1) controller.obstacles.splice(oi, 1);
      const zn = zones.find((z) => z.id === b.zone);
      if (zn) zn.unlocked = true;
      weaponManager.sfx.clatter(true);
      weaponManager.sfx.powerUp();
      gamepad.rumble(0.5, 0.7, 160);
      showToast(wasCollapsed
        ? `🧹 Geçit yeniden açıldı (−${b.cost})`
        : `🪵 Barikat kaldırıldı! Yeni bölge açıldı (−${b.cost})`);
      updateHUD();
      return;
    }
    // Wall-gun mounts: pay points, the gun replaces your active slot.
    for (const g of wallGuns) {
      if (g.used) continue;
      if (g.mesh.position.distanceTo(controller.position) > 2.3) continue;
      const label = WEAPON_LABELS[g.weapon] || g.weapon;
      if (score < g.cost) {
        showToast(`Puan yetmez — ${label}: ${g.cost} puan`);
        return;
      }
      score -= g.cost;
      g.used = true;
      g.mesh.userData.glowMat.emissiveIntensity = 0.05;
      g.mesh.userData.glowMat.color.setHex(0x3a3d40);
      retintLabelSign(g.mesh.userData.sign, label, 'SOLD');
      const granted = weaponManager.grantWeapon(g.weapon);
      weaponManager.sfx.powerUp();
      gamepad.rumble(0.5, 0.8, 160);
      showToast(granted ? `🔫 DUVARDAN: ${label}!` : `${label} zaten sende — mermi ikmali!`);
      updateHUD();
      return;
    }
    const thompsonDist = thompsonMesh.position.distanceTo(controller.position);
    if (thompsonDist < 2.0) {
      if (score < 1500) {
        showToast('Puan yetmez — Thompson: 1500 puan');
        return;
      }
      score -= 1500;
      updateHUD();
      const granted = weaponManager.grantWeapon('Thompson');
      scene.remove(thompsonMesh);
      showToast(granted ? 'Thompson Picked' : 'Thompson zaten sende — mermi ikmali!');
      weaponManager.sfx.powerUp();
      return;
    }
    const dist = mysteryBox.position.distanceTo(controller.position);
    if (dist < 2.0) {
      if (score < 950) {
        showToast('Puan yetmez — gizemli kutu: 950 puan');
        return;
      }
      score -= 950;
      updateHUD();
      // CoD-style loot table: all 8 guns, weighted by rarity. Paying again on
      // the same box is a reroll.
      const gift = weightedPick(MYSTERY_POOL);
      const granted = weaponManager.grantWeapon(gift.name);
      weaponManager.sfx.powerUp();
      gamepad.rumble(gift.rarity === 'EFSANE' || gift.rarity === 'NADIR' ? 0.9 : 0.5, 0.8, 220);
      showToast(
        granted
          ? `🎲 ${gift.rarity}: ${
              (WEAPON_DEFS.find((d) => d.name === granted) || weaponManager.activeDef).label
            }!`
          : `🎲 Aynısından vardı — cephane doldu (${gift.rarity})`
      );
    }
  }

  // Reset run state
  pendingRestart = false;
  stats.runs = (stats.runs || 0) + 1;
  savePersisted();
  enemies = [];
  round = 1;
  score = 0;
  playerHealth = 100;
  maxHealth = 100;
  instaKillUntil = 0;
  doublePointsUntil = 0;
  machines.length = 0;
  for (const k of Object.keys(perksHeld)) delete perksHeld[k];

  // Day/night cycle: remember the scene's base light intensities.
  dayCycle.t = 0;
  dayCycle.sun = built.lights?.sun ?? null;
  dayCycle.hemi = built.lights?.hemi ?? null;
  dayCycle.ambient = built.lights?.ambient ?? null;
  dayCycle.sunBase = dayCycle.sun ? dayCycle.sun.intensity : 0;
  dayCycle.hemiBase = dayCycle.hemi ? dayCycle.hemi.intensity : 0;
  dayCycle.ambBase = dayCycle.ambient ? dayCycle.ambient.intensity : 0;

  // Wall-gun mounts + the Pack-a-Punch station first, then perk machines
  // scattered around them (the perk spots avoid every special machine).
  spawnSpecialMachines();
  spawnPerkMachines();
  collectPerfCullables();
  applyQuality();
  if (dayCycle.sun && !dayCycle.sun.target.parent) scene.add(dayCycle.sun.target);

  // Prep phase before wave 1: build sandbags, then the front line arrives.
  startPrep(5);
  updateHUD();
}

function teardownGame() {
  if (!scene) return;
  document.removeEventListener('keydown', onInteractKey);
  onInteractKey = null;
  interactFn = null;

  if (weaponManager) {
    weaponManager.dispose();
  }
  if (controller) {
    controller.dispose();
  }

  // The gun/hands/legs are parented to the camera; drop them all so the
  // next game starts with a clean camera. The old scene (world, tracers,
  // effects) is released for GC when `scene` is reassigned.
  while (camera.children.length) camera.remove(camera.children[0]);
  weaponManager?.sfx.stopMusic();
  camera.fov = opts.fov;
  camera.updateProjectionMatrix();

  for (const e of enemies) e.release();
  enemies = [];
  powerUps.length = 0;
  for (const bag of sandbags) scene.remove(bag);
  sandbags.length = 0;
  sandbagStock = 0;
  for (const f of fxList) {
    scene.remove(f.orb);
    f.orb.geometry.dispose();
    f.mat.dispose();
  }
  fxList.length = 0;
  machines.length = 0; // meshes die with the old scene
  for (const b of barriers) if (!b.collapsed) scene.remove(b.mesh);
  barriers.length = 0;
  zones.length = 0;
  windows.length = 0;
  wallGuns.length = 0;
  papMachine = null;

  scene = null;
  controller = null;
  weaponManager = null;

  // Reset HUD & overlays
  const scopeEl = document.getElementById('scopeOverlay');
  if (scopeEl) scopeEl.classList.remove('show');
  const crossEl = document.getElementById('crosshair');
  if (crossEl) crossEl.style.display = '';
  if (hudPrep) hudPrep.textContent = '';
  if (hudBuffs) hudBuffs.textContent = '';
  if (compassCtx) compassCtx.clearRect(0, 0, compassEl.width, compassEl.height);
  overlay.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

// ════════════════════════════ POINTER LOCK ════════════════════════════

function requestLock() {
  canvas.requestPointerLock();
}

// Restart after GAME OVER: rebuild a fresh run, then lock the mouse.
function restartRun() {
  pendingRestart = false;
  teardownGame();
  buildGame();
  requestLock();
}

startBtn.addEventListener('click', () => {
  if (pendingRestart) restartRun();
  else requestLock();
});
overlay.addEventListener('click', (e) => {
  if (e.target === startBtn || e.target.id === 'menuBtn') return;
  if (e.target.closest?.('#pauseOptions')) return; // sliders must not lock the mouse
  if (pendingRestart) restartRun();
  else requestLock();
});

document.getElementById('menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  teardownGame();
  updateMenuMeta();
  menuEl.classList.remove('hidden');
});

// ── Menu meta: XP line + lifetime stats screen ──
const xpLineEl = document.getElementById('xpLine');
const statsScreenEl = document.getElementById('statsScreen');
const statsBodyEl = document.getElementById('statsBody');

function updateMenuMeta() {
  if (xpLineEl) {
    xpLineEl.textContent = `⭐ ${totalXp} XP — aksesuarlar XP ile açılır (kill: 10 · headshot: 15 · dalga: 20×N)`;
  }
  // Per-map record line: best round across difficulties (with the mode tag).
  for (const map of MAPS) {
    const el = document.getElementById(`rec-${map.id}`);
    if (!el) continue;
    const entries = Object.entries(stats.bestRuns || {}).filter(([k]) => k.startsWith(`${map.id}:`));
    if (!entries.length) {
      el.textContent = 'Henüz kayıt yok';
      continue;
    }
    let best = { round: 0, score: 0, key: '' };
    for (const [k, v] of entries) {
      if (v.round > best.round) best = { ...v, key: k.split(':')[1] };
    }
    const diff = difficultyByKey(best.key);
    el.textContent = `🏆 Rekor: ${best.round}. tur · ${best.score} puan (${diff.label})`;
  }
}

function showStats() {
  if (!statsBodyEl || !statsScreenEl) return;
  const hsPct = stats.kills ? Math.round((stats.headshots / stats.kills) * 100) : 0;
  const runRows = Object.entries(stats.bestRuns || {}).map(([k, v]) => {
    const [mapId, dKey] = k.split(':');
    const map = MAPS.find((m) => m.id === mapId);
    const diff = difficultyByKey(dKey);
    return `<div class="statRow"><span>${map ? map.name : mapId} · ${diff.icon} ${diff.label}</span><b>${v.round}. tur · ${v.score} p</b></div>`;
  }).join('');
  statsBodyEl.innerHTML = `
    <div class="statRow"><span>Toplam Kill</span><b>${stats.kills}</b></div>
    <div class="statRow"><span>Headshot</span><b>${stats.headshots} (%${hsPct})</b></div>
    <div class="statRow"><span>En İyi Tur</span><b>${stats.bestRound}</b></div>
    <div class="statRow"><span>En Yüksek Skor</span><b>${stats.bestScore}</b></div>
    <div class="statRow"><span>Toplam XP</span><b>${totalXp}</b></div>
    <div class="statRow"><span>Toplam Koşu</span><b>${stats.runs || 0}</b></div>
    ${runRows}`;
  statsScreenEl.classList.remove('hidden');
}

updateMenuMeta();

const statsBtn = document.getElementById('statsBtn');
if (statsBtn) statsBtn.addEventListener('click', showStats);
document.getElementById('statsCloseBtn')?.addEventListener('click', () => {
  statsScreenEl.classList.add('hidden');
});
document.getElementById('statsResetBtn')?.addEventListener('click', () => {
  stats = { kills: 0, headshots: 0, bestRound: 0, bestScore: 0, runs: 0, bestRuns: {} };
  totalXp = 0;
  ATTACH_UNLOCKED.clear();
  for (const [key, meta] of Object.entries(ATTACHMENTS)) {
    if ((meta.xp || 0) === 0) ATTACH_UNLOCKED.add(key);
  }
  savePersisted();
  updateMenuMeta();
  showStats();
});

// ── Pause settings: sensitivity / volume / FOV sliders ──
const pausePanel = document.getElementById('pauseOptions');
const optSensEl = document.getElementById('optSens');
const optVolEl = document.getElementById('optVol');
const optFovEl = document.getElementById('optFov');
const optSensVal = document.getElementById('optSensVal');
const optVolVal = document.getElementById('optVolVal');
const optFovVal = document.getElementById('optFovVal');
const optQualityEl = document.getElementById('optQuality');
const optQualityVal = document.getElementById('optQualityVal');

function syncPauseOptions() {
  if (!pausePanel) return;
  optSensEl.value = opts.sens;
  optVolEl.value = opts.volume;
  optFovEl.value = opts.fov;
  optSensVal.textContent = `${Math.round(opts.sens * 100)}%`;
  optVolVal.textContent = `${Math.round(opts.volume * 100)}%`;
  optFovVal.textContent = `${Math.round(opts.fov)}°`;
  const q = qualityByKey(opts.quality);
  if (optQualityVal) optQualityVal.textContent = q.label;
  if (optQualityEl) {
    optQualityEl.querySelectorAll('.qualBtn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.quality === q.key);
    });
  }
}

if (pausePanel) {
  optSensEl.addEventListener('input', () => { opts.sens = Number(optSensEl.value); applyOpts(); syncPauseOptions(); saveOpts(); });
  optVolEl.addEventListener('input', () => { opts.volume = Number(optVolEl.value); applyOpts(); syncPauseOptions(); saveOpts(); });
  optFovEl.addEventListener('input', () => { opts.fov = Number(optFovEl.value); applyOpts(); syncPauseOptions(); saveOpts(); });
  optQualityEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.qualBtn');
    if (!btn || !QUALITY_PRESETS[btn.dataset.quality]) return;
    opts.quality = btn.dataset.quality;
    applyQuality();
    syncPauseOptions();
    saveOpts();
  });
}
syncPauseOptions();

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    overlay.classList.add('hidden');
    endTransition();
    // Unlock audio (user gesture) and start the low war ambience.
    weaponManager?.sfx.unlock();
    weaponManager?.sfx.startAmbience();
    weaponManager?.sfx.startMusic(waveIntensity(round));
  } else {
    if (scene && !pendingRestart) {
      overlay.querySelector('h1').textContent = 'FPZ';
      overlay.querySelector('p').textContent = 'Duraklatıldı — devam etmek için tıkla.';
      startBtn.textContent = '▶ Devam Et';
      syncPauseOptions();
      pausePanel?.classList.remove('hidden');
    }
    if (scene) overlay.classList.remove('hidden');
    if (pendingRestart) pausePanel?.classList.add('hidden');
    if (weaponManager) weaponManager._firing = false;
  }
});

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const q = qualityByKey(opts.quality);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main loop ---
/** Headless-test mode: keep ticking without pointer lock (?fpzDebug=1). */
const DEBUG_UNPAUSED = /[?&]fpzDebug/.test(location.search) || !!window.__fpzDebug;
const gamepad = new GamepadInput();
const menuNav = new GamepadMenuNav(gamepad);
const clock = new THREE.Clock();

// ── Gamepad plug/unplug notifications ──
window.addEventListener('gamepadconnected', (e) => {
  const name = (e.gamepad && e.gamepad.id ? e.gamepad.id : '').split('(')[0].trim() || 'Gamepad';
  gamepad.lastPad = e.gamepad;
  gamepad.rumble(0.3, 0.5, 150);
  showToast(`🎮 Bağlandı: ${name}`);
});
window.addEventListener('gamepaddisconnected', () => {
  const left = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  showToast(left.length ? `🎮 Gamepad çıkarıldı — kalan: ${left.length}` : '🎮 Gamepad bağlantısı kesildi');
});

/** Two-pass render: world (layer 0), then viewmodel over a cleared depth. */
function renderWorld() {
  // Accumulate stats across both passes (renderer.info resets per render()).
  renderer.info.reset();
  camera.layers.set(0);
  renderer.render(scene, camera);
  // The gun must never be occluded by / embedded into walls, so the
  // viewmodel pass clears the depth buffer first.
  renderer.clearDepth();
  camera.layers.set(1);
  renderer.autoClear = false;
  const prevBackground = scene.background;
  scene.background = null;
  renderer.render(scene, camera);
  scene.background = prevBackground;
  renderer.autoClear = true;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  perfCull.acc += dt;
  if (perfCull.acc >= 0.2) {
    perfCull.acc = 0;
    updatePerfCulling();
  }

  // Menu is up: nothing to render (the menu's CSS background shows) —
  // but the menus themselves are gamepad-navigable.
  if (!scene) {
    menuNav.update(dt);
    return;
  }

  // Gamepad polling runs even while paused: Start toggles the pointer lock
  // (and restarts a finished run), so a controller can drive everything.
  gamepad.update(dt, {
    controller,
    weaponManager,
    onInteract: () => {
      if (interactFn && document.pointerLockElement === canvas) interactFn();
    },
    onPause: () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      else if (scene && pendingRestart) restartRun();
      else if (scene) requestLock();
    },
  });

  // True pause: pause overlay is up (pointer released) with a live run —
  // show the frozen world but tick nothing. Debug runs (?fpzDebug=1) skip
  // the freeze so the loop runs headlessly without a pointer lock.
  if (document.pointerLockElement !== canvas && !pendingRestart && !DEBUG_UNPAUSED) {
    renderWorld();
    return;
  }

  controller.update(dt);
  weaponManager.update(dt);
  updateFx(dt);
  applyShadowCadence();
  updateSunFollow();

  // Flickering bunker lamps (base intensity ~14; flicker around 60-110%)
  for (const pl of flickerLights) {
    if (!pl.visible) continue;
    pl.intensity = 14 * (0.6 + Math.random() * 0.5 + Math.sin(performance.now() * 0.01 + pl.userData.flickerSeed) * 0.15);
  }

  const now = performance.now();
  drawCompass();
  updateBuffs(now);
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.rotation.y += dt * 2;
    p.position.y = 0.5 + Math.sin(now * 0.003 + i) * 0.1;
    if (p.position.distanceTo(controller.position) < 1.5) {
      applyPowerUp(p.userData.key);
      scene.remove(p);
      powerUps.splice(i, 1);
    }
  }

  // Day/night breathing: sun/hemi/ambient pulse slowly over ~3 minutes.
  dayCycle.t += dt;
  const dayK = 0.72 + 0.28 * Math.sin(dayCycle.t * 0.03);
  if (dayCycle.sun) dayCycle.sun.intensity = dayCycle.sunBase * dayK;
  if (dayCycle.hemi) dayCycle.hemi.intensity = dayCycle.hemiBase * dayK;
  if (dayCycle.ambient) dayCycle.ambient.intensity = dayCycle.ambBase * (0.85 + 0.15 * dayK);

  // Prep phase countdown (build / heal time between waves).
  if (waveState === 'prep') {
    prepTimer -= dt;
    if (hudPrep) hudPrep.textContent = `SONRAKİ DALGA: ${Math.max(1, Math.ceil(prepTimer))}`;
    if (prepTimer <= 0) {
      if (hudPrep) hudPrep.textContent = '';
      spawnWave();
      updateHUD();
    }
  }

  // Opened barriers the horde has torn back shut: reseal the zone.
  // The knocked-down frame visibly sags as its HP drains.
  for (const b of barriers) {
    if (!b.open || b.collapsed) continue;
    b.mesh.scale.y = 0.35 * THREE.MathUtils.clamp(b.hp / BARRIER_HP, 0.2, 1);
    if (b.hp > 0) continue;
    b.collapsed = true;
    scene.remove(b.mesh);
    controller.obstacles.push(b.collider);
    const zn = zones.find((z) => z.id === b.zone);
    if (zn) zn.unlocked = false;
    weaponManager.sfx.clatter(true);
    gamepad.rumble(0.8, 1, 300);
    showToast('⚠ Barikat yırtıldı! Bölge yeniden mühürlendi');
  }

  // Sandbags the zombies have chewed through collapse.
  for (let i = sandbags.length - 1; i >= 0; i--) {
    const bag = sandbags[i];
    if (bag.userData.hp <= 0) {
      scene.remove(bag);
      const oi = controller.obstacles.indexOf(bag);
      if (oi !== -1) controller.obstacles.splice(oi, 1);
      sandbags.splice(i, 1);
      weaponManager.sfx.clatter(true);
      showToast('Kum torbası yıkıldı!');
    }
  }

  // Occasional growl from the nearest zombie (distance-attenuated).
  growlTimer -= dt;
  if (growlTimer <= 0) {
    growlTimer = 2.5 + Math.random() * 3;
    let nearest = null;
    let nearD = 22;
    for (const e of enemies) {
      if (!e.alive || e.dying) continue;
      const d = e.group.position.distanceTo(controller.position);
      if (d < nearD) { nearD = d; nearest = e; }
    }
    if (nearest) {
      const vol = THREE.MathUtils.clamp(0.35 * (1 - nearD / 22), 0.05, 0.35);
      const pan = audioPan(nearest.group.position);
      if (nearest.type === 'headcrab') weaponManager.sfx.headcrabChirp(vol, pan);
      else weaponManager.sfx.zombieGrowl(vol, pan);
    }
  }

  // Critical-HP heartbeat: thump + red vignette pulse.
  if (playerHealth < 30 && playerHealth > 0 && waveState === 'active') {
    beatTimer -= dt;
    if (beatTimer <= 0) {
      beatTimer = THREE.MathUtils.lerp(1.0, 0.45, 1 - playerHealth / 30);
      weaponManager.sfx.heartbeat();
      const hbEl = document.getElementById('damage');
      if (hbEl) {
        hbEl.classList.remove('show');
        void hbEl.offsetWidth;
        hbEl.classList.add('show');
      }
    }
  } else {
    beatTimer = 0;
  }

  if (enemies.length) Enemy.prepareFrame(enemies, controller.obstacles);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.dying) {
      // Advance the death animation so it actually plays and deathDone
      // can become true (update() is a no-op AI-wise while dying).
      enemy.update(dt, controller.position);
      if (enemy.deathDone) {
        enemy.release();
        enemies.splice(i, 1);
        weaponManager.setTargets(enemies.map(e => e.group));
        if (enemies.length === 0 && waveState === 'active') {
          // NOTE: uncollected power-ups must NOT gate the wave — they can
          // drop inside a building where the player can't reach them.
          showToast('Wave Cleared');
          gamepad.rumble(0.5, 0.8, 250);
          addXp(20 * round);
          if (round > stats.bestRound) stats.bestRound = round;
          recordBestRun();
          savePersisted();
          round++;
          updateHUD();
          startPrep(8);
        }
      }
      continue;
    }
    const dmg = enemy.update(dt, controller.position);
    if (enemy.exploded) {
      // Bomber went off: FX + AoE on nearby zombies, blast damage below.
      spawnExplosion(enemy.group.position.clone());
      for (const other of enemies) {
        if (other !== enemy && other.alive && !other.dying &&
            other.group.position.distanceTo(enemy.group.position) < 4) {
          other.takeDamage(999);
        }
      }
      weaponManager.setTargets(enemies.filter(e => e !== enemy && e.alive).map(e => e.group));
      enemy.release();
      enemies.splice(i, 1);
    }
    if (dmg > 0) {
      playerHealth -= dmg;
      // Hit feedback: camera flinch + red vignette flash
      controller.addHitFlinch();
      const dmgEl = document.getElementById('damage');
      if (dmgEl) {
        dmgEl.classList.remove('show');
        void dmgEl.offsetWidth;
        dmgEl.classList.add('show');
      }
      weaponManager.sfx.playerHurt();
      gamepad.rumble(0.6, 1, 180);
      updateHUD();
      if (playerHealth <= 0) {
        if (weaponManager.perks.quickRevive) {
          // Consume Quick Revive: come back fighting instead of dying.
          weaponManager.perks.quickRevive = false;
          playerHealth = 50;
          showToast('🚑 QUICK REVIVE!');
          weaponManager.sfx.powerUp();
          updateHUD();
        } else {
          // Freeze the run: clear the field and wait for "Play Again",
          // which rebuilds everything via restartRun().
          pendingRestart = true;
          if (score > stats.bestScore) stats.bestScore = score;
          if (round > stats.bestRound) stats.bestRound = round;
          recordBestRun();
          savePersisted();
          for (const e of enemies) e.release();
          enemies = [];
          weaponManager.setTargets([]);
          overlay.classList.remove('hidden');
          overlay.querySelector('h1').textContent = 'GAME OVER';
          overlay.querySelector('p').textContent = `Skor: ${score} · Tur: ${round}`;
          startBtn.textContent = '↻ Tekrar Oyna';
          pausePanel?.classList.add('hidden');
          gamepad.rumble(1, 1, 700);
          document.exitPointerLock();
        }
      }
    }
  }

  renderWorld();
  updatePerfHud(dt);
}

// ── Perf HUD (F3): fps + draw calls + triangles + live light/shadow counts ──
const perfHud = {
  el: null, on: /[?&]fpzPerf/.test(location.search), acc: 0, frames: 0, fps: 0,
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    if (e.shiftKey && scene) dumpSceneBreakdown();
    else {
      perfHud.on = !perfHud.on;
      if (perfHud.el) perfHud.el.style.display = perfHud.on ? 'block' : 'none';
    }
  }
});
/** Shift+F3: console breakdown of visible meshes per top-level scene child. */
function dumpSceneBreakdown() {
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
function updatePerfHud(dt) {
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
    const visLights = perfCull.pointLights.filter((l) => l.visible).length;
    const visShadowCasters = perfCull.shadowCasters.filter((m) => m.castShadow).length;
    perfHud.el.textContent =
      `FPS ${perfHud.fps}\n` +
      `draw calls ${info.calls}  tris ${info.triangles}\n` +
      `lights ${visLights}/${perfCull.pointLights.length}  shadowMESH ${visShadowCasters}/${perfCull.shadowCasters.length}\n` +
      `enemies ${enemies.length}  gfx ${qualityByKey(opts.quality).label}`;
  }
}

animate();

// Debug/test hook: read-only view of the live run (also handy in the
// browser console). Never written to from gameplay code.
window.__fpz = {
  get state() {
    return {
      scene: !!scene,
      round,
      score,
      health: playerHealth,
      enemies: enemies.length,
      alive: enemies.filter((e) => e.alive && !e.dying).length,
      barriers: barriers.map((b) => ({ zone: b.zone, open: b.open, hp: Math.round(b.hp), collapsed: !!b.collapsed, x: b.mesh.position.x, z: b.mesh.position.z })),
      wallGuns: wallGuns.map((g) => ({ weapon: g.weapon, used: g.used, x: g.mesh.position.x, z: g.mesh.position.z })),
      pap: papMachine ? { used: papMachine.used, x: papMachine.mesh.position.x, z: papMachine.mesh.position.z } : null,
      papHeld: weaponManager ? [...weaponManager.papHeld] : [],
      grenadesReady: weaponManager ? weaponManager.grenadesReady : 0,
      difficulty: difficulty.key,
      player: controller ? { x: controller.position.x, z: controller.position.z } : null,
    };
  },
  stats: () => stats,
  obstacles: () => (controller
    ? controller.obstacles
      .filter((o) => o.userData.collision)
      .map((o) => ({
        x: o.position.x, z: o.position.z,
        sx: o.userData.collision.size.x, sy: o.userData.collision.size.y, sz: o.userData.collision.size.z,
      }))
    : []),
  teleport(x, z) {
    if (controller) {
      controller.position.set(x, controller.position.y, z);
      camera.position.set(x, 1.6, z);
    }
  },
};
