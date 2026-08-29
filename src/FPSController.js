import * as THREE from 'three';

/**
 * FPSController.js
 * A first-person player controller with:
 *  - WASD movement relative to camera yaw
 *  - Sprint (Shift), Jump (Space)
 *  - Gravity
 *  - AABB collision against static obstacles (crates / walls)
 *
 * The controller owns the camera and the gun model.
 */
export class FPSController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Scene} scene
   * @param {THREE.Group} gun - gun model to attach to camera
   * @param {HTMLCanvasElement} domElement - the canvas element for pointer lock
   * @param {object} [options]
   */
  constructor(camera, scene, gun, domElement, options = {}) {
    this.camera = camera;
    this.scene = scene;
    this.gun = gun;
    this.domElement = domElement;

    // Tunable parameters
    this.params = {
      speed: 6,
      sprintSpeed: 10,
      jumpForce: 7,
      gravity: 20,
      eyeHeight: 1.6,
      playerRadius: 0.4,
      playerHeight: 1.8,
      mouseSensitivity: 0.002,
      // Slide (CoD-style): C on the ground gives a speed burst that decays.
      slideSpeed: 11,
      slideDuration: 0.7,
      slideDrop: 0.45, // how far the camera crouches during the slide
      ...options,
    };

    // Physics state
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.position = new THREE.Vector3(0, this.params.eyeHeight, 0);

    // Input state
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this._yaw = 0;
    this._pitch = 0;

    // Gun bobbing
    this._gunBobTime = 0;
    this._gunRecoil = 0;
    this._cameraRecoil = 0;
    this._shakeTime = 0;
    this._shakeStrength = 0;
    this._cameraBobTime = 0;

    // Obstacles for collision (set by scene)
    this.obstacles = [];

    // Attach gun to camera (skip if no gun model).
    // NOTE: do NOT traverse-and-force layers here. createGunMesh() already
    // puts every *mesh* on layer 1; forcing the Group nodes onto layer 1
    // would later drag child objects (the hands, parented to the gun) onto
    // layer 0 via any future traverse, and forcing renderOrder on groups is
    // meaningless. Layers are owned by the mesh factories.
    if (this.gun) {
      this.camera.add(this.gun);
      this.gun.position.set(0.25, -0.2, -0.5);
    }
    this.scene.add(this.camera);

    // First-person legs (CoD-style). Attach after the camera is in the scene.
    this.legs = null;
    this._legPhase = 0;
    this._legAmp = 0;

    // Slide state (CoD-style slide on C)
    this._slideTime = 0;
    this._slideDrop = 0;
    this._slideKeyLatch = false;

    this._bindInput();
  }

  /**
   * Register static obstacles (objects with userData.collision).
   * @param {THREE.Object3D[]} obstacles
   */
  setObstacles(obstacles) {
    this.obstacles = obstacles;
  }

  /**
   * Set (or swap) the viewmodel gun parented to the camera. The weapon
   * manager owns the gun meshes and calls this on every switch; without it
   * this.gun stays null and _updateGun() (run bob + recoil) never runs.
   * @param {THREE.Group} gun
   */
  setGun(gun) {
    this.gun = gun || null;
  }

  /**
   * Per-weapon attachment modifiers, called by the weapon manager whenever
   * the active gun changes. foregrip: steadier viewmodel bob. lightStock:
   * longer, faster slide.
   * @param {{foregrip?: boolean, lightStock?: boolean}} mods
   */
  setWeaponMods(mods = {}) {
    this._bobMul = mods.foregrip ? 0.65 : 1;
    this._slideMul = mods.lightStock ? 1.4 : 1;
  }

  /**
   * Attach the first-person legs viewmodel to the camera (at the hips).
   * @param {THREE.Group} legs - from createLegsMesh()
   */
  attachLegs(legs) {
    if (!legs) return;
    // World-space legs (a real body, not a camera-attached viewmodel).
    // Camera-parented legs follow the gaze and are ALWAYS visible at the
    // bottom of the screen. Adding them to the scene at the player's body
    // instead means they only enter the view when the player looks down
    // at their feet. World layer (0) so ground depth occludes them.
    legs.traverse((o) => o.layers.set(0));
    // Hip height above the feet: the leg model spans y 0 (hip) .. -0.74
    // (boot sole), so the hips sit 0.74 m above the ground.
    this._legHipH = 0.74;
    this.scene.add(legs);
    this.legs = legs;
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      this.keys[e.code] = true;
      // Prevent page scroll on space
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this._onMouseMove = (e) => {
      if (document.pointerLockElement !== this.domElement) return;
      this.mouse.x = e.movementX;
      this.mouse.y = e.movementY;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
  }

  /**
   * Apply a recoil kick to the gun (called by the weapon).
   * Punchier per-weapon feel: heavier guns kick the camera up harder.
   * @param {string} [weaponName]
   */
  addRecoil(weaponName = 'Pistol') {
    const kick = {
      Pistol: { gun: 0.07, cam: 0.032, shake: 0.018 },
      Rifle: { gun: 0.055, cam: 0.024, shake: 0.013 },
      Shotgun: { gun: 0.13, cam: 0.065, shake: 0.032 },
      Thompson: { gun: 0.05, cam: 0.02, shake: 0.011 },
    }[weaponName] || { gun: 0.07, cam: 0.032, shake: 0.018 };
    this._gunRecoil = kick.gun;
    this._cameraRecoil = kick.cam;
    this._shakeTime = 0.12;
    this._shakeStrength = kick.shake;
    // Small random yaw kick so the spray pattern isn't perfectly vertical.
    this._yaw += (Math.random() * 2 - 1) * kick.cam * 0.35;
  }

  /**
   * Hit feedback: sharp camera jolt when the player takes damage.
   */
  addHitFlinch() {
    this._cameraRecoil = Math.min(this._cameraRecoil, -0.02);
    this._shakeTime = 0.18;
    this._shakeStrength = Math.max(this._shakeStrength, 0.03);
  }

  /**
   * Update the controller.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    // Clamp dt to avoid huge jumps when tab is inactive
    dt = Math.min(dt, 0.05);

    // --- Look ---
    this._yaw -= this.mouse.x * this.params.mouseSensitivity;
    this._pitch -= this.mouse.y * this.params.mouseSensitivity;
    this._pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, this._pitch)
    );
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this._pitch, this._yaw, 0, 'YXZ')
    );
    if (Math.abs(this._cameraRecoil) > 0.0005) {
      this.camera.rotateX(this._cameraRecoil);
      this._cameraRecoil = THREE.MathUtils.lerp(this._cameraRecoil, 0, 0.25);
    }
    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const s = this._shakeStrength * Math.max(this._shakeTime / 0.12, 0);
      this.camera.position.x += (Math.random() * 2 - 1) * s;
      this.camera.position.y += (Math.random() * 2 - 1) * s;
      this.camera.position.z += (Math.random() * 2 - 1) * s;
    }
    this.mouse.x = 0;
    this.mouse.y = 0;

    // --- Movement input ---
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(forward);
    if (this.keys['KeyS']) move.sub(forward);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);

    const sprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const speed = sprinting ? this.params.sprintSpeed : this.params.speed;

    // --- Slide: press C on the ground while moving to kick into a slide ---
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const cHeld = !!this.keys['KeyC'];
    if (
      cHeld && !this._slideKeyLatch &&
      this.onGround && this._slideTime <= 0 &&
      (move.lengthSq() > 0 || horizSpeed > 2)
    ) {
      this._slideTime = this.params.slideDuration * (this._slideMul || 1);
      // Kick off along the current travel direction, or straight ahead
      // when starting from a standstill-ish state.
      const dir = horizSpeed > 1.5
        ? new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize()
        : forward.clone();
      this.velocity.x = dir.x * this.params.slideSpeed;
      this.velocity.z = dir.z * this.params.slideSpeed;
    }
    this._slideKeyLatch = cHeld;
    const sliding = this._slideTime > 0;
    if (sliding) this._slideTime -= dt;

    if (sliding) {
      // No acceleration while sliding — only gentle friction decay plus a
      // little air-steering so the player can curve slightly.
      const steer = move.lengthSq() > 0 ? 0.04 : 0.015;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, move.x * this.params.speed, steer);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, move.z * this.params.speed, steer);
    } else if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      // Smooth acceleration
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, move.x, 0.2);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, move.z, 0.2);
    } else {
      // Friction when no input
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, 0.2);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, 0.2);
    }

    // --- Gravity ---
    this.velocity.y -= this.params.gravity * dt;

    // --- Jump ---
    if (this.keys['Space'] && this.onGround && !sliding) {
      this.velocity.y = this.params.jumpForce;
      this.onGround = false;
    }

    // --- Integrate position ---
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // --- Collision ---
    this._resolveCollisions();

    // --- Ground check ---
    const groundY = this.params.eyeHeight;
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // --- Apply to camera ---
    this.camera.position.copy(this.position);

    // --- Slide crouch: dip the camera toward the ground, then stand back up ---
    const dropTarget = sliding ? this.params.slideDrop : 0;
    this._slideDrop = THREE.MathUtils.lerp(this._slideDrop, dropTarget, Math.min(1, dt * (sliding ? 14 : 8)));
    this.camera.position.y -= this._slideDrop;

    // --- Legs follow the body in world space (yaw-aligned, feet on ground) ---
    if (this.legs) {
      const feetY = this.position.y - this.params.eyeHeight;
      this.legs.position.set(this.position.x, feetY + this._legHipH - this._slideDrop * 0.6, this.position.z);
      this.legs.rotation.y = this._yaw;
    }

    // --- Camera bobbing while walking on ground (harder when sprinting) ---
    const moving = move.lengthSq() > 0;
    const runFactor = THREE.MathUtils.clamp(speed / this.params.sprintSpeed, 0, 1);
    if (moving && this.onGround) {
      this._cameraBobTime += dt * speed * 1.2;
      this._legPhase += dt * speed * (sliding ? 1.6 : 0.9); // legs step in sync with the run
    }
    // Sprinting adds a heavier, faster bob. Sliding steadies the bob.
    const bobScale = (0.6 + 0.8 * runFactor) * (sliding ? 0.3 : 1);
    const bobY = Math.abs(Math.sin(this._cameraBobTime)) * 0.035 * bobScale;
    const bobX = Math.sin(this._cameraBobTime * 0.5) * 0.012 * bobScale;
    this.camera.position.y += bobY;
    this.camera.position.x += bobX;
    // Roll bobbing applied via quaternion to stay in sync with setFromEuler
    const roll = Math.sin(this._cameraBobTime * 0.5) * 0.004 * bobScale;
    this.camera.quaternion.multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, roll, 'XYZ'))
    );

    // --- First-person legs: step when moving, settle when still ---
    this._updateLegs(dt, moving && this.onGround, speed);

    // --- Gun bobbing + recoil ---
    this._updateGun(dt, speed, moving);
  }

  /**
   * Animate the first-person legs: a step amplitude that eases in when moving
   * and out when stopping, driving the hip/knee joints (CoD-style running).
   * @param {number} dt
   * @param {boolean} moving - currently moving on the ground
   * @param {number} speed - current move speed (used for sprint scaling)
   */
  _updateLegs(dt, moving, speed) {
    if (!this.legs) return;
    const sprint = THREE.MathUtils.clamp(speed / this.params.sprintSpeed, 0, 1);
    // Large stride amplitude: the hip/knee swing is what brings the boots
    // into the bottom of the frame while running. The hips themselves stay
    // fixed, so the legs can never climb toward eye level.
    const targetAmp = moving ? 0.4 + 0.25 * sprint : 0.02;
    this._legAmp = THREE.MathUtils.lerp(this._legAmp ?? 0, targetAmp, 0.15);
    // Slide blend 0..1 from the crouch drop for the tucked slide pose.
    const slideBlend = THREE.MathUtils.clamp(this._slideDrop / (this.params.slideDrop || 0.45), 0, 1);
    this.legs.userData.legs.update(this._legPhase, this._legAmp, slideBlend);
  }

  /**
   * Resolve AABB collisions with static obstacles.
   * Player is treated as a capsule approximated by an AABB.
   */
  _resolveCollisions() {
    const p = this.params;
    const halfW = p.playerRadius;
    const feetY = this.position.y - p.eyeHeight;
    const playerMin = new THREE.Vector3(
      this.position.x - halfW,
      feetY,
      this.position.z - halfW
    );
    const playerMax = new THREE.Vector3(
      this.position.x + halfW,
      feetY + p.playerHeight,
      this.position.z + halfW
    );

    for (const obs of this.obstacles) {
      const col = obs.userData.collision;
      if (!col) continue;
      const center = obs.position;
      const half = col.size.clone().multiplyScalar(0.5);
      const obsMin = new THREE.Vector3(
        center.x - half.x,
        center.y - half.y,
        center.z - half.z
      );
      const obsMax = new THREE.Vector3(
        center.x + half.x,
        center.y + half.y,
        center.z + half.z
      );

      // Check overlap
      if (
        playerMin.x < obsMax.x && playerMax.x > obsMin.x &&
        playerMin.y < obsMax.y && playerMax.y > obsMin.y &&
        playerMin.z < obsMax.z && playerMax.z > obsMin.z
      ) {
        // Compute penetration on each axis
        const overlapX = Math.min(playerMax.x - obsMin.x, obsMax.x - playerMin.x);
        const overlapY = Math.min(playerMax.y - obsMin.y, obsMax.y - playerMin.y);
        const overlapZ = Math.min(playerMax.z - obsMin.z, obsMax.z - playerMin.z);

        // Resolve along the smallest penetration axis
        if (overlapX < overlapY && overlapX < overlapZ) {
          const dir = this.position.x < center.x ? -1 : 1;
          this.position.x += dir * overlapX;
          this.velocity.x = 0;
        } else if (overlapY < overlapZ) {
          const dir = this.position.y < center.y ? -1 : 1;
          this.position.y += dir * overlapY;
          if (dir < 0) {
            this.velocity.y = 0;
            this.onGround = true;
          }
        } else {
          const dir = this.position.z < center.z ? -1 : 1;
          this.position.z += dir * overlapZ;
          this.velocity.z = 0;
        }
      }
    }
  }

  /**
   * Set the gun's rest anchor (position/rotation) that bobbing and recoil
   * are layered on top of. Used by WeaponManager for ADS / reload dips so
   * the two systems never fight over the same transform.
   */
  setGunBasePosition(x, y, z) {
    this._gunBasePos = this._gunBasePos || new THREE.Vector3();
    this._gunBasePos.set(x, y, z);
  }

  setGunBaseRotation(x, y, z) {
    this._gunBaseRot = this._gunBaseRot || new THREE.Euler();
    this._gunBaseRot.set(x, y, z);
  }

  /**
   * Update gun bobbing and recoil. The hands are parented to the gun, so
   * this motion carries them too (run bob applies to weapon + hands).
   */
  _updateGun(dt, speed, moving) {
    if (!this.gun) return;
    const base = this._gunBasePos || (this._gunBasePos = new THREE.Vector3(0.25, -0.2, -0.5));
    const baseRot = this._gunBaseRot || (this._gunBaseRot = new THREE.Euler(0, 0, 0));

    // Bobbing — figure-8 sway that scales with move speed (harder when
    // sprinting). Advance the phase a little while airborne too so the
    // weapon doesn't snap when landing.
    if (moving) this._gunBobTime += dt * (4 + speed * 0.9);
    const runFactor = THREE.MathUtils.clamp(speed / this.params.sprintSpeed, 0, 1);
    const amp = (moving && this.onGround ? 0.4 + 0.6 * runFactor : 0) * (this._bobMul || 1);
    const bobX = Math.sin(this._gunBobTime) * 0.022 * amp;
    const bobY = -Math.abs(Math.sin(this._gunBobTime)) * 0.018 * amp;
    const bobZ = Math.cos(this._gunBobTime * 2) * 0.008 * amp;

    // Recoil decay
    this._gunRecoil = THREE.MathUtils.lerp(this._gunRecoil, 0, 0.2);

    this.gun.position.set(
      base.x + bobX,
      base.y + bobY + this._gunRecoil,
      base.z + bobZ + this._gunRecoil
    );
    this.gun.rotation.set(
      baseRot.x - this._gunRecoil * 0.8 + bobY * 1.5,
      baseRot.y + bobX * 0.6,
      baseRot.z + bobX * 0.8
    );
  }

  /**
   * Get the world position of the muzzle (for tracers).
   * @returns {THREE.Vector3}
   */
  getMuzzlePosition() {
    if (!this.gun) return this.camera.position.clone();
    const muzzle = this.gun.userData.muzzle;
    return muzzle ? muzzle.getWorldPosition(new THREE.Vector3()) : this.camera.position.clone();
  }
}