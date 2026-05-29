# Milestone 05: AI rivals

## Status

implementation complete — 6 AI tests green (drive/laps/position/finish/collision/no-errors); awaiting user playtest of race feel

## Objective

Turn the solo time-trial into an actual race: add 5 AI capybaras that drive the circuit by following the racing line, spread across lanes with per-rival skill so it's competitive. Add light kart-vs-kart collision, a live **position** (P x/6) in the HUD, and a **finishing place** shown when the player completes 3 laps. The player + AI start on a staggered grid. This makes the gameplan's "finish 1st of 6" real.

## Scope

- `src/gameplay/AIController.js` — per-AI controller producing synthetic `{moveX, moveZ}` input by steering toward a look-ahead point on the track (preferred lane offset), easing the throttle in corners.
- Reuse `Kart` for AI (same physics/feel); add a chassis color tint per racer.
- `Game` refactor to a `racers` array (player = racers[0] + 5 AI), each with its own `LapTracker`. Per-racer update: AI input or player input → `Kart.update` → off-track grip + wall clamp + lap tracking. AI speed capped by a per-rival skill factor.
- Staggered start grid (3 rows × 2) behind the start line; everyone faces forward.
- Kart-vs-kart collision: circle-circle separation + slight speed bleed.
- Live position = racers sorted by `lap + progress`; `gameState.position` = player's.
- Finishing: a racer reaching `RACE.LAPS` records a finish place (order of finishing); the player finishing fires `RACE_FINISHED` with their place and ends the race.
- HUD shows `P x/6`; finish overlay shows the placing (1st/2nd/…); AI capybaras get the model + distinct kart colors. Title-screen grid shows all 6 on the line.
- `Game.toText()` exposes `position`, `totalRacers`, and a `racers` summary (lap/progress/finished/place) for tests.

## Out of scope

- Smart overtaking / blocking / rubber-banding AI — simple lane-following + skill variation only (rubber-band is in backlog).
- Drift, items, boost pads — later milestones.
- Polished results screen / standings table — finish overlay shows the player's place + time only (full standings is M06 polish).

## Dependencies

- **Depends on:** Milestone 02 (track + `locate`/lap system), Milestone 01 (kart).
- **Blocks:** items milestone (targets need rivals), race-flow polish.

## Acceptance criteria

- [x] Each AI makes forward progress around the loop over time (progress increases, stays roughly on-track) — test: `tests/ai.spec.js::ai drives forward around the track` ✅
- [x] AI complete laps (lap counter increments after enough time) — test: `tests/ai.spec.js::ai completes laps` ✅
- [x] Live position is computed from lap+progress and reported for the player (1..6) — test: `tests/ai.spec.js::position reflects race order` ✅
- [x] When the player completes `RACE.LAPS`, `RACE_FINISHED` fires with a finishing place in 1..6 and `finished` is set — test: `tests/ai.spec.js::player gets a finishing place` ✅
- [x] Karts don't overlap/stack (collision separates them) — test: `tests/ai.spec.js::karts separate on collision` ✅
- [x] No console errors during a multi-racer race; `render_game_to_text()` reports `position` + `racers` — test: `tests/ai.spec.js::state + no console errors` ✅
- [x] AI read as distinct capybara racers (different kart colors); HUD shows `P x/6`; finish overlay shows the place — verified by screenshot/playtest

## Exit condition

User clicks PLAY → starts on a grid with 5 other capybaras → races 3 laps with the AI driving the circuit (overtakes happen, bumping separates karts) → HUD shows their live position → finishing lap 3 shows their place (e.g., "3rd / 6"). No console errors.

## Test plan

- `tests/ai.spec.js` using `advanceTime` + `render_game_to_text()`: assert AI progress increases, laps increment, position ordering matches lap+progress, collision separation, and player finish place. Use `__setKartPose` (player) where helpful; AI positions read from the `racers` summary.
- Manual playtest: race feels alive, AI stay on track, position/finish UI correct.
- Regression: full `npm test` green.

## Notes

- AI steering: target = sample `LOOKAHEAD` ahead on the rival's lane; `desiredHeading = atan2(-dx,-dz)`; `moveX = clamp(-(desired-heading)*gain)`; throttle eased by heading error.
- Skill: cap `kart.speed` at `MAX_SPEED * skill` per rival (≈0.9–0.99) so the player can win but it's a race.
- 6 skinned capybaras + mixers — acceptable at the low PS2 render resolution; revisit if perf dips.
