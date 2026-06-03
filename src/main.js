import { Game } from './core/Game.js';
import { eventBus, Events } from './core/EventBus.js';
import { gameState } from './core/GameState.js';
import { Save } from './core/Save.js';

/** Show the friendly fatal-error overlay (hard init failure, e.g. no WebGL). */
function showFatal(message) {
  const el = document.getElementById('fatal-overlay');
  if (!el) return;
  const detail = el.querySelector('#fatal-detail');
  if (detail && message) detail.textContent = String(message).slice(0, 300);
  el.classList.add('show');
}

// A synchronous failure constructing the game (no WebGL, bad GPU) is genuinely
// fatal — show a friendly message instead of a blank black page.
let booted = false;
let game;
try {
  game = new Game();
  booted = true;
} catch (err) {
  console.error('Game failed to initialize:', err);
  showFatal('Couldn’t start CappyRacer. Your browser may not support WebGL, or hardware acceleration is disabled.');
  throw err;
}

// Surface only pre-boot failures to the user; once running, a stray runtime error
// is logged rather than nuking the screen over the live game.
window.addEventListener('error', (e) => { if (!booted) showFatal(e.message); });
window.addEventListener('unhandledrejection', (e) => {
  if (!booted) showFatal(e.reason && e.reason.message ? e.reason.message : e.reason);
});

// -----------------------------------------------------------------------------
// Test / inspection hooks. DEV-ONLY: Vite strips this whole block from the
// production bundle (import.meta.env.DEV === false in `vite build`), so the
// cheat surface (__GAME__, __giveItem, __SAVE, direct state pokes) never ships.
// Playwright runs against the dev server, where these stay available.
// -----------------------------------------------------------------------------
if (import.meta.env.DEV) {
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

  // Test hook: force the (otherwise webdriver-skipped) 3D menu previews.
  window.__renderThumbnails = () => game.generateThumbnails();
}
