import * as THREE from 'three';
import { buildModel } from '../gfx/ModelLoader.js';
import { Animator } from '../anims/Animation.js';
import { BARRIER_CHEW_RATE } from './zombies.js';
import { insertHash, queryHash } from './spatial.js';
import { circleHitsOBB, resolveCircleOBB } from './collision.js';
import { zombieModel } from '../../models/zombie.js';
import { headcrabModel } from '../../models/headcrab.js';
import { zombieTexture, zombieSprinterTexture, zombieBruteTexture, zombieBomberTexture, headcrabTexture } from '../../textures/zombie.js';

/**
 * Enemy.js
 * Zombie AI with type variants, lure distractions, whisker steering around
 * obstacles, horde separation, stuck recovery and mesh pooling (groups are
 * recycled across waves instead of being rebuilt).
 */

/**
 * Zombie type presets. Multipliers apply over the base params; `texture`
 * swaps in a dedicated skin, `model` swaps the whole body, `score` is the
 * kill reward.
 *  bomber   detonates when the player gets too close — keep your distance!
 *  headcrab hops in fast, low arcs at the player's feet — squishy but fast!
 */
export const ENEMY_TYPES = {
  normal: { score: 60 },
  sprinter: { speedMul: 2.1, healthMul: 0.6, scale: 0.85, texture: zombieSprinterTexture, score: 70 },
  brute: { speedMul: 0.55, healthMul: 3.2, damageMul: 2, scale: 1.45, texture: zombieBruteTexture, score: 130 },
  bomber: { speedMul: 1.15, healthMul: 1, scale: 1.1, texture: zombieBomberTexture, explosive: true, detonateRange: 2.3, score: 90 },
  headcrab: { speedMul: 1.6, healthMul: 0.5, scale: 0.5, attackRange: 0.9, model: headcrabModel, texture: headcrabTexture, hopper: true, score: 45 },
  boss: { speedMul: 0.8, healthMul: 10, damageMul: 2, scale: 2.1, texture: zombieBruteTexture, tint: 0xff7050, score: 500 },
};

// Recycled viewmodel groups, shared across all Enemy instances. Kept per
// skin so a pooled group never comes back wearing another type's texture.
const POOL_MAX = 28;
const pools = new Map();

// Distance LOD (squared). Far zombies walk cheap; pose/steer/crowd only
// kick in once they close in.
const LOD_ANIM_SQ = 36 * 36;
const LOD_SEPARATE_SQ = 18 * 18;
const LOD_CHEW_SQ = 16 * 16;

const _toScratch = new THREE.Vector3();
const _resolveOut = { x: 0, z: 0 };

/** Shared per-frame crowd index + tall-obstacle cache (filled by prepareFrame). */
const crowd = { hash: new Map(), cell: 2, tall: [], near: [] };

export class Enemy {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} spawnPos
   * @param {object} [options] - { type, speed, health, damage, obstacles, sandbags }
   */
  constructor(scene, spawnPos, options = {}) {
    this.scene = scene;
    const type = ENEMY_TYPES[options.type] ? options.type : 'normal';
    const v = ENEMY_TYPES[type];
    this.type = type;

    this.params = {
      speed: 2.0,
      health: 3,
      damage: 10,
      attackRange: 1.2,
      attackCooldown: 1.0,
      score: v.score,
      explosive: false,
      detonateRange: v.detonateRange ?? 2.3,
      ...options,
    };
    // Variant multipliers apply on top of the round-scaled base values.
    this.params.speed *= v.speedMul ?? 1;
    // Per-zombie gait jitter so a horde never moves in lockstep.
    this.params.speed *= 0.9 + Math.random() * 0.2;
    this.params.health *= v.healthMul ?? 1;
    this.params.damage *= v.damageMul ?? 1;
    if (v.attackRange) this.params.attackRange = v.attackRange;
    // Explosive flag comes from the preset only (options spread above can't
    // accidentally arm a non-bomber).
    this.params.explosive = !!v.explosive;
    // Hoppers (headcrabs) travel in ballistic arcs instead of walking.
    this.hopper = !!v.hopper;
    this._airborne = false;
    this._hopVy = 0;
    this._hopWait = Math.random() * 0.4;
    this._hopDir = new THREE.Vector3(0, 0, 1);

    this.health = this.params.health;
    this.alive = true;
    this.dying = false;
    this.exploded = false;
    this._attackTimer = 0;
    this._bobTime = Math.random() * 10;
    this._currentAnim = null;
    this._lurePos = null;
    this._lureTimer = 0;
    // Steering state: preferred detour side, avoid-mode countdown, stuck watch
    this._avoidSide = Math.random() < 0.5 ? -1 : 1;
    this._avoidTimer = 0;
    this._stuckTimer = 0;
    this._steerVec = new THREE.Vector3();
    this._prevX = spawnPos.x;
    this._prevZ = spawnPos.z;

    // Build (or recycle) the group from this type's skin pool.
    this._meshes = [];
    this._modelDef = v.model || zombieModel;
    this._texDef = v.texture || zombieTexture;
    let pool = pools.get(this._texDef);
    if (!pool) {
      pool = [];
      pools.set(this._texDef, pool);
    }
    const pooled = pool.pop();
    if (pooled) {
      this.group = pooled;
      this._resetPooled();
    } else {
      this.group = buildModel(this._modelDef, this._texDef);
      // Clone materials so hit-flash/tint on this zombie doesn't affect
      // others (buildModel caches one material per texture).
      this.group.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          this._meshes.push(o);
        }
      });
    }
    this._applyTint(v.tint ?? 0xffffff);

    this.group.position.copy(spawnPos);
    this.group.scale.setScalar(v.scale ?? 1);
    this.group.userData.isEnemy = true;
    this.group.userData.enemyRef = this;
    scene.add(this.group);

    // Knockback impulse (decays fast) + hit-flash timer
    this._kb = new THREE.Vector3();
    this._flash = 0;

    // Static references shared with the game loop
    this._obstacles = options.obstacles || null;
    this._sandbags = options.sandbags || null;
    // Opened CoD-style barriers: the horde chews them back shut (defend!).
    this._barriers = options.barriers || null;
    // Open window waypoints: detour through a gap when walls block the chase.
    this._windows = options.windows || null;
    this._routeWin = null;
    this._routeT = Math.random() * 0.4; // stagger re-plans across the horde
    this._routeClose = false;
    this._routeVec = new THREE.Vector3();
    // Lazy accessor for the live enemy list (used for crowding/avoidance).
    this._getPeers = options.getPeers || null;

    // Keyframe animations (idle / walk / attack / death)
    this.animator = new Animator(this.group, this._modelDef.anims);
    this.animator.play('idle');
  }

  /**
   * Rebuild the shared spatial hash + tall-obstacle list once per tick so
   * every zombie can query neighbours / walls without an O(n²) scan.
   */
  static prepareFrame(enemies, obstacles) {
    const hash = crowd.hash;
    hash.clear();
    const cell = crowd.cell;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || e.dying) continue;
      const p = e.group.position;
      insertHash(hash, p.x, p.z, cell, e);
    }
    const tall = crowd.tall;
    tall.length = 0;
    if (obstacles) {
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        const col = obs.userData.collision;
        if (col && col.size.y > 0.8) tall.push(obs);
      }
    }
  }

  /** Zero out any pose left over from a previous life of a pooled group. */
  _resetPooled() {
    this._meshes = [];
    this.group.traverse((o) => {
      if (o.isMesh) this._meshes.push(o);
    });
    // Pivots are direct children of the group (buildModel structure).
    for (const pivot of this.group.children) {
      pivot.rotation.set(0, 0, 0);
      pivot.scale.set(1, 1, 1);
    }
    this.group.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);
    for (const m of this._meshes) {
      m.material.emissive.setRGB(0, 0, 0);
    }
  }

  /** Recolor the (cloned) skin material for a type variant. */
  _applyTint(hex) {
    for (const m of this._meshes) m.material.color.setHex(hex);
  }

  /**
   * Divert this zombie to a noise point (noisemaker) for `duration` seconds.
   */
  lureAt(pos, duration = 5) {
    if (!this.alive || this.dying) return;
    this._lurePos = pos.clone();
    this._lureTimer = duration;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @returns {number} damage dealt to player this tick (0 if none)
   */
  update(dt, playerPos) {
    const pos = this.group.position;
    const pdx = pos.x - playerPos.x;
    const pdz = pos.z - playerPos.z;
    const playerDistSq = pdx * pdx + pdz * pdz;

    // Hit-flash decay (white-hot tint that fades over ~0.12 s)
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 8);
      const e = this._flash;
      for (const m of this._meshes) m.material.emissive.setRGB(e, e * 0.35, e * 0.35);
    } else if (this.params.explosive && this.alive && !this.dying && playerDistSq < LOD_ANIM_SQ) {
      // Bomber: ominous orange pulse (skip when far — material writes are dear).
      const pulse = 0.35 + 0.25 * Math.sin(performance.now() * 0.012);
      for (const m of this._meshes) m.material.emissive.setRGB(pulse, pulse * 0.35, 0);
    }

    // Knockback impulse decay
    if (this._kb.lengthSq() > 1e-4) {
      this.group.position.addScaledVector(this._kb, dt);
      this._kb.multiplyScalar(Math.max(0, 1 - dt * 10));
    }

    // Hopper ballistics run every tick (even mid-death) so a crab shot out
    // of the air drops to the ground instead of hovering.
    if (this.hopper && this._airborne) {
      const p = this.group.position;
      this._hopVy -= 13 * dt;
      p.y = Math.max(0, p.y + this._hopVy * dt);
      p.addScaledVector(this._hopDir, this.params.speed * dt);
      this._collideObstacles();
      if (p.y <= 0) {
        p.y = 0;
        this._hopVy = 0;
        this._airborne = false;
        this._hopWait = 0.2 + Math.random() * 0.35;
      }
    }

    if (this.dying) {
      // Death animation is playing; main loop removes us when it finishes.
      this.animator.update(dt);
      return 0;
    }

    if (!this.alive) return 0;

    const dir = this._dir || (this._dir = new THREE.Vector3());

    // Bomber: proximity detonation — big damage, main loop handles the FX.
    if (this.params.explosive) {
      const det = this.params.detonateRange;
      if (playerDistSq < det * det) {
        this.alive = false;
        this.exploded = true;
        return 30;
      }
    }

    // Walk the lure timer; walk toward the lure while it lasts, unless the
    // player is rude enough to stand within arm's reach.
    let target = playerPos;
    if (this._lureTimer > 0) {
      this._lureTimer -= dt;
      if (this._lurePos && Math.sqrt(playerDistSq) > this.params.attackRange) target = this._lurePos;
      if (this._lureTimer <= 0) this._lurePos = null;
    }

    dir.copy(target).sub(pos);
    dir.y = 0;
    const dist = dir.length();

    let damaged = 0;

    if (target === playerPos && dist > this.params.attackRange) {
      dir.normalize();
      // Windowed maps: detour to the best window when walls block the
      // straight chase (and press into it to chew the planks off).
      const moveDir = (this._windows && this._windows.length)
        ? this._routeDir(dt, dir, dist, playerPos)
        : dir;
      if (this.hopper) {
        // Grounded between hops: wait out the cooldown, then pounce.
        // The ballistics block at the top of update() carries us in flight.
        if (!this._airborne) this._creepOrHop(dt, moveDir, dist);
      } else {
        // Right at the targeted window the side-step steering would slide
        // us away along the wall — walk straight in instead.
        const steer = this._routeClose ? moveDir : this._steer(pos, moveDir);
        this.group.position.addScaledVector(steer, this.params.speed * dt);
        this._collideObstacles();
        if (playerDistSq < LOD_SEPARATE_SQ) {
          this._separate();
          this._collideObstacles();
        }
        this._watchStuck(dt, moveDir);
        if (playerDistSq < LOD_CHEW_SQ) {
          this._chewSandbags(dt, moveDir);
          this._chewBarriers(dt, moveDir);
        }

        // Face where we're actually walking (drifts off at corners)
        this.group.rotation.y = Math.atan2(steer.x, steer.z);

        // Walking animation
        if (this._currentAnim !== 'walk') {
          this.animator.play('walk');
          this._currentAnim = 'walk';
        }
      }
      // LOD: far-away zombies don't need per-frame pose updates (they
      // freeze mid-stride; re-close and the walk resumes).
      if (playerDistSq < LOD_ANIM_SQ) this.animator.update(dt);
    } else if (target === playerPos) {
      // In range: attack, and keep eyes on the prey
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
      if (this._currentAnim !== 'attack' && !this.animator.playing) {
        this.animator.play('attack', { loop: false });
        this._currentAnim = 'attack';
      }
      this._attackTimer -= dt;
      if (this._attackTimer <= 0) {
        this._attackTimer = this.params.attackCooldown;
        damaged = this.params.damage;
      }
      this._prevX = pos.x;
      this._prevZ = pos.z;
      this.animator.update(dt);
    } else {
      // Lured: shamble to the noise, then mill around it harmlessly.
      if (dist > 0.8) {
        dir.normalize();
        const steer = this._steer(pos, dir);
        this.group.position.addScaledVector(steer, this.params.speed * 0.8 * dt);
        this._collideObstacles();
        if (playerDistSq < LOD_SEPARATE_SQ) {
          this._separate();
          this._collideObstacles();
        }
        if (playerDistSq < LOD_CHEW_SQ) {
          this._chewSandbags(dt, dir);
          this._chewBarriers(dt, dir);
        }
        this.group.rotation.y = Math.atan2(steer.x, steer.z);
        if (this._currentAnim !== 'walk') {
          this.animator.play('walk');
          this._currentAnim = 'walk';
        }
      } else {
        this.group.rotation.y += dt * 0.5;
        if (this._currentAnim !== 'idle') {
          this.animator.play('idle');
          this._currentAnim = 'idle';
        }
      }
      this._prevX = pos.x;
      this._prevZ = pos.z;
      this.animator.update(dt);
    }

    // Subtle vertical bob (walk vs idle) — skip when far.
    if (playerDistSq < LOD_ANIM_SQ) {
      if (this._currentAnim === 'walk') {
        this._bobTime += dt;
        this.group.position.y = Math.abs(Math.sin(this._bobTime * 5)) * 0.03;
      } else if (this._currentAnim === 'idle') {
        this._bobTime += dt;
        this.group.position.y = Math.abs(Math.sin(this._bobTime * 2)) * 0.02;
      }
    }

    return damaged;
  }

  /**
   * Grounded hopper step: launch a ballistic pounce at the player, or —
   * once close enough that a leap would overshoot — creep the last stretch
   * at a low crawl.
   */
  _creepOrHop(dt, dir, dist) {
    this._hopWait -= dt;
    if (dist > 2.2 && this._hopWait <= 0) {
      // Faster crabs (late rounds) get a lower, snappier arc so the jump
      // length stays roughly constant as the wave speed ramps up.
      this._hopVy = Math.min(4.2, Math.max(2.2, 12 / this.params.speed));
      const steer = this._steer(this.group.position, dir);
      this._hopDir.copy(steer);
      this.group.rotation.y = Math.atan2(steer.x, steer.z);
      this._airborne = true;
      this.animator.play('hop', { loop: false });
      this._currentAnim = 'hop';
      return;
    }
    if (dist > this.params.attackRange * 1.2) {
      const steer = this._steer(this.group.position, dir);
      this.group.position.addScaledVector(steer, this.params.speed * 0.45 * dt);
      this._collideObstacles();
      this._separate();
      this._collideObstacles();
      this._watchStuck(dt, dir);
      this._chewSandbags(dt, dir);
      this._chewBarriers(dt, dir);
      this.group.rotation.y = Math.atan2(steer.x, steer.z);
      if (this._currentAnim !== 'walk') {
        this.animator.play('walk');
        this._currentAnim = 'walk';
      }
    }
  }

  /**
   * Push the zombie out of tall static obstacles (buildings, crates,
   * sandbags). Low rubble (<0.8 m) is walkable and skipped, same rule as
   * the player controller.
   */
  _collideObstacles() {
    const cached = crowd.tall.length > 0;
    const list = cached ? crowd.tall : this._obstacles;
    if (!list) return;
    const p = this.group.position;
    const r = 0.26;
    for (let i = 0; i < list.length; i++) {
      const obs = list[i];
      const col = obs.userData.collision;
      if (!col || (!cached && col.size.y <= 0.8)) continue;
      if (resolveCircleOBB(p.x, p.z, r, obs, _resolveOut)) {
        p.x = _resolveOut.x;
        p.z = _resolveOut.z;
      }
    }
  }

  /**
   * Whisker steering: if the straight shot to the target runs into a tall
   * obstacle, fan out ±~25° at a time (committing to one side) and take the
   * first clear heading, so zombies flow around buildings instead of
   * grinding on walls. Falls back to sidestepping when fully boxed in.
   * Returns a reused vector — copy it if you need to keep it.
   */
  _steer(pos, dir) {
    const out = this._steerVec.copy(dir);
    if (!this._obstacles && !crowd.tall.length) return out;
    const look = 0.4 + this.group.scale.x * 0.35;
    if (!this._blockedAhead(pos, dir.x, dir.z, look)) return out;

    const base = Math.atan2(dir.x, dir.z);
    const step = 0.45;
    for (let i = 1; i <= 7; i++) {
      const a1 = base + this._avoidSide * step * i;
      if (!this._blockedAhead(pos, Math.sin(a1), Math.cos(a1), look)) {
        return out.set(Math.sin(a1), 0, Math.cos(a1));
      }
      const a2 = base - this._avoidSide * step * i;
      if (!this._blockedAhead(pos, Math.sin(a2), Math.cos(a2), look)) {
        this._avoidSide *= -1;
        return out.set(Math.sin(a2), 0, Math.cos(a2));
      }
    }
    // Boxed in on all sides: slide sideways and hope the crowd sorts it out.
    const a = base + this._avoidSide * Math.PI / 2;
    return out.set(Math.sin(a), 0, Math.cos(a));
  }

  /** True if the probe points at half/full `look` ahead hit a tall obstacle. */
  _blockedAhead(p, dx, dz, look) {
    const cached = crowd.tall.length > 0;
    const list = cached ? crowd.tall : this._obstacles;
    if (!list) return false;
    const r = 0.26;
    for (let i = 0; i < list.length; i++) {
      const obs = list[i];
      const col = obs.userData.collision;
      if (!col || (!cached && col.size.y <= 0.8)) continue;
      if (circleHitsOBB(p.x + dx * look, p.z + dz * look, r, obs)) return true;
      if (circleHitsOBB(p.x + dx * look * 0.5, p.z + dz * look * 0.5, r, obs)) return true;
    }
    return false;
  }

  /** Soft body separation: nudge overlapping zombies apart so the horde
   *  spreads into a crowd instead of stacking into a single dot. */
  _separate() {
    const p = this.group.position;
    const peers = crowd.hash.size
      ? queryHash(crowd.hash, p.x, p.z, crowd.cell, 1, crowd.near)
      : (this._getPeers ? this._getPeers() : null);
    if (!peers) return;
    const r = 0.30 * this.group.scale.x;
    for (let i = 0; i < peers.length; i++) {
      const other = peers[i];
      if (other === this || !other.alive || other.dying) continue;
      const o = other.group.position;
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const d2 = dx * dx + dz * dz;
      const min = r + 0.30 * other.group.scale.x;
      if (d2 >= min * min) continue;
      if (d2 < 1e-5) {
        p.x += this._avoidSide * 0.02;
        continue;
      }
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.5;
      p.x += (dx / d) * push;
      p.z += (dz / d) * push;
    }
  }

  /**
   * Progress watchdog: if real movement toward the target is way below what
   * our speed should produce (corner grind), keep flipping the preferred
   * detour side until something frees up.
   */
  _watchStuck(dt, wantDir) {
    const p = this.group.position;
    const progress = (p.x - this._prevX) * wantDir.x + (p.z - this._prevZ) * wantDir.z;
    this._prevX = p.x;
    this._prevZ = p.z;
    if (progress < this.params.speed * dt * 0.4) {
      this._stuckTimer += dt;
      if (this._stuckTimer > 0.25) this._avoidSide *= -1;
      if (this._stuckTimer > 0.8) this._unstickNudge(wantDir);
      if (this._stuckTimer > 1.6) {
        this._unstickNudge(wantDir, 1.1);
        this._stuckTimer = 0.2;
      }
    } else {
      this._stuckTimer = Math.max(0, this._stuckTimer - dt * 3);
    }
  }

  /**
   * When whiskers fail in a pinch, step sideways / along the wall toward
   * the first heading that isn't blocked so a gap one body-width wide
   * still drains instead of parking the horde forever.
   */
  _unstickNudge(wantDir, dist = 0.55) {
    const p = this.group.position;
    const base = Math.atan2(wantDir.x, wantDir.z);
    const look = 0.45;
    for (let i = 1; i <= 8; i++) {
      const a = base + this._avoidSide * (Math.PI / 8) * i;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      if (this._blockedAhead(p, dx, dz, look)) continue;
      p.x += dx * dist;
      p.z += dz * dist;
      this._collideObstacles();
      this._avoidSide *= -1;
      return;
    }
    p.x += this._avoidSide * dist * 0.6;
    this._collideObstacles();
  }

  /** Zombies stuck against a sandbag chew through it (~5 s). */
  _chewSandbags(dt, moveDir) {
    if (!this._sandbags || !this._sandbags.length) return;
    const p = this.group.position;
    for (const bag of this._sandbags) {
      if (bag.userData.hp <= 0) continue;
      const dx = bag.position.x - p.x;
      const dz = bag.position.z - p.z;
      if (dx * dx + dz * dz > 2.56) continue;
      const toBag = _toScratch.set(dx, 0, dz);
      if (toBag.lengthSq() < 1e-6) continue;
      toBag.normalize();
      if (toBag.dot(moveDir) < 0.4) continue;
      bag.userData.hp -= 14 * dt;
    }
  }

  /**
   * Zombies funneling through an OPENED barrier tear at its frame; enough
   * traffic across the waves rips it back shut (main.js reseals the zone).
   */
  _chewBarriers(dt, moveDir) {
    if (!this._barriers || !this._barriers.length) return;
    const p = this.group.position;
    for (const b of this._barriers) {
      if (!b.open || b.hp <= 0) continue;
      const dx = b.mesh.position.x - p.x;
      const dz = b.mesh.position.z - p.z;
      if (dx * dx + dz * dz > 5.76) continue;
      const toGate = _toScratch.set(dx, 0, dz);
      if (toGate.lengthSq() < 1e-6) continue;
      toGate.normalize();
      if (toGate.dot(moveDir) < 0.3) continue;
      b.hp -= BARRIER_CHEW_RATE * dt;
    }
  }

  /**
   * Movement direction with window routing: when the straight line to the
   * player is walled off, head for the cheapest opening instead.
   * Re-planned on a staggered ~0.4 s cadence, not per frame.
   */
  _routeDir(dt, dir, dist, playerPos) {
    this._routeT -= dt;
    if (this._routeT <= 0) {
      this._routeT = 0.35 + Math.random() * 0.3;
      this._routeWin = this._pickWindow(dir, dist, playerPos);
    }
    const w = this._routeWin;
    this._routeClose = false;
    if (!w) return dir;
    const p = this.group.position;
    const dx = w.x - p.x;
    const dz = w.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1.44) {
      // Through the opening — resume the chase.
      this._routeWin = null;
      return dir;
    }
    this._routeClose = d2 < 9;
    return this._routeVec.set(dx, 0, dz).normalize();
  }

  /** Cheapest window detour (zombie→window→player), or null if the direct
   *  line looks clear. */
  _pickWindow(dir, dist, playerPos) {
    if (dist < 3.5) return null;
    const p = this.group.position;
    const look = Math.min(5, dist - 0.4);
    if (!this._blockedAhead(p, dir.x, dir.z, 2.2)
      && !this._blockedAhead(p, dir.x, dir.z, 3.4)
      && !this._blockedAhead(p, dir.x, dir.z, look)) return null;
    let best = null;
    let bestCost = Infinity;
    for (let i = 0; i < this._windows.length; i++) {
      const w = this._windows[i];
      const dzw = Math.hypot(w.x - p.x, w.z - p.z);
      if (dzw > 30) continue;
      const dwp = Math.hypot(w.x - playerPos.x, w.z - playerPos.z);
      const cost = dzw + dwp;
      if (cost < bestCost) {
        bestCost = cost;
        best = w;
      }
    }
    return best;
  }

  /**
   * Grenade / blast damage with linear falloff. Applies a radial knockback
   * so the explosion visibly shoves the horde around.
   * @returns {boolean} true if this zombie died from the blast
   */
  applyExplosion(center, radius = 5, maxDamage = 8) {
    if (!this.alive || this.dying) return false;
    const d = this.group.position.distanceTo(center);
    if (d >= radius) return false;
    const dmg = Math.max(0, Math.round(maxDamage * (1 - d / radius)));
    if (dmg <= 0) return false;
    const push = new THREE.Vector3().subVectors(this.group.position, center).setY(0);
    if (push.lengthSq() > 1e-5) this.knockback(push.normalize(), 0.6);
    return this.takeDamage(dmg);
  }

  /**
   * Physical hit feedback: shove the zombie along the bullet direction and
   * flash it white for a frame or two.
   * @param {THREE.Vector3} dir - normalized bullet travel direction
   * @param {number} strength - impulse speed (m/s)
   */
  knockback(dir, strength = 0.2) {
    this._kb.x += dir.x * strength * 8;
    this._kb.z += dir.z * strength * 8;
    this._flash = 1;
  }

  /**
   * Apply damage. Returns true if enemy died.
   */
  takeDamage(amount) {
    if (!this.alive || this.dying) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.startDeath();
      return true;
    }
    return false;
  }

  /** Play the one-shot death animation (idempotent). */
  startDeath() {
    if (this.dying) return;
    this.alive = false;
    this.dying = true;
    // Re-snapshot root so the death clip's pos/rot deltas start from the
    // zombie's current position & facing, not the original spawn point.
    this.animator.captureRest('root');
    this.animator.play('death', { loop: false });
  }

  /** True once the death animation has finished playing. */
  get deathDone() {
    return this.dying && !this.animator.playing;
  }

  /**
   * Hand the group back to the pool for the next wave (or really dispose
   * it when the pool is full).
   */
  /** Hand the group back to its type's pool (or dispose when the pool is full). */
  release() {
    this.animator.stop();
    this.group.userData.enemyRef = null;
    this.scene.remove(this.group);
    const pool = pools.get(this._texDef);
    if (pool.length < POOL_MAX) {
      pool.push(this.group);
    } else {
      this._disposeHard();
    }
  }

  /** Remove from scene, dispose geometry and cloned materials. */
  dispose() {
    this.animator.stop();
    this.scene.remove(this.group);
    this._disposeHard();
  }

  _disposeHard() {
    const materials = new Set();
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.isMesh && obj.material) materials.add(obj.material);
    });
    for (const mat of materials) mat.dispose();
  }
}
