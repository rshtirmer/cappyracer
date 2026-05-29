/**
 * Track definitions. Each course is pure data: a closed centerline (XZ control
 * points for a CatmullRom loop) plus a visual theme. Track / Sky / LevelBuilder
 * read from the active def, so adding a course = adding an entry here.
 */
export const TRACK_DEFS = [
  {
    id: 'springs',
    name: 'Sunset Springs',
    controlPoints: [
      [0, -64], [44, -58], [66, -22], [58, 18], [70, 52],
      [34, 72], [-16, 70], [-52, 56], [-72, 22], [-66, -20], [-40, -54],
    ],
    theme: {
      skyTop: 0x5b8fd0, skyMid: 0xffd9a3, skyHorizon: 0xff9e5e,
      fog: 0xffc290, ground: 0xffffff, // grass tint (white = as-authored, warm)
    },
  },
  {
    id: 'meadow',
    name: 'Misty Meadow',
    controlPoints: [
      [0, -58], [40, -56], [70, -28], [78, 14], [56, 50],
      [62, 78], [18, 86], [-30, 74], [-66, 44], [-78, 0], [-56, -40], [-26, -56],
    ],
    theme: {
      skyTop: 0x2f6fd6, skyMid: 0xbfe6ff, skyHorizon: 0xdaf3ff,
      fog: 0xcfeaff, ground: 0xcdee9a, // lighter, fresher green
    },
  },
  {
    id: 'twilight',
    name: 'Twilight Hot Springs',
    controlPoints: [
      [0, -70], [52, -62], [80, -20], [64, 24], [80, 60],
      [30, 84], [-24, 80], [-64, 58], [-84, 16], [-70, -28], [-36, -60],
    ],
    theme: {
      skyTop: 0x241a55, skyMid: 0x9a5ad0, skyHorizon: 0xff8fb0,
      fog: 0xb98fc8, ground: 0x86b777, // dusky pink/purple twilight
    },
  },
];

export function getTrackDef(index) {
  return TRACK_DEFS[((index % TRACK_DEFS.length) + TRACK_DEFS.length) % TRACK_DEFS.length];
}
