/**
 * ui/util.js
 * Small shared DOM helpers.
 */

/**
 * Restart a CSS animation on an element without the classic
 * `void el.offsetWidth` reflow hack (a synchronous layout per shot/hit is
 * expensive mid-combat). The Web Animations API restart is layout-free.
 */
export function restartCssAnim(el) {
  if (!el) return;
  if (el.getAnimations) {
    const anims = el.getAnimations();
    if (anims.length) {
      for (const a of anims) {
        a.cancel();
        a.play();
      }
      return;
    }
  }
  void el.offsetWidth; // fallback: only for engines without getAnimations
}
