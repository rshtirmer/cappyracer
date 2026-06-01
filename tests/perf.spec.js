import { test, expect } from '@playwright/test';

// Milestone 03 (beautify): the polished scene must stay cheap to draw and
// error-free. Draw calls are kept low via instancing of repeated scenery.

test('no console errors + draw-call budget', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.__renderStats === 'function' && !!window.__SAVE
  );

  // Skip story cinematics so PLAY drops straight into the driving scene we measure.
  await page.evaluate(() => window.__SAVE.markAllBeatsSeen());

  // Start and drive in real time so the render loop runs and stats populate.
  await page.click('#play-btn');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' })));

  const stats = await page.evaluate(() => window.__renderStats());
  expect(stats.calls).toBeGreaterThan(0);      // actually rendering
  expect(stats.calls).toBeLessThan(200);        // instancing keeps draw calls low
  expect(errors).toEqual([]);
});
