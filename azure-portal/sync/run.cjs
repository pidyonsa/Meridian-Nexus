'use strict';
// Firestore -> Azure SQL sync (plan stage B). Runs as a Container Apps job:
//   hourly:  hot collections in full, incremental collections from their checkpoint, subcollections in full.
//   nightly: everything in full, and rows of deleted Firestore documents are removed.
// SYNC_MODE=hourly|nightly overrides the automatic choice (nightly in the 00:00 UTC hour).
// One collection failing does not stop the others; the run is marked "partial" and the job exits non-zero.
const {pool, close} = require('../server/db.cjs');
const {COLLECTIONS, tableName} = require('./collections.cjs');
const {client} = require('./firestore.cjs');
const {tokenSource} = require('./google.cjs');
const {store} = require('./sql-store.cjs');

const log = event => console.log(JSON.stringify({at: new Date().toISOString(), ...event}));

async function syncCollection(c, {mode, fs, db}) {
  const table = tableName(c);
  const full = mode === 'nightly' || c.mode !== 'incremental';
  const since = full ? null : await db.checkpoint(table);
  // An incremental collection that has never had a full pass gets one first.
  const after = !full && since?.last_full_at && since.last_value ? {field: c.field, value: since.last_value} : null;
  const complete = full || !after;
  const seen = new Set();
  let written = 0, maxValue = null, count = 0;
  for await (const page of fs.scan({collection: c.id, group: c.mode === 'group', after})) {
    const docs = c.parent ? page.filter(d => d.path.startsWith(`${c.parent}/`)) : page;
    for (const d of docs) {
      seen.add(d.path);
      const v = c.field ? d.data[c.field] : null;
      if (typeof v === 'string' && (!maxValue || v > maxValue)) maxValue = v;
    }
    count += docs.length;
    written += await db.upsert(table, docs);
  }
  const deleted = complete ? await db.removeMissing(table, seen) : 0;
  await db.saveCheckpoint(table, {field: c.field || null, lastValue: maxValue, full: complete, count: complete ? count : null});
  return {collection: table, pass: complete ? 'full' : 'incremental', read: count, written, deleted};
}

async function main(env = process.env) {
  const mode = env.SYNC_MODE || (new Date().getUTCHours() === 0 ? 'nightly' : 'hourly');
  const db = store(await pool(env));
  const fs = client({token: tokenSource(env)});
  const runId = await db.startRun(mode);
  log({event: 'sync-start', runId, mode});
  const results = [], failures = [];
  for (const c of COLLECTIONS) {
    try {
      const r = await syncCollection(c, {mode, fs, db});
      results.push(r);
      if (r.written || r.deleted) log({event: 'sync-collection', ...r});
    } catch (error) {
      failures.push({collection: tableName(c), error: String(error.message).slice(0, 300)});
      log({event: 'sync-collection-failed', collection: tableName(c), error: String(error.message).slice(0, 300)});
    }
  }
  const sum = key => results.reduce((s, r) => s + r[key], 0);
  const status = failures.length ? (results.length ? 'partial' : 'failed') : 'succeeded';
  await db.finishRun(runId, {status, read: fs.reads(), written: sum('written'), deleted: sum('deleted'), detail: {results, failures}, error: failures.map(f => `${f.collection}: ${f.error}`).join('; ') || null});
  log({event: 'sync-finished', runId, mode, status, read: fs.reads(), written: sum('written'), deleted: sum('deleted'), failed: failures.length});
  return status;
}

module.exports = {main, syncCollection};
if (require.main === module) {
  main().then(async status => { await close(); process.exitCode = status === 'succeeded' ? 0 : 1; }, async error => { log({event: 'sync-crashed', error: String(error.stack || error).slice(0, 1500)}); await close(); process.exitCode = 1; });
}
