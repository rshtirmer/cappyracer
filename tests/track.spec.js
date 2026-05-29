import { test, expect } from '@playwright/test';

async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && typeof window.__setKartPose === 'function'
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => window.__removeAI()); // isolate the player (no AI collisions)
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; }); // skip the 3-2-1 hold
  await page.evaluate(() => window.advanceTime(30)); // init lap tracker at spawn
}

const setPose = (page, p, o = 0) =>
  page.evaluate(({ p, o }) => window.__setKartPose(p, o), { p, o });
const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const setKey = (page, code, down) =>
  page.evaluate(({ code, down }) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })),
  { code, down });

// Drive the kart one full forward lap via ordered gates.
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

  await startGame(page);
  await setPose(page, 0.3, 0);
  await advance(page, 60);
  const s = await state(page);
  expect(typeof s.lap).toBe('number');
  expect(typeof s.progress).toBe('number');
  expect(typeof s.onTrack).toBe('boolean');
  expect(typeof s.raceTime).toBe('number');
  expect(errors).toEqual([]);
});

test('locate maps position to progress + offset', async ({ page }) => {
  await startGame(page);

  await setPose(page, 0.0, 0);
  await advance(page, 30);
  const s0 = await state(page);
  expect(s0.progress).toBeLessThan(0.05);
  expect(s0.onTrack).toBe(true);

  await setPose(page, 0.5, 0);
  await advance(page, 30);
  const s1 = await state(page);
  expect(s1.progress).toBeGreaterThan(0.45);
  expect(s1.progress).toBeLessThan(0.55);
  expect(s1.onTrack).toBe(true);

  // A pose well beyond the road half-width reads as off-track.
  await setPose(page, 0.5, 9);
  await advance(page, 30);
  const s2 = await state(page);
  expect(s2.onTrack).toBe(false);
});

test('off-track grip penalty', async ({ page }) => {
  await startGame(page);

  // On the road: throttle reaches a high speed.
  await setPose(page, 0.0, 0);
  await setKey(page, 'ArrowUp', true);
  await advance(page, 1000);
  const onRoad = await state(page);
  await setKey(page, 'ArrowUp', false);

  // Off the road (held at a large lateral offset): top speed is capped low.
  await setPose(page, 0.0, 9);
  await setKey(page, 'ArrowUp', true);
  await advance(page, 1500);
  const offRoad = await state(page);
  await setKey(page, 'ArrowUp', false);

  expect(onRoad.speed).toBeGreaterThan(15);
  expect(offRoad.speed).toBeLessThan(13);
  expect(onRoad.speed).toBeGreaterThan(offRoad.speed + 4);
});

test('walls keep the kart on the circuit', async ({ page }) => {
  await startGame(page);
  // Teleport far outside the wall; the clamp must pull it back within bounds.
  await setPose(page, 0.5, 22);
  await advance(page, 60);
  const s = await state(page);
  expect(Math.abs(s.offset)).toBeLessThanOrEqual(10.5); // wallHalf (10) + epsilon
});

test('lap counts only on a full forward lap', async ({ page }) => {
  await startGame(page);

  // Cheat attempt: wiggle across the start line without hitting the gates.
  await setPose(page, 0.05, 0); await advance(page, 30);
  await setPose(page, 0.0, 0);  await advance(page, 30);
  await setPose(page, 0.04, 0); await advance(page, 30);
  await setPose(page, 0.0, 0);  await advance(page, 30);
  let s = await state(page);
  expect(s.lap).toBe(0); // no free laps

  // Real forward lap through all gates.
  await fullLap(page);
  s = await state(page);
  expect(s.lap).toBe(1);
});

test('race finishes after N laps', async ({ page }) => {
  await startGame(page);
  const total = (await state(page)).totalLaps;

  for (let i = 0; i < total; i++) {
    await fullLap(page);
  }
  const s = await state(page);
  expect(s.lap).toBe(total);
  expect(s.finished).toBe(true);
  expect(s.raceTime).toBeGreaterThan(0);
});
