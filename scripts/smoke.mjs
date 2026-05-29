// Headless smoke test: load the game, capture console errors, screenshot.
// Usage: node scripts/smoke.mjs [url] [outPng]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3000';
const out = process.argv[3] || '/tmp/cappyracer-smoke.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Probe the exposed game globals
const probe = await page.evaluate(() => ({
  hasGame: !!window.__GAME__,
  hasState: !!window.__GAME_STATE__,
  hasBus: !!window.__EVENT_BUS__,
  canvasCount: document.querySelectorAll('canvas').length,
  title: document.title,
}));

await page.screenshot({ path: out });
await browser.close();

console.log('PROBE:', JSON.stringify(probe));
console.log('CONSOLE_ERRORS:', errors.length);
for (const e of errors) console.log('  -', e);
console.log('SCREENSHOT:', out);
process.exit(errors.length === 0 && probe.hasGame && probe.canvasCount > 0 ? 0 : 1);
