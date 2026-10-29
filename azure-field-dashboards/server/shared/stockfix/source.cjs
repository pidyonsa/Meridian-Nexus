'use strict';
// StockFix reporting data, read-only from SharePoint (Meridian Nexus site, Stock Fix/Reporting/dashboard-data): the
// files the StockFix backend's dashboard-generator job writes after each weekly cycle (meridian-group-za/stockfix-backend,
// container-jobs/dashboard-generator/process_stockfix_barcode_workcopy.py, read 29 October 2026) and the StockFix Field
// Performance dashboard reads. Nexus never writes there; the StockFix app and backend keep producing the data.
//   weeks_index.json            [{week, rowCount, file}]
//   summary.json                [{week, client, banner, region, classification, actionStatus, count, storeSohTotal, dcSohTotal}]
//   leaderboard_rollup.json     [{week, client, banner, region, manager, rep, resourceType, tasksAssigned, tasksCaptured, storesAssigned, storesCaptured, …}]
//   action_impact_rollup.json   [{baselineWeek, targetWeek, client, banner, region, manager, rep, feedbackTasks, matchedTasks, …}]
//   weeks/week_YYYY-MM-DD.jsonl.gz  one store task per line
const zlib = require('node:zlib');
const {AppError} = require('../errors.cjs');
const {encodeGraphPath} = require('../azure/graph.cjs');

const SITE = {hostname: 'meridiangroupza.sharepoint.com', path: '/sites/MeridianNexus'};
const FOLDER = 'Stock Fix/Reporting/dashboard-data';
const ROLLUPS = {weeks: 'weeks_index.json', summary: 'summary.json', leaderboard: 'leaderboard_rollup.json', impact: 'action_impact_rollup.json'};
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const CHECK_MS = 5 * 60 * 1000;          // how long a folder listing is used before asking SharePoint what changed
const WEEKS_KEPT = 3;                    // week files held in memory (the selected week, its prior week, one more)
const MAX_WEEK_BYTES = 400 * 1024 * 1024; // a week file, unzipped
// Task fields kept from a week file (rep and manager e-mail addresses and image links are left out).
const FIELDS = ['id', 'week', 'client', 'banner', 'region', 'store', 'rep', 'resourceType', 'manager', 'category', 'barcode', 'article', 'dcSoh', 'storeSoh', 'p4Sales', 'missedSales',
  'storeWfc', 'classification', 'action', 'actionDate', 'feedback', 'physicalCount', 'variance', 'systemAdjusted', 'actionStatus', 'reasonCode', 'actionComment'];

function parseWeek(buffer) {
  const rows = [];
  for (const text of zlib.gunzipSync(buffer, {maxOutputLength: MAX_WEEK_BYTES}).toString('utf8').split('\n')) {
    if (!text.trim()) continue;
    let record;
    try { record = JSON.parse(text); } catch { continue; }
    const row = {};
    for (const f of FIELDS) if (record[f] != null && record[f] !== '') row[f] = record[f];
    rows.push(row);
  }
  return rows;
}

function sharePointStockFixSource({graph, now = () => Date.now()}) {
  if (!graph) return null;
  let drive = null, listing = null;
  const rollups = new Map(), weeks = new Map();   // name or week -> {eTag, value: Promise}

  async function driveId() {
    if (!drive) {
      const site = await graph.request(`/sites/${SITE.hostname}:${SITE.path}?$select=id`);
      drive = (await graph.request(`/sites/${site.id}/drive?$select=id`)).id;
    }
    return drive;
  }
  const children = async path => new Map((await graph.all(`/drives/${await driveId()}/root:/${encodeGraphPath(path)}:/children?$select=id,name,eTag,size,lastModifiedDateTime,file&$top=999`, 2000))
    .filter(i => i.file).map(i => [i.name, i]));

  // The two folders' files, listed at most every CHECK_MS; a changed eTag makes the next read download that file again.
  function list() {
    if (listing && now() - listing.at < CHECK_MS) return listing.value;
    const value = Promise.all([children(FOLDER), children(`${FOLDER}/weeks`).catch(e => (e.status === 404 ? new Map() : Promise.reject(e)))])
      .then(([top, weekFiles]) => ({top, weekFiles}))
      .catch(error => {
        if (error.status === 404) throw new AppError('not-found', 'The StockFix reporting folder (Stock Fix/Reporting/dashboard-data) was not found on SharePoint.');
        throw new AppError('unavailable', `SharePoint could not be read: ${String(error.message).slice(0, 200)}`);
      });
    listing = {at: now(), value};
    value.catch(() => { if (listing?.value === value) listing = null; });
    return value;
  }

  function cached(cache, key, item, load, keep = Infinity) {
    const hit = cache.get(key);
    if (hit && hit.eTag === item.eTag) { cache.delete(key); cache.set(key, hit); return hit.value; }
    const value = load();
    cache.set(key, {eTag: item.eTag, value});
    value.catch(() => cache.delete(key));
    while (cache.size > keep) cache.delete(cache.keys().next().value);
    return value;
  }

  return {
    kind: 'sharepoint',
    // The four rollups and when they last changed.
    async data() {
      const {top} = await list();
      const out = {updatedAt: null};
      for (const [key, name] of Object.entries(ROLLUPS)) {
        const item = top.get(name);
        if (!item) { out[key] = []; continue; }
        const value = await cached(rollups, name, item, async () => JSON.parse((await graph.downloadItem(await driveId(), item.id)).toString('utf8')));
        out[key] = Array.isArray(value) ? value : [];
        if (!out.updatedAt || item.lastModifiedDateTime > out.updatedAt) out.updatedAt = item.lastModifiedDateTime;
      }
      return out;
    },
    // One week's store tasks, or null when that week has no file.
    async week(week) {
      if (!WEEK.test(String(week))) return null;
      const {weekFiles} = await list();
      const item = weekFiles.get(`week_${week}.jsonl.gz`);
      if (!item) return null;
      return cached(weeks, week, item, async () => parseWeek(await graph.downloadItem(await driveId(), item.id)), WEEKS_KEPT);
    }
  };
}

// The same surface over data in memory (tests and the local preview).
function memoryStockFixSource({weeks = [], summary = [], leaderboard = [], impact = [], rows = {}, updatedAt = null} = {}) {
  return {kind: 'memory', data: async () => ({weeks, summary, leaderboard, impact, updatedAt}), week: async week => rows[week] || null};
}

module.exports = {sharePointStockFixSource, memoryStockFixSource, parseWeek, FOLDER, FIELDS};
