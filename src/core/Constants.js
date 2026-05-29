export const GAME = {
  FOV: 65,
  NEAR: 0.1,
  FAR: 1000,
  MAX_DELTA: 0.05,
};

// --- Arcade kart tuning (all in world-units / seconds) -----------------------
export const KART = {
  ACCEL: 24,          // forward acceleration while throttling
  REVERSE_ACCEL: 13,  // acceleration while reversing from a stop
  BRAKE_DECEL: 40,    // deceleration when braking against forward motion
  DRAG: 8,            // passive deceleration toward 0 when off the throttle
  MAX_SPEED: 36,      // forward speed cap (was 24 — felt slow)
  MAX_REVERSE: 12,    // reverse speed cap (stored as negative)
  TURN_RATE: 2.5,     // max yaw (rad/s) at full steer
  TURN_SPEED_REF: 12, // speed at which steering reaches full effect (softer ramp)
  START_X: 0,
  START_Y: 0,         // group sits on the ground; wheels give it height
  START_Z: 0,
  START_HEADING: 0,   // faces -Z
  // Real GLB capybara rider (auto-normalized to RIDER_HEIGHT on load)
  RIDER_HEIGHT: 1.4,  // target world height of the model
  RIDER_SEAT_Y: 0.7,  // seat height in the kart
  RIDER_SEAT_Z: 0.1,  // forward/back seat offset
  RIDER_YAW: Math.PI, // yaw so the model faces -Z / forward (tuned visually)
  RIDER_UP_X: 0,      // up-axis correction (set to -PI/2 if model is Z-up)
  // Orange balanced on the capybara's head (the signature look)
  ORANGE_HEAD_H: 0.5,
  ORANGE_HEAD_LIFT: 0.62, // lift above the head bone so it rests on top
  ORANGE_HEAD_Z: -0.05,
};

export const MODELS = {
  CAPYBARA: 'models/capybara-rigged.glb',
  TREE1: 'models/tree1.glb',
  TREE2: 'models/tree2.glb',
  ROCK: 'models/rock2.glb',
  ORANGE: 'models/orange.glb',
  // PSX Mega Pack props
  BARREL: 'models/barrel.glb',
  CRATE: 'models/crate.glb',
  BARRICADE: 'models/barricade.glb',
};

export const COLORS = {
  SKY: 0xffb877, // warm clear color behind the sky dome (matches horizon)
  AMBIENT_LIGHT: 0xffffff,
  AMBIENT_INTENSITY: 0.75,
  DIR_LIGHT: 0xfff4d6,
  DIR_INTENSITY: 1.0,
  // Capybara + kart palette
  CAPY_BODY: 0x9c6b3f,
  CAPY_BODY_DARK: 0x7d5430,
  CAPY_SNOUT: 0x6b4626,
  CAPY_EYE: 0x231a12,
  ORANGE: 0xff8c1a,
  LEAF: 0x4caf50,
  KART_BODY: 0xff5252,
  KART_TRIM: 0xffd54a,
  WHEEL: 0x2b2b2b,
  // Track
  ASPHALT: 0x4a4f57,
  EDGE_LINE: 0xf2f2f2,
  START_DARK: 0x2b2b2b,
  START_LIGHT: 0xf2f2f2,
  BARRIER_A: 0xe23b3b,
  BARRIER_B: 0xf2f2f2,
  CURB_A: 0xd23636,
  CURB_B: 0xf4f4f4,
  GANTRY: 0x39404c,
  BANNER: 0xff8c1a,
  // Scenery
  TREE_LEAF: 0x3f9e4d,
  TREE_LEAF2: 0x57b765,
  TREE_LEAF3: 0x2f8f56,
  TRUNK: 0x6b4a2b,
  ROCK: 0x9aa0a6,
  ROCK_DARK: 0x7f868c,
  WATER: 0x4fc6d8,
  WATER_RING: 0x8a7a5c,
  // FX
  STEAM: 0xffffff,
  DUST: 0xc9b07e,
  // Items
  ITEM_BOX: 0xffe14d,
  ITEM_BOX_EDGE: 0xff8c1a,
  SHELL: 0xff8c1a,
  MUD: 0x6b4a2b,
  MELON: 0x4caf50,
  BOOST_PAD: 0x49d6ff,
};

export const LEVEL = {
  GROUND_SIZE: 400,
  GROUND_COLOR: 0x6fae3e,
  FOG_COLOR: 0xffc290, // warm haze so distance melts into the orange horizon (PS2)
  FOG_NEAR: 80,
  FOG_FAR: 260,
};

// --- Circuit ----------------------------------------------------------------
// Closed-loop control points in the XZ plane (centerline). CatmullRom smooths
// them into the road. Point [0] is the start/finish line.
export const TRACK = {
  CONTROL_POINTS: [
    [0, -64], [44, -58], [66, -22], [58, 18], [70, 52],
    [34, 72], [-16, 70], [-52, 56], [-72, 22], [-66, -20], [-40, -54],
  ],
  SAMPLES: 420,        // centerline samples for ribbon + locate
  ROAD_HALF_WIDTH: 8,  // drivable asphalt half-width
  WALL_HALF_WIDTH: 10, // hard limit; kart is clamped here
  OFFTRACK_GRIP: 0.3,  // fraction of max speed available off-road (grass is punishing)
  WALL_SPEED_KEEP: 0.4,// speed retained on a wall bonk
  GATES: 4,            // ordered checkpoints incl. start (at progress 0/.25/.5/.75)
};

export const RACE = {
  LAPS: 3,
  RACERS: 6,      // player + 5 AI
  COUNTDOWN: 3,   // seconds of 3-2-1 hold before GO
  GO_HOLD: 0.8,   // seconds the "GO!" flash stays up after the start
};

// --- Drift + boost pads ------------------------------------------------------
export const DRIFT = {
  MIN_SPEED: 9,          // must be going at least this fast to drift
  TURN_RATE: 3.6,        // yaw rate while drifting (tighter than normal)
  CHARGE_MIN: 0.55,      // min drift time to earn a small boost
  CHARGE_BIG: 1.4,       // drift time for the big boost
  BOOST_SMALL: 1.25,     // top-speed multiplier (tier 1)
  BOOST_BIG: 1.5,        // top-speed multiplier (tier 2)
  TIME_SMALL: 0.7,
  TIME_BIG: 1.2,
  LEAN: 0.4,             // extra body lean while sliding
  GRIP_KEEP: 0.985,      // mild speed bleed while drifting (per-frame ^delta)
};

export const BOOST_PAD = {
  PROGRESSES: [0.2, 0.55, 0.82], // where pads sit on the loop
  RADIUS: 4.5,
  BOOST_MULT: 1.4,
  BOOST_TIME: 1.1,
  COOLDOWN: 2,
};

// --- Items / power-ups -------------------------------------------------------
export const ITEMS = {
  BOX_PROGRESSES: [0.12, 0.3, 0.48, 0.66, 0.84], // where item boxes sit on the loop
  BOX_RESPAWN: 4,        // seconds to respawn after pickup
  BOX_PICKUP_DIST: 2.8,
  BOX_Y: 1.2,
  TYPES: ['shell', 'mud', 'melon'],
  SHELL_SPEED: 52,
  SHELL_LIFE: 3,
  SHELL_HIT_DIST: 2.2,
  MUD_LIFE: 9,
  MUD_HIT_DIST: 2.1,
  SPIN_TIME: 1.4,        // shell spin-out duration
  MUD_SPIN_TIME: 0.7,    // mud slip duration
  SPIN_RATE: 13,         // rad/s while spinning out
  BOOST_MULT: 1.5,       // melon boost top-speed multiplier
  BOOST_TIME: 1.6,
  AI_USE_MIN: 0.6,       // AI holds an item this long before using it
  AI_USE_MAX: 2.6,
};

// --- AI rivals ---------------------------------------------------------------
export const AI = {
  COUNT: 5,
  LOOKAHEAD: 16,        // centerline samples ahead to steer toward
  STEER_GAIN: 1.7,
  LANES: [-4.5, 4.5, -2, 2, 0],          // preferred lateral lane per AI
  SKILL: [0.98, 0.95, 0.93, 0.99, 0.91], // top-speed fraction per AI
  COLLIDE_DIST: 2.4,                      // kart-kart separation distance
  GRID_ROW_GAP: 4.5,                      // distance between grid rows
  GRID_LANE: 3.2,                         // lateral offset of grid columns
  GRID_START_BACK: 4,                     // first row distance behind the line
  RIVAL_COLORS: [0x4aa3ff, 0x57c95a, 0xffd54a, 0xb267e6, 0x36d6c3],
};

// --- Environment & atmosphere -----------------------------------------------
export const ENV = {
  // Warm hazy PS2 sunset sky: orange horizon -> gold band -> soft blue zenith.
  SKY_TOP: 0x5b8fd0,      // soft blue zenith
  SKY_MID: 0xffd9a3,      // pale gold mid band
  SKY_HORIZON: 0xff9e5e,  // warm orange horizon
  SUN_COLOR: 0xffe3b8,    // warm low sun
  SUN_INTENSITY: 1.9,
  SUN_POSITION: [60, 70, 60], // lower sun = sunset feel + longer shadows
  HEMI_SKY: 0xffe0c0,     // warm sky bounce
  HEMI_GROUND: 0x6fae3e,
  HEMI_INTENSITY: 0.8,
  SUN_SPRITE_SIZE: 95,   // glowing sun disc in the sky (bloom makes it flare)
  SHADOW_MAP: 2048,
  SHADOW_AREA: 150,      // orthographic half-size for the shadow camera
  CLOUD_COUNT: 16,
  TREE_COUNT: 46,       // total GLB trees (split across tree1/tree2)
  TREE_MIN_H: 5,
  TREE_MAX_H: 9.5,
  ROCK_COUNT: 16,
  ROCK_MIN_H: 0.9,
  ROCK_MAX_H: 2.6,
  HOTSPRING_COUNT: 5,
};

// --- Per-environment presets (lighting + scenery counts) ---------------------
// LevelBuilder / Sky / Scenery branch on def.env. 'springs' uses the warm ENV
// defaults above; 'space' and 'highway' override lighting + dressing.
export const ENV_PRESETS = {
  space: {
    hemiSky: 0x2a3a7a, hemiGround: 0x0a0820, hemiIntensity: 0.55,
    sunColor: 0xbfd4ff, sunIntensity: 1.15, sunPos: [80, 120, -40],
    asteroidCount: 26, crystalCount: 14,
    starCount: 900, starRadius: 540,
  },
  highway: {
    hemiSky: 0xdcecff, hemiGround: 0x6f7a44, hemiIntensity: 0.9,
    sunColor: 0xfff6e0, sunIntensity: 1.35, sunPos: [70, 110, 80],
    signCount: 10, roadsidePropCount: 28,
  },
};

// --- Highway traffic ("no-hesi" weaving) -------------------------------------
export const TRAFFIC = {
  COUNT: 14,            // traffic vehicles circulating the highway
  LANES: [-6.5, -2.2, 2.2, 6.5], // lateral lanes (within the wide highway)
  MIN_SPEED: 11,        // world-units/sec the slowest traffic crawls
  MAX_SPEED: 19,        // fastest traffic (still slower than the player's top)
  HIT_DIST: 3.2,        // collision radius vs the player
  HIT_COOLDOWN: 1.2,    // seconds before the same car can clip you again
  SPIN_TIME: 0.9,       // spin-out duration when you rear-end traffic
  SPEED_KEEP: 0.45,     // fraction of speed kept after a clip
  COLORS: [0xe8e8ee, 0x222831, 0xc0392b, 0x2e6fb0, 0xf1c40f, 0x6c7a89, 0x16a085],
  CAR_W: 1.9, CAR_H: 1.2, CAR_L: 4.2,
};

// --- PS2 retro look ----------------------------------------------------------
export const PS2 = {
  RES_SCALE: 0.5,    // internal render resolution (0.5 = half-res, chunky pixels)
  VERTEX_SNAP: 130,  // NDC grid for vertex wobble (lower = more jitter)
  GRASS_REPEAT: 34,  // grass texture tiles across the ground
  ASPHALT_TILE: 5,   // road samples per asphalt texture tile (lower = denser)
};

// --- Bloom (cinematic PS2 glow) ----------------------------------------------
export const BLOOM = {
  STRENGTH: 0.55,
  RADIUS: 0.6,
  THRESHOLD: 0.72, // only brighter-than-this pixels bloom (sun, sky, white lines)
};

// --- Juice / FX --------------------------------------------------------------
export const FX = {
  PARTICLE_MAX: 260,
  DUST_RATE_ONROAD: 14,   // dust particles/sec while accelerating on road
  DUST_RATE_OFFROAD: 55,  // grass kicks up more
  DUST_LIFE: 0.7,
  DUST_SIZE: 0.6,
  STEAM_RATE: 7,          // steam particles/sec per hot spring
  STEAM_LIFE: 2.2,
  STEAM_SIZE: 1.3,
  FOV_BASE: 65,
  FOV_MAX_ADD: 13,        // extra FOV at top speed (speed sensation)
  FOV_LERP: 3,
};

export const CAMERA = {
  DISTANCE: 12.5,  // how far behind the kart
  HEIGHT: 6,       // camera height above the kart
  LOOK_AHEAD: 7,   // look-at point ahead of the kart
  LOOK_OFFSET_Y: 1.4,
  POS_LERP: 7,     // position damping (higher = snappier)
  YAW_LERP: 3.2,   // rotation damping — LOW so micro steering wobbles are filtered
};
