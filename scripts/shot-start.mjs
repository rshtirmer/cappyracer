// Screenshot at the start line (shows the gantry) + a top-down-ish overview.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.click('#play-btn');
await page.waitForTimeout(700); // let steam/clouds populate a touch
await page.screenshot({ path: '/tmp/cappyracer-start.png' });
const stats = await page.evaluate(() => window.__renderStats());
await browser.close();
console.log('RENDER:', JSON.stringify(stats), 'ERRORS:', errors.length, errors);
