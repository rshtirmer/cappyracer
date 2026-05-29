# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the [session-start sub-pipeline](../sub-pipelines/session-start.md).

## Last updated

2026-05-29 by Claude (Milestone 10 — menu + unlock + 3 tracks)

## Current phase

development

## Current milestone

Milestone 10 — Menu + track-select + progressive unlock (`docs/milestones/10-menu-unlock.md`) — implemented (5 menu tests green). Track-select tiles (locks/best times), `localStorage` (`src/core/Save.js`), in-place world rebuild (`Game.buildWorld/disposeWorld/selectTrack` via `worldGroup`), podium-finish unlocks next, **3 tracks** (Sunset Springs / Misty Meadow / Twilight Hot Springs). Prior: M01–M09. **Roadmap: `docs/roadmap-prod.md`** (Hot Spring Cup quest, cute-animal rivals, 3 tracks, in-engine cinematics). Next: M11 rival character models (GLBs), M12 cinematics/story, M13 loading screen, M14 audio, M15 touch, M16 deploy+CI+license. NOTE: drift feel (`DRIFT.TURN_RATE` 3.6) aggressive — tune in playtest.

## Last action

Implemented Milestone 10 (menu + unlock): `src/core/Save.js` (localStorage: unlocked count + best times), in-place world rebuild in `Game` (`worldGroup` holds per-track level/track/sky/items/scenery; karts/particles persist; `buildWorld`/`disposeWorld`/`selectTrack`/`gridAll`), track-select menu UI (`Menu.js` tiles with locks/best times + `index.html`/CSS), podium-finish unlock logic in `Game.finish`, 3rd track "Twilight Hot Springs". `TRACK_SELECT` event; hooks `__selectTrack`/`__SAVE`. `tests/menu.spec.js` (5 tests). Full suite expected 40.

Earlier: Implemented Milestone 09 (data-driven tracks): `src/level/tracks.js` (`TRACK_DEFS` with control points + per-track theme), refactored `Track(scene, def)`, `Sky(scene, theme)`, `LevelBuilder(scene, theme)` to read defs; added a 2nd course "Misty Meadow" (distinct shape + cooler daytime palette); active track via `?track=N` URL param (`Game.trackIndex`/`trackDef`); exposed track in `toText`. `tests/tracks.spec.js` (4 tests). Committed M06 countdown, M07 items, M08 drift+boost earlier; wrote production roadmap (`docs/roadmap-prod.md`) with locked creative direction. Full suite expected 35 tests.

Earlier: Implemented Milestone 07 (items / power-ups): `src/gameplay/ItemSystem.js` (item boxes on the track that grant a random item + respawn; shell projectiles; mud hazards), `Kart.applyBoost()`/`spinOut()` + boost/spin handling in `Kart.update`, `InputSystem.consumeUse()` (Space/E), AI auto-use, HUD held-item indicator, `gameState.heldItem`. Test hooks `__giveItem`/`__useItem`. `tests/items.spec.js` (6 tests, all green). Note: tests must place karts ON the track (origin is off-track infield → wall-clamped) and the real-time rAF loop re-grants items if sitting on a box.

Earlier: Committed the project to git branch `cappyracer` (commit b196b60; scaffold + M01–M05). Did a demo→prod gap review (captured in backlog: P0 = drift+boost, items, audio, touch, loading, deploy, asset licensing). Hardening: deleted unused `capybara-walk.glb`/`flower.glb` (~8MB) + removed unused `@strudel/web` dep. Implemented Milestone 06 (race-flow): **3-2-1-GO countdown** that freezes the field on the grid (`gameState.countdown`, `HUD.setCountdown`, `#countdown` overlay); racing/timer begin on GO. Added `tests/race.spec.js`; test helpers skip the hold via `__GAME_STATE__.countdown = 0`. (Commit + cleanup not yet re-committed after the countdown work.)

Earlier: Implemented Milestone 05 (AI rivals): refactored `Game` to a `racers` array (player + 5 AI), each with its own `LapTracker`; `src/gameplay/AIController.js` (racing-line lookahead steering + skill speed cap); staggered start grid (`gridPose`); kart-kart collision (`resolveCollisions`); live position ranking (`updatePositions`) + finishing place (`finish`); distinct kart colors per rival; HUD shows `P x/6` (`ordinal` helper); finish overlay shows the place. Added `tests/ai.spec.js` (6 tests, all green). Title screen now shows the full 6-kart grid.

Earlier: Polished the PS2 look further (all under Milestone 04): integrated real **PSX Mega Pack** assets (asphalt road texture + scattered barrel/crate/barricade props from `/Users/rshtirmer/Documents/work/PSX DEMO`), added **bloom** (EffectComposer/UnrealBloomPass at low-res) + a glowing **sun sprite**, a **cinematic title-screen orbit** of the capybara on the start line (display kart via `ensureKart`), and **"CAPPY'S COURSE"** text on the gantry banner. 13/13 tests pass, 0 console errors. (Note: perf test's draw-call check is now moot under the composer; console-error check still valid.)

Earlier: Implemented Milestone 04 (PS2 retro look): half-res pixelation (`Game.updatePixelation`), procedural grass/asphalt textures (`src/level/Textures.js`), vertex wobble (`src/systems/Retro.js`) on props only, and a warm hazy PS2 sunset sky (banded/dithered orange→gold→blue in `Sky.js` + warm haze fog). Fixed user-reported grass flicker (polygonOffset on ground + raised track layers + mipmapped texture minification + excluded flat surfaces from wobble). Researched PS2 sky/vibe (warm horizon + haze + banding). 13/13 tests pass, 53 draw calls, 0 console errors.

Earlier this session: Pulled the real rigged **capybara GLB** from the asset dashboard (`/models/capybara-rigged.glb`, ~7.3MB → `public/models/`) and integrated it as the kart rider: `src/level/AssetLoader.js` (GLTFLoader), `Kart.setRider()` (SkeletonUtils.clone, bone-space auto-scale to `RIDER_HEIGHT`, recenter, idle AnimationMixer, shadows), async preload + attach in `Game`. Constants `KART.RIDER_*` + `MODELS`. Skinned-mesh bbox is ~0 so sizing uses bone extent. Sized + facing look correct (RIDER_HEIGHT 1.4, RIDER_YAW π) — awaiting user confirm. 13/13 tests pass, 0 console errors. Other GLBs (walk, trees, rocks, orange) available for later.

Before this: Implemented Milestone 03 (beautify the scene) via the design-game pass. New files: `src/level/Sky.js` (gradient sky-dome shader + instanced clouds), `src/level/Scenery.js` (instanced trees/rocks + hot-spring pools w/ steam, seeded layout), `src/systems/ParticleSystem.js` (pooled instanced dust+steam). Updated: `LevelBuilder` (hemisphere + shadow-casting sun), `Track` (instanced curbs + start gantry + instanced barriers + road receiveShadow), `Kart` (spinning wheels, capybara bob, shadows), `Game` (shadowMap, dust, ambient steam, speed-based FOV). Added `tests/perf.spec.js`. Draw calls = 52, 0 console errors, **13/13 tests pass**. Before/after screenshots: `/tmp/cappyracer-hud.png` → `/tmp/cappyracer-beauty.png` + `/tmp/cappyracer-start.png`. (Earlier this session: M01 driveable kart, M02 track + lap system, feel pass for camera/speed, inverted-steering fix.)

NOT yet committed to git (workspace is a shared repo on `master`; commit pending user direction).

## Next step

User to playtest the beautified build (http://localhost:3000 → reload → PLAY): confirm the look + driving juice feel good. Gather any visual tweaks. Then, once polish is signed off, resume features with **Milestone 04 — AI rivals** (5 AI capybaras following the racing line, kart-vs-kart collision, finishing position). Also still open: a git commit decision (see Blockers), and `/add-audio` for procedural engine/SFX/music.

## Blockers

none. Asset dashboard URL noted for the later asset phase; `npm test` harness (Playwright config) to be created as part of M1.

## Notes for next session

- Dev server: `npm run dev` (port 3000). Smoke: `node scripts/smoke.mjs`.
- Live-iterate hooks live in `src/main.js`; per-frame logic is `Game.update(delta)` in `src/core/Game.js`.
- Physics is a custom arcade model — no physics engine (ADR-0001).
- Roadmap after M1: M2 track + laps, M3 AI racers, M4 drift + boost pads, M5 items, M6 race-flow/HUD/audio/juice. Real GLB models + mobile-touch polish later.
- Consider running `/qa-game` later to formalize the Playwright harness (visual-regression baselines, game-test fixture).
