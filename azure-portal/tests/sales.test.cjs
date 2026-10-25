'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ExcelJS = require('exceljs');
const {dashboard, drilldown, cleanFilters, periodOffset} = require('../server/sales/report.cjs');
const {memorySalesStore, monthPrefix} = require('../server/sales/store.cjs');
const {salesRoutes, thisMonth} = require('../server/sales/routes.cjs');
const {errorHandler} = require('../server/errors.cjs');

const line = (periodKey, day, extra = {}) => ({periodKey, orderDate: `${periodKey}-${String(day).padStart(2, '0')}`, orderNumber: `O${periodKey}${day}`, storeName: 'Store A', storeCode: 'A', region: 'Gauteng', rep: 'Rep 1', manager: 'Manager 1', product: 'Yoghurt', sku: '100', status: 'Ordered', quantity: 1, value: 10, mapped: true, ...extra});
const october = [line('2026-10', 1, {value: 100, quantity: 4}), line('2026-10', 1, {orderNumber: 'O2026-101', product: 'Juice', sku: '200', value: 50}), line('2026-10', 3, {storeName: 'Store B', storeCode: 'B', region: 'Unmapped', mapped: false, rep: 'Rep 2', value: 30})];
const september = [line('2026-09', 2, {value: 60}), line('2026-09', 3, {value: 20}), line('2026-09', 20, {value: 500})];
const imports = [{id: 'i1', periodKey: '2026-10', createdAt: '2026-10-03T10:00:00Z', newRecords: 3, existingRecords: 0, sourceRows: 3, reconciliation: {reconciled: true, monthToDateValue: 180}, message: '3 new order lines added'}];

test('dashboard: Firebase-era measures, filter options and quality from the latest import', () => {
  const d = dashboard({period: '2026-10', rows: october, prior: september, imports});
  assert.equal(d.metrics.salesValue, 180); assert.equal(d.metrics.orderLines, 3); assert.equal(d.metrics.orders, 2);
  assert.equal(d.metrics.stores, 2); assert.equal(d.metrics.reps, 2); assert.equal(Math.round(d.metrics.mappedPercent), 67);
  assert.equal(d.metrics.missingRegionRows, 1); assert.equal(d.metrics.latestNewRecords, 3); assert.equal(d.metrics.reconciled, true);
  assert.deepEqual(d.filters.regions, ['Gauteng', 'Unmapped']);
  assert.deepEqual(d.charts.daily.map(x => x.label), ['2026-10-01', '2026-10-03']);
  assert.equal(d.charts.byProduct[0].label, 'Yoghurt');
  assert.deepEqual(d.unmapped.map(u => u.label), ['Store B']);
  assert.equal(d.recentOrders[0].orderDate, '2026-10-03');
  assert.equal(d.latestImport.message, '3 new order lines added');
});

test('a running month is compared with the same days of the previous month', () => {
  const d = dashboard({period: '2026-10', rows: october, prior: september, imports});
  assert.equal(d.comparedDays, 3);
  assert.equal(d.priorMetrics.salesValue, 80);   // 2 and 3 Sep, not the 500 on 20 Sep
  const full = dashboard({period: '2026-09', rows: september.concat(line('2026-09', 30)), prior: []});
  assert.equal(full.comparedDays, null); assert.equal(full.priorMetrics, null);
});

test('filters: only known keys, exact matches, and the options still list every value of the month', () => {
  assert.deepEqual(cleanFilters({region: ' Gauteng ', bogus: 'x', rep: ''}), {region: 'Gauteng'});
  const d = dashboard({period: '2026-10', rows: october, prior: september, filters: cleanFilters({rep: 'Rep 2'})});
  assert.equal(d.metrics.salesValue, 30); assert.deepEqual(d.filters.reps, ['Rep 1', 'Rep 2']);
});

test('drilldown: metric views and 25-line pages', () => {
  const many = Array.from({length: 60}, (_, i) => line('2026-10', 1 + (i % 28), {orderNumber: `N${i}`, quantity: i}));
  const units = drilldown('units', many, null, 3);
  assert.equal(units.title, 'Unit analysis'); assert.equal(units.page, 3); assert.equal(units.pageCount, 3); assert.equal(units.records.length, 10);
  assert.equal(drilldown('units', many, null, 1).records[0].quantity, 59);
  const mapped = drilldown('mapped', october, null, 1);
  assert.equal(mapped.records[0].mapped, false); assert.equal(mapped.primary.format, 'percent');
  assert.equal(drilldown('latest-import', october, imports[0], 99).page, 1);
});

test('months and ids', () => {
  assert.equal(periodOffset('2026-01', 1), '2025-12');
  assert.equal(monthPrefix('2026-10'), 'salesTransactions/202610-%');
  assert.equal(thisMonth(new Date('2026-10-31T22:30:00Z')), '2026-11');   // already 1 November in South Africa
});

async function serve(t, {admin = true, now} = {}) {
  const app = express();
  salesRoutes({store: memorySalesStore({rows: [...october, ...september], imports}), allow: () => admin, ...(now ? {now} : {})})(app);
  app.use(errorHandler(() => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  return path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
}

test('routes: newest month by default, drilldown, export and admin-only access', async t => {
  const get = await serve(t, {now: () => new Date('2026-12-05T10:00:00Z')});   // December has no lines yet
  const d = await (await get('/api/sales')).json();
  assert.equal(d.period, '2026-10'); assert.deepEqual(d.periods.map(p => p.period), ['2026-10', '2026-09']);
  assert.equal((await (await get('/api/sales?period=2026-10&region=Gauteng')).json()).metrics.salesValue, 150);
  assert.equal((await get('/api/sales?period=2026-1')).status, 400);
  assert.equal((await (await get('/api/sales/drilldown?period=2026-10&metric=reps')).json()).title, 'Rep performance');
  assert.equal((await get('/api/sales/drilldown?metric=nope')).status, 400);
  const x = await get('/api/sales/export?period=2026-10&rep=Rep%201');
  assert.match(x.headers.get('content-disposition'), /Sales dashboard 2026-10 \(filtered\)\.xlsx/);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await x.arrayBuffer()));
  assert.equal(book.worksheets[0].rowCount, 3);   // header + Rep 1's two lines
  const refused = await serve(t, {admin: false});
  for (const path of ['/api/sales', '/api/sales/drilldown', '/api/sales/export']) assert.equal((await refused(path)).status, 403, path);
});
