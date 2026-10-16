"use strict";
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const puppeteer = require('../../functions/node_modules/puppeteer-core');
const { createServer } = require('../chat-preview.cjs');
const loadingRelease = require('../release-loading.cjs');
const stage = process.env.NEXUS_TEST_RELEASE || loadingRelease.stage;
const portal = process.env.NEXUS_TEST_RELEASE ? path.join(stage, 'portal') : loadingRelease.portal;
const assetPath = name => fs.existsSync(path.join(portal, name)) ? path.join(portal, name) : path.join(loadingRelease.portal, name);
const root = path.resolve(__dirname, '../..');
async function main() {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`; let browser;
  try {
    browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-extensions', '--no-first-run'] });
    const page = await browser.newPage(), errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') console.log(msg.text()); });
    await page.setViewport({ width: 1440, height: 1000 }); await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url()); requests.push(url.href);
      if (url.pathname.startsWith('/__/firebase/') || url.pathname === '/service-worker.js') return request.respond({ status: 200, contentType: 'text/javascript', body: '/* synthetic SDK */' });
      if (url.pathname === '/manifest.webmanifest') return request.respond({ status: 200, contentType: 'application/manifest+json', body: '{}' });
      const candidate = assetPath(url.pathname === '/' ? 'index.html' : path.basename(url.pathname));
      if (url.origin === origin && fs.existsSync(candidate)) return request.respond({ status: 200, contentType: url.pathname === '/' ? 'text/html' : url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(candidate) });
      if (url.origin === origin) return request.continue();
      const name = url.hostname === 'fonts.googleapis.com' ? 'manrope.css' : path.basename(url.pathname), vendor = path.join(root, '.tmp/chat-verification/vendor', name);
      if (fs.existsSync(vendor)) return request.respond({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: name.endsWith('.css') ? 'text/css' : 'font/woff2', body: fs.readFileSync(vendor) });
      return request.abort();
    });
    await page.evaluateOnNewDocument(adminEmail => {
      const t = window.loadingTest = { calls: [], delay: 700, fail: false, uid: 'admin', chatBoots: 0, authStarted: 0, clock: 0 };
      const realNow = Date.now; Date.now = () => realNow() + t.clock;
      const auth = { currentUser: null, onAuthStateChanged(cb) { t.authStarted = performance.now(); t.callback = cb; setTimeout(() => cb(null), 0); }, async signOut() { auth.currentUser = null; return t.callback(null); } };
      function query() { const q = { where: () => q, orderBy: () => q, limit: () => q, doc: () => q, collection: () => q, get: async () => ({ docs: [], exists: false }), onSnapshot(...args) { const cb = args.find(a => typeof a === 'function'); let stopped = false; setTimeout(() => { if (!stopped) cb({ docs: [], size: 0, exists: false, metadata: { fromCache: false } }); }, 0); return () => { stopped = true; }; } }; return q; }
      const db = { settings() {}, collection: query };
      const functions = { httpsCallable: name => async data => {
        t.calls.push({ name, data });
        if(name==='meridianChat'&&data.action==='activity')return {data:{unreadChats:t.unread??3,events:[]}};
        if (name === 'getOperationsWorkspace') return { data: { account: { uid: auth.currentUser.uid, role: 'admin', permissions: { chatEnabled: true } }, profiles: [], runs: [], prompts: [], alerts: [] } };
        if (name === 'meridianChat' && data.action === 'bootstrap') { t.chatBoots++; return { data: { actor: { uid: auth.currentUser.uid, audience: 'internal', admin: true, capabilities: {} }, workstreams: ['General'] } }; }
        if (['getStockFixDashboard', 'getSalesforceAttendanceDashboard', 'getGeoRepAttendanceDashboard', 'getTrainingHubDashboard', 'getSalesInsightsRoute'].includes(name)) {
          await new Promise(resolve => setTimeout(resolve, t.delay));
          if (t.fail) throw Object.assign(new Error('Synthetic access denied'), { code: 'functions/permission-denied' });
          if (name === 'getSalesforceAttendanceDashboard') return { data: { daily: { month: '2026-09', metrics: { runs: 1, plannedRows: 10, actualStores: 8 }, history: [{ attendanceDate: '2026-09-09', plannedRows: 10, actualStores: 8 }], activity: [{ label: '2026-09-09', value: 8 }] }, monthly: { month: '2026-09', metrics: { actualWeeks: 1 }, weeklyActuals: [{ week: 1, actual: 8 }] }, dedicatedCallCycle: { records: [{ store: 'SYNTHETIC Store', storeCode: 'S1', rep: 'SYNTHETIC Rep', region: 'Gauteng', division: 'Inland', manager: 'SYNTHETIC Manager', status: 'Active', callsPerMonth: 4 }], source: { fileName: 'TEST master.xlsx' } } } };
          if (name === 'getGeoRepAttendanceDashboard') return { data: { metrics: { users: 1, scheduled: 10, onSchedule: 8 }, rows: [], stores: [], source: { strikeRate: { fileName: 'TEST strike rate.xlsx' } }, availableFilters: {} } };
          if (name === 'getTrainingHubDashboard') return { data: { modules: [], errors: [] } };
          if (name === 'getSalesInsightsRoute') return { data: { test: true, route: data.route } };
          return { data: { selectedWeek: '2026-09-02', latestWeek: '2026-09-02', source: { provider: 'SYNTHETIC Firebase', migrationMode: 'firebase' }, totalWeeks: 1, availableWeeks: [{ week: '2026-09-02' }], metrics: { tasks: 120, stores: 10 }, charts: {}, rows: [], sourceRowCount: 120 } };
        }
        return { data: {} };
      } };
      window.firebase = { firestore: () => db, auth: () => auth, storage: () => ({ setMaxUploadRetryTime() {}, setMaxOperationRetryTime() {} }), app: () => ({ functions: () => functions }) };
      t.signIn = async (uid, claims = {}) => { auth.currentUser = { uid, email: adminEmail, async getIdTokenResult() { return { claims: { email: adminEmail, admin: true, ...claims } }; } }; await t.callback(auth.currentUser); };
      t.signOut = () => auth.signOut();
    }, process.env.NEXUS_TEST_ADMIN_EMAIL || 'admin@nexus.co.za');
    await page.goto(`${origin}/#home`, { waitUntil: 'networkidle2' });
    assert.deepEqual(errors, []); assert.equal(requests.some(url => url.includes('sheetjs')), false);
    await page.evaluate(() => loadingTest.signIn('admin')); await page.waitForFunction(() => state.isOperator && state.operationsWorkspace);
    assert.equal(await page.evaluate(() => state.isAdmin && !elements.adminWorkspace.hidden), true);
    const count = name => page.evaluate(name => loadingTest.calls.filter(c => c.name === name).length, name);
    const timing = await page.evaluate(async () => {
      const start = performance.now(); location.hash = 'stockfix';
      while (!state.stockFixDashboardData) await new Promise(r => setTimeout(r, 10));
      const firstMs = performance.now() - start;
      location.hash = 'home'; await new Promise(r => setTimeout(r, 40));
      const second = performance.now(); location.hash = 'stockfix';
      await new Promise(r => setTimeout(r, 40));
      while (state.stockFixDashboardLoading) await new Promise(r => setTimeout(r, 10));
      return { firstMs, revisitMs: performance.now() - second };
    });
    assert.equal(await count('getStockFixDashboard'), 1); assert.ok(timing.revisitMs < timing.firstMs / 2, JSON.stringify(timing));
    await page.screenshot({ path: path.join(stage, 'stockfix-desktop.png') });
    if(await page.evaluate(()=>!!window.NexusComms)){
      await page.waitForFunction(()=>document.querySelector('#stockFixView .nexus-chat-badge')?.textContent==='3');
      await page.evaluate(async()=>{loadingTest.unread=0;await NexusComms.refresh();});
      assert.equal(await page.$eval('#stockFixView .nexus-chat-badge',n=>n.hidden),true);
    }
    await page.click('#stockFixRefresh'); await page.waitForFunction(() => !state.stockFixDashboardLoading);
    assert.equal(await count('getStockFixDashboard'), 2, 'explicit refresh must fetch');
    await page.evaluate(() => { loadingTest.clock = 61000; loadStockFixDashboard(); });
    assert.equal(await page.$eval('#stockFixStatus', e => e.textContent.includes('Checking for updates')), true, 'stale report stays visible while refreshing');
    assert.equal(await page.$eval('#stockFixTasks', e => e.textContent), '120');
    await page.waitForFunction(() => !state.stockFixDashboardLoading);
    assert.equal(await count('getStockFixDashboard'), 3);
    await page.evaluate(() => { location.hash = 'attendance-jobs'; }); await page.waitForFunction(() => !document.getElementById('attendanceJobSummaryResults').hidden);
    assert.equal(await count('getSalesforceAttendanceDashboard'), 1);
    await page.evaluate(() => { state.attendanceDashboardSource = 'salesforce'; location.hash = 'attendance'; }); await page.waitForFunction(() => !state.salesforceAttendanceDashboardLoading);
    await page.evaluate(() => { location.hash = 'callcycle'; }); await page.waitForFunction(() => !state.callCycleLoading && state.callCycleSyndicatedData);
    assert.equal(await count('getSalesforceAttendanceDashboard'), 1, 'share approved attendance payload across all three pages');
    await page.screenshot({ path: path.join(stage, 'callcycle-desktop.png') });
    await page.evaluate(async () => { await callFunction('getSalesInsightsRoute', { route: '/summary' }); await callFunction('getSalesInsightsRoute', { route: '/summary' }); });
    assert.equal(await count('getSalesInsightsRoute'), 1);
    await page.evaluate(() => { location.hash = 'chat'; }); await page.waitForFunction(() => document.querySelector('.mc-connection')?.textContent === 'Connected');
    await page.evaluate(() => { window.chatNode = document.querySelector('.mc-layout'); location.hash = 'home'; });
    await new Promise(r => setTimeout(r, 50)); await page.evaluate(() => { location.hash = 'chat'; }); await new Promise(r => setTimeout(r, 50));
    assert.equal(await page.evaluate(() => loadingTest.chatBoots), 1); assert.equal(await page.evaluate(() => chatNode === document.querySelector('.mc-layout')), true);
    await page.screenshot({ path: path.join(stage, 'chat-desktop.png') });
    await page.setViewport({ width: 390, height: 844 }); await page.screenshot({ path: path.join(stage, 'chat-mobile.png') });
    assert.equal(await page.$eval('#meridianChat', e => e.scrollWidth <= e.clientWidth + 1), true);
    await page.evaluate(() => loadingTest.signOut()); assert.equal(await page.$eval('#meridianChat', e => e.children.length), 0);
    await page.evaluate(() => loadingTest.signIn('admin-two')); await page.evaluate(() => { location.hash = 'stockfix'; });
    await page.waitForFunction(() => state.stockFixDashboardData?.metrics?.tasks === 120 && !state.stockFixDashboardLoading);
    assert.equal(await count('getStockFixDashboard'), 4, 'different account cannot reuse cached report');
    await page.evaluate(() => { loadingTest.fail = true; }); await page.$eval('#stockFixRefresh', e => e.click());
    await page.waitForFunction(() => !state.stockFixDashboardLoading && document.getElementById('stockFixStatus').textContent.includes('not permitted'));
    assert.equal(await page.$eval('#stockFixTasks', e => e.textContent), '0', 'access denial must erase prior report metrics');
    assert.equal(await page.evaluate(() => state.stockFixDashboardData), null);
    await page.evaluate(() => { loadingTest.fail = false; }); await page.$eval('#stockFixRefresh', e => e.click());
    await page.waitForFunction(() => !state.stockFixDashboardLoading && state.stockFixDashboardData?.metrics?.tasks === 120);
    assert.deepEqual(errors, []);
    if (process.env.NEXUS_TEST_ADMIN_EMAIL) {
      await page.evaluate(() => loadingTest.signOut());
      await page.evaluate(() => loadingTest.signIn('synthetic-client', { chatClient: true, nexusRole: 'client' }));
      assert.equal(await page.evaluate(() => state.isAdmin || state.isOperator), false, 'client-marked Admin tokens cannot enter the portal');
      assert.equal(await page.$eval('#meridianChat', e => e.children.length), 0);
    }
    if (process.env.NEXUS_ATTENDANCE_TEST) await require('./attendance-browser-checks.cjs')({page,stage,errors});
    const hashes = Object.fromEntries(['app.js', 'index.html', 'service-worker.js', 'meridian-chat.js', 'nexus-load-cache.js'].map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(assetPath(name), 'utf8').replace(/\r\n/g, '\n')).digest('hex')]));
    const portalHashes=Object.fromEntries(fs.readdirSync(portal).filter(name=>fs.statSync(path.join(portal,name)).isFile()).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(portal,name))).digest('hex')]));
    fs.writeFileSync(path.join(stage, 'browser-verified.json'), JSON.stringify({ ok: true, at: new Date().toISOString(), timing, hashes, portal:portalHashes, errors, syntheticOnly: true }, null, 2));
    console.log(JSON.stringify({ timing, errors, ok: true }));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
