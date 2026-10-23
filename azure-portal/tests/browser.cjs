'use strict';
// Browser check against a local preview server (NEXUS_PREVIEW=true NODE_ENV=development npm start):
// every page at desktop and phone size, no console errors, no sideways scrolling; screenshots to test-results/.
//   node tests/browser.cjs [baseUrl]
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'test-results');
const PAGES = ['/', '/attendance/reps/daily', '/franchise-orders/regions', '/automation', '/admin', '/admin/users'];
const SIZES = {desktop: {width: 1440, height: 900}, phone: {width: 390, height: 844}};

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch({channel: 'msedge'});
  const failures = [];
  for (const [size, viewport] of Object.entries(SIZES)) {
    const page = await (await browser.newContext({viewport, deviceScaleFactor: 1})).newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', error => errors.push(error.message));
    for (const route of PAGES) {
      await page.goto(BASE + route, {waitUntil: 'networkidle'});
      await page.waitForSelector('#shell:not([hidden])', {timeout: 10000});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const crumbs = await page.textContent('#crumbs');
      if (overflow > 0) failures.push(`${size} ${route}: page scrolls sideways by ${overflow}px`);
      if (/null|undefined/.test(crumbs)) failures.push(`${size} ${route}: breadcrumb "${crumbs}"`);
      await page.screenshot({path: path.join(OUT, `${size}${route.replace(/\//g, '_') || '_home'}.png`)});
    }
    if (size === 'phone') {
      await page.goto(BASE + '/', {waitUntil: 'networkidle'});
      await page.click('#menuButton');
      await page.waitForTimeout(350);
      await page.screenshot({path: path.join(OUT, 'phone_drawer.png')});
      if (!(await page.isVisible('#nav'))) failures.push('phone: drawer did not open');
    } else {
      await page.keyboard.press('Control+k');
      await page.fill('#paletteInput', 'orders');
      await page.screenshot({path: path.join(OUT, 'desktop_palette.png')});
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      if (!page.url().includes('/franchise-orders')) failures.push(`palette did not open Franchise orders (${page.url()})`);
    }
    for (const error of errors) failures.push(`${size}: console error: ${error}`);
  }
  await browser.close();
  console.log(failures.length ? `FAILED\n- ${failures.join('\n- ')}` : `passed: ${PAGES.length} pages x ${Object.keys(SIZES).length} sizes, drawer, search palette`);
  process.exitCode = failures.length ? 1 : 0;
})();
