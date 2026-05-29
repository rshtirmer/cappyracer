# Milestone 10: Main menu + track select + progressive unlock

## Status

implementation complete — 5 menu tests green; awaiting user playtest

## Objective

A real main menu with a **track-select** screen across the 3 courses, **progressive unlock** (beat a track to unlock the next, saved in `localStorage` with best times), and **in-place track switching** (rebuild the world for the chosen track — no page reload). Adds the **3rd track** so the Hot Spring Cup has its full set.

## Scope

- 3rd `TrackDef` in `tracks.js` (distinct shape + theme).
- `src/core/Save.js` — `localStorage` persistence: highest unlocked index + best time per track (safe try/catch fallback).
- World rebuild: `Game.buildWorld(def)` / `disposeWorld()` / `selectTrack(i)` — per-track objects (level, track, sky, items, scenery) live under a `worldGroup` that's disposed on switch; karts + particles persist. Fog set per theme by Game.
- Track-select menu UI (`Menu.js` + `index.html`): a tile per track (name, locked/best-time), click to select (re-grids the field + rebuilds the world), PLAY starts the selected track. Locked tracks disabled.
- Unlock logic: on `RACE_FINISHED`, a podium finish (top 3) on the newest track unlocks the next; best time saved. Finish overlay notes a new unlock + back-to-menu.

## Out of scope

- Cups grouping / star ratings (single linear unlock for now).
- Story/cutscenes (M12), rival character models (M11).

## Dependencies

- **Depends on:** M09 (data-driven tracks).

## Acceptance criteria

- [x] `TRACK_DEFS` has 3 courses; menu lists all three with locked/unlocked state — test: `tests/menu.spec.js::menu lists tracks with lock state` ✅
- [x] Selecting a track rebuilds the world in place (new track id, no reload) — test: `tests/menu.spec.js::selecting a track switches it live` ✅
- [x] Progress persists: unlocking + best time survive a reload (`localStorage`) — test: `tests/menu.spec.js::unlock + best time persist` ✅
- [x] A podium finish on the newest track unlocks the next — test: `tests/menu.spec.js::podium finish unlocks next track` ✅
- [x] No console errors through menu → race — test: `tests/menu.spec.js::state + no console errors` ✅
- [x] Menu reads clearly; locked tracks obvious; live switch works — verified by screenshot/playtest

## Exit condition

User opens the menu → sees 3 tracks (some locked) with best times → picks an unlocked one → it loads in place → races → a podium finish unlocks the next track, persisted across reloads.

## Test plan

- `tests/menu.spec.js`: drive the menu via exposed hooks (`__selectTrack`, save state) + `localStorage`; assert lock state, live switch (track id changes, no navigation), persistence across reload, and unlock-on-podium. Reuse lap-gate teleport to finish.
- Regression: full `npm test`.

## Notes

- `worldGroup` rebuild keeps karts/particles/camera/composer persistent; only the course is swapped.
- Unlock rule: top-3 finish on the highest-unlocked track unlocks the next (tunable).
