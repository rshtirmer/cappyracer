# Milestone 06: Race flow — start countdown

## Status

implementation complete — countdown test green; awaiting user playtest. (Results standings deferred — see Notes.)

## Objective

Give the race a real start sequence: a 3-2-1-GO! countdown that holds the field on the grid before the green light, so the race doesn't begin abruptly. This is the first slice of "race flow"; a polished results/standings screen is deferred.

## Scope

- `RACE.COUNTDOWN` (3s) + `RACE.GO_HOLD` (0.8s) constants; `gameState.countdown`.
- During the countdown the field is frozen (riders idle, no physics, clock at 0) and the chase camera holds behind the player.
- Big centered `#countdown` overlay showing `3 → 2 → 1 → GO!` (HUD `setCountdown`).
- Racing (and the lap timer) only begins when the countdown reaches 0.
- `Game.toText()` exposes `countdown` + a `racing` flag; test hook: tests set `__GAME_STATE__.countdown = 0` to skip the hold.

## Out of scope (deferred)

- Full results/standings screen (final order of all 6) → backlog / a later race-flow milestone. Finish overlay still shows the player's place + time.
- Lap-time splits, best-lap display, position-change callouts.

## Dependencies

- **Depends on:** Milestone 05 (racers + grid).

## Acceptance criteria

- [x] The field is frozen during the 3s countdown (no movement, clock at 0) and starts on GO — test: `tests/race.spec.js::countdown freezes the field then releases on GO` ✅
- [x] `3 → 2 → 1 → GO!` overlay shows and clears shortly after the start — verified by screenshot/playtest
- [x] Existing tests skip the hold via `__GAME_STATE__.countdown = 0` (no regressions) — full suite green

## Exit condition

User clicks PLAY → sees `3 · 2 · 1 · GO!` with the karts held on the grid → the field launches on GO and the timer starts. No console errors.

## Notes

- Implemented in `Game.update` (countdown branch freezes the field), `HUD.setCountdown`, `index.html` `#countdown`.
- Results standings deferred to keep this milestone focused; tracked in backlog.
