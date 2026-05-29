# Milestone 03: Beautify the scene (visual polish pass)

## Status

implementation complete — perf test green (52 draw calls), 0 console errors; awaiting final user playtest of the juice/feel AC

## Objective

A holistic visual-polish pass to make CappyRacer genuinely *look* great — while keeping the bright low-poly arcade aesthetic and a smooth frame rate. **No new gameplay systems** (the user explicitly asked to pause feature work). Improve lighting & shadows, the sky, environment scenery (trees, hot springs with steam, rolling hills, props), track detailing (corner curbs, a start gantry, nicer barriers), kart/capybara model polish, and game-feel juice (dust/skid particles, speed-based FOV). This pass is driven by the `design-game` skill.

## Scope

Tackle in impact order; each sub-area is independently shippable and live-iterated:

1. **Lighting & shadows** — hemisphere light (sky/ground bounce) + a warm directional sun casting real shadows (shadow map enabled); cohesive sunny palette.
2. **Sky** — gradient sky dome (shader/large sphere) with simple low-poly clouds, replacing the flat clear color.
3. **Environment** — gently rolling/!textured grass; scattered low-poly trees, rocks, and **hot-spring pools with rising steam particles** (the capybara theme), fences / simple crowd stands near the start.
4. **Track detailing** — red/white corner curbs (rumble strips), a start/finish gantry or banner, upgrade plain posts to tire-stack / striped barriers.
5. **Kart & capybara polish** — refine proportions, add light animation (wheel spin, capybara bob), a soft contact/drop shadow.
6. **Juice** — dust particles when accelerating / off-road, skid marks, subtle speed-based FOV widening, light vignette/bloom (kept cheap), hot-spring glow.

## Out of scope

- AI racers → Milestone 04 (was M03; pushed back by this polish pass).
- Drift mechanic + boost pads → later.
- Items, audio (separate `/add-audio` pass), GLB model import (later asset phase — this pass stays primitives/procedural unless a model is cheap to drop in).

## Dependencies

- **Depends on:** Milestone 01, Milestone 02.
- **Blocks:** nothing strictly (polish), but the user wants it done **before** resuming feature milestones (AI, drift, items).

## Acceptance criteria

> Visual polish — mostly verified by screenshot diff + user playtest. Performance/console are test-backed.

- [x] Scene has a directional sun + ambient/hemisphere lighting and shadows render under the kart and props — verified by screenshot (`/tmp/cappyracer-start.png`) ✅
- [x] Sky is a gradient dome (not a flat fill) with clouds — verified by screenshot ✅
- [x] Surroundings are populated with scenery (trees, rocks, hot springs with steam) instead of empty grass — verified by screenshot ✅
- [x] Track reads as polished: corner curbs + a start gantry/banner + upgraded barriers — verified by screenshot ✅
- [x] Driving produces juice: dust particles + a speed-based FOV change (+ spinning wheels, capybara bob) — dust verified by screenshot; FOV/feel pending final user playtest
- [x] Runs at a smooth frame rate with no console errors; draw calls kept reasonable via instancing — test: `tests/perf.spec.js::no console errors + draw-call budget` (52 calls) ✅
- [x] Before/after screenshots captured for the hand-back (`/tmp/cappyracer-hud.png` → `/tmp/cappyracer-beauty.png` / `-start.png`) ✅

## Exit condition

User clicks PLAY and the circuit clearly looks like a polished, sunny low-poly arcade racer — gradient sky, shadows, scenery (hot springs/trees), curbs, and driving particles — a visible step up from the flat baseline (`/tmp/cappyracer-hud.png`). Runs smoothly with no console errors.

## Test plan

- Run the `design-game` skill audit to enumerate and prioritize improvements.
- Capture before/after screenshots via `scripts/shot.mjs` at the same poses.
- `tests/perf.spec.js`: load, drive a few seconds, assert no console errors and that renderer `info.render.calls` stays under a budget (instancing/merging in place).
- User playtest for juice/feel AC.
- Regression: full `npm test` (M01 + M02 + perf) green before marking done.

## Notes

- **Implemented (2026-05-28):** New files `src/level/Sky.js` (gradient sky-dome shader + instanced drifting clouds), `src/level/Scenery.js` (instanced trees/rocks + hot-spring pools with steam, seeded layout), `src/systems/ParticleSystem.js` (pooled instanced dust+steam, one draw call). Updated `LevelBuilder` (hemisphere + shadow-casting sun), `Track` (instanced curbs, start gantry, instanced barriers, road receiveShadow), `Kart` (spinning wheel pivots, capybara bob, castShadow), `Game` (shadowMap on, dust emission, ambient steam, speed-based FOV). Added `tests/perf.spec.js`. Draw calls = **52** (instancing of curbs/barriers/trees/rocks/clouds/hot-spring-rocks). Build clean, 13/13 tests pass.
- Driven by the `design-game` skill (and possibly `add-3d-assets` if a cheap GLB prop helps).
- Keep the low-poly look — flat shading, bold colors. Avoid heavy post-processing that tanks FPS.
- Performance (`threejs-perf`): instance repeated scenery (trees, barriers, curbs), merge static geometry, cap particle counts, keep shadow map resolution modest.
