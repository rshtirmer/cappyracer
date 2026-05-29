import { test, expect } from '@playwright/test';

// --- helpers -----------------------------------------------------------------

async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => window.__removeAI()); // isolate the player for solo physics tests
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; }); // skip the 3-2-1 hold
}

function setKey(page, code, down) {
  return page.evaluate(
    ({ code, down }) =>
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })),
    { code, down }
  );
}

const advance = (page, ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));

// --- tests -------------------------------------------------------------------

test('state + no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await startGame(page);
  const s = await state(page);
  expect(typeof s.speed).toBe('number');
  expect(typeof s.heading).toBe('number');

  await setKey(page, 'ArrowUp', true);
  await advance(page, 600);
  await setKey(page, 'ArrowUp', false);

  expect(errors).toEqual([]);
});

test('accelerate and coast', async ({ page }) => {
  await startGame(page);

  await setKey(page, 'ArrowUp', true);
  await advance(page, 800);
  const moving = await state(page);
  expect(moving.speed).toBeGreaterThan(1); // throttle builds forward speed

  await setKey(page, 'ArrowUp', false);
  await advance(page, 3000);
  const coasted = await state(page);
  expect(coasted.speed).toBeLessThan(moving.speed); // drag decays speed
  expect(coasted.speed).toBeGreaterThanOrEqual(0); // never goes negative from coasting
});

test('steering scales with speed', async ({ page }) => {
  await startGame(page);
  const h0 = (await state(page)).heading; // kart spawns facing the track tangent

  // Steering while stationary should NOT rotate the kart (no pivot-in-place).
  await setKey(page, 'ArrowLeft', true);
  await advance(page, 800);
  const still = await state(page);
  await setKey(page, 'ArrowLeft', false);
  expect(Math.abs(still.heading - h0)).toBeLessThan(0.05);

  // Moving + steering should rotate the heading.
  await setKey(page, 'ArrowUp', true);
  await advance(page, 500);
  const before = await state(page);
  await setKey(page, 'ArrowLeft', true);
  await advance(page, 700);
  const after = await state(page);
  await setKey(page, 'ArrowUp', false);
  await setKey(page, 'ArrowLeft', false);
  expect(Math.abs(after.heading - before.heading)).toBeGreaterThan(0.1);
});

test('brake and reverse', async ({ page }) => {
  await startGame(page);

  await setKey(page, 'ArrowDown', true);
  await advance(page, 1800);
  const s = await state(page);
  await setKey(page, 'ArrowDown', false);
  expect(s.speed).toBeLessThan(-0.5); // came to a stop then reversed
});

// Lateral displacement relative to the spawn heading: positive = the kart's
// own screen-left. Independent of where on the track the kart spawned.
//   forward f = (-sin h0, -cos h0); screen-left L = (fz, -fx)
//   leftComponent = d·L = -dx·cos h0 + dz·sin h0
function leftComponent(start, end, h0) {
  const dx = end.player.x - start.player.x;
  const dz = end.player.z - start.player.z;
  return -dx * Math.cos(h0) + dz * Math.sin(h0);
}

test('steering is not inverted (left turns left, right turns right)', async ({ page }) => {
  // Short drive on the start straight keeps us on-road (no wall interference).
  await startGame(page);
  const s0 = await state(page);
  await setKey(page, 'ArrowUp', true);
  await setKey(page, 'ArrowLeft', true);
  await advance(page, 700);
  const sL = await state(page);
  await setKey(page, 'ArrowUp', false);
  await setKey(page, 'ArrowLeft', false);
  expect(leftComponent(s0, sL, s0.heading)).toBeGreaterThan(0.3); // drifted screen-left

  await startGame(page); // fresh kart
  const s1 = await state(page);
  await setKey(page, 'ArrowUp', true);
  await setKey(page, 'ArrowRight', true);
  await advance(page, 700);
  const sR = await state(page);
  await setKey(page, 'ArrowUp', false);
  await setKey(page, 'ArrowRight', false);
  expect(leftComponent(s1, sR, s1.heading)).toBeLessThan(-0.3); // drifted screen-right
});

test('drives along heading', async ({ page }) => {
  await startGame(page);
  const before = await state(page);
  const h = before.heading;

  await setKey(page, 'ArrowUp', true);
  await advance(page, 1500);
  const after = await state(page);
  await setKey(page, 'ArrowUp', false);

  // The kart should translate a good distance ALONG its forward heading.
  const dx = after.player.x - before.player.x;
  const dz = after.player.z - before.player.z;
  const dist = Math.hypot(dx, dz);
  expect(dist).toBeGreaterThan(15);
  const fwdDot = (dx * -Math.sin(h) + dz * -Math.cos(h)) / dist;
  expect(fwdDot).toBeGreaterThan(0.9); // displacement points along the heading
});
