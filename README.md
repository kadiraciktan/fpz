# Three.js FPS Starter

A browser-based zombie FPS built with Three.js (v0.160.0). No build tools — pure ES modules loaded via importmap.

## Quick Start

```bash
npm install          # installs three.js for Node-based tests
npm test             # run all unit tests (node --test)
npm run check:assets # validate all model/texture definitions
```

To play in the browser, serve the project root with any static file server:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Project Structure

```
├── index.html              # Game entry point (importmap → three@0.160.0)
├── src/
│   ├── main.js             # Game loop, rounds, scoring, HUD, pause settings
│   ├── Scene.js            # Environment: ground, walls, streetlamps, sky
│   ├── FPSController.js    # Pointer-lock FPS camera, WASD + jump + crouch
│   ├── Gamepad.js          # Gamepad API bridge (sticks, triggers, buttons)
│   ├── Weapons.js          # WeaponManager facade (ammo, tracers, reload)
│   ├── weapons/
│   │   ├── defs.js         #   Weapon stats, attachment/skin metadata, box pool
│   │   ├── ammo.js         #   Pure ammo-economy math (reserve, weighted picks)
│   │   ├── attachments.js  #   Optic/suppressor/grip/mag/stock builders
│   │   └── viewmodels.js   #   Gun, hands and first-person legs meshes
│   ├── game/
│   │   └── waves.js        #   Pure wave scaling + special round formulas
│   ├── ui/
│   │   └── gunsmith.js     #   Gunsmith screen (preview renderer, cards)
│   ├── Enemy.js            # Zombie AI: walk/attack/death + Animator (+ hopping headcrab mode)
│   ├── ModelLoader.js      # buildModel() + buildTexture() pipeline
│   ├── Animation.js        # Keyframe Animator (pos/rot/scale, lerp, onEnd)
│   ├── Sound.js            # Web Audio procedural SFX + tension music
│   └── Prefabs.js          # Reusable scene objects (lamps, crates, barriers)
├── models/
│   ├── pistol.js           # M1911 — 11 parts, fire + reload anims
│   ├── rifle.js            # M1 Garand — 9 parts, fire + reload anims
│   ├── shotgun.js          # M1897 Trench — 8 parts, fire + pump reload
│   ├── thompson.js         # M1A1 SMG — 10 parts, fire + drum reload
│   ├── m4a1.js             # M4A1 carbine (CoD-style) — 10 parts
│   ├── mp5.js              # MP5K SMG (CoD-style) — 10 parts
│   ├── cal50.js            # .50 CAL rifle (CoD-style) — 11 parts, bipod
│   ├── lsw.js              # LSW LMG (CoD-style) — 11 parts, box mag
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
│   └── animation.test.js     # Animator interpolation, loops, onEnd
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
- The `Animator` class (`src/Animation.js`) handles play/stop/loop/onEnd.

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
| E | Interact (pickup / open box / buy perk) |
| V | Melee (bayonet) |
| G | Noisemaker (lures zombies) |
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
  elites (x10 HP, x2 damage, 500 pts, MAX drop)
- **Sprint round** — every 7th round: the horde is 100% sprinters
- **Headcrab incursion** — every 4th round from round 4: a pack of hopping
  headcrabs (Half-Life-style) mixes into the wave — fast, low HP, they pounce
  at your feet in short leaps
- Wave formulas live in `src/game/waves.js` (unit-tested)

## Mystery Box (CoD-style loot table)

950 pts — all 8 guns roll, weighted by rarity (YAYGIN → IYI → NADIR → EFSANE).
The gun replaces your active slot; a duplicate instead refills your ammo.
Pay again on the same box to reroll.

## Audio

All procedural Web Audio — no files. 8 per-weapon gunshot profiles, filtered
street echo, zombie growls, and a tension music layer (A-minor drone + bass
sequence) whose tempo and lead register rise with the wave count.

## Notes

- No external dependencies in the browser (three.js via CDN importmap).
- All geometry is procedural box meshes — no glTF or external assets.
- Textures are generated at runtime from ASCII pixel art arrays.
- `node_modules/` contains only `three` (for Node-based tests).
