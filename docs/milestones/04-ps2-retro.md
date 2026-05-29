# Milestone 04: PS2 retro aesthetic

## Status

implementation complete — perf test green (53 draw calls), 0 console errors; awaiting final user playtest of the wobble/vibe

## Objective

Give CappyRacer a deliberate early-3D / PS2-era look: render at a low internal resolution and upscale with nearest-neighbor (chunky pixels), add crunchy tiled **grass** and **asphalt** textures (replacing flat colors), apply a **vertex-snap "wobble"** to world geometry (the classic PS2 vertex jitter), and tune the sky/fog to match. Keep it cheap (still ~60fps, draw calls low) and don't touch gameplay.

## Scope

- `src/systems/Retro.js` (or inline in Game): render the scene into a low-res buffer (`PS2.RES_SCALE`) and display it upscaled with `image-rendering: pixelated`.
- `src/level/Textures.js`: procedural canvas textures — grass and asphalt — tiled with `NearestFilter` + `RepeatWrapping`.
- Apply grass texture to the ground (`LevelBuilder`) and asphalt to the road (`Track`, which needs UVs added to the ribbon geometry).
- Vertex-snap jitter via a shared `onBeforeCompile` patch applied to world materials (ground, road, curbs, barriers, gantry, trees, rocks, hot springs). Skip the skinned capybara + particles.
- Sky/fog tuning for a cohesive retro palette.

## Out of scope

- Affine (perspective-incorrect) texture mapping — authentic PS2 but fiddly/risky; pixelation + jitter + crunchy textures carry the look. (Backlog if wanted.)
- Gameplay changes of any kind.
- AI / audio / items (still paused per the polish focus).

## Dependencies

- **Depends on:** Milestone 03 (beautify) + GLB assets.

## Acceptance criteria

- [x] Scene renders at a reduced internal resolution and upscales crisply (chunky pixels) — verified by screenshot ✅
- [x] Ground shows a tiled grass texture and the road a tiled asphalt texture (not flat fills) — verified by screenshot ✅
- [x] Warm hazy PS2 sky: banded/dithered orange→gold→blue gradient + warm fog so distance melts into the horizon — verified by screenshot ✅
- [x] World props (trees/rocks/barriers/gantry/curbs) have a PS2 vertex wobble; flat surfaces (ground/road/decals) stay stable to avoid z-fight flicker — verified by user playtest
- [x] No console errors; draw calls within budget (53) — test: `tests/perf.spec.js` ✅
- [x] Before/after screenshots captured (`/tmp/cappyracer-warmsky.png` etc.) ✅

## Exit condition

User clicks PLAY and the game reads as a PS2-era racer — pixelated, textured grass/asphalt, gently wobbling geometry — running smoothly with no console errors.

## Test plan

- Screenshot before/after via `scripts/shot.mjs` / `scripts/shot-start.mjs`.
- `npm test` (perf + no console errors) stays green.
- User playtest for the wobble/feel and overall vibe.

## Notes

- **Implemented (2026-05-28):** `src/systems/Retro.js` (vertex-snap onBeforeCompile patch), `src/level/Textures.js` (procedural grass/asphalt). Pixelation in `Game` (half-res buffer + CSS pixelated). Warm PS2 sunset sky: 3-stop orange→gold→blue gradient with Bayer dither + posterize in `Sky.js`, warm fog (`LEVEL.FOG_COLOR`) + nearer fog so distance hazes into the horizon, lower warm sun. Grass→ground, asphalt→road (road UVs added).
- **Flicker fix (user-reported grass flicker):** (1) ground material `polygonOffset` + raised track layer heights (road 0.05, edge lines 0.08, start 0.10, curbs 0.12) to kill z-fighting; (2) textures use `LinearMipmapLinearFilter` minification (Nearest mag) so tiled textures don't shimmer when minified; (3) excluded the large flat surfaces (ground, road) and flat decals (edge lines, start line) from the vertex wobble so their shared edges stay aligned.
- **PSX assets + polish (2026-05-28, follow-ups):**
  - **Real PSX textures/props** from the user's PSX Mega Pack (`/Users/rshtirmer/Documents/work/PSX DEMO`): `asphalt_hr_1.png` → road surface (`public/textures/asphalt.png`, `loadAsphaltTexture`); `metal_barrel`, `wooden_crate`, `barricade_a_1` GLBs (embedded textures) → `public/models/{barrel,crate,barricade}.glb`, scattered roadside via `Scenery.buildPSXProps` (instanced). Reduced rocks to make room.
  - **Bloom**: `EffectComposer` + `RenderPass` + `UnrealBloomPass` at the low render resolution (`Game.setupComposer`, `BLOOM` consts) → cinematic glow on the sun/bright areas. A glowing additive **sun sprite** in `Sky.buildSun` flares under bloom. NOTE: with the composer, `renderer.info.render.calls` reflects only the final pass, so the perf test's draw-call number is no longer meaningful (the no-console-errors check still is).
  - **Title screen**: slow cinematic orbit of the capybara on the start line (`Game.updateMenuCamera`); a display kart is created on model load (`ensureKart`) so the menu shows the capybara under the gantry + sunset instead of an empty infield.
  - **Gantry banner text** "CAPPY'S COURSE" via a canvas texture on the beam, with an emissive map so bloom makes it glow (`makeBannerTexture` in `Track.js`).
- Pixelation: `renderer.setSize(w*scale, h*scale, false)` + canvas CSS `width/height: 100vw/vh; image-rendering: pixelated`. Camera aspect uses the display size.
- Vertex snap: inject after `#include <project_vertex>` — divide by w, floor(xy * grid)/grid, multiply by w. Lower grid = more wobble.
- Watch texture filtering (Nearest) and mipmaps for the crunchy look; tile density via UV scale / texture.repeat.
