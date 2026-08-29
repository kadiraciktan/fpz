import * as THREE from 'three';
import { buildModel } from './ModelLoader.js';
import { Animator } from './Animation.js';
import { zombieModel } from '../models/zombie.js';
import { zombieTexture } from '../textures/zombie.js';

/**
 * Enemy.js
 * Zombie AI with type variants, lure distractions, obstacle collision and
 * mesh pooling (groups are recycled across waves instead of rebuilt).
 */

/**
 * Zombie type presets. Multipliers apply over the base params; `tint`
 * recolors the cloned skin material, `score` is the kill reward.
 *  bomber detonates when the player gets too close — keep your distance!
 */
export const ENEMY_TYPES = {
  normal: { score: 60 },
  sprinter: { speedMul: 2.1, healthMul: 0.6, scale: 0.85, tint: 0xd8cfa8, score: 70 },
  brute: { speedMul: 0.55, healthMul: 3.2, damageMul: 2, scale: 1.45, tint: 0x66794f, score: 130 },
  bomber: { speedMul: 1.15, healthMul: 1, scale: 1.1, tint: 0xe08a3c, explosive: true, detonateRange: 2.3, score: 90 },
};

// Recycled viewmodel groups, shared across all Enemy instances.
const POOL_MAX = 10;
const pool = [];

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
    this.params.health *= v.healthMul ?? 1;
    this.params.damage *= v.damageMul ?? 1;
    // Explosive flag comes from the preset only (options spread above can't
    // accidentally arm a non-bomber).
    this.params.explosive = !!v.explosive;

    this.health = this.params.health;
    this.alive = true;
    this.dying = false;
    this.exploded = false;
    this._attackTimer = 0;
    this._bobTime = Math.random() * 10;
    this._currentAnim = null;
    this._lurePos = null;
    this._lureTimer = 0;

    // Build (or recycle) the zombie group.
    this._meshes = [];
    const pooled = pool.pop();
    if (pooled) {
      this.group = pooled;
      this._resetPooled();
    } else {
      this.group = buildModel(zombieModel, zombieTexture);
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

    // Keyframe animations (idle / walk / attack / death)
    this.animator = new Animator(this.group, zombieModel.anims);
    this.animator.play('idle');
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
    // Hit-flash decay (white-hot tint that fades over ~0.12 s)
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 8);
      const e = this._flash;
      for (const m of this._meshes) m.material.emissive.setRGB(e, e * 0.35, e * 0.35);
    } else if (this.params.explosive && this.alive && !this.dying) {
      // Bomber: ominous orange pulse.
      const p = 0.35 + 0.25 * Math.sin(performance.now() * 0.012);
      for (const m of this._meshes) m.material.emissive.setRGB(p, p * 0.35, 0);
    }

    // Knockback impulse decay
    if (this._kb.lengthSq() > 1e-4) {
      this.group.position.addScaledVector(this._kb, dt);
      this._kb.multiplyScalar(Math.max(0, 1 - dt * 10));
    }

    if (this.dying) {
      // Death animation is playing; main loop removes us when it finishes.
      this.animator.update(dt);
      return 0;
    }

    if (!this.alive) return 0;

    const dir = this._dir || (this._dir = new THREE.Vector3());
    const pos = this.group.position;

    // Bomber: proximity detonation — big damage, main loop handles the FX.
    if (this.params.explosive) {
      const pd = pos.distanceTo(playerPos);
      if (pd < this.params.detonateRange) {
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
      const playerDist = pos.distanceTo(playerPos);
      if (this._lurePos && playerDist > this.params.attackRange) target = this._lurePos;
      if (this._lureTimer <= 0) this._lurePos = null;
    }

    dir.copy(target).sub(pos);
    dir.y = 0;
    const dist = dir.length();

    let damaged = 0;

    if (target === playerPos && dist > this.params.attackRange) {
      dir.normalize();
      this.group.position.addScaledVector(dir, this.params.speed * dt);
      this._collideObstacles();
      this._chewSandbags(dt, dir);

      // Face the player
      this.group.rotation.y = Math.atan2(dir.x, dir.z);

      // Walking animation
      if (this._currentAnim !== 'walk') {
        this.animator.play('walk');
        this._currentAnim = 'walk';
      }
      this.animator.update(dt);
    } else if (target === playerPos) {
      // In range: attack
      if (this._currentAnim !== 'attack' && !this.animator.playing) {
        this.animator.play('attack', { loop: false });
        this._currentAnim = 'attack';
      }
      this._attackTimer -= dt;
      if (this._attackTimer <= 0) {
        this._attackTimer = this.params.attackCooldown;
        damaged = this.params.damage;
      }
      this.animator.update(dt);
    } else {
      // Lured: shamble to the noise, then mill around it harmlessly.
      if (dist > 0.8) {
        dir.normalize();
        this.group.position.addScaledVector(dir, this.params.speed * 0.8 * dt);
        this._collideObstacles();
        this._chewSandbags(dt, dir);
        this.group.rotation.y = Math.atan2(dir.x, dir.z);
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
      this.animator.update(dt);
    }

    // Subtle vertical bob (walk vs idle)
    if (this._currentAnim === 'walk') {
      this._bobTime += dt;
      this.group.position.y = Math.abs(Math.sin(this._bobTime * 5)) * 0.03;
    } else if (this._currentAnim === 'idle') {
      this._bobTime += dt;
      this.group.position.y = Math.abs(Math.sin(this._bobTime * 2)) * 0.02;
    }

    return damaged;
  }

  /**
   * Push the zombie out of tall static obstacles (buildings, crates,
   * sandbags). Low rubble (<0.8 m) is walkable and skipped, same rule as
   * the player controller.
   */
  _collideObstacles() {
    if (!this._obstacles) return;
    const p = this.group.position;
    const r = 0.32;
    for (const obs of this._obstacles) {
      const col = obs.userData.collision;
      if (!col || col.size.y <= 0.8) continue;
      const hx = col.size.x / 2 + r;
      const hz = col.size.z / 2 + r;
      const dx = p.x - obs.position.x;
      const dz = p.z - obs.position.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const penX = hx - Math.abs(dx);
        const penZ = hz - Math.abs(dz);
        if (penX < penZ) p.x = obs.position.x + (dx >= 0 ? hx : -hx);
        else p.z = obs.position.z + (dz >= 0 ? hz : -hz);
      }
    }
  }

  /** Zombies stuck against a sandbag chew through it (~5 s). */
  _chewSandbags(dt, moveDir) {
    if (!this._sandbags || !this._sandbags.length) return;
    const p = this.group.position;
    for (const bag of this._sandbags) {
      if (bag.userData.hp <= 0) continue;
      const d = bag.position.distanceTo(p);
      if (d > 1.6) continue;
      // Only bags actually in the zombie's way.
      const toBag = bag.position.clone().sub(p).setY(0).normalize();
      if (toBag.dot(moveDir) < 0.4) continue;
      bag.userData.hp -= 14 * dt;
    }
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
  release() {
    this.animator.stop();
    this.group.userData.enemyRef = null;
    this.scene.remove(this.group);
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
