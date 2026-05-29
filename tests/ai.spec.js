import { test, expect } from '@playwright/test';

async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && JSON.parse(window.render_game_to_text()).racers.length === 6
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; }); // skip the 3-2-1 hold
  await page.evaluate(() => window.advanceTime(30));
}

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setPose = (page, p, o = 0) =>
  page.evaluate(({ p, o }) => window.__setKartPose(p, o), { p, o });
const setKey = (page, code, down) =>
  page.evaluate(({ code, down }) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })),
  { code, down });

test('state + no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await startGame(page);
  await advance(page, 2000);
  const s = await state(page);
  expect(s.racers).toHaveLength(6);
  expect(s.totalRacers).toBe(6);
  expect(typeof s.position).toBe('number');
  expect(errors).toEqual([]);
});

test('ai drives forward around the track', async ({ page }) => {
  await startGame(page);
  const before = await state(page);
  await advance(page, 6000);
  const after = await state(page);

  // Every AI racer should have moved a meaningful distance from its grid slot.
  for (let i = 1; i < 6; i++) {
    const a = before.racers[i];
    const b = after.racers[i];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    expect(dist).toBeGreaterThan(20);
  }
});

test('ai completes laps', async ({ page }) => {
  await startGame(page);
  await advance(page, 36000); // a few laps' worth of time
  const s = await state(page);
  const maxAiLap = Math.max(...s.racers.filter((r) => !r.isPlayer).map((r) => r.lap));
  expect(maxAiLap).toBeGreaterThanOrEqual(1);
});

test('position reflects race order', async ({ page }) => {
  await startGame(page);
  // Drive the player too so all 6 racers cross the start line and rank by lap+progress.
  await setKey(page, 'ArrowUp', true);
  await advance(page, 8000);
  await setKey(page, 'ArrowUp', false);
  const s = await state(page);

  // Positions are a valid permutation of 1..6.
  const positions = s.racers.map((r) => r.pos).sort((a, b) => a - b);
  expect(positions).toEqual([1, 2, 3, 4, 5, 6]);

  // Ordering by position is non-increasing in lap+progress (leaders ranked first),
  // tolerating rounding ties in the reported progress.
  const byPos = [...s.racers].sort((a, b) => a.pos - b.pos);
  for (let i = 1; i < byPos.length; i++) {
    const prevKey = byPos[i - 1].lap + byPos[i - 1].progress;
    const curKey = byPos[i].lap + byPos[i].progress;
    expect(prevKey).toBeGreaterThanOrEqual(curKey - 0.02);
  }

  // Player's reported position matches its racer entry.
  const player = s.racers.find((r) => r.isPlayer);
  expect(s.position).toBe(player.pos);
});

test('player gets a finishing place', async ({ page }) => {
  await startGame(page);
  // Teleport the player through ordered gates for 3 full laps to finish.
  for (let lap = 0; lap < 3; lap++) {
    for (const p of [0.25, 0.5, 0.75, 0.0]) {
      await setPose(page, p, 0);
      await advance(page, 30);
    }
  }
  const s = await state(page);
  expect(s.finished).toBe(true);
  const player = s.racers.find((r) => r.isPlayer);
  expect(player.place).toBeGreaterThanOrEqual(1);
  expect(player.place).toBeLessThanOrEqual(6);
});

test('karts separate on collision', async ({ page }) => {
  await startGame(page);
  // Force two karts onto the same spot, then resolve collisions.
  const sep = await page.evaluate(() => {
    const g = window.__GAME__;
    const a = g.racers[0].kart.mesh.position;
    const b = g.racers[1].kart.mesh.position;
    b.set(a.x, a.y, a.z);
    for (let i = 0; i < 8; i++) g.resolveCollisions(); // iterate to settle
    return Math.hypot(b.x - a.x, b.z - a.z);
  });
  expect(sep).toBeGreaterThan(1.5); // pushed apart toward COLLIDE_DIST
});
