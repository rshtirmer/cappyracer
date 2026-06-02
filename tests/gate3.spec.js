import { test, expect } from '@playwright/test';

// Gate 3 — keep races close + better item feel + less-sticky collisions.

async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !!window.__GAME__ && typeof window.advanceTime === 'function'
      && JSON.parse(window.render_game_to_text()).racers.length === 6
  );
  await page.evaluate(() => window.__EVENT_BUS__.emit(window.__EVENTS__.GAME_START));
  await page.evaluate(() => { window.__GAME_STATE__.countdown = 0; });
  await page.evaluate(() => window.advanceTime(30));
}

test('rubber-band: trailing AI speed up when the player is ahead', async ({ page }) => {
  await startGame(page);
  const rubbers = await page.evaluate(() => {
    const g = window.__GAME__;
    window.__setKartPose(0.55, 0);            // shove the player well ahead
    g.racers[0].crossedStart = true;
    g.racers[0].lapTracker.lap = 0;
    window.advanceTime(40);                    // one updatePositions pass
    return g.racers.filter((r) => r.ai).map((r) => r.rubber);
  });
  // All AI are now behind the player -> each gets a >1 top-speed scale.
  for (const v of rubbers) expect(v).toBeGreaterThan(1);
});

test('kart collisions are not sticky (a graze keeps most speed)', async ({ page }) => {
  await startGame(page);
  const speed = await page.evaluate(() => {
    const g = window.__GAME__;
    const a = g.racers[0].kart;
    const b = g.racers[1].kart;
    a.mesh.position.set(0, 0, 0);
    b.mesh.position.set(2.1, 0, 0);            // grazing contact (d < COLLIDE_DIST)
    a.speed = 30; b.speed = 30;
    for (let i = 0; i < 30; i++) g.resolveCollisions();
    return a.speed;
  });
  // The old flat per-frame *0.92 would crater 30 -> ~2.5; depth-scaled bleed keeps it high.
  expect(speed).toBeGreaterThan(20);
});

test('overlapping karts still separate (anti-stack)', async ({ page }) => {
  await startGame(page);
  const sep = await page.evaluate(() => {
    const g = window.__GAME__;
    const a = g.racers[0].kart.mesh.position;
    const b = g.racers[1].kart.mesh.position;
    b.set(a.x, a.y, a.z);
    for (let i = 0; i < 8; i++) g.resolveCollisions();
    return Math.hypot(b.x - a.x, b.z - a.z);
  });
  expect(sep).toBeGreaterThan(1.5);
});

test('AI aims shells at the player ahead, not behind', async ({ page }) => {
  await startGame(page);
  const r = await page.evaluate(() => {
    const g = window.__GAME__;
    const sys = g.items;
    const ai = g.racers[1];
    const player = g.racers[0];
    ai.kart.mesh.position.set(0, 0, 0);
    ai.kart.heading = 0;                        // forward = -Z
    player.kart.spinTimer = 0;
    player.kart.mesh.position.set(0, 0, -12);   // ahead
    const ahead = sys._playerInAimCone(ai, player);
    player.kart.mesh.position.set(0, 0, 12);    // behind
    const behind = sys._playerInAimCone(ai, player);
    return { ahead, behind };
  });
  expect(r.ahead).toBe(true);
  expect(r.behind).toBe(false);
});

test('item draws favor comeback for trailing racers', async ({ page }) => {
  await startGame(page);
  const r = await page.evaluate(() => {
    const sys = window.__GAME__.items;
    const tally = (pos) => {
      const c = { shell: 0, melon: 0, mud: 0 };
      for (let i = 0; i < 400; i++) c[sys._weightedItem({ position: pos }, 6)]++;
      return c;
    };
    return { leader: tally(1), last: tally(6) };
  });
  // The leader mostly gets defensive mud; the back of the pack gets offense/comeback.
  expect(r.leader.mud).toBeGreaterThan(r.leader.shell);
  expect(r.last.shell + r.last.melon).toBeGreaterThan(r.last.mud * 3);
});
