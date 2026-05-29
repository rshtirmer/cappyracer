// Drive the kart for real-time and screenshot it (visual live-iterate).
// Usage: node scripts/shot.mjs [outPng]
import { chromium } from 'playwright';

const out = process.argv[2] || '/tmp/cappyracer-drive.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.click('#play-btn'); // click PLAY so the menu overlay hides (real flow)

// Drive forward (real-time so the RAF loop renders & camera follows).
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
});
await page.waitForTimeout(1100);
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
});
await page.waitForTimeout(300);

const s = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
await page.screenshot({ path: out });
await browser.close();

console.log('STATE:', JSON.stringify(s));
console.log('CONSOLE_ERRORS:', errors.length, errors);
console.log('SCREENSHOT:', out);
