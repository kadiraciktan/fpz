/**
 * textures/shotgun.js
 * 32x32 pixel texture for the M1897 trench shotgun viewmodel.
 * Palette: dark steel, rust, wood stock, perforated forend grid.
 * UV: buildModel maps this atlas onto the shotgun cuboids.
 */
export const shotgunTexture = {
  size: 32,
  palette: {
    '.': '#0a0a0a', // shadow / void
    'd': '#141414', // dark steel
    'm': '#242424', // medium steel
    'M': '#343434', // light steel
    'L': '#444444', // highlight steel
    'w': '#585858', // bright highlight
    'r': '#4a2a1a', // rust dark
    'R': '#6a3a22', // rust mid
    'o': '#8a4a28', // rust light
    'g': '#2e2418', // wood dark
    'G': '#3e3020', // wood mid
    'W': '#5a4430', // wood light
    'p': '#1a1a1a', // perforation hole
    'P': '#2a2a2a', // perforation ring
  },
  pixels: [
    '................................',
    '................................',
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
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dMmmmmmmmmmmmmmmmmmmmmmmMd....',
    '..dddddddddddddddddddddddddd....',
    '..gggggggggggggggggggggggggg....',
    '..gGgGgGgGgGgGgGgGgGgGgGgGgGgG..',
    '..gGgGgGgGgGgGgGgGgGgGgGgGgGgG..',
  ],
};
