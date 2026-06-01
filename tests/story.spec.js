import { test, expect } from '@playwright/test';

const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));

async function load(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && !!window.__CUTSCENE__ && !!window.__SAVE
      && typeof window.__playBeat === 'function' && typeof window.advanceTime === 'function'
  );
  await page.evaluate(() => window.__SAVE.reset()); // all beats unseen
}

const playing = (page) => page.evaluate(() => window.__CUTSCENE__.playing);
const press = (page, code) =>
  page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);

/** Advance through every line until the cutscene ends (Enter reveals + advances). */
async function finishCutscene(page) {
  for (let i = 0; i < 50 && (await playing(page)); i++) {
    await press(page, 'Enter');
    await page.waitForTimeout(20);
  }
}

test('state + no console errors through a cutscene', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page);
  await page.evaluate(() => window.__playBeat('intro'));
  await page.evaluate(() => window.advanceTime(500)); // drive camera + typewriter
  expect(await playing(page)).toBe(true);
  await finishCutscene(page);
  expect(await playing(page)).toBe(false);
  expect(errors).toEqual([]);
});

test('PLAY plays the intro cinematic, then races; seen beats persist', async ({ page }) => {
  await load(page);
  // RACE_REQUESTED is the story-aware PLAY path (the bus GAME_START stays cutscene-free).
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.RACE_REQUESTED, 0));
  expect(await playing(page)).toBe(true);
  expect((await state(page)).started).toBe(false); // race waits for the cinematic
  await finishCutscene(page);
  expect(await page.evaluate(() => window.__SAVE.hasSeenBeat('intro'))).toBe(true);
  expect((await state(page)).started).toBe(true);  // race starts when it ends

  // Back to the menu; the now-seen intro must not replay.
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_RESTART));
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.RACE_REQUESTED, 0));
  expect(await playing(page)).toBe(false);
  expect((await state(page)).started).toBe(true);
});

test('Escape skips a cutscene and marks it seen', async ({ page }) => {
  await load(page);
  await page.evaluate(() => window.__playBeat('finale'));
  expect(await playing(page)).toBe(true);
  await press(page, 'Escape');
  expect(await playing(page)).toBe(false);
  expect(await page.evaluate(() => window.__SAVE.hasSeenBeat('finale'))).toBe(true);
});
