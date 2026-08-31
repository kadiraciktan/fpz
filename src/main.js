import * as THREE from 'three';
import { createScene, flickerLights, MAPS } from './gfx/Scene.js';
import { FPSController } from './input/FPSController.js';
import { WeaponManager, createLegsMesh, WEAPON_DEFS } from './weapons/Weapons.js';
import { createGunsmithScreen } from './ui/gunsmith.js';
import { Enemy } from './game/Enemy.js';
import { createSandbag } from './gfx/Prefabs.js';
import { GamepadInput, GamepadMenuNav } from './input/Gamepad.js';
import { waveCount, waveParams, pickEnemyType, isBossRound, bossCount, isSprintRound, isHeadcrabRound, headcrabChance, waveIntensity } from './game/waves.js';
import {
  difficultyByKey, applyDifficulty,
  BARRIER_HP, barrierNeedsRepair,
  DOWNED_DURATION, DOWNED_REVIVE_HP, DOWNED_BITE_BLEED, extendDowned, downedBar,
  CARPET_BOMBS, CARPET_DURATION, CARPET_MIN_R, CARPET_MAX_R, CARPET_BLAST_RADIUS, CARPET_BLAST_DAMAGE,
} from './game/zombies.js';
import { SPECIAL_AMMO, pickChainTargets } from './game/ammoTypes.js';
import { createRain, rollWeather, rainDrops } from './game/weather.js';
import { BloodDecals } from './gfx/BloodDecals.js';
import { QUALITY_PRESETS, qualityByKey } from './game/perf.js';
import { isBlockedAt } from './game/collision.js';
import { restartCssAnim } from './ui/util.js';
import { disposeSceneAssets } from './gfx/dispose.js';
import { showToast } from './ui/toast.js';
import { createTransition } from './ui/transition.js';
import { createMainMenu } from './ui/mainMenu.js';
import { createMenuStats } from './ui/menuStats.js';
import { createPauseOptions } from './ui/pauseOptions.js';
import { createHud } from './ui/hud.js';
import { createScorePopups } from './ui/scorePopups.js';
import { createPerfHud } from './ui/perfHud.js';
import { setup, saveSetup } from './game/setup.js';
import { totalXp, stats, loadProgress, saveProgress, addXp, recordBestRun } from './game/progress.js';
import { PERKS } from './game/perks.js';
import { powerUpType, spawnPowerUp } from './game/powerups.js';
import { createFx } from './game/fx.js';
import { collectShadowCasters, updateShadowCulling, createLightPool } from './game/perfCull.js';
import { createDayNight, driveWeather } from './game/sky.js';
import { Spawner } from './game/spawns.js';
import { createInteractions } from './game/interactions.js';
import {
  DRONE_STOCK, DRONE_MAX_CARRIED, DRONE_BLAST_RADIUS, DRONE_BLAST_DAMAGE,
  launchDrone, updateDrones,
} from './game/drones.js';

/**
 * main.js
 * Entry point / orchestrator: renderer, run lifecycle (build / teardown),
 * wave rhythm and the game loop. Menus, HUD, persistence, FX, spawn
 * placement and the E-interaction chain live in focused modules under
 * src/ui and src/game.
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
const menuEl = document.getElementById('mainMenu');

// --- Input ---
const gamepad = new GamepadInput();
const menuNav = new GamepadMenuNav(gamepad);

// --- HUD (pure view; main passes state snapshots in — see ui/hud.js) ---
const hud = createHud();
const scorePopups = createScorePopups();

// ════════════════════════════ MAIN MENU ════════════════════════════

loadProgress(); // XP / lifetime stats (live bindings in game/progress.js)
createMainMenu(); // map + difficulty cards (selection state in game/setup.js)
createGunsmithScreen(setup, () => totalXp);
const menuStats = createMenuStats();

// ── Deployment transition: menu → game cinematic handoff ──
const transition = createTransition(() => requestLock());

document.getElementById('startGameBtn').addEventListener('click', () => {
  saveSetup();
  const map = MAPS.find((m) => m.id === setup.mapId);
  transition.show(map ? map.name : setup.mapId);
  menuEl.classList.add('hidden');
  transition.later(() => { teardownGame(); buildGame(); }, 80);
  transition.later(() => requestLock(), 1100);
  transition.later(() => {
    if (document.pointerLockElement !== canvas && !transition.isHidden()) {
      transition.setHint('▶ Başlamak için ekrana tıkla');
    }
  }, 2000);
});

// ════════════════════════════ GAME STATE ════════════════════════════

let scene = null;
let controller = null;
let weaponManager = null;
let spawner = null;

let enemies = [];
let round = 1;
let score = 0;
let playerHealth = 100;
let maxHealth = 100;
// Set on death: freezes the loop until the player clicks "Play Again",
// which rebuilds the run via teardownGame() + buildGame().
let pendingRestart = false;

const powerUps = [];
let instaKillUntil = 0;
let doublePointsUntil = 0;

// ── Downed / last stand: instead of instant death the player crawls with a
// bleed-out bar. Kills extend it; surviving the whole bar stands you back
// up. Zombie bites eat the bar directly. ──
const downed = { active: false, t: 0 };

// ── Carpet bombing drop-in progress ({ dropped, step, n } or null) ──
let carpet = null;

// ── Weather (outdoor maps only): pure state machine + one Points column ──
const weather = { enabled: false, state: 'clear', rain: null, fog: null, flashT: 0, boltT: 0 };

// Ground blood pools (pooled ring buffer — zero allocation per kill).
let bloodDecals = null;

let thompsonMesh = null;
let mysteryBox = null;
let mysteryLabel = null;
let onInteractKey = null;
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

// ── Special abilities: X cycles the selection, F fires it. Drones are the
// hand-launched kamikaze quadrotors (game/drones.js); carpet and cephane
// ride the existing power-up effects with their own prep-restocked stock. ──
const ABILITIES = [
  { id: 'drone', icon: '🛸', label: 'KAMİKAZE DRONE', short: 'Drone' },
  { id: 'carpet', icon: '✈️', label: 'HALI BOMBARDIMANI', short: 'Hali' },
  { id: 'maxammo', icon: '📦', label: 'CEPHANE İKMALİ', short: 'Ikmal' },
];
const ABILITY_CAP = { drone: DRONE_MAX_CARRIED, carpet: 2, maxammo: 2 };
let abilityIndex = 0;
const abilityStock = { drone: 0, carpet: 0, maxammo: 0 };
const drones = []; // live quadrotors — see game/drones.js

// ── Perk machines (CoD zombies style): one of each per map, bought with points ──
const machines = []; // { mesh, perk, used }
const perksHeld = {}; // owned perks for the HUD strip

// ── Heartbeat / growl ambience timers ──
let beatTimer = 0;
let growlTimer = 0;

// ── Render-perf helpers (game/perfCull.js, game/sky.js, game/fx.js) ──
// Distance-based shadow culling: distant props skip the shadow pass.
// Refreshed on a slow cadence (0.2s), not per frame.
const perfCull = { shadowCasters: [], acc: 0 };
const lightPoolCtl = createLightPool();
const dayNight = createDayNight();
const dn = dayNight.state;
const fx = createFx();

// ════════════════════════ SETTINGS / QUALITY ════════════════════════

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

/** Pixel ratio, shadow map and sun follow — live-swappable from the pause menu. */
function applyQuality() {
  const q = qualityByKey(opts.quality);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = q.shadowType === 'pcfsoft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = q.shadows && q.shadowInterval <= 1;
  const sun = dn.sun;
  if (sun) {
    sun.castShadow = q.shadows;
    if (q.shadows) {
      const sm = sun.shadow;
      if (sm.mapSize.x !== q.shadowMap) {
        if (sm.map) {
          sm.map.dispose();
          sm.map = null;
        }
        sm.mapSize.set(q.shadowMap, q.shadowMap);
      }
    }
  }
  if (scene && controller) {
    lightPoolCtl.setSize(q.pointPool || 5);
    updatePerfCulling();
  }
}

let shadowTick = 0;
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

function collectPerfCullables() {
  perfCull.shadowCasters = scene ? collectShadowCasters(scene) : [];
}

function updatePerfCulling() {
  if (!controller) return;
  updateShadowCulling(perfCull.shadowCasters, enemies, controller.position, qualityByKey(opts.quality));
}

loadOpts();
applyQuality();

// ── Pause settings UI: sensitivity / volume / FOV sliders + quality ──
const pause = createPauseOptions(opts, { applyOpts, applyQuality, saveOpts });

/** True if a ground position is inside any static obstacle (buildings, rubble...). */
function isBlocked(x, z) {
  return isBlockedAt(x, z, controller.obstacles, 0.5, 0.8);
}

// ── HUD refresh helpers (the actual DOM work lives in ui/hud.js) ──
// Ability snapshot for the bottom-right rack (cards are cached in hud.js).
const abilityView = ABILITIES.map((a) => ({ ...a, stock: 0 }));

function updateHUD() {
  for (const v of abilityView) v.stock = abilityStock[v.id];
  hud.setAbilities(abilityView, abilityIndex);
  hud.update({
    score,
    health: playerHealth,
    maxHealth,
    round,
    gear: weaponManager
      ? `💣 ${weaponManager.noisemakers}  🧱 ${sandbagStock}  🧨 ${weaponManager.grenadesReady}  [G/B/H]`
      : undefined,
    perksHeld,
  });
}

function updateBuffs(now) {
  let weatherTag = '';
  if (weather.enabled && weather.state === 'storm') weatherTag = '⛈ FIRTINA';
  else if (weather.enabled && weather.state === 'rain') weatherTag = '🌧 YAĞMUR';
  hud.updateBuffs({
    difficultyTag: difficulty.scoreMul > 1 ? `${difficulty.icon} ${difficulty.label} x${difficulty.scoreMul}` : '',
    weatherTag,
    instaKillUntil,
    doublePointsUntil,
    now,
  });
}

/** Hand the live POIs (box, PaP, wall guns, breached barriers) to the
 *  compass ribbon. */
function drawCompass() {
  if (!controller) return;
  hud.beginPois();
  if (mysteryBox) hud.pushPoi(mysteryBox.position.x, mysteryBox.position.z, '#ffee58', '?');
  if (papMachine && !papMachine.used) {
    hud.pushPoi(papMachine.mesh.position.x, papMachine.mesh.position.z, '#ce93d8', 'P');
  }
  for (const g of wallGuns) {
    if (!g.used) hud.pushPoi(g.mesh.position.x, g.mesh.position.z, '#90caf9', 'G');
  }
  for (const b of barriers) {
    if (b.open && !b.collapsed && barrierNeedsRepair(b.hp)) {
      hud.pushPoi(b.mesh.position.x, b.mesh.position.z, '#ff8a65', '!');
    }
  }
  hud.drawCompass(camera, controller.position);
}

// ════════════════════════════ WAVES / LOOT ════════════════════════════

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
  const enemyOptions = (type) => ({
    type,
    speed: spd,
    health: hp,
    damage: dmg,
    obstacles: controller.obstacles,
    sandbags,
    barriers,
    windows,
    getPeers: () => enemies,
    // Boss-only hooks (harmless on normal types): reinforcements + roars.
    onSummon: bossSummon,
    onBossRoar: () => { weaponManager.sfx.bossRoar(); gamepad.rumble(0.8, 0.9, 300); },
  });
  for (let i = 0; i < count; i++) {
    const pos = spawner.findSpawnPos();
    // Type mix gets nastier with the round (pure sprinters on sprint rounds,
    // a crab infestation mixed in on incursion rounds).
    const type = sprint ? 'sprinter'
      : crabs && Math.random() < headcrabChance(round) ? 'headcrab'
        : pickEnemyType(round, Math.random());
    const enemy = new Enemy(scene, pos, enemyOptions(type));
    enemies.push(enemy);
  }
  // Boss round: heavy red elites walk in — big HP pool, big payout.
  if (boss) {
    for (let b = 0; b < bossCount(round); b++) {
      const enemy = new Enemy(scene, spawner.findSpawnPos(), enemyOptions('boss'));
      enemies.push(enemy);
    }
    weaponManager.sfx.zombieScream();
    gamepad.rumble(1, 1, 500);
  }
  weaponManager.setTargets(enemies.map(e => e.group));
}

/** A boss calls in 2 sprinters at its feet; capped so summons never flood. */
function bossSummon(pos) {
  const sprinters = enemies.reduce((n, e) => n + (e.type === 'sprinter' && e.alive && !e.dying ? 1 : 0), 0);
  if (sprinters >= 6) return;
  const { hp, spd, dmg } = applyDifficulty(waveParams(round), difficulty);
  for (let i = 0; i < 2; i++) {
    const p = spawner.findSpawnPosNear(pos);
    const e = new Enemy(scene, p, {
      type: 'sprinter', speed: spd, health: hp, damage: dmg,
      obstacles: controller.obstacles, sandbags, barriers, windows,
      getPeers: () => enemies,
    });
    enemies.push(e);
    weaponManager.setTargets(enemies.map((x) => x.group));
  }
  showToast('☠ Boss takviye çağırdı!');
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
  abilityStock.drone = Math.min(ABILITY_CAP.drone, abilityStock.drone + DRONE_STOCK);
  abilityStock.carpet = Math.min(ABILITY_CAP.carpet, abilityStock.carpet + 1);
  abilityStock.maxammo = Math.min(ABILITY_CAP.maxammo, abilityStock.maxammo + 1);
  if (weaponManager) {
    weaponManager.noisemakers = 2;
    weaponManager.grenadesReady = Math.max(weaponManager.grenadesReady, 1);
  }
  showToast(`Hazırlık: ${seconds} sn — B kum torbası · G ses bombası · H el bombası · X özellik seç · F kullan`);
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

/** X: cycle the selected special ability (F fires it). */
function cycleAbility() {
  if (!scene || !document.pointerLockElement) return;
  abilityIndex = (abilityIndex + 1) % ABILITIES.length;
  const a = ABILITIES[abilityIndex];
  weaponManager.sfx.reloadStart(); // soft UI blip
  showToast(`➡️ ÖZEL: ${a.icon} ${a.label} (${abilityStock[a.id]}) — F ile kullan`);
  updateHUD();
}

/** F: fire the selected ability — drone launch, carpet strike or resupply. */
function useAbility() {
  if (!scene || !document.pointerLockElement) return;
  const a = ABILITIES[abilityIndex];
  if (abilityStock[a.id] <= 0) {
    weaponManager.sfx.reloadStart(); // dry tin: empty pouch
    showToast(`${a.icon} ${a.label} kalmadı! Dalga arası ikmal gelir.`);
    return;
  }
  abilityStock[a.id]--;
  if (a.id === 'drone') {
    drones.push(launchDrone(scene, camera, controller));
    weaponManager.sfx.meleeWhoosh(); // launch whistle
    gamepad.rumble(0.35, 0.5, 110);
    showToast('🛸 DRONE HAVADA — hedefe kilitlendi!');
  } else if (a.id === 'carpet') {
    startCarpetBombing();
  } else {
    weaponManager.fillAllAmmo();
    weaponManager.sfx.powerUp();
    gamepad.rumble(0.4, 0.6, 130);
    showToast('📦 CEPHANE İKMALİ! Tüm şarjörler doldu');
  }
  updateHUD();
}

/** Drone warhead: same blast sweep as every other explosion, +self damage. */
function detonateDrone(pos, hitTarget) {
  spawnExplosion(pos, true, 0x66ccff);
  gamepad.rumble(0.8, 0.7, 220);
  const kills = blastEnemies(pos, DRONE_BLAST_RADIUS, DRONE_BLAST_DAMAGE);
  showToast(kills
    ? `🛸 ${kills} zombi infilak etti!`
    : hitTarget ? '🛸 Drone hedefe çarptı!' : '🛸 Drone kendini imha etti');
}

// ── E / gamepad-Y interaction chain (perk → PaP → barrier → wall gun →
// thompson → mystery box — see game/interactions.js). Score flows through
// spend() so the HUD readout always matches the balance. ──
const interactPrimary = createInteractions({
  getScene: () => scene,
  getController: () => controller,
  getWeapons: () => weaponManager,
  gamepad,
  getScore: () => score,
  spend: (n) => { score -= n; updateHUD(); },
  showToast,
  machines,
  barriers,
  zones,
  wallGuns,
  getPap: () => papMachine,
  getThompson: () => thompsonMesh,
  getMysteryBox: () => mysteryBox,
  applyPerk,
});

function startCarpetBombing() {
  carpet = { t: 0, step: CARPET_DURATION / CARPET_BOMBS, n: CARPET_BOMBS, dropped: 0, kills: 0 };
  showToast('✈️ HALI BOMBARDIMANI GELİYOR!');
  gamepad.rumble(0.7, 0.9, 380);
}

function addScore(base) {
  const mult = (performance.now() < doublePointsUntil ? 2 : 1) * difficulty.scoreMul;
  const pts = Math.round(base * mult);
  score += pts;
  updateHUD();
  return pts;
}

// ── Power-ups (drop on kill ~25%, pick up by proximity; table in
// game/powerups.js) ──
function dropPowerUp(pos, forcedKey = null) {
  powerUps.push(spawnPowerUp(scene, pos, isBlocked, forcedKey));
}

function applyPowerUp(key) {
  const t = powerUpType(key);
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
      recordBestRun(setup.mapId, difficulty.key, round, score);
      saveProgress();
      round++;
      startPrep(8);
      if (downed.active) standUp();
      rollNewWeather();
    }
  } else if (key === 'DoublePoints') {
    doublePointsUntil = performance.now() + 30000;
  } else if (key === 'MedKit') {
    playerHealth = Math.min(maxHealth, playerHealth + 40);
    if (downed.active) downed.t = extendDowned(downed.t);
  } else if (key === 'Carpet') {
    startCarpetBombing();
  } else if (key === 'DoubleAmmo') {
    weaponManager.doubleReserve();
  } else if (key === 'Dragon' || key === 'Shock' || key === 'FragRound') {
    const type = key === 'FragRound' ? 'frag' : key === 'Dragon' ? 'dragon' : 'shock';
    const def = weaponManager.grantSpecial(type);
    if (def) showToast(`${def.icon} ${def.label} — ${def.hint} (${def.rounds} mermi)`);
  }
  updateHUD();
}

// ── Kill credit: the ONE place score/XP/stats/loot/downed-progress are
// applied, shared by gunfire, fire, chains, splashes, grenades and nukes ──
function killCredit(enemy, isHeadshot = false) {
  gamepad.rumble(0.25, 0.45, 70);
  const pts = addScore(Math.round(enemy.params.score * (isHeadshot ? 1.5 : 1)));
  scorePopups.spawn(`+${pts}`, isHeadshot ? 'killhs' : 'kill');
  addXp(isHeadshot ? 15 : 10);
  stats.kills++;
  if (isHeadshot) stats.headshots++;
  if (stats.kills % 5 === 0) saveProgress();
  weaponManager.sfx.enemyDeath();
  if (enemy.type === 'headcrab') weaponManager.sfx.headcrabChirp(0.3);
  else weaponManager.sfx.zombieScream();
  enemy.startDeath();
  // Ground blood pool (pooled — free per kill).
  bloodDecals?.splat(
    enemy.group.position.x, enemy.group.position.z,
    enemy.type === 'boss' || enemy.type === 'brute' ? 1.7 : 1
  );
  // Last stand: every kill buys back bleed-out seconds.
  if (downed.active) {
    downed.t = extendDowned(downed.t);
    showToast('🩸 SON NEFES! +1.5 sn');
  }
  if (enemy.type === 'brute') dropPowerUp(enemy.group.position, 'MedKit');
  else if (enemy.type === 'boss') dropPowerUp(enemy.group.position, 'MaxAmmo');
  else if (Math.random() < 0.25) dropPowerUp(enemy.group.position);
}

// ── Downed lifecycle ──
function beginDowned() {
  downed.active = true;
  downed.t = DOWNED_DURATION;
  playerHealth = 0;
  controller.downed = true;
  weaponManager.sfx.bossRoar(); // low "I'm hit" sting
  gamepad.rumble(1, 1, 600);
  showToast('🩸 YERE DÜŞTÜN! Kanarken öldür, ya da bar bitince ayağa kalk');
  hud.setDownBar(true, 1);
  updateHUD();
}

function standUp() {
  downed.active = false;
  controller.downed = false;
  playerHealth = DOWNED_REVIVE_HP;
  hud.setDownBar(false);
  weaponManager.sfx.powerUp();
  gamepad.rumble(0.5, 0.8, 220);
  showToast(`🩸 AYAĞA KALKTIN! +${DOWNED_REVIVE_HP} can`);
  updateHUD();
}

/** Terminal death: freeze the run and wait for "Play Again". */
function gameOver() {
  downed.active = false;
  hud.setDownBar(false);
  pendingRestart = true;
  if (score > stats.bestScore) stats.bestScore = score;
  if (round > stats.bestRound) stats.bestRound = round;
  recordBestRun(setup.mapId, difficulty.key, round, score);
  saveProgress();
  for (const e of enemies) e.release();
  enemies = [];
  weaponManager.setTargets([]);
  overlay.classList.remove('hidden');
  overlay.querySelector('h1').textContent = 'GAME OVER';
  overlay.querySelector('p').textContent = `Skor: ${score} · Tur: ${round}`;
  startBtn.textContent = '↻ Tekrar Oyna';
  pause.panel?.classList.add('hidden');
  gamepad.rumble(1, 1, 700);
  document.exitPointerLock();
}

// ── Explosion sweep: apply a blast to every live zombie, credit the kills ──
function blastEnemies(center, radius, damage) {
  let kills = 0;
  for (const e of enemies) {
    if (!e.alive || e.dying) continue;
    if (e.group.position.distanceTo(center) < radius && e.applyExplosion(center, radius, damage)) {
      kills++;
      killCredit(e);
    }
  }
  if (kills) weaponManager.setTargets(enemies.filter((e) => e.alive && !e.dying).map((e) => e.group));
  return kills;
}

// ── Weather: state roll (the per-frame drive is in game/sky.js) ──
function rollNewWeather() {
  if (!weather.enabled) return;
  weather.state = rollWeather(round);
  if (weather.state === 'storm') {
    weather.boltT = 1.5 + Math.random() * 3;
    showToast('⛈️ Fırtına çöküyor!');
  } else if (weather.state === 'rain') {
    showToast('🌧️ Yağmur bastırıyor');
  }
}

// ── Explosion FX: pooled expanding orbs (game/fx.js) ──
function spawnExplosion(pos, playSound = true, color = 0xff9944) {
  fx.spawn(scene, weaponManager?.sfx, pos, playSound, color);
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

// ════════════════════════ BUILD / TEARDOWN ════════════════════════

function buildGame() {
  const built = createScene(setup.mapId);
  scene = built.scene;
  arenaHalf = built.arenaHalf ?? 45;
  lightPoolCtl.bind(scene);
  lightPoolCtl.pool.defs = built.pointLights || [];
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
      const pts = addScore(10);
      scorePopups.spawn(`+${pts}`, isHeadshot ? 'hs' : 'hit');
      weaponManager.sfx.enemyHit();
    },
    onEnemyKilled: (enemy, isHeadshot) => {
      killCredit(enemy, isHeadshot);
      // Remove from targets immediately so it can't be shot again
      weaponManager.setTargets(enemies.filter(e => e.alive).map(e => e.group));
    },
    // Power-up ammo impact pass (burn ignite / stun + zap chain / mini blast).
    onSpecialShot: (kind, hitEnemy, point) => {
      const def = SPECIAL_AMMO[kind];
      if (!def) return;
      if (kind === 'dragon') {
        if (hitEnemy) hitEnemy.ignite(def.burnSeconds);
      } else if (kind === 'shock') {
        weaponManager.sfx.zap(0.5, audioPan(point));
        if (hitEnemy) hitEnemy.stun(def.stunSeconds);
        const others = [];
        for (const e of enemies) {
          if (e === hitEnemy || !e.alive || e.dying) continue;
          others.push({ x: e.group.position.x, z: e.group.position.z, ref: e });
        }
        const chain = pickChainTargets(others, point.x, point.z, def.chainRadius, def.chainTargets);
        for (const t of chain) {
          t.stun(def.stunSeconds * 0.7);
          if (t.takeDamage(def.chainDamage)) killCredit(t);
        }
        if (chain.length) weaponManager.sfx.zap(0.3);
      } else if (kind === 'frag') {
        spawnExplosion(point, false, 0xffa044);
        gamepad.rumble(0.55, 0.6, 110);
        blastEnemies(point, def.blastRadius, def.blastDamage);
      }
    },
    onSpecialEnd: () => showToast('Özel mermi bitti'),
    // Ray Gun splash: green plasma pop at the impact point.
    onSplash: (point, radius, damage) => {
      spawnExplosion(point, false, 0x58ff6e);
      gamepad.rumble(0.35, 0.5, 90);
      const kills = blastEnemies(point, radius, damage);
      if (kills) addScore(20 * kills);
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
      const kills = blastEnemies(pos, 5, 8);
      if (kills) showToast(`💣 ${kills} zombi paramparça!`);
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
    if (e.code === 'KeyX') {
      cycleAbility();
      return;
    }
    if (e.code === 'KeyF') {
      useAbility();
      return;
    }
    if (e.code !== 'KeyE') return;
    interactPrimary();
  };
  document.addEventListener('keydown', onInteractKey);

  // Reset run state
  pendingRestart = false;
  stats.runs = (stats.runs || 0) + 1;
  saveProgress();
  enemies = [];
  round = 1;
  score = 0;
  playerHealth = 100;
  maxHealth = 100;
  instaKillUntil = 0;
  doublePointsUntil = 0;
  machines.length = 0;
  for (const k of Object.keys(perksHeld)) delete perksHeld[k];
  downed.active = false;
  downed.t = 0;
  hud.setDownBar(false);
  carpet = null;
  Object.assign(abilityStock, { drone: DRONE_STOCK, carpet: 1, maxammo: 1 });
  abilityIndex = 0;
  drones.length = 0;

  // Day/night cycle: remember the scene's base light intensities.
  dayNight.configure({
    sun: built.lights?.sun ?? null,
    hemi: built.lights?.hemi ?? null,
    ambient: built.lights?.ambient ?? null,
    outdoor: !!built.meta?.outdoor,
  });

  // Weather: rain column + fog + lightning only where the sky is open.
  weather.enabled = !!built.meta?.outdoor;
  weather.state = 'clear';
  weather.flashT = 0;
  weather.boltT = 0;
  weather.rain = null;
  weather.fog = scene.fog
    ? { near: scene.fog.near, far: scene.fog.far }
    : null;
  if (weather.enabled) {
    const n = rainDrops(opts.quality);
    if (n > 0) {
      weather.rain = createRain(n);
      scene.add(weather.rain.points);
    }
  }

  // Ground blood pool ring (fresh kills stamp the oldest splat).
  bloodDecals = new BloodDecals(scene, 18);

  // Wall-gun mounts + the Pack-a-Punch station first, then perk machines
  // scattered around them (the perk spots avoid every special machine).
  spawner = new Spawner({
    scene,
    controller,
    zones,
    arenaHalf,
    isBlocked,
    machines,
    wallGuns,
    setPap: (m) => { papMachine = m; },
    showToast,
  });
  spawner.spawnSpecialMachines({
    names: WEAPON_DEFS.filter((d) => !d.wonder).map((d) => d.name),
    runIndex: stats.runs || 0,
    unlockedRects: zones.filter((z) => z.unlocked).map((z) => z.rect),
  });
  spawner.spawnPerkMachines(PERKS, papMachine);
  collectPerfCullables();
  applyQuality();
  if (dn.sun && !dn.sun.target.parent) scene.add(dn.sun.target);

  // Prep phase before wave 1: build sandbags, then the front line arrives.
  startPrep(5);
  updateHUD();
}

function teardownGame() {
  if (!scene) return;
  document.removeEventListener('keydown', onInteractKey);
  onInteractKey = null;

  if (weaponManager) {
    weaponManager.dispose();
  }
  if (controller) {
    controller.dispose();
  }

  // The gun/hands are parented to the camera; release their GPU data and
  // drop them so the next game starts with a clean camera. (Gun geometry
  // is built fresh per run; shared ModelLoader materials are map-guarded.)
  disposeSceneAssets(camera);
  while (camera.children.length) camera.remove(camera.children[0]);
  weaponManager?.sfx.stopMusic();
  camera.fov = opts.fov;
  camera.updateProjectionMatrix();

  for (const e of enemies) e.release();
  enemies = [];
  // Power-ups share one module-level geometry: detach first, dispose only
  // the per-drop material (the scene sweep below must not hit the shared geo).
  for (const p of powerUps) { scene.remove(p); p.material.dispose(); }
  powerUps.length = 0;
  for (const bag of sandbags) { scene.remove(bag); disposeSceneAssets(bag); }
  sandbags.length = 0;
  sandbagStock = 0;
  fx.clear(scene);
  machines.length = 0; // meshes die with the old scene
  barriers.length = 0;
  zones.length = 0;
  windows.length = 0;
  wallGuns.length = 0;
  papMachine = null;
  spawner = null;

  // Downed / weather / blood state — the rain mesh and pooled decals live
  // in the old scene; drop our references before the GPU sweep below.
  downed.active = false;
  downed.t = 0;
  hud.setDownBar(false);
  carpet = null;
  for (const d of drones) scene.remove(d.mesh);
  drones.length = 0;
  Object.assign(abilityStock, { drone: 0, carpet: 0, maxammo: 0 });
  weather.enabled = false;
  weather.rain = null;
  weather.state = 'clear';
  weather.flashT = 0;
  weather.fog = null;
  if (bloodDecals) {
    bloodDecals.dispose();
    bloodDecals = null;
  }
  if (dn.sun?.shadow?.map) { dn.sun.shadow.map.dispose(); dn.sun.shadow.map = null; }

  // Light pool slots live in the old scene.
  lightPoolCtl.reset();

  // If the camera is still parented to the world, unhook it.
  camera.removeFromParent();

  // Free the map's GPU memory (merged geometries, materials, canvas
  // textures, sky cube) — the biggest source of restart leaks.
  disposeSceneAssets(scene);

  scene = null;
  controller = null;
  weaponManager = null;

  // Reset HUD & overlays
  const scopeEl = document.getElementById('scopeOverlay');
  if (scopeEl) scopeEl.classList.remove('show');
  const crossEl = document.getElementById('crosshair');
  if (crossEl) crossEl.style.display = '';
  hud.clearRun();
  scorePopups.clear();
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
  menuStats.updateMenuMeta();
  menuEl.classList.remove('hidden');
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    overlay.classList.add('hidden');
    transition.end();
    // Unlock audio (user gesture) and start the low war ambience.
    weaponManager?.sfx.unlock();
    weaponManager?.sfx.startAmbience();
    weaponManager?.sfx.startMusic(waveIntensity(round));
  } else {
    if (scene && !pendingRestart) {
      overlay.querySelector('h1').textContent = 'FPZ';
      overlay.querySelector('p').textContent = 'Duraklatıldı — devam etmek için tıkla.';
      startBtn.textContent = '▶ Devam Et';
      pause.sync();
      pause.panel?.classList.remove('hidden');
    }
    if (scene) overlay.classList.remove('hidden');
    if (pendingRestart) pause.panel?.classList.add('hidden');
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
function renderWorld(skipViewmodel = false) {
  // Accumulate stats across both passes (renderer.info resets per render()).
  renderer.info.reset();
  camera.layers.set(0);
  renderer.render(scene, camera);
  // The gun must never be occluded by / embedded into walls, so the
  // viewmodel pass clears the depth buffer first. While the pause overlay
  // covers the screen the gun pass is pure waste — skip it.
  if (skipViewmodel) return;
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
      if (document.pointerLockElement === canvas) interactPrimary();
    },
    onAbility: () => {
      if (document.pointerLockElement === canvas) useAbility();
    },
    onCycle: () => {
      if (document.pointerLockElement === canvas) cycleAbility();
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
    renderWorld(true);
    return;
  }

  controller.update(dt);
  weaponManager.update(dt);
  fx.update(scene, dt);
  applyShadowCadence();
  dayNight.followSun(controller.position, qualityByKey(opts.quality).shadowFollow);

  // Flickering bunker lamps (base intensity ~14; flicker around 60-110%)
  for (const pl of flickerLights) {
    if (!pl.visible) continue;
    pl.intensity = 14 * (0.6 + Math.random() * 0.5 + Math.sin(performance.now() * 0.01 + pl.userData.flickerSeed) * 0.15);
  }
  // Retarget the fixed light pool at the nearest defs (flicker included).
  lightPoolCtl.refresh(controller.position);

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
      p.material.dispose();
      powerUps.splice(i, 1);
    }
  }

  // ── Day/night + weather ── outdoor maps run a full sun arc (a day passes
  // every DAY_CYCLE_LEN seconds); indoor maps keep the old breathing. The
  // rain column, fog squeeze and lightning flash ride the weather state.
  dayNight.update(dt);
  if (weather.enabled) {
    const flash = driveWeather(weather, scene, weaponManager.sfx, dt, controller.position);
    if (flash > 0) dayNight.flash(flash);
  }

  // ── Carpet bombing: bombs land on a fixed cadence over ~2 seconds ──
  if (carpet) {
    carpet.t += dt;
    let landed = false;
    while (carpet.dropped < carpet.n && carpet.t >= carpet.dropped * carpet.step) {
      const a = Math.random() * Math.PI * 2;
      const r = CARPET_MIN_R + Math.random() * (CARPET_MAX_R - CARPET_MIN_R);
      const bx = THREE.MathUtils.clamp(controller.position.x + Math.cos(a) * r, -arenaHalf + 1, arenaHalf - 1);
      const bz = THREE.MathUtils.clamp(controller.position.z + Math.sin(a) * r, -arenaHalf + 1, arenaHalf - 1);
      const bp = new THREE.Vector3(bx, 0, bz);
      spawnExplosion(bp, true);
      gamepad.rumble(0.6, 0.7, 110);
      carpet.kills += blastEnemies(bp, CARPET_BLAST_RADIUS, CARPET_BLAST_DAMAGE);
      carpet.dropped++;
      landed = true;
    }
    if (landed) gamepad.rumble(0.5, 0.6, 90);
    if (carpet.dropped >= carpet.n) {
      if (carpet.kills) showToast(`✈️ ${carpet.kills} zombi havan ateşiyle temizlendi`);
      carpet = null;
    }
  }

  // ── Kamikaze drones: hunt the nearest zombie, detonate on contact ──
  if (drones.length) {
    updateDrones(drones, dt, {
      scene,
      enemies,
      camera,
      arenaHalf,
      onDetonate: (pos, hitTarget) => detonateDrone(pos, hitTarget),
    });
  }

  // ── Bleed-out clock (downed): ticks down, kills push it back up ──
  if (downed.active) {
    downed.t -= dt;
    hud.setDownFrac(downedBar(downed.t));
    if (downed.t <= 0) gameOver();
  }

  // Prep phase countdown (build / heal time between waves).
  if (waveState === 'prep') {
    prepTimer -= dt;
    hud.setPrep(`SONRAKİ DALGA: ${Math.max(1, Math.ceil(prepTimer))}`);
    // Spend the quiet frames pre-building pooled zombie bodies so the wave
    // spawn tick never pays model/material costs mid-fight.
    Enemy.prewarm(2);
    if (prepTimer <= 0) {
      hud.setPrep('');
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

  // Critical-HP heartbeat: thump + red vignette pulse (also while downed).
  if ((downed.active || (playerHealth < 30 && playerHealth > 0)) && waveState === 'active') {
    beatTimer -= dt;
    if (beatTimer <= 0) {
      beatTimer = THREE.MathUtils.lerp(1.0, 0.45, 1 - playerHealth / 30);
      weaponManager.sfx.heartbeat();
      const hbEl = document.getElementById('damage');
      if (hbEl) {
        hbEl.classList.remove('show');
        hbEl.classList.add('show');
        restartCssAnim(hbEl);
      }
    }
  } else {
    beatTimer = 0;
  }

  if (enemies.length) Enemy.prepareFrame(enemies, controller.obstacles);

  for (let i = enemies.length - 1; i >= 0; i--) {
    // The array can be emptied mid-iteration (game over) or reshuffled by
    // boss summons; skip stale indices instead of reading undefined.
    const enemy = enemies[i];
    if (!enemy) continue;
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
          recordBestRun(setup.mapId, difficulty.key, round, score);
          saveProgress();
          round++;
          updateHUD();
          startPrep(8);
          if (downed.active) standUp(); // held out till the wave died: up you get
          rollNewWeather();
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
    // Dragon's Breath DoT: Enemy.update banked whole HP chunks here.
    if (enemy.burnDamage > 0) {
      const burn = enemy.burnDamage;
      enemy.burnDamage = 0;
      if (enemy.alive && !enemy.dying && enemy.takeDamage(burn)) {
        killCredit(enemy);
        weaponManager.setTargets(enemies.filter((e) => e.alive && !e.dying).map((e) => e.group));
      }
    }
    if (dmg > 0) {
      // Hit feedback: camera flinch + red vignette flash
      controller.addHitFlinch();
      const dmgEl = document.getElementById('damage');
      if (dmgEl) {
        dmgEl.classList.remove('show');
        dmgEl.classList.add('show');
        restartCssAnim(dmgEl);
      }
      weaponManager.sfx.playerHurt();
      gamepad.rumble(0.6, 1, 180);
      if (downed.active) {
        // Downed already: bites eat the bleed-out bar instead of HP.
        downed.t = Math.max(0, downed.t - dmg * DOWNED_BITE_BLEED);
        if (downed.t <= 0) gameOver();
      } else {
        playerHealth -= dmg;
        updateHUD();
        if (playerHealth <= 0) {
          if (weaponManager.perks.quickRevive) {
            // Consume Quick Revive: come back fighting instead of going down.
            weaponManager.perks.quickRevive = false;
            playerHealth = 50;
            showToast('🚑 QUICK REVIVE!');
            weaponManager.sfx.powerUp();
            updateHUD();
          } else {
            beginDowned();
          }
        }
      }
    }
  }

  renderWorld();
  perfHud.update(dt);
}

// ── Perf HUD (F3): fps + draw calls + triangles + live light/shadow counts ──
const perfHud = createPerfHud({
  renderer,
  getScene: () => scene,
  getCamera: () => camera,
  getFrameInfo: () => ({
    lightsUsed: lightPoolCtl.pool.used.reduce((s, u) => s + u, 0),
    poolSize: lightPoolCtl.pool.size,
    poolDefs: lightPoolCtl.pool.defs.length,
    shadowVis: perfCull.shadowCasters.filter((m) => m.castShadow).length,
    shadowTotal: perfCull.shadowCasters.length,
    enemies: enemies.length,
    qualityLabel: qualityByKey(opts.quality).label,
  }),
});

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
      downed: downed.active ? Math.round(downed.t * 10) / 10 : 0,
      weather: weather.state,
      drones: { stock: abilityStock.drone, live: drones.length },
      ability: ABILITIES[abilityIndex].id,
      dayPhase: Math.round(dn.phase * 1000) / 1000,
      special: weaponManager ? weaponManager.special : null,
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
  // Debug-only conveniences (browser console + headless smoke tests).
  wep() {
    if (!weaponManager) return null;
    const w = weaponManager.active;
    return {
      name: w.def.name, ammo: w.ammo, swapping: weaponManager.swapping,
      reloading: w.reloading, targets: weaponManager._shootingTargets.length,
    };
  },
  giveWeapon(name) {
    if (weaponManager) weaponManager.grantWeapon(name);
  },
  giveSpecial(key) {
    if (weaponManager) weaponManager.grantSpecial(key);
  },
  setWeather(state) {
    weather.enabled = true;
    weather.state = state;
  },
  goDowned() {
    if (scene && controller && !downed.active && !pendingRestart) beginDowned();
  },
  fireOnce() {
    weaponManager?._tryShoot();
  },
  aimAhead() {
    if (controller) {
      controller._yaw = 0;
      controller._pitch = 0;
      controller.mouse.x = 0;
      controller.mouse.y = 0;
    }
  },
  // Drop a live zombie a few metres ahead of the player (for FX testing).
  spawnTestZombie() {
    if (!scene) return false;
    const { hp, spd, dmg } = applyDifficulty(waveParams(round), difficulty);
    const p = controller.position.clone().add(new THREE.Vector3(0, 0, -3));
    const e = new Enemy(scene, p, {
      type: 'normal', speed: spd, health: hp, damage: dmg,
      obstacles: controller.obstacles, sandbags, barriers, windows,
      getPeers: () => enemies,
    });
    e.animator.stop(); // hold still so the test can aim at it
    enemies.push(e);
    weaponManager.setTargets(enemies.map((x) => x.group));
    return true;
  },
};
