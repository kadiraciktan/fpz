/**
 * textures/hands.js
 * 16x16 pixel texture for first-person hands (WaW 2008 style).
 * Top half (rows 0-7)  = field-grey sleeve  -> uv [0, 0, 16, 8]
 * Bottom half (rows 8-15) = skin            -> uv [0, 8, 16, 16]
 */
export const handsTexture = {
  size: 16,
  palette: {
    'g': '#3a4038', // sleeve dark (field grey-green)
    'G': '#4a5248', // sleeve light
    's': '#c89878', // skin
    'S': '#b08060', // skin shadow
    'w': '#d8a888', // skin highlight
  },
  pixels: [
    // sleeve (top)
    'gggggggggggggggg',
    'gGgGgGgGgGgGgGgG',
    'gGgGgGgGgGgGgGgG',
    'gggggggggggggggg',
    'gGgGgGgGgGgGgGgG',
    'gGgGgGgGgGgGgGgG',
    'gggggggggggggggg',
    'gGgGgGgGgGgGgGgG',
    // skin (bottom)
    'ssssssssssssssss',
    'sSssssssssssssSs',
    'sSssssssssssssSs',
    'ssssssssssssssss',
    'wssssssssssssssw',
    'ssssssssssssssss',
    'sSssssssssssssSs',
    'ssssssssssssssss',
  ],
};
