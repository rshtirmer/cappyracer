/**
 * Track definitions. Each course is pure data: a closed centerline (XZ control
 * points for a CatmullRom loop) plus a visual theme. Track / Sky / LevelBuilder
 * / Scenery read from the active def, so adding a course = adding an entry here.
 *
 * Fields:
 *   id, name            — identity (id is the save key).
 *   difficulty          — display label ('Easy' | 'Hard' | 'Expert' | 'Bonus').
 *   env                 — scenery/sky/lighting preset: 'springs' | 'space' | 'highway'.
 *   laps                — race length (defaults to RACE.LAPS if omitted).
 *   bonus / gated       — bonus track + whether it's gated behind the main cup
 *                         (gated:false = available now; flip to true to require
 *                         every main track to be completed first).
 *   roadHalf/wallHalf   — optional per-track road/wall half-width override.
 *   controlPoints       — closed CatmullRom centerline (start/finish at [0]).
 *   theme               — sky/ground/fog colors + optional per-env extras.
 */
export const TRACK_DEFS = [
  // --- Track 1: the easy, beloved original. Untouched. -----------------------
  {
    id: 'springs',
    name: 'Sunset Springs',
    difficulty: 'Easy',
    env: 'springs',
    laps: 3,
    controlPoints: [
      [0, -64], [44, -58], [66, -22], [58, 18], [70, 52],
      [34, 72], [-16, 70], [-52, 56], [-72, 22], [-66, -20], [-40, -54],
    ],
    theme: {
      skyTop: 0x5b8fd0, skyMid: 0xffd9a3, skyHorizon: 0xff9e5e,
      fog: 0xffc290, ground: 0xffffff, // grass tint (white = as-authored, warm)
    },
  },

  // --- Track 2: the twilight hot-spring scenery (kept), but a far more
  //     technical path than track 1 — radial control points with wildly
  //     varying radii make alternating tight/open corners. -------------------
  {
    id: 'twilight',
    name: 'Twilight Hot Springs',
    difficulty: 'Hard',
    env: 'springs',
    laps: 3,
    controlPoints: [
      [0, -72], [23, -55], [55, -55], [46, -19], [74, 0], [54, 22], [57, 57], [18, 44],
      [0, 70], [-24, 57], [-58, 58], [-48, 20], [-76, 0], [-52, -21], [-57, -57], [-19, -46],
    ],
    theme: {
      skyTop: 0x241a55, skyMid: 0x9a5ad0, skyHorizon: 0xff8fb0,
      fog: 0xb98fc8, ground: 0x86b777, // dusky pink/purple twilight
    },
  },

  // --- Track 3: outer space. Big, fast, flowing loop above the void; neon
  //     track edges, starfield sky, floating asteroids. ----------------------
  {
    id: 'cosmos',
    name: 'Cosmic Drift',
    difficulty: 'Expert',
    env: 'space',
    laps: 3,
    controlPoints: [
      [0, -84], [30, -63], [69, -55], [64, -15], [84, 19], [50, 40], [38, 79], [0, 72],
      [-37, 77], [-50, 40], [-86, 20], [-64, 15], [-67, -54], [-30, -63],
    ],
    theme: {
      skyTop: 0x04030e, skyMid: 0x0d0826, skyHorizon: 0x261a5e,
      fog: 0x070514, ground: 0x161229, // deep space void
      // space extras
      starfield: true,
      planet: 0x6c8cff,
      roadColor: 0x12102a, edgeColor: 0x4fe4ff, edgeEmissive: 0x39d6ff,
      sunless: true,
    },
  },

  // --- Bonus track: a realistic highway to run "no-hesi" — a long, wide,
  //     fast oval with traffic you weave through. Unlocked now (gated:false);
  //     flip `gated` to true later to require beating all three main tracks. --
  {
    id: 'highway',
    name: 'Highway No-Hesi',
    difficulty: 'Bonus',
    env: 'highway',
    bonus: true,
    gated: false,         // <-- set true to gate behind the full Hot Spring Cup
    laps: 2,
    roadHalf: 11,         // wider, multi-lane road for weaving
    wallHalf: 13,
    controlPoints: [
      [0, -72], [58, -62], [100, -36], [115, 0], [100, 36], [58, 62], [0, 72],
      [-58, 62], [-100, 36], [-115, 0], [-100, -36], [-58, -62],
    ],
    theme: {
      skyTop: 0x4a90e2, skyMid: 0xbcdcff, skyHorizon: 0xeef6ff,
      fog: 0xd5e8ff, ground: 0x7c8a52, // bright clear daytime + roadside grass
      highway: true,
      roadColor: 0x3a3f47, edgeColor: 0xf4f4f4,
    },
  },
];

/** Tracks that form the main "Hot Spring Cup" progression (excludes bonus). */
export const MAIN_TRACKS = TRACK_DEFS.filter((d) => !d.bonus);
export const MAIN_TRACK_COUNT = MAIN_TRACKS.length;

export function getTrackDef(index) {
  return TRACK_DEFS[((index % TRACK_DEFS.length) + TRACK_DEFS.length) % TRACK_DEFS.length];
}
