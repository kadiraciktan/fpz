/**
 * textures/zombie.js
 * 16x16 pixel zombie skin: grey-green skin, dark eyes, tattered shirt.
 */
export const zombieTexture = {
  size: 16,
  palette: {
    K: '#1a1a1a', // outline / very dark
    G: '#5a7a5a', // skin green
    D: '#3d5a3d', // darker skin / bruise
    E: '#1a1a1a', // eye socket
    M: '#3a2a2a', // mouth
    S: '#4a5a3a', // shirt olive
    T: '#3a4a2a', // shirt tear
    B: '#2a3a2a', // pants dark
  },
  pixels: [
    'KKKKKKKKKKKKKKKK',
    'KGGGGGEEGGGEEGGK',
    'KGEEGGGEGGGEEDGE',
    'KGGGGGGGGGGGGGGK',
    'KGGGGMMGGGGGGGGK',
    'KGGGGGGGGGGGGGGK',
    'KGGGGGGGGGGGGGGK',
    'KKKKKKKKKKKKKKKK',
    'KKKSSSSSSSSSSKKK',
    'KSSSTSTTSTTSTTSK',
    'KSSSTSTTSTTSTTSK',
    'KSSSSSTTSTTSSSSK',
    'KKBBBBBBBBBBBKKK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KKKKKKKKKKKKKKKK',
  ],
};
