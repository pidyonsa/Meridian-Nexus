'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {decode, decodeFields} = require('../sync/firestore.cjs');
const {syncCollection} = require('../sync/run.cjs');
const {COLLECTIONS, tableName} = require('../sync/collections.cjs');

test('Firestore values become plain JSON', () => {
  assert.deepEqual(decodeFields({
    s: {stringValue: 'a'}, n: {integerValue: '42'}, big: {integerValue: '9007199254740993'}, d: {doubleValue: 1.5}, b: {booleanValue: true}, z: {nullValue: null},
    t: {timestampValue: '2026-10-22T10:00:00Z'}, r: {referenceValue: 'projects/p/databases/(default)/documents/retailers/geo-rep'},
    g: {geoPointValue: {latitude: -26.2, longitude: 28}}, a: {arrayValue: {values: [{stringValue: 'x'}, {integerValue: '1'}]}}, e: {arrayValue: {}},
    m: {mapValue: {fields: {k: {stringValue: 'v'}}}}, bytes: {bytesValue: 'AQI='}
  }), {s: 'a', n: 42, big: '9007199254740993', d: 1.5, b: true, z: null, t: '2026-10-22T10:00:00Z', r: {$ref: 'retailers/geo-rep'}, g: {$geo: {lat: -26.2, lng: 28}}, a: ['x', 1], e: [], m: {k: 'v'}, bytes: {$bytes: 'AQI='}});
  assert.equal(decode(undefined), null);
});

test('no secrets, no Geo API mirrors and no retired features are synced; names are unique', () => {
  const ids = COLLECTIONS.map(tableName);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.some(id => /^retailerSecrets|^geoRepApi|^salesforce|^stockFix|^displayCompliance|^geoRepBlueprint/.test(id)));
  assert.ok(COLLECTIONS.filter(c => ['incremental', 'recent'].includes(c.mode)).every(c => c.field));
  assert.ok(COLLECTIONS.filter(c => c.mode === 'recent').every(c => c.days > 0));
});

function fakes(docs, checkpoint = null) {
  const calls = {scans: [], upserts: [], removed: null, saved: null};
  const fs = {async *scan(q) { calls.scans.push(q); yield docs; }};
  const db = {
    checkpoint: async () => checkpoint,
    upsert: async (table, rows) => { calls.upserts.push({table, n: rows.length}); return rows.length; },
    removeMissing: async (table, seen) => { calls.removed = {table, seen: [...seen]}; return 1; },
    saveCheckpoint: async (table, value) => { calls.saved = {table, ...value}; }
  };
  return {fs, db, calls};
}

const doc = (path, field) => ({path, updateTime: '2026-10-22T10:00:00Z', data: field ? {createdAt: field} : {}});

test('hourly: an incremental collection reads only after its checkpoint and deletes nothing', async () => {
  const {fs, db, calls} = fakes([doc('automationAlerts/a', '2026-10-22T09:00:00Z'), doc('automationAlerts/b', '2026-10-22T09:30:00Z')], {last_full_at: new Date(), last_value: '2026-10-22T08:00:00Z'});
  const r = await syncCollection({id: 'automationAlerts', mode: 'incremental', field: 'createdAt'}, {mode: 'hourly', fs, db});
  assert.deepEqual(calls.scans[0].after, {field: 'createdAt', value: '2026-10-22T08:00:00Z'});
  assert.equal(r.pass, 'incremental'); assert.equal(calls.removed, null);
  assert.equal(calls.saved.lastValue, '2026-10-22T09:30:00Z'); assert.equal(calls.saved.full, false);
});

test('an incremental collection with no full pass yet gets a full one (with deletions)', async () => {
  const {fs, db, calls} = fakes([doc('files/a', '2026-10-01T00:00:00Z')], null);
  const r = await syncCollection({id: 'files', mode: 'incremental', field: 'createdAt'}, {mode: 'hourly', fs, db});
  assert.equal(calls.scans[0].after, null); assert.equal(r.pass, 'full'); assert.deepEqual(calls.removed.seen, ['files/a']);
});

test('nightly: full pass with deletions; subcollections keep only their own parent', async () => {
  const {fs, db, calls} = fakes([doc('meridianChatRooms/r1/messages/m1'), doc('supportTickets/t1/messages/m2')]);
  const r = await syncCollection({id: 'messages', parent: 'meridianChatRooms', mode: 'group'}, {mode: 'nightly', fs, db});
  assert.equal(calls.scans[0].group, true);
  assert.deepEqual(calls.upserts, [{table: 'meridianChatRooms/messages', n: 1}]);
  assert.deepEqual(calls.removed, {table: 'meridianChatRooms/messages', seen: ['meridianChatRooms/r1/messages/m1']});
  assert.equal(r.read, 1);
});

test('hourly: a recent collection reads only its last days, keeps no checkpoint value and deletes nothing', async () => {
  const {fs, db, calls} = fakes([doc('extractionRuns/a', '2026-10-24T09:00:00Z')], {last_full_at: new Date(), last_value: null});
  const r = await syncCollection({id: 'extractionRuns', mode: 'recent', field: 'createdAt', days: 7}, {mode: 'hourly', fs, db, now: Date.parse('2026-10-25T12:00:00Z')});
  assert.deepEqual(calls.scans[0].after, {field: 'createdAt', value: '2026-10-18T12:00:00.000Z'});
  assert.equal(r.pass, 'incremental'); assert.equal(calls.removed, null); assert.equal(calls.saved.lastValue, null);
});

test('nightly-only collections are skipped hourly and copied in full (as a collection group) at night', async () => {
  const c = {id: 'items', parent: 'sharePointIntegrationInventory', mode: 'nightly'};
  const hourly = fakes([doc('sharePointIntegrationInventory/s/items/i1')]);
  assert.equal(await syncCollection(c, {mode: 'hourly', fs: hourly.fs, db: hourly.db}), null);
  assert.equal(hourly.calls.scans.length, 0);
  const nightly = fakes([doc('sharePointIntegrationInventory/s/items/i1')]);
  const r = await syncCollection(c, {mode: 'nightly', fs: nightly.fs, db: nightly.db});
  assert.equal(nightly.calls.scans[0].group, true); assert.equal(r.pass, 'full'); assert.equal(r.read, 1);
});
