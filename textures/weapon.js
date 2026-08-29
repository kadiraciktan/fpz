/**
 * textures/weapon.js
 * 32x32 pixel texture for gun viewmodels (WaW 2008 Nacht style).
 * Dark steel with subtle highlights, grip lines, muzzle ring,
 * trigger guard, and sight accents.
 */
export const weaponTexture = {
  size: 32,
  palette: {
    '.': '#0d0d0d', // very dark / shadow
    'd': '#1a1a1a', // dark steel
    'm': '#2a2a2a', // medium steel
    'M': '#3a3a3a', // light steel
    'L': '#4a4a4a', // highlight steel
    'w': '#5a5a5a', // bright highlight
    'R': '#6a2a2a', // red accent bright
    'W': '#4e3a28', // grip / wood highlight
    'B': '#2a3a4a', // blue accent light

    'g': '#2e2418', // grip / wood dark
    'G': '#3e3020', // grip / wood light
    'W': '#4e3a28', // grip / wood highlight
    'r': '#4a1a1a', // red accent (sight)
    'R': '#6a2a2a', // red accent bright
    'b': '#1a2a3a', // blue accent (scope)
    'B': '#2a3a4a', // blue accent light
  },
  pixels: [
    '................................',
    '................................',
    '..dddddddddddddddddddddddddd....',
    '..dMMMMMMMMMMMMMMMMMMMMMMMMMd...',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dddddddddddddddddddddddddd....',
    '..gggggggggggggggggggggggggg....',
    '..gGgGgGgGgGgGgGgGgGgGgGgGgGgG..',
    '..gGgGgGgGgGgGgGgGgGgGgGgGgGgG..',
    '..gggggggggggggggggggggggggg....',
    '..rrrrrrrrrrrrrrrrrrrrrrrrrr....',
  ],
};
