import * as THREE from 'three';
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
} from '../Weapons.js';

/**
 * ui/gunsmith.js
 * The MW2-style gunsmith screen (gun preview in the middle, attachment cards
 * on a ring around it, loadout picker on the left, skins at the bottom).
 * Extracted from main.js; owns its own preview WebGL context which only runs
 * while the screen is open.
 *
 * @param {object} setup - shared menu state { attachments, skins, loadout }
 * @param {() => number} getXp - lifetime XP getter (for unlock gating)
 */
export function createGunsmithScreen(setup, getXp) {
  const gunsmithEl = document.getElementById('gunsmithScreen');
  const gsCanvas = document.getElementById('gunsmithCanvas');
  const gsLinesEl = document.getElementById('gsLines');
  const gsNameEl = document.getElementById('gsWeaponName');
  const gsCardsEl = document.getElementById('gsCards');
  const gsSkinsEl = document.getElementById('gsSkins');
  const gsTabsEl = document.getElementById('gsWeaponTabs');
  const gsPickerEl = document.getElementById('gsPicker');
  const attachSummaryEl = document.getElementById('attachSummary');

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

  let gsSlot = 0; // which loadout slot (0-3) is being edited
  let gsWeapon = (setup.loadout && setup.loadout[0]) || DEFAULT_LOADOUT[0];
  let gsGunGroup = null;
  let gsRafId = 0;
  let gsLastT = 0;

  function gsRebuildGun() {
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
    gsGunGroup.rotation.y = -0.6;
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
    if (gsGunGroup) gsGunGroup.rotation.y += dt * 0.55;
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
      card.innerHTML = `
        <div class="gsTitle">${meta.label}${xpReq > 0 ? ` <span class="gsXp">${xpReq} XP</span>` : ''}</div>
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
        </div>`;
      if (!locked) {
        card.addEventListener('click', () => {
          const wasOn = setup.attachments[gsWeapon][slot.key];
          if (OPTICS.includes(slot.key)) {
            // Optics share a single mount — equipping one drops the others.
            for (const o of OPTICS) setup.attachments[gsWeapon][o] = false;
          }
          setup.attachments[gsWeapon][slot.key] = !wasOn;
          gsRefreshCards();
          gsRebuildGun();
          gsUpdateSummary();
        });
      }
      gsCardsEl.appendChild(card);
    }
    gsUpdateLines();
  }

  function gsSelectWeapon(i, name) {
    gsSlot = i;
    gsWeapon = name;
    gsNameEl.textContent = WEAPON_LABELS[gsWeapon] || gsWeapon;
    gsBuildTabs();
    gsBuildCards();
    gsBuildSkins();
    gsBuildPicker();
    gsRebuildGun();
  }

  function gsBuildTabs() {
    gsTabsEl.innerHTML = '';
    for (let i = 0; i < setup.loadout.length; i++) {
      const tab = document.createElement('button');
      tab.className = 'gsTab' + (i === gsSlot ? ' active' : '');
      tab.textContent = `${i + 1}. ${WEAPON_LABELS[setup.loadout[i]] || '?'}`;
      tab.addEventListener('click', () => gsSelectWeapon(i, setup.loadout[i]));
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
  }

  function open() {
    gunsmithEl.classList.remove('hidden');
    gsSlot = 0;
    gsWeapon = setup.loadout[0];
    gsBuildTabs();
    gsBuildCards();
    gsBuildSkins();
    gsBuildPicker();
    gsNameEl.textContent = WEAPON_LABELS[gsWeapon] || gsWeapon;
    gsRebuildGun();
    gsSizeCanvas();
    gsLastT = performance.now();
    gsRafId = requestAnimationFrame(gsRenderLoop);
  }

  function close() {
    cancelAnimationFrame(gsRafId);
    gsRafId = 0;
    gunsmithEl.classList.add('hidden');
  }

  document.getElementById('openGunsmithBtn').addEventListener('click', open);
  document.getElementById('gsBackBtn').addEventListener('click', close);
  window.addEventListener('resize', () => { if (gsRafId) gsSizeCanvas(); });

  gsUpdateSummary();
  return { open, close, updateSummary: gsUpdateSummary };
}
