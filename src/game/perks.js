/**
 * game/perks.js
 * Perk machine definitions (CoD zombies style): one of each per map,
 * bought with points.
 */

export const PERKS = [
  { key: 'speedCola', label: 'SPEED COLA', icon: '⚡', cost: 1200, color: 0x43a047, hint: '%40 daha hızlı şarjör' },
  { key: 'doubleTap', label: 'DOUBLE TAP', icon: '🎯', cost: 1500, color: 0xe53935, hint: 'x2 silah hasarı' },
  { key: 'juggerNog', label: 'JUGGER-NOG', icon: '❤️', cost: 1500, color: 0x8e24aa, hint: '+50 maksimum can' },
  { key: 'quickRevive', label: 'QUICK REVIVE', icon: '🚑', cost: 1000, color: 0x00acc1, hint: 'Ölümden bir kez döndürür' },
  { key: 'staminUp', label: 'STAMIN-UP', icon: '🏃', cost: 800, color: 0xfb8c00, hint: '+%15 yürüyüş, +%25 koşu' },
];
