# Milestone 09: Data-driven tracks

## Status

implementation complete — 4 track tests green; awaiting user playtest

## Objective

Make tracks **data-driven** so the game can have multiple themed courses (toward the 3-track Hot Spring Cup). A `TrackDef` describes a course: its centerline control points, lap count, and a visual theme (sky gradient, ground color, fog). `Track`, `Sky`, and `LevelBuilder` read from the def instead of hardcoded constants. Add a **2nd track** with a distinct shape + theme. The active track is chosen at load (`?track=N`); the menu's in-place switching comes in M10.

## Scope

- `src/level/tracks.js` — `TRACK_DEFS`: array of `{ id, name, controlPoints, theme: { skyTop, skyMid, skyHorizon, fog, ground } }`. Move the current circuit into def 0; add a distinct def 1.
- `Track(scene, def)` uses `def.controlPoints`.
- `Sky(scene, theme)` uses the theme sky colors; `LevelBuilder(scene, theme)` uses `theme.ground`; fog set from `theme.fog` by `Game`.
- `Game`: pick the active def from a `?track=N` URL param (default 0) + a `trackIndex`; build the world for it. Expose `__trackName`/`trackIndex` for tests.

## Out of scope (next milestone)

- In-place track switching / world rebuild without reload → M10 (menu).
- Track-select menu + progressive unlock → M10.
- Per-track scenery palette / unique props (theme covers sky/ground/fog for now).

## Dependencies

- **Depends on:** M02 (track), M03 (sky/level).
- **Blocks:** M10 (menu + unlock).

## Acceptance criteria

- [x] `TRACK_DEFS` has ≥2 courses; `Track` builds from a def's control points — test: `tests/tracks.spec.js::loads a track from its def` ✅
- [x] Selecting track 1 (`?track=1`) yields a different start pose + theme than track 0 — test: `tests/tracks.spec.js::track 1 differs from track 0` ✅
- [x] A full race works on track 1 (laps + finish) — test: `tests/tracks.spec.js::can race on track 1` ✅
- [x] No console errors on either track — test: `tests/tracks.spec.js::state + no console errors` ✅
- [x] The two courses read as visually distinct (shape + palette) — verified by screenshots — pending final user playtest

## Exit condition

Loading `/?track=1` shows a visibly different course (shape + sky/ground) than `/?track=0`, and it's fully raceable. No console errors.

## Test plan

- `tests/tracks.spec.js`: load `/?track=0` and `/?track=1`; assert the start pose / theme differ and a race completes on track 1 (reuse the lap-gate teleport pattern). Screenshot both.
- Regression: full `npm test`.

## Notes

- Lower-risk approach: select-at-load via URL param (no live rebuild yet). M10 adds in-place switching for the menu.
- Keep `ENV`/`LEVEL` constants as fallback defaults; defs override the theme.
