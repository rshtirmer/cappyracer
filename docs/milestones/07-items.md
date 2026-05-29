# Milestone 07: Items / power-ups

## Status

implementation complete — 6 item tests green; awaiting user playtest

## Objective

Make it a true kart racer: item boxes on the track grant a random power-up, and racers use them to attack and boost. Three items (one held at a time, per the gameplan): an **orange/yuzu shell** (forward projectile that spins out whoever it hits), a **mud slick** (dropped hazard that slips a kart that drives over it), and a **melon boost** (instant personal speed burst). The player fires with a key; AI use theirs automatically. The HUD shows the held item.

## Scope

- `src/gameplay/ItemSystem.js` — owns: item boxes (spinning, placed at fixed track progresses, respawn after pickup), shell projectiles, mud hazards. Per frame: animate boxes, grant items on pickup, advance projectiles/hazards, apply hits.
- Items: `shell` (projectile → spin-out on hit), `mud` (dropped hazard → short slip/spin), `melon` (instant boost).
- `Kart`: `applyBoost()` (temp higher top speed + instant speed bump), `spinOut(time)` (lose control: spin in place, kill speed). `update()` honors a `boostTimer` (raised max speed) and `spinTimer` (no control, spinning).
- Each racer gets `heldItem`. Player uses via a key (Space / E); AI auto-use after a short delay.
- HUD shows the held-item icon; `Events` gains item events.
- `Game.toText()` exposes `heldItem` + item-entity counts; test hooks `__giveItem(type)` / `__useItem()`.

## Out of scope

- Position-weighted/rubber-band item drops (backlog).
- Multiple held items / item stacking.
- Fancy item models — primitives/simple meshes (real GLB later).

## Dependencies

- **Depends on:** Milestone 05 (racers), Milestone 02 (track progress/positions).

## Acceptance criteria

- [x] Driving through an active item box (with no item held) grants a random item and despawns the box — test: `tests/items.spec.js::pickup grants an item` ✅
- [x] Melon boost raises the kart's speed above its normal top speed briefly — test: `tests/items.spec.js::melon boost increases top speed` ✅
- [x] Firing a shell spins out a racer it reaches (target loses control) — test: `tests/items.spec.js::shell spins out a target` ✅
- [x] A kart that hits a mud slick slips/spins briefly — test: `tests/items.spec.js::mud slick slips a kart` ✅
- [x] Only one item held at a time; using it clears the held slot — test: `tests/items.spec.js::one item at a time` ✅
- [x] No console errors; `render_game_to_text()` reports `heldItem` — test: `tests/items.spec.js::state + no console errors` ✅
- [x] HUD shows the held item (icon + [Space]); items read in play — verified by screenshot/playtest

## Exit condition

User races, drives through an item box, sees the item in the HUD, presses the use key → fires a shell (spins a rival) / drops mud / gets a melon boost. AI also use items. No console errors.

## Test plan

- `tests/items.spec.js` with hooks: `__setKartPose` onto a known item-box progress to test pickup; `__giveItem`/`__useItem` to test effects deterministically (boost speed, shell→target spinout, mud→spinout). Assert `heldItem` transitions and effect state via `render_game_to_text()`.
- Manual playtest for feel + HUD.
- Regression: full `npm test`.

## Notes

- Item boxes at fixed progresses in `Constants` so tests can target them.
- Effects kept simple: spin-out = lose control + spin + speed kill for a short time; boost = temp `BOOST_MULT` on max speed; mud = short spin-out.
