import { AI } from '../core/Constants.js';

/**
 * Start-grid pose for racer `i` (3 rows × 2 columns behind the start line).
 *
 * Rows step BACK along the actual centerline (following the curve), not along a
 * straight start tangent — so on twisty starts (Twilight, Cosmic) the grid hugs
 * the road instead of drifting off it. Each kart faces along its local tangent
 * and is offset laterally onto its column.
 */
export function gridPose(track, i) {
  const samples = track.samples;
  const n = samples.length;
  const row = Math.floor(i / 2);
  const col = i % 2;
  const back = AI.GRID_START_BACK + row * AI.GRID_ROW_GAP; // world units behind the line
  const spacing = (track.curve.getLength() || n) / n;       // ~even arc-length spacing
  const stepsBack = Math.round(back / spacing);
  const idx = (((-stepsBack) % n) + n) % n;                  // wrap behind sample 0
  const s = samples[idx];
  const lat = (col === 0 ? -1 : 1) * AI.GRID_LANE;
  return {
    position: { x: s.pos.x + s.normal.x * lat, z: s.pos.z + s.normal.z * lat },
    heading: Math.atan2(-s.tan.x, -s.tan.z),
  };
}
