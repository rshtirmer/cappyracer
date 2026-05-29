# Tech stack

## Engine / runtime

- **Engine:** Three.js `^0.172` (ESM, loaded as a library on top of Vite)
- **Language(s):** JavaScript (ESM modules). JSDoc comments for type hints where useful — no TypeScript build step. (See ADR-0001 for why JS over TS.)
- **Target platforms:** Web (desktop browsers first; mobile via touch controls)

## Libraries / frameworks

| Library | Version | Purpose |
|---------|---------|---------|
| three | ^0.172 | 3D rendering — scene graph, cameras, meshes, lights, GLTF loading |
| vite | ^7 | Dev server + build tooling (HMR, fast iteration) |
| @playwright/test | ^1.58 | Gameplay logic + visual-regression testing (per `/qa-game`) |
| @axe-core/playwright | ^4.11 | Accessibility checks in Playwright (from starter; optional) |
| @strudel/web | ^1.3 | Available for music (from starter). v1 audio plan is raw Web Audio API; revisit using Strudel vs removing it at the audio milestone. |
| (Web Audio API) | browser-native | Procedural music + SFX — no audio files |

> Scaffolded from the `game-creator` `threejs-3d` starter, which provides the mandated event-driven modular architecture (EventBus / GameState / Constants / Game orchestrator / InputSystem) and Playwright wiring out of the box.

> Physics: starting **library-free** with a lightweight custom arcade kart model (position/velocity/heading + simple track collision). A full physics engine (e.g. cannon-es / rapier) is intentionally deferred — arcade racing rarely needs it and it slows iteration. Revisit only if the custom model can't deliver the feel (would warrant an ADR).

## Tooling

- **Package manager:** npm
- **Build:** Vite (`npm run build` → `dist/`)
- **Testing:** Playwright (browser game logic, visual baselines, performance). Headless smoke test: `node scripts/smoke.mjs`.
- **Linting / formatting:** not configured yet — add ESLint + Prettier (plain JS config) if churn warrants.
- **Asset / binary storage:** GLB/GLTF models under `public/`. Configure Git LFS if model files get large (>~1MB each); decide at asset phase.

## Asset pipeline

- **Prototype:** code-generated Three.js primitives (boxes, cylinders, spheres) for capybara, kart, track, props — get the game *fun* before it's *pretty*.
- **Production models:** low-poly GLB/GLTF, loaded via Three.js `GLTFLoader`.
- **Asset source:** the provided dashboard — `https://web-production-22cd7.up.railway.app/` (a "Capybara Simulator") serves GLB models at `/models/*.glb`. **Integrated:** `models/capybara-rigged.glb` (rigged + idle animation, ~7.3MB) downloaded to `public/models/` and loaded via `GLTFLoader` + `SkeletonUtils.clone` as the kart rider (`Kart.setRider`), replacing the primitive capybara. Other available models for later: `capybara-walk.glb`, `tree1/tree2/trees.glb`, `rocks.glb/rock2.glb`, `Food/Orange.glb`, `flower.glb`, `palm-trees.glb`.
  - **Note on skinned-mesh sizing:** the model's geometry/bone bbox reports ~0 (verts ride the skeleton), so `setRider` auto-normalizes via the bone-space extent scaled to `KART.RIDER_HEIGHT`, then recenters feet-to-seat. Orientation via `KART.RIDER_YAW` / `RIDER_UP_X`.
  - Relevant helper skills: `game-creator:add-3d-assets`, `game-creator:meshyai`.

## Project layout

```
cappyracer/
  docs/                 # gameplan, tech, ADRs, milestones, STATE, backlog
  public/               # static assets (models, served as-is)
  scripts/
    smoke.mjs           # headless boot/console-error smoke test
  src/
    main.js             # entry: creates Game, exposes test + live-iterate hooks
    core/
      Game.js           # orchestrator: renderer/scene/camera, loop, update(delta)
      EventBus.js       # pub/sub singleton + Events map
      GameState.js      # centralized state singleton
      Constants.js      # all tunables (speeds, drift, items, colors, camera)
    systems/
      InputSystem.js    # unified analog input (keyboard + mobile)
    gameplay/           # kart, drift, AI racers, items
    level/              # track / world building
    ui/                 # HUD, menus, touch controls
  tests/                # Playwright specs
  index.html
  package.json
  vite.config.js
```
(Follows the `game-creator:threejs-game` event-driven modular architecture.)

## Conventions

- **Architecture:** event-driven modular — central event bus, decoupled systems, single game-state object. Follow `game-creator:threejs-game`.
- **Code naming:** `camelCase` for variables/functions, `PascalCase` for classes and for class-module filenames (`Game.js`, `EventBus.js`), `SCREAMING_SNAKE_CASE` for constants.
- **Constants:** tunable gameplay values (speeds, drift grip, item effects) centralized in a constants module, not scattered as magic numbers.
- **Text-state hook:** implement `render_game_to_text()` and a time-advance hook for headless verification (live-iterate sub-pipeline).
- **State machines:** race flow (countdown → racing → finished) as an explicit state machine — see `sub-pipelines/state-machine.md`.
- **Asset naming:** see `sub-pipelines/asset-pipeline.md`; finalize at asset phase.

## Out-of-scope dependencies

- **Physics engine (cannon/rapier):** deferred — custom arcade model first.
- **React / UI frameworks:** none — plain DOM/canvas overlay for HUD keeps the bundle lean.
- **Networking / multiplayer libs:** none in v1 — single-player vs AI only.
- **react-three-fiber:** not used — direct Three.js for full control and fewer abstractions to debug.
