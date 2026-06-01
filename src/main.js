import { Game } from './core/Game.js';
import { eventBus, Events } from './core/EventBus.js';
import { gameState } from './core/GameState.js';
import { Save } from './core/Save.js';

const game = new Game();

// Expose for Playwright testing
window.__GAME__ = game;
window.__GAME_STATE__ = gameState;
window.__EVENT_BUS__ = eventBus;
window.__EVENTS__ = Events;

// Live-iterate hooks (see AGENTS.md). Drive the sim deterministically and
// read state as text without screenshots.
window.advanceTime = (ms) => {
  const stepMs = 16;
  let remaining = Math.max(0, ms);
  while (remaining > 0) {
    game.update(Math.min(stepMs, remaining) / 1000);
    remaining -= stepMs;
  }
};
window.render_game_to_text = () => JSON.stringify(game.toText(), null, 2);

// Test hook: place the kart deterministically at a loop progress + lateral offset.
window.__setKartPose = (progress, offset = 0) => game.setKartPose(progress, offset);

// Test hook: drop AI racers so the player can be tested in isolation.
window.__removeAI = () => game.removeAI();

// Test hooks: track switching + save/progress.
window.__selectTrack = (i) => game.selectTrack(i);
window.__SAVE = Save;

// Test hooks: story / cutscenes.
window.__CUTSCENE__ = game.cutscene;
window.__playBeat = (id, onDone) => game.playBeat(id, onDone);

// Test hooks: grant / use the player's item.
window.__giveItem = (type) => { if (game.racers[0]) game.racers[0].heldItem = type; };
window.__useItem = () => {
  const p = game.racers[0];
  if (p && p.heldItem) game.items.useItem(p, game.racers);
};

// Test hook: last-frame renderer stats (draw calls / triangles).
window.__renderStats = () => ({
  calls: game.renderer.info.render.calls,
  triangles: game.renderer.info.render.triangles,
});
