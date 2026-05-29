import { test, expect } from '@playwright/test';

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setPose = (page, pr, o = 0) =>
  page.evaluate(({ pr, o }) => window.__setKartPose(pr, o), { pr, o });

// Solo (player only) racing immediately — for pickup / boost / held-slot tests.
async function startSolo(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && typeof window.__giveItem === 'function'
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => window.__removeAI());
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; });
}

// Full field racing immediately — for shell/mud tests that need a second kart.
async function startRace(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && JSON.parse(window.render_game_to_text()).racers.length === 6
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; });
}

test('state + no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await startSolo(page);
  await advance(page, 300);
  const s = await state(page);
  expect('heldItem' in s).toBe(true);
  expect(s.items).toBeTruthy();
  expect(errors).toEqual([]);
});

test('pickup grants an item', async ({ page }) => {
  await startSolo(page);
  await setPose(page, 0.3, 0); // sit on the item box at progress 0.3
  await advance(page, 150);
  const s = await state(page);
  expect(['shell', 'mud', 'melon']).toContain(s.heldItem);
});

test('one item at a time', async ({ page }) => {
  await startSolo(page);
  // Player sits on the grid (no item box nearby), so the slot is stable.
  await page.evaluate(() => window.__giveItem('melon'));
  expect((await state(page)).heldItem).toBe('melon');
  await page.evaluate(() => window.__giveItem('shell')); // overwrites the single slot
  expect((await state(page)).heldItem).toBe('shell');
  await page.evaluate(() => window.__useItem());
  expect((await state(page)).heldItem).toBeNull(); // using clears the slot
});

test('melon boost increases top speed', async ({ page }) => {
  await startSolo(page);
  await setPose(page, 0.1, 0); // on the road
  await page.evaluate(() => window.__giveItem('melon'));
  await page.evaluate(() => window.__useItem());
  await advance(page, 120);
  expect((await state(page)).speed).toBeGreaterThan(40); // above the normal 36 cap
});

test('shell spins out a target', async ({ page }) => {
  await startRace(page);
  const spin = await page.evaluate(() => {
    const g = window.__GAME__;
    const shooter = g.racers[0];
    const target = g.racers[1];
    // Place both ON the track (origin is off-track infield → would get clamped).
    const s = g.track.pointAt(0.1);
    const h = Math.atan2(-s.tan.x, -s.tan.z);
    const fx = -Math.sin(h);
    const fz = -Math.cos(h);
    shooter.kart.setPose({ x: s.pos.x, z: s.pos.z }, h);
    target.kart.setPose({ x: s.pos.x + fx * 7, z: s.pos.z + fz * 7 }, h); // 7 ahead
    target.ai = null; target.kart.spinTimer = 0; // freeze the target
    shooter.heldItem = 'shell';
    g.items.useItem(shooter, g.racers);
    window.advanceTime(300);
    return target.kart.spinTimer;
  });
  expect(spin).toBeGreaterThan(0);
});

test('mud slick slips a kart', async ({ page }) => {
  await startRace(page);
  const spin = await page.evaluate(() => {
    const g = window.__GAME__;
    const dropper = g.racers[0];
    const victim = g.racers[1];
    const s = g.track.pointAt(0.1);
    const h = Math.atan2(-s.tan.x, -s.tan.z);
    dropper.kart.setPose({ x: s.pos.x, z: s.pos.z }, h);
    dropper.heldItem = 'mud';
    g.items.useItem(dropper, g.racers); // drops mud behind the dropper (on track)
    const hz = g.items.hazards[0];
    victim.kart.setPose({ x: hz.pos.x, z: hz.pos.z }, h);
    victim.ai = null; victim.kart.spinTimer = 0;
    window.advanceTime(80);
    return victim.kart.spinTimer;
  });
  expect(spin).toBeGreaterThan(0);
});
