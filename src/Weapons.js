import * as THREE from 'three';
import { Sfx } from './Sound.js';
import {
  WEAPON_DEFS,
  WEAPON_LABELS,
  WEAPON_CATEGORIES,
  DEFAULT_LOADOUT,
  HANDS_RELOAD_CLIP,
  ATTACHMENTS,
  OPTICS,
  OPTIC_FOV,
  activeOptic,
  SKINS,
  MYSTERY_POOL,
} from './weapons/defs.js';
import { initialReserve, reloadTransfer, AMMO_CRATE_FACTOR } from './weapons/ammo.js';
import {
  ATTACH_ANCHORS,
  attachmentAvailable,
  buildAttachmentMeshes,
  buildIronSights,
  opticSightHeight,
  opticSightDepth,
} from './weapons/attachments.js';
import {
  applyViewmodelSettings,
  applySkin,
  createGunMesh,
  createHandsMesh,
  createLegsMesh,
} from './weapons/viewmodels.js';

/**
 * Weapons.js
 * WeaponManager facade. Static data lives in weapons/defs.js, attachment
 * builders in weapons/attachments.js, viewmodel builders in
 * weapons/viewmodels.js — everything is re-exported here so existing
 * imports keep working.
 */

/**
 * Weapon-swap choreography (seconds). The gun lowers out of view, the mesh
 * actually changes at the bottom of the arc, then the new gun is raised.
 * Firing / reloading / ADS are locked for the whole duration.
 */
const SWAP_TIME = 0.45;
/** Min distance the rearmost part of the gun keeps from the eye while ADS. */
const ADS_STOCK_CLEAR = 0.22;
/** Cheek-weld muzzle-up pitch while aiming down an optic (radians). */
const ADS_STOCK_TUCK = 0.045;
/** Fraction of SWAP_TIME spent lowering (the mesh swap happens at its end). */
const SWAP_LOWER = 0.5;
/** Seconds left on the clock when the meshes are exchanged. */
const SWAP_CUT_T = SWAP_TIME * (1 - SWAP_LOWER);

export {
  WEAPON_DEFS,
  WEAPON_LABELS,
  WEAPON_CATEGORIES,
  DEFAULT_LOADOUT,
  ATTACHMENTS,
  OPTICS,
  OPTIC_FOV,
  activeOptic,
  SKINS,
  MYSTERY_POOL,
  applySkin,
  ATTACH_ANCHORS,
  attachmentAvailable,
  buildAttachmentMeshes,
  buildIronSights,
  createGunMesh,
  createHandsMesh,
  createLegsMesh,
  applyViewmodelSettings,
};

/**
 * Build a gun + attachment group for the Gunsmith preview screen. Layers are
 * reset to 0 so the preview camera (default layer mask) sees everything.
 */
export function createGunsmithPreview(def, att = {}, skinId = 'default') {
  const group = createGunMesh(def);
  applySkin(group, skinId);
  group.add(buildAttachmentMeshes(def, att, group));
  group.traverse((o) => o.layers.set(0));
  return group;
}

/**
 * WeaponManager: holds multiple weapons, tracks active one, ammo, reload.
 */
export class WeaponManager {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {object} controller - FPSController
   * @param {object} callbacks - { onShoot, onWeaponChange, onAmmoChange }
   * @param {string[]} [loadout] - weapon names for slots 1-4 (default: DEFAULT_LOADOUT)
   */
  constructor(scene, camera, controller, callbacks = {}, attachments = {}, skins = {}, loadout = null) {
    this.scene = scene;
    this.camera = camera;
    this.controller = controller;
    this.callbacks = callbacks;
    // attachments: { Rifle: { scope: true, suppressor: true, ... }, ... }
    this.attachments = attachments || {};
    // skins: { Rifle: 'gold', Pistol: 'rust', ... } (missing = 'default')
    this.skins = skins || {};

    // Procedural sound effects (Web Audio). Unlocked on first user gesture.
    this.sfx = new Sfx();

    const names = Array.isArray(loadout) && loadout.length ? loadout : DEFAULT_LOADOUT;
    this.weapons = names.map((name) => this._makeWeapon(name));

    // Base (hip-fire) field of view — settings menu can change it.
    this.hipFov = 75;
    this.activeIndex = 0;
    this._firing = false;
    this._aiming = false;
    this.raycaster = new THREE.Raycaster();
    this.effects = [];
    this._shootingTargets = [];
    this._tracerPool = [];
    this._impactPool = [];
    this._flashPool = [];
    this._rayOrigin = new THREE.Vector2(0, 0);
    this._rayEnd = new THREE.Vector3();

    // Melee (bayonet) state — V key.
    this._meleeCd = 0;
    this._meleeT = 0;

    // Weapon-swap animation: countdown clock + the slot picked at the bottom
    // of the lower arc (null while not swapping).
    this._swapT = 0;
    this._swapPending = null;
    this._swapGrant = null;

    // Noisemakers (G key): bounce around, then lure nearby zombies.
    this.noisemakers = 2;
    this._nades = [];

    // Zombie-drink perks (main.js sets keys true when a machine is bought):
    //  speedCola — 40% faster reload · doubleTap — x2 bullet damage
    //  quickRevive — consumed by main.js on death
    this.perks = {};

    // Muzzle flash dynamic lights (world layer, recycled round-robin).
    this._flashLights = [];
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.PointLight(0xffb066, 0, 14, 2);
      pl.position.set(0, 2, 0);
      scene.add(pl);
      this._flashLights.push(pl);
    }
    this._flashLightIdx = 0;

    // Persistent blood splatter decals on world geometry (capped pool).
    this._decalGeo = new THREE.CircleGeometry(0.07, 10);
    this._decalMat = new THREE.MeshBasicMaterial({
      color: 0x4a0b0b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this._decals = [];

    this._ammoEl = document.getElementById('ammo');
    this._weaponEl = document.getElementById('weaponName');

    this._bindInput();
    this._updateHUD();
    this._hands = createHandsMesh();
    this._attachActiveGun();
  }

  setTargets(targets) {
    this._shootingTargets = targets;
  }

  /** Build one weapon entry (def + meshes + magazine/reserve) by name. */
  _makeWeapon(name) {
    const def = WEAPON_DEFS.find((d) => d.name === name) || WEAPON_DEFS[0];
    const att = { ...(this.attachments[def.name] || {}) };
    // Drop attachments this weapon can't mount (defensive: stale setup).
    for (const key of Object.keys(att)) {
      if (!attachmentAvailable(def.name, key)) att[key] = false;
    }
    // Optics share one mount: keep only the first equipped optic.
    let opticKept = false;
    for (const key of OPTICS) {
      if (!att[key]) continue;
      if (opticKept) att[key] = false;
      opticKept = true;
    }
    const skin = (this.skins && this.skins[def.name]) || 'default';
    const mag = att.extendedMag
      ? Math.round(def.magazineSize * 1.5)
      : def.magazineSize;
    const effDef = { ...def, magazineSize: mag, damage: att.suppressor ? Math.max(1, def.damage - (def.damage > 1 ? 1 : 0)) : def.damage };
    const mesh = createGunMesh(effDef);
    applySkin(mesh, skin);
    // Attach attachment meshes (scope / suppressor / grip / mag / stock).
    const attMeshes = buildAttachmentMeshes(effDef, att, mesh);
    mesh.add(attMeshes);
    return {
      def: effDef,
      att,
      ammo: mag,
      reserve: initialReserve(mag),
      reloading: false,
      reloadTimer: 0,
      fireCooldown: 0,
      mesh,
    };
  }

  /**
   * Mystery-box gift: replace the ACTIVE slot with a new gun and draw it.
   * The swap runs through the same lower/raise choreography as a manual
   * switch (the mesh changes at the bottom of the arc). If the weapon is
   * already in the loadout, it is topped up instead and null is returned
   * (no slot was replaced).
   */
  grantWeapon(name) {
    const owned = this.weapons.findIndex((w) => w.def.name === name);
    if (owned >= 0) {
      const w = this.weapons[owned];
      w.ammo = w.def.magazineSize;
      w.reserve = Math.max(w.reserve, initialReserve(w.def.magazineSize));
      this.switchTo(owned);
      return null;
    }
    this._commitSwap(); // finish any half-done swap before re-targeting
    this._swapGrant = name;
    this._swapPending = null;
    this._swapT = SWAP_TIME;
    this.sfx.weaponSwap();
    return name;
  }

  /** True while the lower/raise swap choreography is playing. */
  get swapping() {
    return this._swapT > 0;
  }

  /** Advance the swap clock; hand the gun over at the bottom of the arc. */
  _updateSwap(dt) {
    if (this._swapT <= 0) return;
    const before = this._swapT;
    this._swapT = Math.max(0, this._swapT - dt);
    if (before > SWAP_CUT_T && this._swapT <= SWAP_CUT_T) this._commitSwap();
  }

  /** Do the actual mesh/HUD swap (called at the bottom of the lower arc). */
  _commitSwap() {
    const grant = this._swapGrant;
    const index = this._swapPending;
    this._swapGrant = null;
    this._swapPending = null;
    if (grant) {
      // _attachActiveGun() removes the previous gun from the camera; free the
      // per-gun skin materials it leaves behind (geometry is shared/cached).
      const old = this.active;
      old.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.map) o.material.dispose();
      });
      this.weapons[this.activeIndex] = this._makeWeapon(grant);
    } else if (index != null) {
      this.activeIndex = index;
      this.active.reloading = false;
    } else {
      return;
    }
    this._attachActiveGun();
    this._updateHUD();
    if (this.callbacks.onWeaponChange) this.callbacks.onWeaponChange(this.activeDef.name);
  }

  /** MAX ammo pickup: every gun full, magazine + reserve. */
  fillAllAmmo() {
    for (const w of this.weapons) {
      w.ammo = w.def.magazineSize;
      w.reserve = initialReserve(w.def.magazineSize);
      w.reloading = false;
    }
    this._updateHUD();
  }

  /** Ammo crate: top up the reserve of every gun by 1.5 magazines. */
  addReserveAmmo() {
    for (const w of this.weapons) {
      w.reserve = Math.min(
        initialReserve(w.def.magazineSize),
        w.reserve + Math.round(w.def.magazineSize * AMMO_CRATE_FACTOR)
      );
    }
    this._updateHUD();
  }

  get active() {
    return this.weapons[this.activeIndex];
  }

  get activeDef() {
    return this.active.def;
  }

  _attachActiveGun() {
    // Remove old gun from camera
    if (this._currentGun) {
      // Stop any in-progress part animations so parts snap back to rest
      if (this._currentGun.userData.animator) this._currentGun.userData.animator.stop();
      this.camera.remove(this._currentGun);
    }
    const gun = this.active.mesh;
    if (!this._gunBase) this._gunBase = new THREE.Vector3(0.25, -0.2, -0.5);
    // A normal switch restarts from the hip pose; a mid-swap attach must KEEP
    // the current (lowered) anchor so the new gun appears exactly where the
    // old one vanished and the raise arc can continue.
    if (this._swapT <= 0) {
      this._gunBase.set(0.25, -0.2, -0.5);
      this._gunBaseRotX = 0;
      this._gunBaseRotZ = 0;
    }
    gun.position.copy(this._gunBase);
    this.camera.add(gun);
    this._currentGun = gun;
    // Let the controller apply run-bob + recoil to this gun (main.js creates
    // the controller without a gun, so it must be told about the active one).
    if (this.controller.setGun) this.controller.setGun(gun);
    // Attachment modifiers (foregrip steadiness, light-stock slide length).
    if (this.controller.setWeaponMods) this.controller.setWeaponMods(this.active.att);

    // Parent the hands to the gun so they follow it through every anim.
    if (this._hands) {
      this._hands.userData.animator.stop();
      this._hands.userData.animator.play('idle');
      gun.add(this._hands);
    }
  }

  /**
   * Start a weapon swap. The guns are NOT exchanged here — that happens
   * SWAP_LOWER into the animation (see _commitSwap), so spamming the keys
   * only re-targets the slot instead of teleporting guns across the screen.
   */
  switchTo(index) {
    if (index < 0 || index >= this.weapons.length) return;
    if (index === this.activeIndex && this._swapT <= 0) return;
    if (index === this._swapPending) return; // already on its way there
    if (this._swapGrant) this._commitSwap(); // a pending box gift must not be lost
    this._swapPending = index;
    this._swapT = SWAP_TIME;
    this.sfx.weaponSwap();
  }

  /** Slot the player is heading to (mid-swap this is not yet `activeIndex`). */
  get _wantedIndex() {
    return this._swapPending ?? this.activeIndex;
  }

  switchNext() {
    this.switchTo((this._wantedIndex + 1) % this.weapons.length);
  }

  switchPrev() {
    this.switchTo((this._wantedIndex - 1 + this.weapons.length) % this.weapons.length);
  }

  /** Gamepad input bridge (trigger held / ADS held). */
  setFiring(on) {
    this._firing = !!on;
  }

  setAiming(on) {
    this._aiming = !!on;
  }

  _bindInput() {
    this._onMouseDown = (e) => {
      if (e.button === 0 && document.pointerLockElement === this.controller.domElement) {
        this._firing = true;
        this._tryShoot();
      }
      if (e.button === 2 && document.pointerLockElement === this.controller.domElement) {
        this._aiming = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this._firing = false;
      if (e.button === 2) this._aiming = false;
    };
    this._onKeyDown = (e) => {
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'Digit1') this.switchTo(0);
      if (e.code === 'Digit2') this.switchTo(1);
      if (e.code === 'Digit3') this.switchTo(2);
      if (e.code === 'Digit4') this.switchTo(3);
      if (e.code === 'KeyV') this._tryMelee();
      if (e.code === 'KeyG') this._throwNoisemaker();
    };
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('keydown', this._onKeyDown);
    this._onContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', this._onContextMenu);
  }

  dispose() {
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('contextmenu', this._onContextMenu);
    this.sfx.dispose();
    for (const l of this._flashLights) this.scene.remove(l);
    for (const d of this._decals) this.scene.remove(d);
    this._decalMat.dispose();
    this._decalGeo.dispose();
  }

  /** Bayonet slash (V): silent, short range, heavy damage. */
  _tryMelee() {
    if (document.pointerLockElement !== this.controller.domElement) return;
    if (this._meleeCd > 0 || this.active.reloading || this.swapping) return;
    this._meleeCd = 0.85;
    this._meleeT = 0.35;
    this.sfx.meleeWhoosh();

    this.raycaster.far = 4.2;
    this.raycaster.setFromCamera(this._rayOrigin, this.camera);
    const hits = this.raycaster.intersectObjects(this._shootingTargets, true);
    if (hits.length > 0) {
      const hit = hits[0];
      this._onHit(hit.object, hit.point, 5);
      // Melee knockback is a shove, not a nudge.
      const target = this._enemyFromObject(hit.object);
      if (target && target.alive) target.knockback(this.raycaster.ray.direction, 0.5);
    }
  }

  /**
   * Throw a noisemaker (G): bounces like a tin can, then distracts every
   * zombie within 16 m for 5 s via callbacks.onLure(point).
   */
  _throwNoisemaker() {
    if (document.pointerLockElement !== this.controller.domElement) return;
    if (this.noisemakers <= 0) {
      this.sfx.reloadStart(); // dry-click: nothing left
      return;
    }
    this.noisemakers--;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.7 })
    );
    mesh.castShadow = true;
    mesh.position.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 0.5);
    mesh.position.y -= 0.15;
    const vel = this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(11);
    vel.y += 2.2;
    this.scene.add(mesh);
    this._nades.push({ mesh, vel, timer: 2.2, landed: false, settle: 0 });
  }

  _nadesUpdate(dt) {
    for (let i = this._nades.length - 1; i >= 0; i--) {
      const n = this._nades[i];
      n.timer -= dt;
      if (n.timer > 0) {
        // Ballistic flight + bounces.
        n.vel.y -= 20 * dt;
        n.mesh.position.addScaledVector(n.vel, dt);
        if (n.mesh.position.y < 0.09 && n.vel.y < 0) {
          n.mesh.position.y = 0.09;
          n.vel.y *= -0.45;
          n.vel.x *= 0.65;
          n.vel.z *= 0.65;
          if (Math.abs(n.vel.y) > 0.6) this.sfx.clatter(false);
          n.landed = true;
        }
        continue;
      }
      // Time's up: big clatter + lure everything nearby, then fade out.
      if (!n.done) {
        n.done = true;
        this.sfx.clatter(true);
        if (this.callbacks.onLure) this.callbacks.onLure(n.mesh.position.clone());
      }
      n.settle += dt;
      n.mesh.material.opacity = Math.max(0, 1 - n.settle / 1.5);
      n.mesh.material.transparent = true;
      if (n.settle >= 1.5) {
        this.scene.remove(n.mesh);
        n.mesh.geometry.dispose();
        n.mesh.material.dispose();
        this._nades.splice(i, 1);
      }
    }
  }

  /** Walk up the parents to the Enemy group (same rule as _onHit). */
  _enemyFromObject(object) {
    let target = object;
    while (target && !target.userData.isEnemy) target = target.parent;
    return target ? target.userData.enemyRef : null;
  }

  /** Small angled blood splat on world geometry at the impact point. */
  _spawnDecal(point, normal) {
    const decal = new THREE.Mesh(this._decalGeo, this._decalMat);
    decal.position.copy(point).addScaledVector(normal, 0.015);
    decal.lookAt(point.clone().add(normal));
    decal.rotation.z = Math.random() * Math.PI * 2;
    decal.scale.setScalar(0.7 + Math.random() * 0.9);
    this.scene.add(decal);
    this._decals.push(decal);
    if (this._decals.length > 50) this.scene.remove(this._decals.shift());
  }

  /** Momentary PointLight at the muzzle — world gets lit by the shot. */
  _spawnMuzzleLight(point) {
    if (!this._flashLights.length) return;
    const light = this._flashLights[this._flashLightIdx];
    this._flashLightIdx = (this._flashLightIdx + 1) % this._flashLights.length;
    light.position.copy(point);
    light.intensity = 0; // previous effect (if any) already faded it out
    light.intensity = 28;
    this.effects.push({
      obj: light,
      t: 0,
      dur: 0.07,
      update: () => {},
      onDone: () => { light.intensity = 0; },
    });
  }

  _tryShoot() {
    const w = this.active;
    if (w.reloading || w.fireCooldown > 0 || this.swapping) return;
    if (w.ammo <= 0) {
      this.reload();
      return;
    }

    w.ammo--;
    w.fireCooldown = w.def.fireRate;
    this.controller.addRecoil(w.def.name);
    if (w.att.suppressor) this.sfx.shootSuppressed(w.def.name);
    else this.sfx.shoot(w.def.name);

    // Play fire animation on gun parts
    const animator = this._currentGun?.userData.animator;
    if (animator && animator.clips.fire) {
      animator.play('fire');
    }
    // Play the matching hand recoil
    if (this._hands?.userData.animator) {
      this._hands.userData.animator.play('fire');
    }

    this.raycaster.far = w.def.range;
    this.raycaster.setFromCamera(this._rayOrigin, this.camera);
    const hits = this.raycaster.intersectObjects(this._shootingTargets, true);

    const muzzle = this.controller.getMuzzlePosition();
    let endPoint;

    let onEnemy = false;
    if (hits.length > 0) {
      const hit = hits[0];
      endPoint = hit.point;
      const dmg = w.def.damage * (this.perks.doubleTap ? 2 : 1);
      onEnemy = this._onHit(hit.object, hit.point, dmg);
      if (onEnemy === null && hit.face) {
        // World geometry hit: leave a persistent blood splat decal.
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
        this._spawnDecal(hit.point, n);
      }
    } else {
      endPoint = this.raycaster.ray.at(w.def.range, this._rayEnd);
    }

    this._spawnTracer(muzzle, endPoint);
    if (onEnemy === null) this._spawnImpact(endPoint);
    // Suppressed weapons have no muzzle flash — and no dynamic light.
    if (!w.att.suppressor) {
      this._spawnMuzzleFlash(muzzle);
      this._spawnMuzzleLight(muzzle);
    }
    this._updateHUD();
  }

  /** Flash the crosshair hitmarker. `kill` turns it red. */
  _showHitmarker(kill) {
    const el = this._hitEl ?? (this._hitEl = document.getElementById('hitmarker'));
    if (!el) return;
    el.classList.remove('show', 'kill');
    // Force a reflow so the animation can restart on rapid re-hits.
    void el.offsetWidth;
    if (kill) el.classList.add('kill');
    el.classList.add('show');
  }

  /** Returns true=kill, false=hit, null=not an enemy (world geometry). */
  _onHit(object, point, damage) {
    let target = object;
    while (target && !target.userData.isEnemy) {
      target = target.parent;
    }
    if (!target || !target.userData.isEnemy) return null;
    const enemy = target.userData.enemyRef;
    const isHeadshot = object.userData.isHead === true;
    // Blood burst + knockback so hits feel physical.
    this._spawnBlood(point);
    if (enemy.alive && !enemy.dying) {
      enemy.knockback(this.raycaster.ray.direction, isHeadshot ? 0.35 : 0.18);
    }
    if (this.callbacks.onEnemyHit) this.callbacks.onEnemyHit(enemy, isHeadshot);
    const died = enemy.takeDamage(damage);
    if (died && this.callbacks.onEnemyKilled) {
      this.callbacks.onEnemyKilled(enemy, isHeadshot);
    }
    this._showHitmarker(died);
    return true;
  }

  /** Dark-red particle puff at the hit point on an enemy. */
  _spawnBlood(point) {
    if (!this._bloodGeo) this._bloodGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
    // Fresh material per puff: overlapping puffs must not fade each other.
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8e1414,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const group = new THREE.Group();
    const vel = [];
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(this._bloodGeo, mat);
      p.position.copy(point);
      p.renderOrder = 2;
      group.add(p);
      vel.push(new THREE.Vector3(
        (Math.random() * 2 - 1) * 1.6,
        0.8 + Math.random() * 1.8,
        (Math.random() * 2 - 1) * 1.6
      ));
    }
    this.scene.add(group);
    const dt0 = 1 / 60;
    this.effects.push({
      obj: group,
      t: 0,
      dur: 0.45,
      fade: true,
      update: () => {
        for (let i = 0; i < group.children.length; i++) {
          vel[i].y -= 9 * dt0;
          group.children[i].position.addScaledVector(vel[i], dt0);
        }
      },
      onDone: () => {
        this.scene.remove(group);
        mat.dispose();
      },
    });
  }

  reload() {
    const w = this.active;
    if (w.reloading || w.ammo === w.def.magazineSize || this.swapping) return;
    // Finite reserve: an empty reserve means no reload — dry click instead.
    if (reloadTransfer(w.ammo, w.def.magazineSize, w.reserve) <= 0) {
      if (this._dryCd <= 0) {
        this._dryCd = 0.6; // throttle: auto-fire on an empty reserve = one click
        this.sfx.clatter(false);
        if (this.callbacks.onOutOfAmmo) this.callbacks.onOutOfAmmo();
      }
      return;
    }
    w.reloading = true;
    w.reloadDur = w.def.reloadTime * (this.perks.speedCola ? 0.6 : 1);
    w.reloadTimer = w.reloadDur;
    this.sfx.reloadStart();
    this._updateHUD();
  }

  /**
   * ADS handling: smooth FOV zoom. Equipped optics zoom to their own FOV
   * (reflex 60° … sniper scope 30°); the sniper scope also swaps the view
   * for the full-screen overlay and hides the crosshair. Bare iron sights
   * get a mild 55° zoom.
   */
  _updateAiming(dt) {
    const w = this.active;
    const optic = activeOptic(w.att);
    // Mid-swap the gun is out of hand: force hip-fire until it is raised.
    const swapping = this._swapT > 0;
    const scoped = optic === 'scope' && this._aiming && !swapping;
    const targetFov = this._aiming && !swapping ? (optic ? OPTIC_FOV[optic] : 55) : this.hipFov || 75;
    // Foregrip speeds up the aim-down-sights transition.
    const speed = w.att.foregrip ? 18 : 12;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * speed));
      this.camera.updateProjectionMatrix();
    }
    const scopeEl = this._scopeEl ?? (this._scopeEl = document.getElementById('scopeOverlay'));
    const crossEl = this._crossEl ?? (this._crossEl = document.getElementById('crosshair'));
    if (scopeEl) scopeEl.classList.toggle('show', scoped);
    // Aiming through any optic: the optic's own reticle is the aim point,
    // so the HUD crosshair steps aside.
    if (crossEl) crossEl.style.display = optic && this._aiming && !swapping ? 'none' : '';
  }

  _updateReloadAnim(dt) {
    const w = this.active;
    const gun = this._currentGun;
    if (!gun) return;

    // Compute the weapon's *base* pose (ADS centers it, reload dips it down)
    // and hand it to the controller, which layers run-bob + recoil on top in
    // _updateGun(). Never write gun.position/rotation directly here: doing
    // that every frame fought the run bob and cancelled it out.
    const optic = activeOptic(w.att);
    const scoped = optic === 'scope' && this._aiming;
    // Scoped ADS: drop the viewmodel out of frame (sniper overlay replaces it).
    // Aiming through reflex/holo/acog: sink the gun so the optic's reticle
    // lands on EXACT screen center — bullets always raycast from (0,0), so
    // anything else makes the dot lie about where the shot goes.
    const sightY = this._aiming && optic ? opticSightHeight(w.def.name, optic) : null;
    // Ads-forward distance: long stocks (Garand .39, BAR .42) would put the
    // buttplate within the camera near plane at the stock -0.45 pose, so the
    // giant clipped wedge fills the sight picture. Keep the rearmost solid
    // part of the gun at least ADS_STOCK_CLEAR metres in front of the eye.
    const stockRear = gun.userData.stockRear || 0;
    const aimZ = Math.min(-0.45, -ADS_STOCK_CLEAR - stockRear);
    const [ax, ay, az] = scoped
      ? [0, -0.8, -0.5]
      : this._aiming && sightY != null
        ? [0, -sightY, aimZ]
        : this._aiming ? [0, -0.12, aimZ] : [0.25, -0.2, -0.5];
    let bx = ax, by = ay, bz = az, brx = 0, brz = 0;
    // Cheek-weld pitch while aiming down an optic: tip the muzzle up so the
    // stock swings DOWN out of the sight line (it stays fully visible, just
    // below the reticle instead of filling it). Re-seat the gun vertically
    // so the optic's reticle still lands on exact screen centre (bullets
    // raycast from (0,0)) despite the added pitch.
    if (this._aiming && optic && sightY != null && !scoped) {
      const pitch = ADS_STOCK_TUCK;
      const zc = opticSightDepth(w.def.name); // optic sits forward of the pivot (negative z)
      brx = pitch;
      by = -(sightY * Math.cos(pitch) - zc * Math.sin(pitch));
    }
    if (w.reloading) {
      const total = w.reloadDur || w.def.reloadTime;
      const t = Math.min(1, (total - w.reloadTimer) / total);
      const s = Math.sin(t * Math.PI);
      by -= s * 0.06;
      bz += s * 0.08;
      brz = s * 0.15;
    }
    // Swap choreography: whole-gun lower/raise arc that OVERRIDES the ADS and
    // reload poses (sin over the full window = down, mesh swap, back up).
    const swapping = this._swapT > 0;
    if (swapping) {
      const p = THREE.MathUtils.clamp(1 - this._swapT / SWAP_TIME, 0, 1);
      const s = Math.sin(p * Math.PI);
      bx = 0.25;
      by = -0.2 - s * 0.34;
      bz = -0.5 + s * 0.26;
      brx = -s * 0.62;
      brz = s * 0.5;
    }
    // Melee thrust overlay: quick stab out-and-back.
    if (this._meleeT > 0 && !swapping) {
      const s = Math.sin((1 - this._meleeT / 0.35) * Math.PI);
      bz -= s * 0.34;
      by += s * 0.03;
      brz -= s * 0.25;
    }
    // The swap arc is fast — a slow follow-up lerp would flatten the dip.
    const k = Math.min(1, dt * (swapping ? 26 : 8));
    this._gunBase = this._gunBase || new THREE.Vector3(0.25, -0.2, -0.5);
    this._gunBaseTarget = this._gunBaseTarget || new THREE.Vector3();
    this._gunBaseRotZ = this._gunBaseRotZ ?? 0;
    this._gunBaseRotX = this._gunBaseRotX ?? 0;
    this._gunBaseTarget.set(bx, by, bz);
    this._gunBase.lerp(this._gunBaseTarget, k);
    this._gunBaseRotZ += (brz - this._gunBaseRotZ) * k;
    this._gunBaseRotX += (brx - this._gunBaseRotX) * k;
    this.controller.setGunBasePosition(this._gunBase.x, this._gunBase.y, this._gunBase.z);
    this.controller.setGunBaseRotation(this._gunBaseRotX, 0, this._gunBaseRotZ);

    // Part-level reload keyframes (slide, bolt, pump...) when the weapon has
    // them; scale the clip so it spans exactly the reload duration.
    const animator = gun.userData.animator;
    if (animator && animator.clips.reload && w.reloading) {
      if (!animator.playing || animator.active !== 'reload') {
        const dur = animator.clips.reload.duration || 1;
        const total = w.reloadDur || w.def.reloadTime;
        animator.play('reload', { speed: dur / total });
      }
    }

    // Drive the hands: play the weapon-specific reload clip, otherwise settle
    // to idle. 'fire' is excluded so the recoil clip can finish before we
    // snap to idle.
    const hands = this._hands?.userData.animator;
    if (hands) {
      if (w.reloading) {
        // Each weapon kind has its own arm choreography (pistol mag-swap,
        // rifle bolt, shotgun pump, Thompson drum). Fall back to the generic
        // 'reload' clip if a weapon has no dedicated one.
        const clip = HANDS_RELOAD_CLIP[w.def.name] || 'reload';
        if (!hands.playing || hands.active !== clip) {
          const total = w.reloadDur || w.def.reloadTime;
          hands.play(clip, { loop: false, speed: 1 / total });
        }
      } else if (hands.active !== 'idle' && hands.active !== 'fire') {
        hands.play('idle');
      }
    }
  }

  update(dt) {
    // Swap first: it can replace `this.active`, so read the weapon afterwards.
    this._updateSwap(dt);
    const w = this.active;
    this._updateAiming(dt);
    if (this._firing) this._tryShoot();
    if (w.fireCooldown > 0) w.fireCooldown -= dt;
    if (this._dryCd > 0) this._dryCd -= dt;
    if (this._meleeCd > 0) this._meleeCd -= dt;
    if (this._meleeT > 0) this._meleeT = Math.max(0, this._meleeT - dt);
    this._nadesUpdate(dt);
    if (w.reloading) {
      w.reloadTimer -= dt;
      if (w.reloadTimer <= 0) {
        w.reloading = false;
        // Draw from the finite reserve: a half-full reserve = half mag.
        const take = reloadTransfer(w.ammo, w.def.magazineSize, w.reserve);
        w.ammo += take;
        w.reserve -= take;
        this.sfx.reloadEnd();
        this._updateHUD();
      }
    }
    this._updateReloadAnim(dt);

    // Update weapon part animations (fire/reload keyframes)
    const animator = this._currentGun?.userData.animator;
    if (animator) animator.update(dt);

    // Update the hands viewmodel animation (idle sway / fire / reload)
    if (this._hands?.userData.animator) this._hands.userData.animator.update(dt);

    // Effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const k = e.t / e.dur;
      if (e.update) e.update(k);
      if (k >= 1) {
        if (e.onDone) e.onDone();
        this.effects.splice(i, 1);
      } else {
        if (e.fade) {
          if (e.obj.material) {
            e.obj.material.opacity = 1 - k;
          } else if (e.obj.children) {
            for (const child of e.obj.children) {
              if (child.material) child.material.opacity = 1 - k;
            }
          }
        }
        if (e.startScale) e.obj.scale.lerpVectors(e.startScale, e.endScale, k);
      }
    }
  }

  _spawnTracer(from, to) {
    const mat = this._tracerMat || (this._tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.9 }));
    let tracer = this._tracerPool.pop();
    if (!tracer) {
      tracer = new THREE.Mesh(this._tracerGeo || (this._tracerGeo = new THREE.BoxGeometry(0.02, 0.02, 0.6)), mat);
    }
    const dir = to.clone().sub(from);
    const len = dir.length();
    tracer.position.copy(from).addScaledVector(dir, 0.5);
    tracer.lookAt(to);
    tracer.rotateX(Math.PI / 2);
    tracer.scale.z = len / 0.6;
    tracer.material.opacity = 0.9;
    tracer.visible = true;
    this.scene.add(tracer);
    this.effects.push({ obj: tracer, t: 0, dur: 0.08, fade: true, onDone: () => { this.scene.remove(tracer); tracer.material.opacity = 0.9; tracer.visible = false; this._tracerPool.push(tracer); } });
  }

  _spawnImpact(point) {
    const mat = this._sparkMat || (this._sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc107, transparent: true, opacity: 1 }));
    let spark = this._impactPool.pop();
    if (!spark) {
      spark = new THREE.Mesh(this._sparkGeo || (this._sparkGeo = new THREE.SphereGeometry(0.05, 8, 8)), mat);
    }
    spark.position.copy(point);
    spark.scale.set(1, 1, 1);
    spark.material.opacity = 1;
    spark.visible = true;
    this.scene.add(spark);
    this.effects.push({
      obj: spark,
      t: 0,
      dur: 0.15,
      fade: true,
      startScale: new THREE.Vector3(1, 1, 1),
      endScale: new THREE.Vector3(2, 2, 2),
      onDone: () => { this.scene.remove(spark); spark.material.opacity = 1; spark.visible = false; this._impactPool.push(spark); },
    });
  }

  _spawnMuzzleFlash(point) {
    let flash = this._flashPool.pop();
    if (!flash) {
      flash = new THREE.Group();

      const coreMat = this._flashCoreMat || (this._flashCoreMat = new THREE.MeshBasicMaterial({
        color: 0xfff3b0,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const core = new THREE.Mesh(this._flashCoreGeo || (this._flashCoreGeo = new THREE.SphereGeometry(0.035, 12, 12)), coreMat);
      flash.add(core);

      const streakMat = this._flashStreakMat || (this._flashStreakMat = new THREE.MeshBasicMaterial({
        color: 0xffb300,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const streak = new THREE.Mesh(this._flashStreakGeo || (this._flashStreakGeo = new THREE.ConeGeometry(0.045, 0.22, 10)), streakMat);
      streak.rotation.x = Math.PI / 2;
      streak.position.z = -0.1;
      flash.add(streak);

      const glowMat = this._flashGlowMat || (this._flashGlowMat = new THREE.MeshBasicMaterial({
        color: 0xff8f00,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const glow = new THREE.Mesh(this._flashGlowGeo || (this._flashGlowGeo = new THREE.SphereGeometry(0.09, 12, 12)), glowMat);
      flash.add(glow);
      flash.renderOrder = 2;
    }

    flash.position.copy(point);
    flash.quaternion.copy(this.camera.quaternion);
    flash.visible = true;
    this.scene.add(flash);

    this.effects.push({
      obj: flash,
      t: 0,
      dur: 0.07,
      fade: true,
      startScale: new THREE.Vector3(0.6, 0.6, 0.6),
      endScale: new THREE.Vector3(1.4, 1.4, 1.4),
      onDone: () => {
        this.scene.remove(flash);
        this._flashCoreMat.opacity = 1;
        this._flashStreakMat.opacity = 0.9;
        this._flashGlowMat.opacity = 0.5;
        flash.visible = false;
        this._flashPool.push(flash);
      },
    });
  }

  _updateHUD() {
    const w = this.active;
    if (this._ammoEl) {
      this._ammoEl.textContent = w.reloading
        ? 'RELOADING...'
        : `${w.ammo} ▸ ${w.reserve}`;
    }
    if (this._weaponEl) {
      this._weaponEl.textContent = w.def.name;
    }
  }
}
