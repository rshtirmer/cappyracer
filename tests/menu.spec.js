import { test, expect } from '@playwright/test';

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setPose = (page, pr, o = 0) =>
  page.evaluate(({ pr, o }) => window.__setKartPose(pr, o), { pr, o });

async function loadMenu(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && !!window.__SAVE && typeof window.__selectTrack === 'function'
  );
}

async function startRaceSolo(page) {
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => window.__removeAI());
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; });
  await page.evaluate(() => window.advanceTime(30));
}

async function fullLap(page) {
  for (const p of [0.25, 0.5, 0.75, 0.0]) {
    await setPose(page, p, 0);
    await advance(page, 30);
  }
}

test('state + no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await loadMenu(page);
  await page.evaluate(() => window.__SAVE.reset());
  await page.evaluate(() => window.__selectTrack(0));
  await startRaceSolo(page);
  await advance(page, 300);
  expect(errors).toEqual([]);
});

test('menu lists tracks with lock state', async ({ page }) => {
  await loadMenu(page);
  await page.evaluate(() => window.__SAVE.reset()); // only track 0 unlocked
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.track-tile').length > 0);
  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('.track-tile')].map((e) => e.classList.contains('locked')));
  expect(tiles.length).toBe(3);
  expect(tiles.filter(Boolean).length).toBe(2); // tracks 1 & 2 locked
});

test('selecting a track switches it live', async ({ page }) => {
  await loadMenu(page);
  await page.evaluate(() => { window.__SAVE.reset(); window.__SAVE.unlockUpTo(2); });
  const before = await state(page);
  await page.evaluate(() => window.__selectTrack(1));
  const after = await state(page);
  expect(before.track).toBe('springs');
  expect(after.track).toBe('meadow'); // switched in place
  expect(after.trackIndex).toBe(1);
});

test('unlock + best time persist', async ({ page }) => {
  await loadMenu(page);
  await page.evaluate(() => {
    window.__SAVE.reset();
    window.__SAVE.recordTime('springs', 42);
    window.__SAVE.unlockUpTo(2);
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__SAVE);
  const r = await page.evaluate(() => ({
    best: window.__SAVE.bestTime('springs'),
    unlocked: window.__SAVE.unlockedCount(),
  }));
  expect(r.best).toBe(42);
  expect(r.unlocked).toBe(2);
});

test('podium finish unlocks next track', async ({ page }) => {
  await loadMenu(page);
  await page.evaluate(() => window.__SAVE.reset()); // unlocked = 1 (track 0 only)
  await startRaceSolo(page); // solo => player finishes 1st (podium)
  for (let i = 0; i < 3; i++) await fullLap(page);
  const r = await page.evaluate(() => ({
    finished: JSON.parse(window.render_game_to_text()).finished,
    unlocked: window.__SAVE.unlockedCount(),
  }));
  expect(r.finished).toBe(true);
  expect(r.unlocked).toBe(2); // track 1 unlocked by the podium finish
});
