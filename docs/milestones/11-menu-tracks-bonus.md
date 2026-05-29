# Milestone 11: Menu polish + track overhaul + bonus highway

## Status

implementation complete — awaiting user playtest

## Objective

Make the main menu look beautiful and professional with a **map preview per
track**, and overhaul the course lineup so the three tracks feel distinct:
keep track 1, turn track 2 into a **harder** circuit that keeps the loved
twilight hot-spring scenery, make track 3 an **outer-space** course, and add a
**4th bonus "no-hesi" highway** track (open now, gated later).

## Scope

- **Menu redesign** (`index.html` + `Menu.js` + new `ui/trackPreview.js`):
  glass panel, gradient hero title (Baloo 2 / Quicksand), control pills, a
  responsive grid of track cards. Each card renders a **top-down map preview**
  (canvas) drawn from the real CatmullRom centerline + themed backdrop, with a
  **difficulty badge**, best-time / lock state, a **lock veil** on locked
  tracks, and a **BONUS ribbon** on the highway. PLAY button names the pick.
- **Track lineup** (`level/tracks.js`):
  1. *Sunset Springs* — Easy (unchanged).
  2. *Twilight Hot Springs* — Hard. Keeps the twilight theme + hot-spring
     scenery (the old track 3 look) but a far more technical radial path.
  3. *Cosmic Drift* — Expert. New outer-space env: starfield sky, planet, dark
     void floor, neon-cyan glowing track edges, floating asteroids + crystals.
  4. *Highway No-Hesi* — Bonus. Wide multi-lane daytime highway with **traffic
     to weave through** (`gameplay/Traffic.js`); rear-ending a car spins you out.
- **Env presets** (`Constants.ENV_PRESETS`) drive lighting/sky/scenery/ground
  per `def.env` ('springs' | 'space' | 'highway'). `Sky`, `LevelBuilder`,
  `Scenery`, `Track` all branch on it. Per-track `laps` + road/wall width.
- **Unlock / gating** (`core/Save.js`): main tracks unlock linearly (capped at
  the main-track count); the bonus track is unlocked when `gated:false` (now)
  OR — once `gated:true` — when every main track has been completed
  (`Save.allMainComplete()`).

## Out of scope

- Flipping the bonus gate ON (left `gated:false` per the user — "unlock it at
  first, gate it later"). One-line change when ready.
- Traffic colliding with AI rivals (player-only for now — AI follows the racing
  line and would pile up). Tuning traffic density/speed by playtest.
- Cup grouping / star ratings / story beats (later milestones).

## Dependencies

- **Depends on:** M09 (data-driven tracks), M10 (menu + unlock + world rebuild).

## Acceptance criteria

- [x] Menu shows all four tracks as cards with a rendered map preview, difficulty
      badge, and best/lock state — test: `menu.spec.js::menu lists tracks with lock state` (4 tiles)
- [x] Track 2 (twilight) differs from track 1 and loads in place — test: `tracks.spec.js::track 1 differs from track 0`, `menu.spec.js::selecting a track switches it live` (→ 'twilight')
- [x] Bonus highway is unlocked from the start while main track 2 stays gated —
      test: `menu.spec.js::bonus track is unlocked from the start`
- [x] No console errors menu → race on every env (springs/space/highway) —
      tests + `scripts/smoke.mjs` on `?track=0/2/3` (0 errors)
- [x] Space track renders starfield + neon edges; highway renders wide road +
      circulating traffic (14 cars) — verified by screenshot/playtest
- [ ] Menu reads clearly + tracks feel distinct + highway "no-hesi" is fun —
      **verified by user playtest**

## Exit condition

Open the menu → see a polished panel with four track cards + map previews →
pick Sunset Springs (Easy), the harder Twilight, the space Cosmic Drift, or the
bonus Highway → it loads in place → race. Beating a main track unlocks the next;
the bonus highway is available immediately.

## Notes

- Flip the gate later: set `gated: true` on the `highway` def in `tracks.js`.
- Previews use the same `CatmullRomCurve3(closed, 'catmullrom', 0.5)` as the
  real track, so the thumbnail silhouette matches what you drive.
- Traffic circulates even on the menu (ambience) but only clips the player once
  the countdown is over.
