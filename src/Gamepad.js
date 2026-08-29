/**
 * Gamepad.js
 * Minimal Gamepad API bridge (Xbox layout). Polled every frame from the main
 * loop; feeds virtual inputs into the FPSController / WeaponManager:
 *
 *   left stick   move            right stick  look
 *   LT (axis)    aim (ADS)       RT (button)  fire
 *   A            jump            B            crouch (hold)
 *   X            reload          Y            interact (E)
 *   LB / RB      previous/next weapon
 *   L3           sprint (hold)   Start        pause (exit pointer lock)
 */
export class GamepadInput {
  constructor(options = {}) {
    this.deadzone = options.deadzone ?? 0.18;
    this.lookScale = options.lookScale ?? 9;
    this._prev = {};
    this.connected = false;
  }

  _pressed(gp, idx) {
    const now = !!gp.buttons[idx]?.pressed;
    const was = this._prev[idx] || false;
    this._prev[idx] = now;
    return now && !was;
  }

  /**
   * @param {number} dt
   * @param {{controller?: object, weaponManager?: object, onInteract?: Function, onPause?: Function}} deps
   * @returns {boolean} true if a gamepad was read this frame
   */
  update(dt, { controller, weaponManager, onInteract, onPause } = {}) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    const gp = pads && (pads[0] || pads[1] || pads[2] || pads[3]);
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
      const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      weaponManager.setAiming(lt > 0.5);
      weaponManager.setFiring(rt > 0.5);
      if (this._pressed(gp, 2)) weaponManager.reload();
      if (this._pressed(gp, 5)) weaponManager.switchNext();
      if (this._pressed(gp, 4)) weaponManager.switchPrev();
    }

    if (this._pressed(gp, 3) && onInteract) onInteract();
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
