# Milestone 12: Story + in-engine cutscenes

## Status

implementation complete — awaiting user playtest

## Objective

Give CappyRacer a narrative spine: the **Hot Spring Cup quest** (locked creative
direction) told through **in-engine cinematics** — scripted camera moves over
the live 3D world with a letterboxed dialogue overlay — woven into the race flow
(opening, pre-race beats, win beats, and a Cup finale).

## Scope

- **Story data** (`src/story/story.js`): the `BEATS` script (goal → setbacks →
  finale) with a cast of cute-animal rivals (Duke the Duck, Miso the Cat, Pip
  the Frog, Shelldon the Tortoise, Bramble the Hedgehog). `PRE_RACE` / `WIN_BEAT`
  map beats to tracks.
- **Cutscene system** (`src/ui/Cutscene.js`): takes over the camera for a
  scripted move ('rise' | 'orbit' | 'flyby') around the player kart, with a
  typewriter dialogue box (speaker + text), click/Enter to advance, Esc/Skip to
  end. Generic over beats; emits `CUTSCENE_START` / `CUTSCENE_END`.
- **Flow integration** (`Game.js`): PLAY now emits `RACE_REQUESTED` → Game plays
  the track's unseen intro beat, then `startGame()`. Winning a track surfaces a
  `winBeat` in `RACE_FINISHED`; the finish screen shows **"▶ Continue Story"**,
  which plays the beat then returns to menu. While a cutscene plays, `update()`
  delegates the camera to it and freezes race/menu logic.
- **Persistence** (`Save.js`): `hasSeenBeat` / `markBeatSeen` (in `beats` map) so
  cinematics play once; `markAllBeatsSeen()` test/skip helper.
- **UI** (`index.html`): letterbox `#cutscene-overlay`, dialogue box, Skip
  button, finish-screen Continue button + styling.
- **Cutscene-free test path preserved**: the `GAME_START` bus event still starts
  a race with no cinematic (every gameplay spec uses it); only `RACE_REQUESTED`
  (the PLAY button) and `CUTSCENE_PLAY` trigger beats.

## Out of scope

- Distinct rival GLB models (still M13 — roster); rivals appear by name in
  dialogue for now, all rendered as capybaras.
- Voice acting / branching dialogue / skippable-per-line typewriter settings.
- Mid-race scripted events.

## Dependencies

- **Depends on:** M11 (track lineup + env + Save). Creative direction LOCKED
  (`roadmap-prod.md`): Hot Spring Cup quest, in-engine cinematics.

## Acceptance criteria

- [x] A cinematic plays with no console errors; camera moves + dialogue types —
      test: `story.spec.js::state + no console errors through a cutscene`
- [x] PLAY plays the track's intro beat once, then starts the race; seen beats
      persist and don't replay — test: `story.spec.js::PLAY plays the intro cinematic, then races; seen beats persist`
- [x] Esc/Skip ends a cutscene and marks it seen — test: `story.spec.js::Escape skips a cutscene and marks it seen`
- [x] Winning a track offers "Continue Story" → plays the win/finale beat — wired
      via `RACE_FINISHED.winBeat` + `CUTSCENE_PLAY` (verified by flow + screenshot)
- [ ] Story reads well + cinematics feel good — **verified by user playtest**

## Exit condition

First PLAY → opening cinematic sets up the Cup quest → race → win → "Continue
Story" plays the win beat → next track unlocks. Beating Cosmic Drift triggers the
**Cup finale**. Beats play once (persisted); Skip/Esc always available.

## Notes

- Add a beat = add to `BEATS` + map it in `PRE_RACE` / `WIN_BEAT`.
- Reset story for a re-watch: `__SAVE.reset()` (or clear `cappyracer.save.v1`).
- Screens: `/tmp/cappy-cutscene-intro.png`.
