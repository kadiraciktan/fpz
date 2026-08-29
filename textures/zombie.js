/**
 * textures/zombie.js
 * 16x16 pixel zombie skins: one per type variant.
 *  normal    — grey-green skin, tattered olive shirt
 *  sprinter  — pale, sickly, clothes ripped to shreds
 *  brute     — dark bloated muscle, heavily torn dark shirt
 *  bomber    — rusty orange flesh with glowing volatile pustules
 *  headcrab  — pink-brown dome with pale mouth-plate
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

/** Sprinter: washed-out pale flesh, gaunt face, shredded clothes. */
export const zombieSprinterTexture = {
  size: 16,
  palette: {
    K: '#1a1a1a', // outline
    G: '#d9cfa6', // pale flesh
    D: '#a89a72', // shadow / hollows
    E: '#1a1a1a', // eye socket
    M: '#3a2a2a', // mouth
    S: '#7a6a55', // rags tan
    T: '#33291d', // rags holes
    B: '#565044', // pants faded grey
  },
  pixels: [
    'KKKKKKKKKKKKKKKK',
    'KGGGGGEEGGGEEGGK',
    'KGEEGGGEGGGEEDGE',
    'KGGGDGGGGGGDGGGK',
    'KGGGMMMGGGGGGDDK',
    'KGGGGGGGGGGGDDGK',
    'KGDGGGGGGGGGGGGK',
    'KKKKKKKKKKKKKKKK',
    'KKKSSSSSSSSSSKKK',
    'KTTSTTTTSTTTSTTK',
    'KSTTTSTTSTTSTTTK',
    'KSSTTTSSTTTSSTSK',
    'KKBBTBBBBBBTBBKK',
    'KBBBBBBBBBBBBBBK',
    'KBSTBBBBBBBSTBTK',
    'KKKKKKKKKKKKKKKK',
  ],
};

/** Brute: dark swollen muscle, mud-black rags, deep bruises. */
export const zombieBruteTexture = {
  size: 16,
  palette: {
    K: '#12140f', // outline
    G: '#6d8355', // hide green
    D: '#42542f', // bruise
    E: '#101010', // eye socket
    M: '#33261f', // maw
    S: '#39412d', // heavy shirt
    T: '#1f2418', // deep tears
    B: '#232a1c', // pants
  },
  pixels: [
    'KKKKKKKKKKKKKKKK',
    'KGGGGGEEGGGEEGGK',
    'KGDGGGEGGGGDDGGK',
    'KGGDDGGGGGDDGGGK',
    'KGGMMMGGGGGGMDGK',
    'KGGDDGGGDDGGGGDK',
    'KGDGGGGGGGGGGDGK',
    'KKKKKKKKKKKKKKKK',
    'KKSSSSSSSSSSSSKK',
    'KSSSTTTSSSTTTSSK',
    'KSTTTTSSSTTTTSTK',
    'KSSSTTTTTTSSTSSK',
    'KKBBBBBBBBBBBKKK',
    'KBDDDDDDDDDDDDBK',
    'KBDBBBBBBBBBBDBK',
    'KKKKKKKKKKKKKKKK',
  ],
};

/** Headcrab: pink-brown dome, pale mouth-plate, dark whip legs. */
export const headcrabTexture = {
  size: 16,
  palette: {
    K: '#1a0f0a', // outline
    P: '#c68464', // shell pink
    O: '#e09a6a', // shell highlight
    D: '#8a4f3a', // shell bruise
    W: '#e8cfae', // pale underside
    M: '#2a150f', // mouth / fang line
    L: '#6a4030', // leg brown
    N: '#42250f', // leg dark
  },
  pixels: [
    'KKKKKKKKKKKKKKKK',
    'KPPPPPPPPPPPPPPK',
    'KPOPPDPPPPPDPPPK',
    'KPDDPPPOPPPPDPPK',
    'KPPPPPPPPDPPPPPK',
    'KKKKKKKKKKKKKKKK',
    'KWWWWWWWWWWWWWWK',
    'KWMMWWWWWWWWMMWK',
    'KWWMMWWMMWWWWWWK',
    'KWWWWMMMMWWWWWWK',
    'KLNLLNLLLLNLLNLK',
    'KLLLLLLLLLLLLLLK',
    'KNNLLNNLLLLLLNNK',
    'KLLLLDLLLLLLDLLK',
    'KLLLLLLLLDLLLLLK',
    'KKKKKKKKKKKKKKKK',
  ],
};

/** Bomber: volatile orange flesh studded with glowing pustules. */
export const zombieBomberTexture = {
  size: 16,
  palette: {
    K: '#1a120a', // outline
    G: '#b0682c', // flesh rust
    D: '#7a4418', // bruise
    E: '#1a0e06', // eye socket
    M: '#2a1208', // mouth
    S: '#6a4420', // scorched wraps
    T: '#42280f', // torn wraps
    B: '#3a2818', // pants
    P: '#ffb020', // glowing pustule
  },
  pixels: [
    'KKKKKKKKKKKKKKKK',
    'KPGGGGEEGGGGGEPK',
    'KGEEGGGEGGGEEDGE',
    'KGGGGPGGGGGPGGGK',
    'KGGGGMMGGGGGGGGK',
    'KGGDGGGGPGGGDGGK',
    'KGGGGGGGGGGGGPGK',
    'KKKKKKKKKKKKKKKK',
    'KKKSSSSSSSSSSKKK',
    'KSSTSSPSTTSSPTSK',
    'KSSSTSSSTTSTSSPK',
    'KSTSSPSTTSSSTTSK',
    'KKBPBBBBBPBBBBKK',
    'KBBBBBBBBBBBBBBK',
    'KPBBBPBBBBBPBBBK',
    'KKKKKKKKKKKKKKKK',
  ],
};
