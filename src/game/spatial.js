/**
 * game/spatial.js
 * Uniform grid hash for 2D (X/Z) neighbour queries. Used to keep horde
 * separation O(n) instead of O(n²) when late rounds field 40+ zombies.
 */

/** Pack a cell coordinate into a single int key (no string alloc). */
export function cellKey(cx, cz) {
  return ((cx + 512) << 16) | ((cz + 512) & 0xffff);
}

export function cellOf(x, z, cellSize) {
  return cellKey(Math.floor(x / cellSize), Math.floor(z / cellSize));
}

/** Insert `item` into `map` at (x, z). Creates the bucket if needed. */
export function insertHash(map, x, z, cellSize, item) {
  const key = cellOf(x, z, cellSize);
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  bucket.push(item);
  return map;
}

/**
 * Collect items in the Moore neighbourhood of (x, z).
 * Reuses `out` (cleared first) so the query is allocation-free.
 */
export function queryHash(map, x, z, cellSize, radiusCells, out) {
  out.length = 0;
  const cx = Math.floor(x / cellSize);
  const cz = Math.floor(z / cellSize);
  for (let i = -radiusCells; i <= radiusCells; i++) {
    for (let j = -radiusCells; j <= radiusCells; j++) {
      const bucket = map.get(cellKey(cx + i, cz + j));
      if (!bucket) continue;
      for (let k = 0; k < bucket.length; k++) out.push(bucket[k]);
    }
  }
  return out;
}
