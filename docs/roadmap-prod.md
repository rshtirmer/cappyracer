# Production roadmap (demo → full prod)

> Proposed plan to take CappyRacer from "great vertical slice" to a shippable product. Phased into content → characters/story → hardening. Each `M##` is a focused milestone (own doc + tests). Order is architecture-enabling first. Creative decisions (story, rivals, track count, cutscene style) are confirmed with the user before the relevant phase.

## Where we are (done)
M01 kart · M02 track + laps · M03 beautify · M04 PS2 retro + PSX assets · M05 AI rivals · M06 countdown · M07 items · M08 drift + boost pads. 31 tests green. Committed on branch `cappyracer`.

## Phase 1 — Tracks & menu (content backbone)
- ✅ **M09 — Data-driven tracks.** DONE: `TrackDef` (control points + theme); `Track`/`Sky`/`LevelBuilder` read from it; 2nd track "Misty Meadow" added; active track via `?track=N`. (In-place switching → M10.)
- ✅ **M10 — Main menu + track select + progressive unlock.** DONE: track-select tiles (locks + best times), `localStorage` save, in-place world rebuild (`buildWorld`/`disposeWorld`/`selectTrack`), podium-finish unlocks next, 3rd track "Twilight Hot Springs".

## Phase 2 — Characters & story
- **M11 — Data-driven racer roster.** Support different character models, not just the capybara. Pull GLB models for non-capybara rivals; assign a roster per race. (Capybara stays the player.)
- **M12 — Story + cutscenes.** Narrative framing — intro, between-track beats, ending. Style per the user's choice (story cards / in-engine cinematics / comic panels).

## Phase 3 — Production hardening (the demo→prod P0s)
- **M13 — Loading screen + spinners.** Async-asset loading UX (progress bar / spinner) so nothing pops in; per-track load.
- **M14 — Audio.** Procedural Web Audio: engine (pitches with speed), drift/boost/shell/pickup SFX, lap ding, finish jingle, music. (`/add-audio`.)
- **M15 — Touch controls.** On-screen steering + accelerate/drift/item for phones (gameplan required mobile).
- **M16 — Ship hardening.** Deploy (host + URL), ESLint/Prettier + CI, asset-load error fallback, analytics/error reporting, **asset-license verification** (PSX pack + dashboard/rival GLBs — required before a public/monetized launch).

## Cross-cutting / later
- Results standings screen, best-lap splits, rubber-band AI, smarter AI, more items, mesh/texture compression (Draco/KTX2), sub.games/Play.fun monetization + leaderboard. (See `backlog.md`.)

## Creative direction (LOCKED 2026-05-29)
1. **Story:** *Hot Spring Cup quest* — the capybara journeys to win the legendary Hot Spring Cup, with story beats between races (goal → setbacks → finale).
2. **Rivals:** cute animals — duck, frog, cat, tortoise, hedgehog (source GLB models).
3. **Tracks:** **3** themed courses for prod v1.
4. **Cutscenes:** **in-engine cinematics** (scripted camera scenes in the 3D world).
