const test = require('node:test'), assert = require('node:assert/strict');
require('../../public/nexus-load-cache.js');
const { create } = globalThis.NexusLoadCache;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
test('identical reads join, cached results are immediate and isolated from renderer mutation', async () => {
  const d = deferred(); let calls = 0;
  const c = create({ scope: () => 'staff-a', fetch: () => { calls++; return d.promise; } });
  const first = c.read('getStockFixDashboard', { region: 'GP', week: '1' });
  const second = c.read('getStockFixDashboard', { week: '1', region: 'GP' });
  d.resolve({ rows: [1] }); const a = await first; a.rows.push(2);
  assert.deepEqual(await second, { rows: [1] }); assert.deepEqual(await c.read('getStockFixDashboard', { week: '1', region: 'GP' }), { rows: [1] }); assert.equal(calls, 1);
});
test('stale result paints while new request is pending; force bypasses cache', async () => {
  let clock = 0, response = Promise.resolve({ n: 1 });
  const c = create({ scope: () => 'a', now: () => clock, fetch: () => response });
  await c.read('getSalesforceAttendanceDashboard'); clock = 61000;
  const d = deferred(); response = d.promise; let painted;
  const next = c.read('getSalesforceAttendanceDashboard', {}, { onCached: (data, meta) => { painted = [data.n, meta.refreshing]; } });
  assert.deepEqual(painted, [1, true]); d.resolve({ n: 2 }); assert.equal((await next).n, 2);
  response = Promise.resolve({ n: 3 }); assert.equal((await c.read('getSalesforceAttendanceDashboard', {}, { force: true })).n, 3);
});
test('never cache writes, AI, chat authorization, downloads, exports or live job status', async () => {
  let calls = 0; const c = create({ scope: () => 'a', fetch: async () => ({ n: ++calls }) });
  for (const [name, data] of [['savePortalResource', {}], ['askNexusAssistant', {}], ['meridianChat', { action: 'bootstrap' }], ['getPortalResourceDownload', {}], ['getFranchiseOrderDashboard', { export: true }], ['getOperationsWorkspace', {}]]) {
    assert.notDeepEqual(await c.read(name, data), await c.read(name, data));
  }
});
test('identity, permissions, explicit invalidation and logout discard pending and saved reports', async () => {
  let identity = 'a/full', d = deferred(); const c = create({ scope: () => identity, fetch: () => d.promise });
  const first = c.read('getGeoRepAttendanceDashboard'); await Promise.resolve(); identity = 'b/limited'; d.resolve({ private: 'a' }); await assert.rejects(first, { code: 'cancelled' });
  d = deferred(); const next = c.read('getGeoRepAttendanceDashboard'); await Promise.resolve(); d.resolve({ private: 'b' }); assert.equal((await next).private, 'b');
  identity = 'b/no-attendance'; d = deferred(); const limited = c.read('getGeoRepAttendanceDashboard'); await Promise.resolve(); d.reject(Object.assign(new Error('denied'), { code: 'functions/permission-denied' })); await assert.rejects(limited);
  identity = 'b/full'; d = deferred(); const logout = c.read('getStockFixDashboard'); await Promise.resolve(); identity = ''; c.clear(); d.resolve({}); await assert.rejects(logout, { code: 'cancelled' });
});
test('expired and evicted reports require fresh reads; errors never become data', async () => {
  let clock = 0, calls = 0, fail = false; const c = create({ scope: () => 'a', now: () => clock, maxEntries: 1, fetch: async () => { calls++; if (fail) throw new Error('offline'); return {}; } });
  await c.read('getStockFixDashboard'); await c.read('getTrainingHubDashboard'); await c.read('getStockFixDashboard'); assert.equal(calls, 3);
  clock = 300001; let painted = false; fail = true;
  await assert.rejects(c.read('getStockFixDashboard', {}, { onCached: () => { painted = true; } })); assert.equal(painted, false);
  await assert.rejects(c.read('getStockFixDashboard')); assert.equal(calls, 5);
});
test('refreshing reports does not cancel an in-flight write or live permission check', async () => {
  const d = deferred(); const c = create({ scope: () => 'a', fetch: () => d.promise });
  const write = c.read('savePortalResource', { title: 'Master' }), permissions = c.read('getOperationsWorkspace');
  await Promise.resolve(); c.clear(); d.resolve({ saved: true });
  assert.deepEqual(await write, { saved: true }); assert.deepEqual(await permissions, { saved: true });
});
