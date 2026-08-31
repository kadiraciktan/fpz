/**
 * game/interactions.js
 * The E-key / gamepad-Y interaction handler: nearest interactable wins
 * (perk machine → Pack-a-Punch → barrier repair → barrier buy → wall gun →
 * wall Thompson → mystery box). Score spending flows through the injected
 * `spend` callback so the HUD stays in sync.
 */

import { PAP_COST, papLabel, BARRIER_HP, BARRIER_REPAIR_COST, barrierNeedsRepair } from './zombies.js';
import { WEAPON_DEFS, WEAPON_LABELS, MYSTERY_POOL } from '../weapons/defs.js';
import { weightedPick } from '../weapons/ammo.js';
import { markMachineSold, retintLabelSign } from '../gfx/Prefabs.js';
import { disposeSceneAssets } from '../gfx/dispose.js';
import { addXp } from './progress.js';

export function createInteractions(deps) {
  const {
    getScene, getController, getWeapons, gamepad,
    getScore, spend, showToast,
    machines, barriers, zones, wallGuns,
    getPap, getThompson, getMysteryBox,
  } = deps;

  /** E / gamepad-Y: nearest interaction (perk → barrier → wall gun → box). */
  return function interactPrimary() {
    const controller = getController();
    if (!controller) return;
    const weaponManager = getWeapons();
    const scene = getScene();
    // Perk machines take priority over wall purchases.
    for (const m of machines) {
      if (m.mesh.position.distanceTo(controller.position) > 2.2) continue;
      if (m.used) {
        showToast(`${m.perk.label} zaten alındı`);
        return;
      }
      if (getScore() < m.perk.cost) {
        showToast(`Puan yetmez — ${m.perk.label}: ${m.perk.cost} puan`);
        return;
      }
      spend(m.perk.cost);
      m.used = true;
      markMachineSold(m.mesh);
      deps.applyPerk(m.perk.key);
      weaponManager.sfx.powerUp();
      gamepad.rumble(0.5, 0.7, 160);
      showToast(`${m.perk.icon} ${m.perk.label} — ${m.perk.hint}`);
      return;
    }
    // Pack-a-Punch: upgrade the ACTIVE weapon once per run.
    const papMachine = getPap();
    if (papMachine && !papMachine.used
        && papMachine.mesh.position.distanceTo(controller.position) < 2.8) {
      const baseName = weaponManager.activeDef.name;
      if (weaponManager.papHeld.has(baseName)) {
        showToast('Bu silah zaten PACK-A-PUNCH — başka silahla gel');
        return;
      }
      if (getScore() < PAP_COST) {
        showToast(`Puan yetmez — Pack-a-Punch: ${PAP_COST} puan`);
        return;
      }
      const upgraded = weaponManager.packAPunch();
      if (!upgraded) {
        showToast('Silah şu an yükseltilemiyor (şarjör/swap bekleyin)');
        return;
      }
      spend(PAP_COST);
      papMachine.used = true;
      retintLabelSign(papMachine.mesh.userData.sign, 'PACK-A-PUNCH', 'KULLANILDI');
      weaponManager.sfx.powerUp();
      gamepad.rumble(1, 1, 450);
      const def = WEAPON_DEFS.find((d) => d.name === upgraded);
      showToast(`⚡ PACK-A-PUNCH! ${def ? papLabel(def) : upgraded}`);
      addXp(50);
      return;
    }
    // Damaged (opened) barriers: patch them back before the horde rips them shut.
    for (const b of barriers) {
      if (!b.open || b.collapsed || !barrierNeedsRepair(b.hp)) continue;
      if (b.mesh.position.distanceTo(controller.position) > 2.8) continue;
      if (getScore() < BARRIER_REPAIR_COST) {
        showToast(`Puan yetmez — barikat tamiri: ${BARRIER_REPAIR_COST} puan`);
        return;
      }
      spend(BARRIER_REPAIR_COST);
      b.hp = BARRIER_HP;
      weaponManager.sfx.clatter(false);
      weaponManager.sfx.powerUp();
      showToast(`🔧 Barikat onarıldı (−${BARRIER_REPAIR_COST})`);
      return;
    }
    // Map barriers: pay points to tear down and open the sealed zone.
    // A torn-down (auto-resealed) barrier can be bought again to clear the
    // rubble path — otherwise zombies stuck behind it could never be killed.
    for (const b of barriers) {
      if (b.open && !b.collapsed) continue;
      if (b.mesh.position.distanceTo(controller.position) > 2.8) continue;
      if (getScore() < b.cost) {
        showToast(`Puan yetmez — barikat: ${b.cost} puan`);
        return;
      }
      const wasCollapsed = b.collapsed;
      spend(b.cost);
      b.open = true;
      b.collapsed = false;
      b.hp = BARRIER_HP;
      if (wasCollapsed) {
        scene.remove(b.mesh); // rubble path cleared (mesh already torn down)
        disposeSceneAssets(b.mesh);
      } else {
        // Knocked-down look: the frame stays as a low barrier the horde
        // will chew back down — its height reads the remaining HP.
        b.mesh.scale.y = 0.35;
        const lockSign = b.mesh.children.find((c) => c.isSprite);
        if (lockSign) lockSign.visible = false;
      }
      const oi = controller.obstacles.indexOf(b.collider);
      if (oi !== -1) controller.obstacles.splice(oi, 1);
      const zn = zones.find((z) => z.id === b.zone);
      if (zn) zn.unlocked = true;
      weaponManager.sfx.clatter(true);
      weaponManager.sfx.powerUp();
      gamepad.rumble(0.5, 0.7, 160);
      showToast(wasCollapsed
        ? `🧹 Geçit yeniden açıldı (−${b.cost})`
        : `🪵 Barikat kaldırıldı! Yeni bölge açıldı (−${b.cost})`);
      return;
    }
    // Wall-gun mounts: pay points, the gun replaces your active slot.
    for (const g of wallGuns) {
      if (g.used) continue;
      if (g.mesh.position.distanceTo(controller.position) > 2.3) continue;
      const label = WEAPON_LABELS[g.weapon] || g.weapon;
      if (getScore() < g.cost) {
        showToast(`Puan yetmez — ${label}: ${g.cost} puan`);
        return;
      }
      spend(g.cost);
      g.used = true;
      g.mesh.userData.glowMat.emissiveIntensity = 0.05;
      g.mesh.userData.glowMat.color.setHex(0x3a3d40);
      retintLabelSign(g.mesh.userData.sign, label, 'SOLD');
      const granted = weaponManager.grantWeapon(g.weapon);
      weaponManager.sfx.powerUp();
      gamepad.rumble(0.5, 0.8, 160);
      showToast(granted ? `🔫 DUVARDAN: ${label}!` : `${label} zaten sende — mermi ikmali!`);
      return;
    }
    const thompsonMesh = getThompson();
    const thompsonDist = thompsonMesh.position.distanceTo(controller.position);
    if (thompsonDist < 2.0) {
      if (getScore() < 1500) {
        showToast('Puan yetmez — Thompson: 1500 puan');
        return;
      }
      spend(1500);
      const granted = weaponManager.grantWeapon('Thompson');
      scene.remove(thompsonMesh);
      showToast(granted ? 'Thompson Picked' : 'Thompson zaten sende — mermi ikmali!');
      weaponManager.sfx.powerUp();
      return;
    }
    const mysteryBox = getMysteryBox();
    const dist = mysteryBox.position.distanceTo(controller.position);
    if (dist < 2.0) {
      if (getScore() < 950) {
        showToast('Puan yetmez — gizemli kutu: 950 puan');
        return;
      }
      spend(950);
      // CoD-style loot table: all 8 guns, weighted by rarity. Paying again on
      // the same box is a reroll.
      const gift = weightedPick(MYSTERY_POOL);
      const granted = weaponManager.grantWeapon(gift.name);
      weaponManager.sfx.powerUp();
      if (gift.rarity === 'WONDER') {
        weaponManager.sfx.rayShot();
        gamepad.rumble(1, 1, 600);
        addXp(100);
        showToast('🛸 WONDER WEAPON: RAY GUN!!');
      } else {
        gamepad.rumble(gift.rarity === 'EFSANE' || gift.rarity === 'NADIR' ? 0.9 : 0.5, 0.8, 220);
        showToast(
          granted
            ? `🎲 ${gift.rarity}: ${
                (WEAPON_DEFS.find((d) => d.name === granted) || weaponManager.activeDef).label
              }!`
            : `🎲 Aynısından vardı — cephane doldu (${gift.rarity})`
        );
      }
    }
  };
}
