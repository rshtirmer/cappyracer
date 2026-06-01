# Backlog

> Out-of-scope ideas, feature requests, and follow-ups captured during sessions but **not** worked on in the session that captured them. Read at the start of every milestone-creation conversation. Append-only — promoted items get a checkbox tick and a link to the milestone that absorbed them, not a deletion.
>
> If an item turns out to be wrong / no longer wanted, mark it `~~struck through~~` with a one-line reason rather than removing it; future sessions need to see that it was considered and rejected.

## How to write a backlog entry

Each entry is a bullet under one of the sections below with this shape:

```
- [ ] <short title> — <one-sentence description of the desired behavior or change>
  - Source: <session date or user message that introduced it>
  - Rough size: <S | M | L> · Rough value: <S | M | L>
  - Notes: <optional — constraints, dependencies, related milestones, references>
```

Keep titles short enough to scan in one pass. Put the detail in the description and notes.

When an entry is **promoted into a milestone**, replace `[ ]` with `[x]` and append `→ milestone NN-<slug>.md` so the trail is preserved.

When an entry is **rejected**, wrap the title in `~~strikethrough~~` and add a one-line `Rejected: <reason>` note.

## Gameplay & features

> **Demo → prod P0 gameplan gaps (2026-05-28 review).** The approved gameplan is a *kart racer with items* where drift/racing-line is the core skill; these are the missing core-loop pieces.

- [x] **P0 Drift + boost pads** — power-slide drift that charges a tiered boost + on-track boost pads. → milestone `08-drift-boost.md` (implemented). Source: 2026-05-28.
- [x] **P0 Items / power-ups** — item boxes + shell/mud/melon, player + AI use, HUD indicator. → milestone `07-items.md` (implemented). Source: 2026-05-28.
- [x] 3-2-1 countdown at race start. → milestone `06-race-flow.md` (implemented). Source: 2026-05-28 user request.
- [ ] Results standings screen — final order of all 6 + lap/best times (finish overlay currently shows player place + time only). Source: 2026-05-28. Size: S · Value: M
- [ ] **Map select + progressive unlock (Mario-Kart-style)** — multiple tracks with a selector; unlock maps progressively (e.g., beat a track/cup to unlock the next), persisted in localStorage. Needs more tracks built first (each track is its own chunk). Source: 2026-05-28 user idea. Size: L · Value: L · See Open Questions for design.
- [ ] Drift charge-and-release mini-boost — upgrade the v1 grip-only drift into a Mario-Kart-style charge that releases a speed burst.
  - Source: 2026-05-28 idea phase
  - Rough size: M · Rough value: M
  - Notes: v1 ships the simpler grip/skill drift model; revisit after the core feel is proven fun.
- [ ] More tracks — additional circuits beyond the v1 track, with a track-select menu.
  - Source: 2026-05-28 idea phase (scope chose 1 track for v1)
  - Rough size: L · Rough value: M
- [ ] More playable capybaras — selectable characters/skins with a character-select screen.
  - Source: 2026-05-28 idea phase (scope chose 1 capybara for v1)
  - Rough size: M · Rough value: M
- [ ] Persistent best-lap / leaderboard — store best lap time and finishes across sessions.
  - Source: 2026-05-28 idea phase (player long-term goal)
  - Rough size: M · Rough value: M
  - Notes: pairs well with a future Play.fun / sub.games monetization pass.
- [ ] Rubber-band / position-weighted item drops — better items for trailing racers for comeback chaos.
  - Source: 2026-05-28 idea phase
  - Rough size: S · Rough value: M
- [ ] Smarter AI — overtaking/blocking, dynamic racing line, rubber-banding so the field stays close. Current AI is lane-following + fixed skill. Source: 2026-05-28 (M05).
  - Rough size: M · Rough value: M

> **Menu + track overhaul (2026-05-29 user request).** → milestone `11-menu-tracks-bonus.md` (implemented). Beautiful menu w/ map previews; track 2 → harder twilight; track 3 → outer space; +bonus highway "no-hesi".

- [ ] **Gate the bonus highway** — flip `gated:true` on the `highway` def so it requires all three main tracks completed first (the wiring + `Save.allMainComplete()` already exist). Left open per the user ("unlock it at first, gate it later"). Source: 2026-05-29. Size: S · Value: S
- [ ] **Highway "no-hesi" tuning** — traffic only collides with the player (AI passes through); consider per-track racer count (or a time-attack/no-rivals mode for the highway), traffic density/speed tuning, and oncoming lanes for a truer no-hesi feel. Source: 2026-05-29. Size: M · Value: M
- [ ] **Per-track AI/traffic awareness** — make AI dodge highway traffic (or spawn fewer AI on the bonus track) so the field isn't trivially passed. Source: 2026-05-29. Size: M · Value: S

> **Story + cutscenes (2026-06-01 user request).** → milestone `12-story-cutscenes.md` (implemented). Hot Spring Cup quest via in-engine cinematics (scripted camera + typewriter dialogue), wired into the race flow; seen-beats persist.

- [ ] **Story polish** — per-line typewriter speed/sfx, portrait art for speakers, skippable-per-beat setting, a "replay cinematics" gallery, mid-race scripted moments. Source: 2026-06-01. Size: M · Value: M
- [ ] **Distinct rival models for story** — the named rivals (Duke/Miso/Pip/Shelldon/Bramble) currently all render as capybaras; give them real GLB models (folds into M13 roster). Source: 2026-06-01. Size: M · Value: M

## Polish & juice

- [x] Camera micro-adjustment smoothing — chase cam felt wonky on small left/right corrections. → folded into M02 feel pass (smoothed `camYaw` rotation damping). Source: 2026-05-28 playtest.
- [x] Higher top speed — kart felt slow. → folded into M02 feel pass (MAX_SPEED 24→36). Source: 2026-05-28 playtest.
- [x] Full beautification pass — sky, shadows, scenery, curbs, particles, hot springs. → milestone `03-beautify-the-scene.md` (implemented). Source: 2026-05-28 user request.
- [x] Real capybara GLB model as the kart rider. → integrated (`models/capybara-rigged.glb`). Source: 2026-05-28 user request.
- [x] Swap primitive scenery for GLB models — instanced GLB trees (tree1/tree2) + rocks (rock2), and the real orange GLB mounted on the capybara's head bone. (Integrated 2026-05-28.) Source: 2026-05-28.
- [x] PS2 retro aesthetic — low-res pixelation, crunchy grass/asphalt textures, vertex wobble, warm orange dithered sky + haze fog. → milestone `04-ps2-retro.md` (implemented). Source: 2026-05-28 user request.

## Tech & refactors

> **Demo → prod hardening (2026-05-28 review).**

- [x] Drop unused assets (`capybara-walk.glb` 7MB, `flower.glb` 1.2MB) + unused `@strudel/web` dep. Done 2026-05-28.
- [ ] **P0 Loading screen** — 22MB of GLBs load async with no progress UI; title shows before models pop in. Add a loader + progress bar. Source: 2026-05-28. Size: S · Value: M
- [ ] **P0 Asset-load error handling** — a failed GLB load just `console.error`s (game silently has no capybara). Add fallback/error UI. Size: S · Value: M
- [ ] Mesh/texture compression (Draco/KTX2) — capybara is 6.9MB; could cut models ~70% for faster load. Size: M · Value: M
- [ ] Procedural Web Audio — engine hum (pitches w/ speed), boost/SFX, lap ding, finish jingle, music. (`/add-audio`). Source: 2026-05-28. Size: M · Value: L
- [ ] Touch controls — `InputSystem.initMobile` is a TODO stub; on-screen joystick/buttons so it's playable on phones (gameplan required mobile). Source: 2026-05-28. Size: M · Value: L
- [ ] 6 skinned capybaras may stress low-end/mobile — consider lighter AI models / shared skeletons. Size: M · Value: S
- [ ] Perf test draw-call check is moot under EffectComposer — `renderer.info.render.calls` reflects only the final pass. Consider disabling `renderer.info.autoReset` and summing per-pass, or asserting triangle count instead. Console-error check still valid. Source: 2026-05-28 (bloom).

## Tooling & QA

- [ ] ESLint + Prettier + CI (run tests on push) — nothing guards regressions currently. Source: 2026-05-28. Size: S · Value: M
- [ ] Deploy pipeline + host (here.now / GitHub Pages / itch.io) — not deployed. Source: 2026-05-28. Size: S · Value: L
- [ ] Visual-regression + mobile Playwright tests. Size: M · Value: M
- [ ] Analytics + error reporting (e.g. Sentry) for prod. Size: S · Value: S

## Open questions

- [ ] Asset dashboard contents — what capybara/kart/prop models exist at the provided URL and in what format? Explore at asset phase.
  - Source: 2026-05-28 user message with dashboard link
- [ ] Deployment host — here.now vs GitHub Pages vs itch.io. Decide at deploy time.
  - Source: 2026-05-28 idea phase
- [ ] **Asset licensing (PROD BLOCKER)** — verify commercial-use license for the PSX Mega Pack textures/props AND the dashboard capybara/orange/tree/rock GLBs before any prod/monetized release. Source: 2026-05-28 demo→prod review.
- [ ] **Map-select design** — Mario-Kart cups (group tracks, unlock next after placing) vs simple progressive unlock (beat track N → unlock N+1) vs all-open selector? How many tracks for v1? Persist unlocks in localStorage? Needs more tracks built first. Source: 2026-05-28 user idea.
- [ ] Monetization — sub.games / Play.fun integration + best-time persistence/leaderboard (gameplan long-term goal). Source: 2026-05-28.
