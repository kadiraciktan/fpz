/**
 * ui/toast.js
 * Short-lived toast notifications ("Wave Cleared", "MAX Picked" ...).
 */

const toastsEl = document.getElementById('toasts');

export function showToast(text) {
  if (!toastsEl) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastsEl.appendChild(el);
  // Keep the stack short; remove after the fade-out animation.
  setTimeout(() => el.remove(), 2700);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
}
