# AGENTS.md

> Lean enforcement file for any AI agent working in this repository. Read this file **first**, every session, before any other action. Cross-tool standard (Cursor, Aider, Codex, Claude, etc.). Claude users: `CLAUDE.md` points here.

This project follows the [`make-game`](https://github.com/OpusGameLabs/game-creator) pipeline. Do not improvise process — follow the rules below.

## Project overview

- **Title:** CappyRacer
- **Pitch:** A chaotic-cute 3D kart racer where you ARE a capybara — drifting around hot-spring circuits and pelting rivals with yuzu fruit. Mario Kart fun in Art-of-Rally low-poly clothes, where the racing line matters more than item spam.
- **Genre / type:** 3D arcade kart racer (single-player vs AI)
- **Engine:** Three.js (`^0.172`) as a library on top of Vite (`^7`)
- **Language:** JavaScript (ESM modules)
- **Target platform:** Browser (desktop-first, mobile via touch controls)

## Hard gate: no code before plan

If `docs/gameplan.md` does not exist in this repo, you are in the **idea phase** — do **not** create source files, run engine scaffolders, or install dependencies. Walk the user through the idea-phase checklist (gameplay loop, art style, controls/scope, engine/stack) and produce `docs/gameplan.md`, `docs/tech.md`, and `docs/architectural-decisions/0001-engine-and-stack.md` first. (These already exist — read them.)

## Mandatory: run the make-game skill

Every session in this directory **must** run the `make-game` skill's session-start sub-pipeline before any other work. The skill enforces phase awareness, doc continuity, milestone discipline, and the live-iterate verification loop.

If the skill is not installed in your environment:

```
npx skills add opusgamelabs/game-creator --skill make-game -p -y
```

If the skill cannot be installed, apply the rules in this file manually and tell the user the skill is missing.

## Source-of-truth files

These docs are the agreed state of the project. Read them at session start; do **not** unilaterally edit them — propose changes and get user confirmation first.

- `docs/STATE.md` — last session handoff. Read first, every session.
- `docs/gameplan.md` — game definition (loop, rules, art, audio, anti-goals).
- `docs/tech.md` — stack, tooling, conventions.
- `docs/backlog.md` — deferred ideas. Read before planning a milestone.
- `docs/milestones/` — feature work breakdown with acceptance criteria.
- `docs/architectural-decisions/` — locked top-level decisions (engine, language, art-style, physics approach).

## Architecture rules (Three.js, event-driven modular)

- **EventBus singleton** (`src/core/EventBus.js`) — all cross-module communication via pub/sub. Modules never import each other for communication. Events use `domain:action` naming and live in the `Events` map.
- **GameState singleton** (`src/core/GameState.js`) — single centralized state object. Systems read; events trigger mutations.
- **Constants** (`src/core/Constants.js`) — every magic number, color, speed, timing, and tunable lives here. Zero hardcoded gameplay values in logic.
- **Game orchestrator** (`src/core/Game.js`) — owns renderer/scene/camera, initializes systems, runs the render loop via `animate()`. Per-frame logic lives in `update(delta)` (called by both `animate()` and `advanceTime`).
- **`window.render_game_to_text()`** — returns a JSON snapshot of current game state for agent inspection without screenshots.
- **`window.advanceTime(ms)`** — steps the simulation deterministically in ~16ms ticks for verification/testing.
- **Physics** — custom lightweight arcade model (no physics-engine dependency). See ADR-0001.
- **Directory layout:** `src/core` (engine glue), `src/systems` (input/physics/audio), `src/gameplay` (kart, AI, items), `src/level` (track/world), `src/ui` (HUD, menus, touch controls).

## Stack-specific commands

- **Dev server:** `npm run dev` (Vite, http://localhost:3000)
- **Tests:** `npm test` (Playwright) · headed: `npm run test:headed` · UI: `npm run test:ui`
- **Build:** `npm run build` (Vite production bundle to `dist/`)
- **Lint / format:** n/a (not configured yet — add ESLint+Prettier if churn warrants)
- **Smoke test:** `node scripts/smoke.mjs` (loads the game headless, checks for console errors + screenshot)

## Live iterate (after every code change)

After any meaningful code change in the development phase:

1. Confirm dev server is live; check console — must be error-free.
2. Call `render_game_to_text()` and verify state matches the change.
3. For time-dependent changes, step with `advanceTime(ms)` and re-read.
4. If visual, take a screenshot (use `scripts/smoke.mjs` or a Playwright spec).
5. Smoke-check adjacent state for regressions.
6. Hand back to the user with a one-line verdict and one focused question.

A change is **not done** until this loop has run.

## Testing discipline

Write failing tests (Playwright) **before** implementation for each checkable acceptance criterion of the active milestone. Visual/feel AC that can't be asserted must be explicitly marked "verified by user playtest" in the milestone. Never loosen a test to make it pass — fix the implementation or revise the milestone AC and rewrite the test.

## Append vs spawn a new milestone

- **Append** an AC to the current milestone if the work is in-scope refinement.
- **Spawn** a new milestone if the work is out of scope but related; use `Depends on:` for ordering.
- **Inline** trivial fixes (typos, one-liners) on the current milestone.

When in doubt, prefer spawning. Do not bloat milestones. Nothing the user mentions gets dropped — out-of-scope ideas go to `docs/backlog.md`.

## Minimum-viable doc mode

If the user pushes back on documentation overhead, downgrade — do **not** skip:

- One-line milestone entry (title + AC) is acceptable.
- `docs/STATE.md` updates remain mandatory.
- `docs/gameplan.md` and `docs/tech.md` must exist.
- Engine / language / stack ADRs cannot be skipped.

## Last regenerated

2026-05-28 by Claude / make-game scaffold.
