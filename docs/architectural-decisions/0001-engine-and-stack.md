# ADR 0001: Engine, language, and art-style for CappyRacer

## Status

accepted

## Date

2026-05-28

## Context

CappyRacer is a 3D arcade kart racer (1 player + 5 AI capybaras, 3-lap races, drift-for-speed, item power-ups) targeting the web. We need to lock the engine, language, art direction, and core technical approach before scaffolding so that future sessions don't drift or re-litigate foundational choices. The user specified Three.js up front and chose a low-poly look, keyboard+touch controls, procedural audio, and a tight 1-track / 1-character v1 scope.

## Decision

Build CappyRacer as a **browser game on Three.js `^0.172` in JavaScript (ESM), bundled with Vite, tested with Playwright**, using **procedural Web Audio** for all sound. Visuals are **low-poly / flat-shaded** with a bright, chaotic-cute palette. Kart physics is a **lightweight custom arcade model** (no physics-engine dependency) to keep iteration fast and handling deliberately arcade-floaty. v1 ships **one polished track and one playable capybara vs five AI**, single-player only. Architecture follows the event-driven modular pattern from the `game-creator:threejs-game` skill.

> **Language revision (2026-05-28, scaffold):** This ADR initially proposed TypeScript. At scaffold we adopted the `game-creator` `threejs-3d` starter, which is plain JavaScript (ESM) and already implements the mandated event-driven architecture (EventBus / GameState / Constants / Game orchestrator / InputSystem) plus Playwright wiring. Using the canonical starter as-is (rather than converting it to TS) gets us to "is it fun?" faster with zero setup risk. JSDoc covers type hints where they add value. Revisit TypeScript only if the codebase grows large enough that the lack of static types causes real bugs.

## Consequences

### Positive

- Three.js + Vite is a fast, well-documented, zero-license web stack with excellent HMR for iteration; plain ESM JS means no transpile step between edit and reload.
- Low-poly suits Three.js perfectly — great looks, high performance, code-primitive-friendly so we can prototype before sourcing models.
- Procedural Web Audio means zero audio assets and instant SFX tuning.
- Custom arcade physics keeps the "feel" fully under our control and avoids a heavy dependency.
- Tight v1 scope (1 track, 1 capybara) gets us to "is it fun?" fast; everything else expands from a proven core.
- Playwright enables headless gameplay + visual-regression testing of a browser game.

### Negative

- Hand-rolled arcade physics means we own all the edge cases (wall sliding, off-track penalty, item collisions) — no engine to lean on.
- Three.js is lower-level than a full game engine (no GUI scene editor); track layout and tuning are code/data-driven.
- Plain JavaScript gives up compile-time type safety; we lean on JSDoc, Constants centralization, and Playwright tests to compensate.
- Touch + keyboard means maintaining two input paths from early on.

## Alternatives considered

- **Unity / Godot:** richer editors and built-in physics, but heavier, not browser-native by default, slower iteration, and overkill for a low-poly arcade racer; user already chose Three.js.
- **Babylon.js:** capable 3D web engine with built-in physics, but Three.js has a larger ecosystem/community and was the user's explicit pick.
- **react-three-fiber:** ergonomic React bindings for Three.js, but adds a React layer and abstraction we don't need for a tight game loop — rejected for direct Three.js control.
- **Full physics engine (cannon-es / rapier):** rejected for v1 — arcade kart feel is better hand-tuned, and the dependency would slow iteration. Reconsider via a new ADR only if the custom model can't deliver the feel.
- **2D (Phaser):** rejected — the user wants 3D.

## Related

- `docs/gameplan.md` — full game design.
- `docs/tech.md` — detailed stack and conventions.
- Enables the upcoming scaffold phase and Milestone 1 (playable kart on a track).
