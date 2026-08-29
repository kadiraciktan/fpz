import * as THREE from 'three';
import { OPTICS, activeOptic, MODEL_BY_NAME } from './defs.js';

/**
 * weapons/attachments.js
 * Attachment anchors, availability rules, and visual mesh builders
 * (optics, suppressor, foregrip, extended mag, skeleton stock, iron sights).
 */

/**
 * Per-weapon attachment anchors (metres, gun-local space; barrel = -Z).
 * DERIVED at load time from each model's part boxes (from/to) so attachments
 * always sit flush with the real geometry — no hand-tuned magic numbers to
 * drift out of sync when models change. `ATTACH_RULES` keeps the
 * non-geometric decisions (which weapons take the long scope tube / prism).
 *  muzzle/muzzleR — suppressor centre-line and barrel radius at the tip
 *  bodyTop/scopeZ/scopeLen — optic mount height + scope tube placement
 *  mag/magSize — source magazine box centre + size (null = none)
 *  grip — foregrip mount under the handguard (null = none)
 *  stock — skeleton stock spec { hide:[parts], from, pad, y } (null = none)
 */

/** Non-geometric mount rules per weapon (scope tube length, prism mount). */
const ATTACH_RULES = {
  Rifle: { scopeLen: 0.22, acog: true },
  Shotgun: { acog: true },
  M4A1: { scopeLen: 0.2, acog: true },
  Cal50: { scopeLen: 0.26, acog: true },
};

/** Derive flush-fitting anchors for one weapon from its model element boxes. */
function deriveAnchors(model) {
  const els = model.elements || [];
  const by = (n) => els.find((e) => e.name === n);
  const c = (e) => [(e.from[0] + e.to[0]) / 2, (e.from[1] + e.to[1]) / 2, (e.from[2] + e.to[2]) / 2];
  const sz = (e) => [e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]];

  // Muzzle: dedicated 'muzzle' tip box, else the barrel's front face.
  const barrel = by('barrel') || by('muzzle');
  const tip = by('muzzle') || barrel;
  let muzzle = null;
  let muzzleR = 0.016;
  if (tip) {
    const mid = c(tip);
    muzzle = [mid[0], mid[1], tip.from[2]]; // front face (barrel points -Z)
    muzzleR = Math.max(sz(tip)[0], sz(tip)[1]) / 2;
  }

  // Optic rail height: rail top if present, else receiver/body top.
  const rail = by('rail');
  const body = by('receiver') || by('body') || by('action');
  const bodyTop = (rail || body) ? (rail || body).to[1] : 0.06;
  const scopeZ = rail ? c(rail)[2] : body ? c(body)[2] - 0.03 : -0.05;

  // Magazine: first box that IS the magazine (skip trigger_guard etc.).
  const mag = by('mag') || by('boxmag') || by('magazine') || by('drum') || by('mag_base');
  const magPos = mag ? c(mag) : null;
  const magSize = mag ? sz(mag) : null;

  // Foregrip: hangs under the handguard/pump/forend (wood foregrips are
  // deliberately NOT mount points — the Thompson keeps its own).
  const guard = by('handguard') || by('pump') || by('forend');
  const grip = guard ? [0, guard.from[1] - 0.035, c(guard)[2]] : null;

  // Skeleton stock: every stock/butt/cheek part hidden and replaced. The
  // strut must REACH the receiver — stock boxes usually start a few cm
  // behind the body, so anchoring at the stock's own front edge leaves a
  // visible gap once the original stock is hidden.
  const stockEls = els.filter((e) => /^(stock|butt|buttstock|buttplate|cheek)/.test(e.name));
  let stock = null;
  if (stockEls.length) {
    const main = [...stockEls].sort((a, b) => sz(b)[2] - sz(a)[2])[0];
    stock = {
      hide: stockEls.map((e) => e.name),
      from: body ? body.to[2] : Math.min(...stockEls.map((e) => e.from[2])),
      pad: Math.max(...stockEls.map((e) => e.to[2])) - 0.012,
      y: c(main)[1],
    };
  }

  // Iron sights: front post at the barrel's fore-end, rear at the receiver's
  // back — both just under the local surface top so the posts root into it.
  const sight = barrel
    ? {
        front: [0, bodyTop - 0.012, tip ? tip.from[2] + 0.03 : c(barrel)[2]],
        rear: body ? [0, bodyTop - 0.006, body.to[2] - 0.06] : null,
      }
    : { front: null, rear: null };

  return { muzzle, muzzleR, bodyTop, scopeZ, scopeLen: null, mag: magPos, magSize, grip, stock, sight };
}

export const ATTACH_ANCHORS = {};
for (const [name, model] of Object.entries(MODEL_BY_NAME)) {
  ATTACH_ANCHORS[name] = { ...deriveAnchors(model), ...(ATTACH_RULES[name] || {}) };
}

/** True when `key` can be mounted on `weaponName` (drives Gunsmith cards). */
export function attachmentAvailable(weaponName, key) {
  const A = ATTACH_ANCHORS[weaponName];
  if (!A) return false;
  if (key === 'scope') return !!A.scopeLen; // sniper tube: long-barrel rifles
  if (key === 'acog') return !!A.acog; // prism mount: flagged rifles only
  if (key === 'reflex' || key === 'holo') return true; // fits every rail
  if (key === 'foregrip') return !!A.grip;
  if (key === 'lightStock') return !!A.stock;
  if (key === 'extendedMag') return !!A.mag;
  return true; // suppressor fits every muzzle
}

/**
 * Reticle height above the receiver top, per optic (gun-local +Y).
 * Matches the actual reticle mesh heights in buildOpticMesh:
 *  reflex/holo dot & ring sit at bodyTop + 0.012 + 0.024
 *  acog chevron sits at bodyTop + 0.05 - 0.006
 */
export const OPTIC_SIGHT_OFFSET = { reflex: 0.036, holo: 0.036, acog: 0.044 };

/**
 * Y of the optic's aiming point in gun-local space, or null for weapons/
 * optics without a computed reticle. Used by ADS so the reticle lands on
 * exact screen center (where the bullet raycast actually goes).
 */
export function opticSightHeight(weaponName, optic) {
  const A = ATTACH_ANCHORS[weaponName] || ATTACH_ANCHORS.Pistol;
  const off = OPTIC_SIGHT_OFFSET[optic];
  return off != null ? A.bodyTop + off : null;
}

/**
 * Visual mesh for each optic, seated on the receiver-top mount anchor.
 * All glass is opaque (viewmodel rule); reticles are emissive meshes.
 * @param {'reflex'|'holo'|'acog'|'scope'} optic
 * @param {object} A  ATTACH_ANCHORS entry for the weapon
 * @param {Function} mat  material factory from buildAttachmentMeshes
 */
function buildOpticMesh(optic, A, mat) {
  const g = new THREE.Group();
  const body = mat(0x1a1c1f, 0.4, 0.75);
  const y0 = A.bodyTop;          // receiver top
  const z = A.scopeZ;            // mount centre along the gun
  const box = (w, h, d, x, y, zz, m) => {
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || body);
    m2.position.set(x, y, zz);
    g.add(m2);
    return m2;
  };
  // Real see-through glass: alpha-blended over the world (the viewmodel
  // pass renders after the world with cleared depth, so blending works).
  // depthWrite off + isGlass marker keeps applySkin from reskinning it.
  const glassM = (color, opacity) => {
    const m = mat(color, 0.1, 0.2);
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = false;
    m.side = THREE.DoubleSide; // visible from any orbit angle in the preview
    m.userData.isGlass = true;
    return m;
  };

  // Shared rail plate every optic clamps onto.
  box(0.034, 0.012, 0.06, 0, y0 + 0.006, z);

  if (optic === 'reflex') {
    // Compact red-dot (CompM4 style): hooded window + red dot.
    const y = y0 + 0.012;
    box(0.03, 0.01, 0.03, 0, y + 0.005, z);                    // riser
    box(0.005, 0.03, 0.006, -0.0155, y + 0.024, z);            // left post
    box(0.005, 0.03, 0.006, 0.0155, y + 0.024, z);             // right post
    box(0.034, 0.006, 0.008, 0, y + 0.038, z - 0.004);         // hood top
    const glass = box(0.028, 0.028, 0.002, 0, y + 0.024, z - 0.003);
    glass.material = glassM(0x9fd8ff, 0.18);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.0022, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 2.2 }));
    dot.position.set(0, y + 0.024, z - 0.001);
    g.add(dot);
  } else if (optic === 'holo') {
    // Holographic sight (EOTech style): OPEN hood (no front/rear plates —
    // they blocked the sight picture), tinted glass window in the middle
    // and the projected orange ring floating in front of it.
    const y = y0 + 0.012;
    box(0.03, 0.012, 0.034, 0, y + 0.006, z);                  // riser
    box(0.036, 0.006, 0.032, 0, y + 0.042, z);                 // top bar
    box(0.004, 0.036, 0.032, -0.016, y + 0.024, z);            // left wall
    box(0.004, 0.036, 0.032, 0.016, y + 0.024, z);             // right wall
    box(0.036, 0.008, 0.032, 0, y + 0.008, z);                 // bottom frame
    const win = box(0.028, 0.028, 0.002, 0, y + 0.024, z - 0.004);
    win.material = glassM(0xffa050, 0.2);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x221100, emissive: 0xff7a00, emissiveIntensity: 2.2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0011, 8, 20), ringMat);
    ring.position.set(0, y + 0.024, z - 0.002);
    g.add(ring);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 8), ringMat);
    dot.position.set(0, y + 0.024, z - 0.002);
    g.add(dot);
    box(0.006, 0.012, 0.012, 0.021, y + 0.02, z + 0.004);      // side button
  } else if (optic === 'acog') {
    // 4x prism scope (ACOG style): short fat tube + mount rings + chevron glow.
    const y = y0 + 0.05;
    box(0.02, 0.038, 0.02, 0, y0 + 0.031, z);                  // mount riser
    const tubeMat = mat(0x15171a, 0.35, 0.7);
    // openEnded: no end caps — the tube is a see-through barrel, the two
    // tinted lens discs below are the only thing between eye and target.
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.15, 12, 1, true), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, y, z);
    g.add(tube);
    const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.025, 12, 1, true), tubeMat);
    obj.rotation.x = Math.PI / 2;
    obj.position.set(0, y, z - 0.085);
    g.add(obj);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.02, 12, 1, true), tubeMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, y, z + 0.083);
    g.add(eye);
    for (const rz of [-0.045, 0.03]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 8, 16), body);
      ring.position.set(0, y, z + rz);
      g.add(ring);
    }
    // Transparent objective + eyepiece lenses (circles face +/-Z by default).
    const lensF = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), glassM(0x9fd8ff, 0.16));
    lensF.position.set(0, y, z - 0.0965);
    g.add(lensF);
    const lensB = new THREE.Mesh(new THREE.CircleGeometry(0.019, 16), glassM(0x9fd8ff, 0.16));
    lensB.position.set(0, y, z + 0.0905);
    g.add(lensB);
    // Chevron illumination on the rear lens.
    const chevMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff3010, emissiveIntensity: 1.8 });
    const chev = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.002), chevMat);
    chev.position.set(0, y - 0.006, z + 0.0945);
    g.add(chev);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.012), chevMat);
      leg.position.set(sx * 0.005, y - 0.002, z + 0.0945);
      leg.rotation.z = sx * 0.6;
      g.add(leg);
    }
  } else if (optic === 'scope' && A.scopeLen) {
    // Sniper scope: long tube + mount + two lenses (30° overlay replaces view).
    const y = y0 + 0.045;
    const tubeMat = mat(0x1c1c1c, 0.35, 0.7);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, A.scopeLen, 12, 1, true), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, y, z);
    g.add(tube);
    box(0.03, 0.05, 0.05, 0, y0 + 0.02, z);
    const lensMat = glassM(0x66aaff, 0.3);
    lensMat.emissive = new THREE.Color(0x113355);
    lensMat.emissiveIntensity = 0.6;
    const lensF = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 12), lensMat);
    lensF.rotation.x = Math.PI / 2;
    lensF.position.set(0, y, z - A.scopeLen / 2 - 0.012);
    g.add(lensF);
    const lensB = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 12), lensMat);
    lensB.rotation.x = Math.PI / 2;
    lensB.position.set(0, y, z + A.scopeLen / 2 + 0.01);
    g.add(lensB);
  }
  return g;
}

/**
 * Build the visual meshes for a weapon's attachments (viewmodel layer).
 * Positions come from ATTACH_ANCHORS so each piece sits flush on the gun.
 * When `gunGroup` is given, original parts that the attachment replaces
 * (iron sight under a scope, wooden stock under a skeleton stock) are hidden.
 */
export function buildAttachmentMeshes(def, att = {}, gunGroup = null) {
  const group = new THREE.Group();
  group.name = 'attachments';
  const A = ATTACH_ANCHORS[def.name] || ATTACH_ANCHORS.Pistol;
  const mat = (color, roughness, metalness) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const optic = activeOptic(att);
  if (optic && attachmentAvailable(def.name, optic)) {
    group.add(buildOpticMesh(optic, A, mat));
  }

  if (att.suppressor) {
    // Suppressor: cylinder centred just ahead of the muzzle tip.
    const r = (A.muzzleR || 0.016) + 0.013;
    const len = 0.16;
    const supMat = mat(0x17181a, 0.55, 0.65);
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, len, 12), supMat);
    sup.rotation.x = Math.PI / 2;
    sup.position.set(A.muzzle[0], A.muzzle[1], A.muzzle[2] - len / 2 + 0.015);
    group.add(sup);
  }

  if (att.foregrip && A.grip) {
    // Vertical foregrip hanging just under the barrel.
    const gripMat = mat(0x20221f, 0.8, 0.2);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.035), gripMat);
    grip.position.set(A.grip[0], A.grip[1], A.grip[2]);
    group.add(grip);
  }

  if (att.extendedMag && A.mag) {
    // Extended magazine: an extra box hung off the SOURCE mag's outer face,
    // overlapping ~1.2 cm so the join reads as ONE magazine (derived anchors
    // give A.mag = source centre, A.magSize = source box size).
    const magMat = mat(0x23251f, 0.7, 0.3);
    const [sx, sy, szz] = A.magSize;
    let ext;
    if (sy >= sx) {
      // Bottom-fed magazine: extend downward from the source box's bottom.
      const eh = sy * 0.55 + 0.01;
      ext = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.008, eh, szz + 0.012), magMat);
      ext.position.set(A.mag[0], A.mag[1] - sy / 2 - eh / 2 + 0.012, A.mag[2]);
    } else {
      // Side box mag (LSW): extend outward along the fatter axis.
      const ew = sx * 0.6 + 0.012;
      const sgn = A.mag[0] >= 0 ? 1 : -1;
      ext = new THREE.Mesh(new THREE.BoxGeometry(ew, sy + 0.008, szz + 0.012), magMat);
      ext.position.set(A.mag[0] + sgn * (sx / 2 + ew / 2 - 0.012), A.mag[1], A.mag[2]);
    }
    group.add(ext);
  }

  if (att.lightStock && A.stock) {
    // Skeleton stock: thin strut + shoulder pad + lower brace.
    const stockMat = mat(0x24262a, 0.6, 0.4);
    // Strut runs from 1.5 cm INSIDE the receiver rear face to the pad, so the
    // join is buried in the body — any rounding/animation slack can't open a
    // visible seam between gun and stock.
    const z0 = A.stock.from - 0.015;
    const len = A.stock.pad - z0;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, len), stockMat);
    strut.position.set(0, A.stock.y, (z0 + A.stock.pad) / 2);
    group.add(strut);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.02), stockMat);
    pad.position.set(0, A.stock.y + 0.01, A.stock.pad);
    group.add(pad);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), stockMat);
    brace.position.set(0, A.stock.y - 0.04, A.stock.pad - 0.03);
    group.add(brace);
  }

  // Hide the original parts the attachments replace.
  if (gunGroup) {
    if (optic) {
      const sight = gunGroup.getObjectByName('sight');
      if (sight) sight.visible = false;
    }
    if (att.lightStock && A.stock) {
      for (const partName of A.stock.hide) {
        const part = gunGroup.getObjectByName(partName);
        if (part) part.visible = false;
      }
    }
  }

  group.traverse((o) => {
    o.layers.set(1);
    if (o.isMesh) {
      o.renderOrder = 1;
      o.castShadow = false;
      // Glass blends over the world AND over the gun body behind it.
      if (o.material.userData && o.material.userData.isGlass) o.renderOrder = 2;
    }
  });
  return group;
}

/**
 * Detailed iron-sight assembly: front post with protective wings + red
 * tritium dot, and a rear notch (two ears over a low bridge so the notch
 * opening stays clear). Named 'sight' so a mounted scope can hide it.
 * @param {{front?: number[], rear?: number[]}} spec  base positions
 */
export function buildIronSights(spec = {}) {
  const group = new THREE.Group();
  group.name = 'sight';
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.35, metalness: 0.85 });
  const dotMat = new THREE.MeshStandardMaterial({ color: 0x120303, emissive: 0xff2b18, emissiveIntensity: 1.6, roughness: 0.4 });

  if (spec.front) {
    const [x, y, z] = spec.front;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.024), gunmetal);
    base.position.set(x, y + 0.003, z);
    group.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.026, 0.008), gunmetal);
    post.position.set(x, y + 0.016, z);
    group.add(post);
    // Red tritium dot on the post face.
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.002), dotMat);
    dot.position.set(x, y + 0.024, z - 0.005);
    group.add(dot);
    // Protective wings flanking the post.
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.012), gunmetal);
      wing.position.set(x + sx * 0.011, y + 0.013, z);
      group.add(wing);
    }
  }

  if (spec.rear) {
    const [x, y, z] = spec.rear;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.02), gunmetal);
    base.position.set(x, y + 0.003, z);
    group.add(base);
    // Low bridge (kept short so the notch opening is clear) + two ears.
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.012), gunmetal);
    bridge.position.set(x, y + 0.01, z);
    group.add(bridge);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.012), gunmetal);
      ear.position.set(x + sx * 0.019, y + 0.017, z);
      group.add(ear);
    }
  }

  return group;
}
