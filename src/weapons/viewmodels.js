import * as THREE from 'three';
import { buildModel } from '../ModelLoader.js';
import { Animator } from '../Animation.js';
import { weaponTexture } from '../../textures/weapon.js';
import { shotgunTexture } from '../../textures/shotgun.js';
import { pistolModel } from '../../models/pistol.js';
import { handsModel } from '../../models/hands.js';
import { handsTexture } from '../../textures/hands.js';
import { legModel } from '../../models/legs.js';
import { legsTexture } from '../../textures/legs.js';
import { MODEL_BY_NAME, SKINS } from './defs.js';
import { ATTACH_ANCHORS, buildIronSights } from './attachments.js';

/**
 * weapons/viewmodels.js
 * Viewmodel (layer 1) meshes: gun, skins, hands and first-person legs.
 */

/**
 * Put a subtree on the viewmodel layer: opaque meshes drawn AFTER the world
 * with a cleared depth buffer, so nothing ever embeds into walls.
 */
export function applyViewmodelSettings(group) {
  group.traverse((o) => {
    o.layers.set(1);
    if (o.isMesh) {
      o.material.depthTest = true;
      o.material.depthWrite = true;
      o.material.transparent = false;
      o.material.opacity = 1;
      o.renderOrder = 1;
    }
  });
}

/**
 * Tint every textured part of a gun group with a skin. Mesh materials are
 * cloned first — buildModel() caches one material per texture and it is
 * shared across all guns, so mutating it would reskin every weapon.
 * Attachment meshes have no texture map and keep their own colors.
 */
export function applySkin(group, skinId) {
  const skin = SKINS[skinId];
  if (!skin) return;
  group.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    // Optic glass keeps its own transparency — never reskin or clone it.
    if (o.material.userData && o.material.userData.isGlass) return;
    o.material = o.material.clone();
    if (o.material.map) {
      // Textured body parts: tint multiplies over the pixel texture.
      if (skin.color != null) o.material.color.setHex(skin.color);
    } else if (skin.tint != null) {
      // Untextured metal parts (iron sights etc.): direct tint colour.
      o.material.color.setHex(skin.tint);
    }
    if (skin.metalness != null) o.material.metalness = skin.metalness;
    if (skin.roughness != null) o.material.roughness = skin.roughness;
    o.material.needsUpdate = true;
  });
}

/**
 * Create the gun viewmodel for a weapon def.
 * @param {object} def
 * @returns {THREE.Group}
 */
export function createGunMesh(def) {
  const model = MODEL_BY_NAME[def.name] || pistolModel;
  const group = buildModel(model, def.name === 'Shotgun' ? shotgunTexture : weaponTexture);

  // Muzzle marker: find element named 'muzzle' (or 'muzzleL' for shotgun)
  let muzzle = group.getObjectByName('muzzle');
  if (!muzzle) muzzle = group.getObjectByName('muzzleL');
  if (!muzzle) {
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, -0.5);
    group.add(muzzle);
  }

  group.userData.type = 'gun';
  group.userData.muzzle = muzzle;

  // Attach Animator for keyframe-based fire/reload animations
  if (model.anims) {
    group.userData.animator = new Animator(group, model.anims);
  }

  // Iron sights: detailed front post (wings + red dot) and rear notch,
  // seated flush on the barrel/receiver top per ATTACH_ANCHORS.sight.
  const sightA = (ATTACH_ANCHORS[def.name] || ATTACH_ANCHORS.Pistol).sight || { front: [0, 0.06, -0.25] };
  const sight = buildIronSights(sightA);
  group.add(sight);

  applyViewmodelSettings(group);

  return group;
}

/**
 * Build the first-person hands viewmodel.
 * The hands are built in the weapon's local space (grip at +z, barrel at -z)
 * so the same model grips every gun. They live on the viewmodel layer and
 * are parented to the active gun so they follow it through every anim.
 * @returns {THREE.Group}
 */
export function createHandsMesh() {
  const group = buildModel(handsModel, handsTexture);
  group.userData.type = 'hands';

  // Viewmodel: same opaque, after-world treatment as the gun.
  applyViewmodelSettings(group);

  // Angle the forearms down-and-out so they form a V (like real FPS
  // viewmodels). Each sleeve is a thin box pointing at the camera, pivoted at
  // the hand; rotating it swings the camera end down and outward. This must
  // happen BEFORE the Animator snapshots the rest pose so the V is the base.
  const sleeveR = group.getObjectByName('sleeveR');
  if (sleeveR) sleeveR.rotation.set(0.55, 0.4, 0);
  const sleeveL = group.getObjectByName('sleeveL');
  if (sleeveL) sleeveL.rotation.set(0.55, -0.4, 0);

  // Keyframe animator for idle / fire / reload hand motion.
  group.userData.animator = new Animator(group, handsModel.anims);
  group.userData.animator.play('idle');

  return group;
}

/**
 * Build a single articulated first-person leg (hip -> thigh -> knee -> boot).
 * Uses buildModel for the boxes, then re-parents the pivots so the knee can
 * bend. Returns a Group rooted at the hip with the animated pivots exposed.
 * @returns {{ root: THREE.Group, thigh: THREE.Object3D, knee: THREE.Object3D }}
 */
function buildLeg() {
  const leg = buildModel(legModel, legsTexture);
  applyViewmodelSettings(leg);

  const thigh = leg.getObjectByName('thigh');
  const shin = leg.getObjectByName('shin');
  const boot = leg.getObjectByName('boot');

  // Re-parent so the knee (shin pivot) is a child of the thigh, and the boot
  // is a child of the shin. Local offsets match the model's straight-down rest.
  if (thigh && shin && boot) {
    shin.removeFromParent();
    thigh.add(shin);
    shin.position.set(0, -0.34, 0); // knee, relative to hip (thigh origin)
    boot.removeFromParent();
    shin.add(boot);
    boot.position.set(0, -0.28, 0); // ankle, relative to knee
  }

  return { root: leg, thigh: thigh || leg, knee: shin || thigh };
}

/**
 * Build the first-person legs viewmodel (CoD-style stepping legs).
 * Two legs rooted at the hips; animated by the FPSController via
 * `userData.legs.update(phase, moving, sprinting)`.
 * @returns {THREE.Group}
 */
export function createLegsMesh() {
  const group = new THREE.Group();
  group.userData.type = 'legs';

  const L = buildLeg();
  const R = buildLeg();
  // Full-size legs: they live in WORLD space on the player's body (see
  // FPSController.attachLegs), so they no longer need to fit inside the
  // camera frustum. The player sees them by looking down at their feet.
  L.root.position.set(-0.13, 0, 0);
  R.root.position.set(0.13, 0, 0);
  group.add(L.root, R.root);

  // The whole legs group is placed at the hips by the controller.
  group.userData.legs = {
    L, R,
    /**
     * @param {number} phase - walk-cycle phase in radians
     * @param {number} amp - step amplitude (0 = idle, >0 walking)
     * @param {number} slide - 0..1 slide blend; tucks the knees CoD-style
     */
    update(phase, amp, slide = 0) {
      if (slide > 0.01) {
        // Slide pose: lead leg extended forward, trail leg tucked under.
        const s = Math.min(1, slide);
        const idleSwing = Math.sin(phase) * amp;
        L.thigh.rotation.x = THREE.MathUtils.lerp(idleSwing, -0.9, s);
        R.thigh.rotation.x = THREE.MathUtils.lerp(-idleSwing, 0.55, s);
        L.knee.rotation.x = THREE.MathUtils.lerp(L.knee.rotation.x, -0.1, s);
        R.knee.rotation.x = THREE.MathUtils.lerp(R.knee.rotation.x, -1.1, s);
        return;
      }
      const swing = Math.sin(phase) * amp;
      const swingR = Math.sin(phase + Math.PI) * amp;
      // Swing each leg at the hip.
      L.thigh.rotation.x = swing;
      R.thigh.rotation.x = swingR;
      // Bend the knee only when that leg is swinging back (lift the foot).
      // Clamped: a huge knee bend swings the boot up under the camera and
      // fills the screen (legs appearing at eye level).
      const bendL = Math.min(0.5, Math.max(0, -Math.sin(phase)) * amp * 1.1);
      const bendR = Math.min(0.5, Math.max(0, -Math.sin(phase + Math.PI)) * amp * 1.1);
      L.knee.rotation.x = -bendL;
      R.knee.rotation.x = -bendR;
    },
  };

  return group;
}
