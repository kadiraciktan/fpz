# Three.js FPS Starter

A browser-based zombie FPS built with Three.js (v0.160.0). No build tools — pure ES modules loaded via importmap.

## Quick Start

```bash
npm install          # installs three.js for Node-based tests
npm test             # run all unit tests (node --test)
npm run check:assets # validate all model/texture definitions
npm run check:modules# verify every relative ESM import resolves
```

Play online (GitHub Pages): https://kadiraciktan.github.io/fpz/

Or serve the project root locally — no build step:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Project Structure

```
├── index.html              # Game entry point (importmap → three@0.160.0)
├── src/
│   ├── main.js             # Game loop, rounds, scoring, HUD, pause settings
│   ├── gfx/
│   │   ├── Scene.js        #   Re-exports createScene / MAPS from src/maps/
│   │   ├── ModelLoader.js  #   buildModel() + buildTexture() pipeline
│   │   ├── BloodDecals.js  #   Pooled ground-blood splats (ring buffer)
│   │   └── Prefabs.js      #   Reusable scene objects (lamps, crates, barriers)
│   ├── sfx/
│   │   └── Sound.js        #   Web Audio procedural SFX + tension music
│   ├── anims/
│   │   └── Animation.js    #   Keyframe Animator (pos/rot/scale, lerp, onEnd)
│   ├── input/
│   │   ├── FPSController.js#   Pointer-lock FPS camera, WASD + jump + crouch
│   │   └── Gamepad.js      #   Gamepad API bridge (sticks, triggers, buttons)
│   ├── maps/
│   │   ├── index.js        #   Map registry + scene factory
│   │   ├── kit.js          #   Shared lights, props, sky helpers
│   │   ├── street.js       #   Savaş Sokakları
│   │   ├── factory.js      #   Terk Edilmiş Fabrika
│   │   ├── bunker.js       #   Yeraltı Sığınağı
│   │   └── nacht.js        #   Nacht der Untoten
│   ├── weapons/
│   │   ├── Weapons.js      #   WeaponManager facade (ammo, tracers, reload)
│   │   ├── defs.js         #   Weapon stats, attachment/skin metadata, box pool
│   │   ├── ammo.js         #   Pure ammo-economy math (reserve, weighted picks)
│   │   ├── attachments.js  #   Optic/suppressor/grip/mag/stock builders
│   │   └── viewmodels.js   #   Gun, hands and first-person legs meshes
│   ├── game/
│   │   ├── Enemy.js        #   Zombie AI: walk/attack/death + Animator
│   │   ├── waves.js        #   Pure wave scaling + special round formulas
│   │   ├── zombies.js      #   Difficulty, Pack-a-Punch, grenade & barrier math
│   │   ├── ammoTypes.js    #   Pure special-ammo formulas (burn, shock chain)
│   │   └── weather.js      #   Weather state machine + one-draw-call rain
│   └── ui/
│       └── gunsmith.js     #   Gunsmith screen (preview renderer, cards)
├── models/
│   ├── pistol.js           # M1911 — 11 parts, fire + reload anims
│   ├── rifle.js            # M1 Garand — 9 parts, fire + reload anims
│   ├── shotgun.js          # M1897 Trench — 8 parts, fire + pump reload
│   ├── thompson.js         # M1A1 SMG — 10 parts, fire + drum reload
│   ├── m4a1.js             # M4A1 carbine (CoD-style) — 10 parts
│   ├── mp5.js              # MP5K SMG (CoD-style) — 10 parts
│   ├── cal50.js            # .50 CAL rifle (CoD-style) — 11 parts, bipod
│   ├── lsw.js              # LSW LMG (CoD-style) — 11 parts, box mag
│   ├── raygun.js           # RAY GUN wonder weapon — 10 parts, glow rings
│   ├── zombie.js           # 4 parts (legs, body, head, arms) + 4 anims
│   ├── headcrab.js         # 6 parts (shell, head, legs, claws) + 5 anims
│   ├── hands.js            # First-person hands viewmodel + reload clips
│   ├── legs.js             # First-person legs (thigh/shin/boot)
│   └── streetlamp.js       # 5-part prop
├── textures/
│   ├── weapon.js           # 32×32 gun sprite atlas
│   ├── shotgun.js          # 32×32 trench gun texture
│   ├── zombie.js           # 16×16 skins: zombie + sprinter/brute/bomber/headcrab variants
│   ├── hands.js            # 16×16 hands/sleeves
│   ├── legs.js             # 16×16 legs/boot
│   ├── wood.js             # 16×16 wood grain
│   ├── lamp.js             # 16×16 metal pole
│   └── hud-round.js        # 16×16 HUD round counter
├── tests/
│   ├── model_loader.test.js  # buildTexture + buildModel unit tests
│   ├── assets.test.js        # All model/texture definitions valid
│   ├── animation.test.js     # Animator interpolation, loops, onEnd
│   ├── waves.test.js         # Wave scaling + special round formulas
│   ├── ammo.test.js          # Ammo economy + weighted loot picks
│   ├── ammo_types.test.js    # Special ammo: stacking, burn tick, zap chain
│   ├── downed.test.js        # Bleed-out bar, kill bonus, carpet constants
│   ├── enemy.test.js         # Burn DoT, stun freeze, boss dash/summon, topple
│   ├── weather.test.js       # Weather rolls + rain column buffer reuse
│   └── zombies.test.js       # Difficulty, PaP, grenades, barrier, machine spots
├── tools/
│   └── check-assets.js     # CLI validator for all assets
└── dev/
    ├── studio.html         # Asset viewer (turntable, part picker, texture)
    └── studio.js
```

## Animation System

Each model can define an `anims` object with named clips:

```js
anims: {
  walk: {
    duration: 0.7,        // seconds per cycle
    loop: true,           // default; set false for one-shots
    tracks: {
      armL: [             // part name → keyframes
        { t: 0.0, rot: [0.8, 0, 0] },
        { t: 0.5, rot: [-0.5, 0, 0] },
        { t: 1.0, rot: [0.8, 0, 0] },
      ],
    },
  },
}
```

- **Keyframe values are deltas** relative to the part's rest pose.
- `t` is normalized [0, 1]; interpolation is linear.
- The special key `root` targets the model's root group.
- The `Animator` class (`src/anims/Animation.js`) handles play/stop/loop/onEnd.

### Model Part Pivots

Each element can specify a `pivot` point. The part is wrapped in an `Object3D`
at that pivot, so rotations happen around the joint (shoulder, hip, neck):

```js
{
  name: 'armL',
  from: [-0.45, 0.5, 0.05],
  to:   [-0.3,  1.35, 0.25],
  pivot: [-0.375, 1.35, 0.15],  // shoulder joint
  faces: { ... }
}
```

## Asset Validator

`tools/check-assets.js` validates:
- Texture dimensions match declared `size`
- No blank rows in pixel arrays
- All pixel characters exist in the palette
- Palette hex colors are valid
- Model elements have unique names, `from < to` on all axes
- Face names are valid (north/south/east/west/up/down)
- UV coordinates within texture bounds
- Animation part names reference existing elements
- Keyframe times are non-decreasing

```bash
node tools/check-assets.js
```

## Dev Tools

### Asset Studio

```bash
python3 -m http.server 8080
# → http://localhost:8080/dev/studio.html
```

Features: turntable rotation, part picking, wireframe toggle, texture preview.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump |
| Shift | Sprint |
| C | Tap = slide · hold = crouch (slow, low profile) |
| Mouse | Look / Aim |
| LMB | Shoot |
| RMB | Aim (ADS) |
| R | Reload (uses finite reserve ammo) |
| 1-4 | Switch weapon |
| E | Interact (wall gun / Pack-a-Punch / box / perk / barrier / repair) |
| V | Melee (bayonet) |
| G | Noisemaker (lures zombies) |
| H | Frag grenade (AoE — careful up close!) |
| B | Build sandbag (prep phase) |
| Esc | Pause menu (sensitivity / volume / FOV sliders) |

## Gamepad (Xbox/standard layout)

Auto-detected every frame — connect/disconnect shows a toast, and a standard-
mapping pad is preferred when a receiver exposes phantom pads:

| Input | Action |
|-------|--------|
| Left stick | Move |
| Right stick | Look |
| LT / RT | Aim / Shoot |
| A / B | Jump / Crouch (hold) |
| X / Y | Reload / Interact |
| LB / RB | Previous / next weapon |
| L3 | Sprint (hold) |
| Start | Pause / resume (also restarts after game over) |

- **Menus**: D-pad / left stick moves a glowing focus ring across map cards,
  gunsmith cards, skins and buttons — A clicks (with rumble blips). Note:
  starting the match still needs one mouse click on the loading screen
  (browsers only grant pointer lock on a real user gesture).
- **Rumble**: hits, kills, pickups, purchases, wave starts, boss spawns,
  damage and death all drive the vibration actuators (dual-rumble with a
  `pulse()` fallback for Firefox).

## Perk Machines (CoD Zombies style)

Each map scatters 5 glowing vending machines on open ground. Walk up, press
`E`, pay with your score, keep the perk for the rest of the run:

| Machine | Cost | Perk |
|---------|------|------|
| ⚡ SPEED COLA | 1200 | -40% reload time |
| 🎯 DOUBLE TAP | 1500 | x2 bullet damage |
| ❤️ JUGGER-NOG | 1500 | +50 max health |
| 🚑 QUICK REVIVE | 1000 | survive death once |
| 🏃 STAMIN-UP | 800 | +15% walk, +25% sprint |

Owned perks show as a strip on the HUD; sold machines dim and flip to SOLD.

## Map Barriers (CoD Zombies style)

Each map starts in a small core zone. Extra districts are sealed behind
glowing barriers with a `E · COST PUAN` sign. Walk up, press `E`, pay with
your score — the barrier is torn down and the new zone becomes walkable AND
becomes a valid zombie spawn area:

| Map | Barrier | Cost | Unlocks |
|-----|---------|------|---------|
| Savaş Sokakları | south partition | 500 | Row-house district (south) |
| Savaş Sokakları | north partition | 700 | Tram yard (north) |
| Terk Edilmiş Fabrika | east gate | 500 | Silo hangar (east) |
| Terk Edilmiş Fabrika | west gate | 500 | Scrap hangar (west) |
| Yeraltı Sığınağı | south blast door | 500 | Reactor storage wing |
| Yeraltı Sığınağı | north blast door | 700 | Barracks wing |
| Nacht der Untoten | west door | 750 | West wing + north help room |
| Nacht der Untoten | east door | 1000 | East wing (stairs room) |

Nacht extra: boarded windows are open climb-throughs — zombies step over
the low sill, the player can vault it with a jump. Buying one Nacht door
opens a kite loop through the north help room; the second door completes
the circuit back through spawn.

## Weapons

8 weapons in 6 categories (CoD-style loadout: pick 4 slots in the Gunsmith).

| Weapon | Category | Mag | RoF | Damage | Range | Reload |
|--------|----------|-----|-----|--------|-------|--------|
| M1911 (Pistol) | Tabanca | 12 | 0.35s | 1 | 60m | 1.2s |
| M1 Garand (Rifle) | Piyade Tüfeği | 30 | 0.10s | 1 | 100m | 2.0s |
| M4A1 | Piyade Tüfeği | 30 | 0.11s | 1 | 85m | 1.8s |
| M1897 (Shotgun) | Pompalı | 6 | 0.80s | 3 | 30m | 2.5s |
| Thompson | Makineli Tabanca | 20 | 0.08s | 1 | 50m | 2.0s |
| MP5K | Makineli Tabanca | 30 | 0.075s | 1 | 45m | 1.7s |
| .50 CAL | Keskin Nişancı | 5 | 1.50s | 6 | 180m | 3.2s |
| LSW | Makineli Tüfek | 50 | 0.13s | 1 | 75m | 3.4s |
| RAY GUN | WONDER (sadece kutu) | 20 | 0.45s | 4 | 70m | 2.6s |

Attachments unlock with lifetime XP (kills/headshots/waves); optics share one
mount slot; the .50 CAL and M4A1 take the sniper tube scope.

## Ammo Economy

Every gun starts with 4 full magazines of **reserve ammo** (HUD: `mag ▸ reserve`).
Reloading draws from the reserve — when it runs dry the gun clicks and you must
wait for a drop:

- **CEP crate** (30% of drops): tops up every gun's reserve by 1.5 magazines
- **MAX pickup**: fills every gun completely (magazine + reserve)
- Boss kills always drop a MAX

## Special Rounds

- **Boss round** — every 5th round from round 5 (two from round 15): huge red
  elites (x10 HP, x2 damage, 500 pts, MAX drop). Bosses ATTACK: they wind up a
  red flash then **lunge at 3.6× speed** every ~6-11 s, and every ~12-18 s they
  roar and **summon 2 sprinters** at their feet (hard cap: 6 live summoners).
- **Sprint round** — every 7th round: the horde is 100% sprinters
- **Headcrab incursion** — every 4th round from round 4: a pack of hopping
  headcrabs (Half-Life-style) mixes into the wave — fast, low HP, they pounce
  at your feet in short leaps
- Wave formulas live in `src/game/waves.js` (unit-tested)

## Power-Ups (kill drops ~25%)

Beyond the classic CEP / MAX / Insta-Kill / Double Points / Nuke / MedKit:

- **CARPET** — carpet bombing: 12 bombs walk in around you over ~2 s
- **x2CEP** — every gun's reserve doubles (up to 8 magazines)
- **EJDER / ŞOK / PATLAR** — special ammo, see below

## Special Ammo (power-up drops)

Drops ride on your NORMAL guns; the HUD ammo line shows the badge (🔥10 …)
and every shot consumes one special round. Pure math in
`src/game/ammoTypes.js` (unit-tested):

- **🔥 EJDER NEFESİ** (10 rounds) — ignites the hit zombie: 4 s of burn DoT;
  burn kills score points like any other kill
- **⚡ ŞOK MERMİ** (12 rounds) — stuns the target ~1.3 s (frozen mid-step,
  cyan glow) and arcs a zap chain to the 3 nearest zombies within 4 m
- **💥 PATLAYICI MERMİ** (6 rounds) — mini grenade blast at the impact point
  (3 m / 4 dmg, same falloff + knockback rules as frags)

## Downed / Last Stand

A lethal hit no longer ends the run instantly (Quick Revive still fully
revives you first). Instead you **go down**: the camera drops to the floor,
you crawl at 32% speed and keep shooting while a red **bleed-out bar** drains
(~12 s). Zombie bites chew the bar faster; **every kill buys back +1.5 s**
— hold out until the wave dies and you stand back up with 40 HP. Formulas in
`src/game/zombies.js` (unit-tested).

## Mystery Box (CoD-style loot table)

950 pts — 8 guns roll, weighted by rarity (YAYGIN → IYI → NADIR → EFSANE),
plus the **WONDER** Ray Gun (weight 3, see below). The gun replaces your
active slot; a duplicate instead refills your ammo. Pay again on the same
box to reroll.

## Wonder Weapon: RAY GUN

Mystery-box exclusive (weight 3 — rarer than EFSANE). Green-glowing rings,
zap SFX, plasma tracers, and **every connecting hit pops a 2.6 m splash**
that AoE-damages everything nearby. Not sellable, not in the gunsmith — pure
box luck, +100 XP on the pull.

## Weather + Day/Night

Outdoor maps (Savaş Sokakları, Terk Edilmiş Fabrika) run a real **240-second
sun arc** — dawn to moonlit night inside a run — and roll **clear / rain /
storm** each wave. Storms bring lightning flashes, thunder and collapsed
sight distance (fog). Rain is a single LineSegments draw call (700 drops on
ORTA, 1200 on YÜKSEK, off on DÜŞÜK) recycled inside a column that follows
the player — zero per-drop objects, zero per-frame allocation. Indoor maps
keep the old light breathing. State machine is pure + unit-tested
(`src/game/weather.js`).

## Blood Pools & Corpse Staging

Kills stamp a ground blood pool under the corpse (16-mesh ring buffer, one
shared material — free per kill, no draw-call growth). Kills also **topple
the body along the shot direction**: the zombie spins to face the bullet's
travel and tips over with a random tumble plus a shove, so pistol kills and
.50 CAL hits look different. Blast deaths fly away from the epicenter.

## Wall Buy + Pack-a-Punch

Every run mounts **3 wall guns flush on real building/perimeter walls** and
drops a **Pack-a-Punch** station on open ground in the core zone (spot
solvers + weapon rotation live in `src/game/zombies.js`, unit-tested; the
compass points at all of them):

- **Wall guns** — 750 / 1000 / 1250 pts, three different weapons per run,
  hugged onto tall thin wall faces with their backs to the masonry and the
  player side clear to stand at (floor-mount fallback on maps without usable
  walls). E to buy; the gun replaces your active slot, the mount flips to SOLD.
- **Pack-a-Punch** — 5000 pts, once per run, upgrades the gun you are
  HOLDING: x2+1 damage, +50% mag, +15% range, faster fire/reload, purple
  glowing **Mk II** viewmodel and a fresh full reserve. Upgraded guns stay
  upgraded even if the mystery box re-grants them.

## Frag Grenades (H)

One frag per prep phase. Ballistic arc with bounces, 1.6 s fuse, 5 m blast —
linear damage falloff, radial knockback, and yes, you can grenade yourself.

## Barrier Defense (the horde pushes back)

Opened barriers are not free real estate forever: zombies funneling through
a gate tear its frame apart (~240 HP of chew). The knocked-down frame sags
visibly as it drains, the compass marks it `!`, and below ~85% you can pay
**150 pts (E)** to patch it. If it hits zero the zone is **re-sealed** —
zombies trapped inside can't be reached, so you'll pay the barrier cost
again to clear the rubble path.

## Difficulty Modes

Pick NEFER / VETERAN / KÂBUS in the main menu (saved with your loadout).
Veteran: +50% zombie HP/damage, score x1.5. Nightmare: x2 HP & damage,
+faster zombies, score x2. Best round/score is recorded **per map+difficulty**.

## HUD Upgrades

- **Compass ribbon** (top): K/D/G/B cardinals + live POI dots — `?` mystery
  box, `P` Pack-a-Punch, `G` wall guns, `!` breaching barrier.
- **Buff strip**: Insta-Kill / Double Points countdowns + the active
  difficulty tag; the gear readout now also counts grenades 🧨.

## Persistence (localStorage)

XP + attachment unlocks and lifetime stats were already saved; now also:
- **Per-run records** — best round & score per map × difficulty (shown on
  the map cards and the stats screen)
- **Last deployment** — map, difficulty, loadout, attachments and skins are
  restored next time you open the menu

## Positional Audio

Zombie growls and headcrab chirps are stereo-panned by their bearing to the
camera — the moan you hear from behind-left really is behind-left.

## Performance

Pause-menu **Grafik** preset (DÜŞÜK / ORTA / YÜKSEK, saved with the other
options) drives pixel ratio, shadow maps and shadow-camera size. Defaults
to ORTA: no MSAA, PCF shadows that follow the player, distant lights and
casters culled.

Far zombies skip pose updates, steering, crowd separation and chewing;
horde separation uses a spatial hash so late rounds stay O(n) instead of
O(n²). F3 toggles the perf HUD; Shift+F3 dumps a mesh breakdown.

## Audio

All procedural Web Audio — no files. 8 per-weapon gunshot profiles, filtered
street echo, bearing-panned zombie growls, and a tension music layer
(A-minor drone + bass sequence) whose tempo and lead register rise with the
wave count.

## Notes

- No external dependencies in the browser (three.js via CDN importmap).
- All geometry is procedural box meshes — no glTF or external assets.
- Textures are generated at runtime from ASCII pixel art arrays.
- `node_modules/` contains only `three` (for Node-based tests).
