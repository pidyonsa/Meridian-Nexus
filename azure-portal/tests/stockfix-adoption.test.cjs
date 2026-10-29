'use strict';
// StockFix › Adoption: the rules of the Adoption page served by the StockFix app, from the StockFix app's own answers.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {adoptionModel, adoptionRoutes, stockfixAppSource} = require('../server/stockfix/adoption.cjs');
const {errorHandler} = require('../server/errors.cjs');

const rep = (name, resourceType, completed, extra = {}) => ({rep: name, resourceType, completed, open: 2, region: 'Gauteng', manager: 'Manager A', banner: 'PnP', ...extra});
const live = {
  week: '2026-10-21', totals: {completed: 30, open: 40},
  byRep: [rep('Rep 1', 'SYNDICATED REP', 6), rep('Rep 2', 'SYNDICATED REP', 0), rep('Lead', 'TEAM LEADER', 2), rep('Merch 1', 'SYNDICATED MERCHANDISER', 1, {region: 'Western Cape', manager: 'Manager B', banner: 'Checkers'}),
    rep('Merch 2', 'SYNDICATED MERCHANDISER', 0, {region: 'Western Cape', manager: 'Manager B', banner: 'Checkers'}), rep('Other', 'DRIVER', 3, {region: 'Unknown'})],
  // The StockFix app's own role totals: the cards use these when nothing narrows the page.
  adoptionByRole: [{role: 'Merchandiser', totalPeople: 2134, activePeople: 894, adoptionPct: 41.9}, {role: 'Rep', totalPeople: 180, activePeople: 106, adoptionPct: 58.9}, {role: 'Unknown', totalPeople: 50, activePeople: 1, adoptionPct: 2}],
  byStore: [{store: 'S1', completed: 3, open: 0}, {store: 'S2', completed: 0, open: 4}, {store: 'S3', completed: 2, open: 1}],
  byRegion: [{region: 'Gauteng', completed: 8, open: 6, totalPeople: 3, activePeople: 2, adoptionPct: 66.7, reps: {totalPeople: 3, activePeople: 2, adoptionPct: 66.7}, merchandisers: {totalPeople: 0, activePeople: 0}},
    {region: 'Western Cape', completed: 1, open: 4, totalPeople: 2, activePeople: 1, adoptionPct: 50, reps: {totalPeople: 0, activePeople: 0}, merchandisers: {totalPeople: 2, activePeople: 1, adoptionPct: 50}},
    {region: 'Unknown', completed: 3, open: 2}],
  byManager: [{manager: 'Manager A', totalPeople: 3, activePeople: 2, adoptionPct: 66.7, reps: {totalPeople: 3, activePeople: 2}, merchandisers: {totalPeople: 0, activePeople: 0}}, {manager: 'Unknown', totalPeople: 1}],
  byClient: [{client: 'Sir Fruit'}, {client: 'Clover'}],
  recent: [{store: 'S3', region: 'Western Cape', manager: 'Manager B', banner: 'Checkers'}]
};
const trend = {trend: [{week: '2026-10-14', repPct: 50, merchPct: 25}, {week: '2026-10-21', repPct: 58.9, merchPct: 41.9}]};

test('adoption: the role cards use the StockFix app totals; coverage, dormant, regions, divisions and managers as on its page', () => {
  const m = adoptionModel({data: live, trend});
  assert.deepEqual(m.kpis.reps, {active: 106, total: 180, pct: 58.9});
  assert.deepEqual(m.kpis.merchandisers, {active: 894, total: 2134, pct: 41.9});
  assert.deepEqual([m.kpis.coverage.touched, m.kpis.coverage.total], [2, 3]);
  assert.equal(m.kpis.dormant, 2); assert.equal(m.kpis.completed, 30, 'no fine filter: the StockFix totals');
  assert.deepEqual([m.mix.habitual, m.mix.trialling, m.mix.dormant], [1, 3, 2]);
  assert.deepEqual(m.regions.map(r => [r.label, r.completed, r.people.active, r.people.total, r.repsPct, r.merchPct, r.adoptionPct]),
    [['Gauteng', 8, 2, 3, 66.7, null, 66.7], ['Western Cape', 1, 1, 2, null, 50, 50]], 'from byRegion; unknown regions dropped');
  assert.deepEqual(m.divisions.map(x => [x.label, x.people.active, x.people.total]), [['Inland', 2, 3], ['Coastal', 1, 2]]);
  assert.deepEqual(m.managers.map(x => x.manager), ['Manager A']);
  assert.deepEqual(m.filters.clients, ['Clover', 'Sir Fruit']); assert.deepEqual(m.filters.regions, ['Gauteng', 'Unknown', 'Western Cape']);
  assert.equal(m.resources[0].rep, 'Rep 1'); assert.equal(m.trend.rows.length, 2);
});

test('adoption: a region, manager, banner or type filter counts the cards from the resources (role matched by name)', () => {
  const m = adoptionModel({data: live, filters: {region: 'Western Cape'}});
  assert.deepEqual(m.kpis.reps, {active: 0, total: 0, pct: 0});
  assert.deepEqual([m.kpis.merchandisers.active, m.kpis.merchandisers.total], [1, 2]);
  assert.equal(m.kpis.completed, 1, 'fine filter: summed from the resources');
  assert.deepEqual(m.stores.rows.map(s => s.store), ['S3'], 'stores scoped to captures in the region');
  assert.deepEqual(m.regions.map(r => r.label), ['Western Cape']);
  const byType = adoptionModel({data: live, filters: {rtype: 'SYNDICATED REP'}});
  assert.deepEqual([byType.kpis.reps.active, byType.kpis.reps.total], [1, 2]);
  assert.deepEqual(byType.regions.map(r => [r.label, r.completed, r.people, r.repsPct]), [['Gauteng', 6, null, 50], ['Western Cape', 0, null, null]], 'type chosen: every known region, captures and the role split from the resources');
});

function fakeApp(calls) {
  return {
    weeks: async () => ({weeks: [{weekEnding: '2026-10-21', live: true}, {weekEnding: '2026-10-14', live: false}]}),
    live: async qs => { calls.push(`live?${qs}`); return live; },
    snapshot: async (week, qs) => { calls.push(`snapshot ${week}?${qs}`); return {...live, week}; },
    trend: async qs => { calls.push(`trend?${qs}`); return trend; }
  };
}
async function serve(t, source, allowed = true) {
  const app = express();
  adoptionRoutes({source, allow: () => allowed})(app);
  app.use(errorHandler(() => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  return path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
}

test('adoption route: live week, saved weeks, filters passed to the StockFix app, validation and access', async t => {
  const calls = [];
  const get = await serve(t, fakeApp(calls));
  const d = await (await get('/api/stockfix/adoption')).json();
  assert.equal(d.live, true); assert.equal(d.week, '2026-10-21'); assert.equal(d.liveWeek, '2026-10-21'); assert.equal(d.weeks.length, 2);
  assert.deepEqual(calls.sort(), ['live?', 'trend?']);
  calls.length = 0;
  const s = await (await get('/api/stockfix/adoption?week=2026-10-14&region=Gauteng&bogus=1')).json();
  assert.equal(s.live, false); assert.equal(s.week, '2026-10-14');
  assert.deepEqual(calls.sort(), ['live?', 'snapshot 2026-10-14?region=Gauteng', 'trend?region=Gauteng&onlyWeeks=2026-10-14']);
  assert.equal((await get('/api/stockfix/adoption?week=2026-10-21')).status, 200, 'the live week by date is the live view');
  assert.equal((await get('/api/stockfix/adoption?week=2026-09-01')).status, 404);
  assert.equal((await get('/api/stockfix/adoption?week=21-10-2026')).status, 400);
  assert.equal((await (await serve(t, fakeApp([]), false))('/api/stockfix/adoption')).status, 403);
});

test('StockFix app source: caches each address for a minute; an unreachable or failing app is a clear 503', async () => {
  let clock = 0, hits = 0;
  const ok = stockfixAppSource({base: 'https://sf.example', now: () => clock, fetchImpl: async url => { hits++; assert.equal(url, 'https://sf.example/api/live-dashboard?region=X'); return new Response(JSON.stringify(live)); }});
  await ok.live('region=X'); await ok.live('region=X');
  assert.equal(hits, 1); clock += 61000; await ok.live('region=X'); assert.equal(hits, 2);
  const missing = stockfixAppSource({fetchImpl: async () => new Response('', {status: 404})});
  assert.equal(await missing.snapshot('2026-01-01', ''), null);
  const down = stockfixAppSource({fetchImpl: async () => { throw new Error('ECONNREFUSED'); }});
  await assert.rejects(down.weeks(), e => e.code === 'unavailable' && /could not be reached/.test(e.message));
  const failing = stockfixAppSource({fetchImpl: async () => new Response('x', {status: 500})});
  await assert.rejects(failing.trend(''), e => e.code === 'unavailable');
});
