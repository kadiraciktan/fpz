import { pistolModel } from '../../models/pistol.js';
import { rifleModel } from '../../models/rifle.js';
import { shotgunModel } from '../../models/shotgun.js';
import { thompsonModel } from '../../models/thompson.js';
import { m4a1Model } from '../../models/m4a1.js';
import { mp5Model } from '../../models/mp5.js';
import { cal50Model } from '../../models/cal50.js';
import { lswModel } from '../../models/lsw.js';
import { raygunModel } from '../../models/raygun.js';

/**
 * weapons/defs.js
 * Static weapon data: stats, categories, model lookup, attachment/skin
 * metadata and the default 4-slot loadout.
 */

export const WEAPON_DEFS = [
  {
    name: 'Pistol',
    label: 'M1911',
    category: 'TABANCA',
    magazineSize: 12,
    fireRate: 0.35,
    reloadTime: 1.2,
    damage: 1,
    range: 60,
    color: 0x888888,
  },
  {
    name: 'Rifle',
    label: 'M1 GARAND',
    category: 'PİYADE TÜFEĞİ',
    magazineSize: 30,
    fireRate: 0.1,
    reloadTime: 2.0,
    damage: 1,
    range: 100,
    color: 0x555555,
  },
  {
    name: 'Shotgun',
    label: 'M1897 TRENCH',
    category: 'POMPALI',
    magazineSize: 6,
    fireRate: 0.8,
    reloadTime: 2.5,
    damage: 3,
    range: 30,
    color: 0x3a3a3a,
  },
  {
    name: 'Thompson',
    label: 'THOMPSON M1A1',
    category: 'MAKİNELİ TABANCA',
    magazineSize: 20,
    fireRate: 0.08,
    reloadTime: 2.0,
    damage: 1,
    range: 50,
    color: 0x444444,
  },
  {
    name: 'M4A1',
    label: 'M4A1',
    category: 'PİYADE TÜFEĞİ',
    magazineSize: 30,
    fireRate: 0.11,
    reloadTime: 1.8,
    damage: 1,
    range: 85,
    color: 0x3f4247,
  },
  {
    name: 'MP5',
    label: 'MP5K',
    category: 'MAKİNELİ TABANCA',
    magazineSize: 30,
    fireRate: 0.075,
    reloadTime: 1.7,
    damage: 1,
    range: 45,
    color: 0x2b2d31,
  },
  {
    name: 'Cal50',
    label: '.50 CAL',
    category: 'KESKİN NİŞANCI',
    magazineSize: 5,
    fireRate: 1.5,
    reloadTime: 3.2,
    damage: 6,
    range: 180,
    color: 0x4a4d52,
  },
  {
    name: 'LSW',
    label: 'LSW',
    category: 'MAKİNELİ TÜFEK',
    magazineSize: 50,
    fireRate: 0.13,
    reloadTime: 3.4,
    damage: 1,
    range: 75,
    color: 0x55585c,
  },
  {
    // Wonder weapon: only ever granted by the mystery box. `wonder` keeps
    // it out of the gunsmith/loadout/wall-gun pools; `splash` makes every
    // hit detonate a small green blast at the impact point.
    name: 'RayGun',
    label: 'RAY GUN',
    category: 'WONDER',
    magazineSize: 20,
    fireRate: 0.45,
    reloadTime: 2.6,
    damage: 4,
    range: 70,
    color: 0x2e7d32,
    wonder: true,
    splash: { radius: 2.6, damage: 3 },
  },
];

/** Display name per weapon id (Gunsmith + HUD). */
export const WEAPON_LABELS = Object.fromEntries(WEAPON_DEFS.map((d) => [d.name, d.label]));

/** Category display order for the loadout picker. */
export const WEAPON_CATEGORIES = [
  'TABANCA',
  'PİYADE TÜFEĞİ',
  'MAKİNELİ TABANCA',
  'POMPALI',
  'KESKİN NİŞANCI',
  'MAKİNELİ TÜFEK',
];

/** The 4 inventory slots keys 1-4 point at. */
export const DEFAULT_LOADOUT = ['Pistol', 'Rifle', 'Shotgun', 'Thompson'];

/**
 * Mystery box loot table: every weapon can drop, rarity weights the roll.
 * `label` is the rarity tag shown in the toast.
 */
export const MYSTERY_POOL = [
  { name: 'Pistol', weight: 16, rarity: 'YAYGIN' },
  { name: 'Rifle', weight: 15, rarity: 'YAYGIN' },
  { name: 'Thompson', weight: 14, rarity: 'YAYGIN' },
  { name: 'MP5', weight: 13, rarity: 'YAYGIN' },
  { name: 'M4A1', weight: 12, rarity: 'IYI' },
  { name: 'Shotgun', weight: 11, rarity: 'IYI' },
  { name: 'LSW', weight: 8, rarity: 'NADIR' },
  { name: 'Cal50', weight: 6, rarity: 'EFSANE' },
  { name: 'RayGun', weight: 3, rarity: 'WONDER' },
];

export const MODEL_BY_NAME = {
  Pistol: pistolModel,
  Rifle: rifleModel,
  Shotgun: shotgunModel,
  Thompson: thompsonModel,
  M4A1: m4a1Model,
  MP5: mp5Model,
  Cal50: cal50Model,
  LSW: lswModel,
  RayGun: raygunModel,
};

// Weapon-specific hand reload clips (see models/hands.js). Each weapon kind
// gets its own arm choreography; unknown weapons fall back to 'reload'.
export const HANDS_RELOAD_CLIP = {
  Pistol: 'reloadPistol',
  Rifle: 'reloadRifle',
  Shotgun: 'reloadShotgun',
  Thompson: 'reloadThompson',
};

/**
 * Attachments the player can pick in the Gunsmith screen, per weapon.
 * `xp` = lifetime XP needed to unlock the card (0 = always available).
 *  suppressor — quieter gunshot, no muzzle flash, -1 damage
 *  reflex / holo / acog / scope — optic slot (only one optic at a time);
 *    each zooms ADS to its OPTIC_FOV and hides the iron sights
 *  foregrip    (underbarrel) — steadier aim: faster ADS, less run-bob
 *  extendedMag (magazine) — +50% magazine size
 *  lightStock  (stock)    — +40% longer slide
 */
export const ATTACHMENTS = {
  suppressor: { label: 'Susturucu', slot: 'NAMLU', hint: 'Sessiz atış, flaş yok, -1 hasar', chip: '−1 HASAR', chipKind: 'bad', xp: 100 },
  reflex: { label: 'Refleks Nişangâh', slot: 'OPTİK', hint: 'Kırmızı nokta, hafif zoom (60°)', chip: '60° ZOOM', chipKind: 'info', xp: 0 },
  holo: { label: 'Holo Nişangâh', slot: 'OPTİK', hint: 'Holografik turuncu reticle (58°)', chip: '58° ZOOM', chipKind: 'info', xp: 100 },
  acog: { label: 'ACOG Dürbün', slot: 'OPTİK', hint: '4x yakın, chevron reticle (45°)', chip: '45° ZOOM', chipKind: 'info', xp: 260 },
  scope: { label: 'Keskin Nişan Dürbünü', slot: 'OPTİK', hint: '8x zoom, nişan çizgileri (30°)', chip: '30° ZOOM', chipKind: 'info', xp: 400 },
  foregrip: { label: 'Ön Tutacak', slot: 'ALT NAP', hint: 'Daha hızlı nişan, azalan koşu salınımı', chip: '+ADS +DURUŞ', chipKind: 'good', xp: 180 },
  extendedMag: { label: 'Geniş Şarjör', slot: 'ŞARJÖR', hint: '+%50 mermi', chip: '+%50 MERMİ', chipKind: 'good', xp: 260 },
  lightStock: { label: 'Hafif Dipçik', slot: 'DİPÇİK', hint: '+%40 daha uzun kayma', chip: '+%40 KAYMA', chipKind: 'good', xp: 320 },
};

/**
 * Optics share a single mount slot (CoD-style): only one can be equipped.
 * OPTIC_FOV = ADS field of view while aiming through each optic.
 */
export const OPTICS = ['reflex', 'holo', 'acog', 'scope'];
export const OPTIC_FOV = { reflex: 60, holo: 58, acog: 45, scope: 30 };

/** The optic key currently equipped in an attachment map, or null. */
export function activeOptic(att = {}) {
  for (const key of OPTICS) if (att[key]) return key;
  return null;
}

/**
 * Weapon skins. `color` tints the pixel texture (null = texture as-is);
 * metalness/roughness override the base material for the gold/night looks.
 */
export const SKINS = {
  default: { label: 'Standart', swatch: '#8f8a78', color: null, tint: null, hint: 'Klasik doku' },
  gold: { label: 'Altın', swatch: '#ffd24a', color: 0xfff0b0, tint: 0xd9a92f, metalness: 0.9, roughness: 0.22, hint: 'Tam altın kaplama' },
  camo: { label: 'Kamuflaj', swatch: '#5a7247', color: 0xc8e8a8, tint: 0x4c6238, roughness: 0.85, metalness: 0.05, hint: 'Orman kamuflajı' },
  rust: { label: 'Paslı', swatch: '#a0522d', color: 0xe08a50, tint: 0x7a4526, roughness: 0.95, metalness: 0.05, hint: 'Savaşta yıpranmış' },
  night: { label: 'Gece', swatch: '#23272e', color: 0x6a7688, tint: 0x14171c, roughness: 0.45, metalness: 0.6, hint: 'Mat siyah kaplama' },
};
