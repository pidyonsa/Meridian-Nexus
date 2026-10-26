'use strict';
// Geo attendance admin on Azure: the Rep TNA tracker link, the Geo Rep operational week and the Attendance Store
// Master, as the Firebase-era saveGeoRepAttendanceTracker / saveGeoRepAttendanceOperationalWeek /
// saveGeoRepAttendanceStoreMaster did (functions/index.js, read 26 October 2026), on the same geoRepAttendanceConfig
// and attendanceStoreMasters documents the tracker job and the Azure attendance publisher read.
// Differences: saving a store master also records its sha256 and Storage generation (the publisher checks the file
// against them; Firebase left the old hash in place). The manual store-coverage rebuild is not carried over: the daily
// tracker job rebuilds coverage, nothing displays it, and the Firebase version failed partway through.
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');
const {SERVER_TIME} = require('../google/firestore.cjs');

const CONFIG = 'geoRepAttendanceConfig/current';
const DEFAULT_MASTER = 'geo-rep-attendance-store-master';
const DEFAULT_TRACKER = 'https://meridiangroupza.sharepoint.com/:x:/s/MeridianNexus/IQCaanuLoEUbRrSEtCLJa7cmAUgzsqqXCy8y9AYjHM_osUg?e=yeGhnf';
const ATTENDANCE_PROFILE = 'geo-rep-attendance-for-reps';
const MAX_BYTES = 25 * 1024 * 1024;
// The raw-data tabs the tracker job writes into, and the columns each must have (geoRepAttendanceRawTabContracts).
const TRACKER_TABS = {
  'Strike rate': ['User Name', 'User Code', 'Manager', 'Role', 'User Code2', 'Assigned Region(s)', 'Schedule Count (On Calander)', 'On Leave Schedules', 'Schedule Count (w/o Leave)', 'On Schedule Checkins', 'Strike Rate',
    'Total Checkins (include additional visits)', 'Additional Visits', 'All Forms', 'Unique Visit Forms', 'Orders', 'Returns', 'Division', 'Users Combined Check'],
  Schedules: ['Schedule Date', 'Rep Name', 'User Code', 'Manager', 'Role', 'User Code2', 'Assigned Region(s)', 'Customer Name', 'Result', 'Division', 'GeoRep Week', 'Feedback']
};
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const required = (v, name, max) => { const t = String(v ?? '').trim(); if (!t || t.length > max) throw new AppError('invalid-argument', `${name} is required.`); return t; };
const iso = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const canonical = v => { const k = String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); return k === 'SCHEDULECOUNTONCALENDAR' || k === 'SCHEDULECOUNTONCALENDER' ? 'SCHEDULECOUNTONCALANDER' : k; };
const shareId = url => `u!${Buffer.from(url.trim(), 'utf8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

// The tracker workbook must have both raw tabs with every contract column in a header row within rows 1-5.
async function inspectTracker(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const tabs = {};
  for (const [tab, headers] of Object.entries(TRACKER_TABS)) {
    const sheet = book.getWorksheet(tab);
    if (!sheet) throw new AppError('failed-precondition', `The Rep TNA tracker is missing the required ${tab} tab.`);
    let header = null;
    for (let n = 1; n <= Math.min(sheet.rowCount, 5) && !header; n++) {
      const columns = new Set();
      sheet.getRow(n).eachCell({includeEmpty: false}, cell => { const k = canonical(cell.text); if (k) columns.add(k); });
      if (columns.size) header = {row: n, columns};
    }
    if (!header) throw new AppError('failed-precondition', `The Rep TNA tracker ${tab} tab has no readable header row.`);
    const missing = headers.filter(h => !header.columns.has(canonical(h)));
    if (missing.length) throw new AppError('failed-precondition', `The Rep TNA tracker ${tab} tab is missing: ${missing.join(', ')}. No changes were made.`);
    tabs[tab] = {headerRow: header.row, existingRows: Math.max(0, sheet.rowCount - header.row)};
  }
  return {tabs};
}

// Store master workbook (readGeoRepSalesStoreMaster): the best header row in the first 30 rows of any sheet with a Region
// column and a store name or code, then one entry per store code and name.
const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cleanCell = (v, max = 240) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
async function parseStoreMaster(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const find = (headers, aliases) => { const wanted = aliases.map(norm); return headers.findIndex(h => wanted.includes(norm(h))); };
  let selected = null;
  for (const sheet of book.worksheets) {
    for (let n = 1; n <= Math.min(sheet.rowCount, 30); n++) {
      const headers = (sheet.getRow(n).values || []).slice(1).map(v => String(v || '').trim());
      const storeName = find(headers, ['Store Name', 'Meridian Store Name', 'Customer Name', 'Customer']);
      const storeCode = find(headers, ['Geo Rep Store Code', 'Diplomat Customer no', 'Store Code', 'Customer Code', 'Diplomat Store Code', 'Meridian Store Code']);
      const region = find(headers, ['Region', 'Region Name']);
      if (region < 0 || (storeName < 0 && storeCode < 0)) continue;
      const score = 30 + (storeName >= 0 ? 10 : 0) + (storeCode >= 0 ? 10 : 0);
      if (!selected || score > selected.score) {
        selected = {sheet, row: n, score, storeName, storeCode, region, rep: find(headers, ['Rep', 'Sales Rep', 'Representative', 'Merchandiser']), client: find(headers, ['Client', 'Client Name', 'Customer Group']),
          banner: find(headers, ['Banner', 'Banner Name', 'Retail Banner']), channel: find(headers, ['Channel', 'Channel Name', 'Retail Channel']), division: find(headers, ['Division', 'Business Division'])};
      }
    }
  }
  if (!selected) throw new AppError('invalid-argument', 'The Attendance Store Master needs a Region column and either Store Name or Store Code.');
  const entries = new Map();
  let sourceRows = 0, excludedRows = 0;
  selected.sheet.eachRow((row, n) => {
    if (n <= selected.row) return;
    sourceRows++;
    const values = (row.values || []).slice(1);
    const at = (i, max) => (i >= 0 ? cleanCell(values[i], max) : '');
    const entry = {storeName: at(selected.storeName, 240), storeCode: at(selected.storeCode, 120), region: at(selected.region, 120), rep: at(selected.rep, 160), client: at(selected.client, 120),
      banner: at(selected.banner, 120), channel: at(selected.channel, 120), division: at(selected.division, 120)};
    if (!entry.region || (!entry.storeName && !entry.storeCode)) { excludedRows++; return; }
    if (entry.storeCode) entries.set(`code:${norm(entry.storeCode)}`, entry);
    if (entry.storeName) entries.set(`name:${norm(entry.storeName)}`, entry);
  });
  const unique = [...new Map([...entries.values()].map(e => [`${e.storeCode}|${e.storeName}|${e.region}`, e])).values()];
  if (!unique.length) throw new AppError('invalid-argument', 'The Attendance Store Master has no usable store and region rows.');
  return {entries: unique, sheetName: selected.sheet.name, sourceRows, excludedRows};
}

function geoAttendanceService({fs, storage, graph, actorOf}) {
  async function overview() {
    const [config, masters, profile] = await Promise.all([fs.get(CONFIG), fs.query('attendanceStoreMasters', {max: 100}), fs.get(`retailers/${ATTENDANCE_PROFILE}`)]);
    const c = config?.data || {};
    return {
      graphEnabled: Boolean(graph), defaultTrackerUrl: DEFAULT_TRACKER,
      tracker: c.tracker ? {status: text(c.tracker.status, 40), sourceUrl: text(c.tracker.sourceUrl, 2000), name: text(c.tracker.name, 260), webUrl: text(c.tracker.webUrl, 2000), size: Number(c.tracker.size) || null, lastModifiedDateTime: iso(c.tracker.lastModifiedDateTime), tabs: c.tracker.tabs || {}} : null,
      operationalWeek: Number(c.operationalWeek) || null, operationalWeekUpdatedAt: iso(c.operationalWeekUpdatedAt), updatedAt: iso(c.updatedAt),
      storeMasterId: text(c.storeMasterId, 64) || DEFAULT_MASTER,
      storeMasters: masters.map(m => ({id: m.id, name: text(m.data.name, 120), sourceName: text(m.data.sourceName, 240), storeCount: Number(m.data.storeCount) || 0, regionCount: Number(m.data.regionCount) || 0, sheetName: text(m.data.sheetName, 120), updatedAt: iso(m.data.updatedAt), sha256: text(m.data.sha256, 64)}))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
      schedule: profile ? {enabled: profile.data.reportSchedule?.enabled === true, time: text(profile.data.reportSchedule?.time, 5), daysOfWeek: profile.data.reportSchedule?.daysOfWeek || []} : null
    };
  }

  async function saveTracker(user, body) {
    const sourceUrl = required(body.sharePointUrl, 'Rep TNA tracker SharePoint link', 2000);
    let url;
    try { url = new URL(sourceUrl); } catch { throw new AppError('invalid-argument', 'Enter a valid Meridian Group SharePoint workbook link.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'meridiangroupza.sharepoint.com') throw new AppError('invalid-argument', 'Use a Meridian Group SharePoint workbook link.');
    if (!graph) throw new AppError('unavailable', 'SharePoint is not connected on this site yet.');
    let item;
    try { item = await graph.request(`/shares/${encodeURIComponent(shareId(sourceUrl))}/driveItem?$select=id,name,size,webUrl,file,parentReference,lastModifiedDateTime`); } catch (error) {
      throw new AppError('failed-precondition', error.status === 404 || error.status === 403 ? 'Nexus cannot open that SharePoint link. Check the link and that the workbook is in the Meridian Nexus site.' : `SharePoint could not be reached (${error.status || 'error'}). Try again.`);
    }
    if (!item?.id || !item.file || !item.parentReference?.driveId) throw new AppError('failed-precondition', 'The SharePoint link does not resolve to a downloadable workbook.');
    if (!/\.xlsx$/i.test(item.name || '')) throw new AppError('invalid-argument', 'The Rep TNA tracker must be an .xlsx workbook.');
    const buffer = await graph.downloadItem(item.parentReference.driveId, item.id);
    if (!buffer.length) throw new AppError('failed-precondition', 'The SharePoint workbook download is empty.');
    const {tabs} = await inspectTracker(buffer);
    const actor = await actorOf(user);
    const tracker = {provider: 'sharepoint', status: 'configured', sourceUrl, driveId: item.parentReference.driveId, itemId: item.id, name: item.name, webUrl: item.webUrl || sourceUrl,
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : null, lastModifiedDateTime: item.lastModifiedDateTime || null, tabs};
    await fs.merge(CONFIG, {tracker, updatedAt: SERVER_TIME, updatedBy: actor.uid});
    return {tracker};
  }

  async function saveWeek(user, body) {
    const week = Number(body.operationalWeek);
    if (![1, 2, 3, 4].includes(week)) throw new AppError('invalid-argument', 'Choose Geo Rep operational week 1, 2, 3, or 4.');
    const actor = await actorOf(user);
    await fs.merge(CONFIG, {operationalWeek: week, operationalWeekUpdatedAt: SERVER_TIME, operationalWeekUpdatedBy: actor.uid, updatedAt: SERVER_TIME, updatedBy: actor.uid});
    return {operationalWeek: week};
  }

  // Upload and save in one step: the workbook is checked before anything is stored.
  async function saveStoreMaster(user, {id: requested, name, fileName, data}) {
    const id = text(requested, 64) || DEFAULT_MASTER;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) throw new AppError('invalid-argument', 'The Attendance Store Master identifier is invalid.');
    const label = required(name, 'Attendance Store Master name', 120);
    if (!/\.xlsx$/i.test(fileName || '')) throw new AppError('invalid-argument', 'The Attendance Store Master must be an .xlsx workbook.');
    if (!data?.length || data.length > MAX_BYTES) throw new AppError('invalid-argument', 'The Attendance Store Master must be between 1 byte and 25 MB.');
    const parsed = await parseStoreMaster(data);
    const sourceName = (String(fileName).replace(/[\\/]/g, '_').replace(/[\u0000-\u001f]/g, '').trim() || 'store-master.xlsx').slice(-240);
    const storagePath = `geo-rep-attendance-store-masters/${id}/${Date.now()}_${sourceName}`;
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const actor = await actorOf(user);
    const saved = await storage.upload(storagePath, data, {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', metadata: {masterId: id, purpose: 'geo-rep-attendance-store-enrichment', uploadedBy: actor.email}, ifGenerationMatch: 0});
    const regionCount = new Set(parsed.entries.map(e => e.region)).size;
    await fs.commit([
      fs.write('merge', `attendanceStoreMasters/${id}`, {id, name: label, storagePath, sourceName, storeCount: parsed.entries.length, regionCount, sheetName: parsed.sheetName, active: true, sha256, generation: String(saved.generation || ''), updatedAt: SERVER_TIME, updatedBy: actor.uid}),
      fs.write('merge', CONFIG, {storeMasterId: id, storeMasterName: label, storeMasterUpdatedAt: SERVER_TIME, updatedAt: SERVER_TIME, updatedBy: actor.uid})
    ]);
    return {id, storeCount: parsed.entries.length, regionCount, sheetName: parsed.sheetName, excludedRows: parsed.excludedRows};
  }

  return {overview, saveTracker, saveWeek, saveStoreMaster};
}

module.exports = {geoAttendanceService, inspectTracker, parseStoreMaster, shareId, TRACKER_TABS};
