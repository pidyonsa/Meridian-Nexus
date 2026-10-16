'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), zlib = require('node:zlib');
const {publishOrders, mergeOrders, checkOrders, chunkIds} = require('../attendance-publisher/orders.cjs');
const {unpackSnapshot} = require('../attendance-publisher/core.cjs');
const {hash} = require('../server/snapshot-data.cjs');
const now = () => new Date('2026-10-01T06:30:00Z');
const OLD = 'a'.repeat(64), NEW = 'b'.repeat(64);
function workbook(text) { const bytes = Buffer.from(text); return {size:bytes.length, sha256:hash(bytes), base64:bytes.toString('base64')}; }
function fixture() {
  const documents = {};
  for (const id of ['current','merchandisers']) documents['geoRepAttendanceDashboard/' + id] = {
    reportStartDate:'2026-09-01', reportEndDate:'2026-09-29', rows:[{userCode:'synthetic'}], source:{schedules:{fileId:'att'}}
  };
  documents['files/att'] = {storagePath:'uploads/att.xlsx'};
  documents['publicDashboardSources/orders'] = {version:OLD, rowCount:1, period:'2026-09', importedAt:'2026-09-21T04:01:18Z', range:{startDate:'2026-09-01', endDate:'2026-09-20'}};
  documents['publicDashboardOrderImports/' + OLD + '/chunks/0000'] = {rows:[{quantity:1, value:1}]};
  documents['salesTransactions/old'] = {periodKey:'2026-08', value:3};
  documents['portalResources/geo-product-order-master'] = {storagePath:'portal-resources/geo-product-order-master/m.xlsx', sha256:workbook('master').sha256};
  const baseline = {schema:1, capturedAt:'2026-09-30T11:43:00.000Z', documents, sourceUpdates:{},
    files:{'uploads/att.xlsx':workbook('attendance'), 'portal-resources/geo-product-order-master/m.xlsx':workbook('master')}};
  const source = {documents:{
    'publicDashboardSources/orders':{version:NEW, rowCount:201, period:'2026-09', importedAt:'2026-09-29T04:01:21Z', range:{startDate:'2026-09-01', endDate:'2026-09-29'}},
    ['publicDashboardOrderImports/' + NEW + '/chunks/0000']:{rows:Array.from({length:200}, () => ({quantity:1}))},
    ['publicDashboardOrderImports/' + NEW + '/chunks/0001']:{rows:[{quantity:2}]},
    'salesTransactions/new':{periodKey:'2026-09', value:5},
    'portalResources/geo-product-order-master':documents['portalResources/geo-product-order-master']
  }, versions:{'publicDashboardSources/orders':'v2'}, files:{'portal-resources/geo-product-order-master/m.xlsx':baseline.files['portal-resources/geo-product-order-master/m.xlsx']}};
  return {baseline, source};
}
function harness() {
  const {baseline, source} = fixture(), bytes = zlib.gzipSync(JSON.stringify(baseline)), sha256 = hash(bytes);
  const pointer = {schema:1, blob:'snapshots/' + sha256 + '.json.gz', sha256, bytes:bytes.length, capturedAt:baseline.capturedAt, attendanceSourceVersion:'keep', attendanceThrough:'2026-09-29'};
  const stored = new Map([[pointer.blob, bytes], ['current.json', Buffer.from(JSON.stringify(pointer))]]), writes = [];
  let etag = 'initial', changed = false;
  const dependencies = {
    now,
    source:{fingerprint:async() => ({'publicDashboardSources/orders':'v2'}), load:async() => structuredClone(source), verify:async() => { if (changed) throw Error('Orders source changed'); }},
    verifyReports:async() => ({through:'2026-09-29', lines:201}),
    blobs:{read:async name => ({bytes:stored.get(name), etag}), write:async(name, data, condition) => {
      if (name === 'current.json') { if (condition['If-Match'] !== etag) throw Error('412 conflict'); etag = 'next'; }
      else assert.equal(condition['If-None-Match'], '*');
      writes.push(name); stored.set(name, data);
    }}
  };
  return {baseline, pointer, stored, writes, dependencies, setChanged:() => { changed = true; }, setEtag:value => { etag = value; }};
}
test('chunk ids follow the refresher 200-row layout', () => {
  assert.deepEqual(chunkIds(1), ['0000']); assert.deepEqual(chunkIds(200), ['0000']); assert.deepEqual(chunkIds(201), ['0000','0001']);
});
test('replaces Orders inputs only and keeps Attendance byte-identical', () => {
  const {baseline, source} = fixture(), next = mergeOrders(baseline, source, now());
  assert.equal(next.documents['publicDashboardSources/orders'].version, NEW);
  assert.equal(next.documents['publicDashboardOrderImports/' + OLD + '/chunks/0000'], undefined);
  assert.equal(next.documents['salesTransactions/old'], undefined); assert.ok(next.documents['salesTransactions/new']);
  for (const key of ['geoRepAttendanceDashboard/current','geoRepAttendanceDashboard/merchandisers','files/att']) assert.deepEqual(next.documents[key], baseline.documents[key]);
  assert.equal(next.files['uploads/att.xlsx'].sha256, baseline.files['uploads/att.xlsx'].sha256);
});
test('rejects incomplete chunks, backwards imports and non-Orders documents', () => {
  let f = fixture(); f.source.documents['publicDashboardSources/orders'].rowCount = 202; assert.throws(() => checkOrders(f.source), /chunks/);
  f = fixture(); f.source.documents['publicDashboardSources/orders'].range.endDate = '2026-09-19'; assert.throws(() => mergeOrders(f.baseline, f.source, now()), /backwards/);
  f = fixture(); f.source.documents['geoRepAttendanceDashboard/current'] = {}; assert.throws(() => checkOrders(f.source), /Unexpected/);
  f = fixture(); f.source.documents['publicDashboardSources/orders'].period = '2026-08'; assert.throws(() => checkOrders(f.source), /Incomplete Orders source/);
});
test('publishes once, keeps Attendance pointer fields, then reports unchanged', async () => {
  const h = harness(), result = await publishOrders(h.dependencies);
  assert.equal(result.status, 'published'); assert.deepEqual(h.writes.slice(-1), ['current.json']);
  const pointer = JSON.parse(h.stored.get('current.json'));
  assert.equal(pointer.attendanceSourceVersion, 'keep'); assert.equal(pointer.ordersThrough, '2026-09-29');
  assert.equal(unpackSnapshot(pointer, h.stored.get(pointer.blob)).documents['publicDashboardSources/orders'].version, NEW);
  const writes = h.writes.length;
  assert.equal((await publishOrders(h.dependencies)).status, 'unchanged'); assert.equal(h.writes.length, writes);
});
test('source changes, failed reconciliation and competing publishers never replace the pointer', async () => {
  for (const failure of ['source', 'report', 'conflict']) {
    const h = harness(), before = h.stored.get('current.json');
    if (failure === 'source') h.setChanged();
    else if (failure === 'report') h.dependencies.verifyReports = async() => { throw Error('Orders report reconciliation failed'); };
    else { const write = h.dependencies.blobs.write; h.dependencies.blobs.write = async(name, data, condition) => { if (name === 'current.json') h.setEtag('other'); return write(name, data, condition); }; }
    await assert.rejects(publishOrders(h.dependencies)); assert.deepEqual(h.stored.get('current.json'), before);
  }
});
