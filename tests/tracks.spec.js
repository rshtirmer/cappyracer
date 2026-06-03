import { test, expect } from '@playwright/test';

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setPose = (page, pr, o = 0) =>
  page.evaluate(({ pr, o }) => window.__setKartPose(pr, o), { pr, o });

async function start(page, trackIdx) {
  await page.goto(trackIdx != null ? `/?track=${trackIdx}` : '/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && typeof window.__setKartPose === 'function'
  );
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
  await start(page, 1);
  await advance(page, 300);
  const s = await state(page);
  expect(s.track).toBeTruthy();
  expect(errors).toEqual([]);
});

test('loads a track from its def', async ({ page }) => {
  await start(page, 0);
  const s = await state(page);
  expect(s.track).toBe('springs');
  expect(s.trackCount).toBeGreaterThanOrEqual(2);
});

test('track 1 differs from track 0', async ({ page }) => {
  await start(page, 0);
  const s0 = await state(page);
  await start(page, 1);
  const s1 = await state(page);
  expect(s1.track).not.toBe(s0.track);
  // The track-id check above is the real assertion; this is just a sanity margin
  // that the start/grid position differs. Kept modest because the centerline-based
  // grid can place two nearby start lines only a few units apart.
  const moved = Math.hypot(s1.player.x - s0.player.x, s1.player.z - s0.player.z);
  expect(moved).toBeGreaterThan(3);
});

test('can race on track 1', async ({ page }) => {
  await start(page, 1);
  for (let i = 0; i < 3; i++) await fullLap(page);
  const s = await state(page);
  expect(s.finished).toBe(true);
});
