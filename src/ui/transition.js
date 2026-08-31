/**
 * ui/transition.js
 * Deployment transition: the cinematic menu → game handoff screen with
 * status steps, progress bar and the pointer-lock retry fallback.
 */

export function createTransition(onRetryLock) {
  const transitionEl = document.getElementById('transition');
  const trStatusEl = document.getElementById('trStatus');
  const trBarEl = document.getElementById('trBarFill');
  const trHintEl = document.getElementById('trHint');

  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; };

  function show(mapName) {
    clearTimers();
    transitionEl.classList.remove('hidden', 'out');
    trHintEl.textContent = '';
    trBarEl.classList.remove('run');
    void trBarEl.offsetWidth; // restart the fill animation
    trBarEl.classList.add('run');
    const steps = [
      `HARİTA YÜKLENİYOR: ${mapName}`,
      'CEPHANE DAĞITILIYOR...',
      'SİPERLER KURULUYOR...',
      'ZOMBİLER GELİYOR...',
    ];
    steps.forEach((s, i) => later(() => { trStatusEl.textContent = s; }, i * 280));
  }

  function end() {
    if (transitionEl.classList.contains('hidden')) return;
    transitionEl.classList.add('out');
    later(() => {
      transitionEl.classList.add('hidden');
      transitionEl.classList.remove('out');
    }, 650);
  }

  // Fallback: if the browser didn't auto-lock the mouse, clicking the
  // transition screen requests the lock (keeps the cinematic flow).
  transitionEl.addEventListener('click', () => {
    if (!isHidden()) onRetryLock();
  });

  const isHidden = () => transitionEl.classList.contains('hidden');
  const setHint = (text) => { trHintEl.textContent = text; };

  return { show, end, later, isHidden, setHint };
}
