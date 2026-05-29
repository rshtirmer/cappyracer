# Milestone 08: Drift + boost pads

## Status

implementation complete — 5 drift tests green; awaiting user playtest

## Objective

Add the core skill from the gameplan: **drifting**. Holding the drift key while steering at speed locks the kart into a power-slide that charges a mini-turbo; releasing it fires a speed boost (bigger the longer you held a clean drift). Plus **boost pads** on the track (hot-spring style) that give a burst when driven over. This is the skill expression that makes the racing-line matter.

## Scope

- `Kart` drift state + logic in `update`: enter drift (drift key + moving above a min speed + steering), tighter turn in the drift direction (steer modulates in/out), charge over time, release → `applyBoost` scaled by charge tier (none / small / big). Body leans into the slide.
- Generalize `Kart.applyBoost(mult, time)` + `boostMult` so drift, melon, and pads can use different boost strengths (AI `capSpeed` honors `boostMult`).
- Boost pads: glowing pads on the track at fixed progresses; driving over one grants a boost (per-kart cooldown). Added to `ItemSystem` (track gameplay objects).
- `InputSystem.drift` (Shift / Z). AI don't drift (synthetic input has no `drift`) but DO benefit from pads.
- `Game.toText()` exposes `drift` (active + charge) and `boost` (timer) for tests.

## Out of scope

- Drift sparks/particle tiers visualized as colored flames (basic dust only; colored mini-turbo VFX → backlog).
- AI drifting.
- Touch drift control (touch milestone).

## Dependencies

- **Depends on:** Milestone 01 (kart), Milestone 02 (track positions).

## Acceptance criteria

- [x] Holding drift while steering at speed engages a drift (kart slides, charge accrues) — test: `tests/drift.spec.js::drift engages and charges` ✅
- [x] Releasing a sufficiently-charged drift grants a speed boost — test: `tests/drift.spec.js::releasing a charged drift boosts` ✅
- [x] Releasing too early (under the min charge) grants no boost — test: `tests/drift.spec.js::short drift gives no boost` ✅
- [x] Driving over a boost pad grants a boost — test: `tests/drift.spec.js::boost pad boosts` ✅
- [x] No console errors; `render_game_to_text()` reports drift + boost state — test: `tests/drift.spec.js::state + no console errors` ✅
- [x] Drift leans the body into the slide; pads glow/pulse on the track — verified by screenshot/playtest

## Exit condition

User holds the drift key (Shift) through a corner → the kart power-slides and leans → on release gets a satisfying boost; driving over a hot-spring boost pad gives a burst. No console errors.

## Test plan

- `tests/drift.spec.js`: solo player on the track via `__setKartPose`; hold `ArrowUp` to build speed, then `Shift`+steer to drift; assert drift state + charge, then release and assert a boost. Place player on a pad progress to test pad boost. Use the toText `drift`/`boost` fields.
- Manual playtest for feel.
- Regression: full `npm test`.

## Notes

- Drift turn modulation: steer into the drift = tighter, steer out = looser.
- Boost pads at fixed track progresses (Constants) so tests can target them.
