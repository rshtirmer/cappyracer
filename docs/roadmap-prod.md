# Production roadmap (demo → full prod)

> Proposed plan to take CappyRacer from "great vertical slice" to a shippable product. Phased into content → characters/story → hardening. Each `M##` is a focused milestone (own doc + tests). Order is architecture-enabling first. Creative decisions (story, rivals, track count, cutscene style) are confirmed with the user before the relevant phase.

## Where we are (done)
M01 kart · M02 track + laps · M03 beautify · M04 PS2 retro + PSX assets · M05 AI rivals · M06 countdown · M07 items · M08 drift + boost pads. 31 tests green. Committed on branch `cappyracer`.

## Phase 1 — Tracks & menu (content backbone)
- ✅ **M09 — Data-driven tracks.** DONE: `TrackDef` (control points + theme); `Track`/`Sky`/`LevelBuilder` read from it; 2nd track "Misty Meadow" added; active track via `?track=N`. (In-place switching → M10.)
- ✅ **M10 — Main menu + track select + progressive unlock.** DONE: track-select tiles (locks + best times), `localStorage` save, in-place world rebuild (`buildWorld`/`disposeWorld`/`selectTrack`), podium-finish unlocks next, 3rd track "Twilight Hot Springs".
- ✅ **M11 — Menu polish + track overhaul + bonus highway.** DONE: professional menu (glass panel, gradient hero, map-preview cards w/ difficulty badges + lock veils + bonus ribbon); distinct lineup (Sunset Springs / harder Twilight / outer-space Cosmic Drift) + a 4th **bonus highway** with weave-through traffic (`Traffic.js`); `ENV_PRESETS`-driven space/highway lighting/sky/scenery; per-track laps + road width; bonus-gate scaffolding in `Save` (`allMainComplete`, currently open). NOTE: Misty Meadow dropped (replaced by space track). Creative-direction track count is now 3 main + 1 bonus.

## Phase 2 — Characters & story
- ✅ **M12 — Story + in-engine cutscenes.** DONE (pulled forward per user): Hot Spring Cup quest (`src/story/story.js`) told via scripted-camera cinematics (`src/ui/Cutscene.js`) with a letterboxed typewriter dialogue overlay; opening + per-track pre-race beats + win beats + Cup finale, wired into the race flow (`RACE_REQUESTED`/`CUTSCENE_PLAY`, finish-screen "Continue Story"); seen-beat persistence in `Save`. Rivals named (duck/cat/frog/tortoise/hedgehog) but still rendered as capybaras until M13.
- ✅ **M13 — Data-driven rival roster.** DONE: 5 cute-animal rival GLBs (duck/cat/frog/tortoise/hedgehog, free libraries) replace recolored capybaras; generic `Kart._attachRider` (capybara + animals share one path) with per-rider height/yaw/seat/animate, animal riders measured by full surface extent; resilient load + `attachRiderFor`; `rider-tuner.html` dev tool to dial in transforms. Licensing tracked in backlog (CC0 except tortoise CC-BY + duck verify).

## Phase 3 — Production hardening (the demo→prod P0s)
- **M14 — Loading screen + spinners.** Async-asset loading UX (progress bar / spinner) so nothing pops in; per-track load.
- **M15 — Audio.** Procedural Web Audio: engine (pitches with speed), drift/boost/shell/pickup SFX, lap ding, finish jingle, music. (`/add-audio`.)
- **M16 — Touch controls.** On-screen steering + accelerate/drift/item for phones (gameplan required mobile).
- **M17 — Ship hardening.** Deploy (host + URL), ESLint/Prettier + CI, asset-load error fallback, analytics/error reporting, **asset-license verification** (PSX pack + dashboard/rival GLBs — required before a public/monetized launch).

## Cross-cutting / later
- Results standings screen, best-lap splits, rubber-band AI, smarter AI, more items, mesh/texture compression (Draco/KTX2), sub.games/Play.fun monetization + leaderboard. (See `backlog.md`.)

## Creative direction (LOCKED 2026-05-29)
1. **Story:** *Hot Spring Cup quest* — the capybara journeys to win the legendary Hot Spring Cup, with story beats between races (goal → setbacks → finale).
2. **Rivals:** cute animals — duck, frog, cat, tortoise, hedgehog (source GLB models).
3. **Tracks:** **3** themed courses for prod v1.
4. **Cutscenes:** **in-engine cinematics** (scripted camera scenes in the 3D world).
