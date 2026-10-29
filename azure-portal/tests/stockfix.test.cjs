'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const express = require('express');
const ExcelJS = require('exceljs');
const {dashboard, detail, cleanFilters, cleanRowFilters, isActioned, isPending} = require('../server/stockfix/report.cjs');
const {sharePointStockFixSource, memoryStockFixSource, parseWeek} = require('../server/stockfix/source.cjs');
const {stockfixRoutes} = require('../server/stockfix/routes.cjs');
const {errorHandler} = require('../server/errors.cjs');

// Five weeks, so Action Impact (baseline four weeks before the target) has a comparison for the last one.
const WEEKS = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'];
const s = (week, extra) => ({week, client: 'Sir Fruit', banner: 'PnP', region: 'Gauteng', classification: 'Overstock', actionStatus: 'Completed', count: 1, ...extra});
const summary = [
  s('2026-10-11', {count: 8}), s('2026-10-11', {actionStatus: 'Pending', count: 2}),
  s('2026-10-18', {count: 6}), s('2026-10-18', {actionStatus: 'Pending', count: 3}), s('2026-10-18', {actionStatus: 'Actioned - Escalated', count: 1}),
  s('2026-10-18', {client: 'Clover', banner: 'Checkers', region: 'Coastal', classification: 'Out of Stock', actionStatus: 'Fixed', count: 4}),
  s('2026-10-18', {client: 'Clover  ', banner: 'Checkers', region: 'Coastal', classification: 'Out of Stock', actionStatus: 'Pending', count: 6})   // raw text: double space kept
];
const lb = (week, rep, extra) => ({week, client: 'Sir Fruit', banner: 'PnP', region: 'Gauteng', manager: 'Manager A', rep, resourceType: 'SYNDICATED REP', tasksAssigned: 10, tasksCaptured: 5, storesAssigned: 4, storesCaptured: 2, ...extra});
const leaderboard = [lb('2026-10-11', 'Rep 1', {tasksCaptured: 2}), lb('2026-10-18', 'Rep 1', {tasksCaptured: 9}), lb('2026-10-18', 'Rep 2', {manager: 'Manager B', tasksCaptured: 1, resourceType: null}),
  lb('2026-10-18', 'Rep 3', {client: 'Clover', banner: 'Checkers', region: 'Coastal', tasksAssigned: 4, tasksCaptured: 4})];
const impact = [{baselineWeek: '2026-09-20', targetWeek: '2026-10-18', client: 'Sir Fruit', banner: 'PnP', region: 'Gauteng', manager: 'Manager A', rep: 'Rep 1', feedbackTasks: 10, matchedTasks: 8, feedbackStores: 3, matchedStores: 3, impactedStores: 2,
  overstockTasks: 4, overstockReducedTasks: 2, overstockSohReduced: 12.5, availabilityRiskTasks: 2, availabilityRestoredTasks: 1, availabilitySohRestored: 6, salesImprovedTasks: 4, salesUnitsGained: 9, noSalesTasks: 0, noSalesResolvedTasks: 0, negativeSohTasks: 1, negativeSohResolvedTasks: 1}];
const task = (store, extra) => ({week: '2026-10-18', client: 'Sir Fruit', banner: 'PnP', region: 'Gauteng', store, rep: 'Rep 1', manager: 'Manager A', barcode: '600100', article: 'Apple juice 1L', storeSoh: '12', dcSoh: 40, p4Sales: '8', storeWfc: 6.2, classification: 'Overstock', action: 'Overstock: check', actionStatus: 'Completed', feedback: 'Moved to display', ...extra});
const rows = [task('PnP Rosebank'), task('PnP Rosebank', {barcode: '600200', article: 'Pear juice', actionStatus: 'Pending', feedback: ''}), task('PnP Sandton', {storeSoh: 'n/a'}),
  task('Checkers Umhlanga', {client: 'Clover', banner: 'Checkers', region: 'Coastal', classification: 'Out of Stock', rep: 'Rep 3', actionStatus: 'Fixed', barcode: '700'})];
const data = {weeks: WEEKS.map(week => ({week, rowCount: 1})), summary, leaderboard, impact, updatedAt: '2026-10-19T04:00:00Z'};

test('status rules match the StockFix dashboard', () => {
  for (const status of ['Completed', 'Fixed', 'Actioned - Escalated', 'Actioned']) assert.ok(isActioned(status), status);
  for (const status of ['Pending', 'Escalated', '', null]) assert.ok(!isActioned(status), String(status));
  assert.ok(isPending('Pending review')); assert.ok(!isPending('Completed'));
});

test('dashboard: newest week by default, totals, deltas against the prior week, trend and breakdowns', () => {
  const d = dashboard({data, rows});
  assert.equal(d.week, '2026-10-18'); assert.equal(d.priorWeek, '2026-10-11'); assert.deepEqual(d.weeks, [...WEEKS].reverse());
  const t = d.overview.totals;
  assert.equal(t.tasks, 20); assert.equal(t.actioned, 11); assert.equal(t.pending, 9); assert.equal(t.escalated, 1);
  assert.equal(t.stores, 3); assert.equal(t.skus, 3); assert.equal(t.feedback, 3);
  assert.equal(d.overview.prior.tasks, 10); assert.equal(d.overview.prior.actioned, 8);
  assert.deepEqual(d.overview.trend.map(w => [w.week, w.tasks]), [['2026-09-20', 0], ['2026-09-27', 0], ['2026-10-04', 0], ['2026-10-11', 10], ['2026-10-18', 20]]);
  assert.deepEqual(d.overview.byClient.map(c => [c.label, c.tasks]), [['Clover', 10], ['Sir Fruit', 10]], 'whitespace collapsed, as the generator does');
  assert.deepEqual(d.filters.clients, ['Clover', 'Sir Fruit']);
  assert.equal(d.weekRows, 4);
});

test('filters narrow every view and the other filter lists; unknown keys are ignored', () => {
  assert.deepEqual(cleanFilters({client: ' Clover ', store: 'x', region: ''}), {client: 'Clover'});
  const d = dashboard({data, rows, filters: cleanFilters({client: 'Clover'})});
  assert.equal(d.overview.totals.tasks, 10); assert.equal(d.overview.totals.actioned, 4); assert.equal(d.overview.totals.stores, 1);
  assert.deepEqual(d.filters.clients, ['Clover', 'Sir Fruit'], 'the filter itself still lists every client');
  assert.deepEqual(d.filters.regions, ['Coastal']);
  assert.equal(d.leaderboard.totals.assigned, 4);
  assert.equal(d.impact.totals.feedbackTasks, 0);
});

test('leaderboard: capture rates by rep, manager and resource type, and a four-week region heatmap', () => {
  const l = dashboard({data, rows}).leaderboard;
  assert.equal(l.totals.assigned, 24); assert.equal(l.totals.captured, 14); assert.equal(l.totals.reps, 3); assert.equal(l.totals.managers, 2);
  assert.equal(l.prior.captured, 2);
  assert.deepEqual(l.reps.map(r => r.rep), ['Rep 3', 'Rep 1', 'Rep 2']);
  assert.equal(l.byResourceType.find(r => r.label === 'Not recorded').assigned, 10);
  assert.deepEqual(l.heat.weeks, WEEKS.slice(-4));
  const gauteng = l.heat.regions.find(r => r.region === 'Gauteng');
  assert.equal(gauteng.cells[0], null); assert.equal(gauteng.cells[2].rate, 0.2); assert.equal(gauteng.cells[3].rate, 0.5);
});

test('action impact: the comparison ending on the week, or the latest before it; none before five weeks', () => {
  const x = dashboard({data, rows}).impact;
  assert.equal(x.available, true); assert.equal(x.targetWeek, '2026-10-18'); assert.equal(x.baselineWeek, '2026-09-20');
  assert.equal(x.totals.matchRate, 0.8); assert.equal(x.totals.salesImprovementRate, 0.5); assert.equal(x.totals.overstockReductionRate, 0.5); assert.equal(x.totals.negativeSohResolveRate, 1);
  assert.equal(x.byManager[0].label, 'Manager A');
  assert.equal(dashboard({data, week: '2026-10-11', rows}).impact.available, false);
  assert.deepEqual(dashboard({data, week: '2026-10-11', rows}).impact.targets, ['2026-10-18']);
});

test('no published weeks: an empty dashboard, not an error', () => {
  const d = dashboard({data: {weeks: [], summary: [], leaderboard: [], impact: []}});
  assert.equal(d.week, null); assert.equal(d.overview, null); assert.equal(d.impact.available, false);
});

test('store detail: filters, status, search, numbers and pages', () => {
  assert.deepEqual(cleanRowFilters({status: 'PENDING', q: ' Rosebank ', classification: 'Overstock'}), {classification: 'Overstock', status: 'pending', q: 'rosebank'});
  assert.equal(cleanRowFilters({status: 'bogus'}).status, '');
  const all = detail(rows, {}, cleanRowFilters({}));
  assert.equal(all.totalRows, 4); assert.deepEqual(all.options.classifications, ['Out of Stock', 'Overstock']);
  assert.equal(all.records[0].store, 'Checkers Umhlanga');
  assert.equal(all.records.find(r => r.store === 'PnP Sandton').storeSoh, null, 'text in a number column is left blank');
  assert.equal(all.records.find(r => r.article === 'Apple juice 1L').storeSoh, 12);
  assert.equal(detail(rows, {}, cleanRowFilters({status: 'pending'})).totalRows, 1);
  assert.equal(detail(rows, {}, cleanRowFilters({status: 'actioned'})).totalRows, 3);
  assert.equal(detail(rows, {}, cleanRowFilters({q: '700'})).totalRows, 1);
  assert.equal(detail(rows, {region: 'Gauteng'}, cleanRowFilters({classification: 'Out of Stock'})).totalRows, 0);
  const many = Array.from({length: 120}, (_, i) => task(`Store ${String(i).padStart(3, '0')}`));
  const p = detail(many, {}, cleanRowFilters({}), 3);
  assert.equal(p.pageCount, 3); assert.equal(p.page, 3); assert.equal(p.records.length, 20);
  assert.equal(detail(many, {}, cleanRowFilters({}), 99).page, 3);
});

test('week files: one task per line, only the kept fields, bad lines skipped', () => {
  const lines = [JSON.stringify({...task('A'), repEmail: 'rep@x.co.za', managerEmail: 'm@x.co.za', image1: 'https://img'}), 'not json', '', JSON.stringify(task('B', {feedback: ''}))].join('\n');
  const parsed = parseWeek(zlib.gzipSync(lines));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].store, 'A'); assert.equal(parsed[0].repEmail, undefined); assert.equal(parsed[0].image1, undefined);
  assert.equal('feedback' in parsed[1], false, 'empty values are dropped');
});

test('SharePoint source: lists the folder at most every five minutes and downloads a file again only when its eTag changes', async () => {
  let clock = 0;
  const calls = {list: 0, download: []};
  const etags = {'weeks_index.json': 'a', 'summary.json': 'a', 'week_2026-10-18.jsonl.gz': 'a'};
  const content = {'weeks_index.json': Buffer.from(JSON.stringify([{week: '2026-10-18'}])), 'summary.json': Buffer.from(JSON.stringify(summary)), 'week_2026-10-18.jsonl.gz': zlib.gzipSync(JSON.stringify(task('A')))};
  const item = name => ({id: name, name, eTag: etags[name], file: {}, lastModifiedDateTime: name === 'summary.json' ? '2026-10-19T04:00:00Z' : '2026-10-19T03:00:00Z'});
  const graph = {
    request: async path => (path.startsWith('/sites/meridiangroupza.sharepoint.com:') ? {id: 'site'} : {id: 'drive'}),
    all: async path => {
      calls.list++;
      assert.match(path, /^\/drives\/drive\/root:\/Stock%20Fix\/Reporting\/dashboard-data(\/weeks)?:\/children/);
      return path.includes('/weeks:') ? [item('week_2026-10-18.jsonl.gz')] : [item('weeks_index.json'), item('summary.json'), {name: 'sub', folder: {}}];
    },
    downloadItem: async (drive, id) => { calls.download.push(id); return content[id]; }
  };
  const source = sharePointStockFixSource({graph, now: () => clock});
  const first = await source.data();
  assert.deepEqual(first.weeks, [{week: '2026-10-18'}]); assert.deepEqual(first.leaderboard, [], 'a missing rollup is empty');
  assert.equal(first.updatedAt, '2026-10-19T04:00:00Z');
  assert.equal((await source.week('2026-10-18')).length, 1);
  assert.equal(await source.week('2026-10-25'), null);
  assert.equal(await source.week('../x'), null);
  await source.data();
  assert.equal(calls.list, 2, 'one listing of each folder'); assert.equal(calls.download.length, 3);
  clock += 6 * 60 * 1000;
  etags['summary.json'] = 'b';
  await source.data(); await source.week('2026-10-18');
  assert.equal(calls.list, 4); assert.deepEqual(calls.download.slice(3), ['summary.json'], 'only the changed file is downloaded again');
  assert.equal(sharePointStockFixSource({graph: null}), null);
});

test('SharePoint source: a missing folder is reported clearly', async () => {
  const notFound = Object.assign(new Error('Microsoft Graph 404'), {status: 404});
  const source = sharePointStockFixSource({graph: {request: async () => ({id: 'x'}), all: async () => { throw notFound; }, downloadItem: async () => Buffer.alloc(0)}});
  await assert.rejects(source.data(), e => e.code === 'not-found' && /dashboard-data/.test(e.message));
});

async function serve(t, {allowed = true, source = memoryStockFixSource({...data, rows: {'2026-10-18': rows}})} = {}) {
  const app = express();
  stockfixRoutes({source, allow: () => allowed})(app);
  app.use(errorHandler(() => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  return path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
}

test('routes: dashboard, store detail, Excel download, validation and access', async t => {
  const get = await serve(t);
  const d = await (await get('/api/stockfix?client=Clover')).json();
  assert.equal(d.week, '2026-10-18'); assert.equal(d.overview.totals.tasks, 10);
  assert.equal((await get('/api/stockfix?week=18-10-2026')).status, 400);
  assert.equal((await (await get('/api/stockfix?week=2026-10-11')).json()).overview.totals.stores, null, 'no week file: the other figures still load');
  const r = await (await get('/api/stockfix/rows?status=pending')).json();
  assert.equal(r.week, '2026-10-18'); assert.equal(r.totalRows, 1);
  assert.equal((await get('/api/stockfix/rows?week=2026-10-11')).status, 404);
  const x = await get('/api/stockfix/export?region=Gauteng');
  assert.match(x.headers.get('content-disposition'), /StockFix store tasks 2026-10-18 \(filtered\)\.xlsx/);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await x.arrayBuffer()));
  assert.equal(book.worksheets[0].rowCount, 4);   // header + the three Gauteng tasks
  const refused = await serve(t, {allowed: false});
  for (const path of ['/api/stockfix', '/api/stockfix/rows', '/api/stockfix/export']) assert.equal((await refused(path)).status, 403, path);
  const unconnected = await serve(t, {source: null});
  assert.equal((await unconnected('/api/stockfix')).status, 503);
});
