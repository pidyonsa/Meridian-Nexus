'use strict';
// Browser check against a local preview server (NEXUS_PREVIEW=true NODE_ENV=development npm start):
// every page at desktop and phone size, no console errors, no sideways scrolling, the right module highlighted;
// screenshots to test-results/.
//   node tests/browser.cjs [baseUrl]
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'test-results');
// [path, module that should be highlighted]
const PAGES = [['/', 'home'], ['/modules/geo', 'geo'], ['/modules/call-cycle', 'call-cycle'], ['/modules/activate', 'activate'], ['/attendance/rep/overview', 'geo'], ['/admin', 'admin'], ['/admin/users', 'admin']];
const SIZES = {desktop: {width: 1440, height: 900}, phone: {width: 390, height: 844}};
const shot = route => route.replace(/\//g, '_') || '_home';

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch({channel: 'msedge'});
  const failures = [];
  for (const [size, viewport] of Object.entries(SIZES)) {
    const page = await (await browser.newContext({viewport, deviceScaleFactor: 1})).newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', error => errors.push(error.message));
    for (const [route, module] of PAGES) {
      await page.goto(BASE + route, {waitUntil: 'networkidle'});
      await page.waitForSelector('#shell:not([hidden])', {timeout: 10000});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const active = await page.getAttribute('.nav-item.active', 'data-nav').catch(() => null);
      if (overflow > 0) failures.push(`${size} ${route}: page scrolls sideways by ${overflow}px`);
      if (active !== module) failures.push(`${size} ${route}: highlighted "${active}", expected "${module}"`);
      await page.screenshot({path: path.join(OUT, `${size}${shot(route)}.png`), fullPage: size === 'desktop' && route === '/'});
    }
    if (size === 'phone') {
      await page.goto(BASE + '/', {waitUntil: 'networkidle'});
      await page.click('#menuButton');
      await page.waitForTimeout(350);
      await page.screenshot({path: path.join(OUT, 'phone_drawer.png')});
      if (!(await page.isVisible('#nav'))) failures.push('phone: drawer did not open');
    } else {
      await page.goto(BASE + '/', {waitUntil: 'networkidle'});
      await page.click('.tool-search');
      await page.fill('#paletteInput', 'merchandisers roster');
      await page.screenshot({path: path.join(OUT, 'desktop_palette.png')});
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      if (!page.url().endsWith('/attendance/merchandiser/users')) failures.push(`search did not open the merchandiser roster (${page.url()})`);
    }
    for (const error of errors) failures.push(`${size}: console error: ${error}`);
  }
  await browser.close();
  console.log(failures.length ? `FAILED\n- ${failures.join('\n- ')}` : `passed: ${PAGES.length} pages x ${Object.keys(SIZES).length} sizes, drawer, search`);
  process.exitCode = failures.length ? 1 : 0;
})();
