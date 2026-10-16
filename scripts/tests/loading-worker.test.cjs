const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
function setup() {
  const handlers = {}, entries = new Map(); let calls = 0, network = Promise.resolve(new Response('new'));
  const key = req => typeof req === 'string' ? req : req.url;
  const cache = { match: async req => entries.get(key(req))?.clone(), put: async (req, value) => entries.set(key(req), value), addAll: async () => {} };
  const context = { URL, Request, Response, Promise, caches: { open: async () => cache }, self: { location: { origin: 'https://nexus.test' }, addEventListener: (name, cb) => handlers[name] = cb }, fetch: () => { calls++; return network.then(r => r.clone()); } };
  vm.runInNewContext(fs.readFileSync('.tmp/loading-20260910/portal/service-worker.js', 'utf8'), context);
  const request = (path, mode = 'cors', method = 'GET') => {
    let response; const waits = [], req = new Request(`https://nexus.test${path}`, { method }); Object.defineProperty(req, 'mode', { value: mode });
    handlers.fetch({ request: req, respondWith: r => { response = r; }, waitUntil: r => waits.push(r) }); return { response, waits };
  };
  return { entries, request, calls: () => calls, network: p => { network = p; } };
}
test('cached shell returns before an unresolved network refresh', async () => {
  const s = setup(); s.entries.set('/', new Response('shell')); s.network(new Promise(() => {}));
  const { response } = s.request('/?chatRoom=private-room', 'navigate'); assert.equal(await (await response).text(), 'shell'); assert.equal(s.calls(), 1);
});
test('versioned assets are cache-first, refreshable shell is updated in background', async () => {
  const s = setup(); s.entries.set('https://nexus.test/app.js?v=20260910-fast-pages', new Response('script'));
  assert.equal(await (await s.request('/app.js?v=20260910-fast-pages').response).text(), 'script'); assert.equal(s.calls(), 0);
  s.entries.set('/', new Response('old')); const r = s.request('/', 'navigate'); assert.equal(await (await r.response).text(), 'old'); await Promise.all(r.waits); assert.equal(await s.entries.get('/').text(), 'new');
});
test('private reads, writes, mock sales data and auth endpoints never enter the shell cache', () => {
  const s = setup(); for (const url of ['/portal-resources/private.xlsx', '/getStockFixDashboard', '/meridianChatMedia', '/sales-insights-source/mock-data/summary.json', '/__/auth/handler', '/__/firebase/init.js']) assert.equal(s.request(url).response, undefined, url);
  assert.equal(s.request('/app.js', 'cors', 'POST').response, undefined); assert.equal(s.calls(), 0);
});
test('failed background refresh does not replace cached shell', async () => {
  const s = setup(); s.entries.set('/', new Response('old')); s.network(Promise.reject(new Error('offline')));
  const r = s.request('/', 'navigate'); assert.equal(await (await r.response).text(), 'old'); await Promise.all(r.waits); assert.equal(await s.entries.get('/').text(), 'old');
});
