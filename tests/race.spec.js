import { test, expect } from '@playwright/test';

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setKey = (page, code, down) =>
  page.evaluate(({ code, down }) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })),
  { code, down });

async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && typeof window.__removeAI === 'function'
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => window.__removeAI()); // isolate the player
}

test('countdown freezes the field then releases on GO', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await startGame(page);
  await setKey(page, 'ArrowUp', true); // try to jump the start

  // 1.5s in: still counting down, field frozen, clock not running.
  await advance(page, 1500);
  const during = await state(page);
  expect(during.racing).toBe(false);
  expect(during.countdown).toBeGreaterThan(0);
  expect(Math.abs(during.speed)).toBeLessThan(0.01);
  expect(during.raceTime).toBe(0);

  // Past the 3s hold: racing, clock running, kart moving.
  await advance(page, 2500);
  const after = await state(page);
  expect(after.racing).toBe(true);
  expect(after.countdown).toBeLessThanOrEqual(0);
  expect(after.raceTime).toBeGreaterThan(0);
  expect(after.speed).toBeGreaterThan(2);

  expect(errors).toEqual([]);
});
