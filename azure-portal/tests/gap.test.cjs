'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const {parseWorkbook, summarise, weekOf} = require('../server/gap/parse.cjs');
const {compare} = require('../server/gap/report.cjs');
const {memoryGapStore} = require('../server/gap/store.cjs');
const {gapRoutes} = require('../server/gap/routes.cjs');
const {createApp} = require('../server/main.cjs');
const {MERIDIAN_TENANT} = require('../server/auth.cjs');

// A small workbook shaped like the client's: three banner sheets, header rows at different heights, weeks stacked.
async function workbook({repeatWeek = false} = {}) {
  const wb = new ExcelJS.Workbook();
  const dc = wb.addWorksheet('Dis-Chem Gap Matrix');
  dc.addRows([[], [], [], [], ['Date', 'Store', 'Region', 'JUICE A', 'JUICE B']]);
  dc.addRows([
    ['31.08.2026', 'Dis-Chem One', 'Gauteng', 'Opportunity', 'No gap'],
    ['31.08.2026', 'Dis-Chem Two', '#N/A', 'Lost', 'No gap'],
    ['31.08.2026', 'Dis-Chem Gone', 'Gauteng', 'No gap', 'No gap'],
    ['09.09.2026', 'Dis-Chem  one', 'Gauteng', 'No gap', 'Lost'],   // spacing/case change: same store
    ['09.09.2026', 'Dis-Chem Two', '#N/A', 'No gap', 'No gap'],
    ['09.09.2026', 'Dis-Chem New', 'Gauteng', 'Opportunity', 'Opportunity']
  ]);
  const pnp = wb.addWorksheet('PnP Family Gap Tracker');
  pnp.addRows([[null, 'PNP FAMILY GAP TRACKER - 500ML'], [], ['Date', 'Store', ' GREEN 500ML ', 'MANGO 500ML']]);
  pnp.addRows([['31.08.2026', 'Family Azaleapark', 'No gap', 'Opportunity'], ['09.09.2026', 'Family Azaleapark', repeatWeek ? 'No gap' : 'Lost', repeatWeek ? 'Opportunity' : 'No gap']]);
  const flm = wb.addWorksheet('FLM Gap Tracker');
  flm.addRows([[], [], ['Date', 'Store', 'Region', 'APPLE 1.5LT', 'GUAVA 1.5L', 'APPLE 1.5LT']]);
  flm.addRows([['31.08.2026', 'Flm The Reef', 'JHB', 'Opportunity', null, 'No gap'], ['09.09.2026', 'Flm The Reef', 'JHB', 'No gap', 'Lost', null]]);
  wb.addWorksheet('Notes').addRow(['ignore me']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('dates in the client\'s formats become ISO weeks; nonsense is rejected', () => {
  assert.equal(weekOf('31.08.2026'), '2026-08-31'); assert.equal(weekOf('9/9/2026'), '2026-09-09'); assert.equal(weekOf('2026-10-15'), '2026-10-15');
  assert.equal(weekOf(new Date(Date.UTC(2026, 9, 15))), '2026-10-15'); assert.equal(weekOf(46310), '2026-10-15');
  assert.equal(weekOf('31.02.2026'), null); assert.equal(weekOf('soon'), null);
});

test('parses every banner sheet, normalises names and flags what needs a human look', async () => {
  const parsed = await parseWorkbook(await workbook());
  const s = summarise(parsed);
  assert.deepEqual(s.banners.map(b => b.banner), ['Dis-Chem', 'PnP Family', "Food Lover's Market"]);
  const dc = parsed.banners[0];
  assert.equal(dc.weeks.get('2026-09-09').get('dis-chem one').store, 'Dis-Chem one');
  assert.equal(dc.weeks.get('2026-08-31').get('dis-chem two').region, null);
  assert.deepEqual(parsed.banners[1].products, ['GREEN 500ML', 'MANGO 500ML']);
  assert.deepEqual(parsed.banners[2].products, ['APPLE 1.5LT', 'GUAVA 1.5L', 'APPLE 1.5LT (column F)']);
  assert.ok(s.warnings.some(w => /appears twice; column F/.test(w)));
  assert.ok(s.warnings.some(w => /no region \(#N\/A\)/.test(w)));
  assert.ok(s.warnings.some(w => /"Notes" was ignored/.test(w)));
  assert.equal(parsed.banners[2].blanks, 2);
});

test('a week that repeats the previous one is flagged', async () => {
  const s = summarise(await parseWorkbook(await workbook({repeatWeek: true})));
  assert.ok(s.warnings.some(w => /PnP Family: week 2026-09-09 is identical to 2026-08-31/.test(w)));
});

test('bad files are refused with a clear reason', async () => {
  await assert.rejects(parseWorkbook(Buffer.from('not a workbook')), /not an Excel/);
  const wb = new ExcelJS.Workbook(); wb.addWorksheet('Sheet1').addRow(['x']);
  await assert.rejects(parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())), /No sheet with a Date \/ Store/);
});

test('detail: distribution, change, persistent gaps and concentration', () => {
  const {detail} = require('../server/gap/report.cjs');
  const row = (week, store, product, status, region = 'G') => ({banner: 'B', week, store_key: store.toLowerCase(), store, region, product, status});
  const history = [row('w1', 'A', 'p', 'O'), row('w2', 'A', 'p', 'O'), row('w3', 'A', 'p', 'L'), row('w1', 'B', 'p', 'L'), row('w2', 'B', 'p', 'N'), row('w3', 'B', 'p', 'O'), row('w3', 'C', 'p', 'N'), row('w2', 'C', 'p', 'N')];
  const d = detail({rows: history.filter(r => r.week === 'w3'), prevRows: history.filter(r => r.week === 'w2'), history, weeks: ['w1', 'w2', 'w3']});
  assert.equal(d.summary.distribution, 1 / 3); assert.equal(d.summary.previous, 2 / 3);
  assert.deepEqual(d.persistent.map(p => [p.store, p.weeks, p.always]), [['A', 3, true]]);   // B reopened after a no-gap week
  assert.equal(d.summary.fullyRanged, 1); assert.equal(d.summary.concentration.topStores, 1);
});

test('rates: conversion, recovery and loss over what was compared', () => {
  const {rates} = require('../server/gap/report.cjs');
  const r = rates({N: {N: 8, O: 1, L: 1}, O: {N: 3, O: 1, L: 0}, L: {N: 1, O: 0, L: 1}}, 16);
  assert.equal(r.conversion, 3 / 4); assert.equal(r.recovery, 1 / 2); assert.equal(r.loss, 1 / 10); assert.equal(r.distributionBefore, 10 / 16); assert.equal(r.distributionAfter, 12 / 16);
});

test('clients: list, add (admins only, no duplicates); other sheets become banners; colours are kept', () => serve(async (base, store) => {
  const admin = {'x-ms-client-principal': principal(['Nexus.Admin']), 'content-type': 'application/json'};
  const staff = {'x-ms-client-principal': principal(['Nexus.Reader']), 'content-type': 'application/json'};
  assert.deepEqual((await (await fetch(`${base}/api/gaps`, {headers: staff})).json()).clients.map(c => c.id), ['sir-fruit']);
  assert.equal((await fetch(`${base}/api/gaps/clients`, {method: 'POST', headers: staff, body: JSON.stringify({label: 'Acme Juice'})})).status, 403);
  const made = await (await fetch(`${base}/api/gaps/clients`, {method: 'POST', headers: admin, body: JSON.stringify({label: 'Acme Juice'})})).json();
  assert.equal(made.id, 'acme-juice');
  assert.equal((await fetch(`${base}/api/gaps/clients`, {method: 'POST', headers: admin, body: JSON.stringify({label: 'ACME juice'})})).status, 409);
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Spar Gap Tracker');
  ws.addRows([['Date', 'Store', 'JUICE'], ['31.08.2026', 'Spar One', 'No gap'], ['09.09.2026', 'Spar One', 'Lost']]);
  ws.getCell('C2').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF00A650'}};
  ws.getCell('C3').fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFC00000'}};
  const body = JSON.stringify({fileName: 'acme.xlsx', data: Buffer.from(await wb.xlsx.writeBuffer()).toString('base64')});
  const saved = await (await fetch(`${base}/api/gaps/acme-juice/upload`, {method: 'POST', headers: admin, body})).json();
  assert.deepEqual(saved.banners.map(b => b.banner), ['Spar']);
  const overview = await (await fetch(`${base}/api/gaps/acme-juice`, {headers: staff})).json();
  assert.deepEqual(overview.colors, {N: '#00A650', L: '#C00000'}); assert.equal(overview.label, 'Acme Juice');
  assert.equal((await fetch(`${base}/api/gaps/nobody`, {headers: staff})).status, 404);
}));

test('movements: only pairs in both weeks count; the three tracked moves and net are right', () => {
  const r = compare([
    {store: 'A', product: 'p', from_status: 'O', to_status: 'N'}, {store: 'B', product: 'p', from_status: 'L', to_status: 'N'},
    {store: 'C', product: 'p', from_status: 'N', to_status: 'L'}, {store: 'D', product: 'p', from_status: 'N', to_status: 'N'},
    {store: 'E', product: 'p', from_status: 'O', to_status: 'L'}
  ], [{kind: 'new', store: 'F'}, {kind: 'missing', store: 'G'}]);
  assert.deepEqual([r.metrics.converted, r.metrics.recovered, r.metrics.lost, r.metrics.slipped, r.metrics.net], [1, 1, 1, 1, 1]);
  assert.equal(r.compared, 5); assert.equal(r.changes.length, 4);
  assert.deepEqual(r.coverage, {newStores: ['F'], missingStores: ['G']});
});

const principal = roles => Buffer.from(JSON.stringify({auth_typ: 'aad', role_typ: 'roles', claims: [{typ: 'tid', val: MERIDIAN_TENANT}, {typ: 'oid', val: '11111111-2222-3333-4444-555555555555'}, {typ: 'preferred_username', val: 'shonesa@meridiangroup.co.za'}, ...roles.map(val => ({typ: 'roles', val}))]})).toString('base64');

async function serve(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html>');
  const store = memoryGapStore();
  const server = createApp({publicDir: dir, env: {}, log: {error() {}}, api: [gapRoutes({store, allow: (req, kind) => kind === 'view' || req.user.admin, who: req => req.user.email})]}).listen(0);
  try { return await fn(`http://127.0.0.1:${server.address().port}`, store); } finally { server.close(); }
}

test('upload flow: preview, save, overview, compare, export; staff cannot upload', () => serve(async base => {
  const admin = {'x-ms-client-principal': principal(['Nexus.Admin']), 'content-type': 'application/json'};
  const staff = {'x-ms-client-principal': principal(['Nexus.Reader']), 'content-type': 'application/json'};
  const body = JSON.stringify({fileName: 'SIR FRUIT - GAP REPORT.xlsx', data: (await workbook()).toString('base64')});
  assert.equal((await fetch(`${base}/api/gaps/sir-fruit/preview`, {method: 'POST', headers: staff, body})).status, 403);
  assert.equal((await fetch(`${base}/api/gaps/sir-fruit/preview`, {method: 'POST', headers: {...admin, origin: 'https://evil.example'}, body})).status, 403);
  const preview = await (await fetch(`${base}/api/gaps/sir-fruit/preview`, {method: 'POST', headers: admin, body})).json();
  assert.ok(preview.banners.every(b => b.weeks.every(w => w.action === 'new')));
  const saved = await (await fetch(`${base}/api/gaps/sir-fruit/upload`, {method: 'POST', headers: admin, body})).json();
  assert.equal(saved.uploadId, 1);
  // The same file again replaces, never doubles.
  const again = await (await fetch(`${base}/api/gaps/sir-fruit/upload`, {method: 'POST', headers: admin, body})).json();
  assert.ok(again.banners.every(b => b.weeks.every(w => w.action === 'replace'))); assert.equal(again.rows, saved.rows);

  const overview = await (await fetch(`${base}/api/gaps/sir-fruit`, {headers: admin})).json();
  const dc = overview.banners.find(b => b.banner === 'Dis-Chem');
  assert.equal(dc.weeks.length, 2); assert.equal(dc.weeks[0].stores, 3);
  assert.deepEqual([dc.steps[0].converted, dc.steps[0].recovered, dc.steps[0].lost], [1, 1, 1]);

  const r = await (await fetch(`${base}/api/gaps/sir-fruit/compare?banner=Dis-Chem&from=2026-08-31&to=2026-09-09`, {headers: admin})).json();
  assert.equal(r.compared, 4); assert.deepEqual(r.coverage, {newStores: ['Dis-Chem New'], missingStores: ['Dis-Chem Gone']});
  const all = await (await fetch(`${base}/api/gaps/sir-fruit/compare?banner=all&from=2026-08-31&to=2026-09-09`, {headers: admin})).json();
  // Dis-Chem 1/1/1, PnP: N->L lost, O->N converted, FLM: O->N converted (blank and missing cells never compared).
  assert.deepEqual([all.metrics.converted, all.metrics.recovered, all.metrics.lost], [3, 1, 2]);
  assert.equal((await fetch(`${base}/api/gaps/sir-fruit/compare?banner=all&from=2026-09-09&to=2026-08-31`, {headers: admin})).status, 400);
  const xlsx = await fetch(`${base}/api/gaps/sir-fruit/export?banner=all&from=2026-08-31&to=2026-09-09`, {headers: admin});
  assert.match(xlsx.headers.get('content-type'), /spreadsheetml/);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Summary', 'Changes', 'Store coverage']);
  assert.equal(wb.getWorksheet('Changes').rowCount, 1 + all.changesTotal);
  assert.equal((await fetch(`${base}/api/gaps/unknown`, {headers: admin})).status, 404);
  // Staff view and export, but never see the upload history.
  assert.equal((await fetch(`${base}/api/gaps/sir-fruit/compare?banner=all&from=2026-08-31&to=2026-09-09`, {headers: staff})).status, 200);
  assert.equal((await fetch(`${base}/api/gaps/sir-fruit/uploads`, {headers: staff})).status, 403);
  // Week in depth: product / region / store distribution, heatmap and persistence.
  const d = await (await fetch(`${base}/api/gaps/sir-fruit/detail?banner=Dis-Chem&week=2026-09-09`, {headers: staff})).json();
  assert.equal(d.previousWeek, '2026-08-31'); assert.equal(d.summary.stores, 3);
  assert.ok(d.products.every(p => p.distribution >= 0 && p.distribution <= 1));
  assert.deepEqual(d.heatmap.columns.sort(), ['Gauteng', 'Not given']);
  // Workbooks over the 1 MB API limit still upload (padding past the end of the zip is ignored by Excel readers).
  const big = Buffer.concat([await workbook(), Buffer.alloc(1.5 * 1024 * 1024)]);
  const res = await fetch(`${base}/api/gaps/sir-fruit/preview`, {method: 'POST', headers: admin, body: JSON.stringify({fileName: 'big.xlsx', data: big.toString('base64')})});
  assert.notEqual(res.status, 413);
}));
