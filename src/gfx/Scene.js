/**
 * Scene.js
 * Re-exports the map factory. Layouts live under src/maps/.
 *
 *   createScene('street')   — war-torn city street (default)
 *   createScene('factory')  — smoky industrial factory interior
 *   createScene('bunker')   — tight underground concrete bunker
 *   createScene('nacht')    — Nacht der Untoten night airfield outpost
 */
export { MAPS, flickerLights, createScene } from '../maps/index.js';
