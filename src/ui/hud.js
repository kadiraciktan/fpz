/**
 * ui/hud.js
 * In-game HUD: score/health/round readouts, gear & perk strips, buff
 * countdowns, the bleed-out bar and the compass ribbon. Pure view layer —
 * callers pass plain state snapshots in, nothing is mutated here.
 */

import * as THREE from 'three';
import { PERKS } from '../game/perks.js';

export function createHud() {
  const hudScore = document.getElementById('score');
  const healthBarEl = document.getElementById('healthBar');
  const healthFillEl = document.getElementById('healthFill');
  const healthTextEl = document.getElementById('healthText');
  const hudRound = document.getElementById('round');
  const hudGear = document.getElementById('gear');
  const hudPrep = document.getElementById('prep');
  const hudPerks = document.getElementById('perks');
  const hudBuffs = document.getElementById('buffs');
  const compassEl = document.getElementById('compass');
  const compassCtx = compassEl ? compassEl.getContext('2d') : null;
  const downBarWrap = document.getElementById('downWrap');
  const downBarFill = document.getElementById('downBar');
  const abilitiesEl = document.getElementById('abilities');

  // ── Special ability rack (bottom-right, above the ammo): one card per
  // ability; the selected one is highlighted. Cards are built once and
  // then only their counts / classes get refreshed. ──
  const abCards = [];
  function setAbilities(list, selIndex) {
    if (!abilitiesEl) return;
    abilitiesEl.classList.remove('hidden');
    if (abCards.length !== list.length) {
      abilitiesEl.textContent = '';
      abCards.length = 0;
      for (const a of list) {
        const card = document.createElement('div');
        card.className = 'abCard';
        const icon = document.createElement('span');
        icon.className = 'abIcon';
        icon.textContent = a.icon;
        const count = document.createElement('span');
        count.className = 'abCount';
        const label = document.createElement('span');
        label.className = 'abLabel';
        label.textContent = a.short || a.label;
        card.append(icon, count, label);
        abilitiesEl.appendChild(card);
        abCards.push({ card, count, icon: a.icon });
      }
      const hint = document.createElement('span');
      hint.className = 'abHint';
      hint.textContent = 'X seç · F kullan';
      abilitiesEl.appendChild(hint);
    }
    for (let i = 0; i < abCards.length; i++) {
      const { card, count, icon } = abCards[i];
      const n = list[i].stock;
      const txt = String(n);
      if (count.textContent !== txt) count.textContent = txt;
      card.classList.toggle('sel', i === selIndex);
      card.classList.toggle('empty', n <= 0);
      card.title = `${icon} ${list[i].label}`;
    }
  }

  function update({ score, health, maxHealth = 100, round, gear, perksHeld }) {
    if (hudScore) hudScore.textContent = String(score);
    if (healthFillEl && healthTextEl && healthBarEl) {
      const hp = Math.max(0, health);
      const frac = Math.max(0, Math.min(1, hp / Math.max(1, maxHealth)));
      healthFillEl.style.width = `${Math.round(frac * 100)}%`;
      healthTextEl.textContent = String(hp);
      healthBarEl.classList.toggle('low', frac <= 0.3);
    }
    if (hudRound) hudRound.textContent = String(round);
    if (hudGear && gear !== undefined) hudGear.textContent = gear;
    if (hudPerks) {
      const owned = PERKS.filter((p) => perksHeld && perksHeld[p.key]);
      hudPerks.textContent = owned.length
        ? owned.map((p) => `${p.icon} ${p.label}`).join('  ·  ')
        : '';
    }
  }

  // ── Buff countdown strip (insta-kill / double points / difficulty tag) ──
  function updateBuffs({ difficultyTag, weatherTag, instaKillUntil, doublePointsUntil, now }) {
    if (!hudBuffs) return;
    const parts = [];
    if (difficultyTag) parts.push(difficultyTag);
    if (weatherTag) parts.push(weatherTag);
    if (now < instaKillUntil) parts.push(`☠ INSTA-KILL ${Math.ceil((instaKillUntil - now) / 1000)}s`);
    if (now < doublePointsUntil) parts.push(`✕2 PUAN ${Math.ceil((doublePointsUntil - now) / 1000)}s`);
    const txt = parts.join('   ·   ');
    if (hudBuffs.textContent !== txt) hudBuffs.textContent = txt;
  }

  function setPrep(text) {
    if (hudPrep) hudPrep.textContent = text;
  }

  // ── Mission objective strip (top-left, mission mode only) ──
  const hudObjective = document.getElementById('objective');
  function setObjective(text) {
    if (!hudObjective) return;
    const on = !!text;
    hudObjective.classList.toggle('hidden', !on);
    if (on && hudObjective.textContent !== text) hudObjective.textContent = text;
  }

  // ── Bleed-out bar (downed / last stand) ──
  function setDownBar(visible, frac = 1) {
    if (!downBarWrap || !downBarFill) return;
    downBarWrap.classList.toggle('hidden', !visible);
    downBarFill.style.width = `${Math.round(frac * 100)}%`;
  }

  function setDownFrac(frac) {
    if (downBarFill) downBarFill.style.width = `${Math.round(frac * 100)}%`;
  }

  // ── AC-130 gunship CRT feed overlay: green camera-feed chrome with the
  // loiter timer, belt count and kill tally. Built on first use, removed
  // again by clearRun so the menu never inherits a stale feed. ──
  let gsEl = null;
  const gsRefs = {};
  function setGunship(view) {
    if (view && !gsEl) {
      gsEl = document.createElement('div');
      gsEl.id = 'gunshipOverlay';
      const feed = document.createElement('div');
      feed.className = 'gso-feed';
      const cross = document.createElement('div');
      cross.className = 'gso-cross';
      const mk = (cls, text) => {
        const el = document.createElement('div');
        el.className = `gso-tag ${cls}`;
        el.textContent = text;
        return el;
      };
      gsRefs.time = mk('gso-time', '');
      gsRefs.ammo = mk('gso-ammo', '');
      gsRefs.kills = mk('gso-kills', '');
      gsEl.append(
        feed, cross,
        mk('gso-ship', 'SPY-156 · AC-130 "GHOST RYDER"'),
        gsRefs.time, gsRefs.ammo, gsRefs.kills,
      );
      document.body.appendChild(gsEl);
    }
    if (!gsEl) return;
    gsEl.classList.toggle('show', !!view);
    if (view) {
      gsRefs.time.textContent = `LOİTER ${view.time.toFixed(1)} sn`;
      gsRefs.ammo.textContent = `MERMI ${view.ammo}`;
      gsRefs.kills.textContent = `VURULAN ${view.kills}`;
    }
  }

  /** Blank every per-run readout (called from teardownGame). */
  function clearRun() {
    setGunship(null);
    if (gsEl) { gsEl.remove(); gsEl = null; }
    setPrep('');
    setObjective('');
    if (hudBuffs) hudBuffs.textContent = '';
    if (abilitiesEl) abilitiesEl.classList.add('hidden');
    if (compassCtx) compassCtx.clearRect(0, 0, compassEl.width, compassEl.height);
  }

  // ── Compass strip: world cardinals + live POI markers (box, PaP, walls,
  // breached barriers) projected by bearing onto a flat ±100° ribbon. ──
  const COMPASS_SPAN = (100 * Math.PI) / 180;
  const CARDINALS = [[0, 'K'], [Math.PI / 2, 'D'], [Math.PI, 'G'], [-Math.PI / 2, 'B']];
  // POI dot rows are rebuilt every frame; reuse pre-allocated slots so the
  // compass never allocates. Each entry: [x, z, color, label].
  const pois = [];
  for (let i = 0; i < 64; i++) pois.push([0, 0, '', '']);
  let poiN = 0;

  function beginPois() {
    poiN = 0;
  }

  function pushPoi(x, z, col, label) {
    const e = pois[poiN];
    if (!e) return;
    e[0] = x; e[1] = z; e[2] = col; e[3] = label;
    poiN++;
  }

  function drawCompass(camera, player) {
    if (!compassCtx || !player) return;
    const w = compassEl.width;
    const h = compassEl.height;
    const ctx = compassCtx;
    ctx.clearRect(0, 0, w, h);

    const fwd = camera.getWorldDirection(_fwdV);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) return;
    fwd.normalize();
    const rx = -fwd.z;
    const rz = fwd.x;
    const heading = Math.atan2(fwd.x, -fwd.z); // 0 = world north (-Z)

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
    ctx.font = 'bold 11px monospace';
    for (let pi = 0; pi < poiN; pi++) {
      const [px, pz, col, label] = pois[pi];
      const dx = px - player.x;
      const dz = pz - player.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const ang = Math.atan2((dx * rx + dz * rz) / len, (dx * fwd.x + dz * fwd.z) / len);
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

  const _fwdV = new THREE.Vector3();

  return {
    update, updateBuffs, setPrep, setObjective, setDownBar, setDownFrac, clearRun,
    beginPois, pushPoi, drawCompass, setAbilities, setGunship,
  };
}
