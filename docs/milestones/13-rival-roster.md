# Milestone 13: Data-driven rival roster (cute-animal GLBs)

## Status

implementation complete — transforms approved by user playtest

## Objective

Replace the recolored-capybara rivals with distinct **cute-animal GLB models**
matching the story cast, each scaled + seated sensibly relative to the capybara.

## Scope

- **Rival models** (`public/models/rivals/`): duck, cat, frog, tortoise,
  hedgehog (free GLBs — see Licensing). Mapped to AI slots 1..5 via
  `RIVAL_ROSTER` (`Constants.js`); the player stays the capybara.
- **Generic rider attach** (`Kart._attachRider`): the capybara (`setRider`,
  + head orange) and rivals (`setAnimalRider`) share one path. Per-rider knobs:
  `height` (or `maxDim`), `yaw`, `seatX/seatY/seatZ`, `animate`. Animal riders
  measure their **full surface extent** (spikes/ears/shell), not just the
  skeleton, so a spiky hedgehog normalizes correctly. Capybara keeps its
  established bone-extent sizing (unchanged look).
- **Assignment** (`Game`): loads the 5 rival GLBs (resilient — a failed load
  falls back to a capybara), `attachRiderFor(racer, i)` gives the player the
  capybara and each AI its mapped animal.
- **Rider tuner** (`rider-tuner.html` + `src/_riderTuner.js`): a dev tool to
  dial in each rider's size/position/rotation/animation live and copy the values
  into `RIVAL_ROSTER`. Reuses the real `Kart` so the preview matches the game.
  (Dev-only; not part of the production build.)

## Tuned transforms (user playtest, 2026-06-01)

| Rival | height | yaw | seatY | seatZ | animate |
|-------|--------|-----|-------|-------|---------|
| Duke (duck)       | 1.30 | 1.309 | 0.75 |  0.05 | off |
| Miso (cat)        | 1.40 | π     | 0.75 |  0.05 | off |
| Pip (frog)        | 0.62 | π     | 0.75 | -0.45 | off |
| Shelldon (tortoise)| 0.90 | π    | 0.77 |  0.11 | on  |
| Bramble (hedgehog)| 1.30 | π     | 0.73 |  0.05 | off |

Capybara (hero): `RIDER_HEIGHT 1.4`, `RIDER_SEAT_Y 0.7`, `RIDER_SEAT_Z 0.1`.

## Out of scope

- Distinct kart chassis per rival (still recolored boxes — kart-model asset is a
  later pass). Distinct per-rival AI personality beyond existing lane/skill.
- Voiced/animated story portraits.

## Dependencies

- **Depends on:** M11 (assets/env), M12 (story names the rivals).

## Acceptance criteria

- [x] Each AI rival renders a distinct animal GLB (not a recolored capybara);
      player stays the capybara — verified by grid screenshot.
- [x] Rider sizes read sensibly relative to the capybara + each other — tuned via
      `rider-tuner.html`, approved by playtest.
- [x] No console errors menu → race with all riders loaded — `scripts/smoke.mjs`
      (0 errors) + full suite (no regressions; one real-time lap test is flaky,
      passes 3/3 on retry).
- [ ] Distinct rival karts / further polish — later.

## Licensing (PROD BLOCKER — track in backlog)

- Cat, frog, hedgehog — **Quaternius (CC0)**, no attribution required.
- Tortoise — **Poly by Google (CC-BY)** — needs an attribution credit.
- Duck — **Khronos glTF sample asset** — verify redistribution terms before a
  public/monetized release; swap for a CC0 duck if unclear.

## Notes

- Re-tune any rider: open `rider-tuner.html`, adjust, Copy all, paste values
  into `RIVAL_ROSTER`. Add a rival = add a GLB + a roster entry (+ a load in
  `Game`'s preload).
