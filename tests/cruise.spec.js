import { test, expect } from '@playwright/test';

// Highway free-cruise: solo, no items, infinite laps, near-miss score + combo.

async function startCruise(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && !!window.__SAVE && !!window.__GAME__.trafficGltfs
  );
  await page.evaluate(() => { window.__SAVE.markAllBeatsSeen(); window.__selectTrack(3); });
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.RACE_REQUESTED));
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; });
  await page.evaluate(() => window.advanceTime(30));
}

test('cruise is solo + endless + no items', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await startCruise(page);
  const s = await page.evaluate(() => {
    const g = window.__GAME__;
    return {
      racers: g.racers.length,
      endless: window.__GAME_STATE__.endless,
      infinite: g.laps === Infinity,
      boxes: g.items.boxes.length,
      pads: g.items.pads.length,
      cruise: g.traffic.cruise,
    };
  });
  expect(s.racers).toBe(1);          // no AI rivals
  expect(s.endless).toBe(true);
  expect(s.infinite).toBe(true);     // never finishes
  expect(s.boxes).toBe(0);           // no item boxes
  expect(s.pads).toBe(0);            // no boost pads
  expect(s.cruise).toBe(true);
  // Filter the sandbox-only font-CDN error if it ever appears; self-hosted now.
  expect(errors.filter((e) => !e.includes('ERR_CERT'))).toEqual([]);
});

test('threading past a car scores points + builds combo', async ({ page }) => {
  await startCruise(page);
  const r = await page.evaluate(() => {
    const g = window.__GAME__;
    const gs = window.__GAME_STATE__;
    gs.score = 0; gs.combo = 1;
    const t = g.traffic;
    const car = t.cars[0];
    const s = g.track.pointAtSmooth(car.progress);
    const cx = s.pos.x + s.normal.x * car.lane;
    const cz = s.pos.z + s.normal.z * car.lane;
    const p = g.racers[0].kart;
    p.spinTimer = 0; p.speed = 30;
    p.mesh.position.set(cx + s.normal.x * 4.0, 0, cz + s.normal.z * 4.0); // alongside
    t.update(0.016, g.racers, true);
    p.mesh.position.set(cx + s.normal.x * 9.0, 0, cz + s.normal.z * 9.0); // pulled clear
    t.update(0.016, g.racers, true);
    return { score: gs.score, combo: gs.combo };
  });
  expect(r.score).toBeGreaterThan(0);
  expect(r.combo).toBe(2);
});

test('crashing into a car wipes the combo and spins the player', async ({ page }) => {
  await startCruise(page);
  const r = await page.evaluate(() => {
    const g = window.__GAME__;
    const gs = window.__GAME_STATE__;
    gs.combo = 8;
    const t = g.traffic;
    const car = t.cars[2];
    car.hitTimer = 0;
    const s = g.track.pointAtSmooth(car.progress);
    const cx = s.pos.x + s.normal.x * car.lane;
    const cz = s.pos.z + s.normal.z * car.lane;
    const p = g.racers[0].kart;
    p.spinTimer = 0; p.speed = 30;
    p.mesh.position.set(cx, 0, cz); // right on the car
    t.update(0.016, g.racers, true);
    return { combo: gs.combo, spun: p.spinTimer > 0 };
  });
  expect(r.combo).toBe(1);
  expect(r.spun).toBe(true);
});
