# Milestone 01: Driveable kart with arcade feel

## Status

implementation complete — all 5 logic tests green; awaiting user playtest of the exit condition (drive feel + camera + capybara visual)

## Objective

Replace the placeholder top-down box mover (from the starter) with a real arcade **kart**: the capybara-kart has a heading (yaw), accelerates and brakes/reverses, steers (turn rate scales with speed so you can't pivot in place), and slows via drag when you let off the gas. A third-person chase camera trails behind the kart's heading. A recognizable low-poly capybara-on-a-kart placeholder (built from Three.js primitives) replaces the blue box. This is the foundation every later system (track, AI, drift, items) builds on — get the *driving feel* right first.

## Scope

- `src/gameplay/Kart.js` — arcade kart model: position, forward speed, heading; acceleration, braking, reverse, max forward/reverse speed, drag/rolling friction; steering that rotates heading proportional to current speed and steer input.
- Capybara-on-kart placeholder mesh built from primitives (body, head, ears, snout, the signature orange on head, kart chassis, 4 wheels), grouped so it yaws with heading.
- Chase camera in `Game.js` that trails behind the kart along its heading and looks slightly ahead.
- Input: accelerate = Up/W, brake/reverse = Down/S, steer = Left/Right or A/D (read via `InputSystem` `moveZ`/`moveX`).
- Large ground plane + a few static reference markers (cones) so motion/turning is visible.
- All kart tunables in `Constants.js` (`KART` block).
- `Game.toText()` extended to report `speed` and `heading`.

## Out of scope

- Track surface, walls, checkpoints, lap counting → Milestone 02.
- AI racers → Milestone 03.
- Drift mechanic + boost pads → Milestone 04.
- Item boxes / power-ups → Milestone 05.
- Race countdown, lap/position HUD, finish screen, audio, particles → Milestone 06.
- Real GLB capybara/kart models from the asset dashboard → later asset phase.

## Dependencies

- **Depends on:** ADR-0001 (engine/stack/physics approach), scaffold phase.
- **Blocks:** Milestone 02 (track), and all subsequent milestones.

## Acceptance criteria

> Checkable AC reference the test that proves them. Feel/visual AC are tagged `verified by user playtest`.

- [x] Holding accelerate raises forward speed toward a max; releasing lets drag decay speed back toward 0 — test: `tests/kart.spec.js::accelerate and coast` ✅
- [x] Steering rotates the kart heading while moving, and has ~no effect at a standstill (no pivot-in-place) — test: `tests/kart.spec.js::steering scales with speed` ✅
- [x] Brake/reverse brings the kart to a stop then drives it backward (bounded by a reverse speed cap) — test: `tests/kart.spec.js::brake and reverse` ✅
- [x] The kart translates along its heading — accelerating while steering carves a curved path (net X and Z displacement, heading changed) — test: `tests/kart.spec.js::drives along heading` ✅
- [x] `render_game_to_text()` reports numeric `speed` and `heading`, and there are no console errors on boot or during play — test: `tests/kart.spec.js::state + no console errors` ✅
- [x] Chase camera stays behind the kart as it turns (you see the kart's back, not its side) — verified by screenshot (`/tmp/cappyracer-drive2.png`); pending final user playtest
- [x] The player object reads as a capybara on a kart (rounded body, ears, orange on head, wheels) — verified by screenshot; pending final user playtest

## Exit condition

User clicks **PLAY** → drives the capybara-kart with the arrow keys → the kart accelerates smoothly, turns only while moving, brakes/reverses, and the camera follows behind it. Holding accelerate + a steer direction carves a clean circle. No console errors.

## Test plan

- **Red first:** write `tests/kart.spec.js` (+ minimal `playwright.config.js` with a `webServer` running `npm run dev`). Tests use `window.advanceTime(ms)` to step the sim and `window.render_game_to_text()` to assert speed/heading/position. Confirm they fail against the current box-mover before implementing.
- **Green:** implement `Kart.js`, wire it into `Game.js`, add `KART` constants, build the capybara placeholder; turn all logic tests green.
- **Manual playtest (feel/visual AC):** run `npm run dev`, click PLAY, drive — confirm camera-follow and that the player reads as a capybara-kart. Capture a screenshot via `scripts/smoke.mjs` (or a Playwright screenshot) for the hand-back.
- **Regression:** `npm test` must be green before marking the milestone done.

## Notes

- **Bug fix (2026-05-28):** steering was inverted (left turned the kart screen-right). Fixed by flipping the heading-update sign in `Kart.js`; added regression test `tests/kart.spec.js::steering is not inverted` (now 6 tests total).
- Physics is a hand-rolled arcade model per ADR-0001 — keep it simple: scalar forward speed + heading is enough for v1; full 2D velocity vectors / lateral grip come with the drift milestone (M04).
- Steering convention: in Three.js the kart faces -Z at heading 0 (matches the starter's "forward = -Z"). Heading increases turning the kart; movement is `(sin, cos)` of heading applied to forward speed.
