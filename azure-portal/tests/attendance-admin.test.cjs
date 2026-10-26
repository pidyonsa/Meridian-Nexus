'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const {memoryFirestore, memoryStorage} = require('./helpers/memory-firestore.cjs');
const {people} = require('../server/google/people.cjs');
const {exclusionService, rule} = require('../server/attendance/exclusions.cjs');
const {geoAttendanceService, inspectTracker, parseStoreMaster, shareId, TRACKER_TABS} = require('../server/attendance/geo.cjs');
const {inventoryService} = require('../server/attendance/inventory.cjs');

const admin = {email: 'jpinto@meridiangroup.co.za', name: 'Jeorge Pinto'};
const seed = extra => memoryFirestore({'adminUsers/uid-jp': {email: 'jpinto@meridiangroup.co.za'}, ...extra});
async function workbook(sheets) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) { const s = book.addWorksheet(name); for (const r of rows) s.addRow(r); }
  return Buffer.from(await book.xlsx.writeBuffer());
}

test('exclusion rules keep the Firebase ids and checks', () => {
  const a = rule({name: '  Thabo  Mokoena ', type: 'person', audience: 'rep'});
  assert.equal(a.name, 'Thabo Mokoena'); assert.equal(a.id.length, 32);
  assert.equal(rule({name: 'THABO MOKOENA', audience: 'rep'}).id, a.id, 'same person, same id, whatever the case');
  assert.throws(() => rule({name: 'Boss', type: 'manager', userCode: 'X1'}), /manager name/);
  assert.throws(() => rule({name: 'x', audience: 'everyone'}), /type or audience/);
});

test('exclusions: preview shows who matches, commit needs that preview, revisions guard concurrent edits', async () => {
  const fs = seed({'geoRepAttendanceDashboard/current': {rows: [{userName: 'Thabo Mokoena', userCode: 'R12', manager: 'Lerato Dlamini'}, {userName: 'Sipho Nkosi', manager: 'Lerato Dlamini'}]}});
  const service = exclusionService({fs, actorOf: people(fs)});
  const p = await service.preview(admin, {entries: [{name: 'Lerato Dlamini', type: 'manager', audience: 'rep', reason: 'Team on project work'}]});
  assert.equal(p.adding, 1); assert.equal(p.review[0].matchedPeople, 2);
  await assert.rejects(service.change(admin, 'commit', {entries: p.entries, reviewId: 'forged', revision: 0}), /Preview these exclusions/);
  const saved = await service.change(admin, 'commit', {entries: p.entries, reviewId: p.reviewId, revision: 0});
  assert.equal(saved.revision, 1); assert.equal(saved.changed, 1); assert.equal(saved.history.length, 1);
  assert.deepEqual(fs.docs.get('geoRepAttendanceConfig/current').dashboardExclusions.updatedBy, {uid: 'uid-jp', name: 'Jeorge Pinto', email: 'jpinto@meridiangroup.co.za'});
  await assert.rejects(service.change(admin, 'remove', {id: p.entries[0].id, revision: 0}), /changed the list/);
  assert.equal((await service.change(admin, 'setEnabled', {id: p.entries[0].id, enabled: false, revision: 1})).entries[0].enabled, false);
  assert.equal((await service.change(admin, 'remove', {id: p.entries[0].id, revision: 2})).entries.length, 0);
});

test('exclusions: the Excel template imports back; formulas and wrong headers are refused', async () => {
  const fs = seed({});
  const service = exclusionService({fs, actorOf: people(fs)});
  const template = await service.template();
  const book = new ExcelJS.Workbook(); await book.xlsx.load(template.data);
  book.worksheets[0].addRow(['Sipho Nkosi', 'person', 'merchandiser', '', 'Left the company']);
  const p = await service.preview(admin, {workbook: Buffer.from(await book.xlsx.writeBuffer()).toString('base64')});
  assert.equal(p.entries[0].name, 'Sipho Nkosi'); assert.equal(p.entries[0].audience, 'merchandiser'); assert.equal(p.unmatched, 1);
  await assert.rejects(service.preview(admin, {workbook: (await workbook({S: [['Who', 'Why'], ['a', 'b']]})).toString('base64')}), /template headers/);
  await assert.rejects(service.preview(admin, {workbook: 'not base64!'}), /under 1 MB/);
});

test('tracker workbook: both raw tabs with every column, header anywhere in rows 1-5', async () => {
  // The first non-empty row is the header (a title row above it would be read as the header, as in Firebase).
  const ok = await workbook({'Strike rate': [[], TRACKER_TABS['Strike rate'].map(h => (h === 'Schedule Count (On Calander)' ? 'Schedule count (on calendar)' : h)), ['row']], Schedules: [TRACKER_TABS.Schedules]});
  assert.deepEqual((await inspectTracker(ok)).tabs, {'Strike rate': {headerRow: 2, existingRows: 1}, Schedules: {headerRow: 1, existingRows: 0}});
  await assert.rejects(inspectTracker(await workbook({'Strike rate': [TRACKER_TABS['Strike rate']]})), /missing the required Schedules tab/);
  await assert.rejects(inspectTracker(await workbook({'Strike rate': [TRACKER_TABS['Strike rate'].slice(1)], Schedules: [TRACKER_TABS.Schedules]})), /missing: User Name/);
});

test('store master: best header row wins; rows without a region are left out; saving records the checksum', async () => {
  const bytes = await workbook({Notes: [['Read me']], 'Call Cycle Master': [['National store master'], ['Geo Rep Store Code', 'Store Name', 'Region', 'Banner'], ['S1', 'Spar Rosebank', 'Gauteng', 'SPAR'], ['S2', 'Spar Umhlanga', '', 'SPAR'], ['', 'PnP Hyde Park', 'Gauteng', 'PnP']]});
  const parsed = await parseStoreMaster(bytes);
  assert.equal(parsed.sheetName, 'Call Cycle Master'); assert.equal(parsed.entries.length, 2); assert.equal(parsed.excludedRows, 1);
  await assert.rejects(parseStoreMaster(await workbook({S: [['Name', 'Code']]})), /Region column/);
  const fs = seed({}), storage = memoryStorage();
  const service = geoAttendanceService({fs, storage, graph: null, actorOf: people(fs)});
  const r = await service.saveStoreMaster(admin, {name: 'Attendance Store Master', fileName: 'Store master.xlsx', data: bytes});
  const doc = fs.docs.get('attendanceStoreMasters/geo-rep-attendance-store-master');
  assert.equal(r.storeCount, 2); assert.equal(doc.sha256, crypto.createHash('sha256').update(bytes).digest('hex')); assert.ok(storage.objects.has(doc.storagePath));
  assert.equal(fs.docs.get('geoRepAttendanceConfig/current').storeMasterId, 'geo-rep-attendance-store-master');
  await assert.rejects(service.saveStoreMaster(admin, {name: 'x', fileName: 'x.csv', data: bytes}), /\.xlsx/);
  await assert.rejects(service.saveWeek(admin, {operationalWeek: 5}), /week 1, 2, 3, or 4/);
  assert.equal((await service.saveWeek(admin, {operationalWeek: '3'})).operationalWeek, 3);
});

test('tracker link: Meridian SharePoint only, resolved through Graph, saved with its tabs', async () => {
  const fs = seed({});
  const book = await workbook({'Strike rate': [TRACKER_TABS['Strike rate']], Schedules: [TRACKER_TABS.Schedules]});
  const calls = [];
  const graph = {request: async path => { calls.push(path); return {id: 'item1', name: 'Rep TNA.xlsx', file: {}, parentReference: {driveId: 'drive1'}, webUrl: 'https://meridiangroupza.sharepoint.com/x', size: book.length}; }, downloadItem: async () => book};
  const service = geoAttendanceService({fs, storage: memoryStorage(), graph, actorOf: people(fs)});
  await assert.rejects(service.saveTracker(admin, {sharePointUrl: 'https://evil.example/x.xlsx'}), /Meridian Group SharePoint/);
  const url = 'https://meridiangroupza.sharepoint.com/:x:/s/MeridianNexus/abc';
  const {tracker} = await service.saveTracker(admin, {sharePointUrl: url});
  assert.equal(tracker.driveId, 'drive1'); assert.equal(tracker.tabs.Schedules.headerRow, 1);
  assert.ok(calls[0].includes(encodeURIComponent(shareId(url))));
  assert.equal(fs.docs.get('geoRepAttendanceConfig/current').tracker.sourceUrl, url);
});

test('SharePoint inventory: walks each root within its depth, skips high-volume folders, records tracks and items', async () => {
  const fs = seed({});
  const tree = {
    root: [{id: 'portal', name: 'Portal', folder: {}}], portal: [{id: 'idx', name: 'index.html', file: {}, webUrl: 'https://sp/index.html'}, {id: 'nm', name: 'node_modules', folder: {}}],
    cc: [{id: 'h', name: 'hierarchy.json', file: {}}, {id: 'data', name: 'dashboard-data', folder: {}}], data: [{id: 'd1', name: 'week.jsonl', file: {}}]
  };
  const graph = {
    request: async path => {
      if (path.startsWith('/sites/')) return path.includes('/drive') ? {id: 'drive1', name: 'Documents'} : {id: 'site1', webUrl: 'https://meridiangroupza.sharepoint.com/sites/MeridianNexus'};
      if (path.includes('/root?')) return {id: 'root', name: 'root', folder: {}};
      if (path.includes('root:/Portal?')) return {id: 'portal', name: 'Portal', folder: {}};
      if (path.includes('root:/Call%20Cycle%20Coverage?')) return {id: 'cc', name: 'Call Cycle Coverage', folder: {}};
      throw Object.assign(new Error('Microsoft Graph 404'), {status: 404});
    },
    all: async path => tree[path.match(/items\/([^/]+)\/children/)[1]] || []
  };
  const service = inventoryService({fs, graph, actorOf: people(fs), now: () => Date.parse('2026-10-26T08:00:00Z')});
  const r = await service.scan(admin, {});
  const current = fs.docs.get('sharePointIntegrationInventory/current');
  const portal = current.integrationTracks.find(t => t.key === 'portal');
  assert.equal(portal.status, 'read-only-linked');
  assert.equal(current.integrationTracks.find(t => t.key === 'sales-insights').status, 'missing');
  assert.equal(current.integrationTracks.find(t => t.key === 'call-cycle-coverage').status, 'partial');
  const items = [...fs.docs].filter(([k]) => k.startsWith('sharePointIntegrationInventory/current/items/')).map(([, v]) => v);
  assert.ok(items.some(i => i.name === 'node_modules' && i.scanSkippedReason));
  assert.equal(items.find(i => i.name === 'week.jsonl').category, 'output-data');
  assert.equal(items.find(i => i.name === 'hierarchy.json').category, 'config-data');
  assert.equal(fs.docs.get(`sharePointIntegrationScans/${r.scanId}`).status, 'completed');
  assert.equal(fs.docs.get('legacyModuleContracts/portal').sourceSystem, 'SharePoint');
  fs.docs.set('sharePointIntegrationScans/other', {status: 'running', startedAt: '2026-10-26T07:55:00Z'});
  await assert.rejects(service.scan(admin, {}), /already running/);
  const o = await service.overview(500);
  assert.equal(o.items.length, items.length); assert.equal(o.current.scanId, r.scanId);
});
