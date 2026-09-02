/**
 * Gamepad.js
 * Gamepad API bridge (Xbox/standard layout). Polled every frame from the main
 * loop; feeds virtual inputs into the FPSController / WeaponManager and
 * drives rumble feedback:
 *
 *   left stick   move            right stick  look
 *   LT (button)  aim (ADS)       RT (button)  fire
 *   A            jump            B            crouch (hold)
 *   X            reload          Y            interact (E)
 *   LB / RB      previous/next weapon
 *   L3           sprint (hold)   R3           fire selected ability (F)
 *   D-pad right  cycle special ability (X)    Start   pause / resume
 */

/** Read a trigger as 0..1 — handles both analog values and digital-only pads. */
function triggerValue(gp, idx) {
  const b = gp.buttons[idx];
  if (!b) return 0;
  const v = typeof b.value === 'number' ? b.value : 0;
  return Math.max(v, b.pressed ? 1 : 0);
}

export class GamepadInput {
  constructor(options = {}) {
    this.deadzone = options.deadzone ?? 0.18;
    this.lookScale = options.lookScale ?? 9;
    this._prev = {};
    this.connected = false;
    /** Most recently read pad — kept live even from menu polling (rumble). */
    this.lastPad = null;
    // getGamepads() + filter allocates twice per frame; the pad list only
    // changes on hot-plug, so cache the pick briefly (Gamepad objects are
    // live views — button state still updates every read).
    this._padCache = null;
    this._padCacheAt = -1e9;
  }

  /**
   * Pick the gamepad to use: prefer a standard-mapping pad — cheap Bluetooth
   * receivers often expose phantom pads at index 0, which broke RT reads.
   */
  pickPad() {
    const now = performance.now();
    if (now - this._padCacheAt > 100) {
      this._padCacheAt = now;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let std = null;
      let first = null;
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        if (!p) continue;
        if (!first) first = p;
        if (p.mapping === 'standard') { std = p; break; }
      }
      this._padCache = std || first;
    }
    return this._padCache;
  }

  /**
   * Rumble via the vibration actuator (Chrome) with a pulse() fallback
   * (Firefox). Silently no-ops where the API is missing.
   */
  rumble(weak = 0.4, strong = 0.6, duration = 100) {
    const gp = this.lastPad;
    if (!gp) return;
    try {
      const act = gp.vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude: Math.min(1, weak),
          strongMagnitude: Math.min(1, strong),
        });
      } else if (gp.hapticActuators && gp.hapticActuators[0]) {
        gp.hapticActuators[0].pulse(Math.min(1, Math.max(weak, strong)), duration);
      }
    } catch { /* rumble unsupported */ }
  }

  _pressed(gp, idx) {
    const now = !!gp.buttons[idx]?.pressed;
    const was = this._prev[idx] || false;
    this._prev[idx] = now;
    return now && !was;
  }

  /**
   * @param {number} dt
   * @param {{controller?: object, weaponManager?: object, onInteract?: Function, onPause?: Function, onAbility?: Function, onCycle?: Function}} deps
   * @returns {boolean} true if a gamepad was read this frame
   */
  update(dt, { controller, weaponManager, onInteract, onPause, onAbility, onCycle } = {}) {
    const gp = this.pickPad();
    this.lastPad = gp;
    if (!gp) {
      if (this.connected && controller) this._clear(controller, weaponManager);
      this.connected = false;
      return false;
    }
    this.connected = true;

    const dz = (v) => (Math.abs(v) < this.deadzone ? 0 : v);
    const ax = dz(gp.axes[0] || 0);
    const ay = dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0);
    const ry = dz(gp.axes[3] || 0);

    if (controller) {
      controller.padMove.set(ax, ay);
      // Look: reuse the mouse accumulator (consumed by controller.update).
      if (rx || ry) {
        controller.mouse.x += rx * this.lookScale;
        controller.mouse.y += ry * this.lookScale;
      }
      controller.padJump = !!gp.buttons[0]?.pressed;
      controller.padCrouch = !!gp.buttons[1]?.pressed;
      controller.padSprint = !!gp.buttons[10]?.pressed;
    }

    if (weaponManager) {
      const lt = triggerValue(gp, 6);
      const rt = triggerValue(gp, 7);
      weaponManager.setAiming(lt > 0.5);
      // Rising edge fires instantly; holding keeps the automatic fire going.
      const firing = rt > 0.5;
      if (firing && !this._prev.rt) weaponManager._tryShoot();
      this._prev.rt = firing;
      weaponManager.setFiring(firing);
      if (this._pressed(gp, 2)) weaponManager.reload();
      if (this._pressed(gp, 5)) weaponManager.switchNext();
      if (this._pressed(gp, 4)) weaponManager.switchPrev();
    }

    if (this._pressed(gp, 3) && onInteract) onInteract();
    if (this._pressed(gp, 11) && onAbility) onAbility();
    if (this._pressed(gp, 15) && onCycle) onCycle();
    if (this._pressed(gp, 9) && onPause) onPause();
    return true;
  }

  _clear(controller, weaponManager) {
    controller.padMove.set(0, 0);
    controller.padJump = false;
    controller.padCrouch = false;
    controller.padSprint = false;
    if (weaponManager) {
      weaponManager.setFiring(false);
      weaponManager.setAiming(false);
    }
    this._prev = {};
  }
}

/**
 * GamepadMenuNav — D-pad / left-stick navigation for the DOM menus
 * (main menu, gunsmith, stats). Moves a visible `.gp-focus` ring between the
 * buttons/cards of the topmost open screen; A clicks the focused element.
 */
export class GamepadMenuNav {
  /** @param {GamepadInput} pad - used for pad picking + selection rumble */
  constructor(pad) {
    this.pad = pad;
    this._el = null; // currently focused element
    this._pos = 0; // remembered index across DOM rebuilds
    this._repeat = 0; // hold-to-repeat countdown
    this._dirPrev = 0;
    this._aPrev = false;
  }

  /** Topmost visible screen, or null when the game itself is up. */
  _scope() {
    for (const id of ['storyScreen', 'statsScreen', 'gunsmithScreen', 'mainMenu']) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden') && el.offsetParent !== null) return el;
    }
    return null;
  }

  /** Focusable items of the open screen, in DOM order. */
  _items() {
    const scope = this._scope();
    if (!scope) return [];
    return [...scope.querySelectorAll('button, .mapCard, .gsCard:not(.disabled), .gsSkin')]
      .filter((el) => el.offsetParent !== null);
  }

  /** @returns {boolean} true when a pad was read (menu is gamepad-driven). */
  update(dt) {
    const gp = this.pad.pickPad();
    this.pad.lastPad = gp; // keep the rumble target fresh on the menu too
    if (!gp) {
      this._aPrev = false;
      this._dirPrev = 0;
      return false;
    }

    const items = this._items();
    if (!items.length) {
      this._blur();
      return true;
    }

    // --- Direction: dominant stick axis, or D-pad ---
    const stick = Math.abs(gp.axes[0] || 0) >= Math.abs(gp.axes[1] || 0) ? (gp.axes[0] || 0) : (gp.axes[1] || 0);
    const sd = Math.abs(stick) < 0.35 ? 0 : (stick > 0 ? 1 : -1);
    let dir = sd;
    if (!dir && (gp.buttons[15]?.pressed || gp.buttons[13]?.pressed)) dir = 1;   // up / right → next
    if (!dir && (gp.buttons[14]?.pressed || gp.buttons[12]?.pressed)) dir = -1;  // down / left → prev

    // --- Move: instant on edge, then hold-to-repeat ---
    const edge = dir !== 0 && dir !== this._dirPrev;
    this._repeat = dir === 0 ? 0.32 : Math.max(0, this._repeat - dt);
    const moved = dir !== 0 && (edge || this._repeat <= 0);
    if (moved) this._repeat = this._dirPrev === 0 ? 0.32 : 0.12;
    this._dirPrev = dir;

    // Restore the selection after DOM rebuilds (tabs/cards re-render).
    let idx = items.indexOf(this._el);
    if (idx < 0) idx = Math.min(this._pos, items.length - 1);
    if (moved) {
      if (!this._el) this.pad.rumble(0.08, 0, 40); // first focus
      else this.pad.rumble(0.12, 0.05, 30);
      idx = ((idx < 0 ? 0 : idx) + dir + items.length) % items.length;
    }
    this._pos = idx;
    this._focus(items[idx]);

    // --- A clicks the focused element ---
    const a = !!gp.buttons[0]?.pressed;
    if (a && !this._aPrev && this._el) {
      this.pad.rumble(0.25, 0.35, 80);
      this._el.click();
    }
    this._aPrev = a;
    return true;
  }

  _focus(el) {
    if (el === this._el) return;
    this._blur();
    this._el = el || null;
    if (el) {
      el.classList.add('gp-focus');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  _blur() {
    if (this._el) this._el.classList.remove('gp-focus');
    this._el = null;
  }
}
