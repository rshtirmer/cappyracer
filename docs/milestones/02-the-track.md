# Milestone 02: The track

## Status

implementation complete — all 6 logic tests green; awaiting user playtest of the visual AC (track readability, HUD, finish overlay)

## Objective

Turn the open practice field into a real **closed-loop circuit** the player races around for a fixed number of laps. Build a road surface following a closed curve, make leaving the road cost speed (grip loss) with hard outer/inner walls that keep the kart in, draw a start/finish line, and implement **lap counting** that can't be cheated by reversing over the line (ordered checkpoints). Show the current lap and elapsed time, and end the race after 3 laps with a finish state. This is the structural backbone the AI racers (M03) and the rest of the race loop depend on.

## Scope

- `src/level/Track.js` — closed circuit defined by control points → CatmullRom centerline, sampled into points + tangents. Builds the asphalt road ribbon mesh, edge lines, start/finish stripes, and barrier posts. Exposes:
  - `locate(position)` → `{ progress (0..1), offset (signed lateral distance), index }`
  - `startPose` → `{ position, heading }`
  - `pointAt(progress)` → world position on centerline (used for spawn + test poses).
- Off-track penalty: when `|offset| > roadHalfWidth`, the kart's grip drops (lower max speed) until it's back on the road.
- Walls: when `|offset| > wallHalfWidth`, clamp the kart back to the wall and bleed speed (a "bonk"). Visual barrier posts mark the edges.
- Start/finish line drawn across the road; kart spawns on it facing along the track tangent.
- `src/gameplay/LapTracker.js` (or inline in Game) — ordered checkpoints (gates at evenly spaced progress values). A lap counts only when all gates were passed in order and then the start line is crossed forward. Tracks `lap`, `gatesThisLap`.
- Race ends after `RACE.LAPS` (3) laps → `RACE_FINISHED` event, finish overlay with total time.
- HUD shows `Lap X/3` and a running `mm:ss.cs` timer (replaces the placeholder "Score").
- `GameState` gains `lap`, `raceTime`, `finished`, `gate`. `Events` gains `LAP_COMPLETED`, `RACE_FINISHED`.
- `Game.toText()` extended: `lap`, `gate`, `onTrack`, `progress`, `raceTime`, `finished`.
- Test hook `window.__setKartPose(progress, offset)` to place the kart deterministically for lap/off-track tests.

## Out of scope

- AI opponents and finishing *position* → Milestone 03 (M02 finish is time-only, solo).
- Drift mechanic + hot-spring boost pads → Milestone 04.
- Items → Milestone 05.
- Countdown lights, position HUD, polished finish screen, audio, particles → Milestone 06 (M02 ships a *functional* lap/time HUD + basic finish overlay only).
- Multiple track layouts / track select → backlog.

## Dependencies

- **Depends on:** Milestone 01 (driveable kart), ADR-0001.
- **Blocks:** Milestone 03 (AI need a track + racing line), Milestone 04 (boost pads sit on the track).

## Acceptance criteria

> Checkable AC reference the test that proves them. Feel/visual AC tagged `verified by user playtest`.

- [x] `track.locate()` returns progress increasing 0→1 around the loop and a signed lateral offset (≈0 on the centerline) — test: `tests/track.spec.js::locate maps position to progress + offset` ✅
- [x] Driving off the road (offset beyond road half-width) lowers the kart's effective top speed vs. on-road — test: `tests/track.spec.js::off-track grip penalty` ✅
- [x] The kart cannot pass the wall: lateral offset stays within wall half-width even when steered hard into it — test: `tests/track.spec.js::walls keep the kart on the circuit` ✅
- [x] Completing a full forward lap (all gates in order, then start line) increments the lap; crossing the start line without completing gates does NOT count — test: `tests/track.spec.js::lap counts only on a full forward lap` ✅
- [x] Reaching `RACE.LAPS` laps fires `RACE_FINISHED`, sets `finished`, and records a total time — test: `tests/track.spec.js::race finishes after N laps` ✅
- [x] No console errors on boot or during a lap; `render_game_to_text()` reports `lap`, `progress`, `onTrack`, `raceTime` — test: `tests/track.spec.js::state + no console errors` ✅
- [x] The circuit reads clearly as a race track (asphalt road, edge lines, start/finish stripes, barriers) and the kart spawns on the line facing the right way — verified by screenshot (`/tmp/cappyracer-hud.png`); pending final user playtest
- [x] HUD shows the current lap and a live timer; finish overlay shows the total time — verified by screenshot (HUD `LAP 1/3` + timer); pending final user playtest

## Exit condition

User clicks PLAY → the capybara spawns on the start/finish line of a visible circuit → drives 3 laps around the loop (going off-road clearly slows them, walls keep them in) → the HUD counts `Lap 1/3 → 2/3 → 3/3`, and finishing lap 3 shows a finish overlay with their total time. No console errors.

## Test plan

- **Red first:** `tests/track.spec.js` using `window.__setKartPose(progress, offset)` + `advanceTime` + `render_game_to_text()` to drive the kart deterministically around the loop and assert locate/off-track/walls/laps/finish. Confirm red before implementing.
- **Green:** implement `Track.js`, lap tracking, off-track + wall handling, HUD, finish state.
- **Manual playtest (visual AC):** drive a real lap; confirm the track reads well, spawn orientation is correct, HUD + finish overlay work. Screenshot via `scripts/shot.mjs`.
- **Regression:** full `npm test` (M01 kart tests + M02 track tests) green before marking done.

## Notes

- **Playtest feel pass (2026-05-28):** (1) Chase camera felt wonky on micro left/right corrections — fixed by decoupling the camera from the kart's instantaneous heading: it now orbits a *smoothed* `camYaw` with its own rotation damping (`CAMERA.YAW_LERP`) and the look direction uses that smoothed yaw. Position damped separately (`CAMERA.POS_LERP`). (2) Top speed felt slow — raised `KART.MAX_SPEED` 24→36 and `ACCEL` 16→24, softened steering ramp (`TURN_SPEED_REF` 9→12), lowered `OFFTRACK_GRIP` 0.42→0.3 so grass bites more. (3) Fixed HUD bug: it read `state.totalLaps` from the raw `gameState` (undefined → "LAP NaN/undefined"); now uses `RACE.LAPS`. Grounded in three.js chase-cam + arcade-physics best practices (separate position/rotation damping; speed-dependent turn radius).
- Track math: nearest-centerline-sample search for `locate` (N≈400 samples; fine for one kart — revisit for many karts in M03 via spatial bucketing). Signed offset via cross product of tangent and (pos − sample).
- Lap anti-cheat: ordered gates (e.g. 4 gates at progress 0/.25/.5/.75). Forward gate crossing detected by progress moving past the gate value (with wrap handling). Lap = all non-start gates collected, then start crossed forward.
- Keep walls as a lateral clamp on `offset` (reuses the track math) rather than per-segment mesh collision — cheap and robust for a ribbon track.
