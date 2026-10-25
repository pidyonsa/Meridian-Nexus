'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {firestore, encode, decodeFields, plan, fieldPath, SERVER_TIME, DELETE} = require('../server/google/firestore.cjs');
const {tokenSource, googleConfigured} = require('../server/google/token.cjs');

test('values round-trip; dates become timestamps', () => {
  const fields = encode({s: 'a', i: 3, d: 1.5, b: false, n: null, t: new Date('2026-10-25T10:00:00Z'), a: [1, 'x'], m: {k: 'v'}}).mapValue.fields;
  assert.deepEqual(fields.i, {integerValue: '3'}); assert.deepEqual(fields.t, {timestampValue: '2026-10-25T10:00:00.000Z'});
  assert.deepEqual(decodeFields(fields), {s: 'a', i: 3, d: 1.5, b: false, n: null, t: '2026-10-25T10:00:00.000Z', a: [1, 'x'], m: {k: 'v'}});
});

test('write plan: dotted keys nest, sentinels become transforms or deletions, odd names are quoted', () => {
  const p = plan({status: 'queued', 'reportSchedule.enabled': true, updatedAt: SERVER_TIME, old: DELETE, attempts: {$increment: 1}});
  assert.deepEqual(p.fields, {status: 'queued', reportSchedule: {enabled: true}});
  assert.deepEqual(p.mask, ['status', 'reportSchedule.enabled', 'old']);
  assert.deepEqual(p.transforms, [{fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'}, {fieldPath: 'attempts', increment: {integerValue: '1'}}]);
  assert.equal(fieldPath('a.b-c.d'), 'a.`b-c`.d');
});

function fake(responses) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url: String(url), body: init.body ? JSON.parse(init.body) : null, method: init.method});
    const r = responses.shift() || {status: 200, body: {}};
    return new Response(JSON.stringify(r.body), {status: r.status || 200, headers: {'content-type': 'application/json'}});
  };
  return {fs: firestore({token: async () => 't', fetchImpl}), calls};
}

test('query: filters, order and limit become a structured query; documents decode', async () => {
  const {fs, calls} = fake([{body: [{document: {name: 'projects/meridain-nexus/databases/(default)/documents/extractionRuns/r1', fields: {status: {stringValue: 'queued'}}, updateTime: 'u'}}]}]);
  const docs = await fs.query('extractionRuns', {where: [['status', 'in', ['queued', 'running']], ['retailerId', '==', 'geo-rep']], orderBy: [['createdAt', 'desc']], limit: 20});
  assert.deepEqual(docs, [{id: 'r1', path: 'extractionRuns/r1', data: {status: 'queued'}, updateTime: 'u', createTime: undefined}]);
  const q = calls[0].body.structuredQuery;
  assert.equal(q.where.compositeFilter.filters[0].fieldFilter.op, 'IN'); assert.equal(q.limit, 20);
  assert.deepEqual(q.orderBy, [{field: {fieldPath: 'createdAt'}, direction: 'DESCENDING'}]);
});

test('update requires the document to exist and sends a mask; get returns null for a missing document', async () => {
  const {fs, calls} = fake([{body: {}}, {status: 404, body: {error: {}}}]);
  await fs.update('retailers/geo-rep', {'reportSchedule.enabled': true, updatedAt: SERVER_TIME});
  const w = calls[0].body.writes[0];
  assert.deepEqual(w.currentDocument, {exists: true}); assert.deepEqual(w.updateMask.fieldPaths, ['reportSchedule.enabled']); assert.equal(w.updateTransforms[0].fieldPath, 'updatedAt');
  assert.equal(await fs.get('retailers/nope'), null);
});

test('transactions retry when Firestore aborts and commit their writes with the transaction id', async () => {
  const {fs, calls} = fake([{body: {transaction: 'T1'}}, {status: 409, body: {error: {status: 'ABORTED'}}}, {body: {transaction: 'T2'}}, {body: {}}]);
  let runs = 0;
  await fs.transaction(async tx => { runs++; tx.update('extractionRuns/r1', {status: 'cancelled'}); });
  assert.equal(runs, 2);
  assert.equal(calls.at(-1).body.transaction, 'T2');
});

test('tokens: keyless exchange only when configured; one refresh for concurrent callers', async () => {
  assert.equal(googleConfigured({}), false);
  const env = {IDENTITY_ENDPOINT: 'http://identity.local/token', IDENTITY_HEADER: 'h', GOOGLE_AUDIENCE: 'api://aud', GOOGLE_PROVIDER: '//iam/provider', GOOGLE_SERVICE_ACCOUNT: 'sa@x'};
  assert.equal(googleConfigured(env), true);
  let calls = 0;
  const fetchImpl = async url => {
    calls++;
    const body = String(url).startsWith('http://identity.local') ? {access_token: 'azure'} : String(url).includes('sts.googleapis.com') ? {access_token: 'federated'} : {accessToken: 'google'};
    return new Response(JSON.stringify(body), {status: 200});
  };
  const token = tokenSource(env, fetchImpl);
  assert.deepEqual(await Promise.all([token(), token()]), ['google', 'google']);
  assert.equal(calls, 3);
});
