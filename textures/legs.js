/**
 * textures/legs.js
 * 16x16 pixel texture for first-person legs (WaW / CoD style).
 * Top half (rows 0-9)  = olive field pants  -> uv [0, 0, 16, 10]
 * Bottom half (rows 10-15) = dark boots     -> uv [0, 10, 16, 16]
 */
export const legsTexture = {
  size: 16,
  palette: {
    'p': '#4a4a38', // pants dark (olive)
    'P': '#5a5a46', // pants light
    's': '#6a6a54', // pants highlight
    'b': '#241f1a', // boot dark
    'B': '#38302a', // boot light
    'w': '#4a4038', // boot highlight (sole edge)
  },
  pixels: [
    // pants (top)
    'pppppppppppppppp',
    'pPppppppppppppPp',
    'pppppppppppppppp',
    'pPppppppppppppPp',
    'pppppppppppppppp',
    'pPppppppppppppPp',
    'pppppppppppppppp',
    'pPppppppppppppPp',
    'pppppppppppppppp',
    'pPppppppppppppPp',
    // boots (bottom)
    'bbbbbbbbbbbbbbbb',
    'bBbbbbbbbbbbbbBb',
    'bBbbbbbbbbbbbbBb',
    'wwwwwwwwwwwwwwww',
    'bBbbbbbbbbbbbbBb',
    'bbbbbbbbbbbbbbbb',
  ],
};
