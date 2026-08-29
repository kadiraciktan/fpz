import * as THREE from 'three';
import { Sfx } from '../Sound.js';
import {
  WEAPON_DEFS,
  WEAPON_LABELS,
  WEAPON_CATEGORIES,
  DEFAULT_LOADOUT,
  ATTACHMENTS,
  OPTICS,
  SKINS,
  createGunsmithPreview,
  attachmentAvailable,
  buildAttachmentMeshes,
  ATTACH_ANCHORS,
} from '../Weapons.js';

/**
 * ui/gunsmith.js
 * The MW2-style gunsmith screen (gun preview in the middle, attachment cards
 * on a ring around it, weapon stats + loadout picker on the left, skins at
 * the bottom). Extracted from main.js; owns its own preview WebGL context
 * which only runs while the screen is open.
 *
 * Preview staging: drag to rotate (with inertia, auto-turntable after idle),
 * pedestal + rim glow, gentle float. Every interaction gets a UI blip.
 *
 * @param {object} setup - shared menu state { attachments, skins, loadout }
 * @param {() => number} getXp - lifetime XP getter (for unlock gating)
 */

// Effective-stat deltas applied by each attachment (display model for the
// stats panel; the real combat math lives in Weapons.js).
const ATT_EFFECT = {
  suppressor: { dmg: -1, mob: -8 },
  extendedMag: { magMul: 1.5, mob: -4 },
  foregrip: { mob: 6 },
  lightStock: { mob: 8 },
};

// Stats panel normalization (max values across the weapon table).
const STAT_MAX = { dmg: 6, rpm: 800, mag: 80, range: 180, mob: 100 };

export function createGunsmithScreen(setup, getXp) {
  const gunsmithEl = document.getElementById('gunsmithScreen');
  const gsCanvas = document.getElementById('gunsmithCanvas');
  const gsLinesEl = document.getElementById('gsLines');
  const gsNameEl = document.getElementById('gsWeaponName');
  const gsCatEl = document.getElementById('gsWeaponCat');
  const gsCardsEl = document.getElementById('gsCards');
  const gsSkinsEl = document.getElementById('gsSkins');
  const gsTabsEl = document.getElementById('gsWeaponTabs');
  const gsPickerEl = document.getElementById('gsPicker');
  const gsStatsEl = document.getElementById('gsStats');
  const gsXpEl = document.getElementById('gsXpChip');
  const attachSummaryEl = document.getElementById('attachSummary');

  // Soft UI feedback (own audio graph; unlocked lazily on first click).
  const ui = new Sfx();
  gunsmithEl.addEventListener('pointerdown', () => ui.unlock());

  // Card slot layout — MW2-style ring around the gun: 3 top, 2 sides, 2 bottom.
  // The four optics share one mount slot; only one can be equipped at a time.
  const GS_SLOTS = [
    { key: 'suppressor', pos: 'pos-tl' },
    { key: 'reflex', pos: 'pos-tc' },
    { key: 'holo', pos: 'pos-tr' },
    { key: 'acog', pos: 'pos-ml' },
    { key: 'scope', pos: 'pos-mr' },
    { key: 'foregrip', pos: 'pos-bc' },
    { key: 'extendedMag', pos: 'pos-bl' },
    { key: 'lightStock', pos: 'pos-br' },
  ];

  // Tiny inline silhouettes for each attachment card (fill = currentColor).
  const GS_ICONS = {
    suppressor: '<svg viewBox="0 0 120 26"><rect x="8" y="9" width="70" height="8" rx="3"/><rect x="76" y="6" width="36" height="14" rx="4"/><rect x="14" y="11" width="4" height="4"/><rect x="24" y="11" width="4" height="4"/><rect x="34" y="11" width="4" height="4"/></svg>',
    scope: '<svg viewBox="0 0 120 26"><rect x="18" y="10" width="84" height="7" rx="3"/><rect x="10" y="6" width="12" height="15" rx="2"/><rect x="100" y="7" width="10" height="13" rx="2"/><rect x="44" y="2" width="14" height="6" rx="2"/><rect x="66" y="2" width="14" height="6" rx="2"/></svg>',
    reflex: '<svg viewBox="0 0 120 26"><rect x="40" y="20" width="40" height="4" rx="2"/><rect x="44" y="9" width="4" height="11"/><rect x="72" y="9" width="4" height="11"/><rect x="42" y="5" width="36" height="4" rx="2"/><circle cx="60" cy="14" r="3"/></svg>',
    holo: '<svg viewBox="0 0 120 26"><rect x="42" y="20" width="36" height="4" rx="2"/><rect x="40" y="4" width="40" height="4" rx="2"/><rect x="40" y="4" width="4" height="18"/><rect x="76" y="4" width="4" height="18"/><circle cx="60" cy="13" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="60" cy="13" r="1.5"/></svg>',
    acog: '<svg viewBox="0 0 120 26"><rect x="28" y="8" width="64" height="10" rx="4"/><rect x="20" y="6" width="12" height="14" rx="3"/><rect x="90" y="7" width="10" height="12" rx="3"/><rect x="42" y="5" width="6" height="16"/><rect x="72" y="5" width="6" height="16"/><rect x="52" y="18" width="16" height="5"/></svg>',
    foregrip: '<svg viewBox="0 0 120 26"><rect x="52" y="2" width="16" height="6" rx="2"/><path d="M54 8 h12 l-2 16 h-8 z"/><rect x="30" y="3" width="60" height="4" rx="2"/></svg>',
    extendedMag: '<svg viewBox="0 0 120 26"><rect x="46" y="2" width="28" height="6" rx="2"/><path d="M50 8 h20 v14 q0 3 -3 3 h-14 q-3 0 -3 -3 z"/><rect x="53" y="10" width="14" height="2"/><rect x="53" y="14" width="14" height="2"/></svg>',
    lightStock: '<svg viewBox="0 0 120 26"><rect x="20" y="10" width="46" height="5" rx="2"/><rect x="14" y="4" width="6" height="18" rx="2"/><rect x="60" y="6" width="5" height="14" rx="2"/><rect x="66" y="10" width="34" height="5" rx="2"/></svg>',
  };

  // ── Preview renderer (own context; runs only while the screen is open) ──
  const gsRenderer = new THREE.WebGLRenderer({ canvas: gsCanvas, antialias: true, alpha: true });
  gsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gsRenderer.shadowMap.enabled = false;
  const gsScene = new THREE.Scene();
  const gsCamera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
  gsCamera.position.set(0.75, 0.45, 1.25);
  gsCamera.lookAt(0, 0.02, 0);
  gsScene.add(new THREE.AmbientLight(0xbfd4ff, 1.4));
  const gsKey = new THREE.DirectionalLight(0xfff2dd, 3.2);
  gsKey.position.set(2, 3, 2);
  gsScene.add(gsKey);
  const gsRim = new THREE.DirectionalLight(0x4fc3f7, 1.6);
  gsRim.position.set(-3, 1, -2);
  gsScene.add(gsRim);
  const gsFill = new THREE.DirectionalLight(0xffb347, 0.7);
  gsFill.position.set(-1, -2, 3);
  gsScene.add(gsFill);

  // Pedestal: dark disc + faint additive glow ring under the floating gun.
  const gsFloor = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 40),
    new THREE.MeshBasicMaterial({ color: 0x0d1522 })
  );
  gsFloor.rotation.x = -Math.PI / 2;
  gsFloor.position.y = -0.24;
  gsScene.add(gsFloor);
  const gsGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.2, 40),
    new THREE.MeshBasicMaterial({
      color: 0x1e88ff, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  gsGlow.rotation.x = -Math.PI / 2;
  gsGlow.position.y = -0.238;
  gsScene.add(gsGlow);

  let gsSlot = 0; // which loadout slot (0-3) is being edited
  let gsWeapon = (setup.loadout && setup.loadout[0]) || DEFAULT_LOADOUT[0];
  let gsGunGroup = null;
  let gsRafId = 0;
  let gsLastT = 0;

  // Drag-to-rotate state (inertia + idle turntable + float).
  let gsRot = -0.6;
  let gsRotVel = 0;
  let gsIdle = 0;
  let gsDragging = false;
  let gsLastX = 0;

  gsCanvas.addEventListener('pointerdown', (e) => {
    gsDragging = true;
    gsLastX = e.clientX;
    gsCanvas.setPointerCapture(e.pointerId);
  });
  gsCanvas.addEventListener('pointermove', (e) => {
    if (!gsDragging) return;
    const dx = e.clientX - gsLastX;
    gsLastX = e.clientX;
    gsRot += dx * 0.010;
    gsRotVel = dx * 0.55; // rough rad/s for the release inertia
    gsIdle = 0;
  });
  const endDrag = () => { gsDragging = false; };
  gsCanvas.addEventListener('pointerup', endDrag);
  gsCanvas.addEventListener('pointercancel', endDrag);

  // ── Hover inspect: ghost-preview the hovered attachment on the gun ──
  let gsPreview = null; // { group, mats } currently ghosted on the gun

  function gsClearPreview() {
    if (!gsPreview) return;
    const key = gsPreview.key;
    gsGunGroup?.remove(gsPreview.group);
    for (const m of gsPreview.mats) m.dispose();
    gsPreview = null;
    if (!gsGunGroup) return;
    // buildAttachmentMeshes hides the parts an attachment replaces (iron
    // sights, original stocks). Undo that unless the REAL loadout still
    // equips something that should keep them hidden.
    const att = setup.attachments[gsWeapon] || {};
    const show = (name) => {
      const o = gsGunGroup.getObjectByName(name);
      if (o) o.visible = true;
    };
    if (OPTICS.includes(key) && !OPTICS.some((o) => att[o])) show('sight');
    if (key === 'lightStock' && !att.lightStock) {
      const A = ATTACH_ANCHORS[gsWeapon];
      if (A?.stock) for (const n of A.stock.hide) show(n);
    }
  }

  /**
   * Glowing attachment ghost on the gun. depthTest is OFF and blending is
   * additive, so the preview can never get buried inside the barrel/receiver
   * meshes. Cyan = would equip, gold = currently equipped (inspect).
   */
  function gsShowPreview(key) {
    if (!gsGunGroup) return;
    if (gsPreview?.key === key) return;
    gsClearPreview();
    const equipped = !!setup.attachments[gsWeapon]?.[key];
    const def = WEAPON_DEFS.find((d) => d.name === gsWeapon);
    const group = buildAttachmentMeshes(def, { [key]: true }, gsGunGroup);
    const hex = equipped ? 0xffb300 : 0x29b6f6;
    const mats = [];
    group.traverse((o) => {
      o.layers.set(0); // attachments are authored for layer 1 (viewmodel cam)
      if (!o.isMesh) return;
      const m = (o.material && o.material.clone) ? o.material.clone() : new THREE.MeshStandardMaterial();
      m.transparent = true;
      m.opacity = equipped ? 0.5 : 0.75;
      m.depthWrite = false;
      m.depthTest = false; // draw over the gun, not inside it
      m.blending = THREE.AdditiveBlending;
      m.color.setHex(hex);
      if (m.emissive) m.emissive.setHex(hex);
      o.material = m;
      o.renderOrder = 10; // renderOrder lives on meshes, not groups
      mats.push(m);
    });
    gsGunGroup.add(group);
    gsPreview = { group, mats, key };
  }

  function gsRebuildGun() {
    gsClearPreview();
    if (gsGunGroup) {
      gsScene.remove(gsGunGroup);
      gsGunGroup.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          // Skin materials are cloned per preview; free them on rebuild.
          if (o.material && o.material.map) o.material.dispose();
        }
      });
    }
    const def = WEAPON_DEFS.find((d) => d.name === gsWeapon);
    gsGunGroup = createGunsmithPreview(def, setup.attachments[gsWeapon], setup.skins[gsWeapon]);
    const scale = {
      Pistol: 1.15, Rifle: 0.78, Shotgun: 0.85, Thompson: 0.9,
      M4A1: 0.8, MP5: 1.0, Cal50: 0.55, LSW: 0.72,
    }[gsWeapon] || 1;
    gsGunGroup.scale.setScalar(scale);
    // NB: do NOT reset gsRot/gsRotVel here — equipping an attachment must not
    // snap the gun back to its default pose; the render loop re-applies the
    // current rotation to the freshly built group on the very next frame.
    gsScene.add(gsGunGroup);
  }

  function gsUpdateLines() {
    const w = gsRenderer.domElement.clientWidth;
    const h = gsRenderer.domElement.clientHeight;
    const cx = w / 2;
    const cy = h * 0.52; // gun centre on screen
    let svg = '';
    for (const card of gsCardsEl.children) {
      const r = card.getBoundingClientRect();
      // Anchor the line at the card edge closest to the gun centre.
      const px = Math.min(Math.max(cx, r.left), r.right);
      const py = Math.min(Math.max(cy, r.top), r.bottom);
      svg += `<line x1="${px}" y1="${py}" x2="${cx}" y2="${cy}" stroke="rgba(79,195,247,0.55)" stroke-width="1.5"/>`;
      svg += `<circle cx="${px}" cy="${py}" r="2.5" fill="#4fc3f7"/>`;
    }
    gsLinesEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gsLinesEl.innerHTML = svg;
  }

  function gsRenderLoop(t) {
    gsRafId = requestAnimationFrame(gsRenderLoop);
    const dt = Math.min(0.05, (t - gsLastT) / 1000 || 0);
    gsLastT = t;
    if (gsGunGroup) {
      if (gsDragging) {
        gsIdle = 0;
      } else {
        gsIdle += dt;
        gsRotVel *= Math.max(0, 1 - dt * 3); // inertia decay
        gsRot += gsRotVel * dt;
        // After 2 s of no touching, ease back into a slow turntable.
        const idleK = THREE.MathUtils.smoothstep(gsIdle, 2, 4);
        gsRot += 0.45 * idleK * dt;
      }
      gsGunGroup.rotation.y = gsRot;
      gsGunGroup.position.y = Math.sin(t * 0.0011) * 0.014; // gentle float
    }
    gsRenderer.render(gsScene, gsCamera);
  }

  function gsSizeCanvas() {
    const w = gunsmithEl.clientWidth || window.innerWidth;
    const h = gunsmithEl.clientHeight || window.innerHeight;
    gsRenderer.setSize(w, h, false);
    gsCamera.aspect = w / h;
    gsCamera.updateProjectionMatrix();
    gsUpdateLines();
  }

  function gsRefreshCards() {
    for (const card of gsCardsEl.children) {
      const key = card.dataset.key;
      if (!key || card.classList.contains('disabled')) continue;
      const meta = ATTACHMENTS[key];
      const on = !!setup.attachments[gsWeapon][key];
      card.classList.toggle('equipped', on);
      card.querySelector('.gsStatus').textContent =
        on ? `TAKILI: ${meta.hint}` : `BOŞ — tıkla: ${meta.hint}`;
    }
  }

  /** Effective stats for the weapon being edited (attachments applied). */
  function gsEffStats(hoverKey = null) {
    const def = WEAPON_DEFS.find((d) => d.name === gsWeapon);
    const att = { ...(setup.attachments[gsWeapon] || {}) };
    // Hover = preview the toggle: equip if empty, strip if mounted.
    if (hoverKey) {
      if (OPTICS.includes(hoverKey)) for (const o of OPTICS) att[o] = false;
      att[hoverKey] = !att[hoverKey];
    }
    const eff = {
      dmg: def.damage,
      rpm: Math.round(60 / def.fireRate),
      mag: att.extendedMag ? Math.round(def.magazineSize * 1.5) : def.magazineSize,
      range: def.range,
      mob: 50,
    };
    for (const key of Object.keys(ATT_EFFECT)) {
      if (!att[key]) continue;
      const fx = ATT_EFFECT[key];
      if (fx.dmg) eff.dmg = Math.max(1, eff.dmg + fx.dmg);
      if (fx.mob) eff.mob += fx.mob;
    }
    return {
      base: {
        dmg: def.damage, rpm: eff.rpm, mag: def.magazineSize, range: def.range, mob: 50,
      },
      eff,
    };
  }

  function gsUpdateStats(hoverKey = null) {
    if (!gsStatsEl) return;
    const { base, eff } = gsEffStats(hoverKey);
    const rows = [
      ['HASAR', 'dmg', (v) => `x${v}`],
      ['ATIŞ/DK', 'rpm', (v) => String(v)],
      ['ŞARJÖR', 'mag', (v) => String(v)],
      ['MENZİL', 'range', (v) => `${v} m`],
      ['HAREKET', 'mob', (v) => `${v}`],
    ];
    const title = hoverKey
      ? `ÖNİZLEME: ${ATTACHMENTS[hoverKey].label}`
      : 'SİLAH STATLARI';
    gsStatsEl.innerHTML = `<div class="gsStatsTitle${hoverKey ? ' preview' : ''}">${title}</div>` + rows.map(([label, key, fmt]) => {
      const v = eff[key];
      const b = base[key];
      const d = v - b;
      const pct = Math.max(4, Math.min(100, (v / STAT_MAX[key]) * 100));
      const basePct = Math.max(0, Math.min(100, (b / STAT_MAX[key]) * 100));
      const kind = d > 0 ? 'good' : d < 0 ? 'bad' : '';
      const dTxt = d === 0 ? '' : `<span class="${kind}">${d > 0 ? `(+${d})` : `(−${Math.abs(d)})`}</span>`;
      return `
        <div class="gsStat">
          <div class="gsStatHead"><span>${label}</span><b>${fmt(v)} ${dTxt}</b></div>
          <div class="gsBar"><i class="${kind}" style="width:${pct}%"></i><u style="left:${basePct}%"></u></div>
        </div>`;
    }).join('');
  }

  function gsUpdateXpChip() {
    if (gsXpEl) gsXpEl.textContent = `⭐ ${getXp()} XP`;
  }

  function gsBuildCards() {
    const totalXp = getXp();
    gsCardsEl.innerHTML = '';
    for (const slot of GS_SLOTS) {
      const meta = ATTACHMENTS[slot.key];
      const xpReq = meta.xp || 0;
      const xpLocked = totalXp < xpReq;
      const locked = !attachmentAvailable(gsWeapon, slot.key) || xpLocked;
      const card = document.createElement('div');
      card.className = `gsCard ${slot.pos}`;
      card.dataset.key = slot.key;
      if (locked) card.classList.add('disabled');
      else if (setup.attachments[gsWeapon][slot.key]) card.classList.add('equipped');
      const xpPct = xpReq > 0 ? Math.min(100, (totalXp / xpReq) * 100) : 100;
      card.innerHTML = `
        <div class="gsTitle">${meta.label}
          ${meta.chip ? `<span class="gsChip ${meta.chipKind || 'info'}">${meta.chip}</span>` : ''}
          <span class="gsSlot">${meta.slot}</span>
        </div>
        <div class="gsBox">
          <div class="gsWName">${WEAPON_LABELS[gsWeapon]}</div>
          <div class="gsMini">${GS_ICONS[slot.key]}<div class="gsA">A</div></div>
          <div class="gsStatus">${
            xpLocked
              ? `🔒 ${xpReq} XP gerekir (sende ${totalXp})`
              : locked
                ? 'Bu silahta yok'
                : (card.classList.contains('equipped') ? 'TAKILI' : 'BOŞ — tıkla')
          }: ${meta.hint}</div>
          ${xpLocked ? `<div class="gsXpBar"><i style="width:${xpPct}%"></i></div>` : ''}
        </div>`;
      if (!locked) {
        card.addEventListener('pointerenter', () => {
          gsShowPreview(slot.key);
          gsUpdateStats(slot.key);
        });
        card.addEventListener('pointerleave', () => {
          gsClearPreview();
          gsUpdateStats();
        });
      }
      card.addEventListener('click', () => {
        if (locked) {
          ui.unlock();
          ui.uiDeny();
          return;
        }
        const wasOn = setup.attachments[gsWeapon][slot.key];
        if (OPTICS.includes(slot.key)) {
          // Optics share a single mount — equipping one drops the others.
          for (const o of OPTICS) setup.attachments[gsWeapon][o] = false;
        }
        setup.attachments[gsWeapon][slot.key] = !wasOn;
        ui.unlock();
        if (wasOn) ui.uiClick();
        else {
          ui.uiConfirm();
          // Equip flash: restart the animation from a clean state.
          card.classList.remove('flash');
          void card.offsetWidth;
          card.classList.add('flash');
        }
        gsRefreshCards();
        gsRebuildGun();
        gsUpdateSummary();
        // Cursor still on the card: swap cyan ghost → gold inspect glow.
        gsShowPreview(slot.key);
        gsUpdateStats(slot.key);
      });
      gsCardsEl.appendChild(card);
    }
    gsUpdateLines();
  }

  function gsSelectWeapon(i, name) {
    gsClearPreview();
    gsSlot = i;
    gsWeapon = name;
    const def = WEAPON_DEFS.find((d) => d.name === name);
    gsNameEl.textContent = WEAPON_LABELS[gsWeapon] || gsWeapon;
    if (gsCatEl) gsCatEl.textContent = def ? def.category : '';
    gsBuildTabs();
    gsBuildCards();
    gsBuildSkins();
    gsBuildPicker();
    gsRebuildGun();
    gsUpdateStats();
    gsUpdateXpChip();
  }

  function gsBuildTabs() {
    gsTabsEl.innerHTML = '';
    for (let i = 0; i < setup.loadout.length; i++) {
      const tab = document.createElement('button');
      tab.className = 'gsTab' + (i === gsSlot ? ' active' : '');
      tab.textContent = `${i + 1}. ${WEAPON_LABELS[setup.loadout[i]] || '?'}`;
      tab.addEventListener('click', () => {
        ui.uiClick();
        gsSelectWeapon(i, setup.loadout[i]);
      });
      gsTabsEl.appendChild(tab);
    }
  }

  /** Category-grouped weapon list (CoD gunsmith-style loadout picker). */
  function gsBuildPicker() {
    if (!gsPickerEl) return;
    gsPickerEl.innerHTML = '';
    for (const cat of WEAPON_CATEGORIES) {
      const defs = WEAPON_DEFS.filter((d) => d.category === cat);
      if (!defs.length) continue;
      const head = document.createElement('div');
      head.className = 'gsCat';
      head.textContent = cat;
      gsPickerEl.appendChild(head);
      for (const d of defs) {
        const btn = document.createElement('button');
        btn.className = 'gsPick' + (setup.loadout[gsSlot] === d.name ? ' active' : '');
        const slotIdx = setup.loadout.indexOf(d.name);
        btn.innerHTML = `<b>${d.label}</b><span class="gsPickStats">${d.magazineSize} mermi · ${d.damage}x dmg · ${d.range} m</span>`
          + (slotIdx >= 0 ? `<i class="gsPickSlot">${slotIdx + 1}</i>` : '');
        btn.addEventListener('click', () => {
          const other = setup.loadout.indexOf(d.name);
          if (other === gsSlot) return;
          ui.uiConfirm();
          // CoD rule: an owned weapon swaps slots instead of being equipped twice.
          if (other >= 0) setup.loadout[other] = setup.loadout[gsSlot];
          setup.loadout[gsSlot] = d.name;
          gsSelectWeapon(gsSlot, d.name);
          gsUpdateSummary();
        });
        gsPickerEl.appendChild(btn);
      }
    }
  }

  function gsBuildSkins() {
    gsSkinsEl.innerHTML = '<span class="gsSkinsLabel">SKIN</span>';
    for (const [id, skin] of Object.entries(SKINS)) {
      const el = document.createElement('div');
      el.className = 'gsSkin' + (setup.skins[gsWeapon] === id ? ' active' : '');
      el.title = skin.hint;
      el.innerHTML = `<div class="gsSwatch" style="background:${skin.swatch}"></div><div class="gsSkinName">${skin.label}</div>`;
      el.addEventListener('click', () => {
        ui.unlock();
        ui.uiConfirm();
        setup.skins[gsWeapon] = id;
        gsSkinsEl.querySelectorAll('.gsSkin').forEach((s) => s.classList.toggle('active', s === el));
        gsRebuildGun();
        gsUpdateSummary();
      });
      gsSkinsEl.appendChild(el);
    }
  }

  function gsUpdateSummary() {
    const parts = [];
    for (const [w, atts] of Object.entries(setup.attachments)) {
      const names = Object.keys(ATTACHMENTS).filter((k) => atts[k]).map((k) => ATTACHMENTS[k].label);
      if (setup.skins[w] !== 'default') names.push(SKINS[setup.skins[w]].label + ' skin');
      if (names.length) parts.push(`${WEAPON_LABELS[w]}: ${names.join(', ')}`);
    }
    const loadoutLine = setup.loadout.map((n, i) => `${i + 1}.${WEAPON_LABELS[n] || n}`).join(' · ');
    attachSummaryEl.textContent = `Loadout: ${loadoutLine}${parts.length ? ' — ' + parts.join(' · ') : ''}`;
    gsUpdateStats();
  }

  function open() {
    gunsmithEl.classList.remove('hidden');
    gsSlot = 0;
    gsWeapon = setup.loadout[0];
    const def = WEAPON_DEFS.find((d) => d.name === gsWeapon);
    gsBuildTabs();
    gsBuildCards();
    gsBuildSkins();
    gsBuildPicker();
    gsNameEl.textContent = WEAPON_LABELS[gsWeapon] || gsWeapon;
    if (gsCatEl) gsCatEl.textContent = def ? def.category : '';
    gsRot = -0.6;
    gsRotVel = 0;
    gsIdle = 0;
    gsRebuildGun();
    gsUpdateStats();
    gsUpdateXpChip();
    gsSizeCanvas();
    gsLastT = performance.now();
    gsRafId = requestAnimationFrame(gsRenderLoop);
  }

  function close() {
    cancelAnimationFrame(gsRafId);
    gsRafId = 0;
    gunsmithEl.classList.add('hidden');
    gsClearPreview();
  }

  document.getElementById('openGunsmithBtn').addEventListener('click', () => {
    ui.unlock();
    ui.uiConfirm();
    open();
  });
  document.getElementById('gsBackBtn').addEventListener('click', () => {
    ui.uiClick();
    close();
  });
  window.addEventListener('resize', () => { if (gsRafId) gsSizeCanvas(); });

  gsUpdateSummary();
  return { open, close, updateSummary: gsUpdateSummary };
}
