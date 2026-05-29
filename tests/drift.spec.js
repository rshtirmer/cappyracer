import { test, expect } from '@playwright/test';

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setPose = (page, pr, o = 0) =>
  page.evaluate(({ pr, o }) => window.__setKartPose(pr, o), { pr, o });
const setKey = (page, code, down) =>
  page.evaluate(({ code, down }) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })),
  { code, down });

async function startSolo(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && typeof window.__removeAI === 'function'
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => window.__removeAI());
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; });
}

test('state + no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await startSolo(page);
  await advance(page, 200);
  const s = await state(page);
  expect(s.drift).toBeTruthy();
  expect(typeof s.boost).toBe('number');
  expect(errors).toEqual([]);
});

test('drift engages and charges', async ({ page }) => {
  await startSolo(page);
  await setPose(page, 0.0, 0);
  await setKey(page, 'ArrowUp', true);
  await advance(page, 700); // build speed above the drift threshold
  await setKey(page, 'ShiftLeft', true);
  await setKey(page, 'ArrowLeft', true);
  await advance(page, 450);
  const s = await state(page);
  await setKey(page, 'ShiftLeft', false);
  await setKey(page, 'ArrowLeft', false);
  await setKey(page, 'ArrowUp', false);
  expect(s.drift.active).toBe(true);
  expect(s.drift.charge).toBeGreaterThan(0.3);
});

test('releasing a charged drift boosts', async ({ page }) => {
  await startSolo(page);
  await setPose(page, 0.0, 0);
  await setKey(page, 'ArrowUp', true);
  await advance(page, 700);
  await setKey(page, 'ShiftLeft', true);
  await setKey(page, 'ArrowLeft', true);
  await advance(page, 750); // charge past the minimum
  await setKey(page, 'ShiftLeft', false); // release the drift
  await advance(page, 60);
  const s = await state(page);
  await setKey(page, 'ArrowLeft', false);
  await setKey(page, 'ArrowUp', false);
  expect(s.boost).toBeGreaterThan(0);
});

test('short drift gives no boost', async ({ page }) => {
  await startSolo(page);
  await setPose(page, 0.0, 0);
  await setKey(page, 'ArrowUp', true);
  await advance(page, 700);
  await setKey(page, 'ShiftLeft', true);
  await setKey(page, 'ArrowLeft', true);
  await advance(page, 220); // under the min charge time
  await setKey(page, 'ShiftLeft', false);
  await advance(page, 60);
  const s = await state(page);
  await setKey(page, 'ArrowLeft', false);
  await setKey(page, 'ArrowUp', false);
  expect(s.boost).toBe(0);
});

test('boost pad boosts', async ({ page }) => {
  await startSolo(page);
  await setPose(page, 0.2, 0); // sit on the boost pad at progress 0.2
  await advance(page, 90);
  const s = await state(page);
  expect(s.boost).toBeGreaterThan(0);
});
