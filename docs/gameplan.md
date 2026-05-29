# CappyRacer

## Pitch

A chaotic-cute 3D kart racer where you ARE a capybara — orange balanced on your head, drifting around hot-spring circuits and pelting rivals with yuzu fruit. It's *Mario Kart's* fun wearing *Art of Rally's* clean low-poly clothes, but winning is really about nailing the racing line, not spamming items.

## Core gameplay loop

A single session is one **race** (~2–4 minutes):

1. **Start** — countdown (3-2-1-GO!), player capybara + 5 AI capybaras on the grid.
2. **Race** — for 3 laps around one circuit, the player:
   - **Steers** (left/right) and **accelerates / brakes**.
   - **Drifts** through corners (hold drift while turning) to hold speed through the apex — the primary skill expression. Clean lines and good drifts beat sloppy ones.
   - **Hits boost pads** (hot springs) for short speed bursts.
   - **Grabs item boxes** and uses **power-ups** — orange/yuzu projectiles to hit rivals, mud-slick traps to drop, melon for a personal boost. Items add chaos and comebacks but are secondary to driving well.
   - **Avoids hazards** and stays on track (going off-track / into mud slows you down).
3. **Finish** — crossing the line after lap 3 ends the race. Final placement (1st–6th) is shown.
4. **Restart / replay** — quick reset back to the grid for another go.

The fun-per-minute comes from the *feel* of carrying speed through a corner via a well-timed drift, with item chaos as seasoning.

## Game rules

- 6 racers total: 1 player + 5 AI capybaras.
- 3 laps. First across the line on the final lap wins; everyone else is ranked by order of finish.
- **Drifting:** initiating a drift while turning lets you maintain more speed through a corner than braking-and-turning would. (v1: a skill/grip mechanic; a charge-and-release mini-boost is a possible later refinement — see backlog.)
- **Boost pads (hot springs):** driving over one gives a brief speed burst.
- **Surface penalty:** leaving the track surface (grass/mud) reduces grip and top speed until you're back on track.
- **Item boxes:** driving through one grants a random power-up (one held at a time in v1):
  - *Orange/yuzu shell* — fire forward; a hit briefly spins out the target.
  - *Mud slick* — drop behind you; anyone who drives over it slips/slows.
  - *Melon boost* — instant personal speed boost.
- **AI rivals** follow the racing line at a tuned difficulty and react to the player and items.

## Win / lose conditions

- **Win:** finish 1st of 6.
- **Lose:** finish 2nd–6th. (No "game over" — every race finishes and is scored by placement.)

## Production vision (v2 — locked 2026-05-29)

Beyond the v1 vertical slice, the shipping product (see `roadmap-prod.md`) is the **Hot Spring Cup quest**: the capybara journeys to win the legendary Hot Spring Cup across **3 themed courses**, racing a roster of **cute-animal rivals** (duck, frog, cat, tortoise, hedgehog — real GLB models). Tracks unlock **progressively** from a main menu (saved locally). **In-engine cinematics** carry the story beats between races. Core racing (kart, drift, items, boost pads, AI, countdown, positions) is built (M01–M08); remaining work is content (tracks, menu), characters, story, and production hardening (loading, audio, touch, deploy).

## Art style

- **3D, third-person chase camera** behind the kart/capybara.
- **Low-poly / flat-shaded**: chunky geometry, bold flat colors, no textures. Reference vibe: *Crossy Road*, *Art of Rally*, *Untitled Goose Game* palette energy.
- **Mood:** bright, saturated, goofy, sunny. Hot springs (steam puffs), oranges, lily pads, wooden fences, soft rolling hills.
- **Character:** a rounded low-poly capybara on/in a simple kart, with the signature orange balanced on its head.
- **Asset sourcing:** code-generated primitives during prototyping; real low-poly GLB models pulled from the provided asset dashboard (see `tech.md`) and/or generated, swapped in during the asset phase.

## Audio direction

- **Procedural Web Audio API** — zero asset files for v1.
- Synth engine hum that pitches with speed, boost "whoosh", item pickup/fire SFX, lap-ding and finish jingle, plus a simple upbeat looping background tune. Non-diegetic music + diegetic engine/SFX.

## Player goals

- **Short term (per race):** finish 1st; secondarily, drive a clean fast lap.
- **Long term (across sessions):** beat your own best lap/finish, learn the track's optimal line. (Persistent best-lap / leaderboard is a post-v1 candidate — see backlog.)

## Anti-goals

- **Not** a realistic driving sim — handling is arcade-floaty and forgiving.
- **Not** an item-spam-fest where driving skill doesn't matter — items are seasoning, the racing line is the meal.
- **Not** an open-world or exploration game — it's tight, track-based racing.
- **Not** multiplayer in v1 — single-player vs AI only. No netcode.
- **Not** a huge content game in v1 — one polished track and one capybara before any expansion.

## References

- *Mario Kart* — item/kart-racer loop, drift-for-speed, AI rivals, comeback chaos.
- *Art of Rally* — low-poly racing aesthetic and clean readable tracks.
- *Crossy Road* — flat-shaded chunky charm and bright palette.
- Capybara internet culture — oranges-on-head, hot springs, unbothered chill energy.

## Open questions

- **Drift model for v1:** pure grip/skill mechanic vs. charge-and-release mini-boost. Starting with the simpler grip model; charge-boost tracked in backlog.
- **Item-hold:** one item at a time confirmed for v1; weighted-by-position drops (rubber-banding) is a tuning question for later.
- **Asset dashboard contents:** the provided URL needs to be explored at the asset phase to confirm what capybara/kart/prop models are available and in what format (expecting GLB).
- **Deployment target:** browser is certain; specific host (here.now / GitHub Pages / itch.io) to confirm at deploy time.
