'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {SERVER_TIME, DELETE} = require('../server/google/firestore.cjs');
const {automationService, reportDates} = require('../server/automation/service.cjs');
const {automationRoutes} = require('../server/automation/routes.cjs');
const {errorHandler} = require('../server/errors.cjs');

const NOW = '2026-10-25T10:00:00.000Z';
// In-memory Firestore with the client's surface: get, query (== and in), write/commit, transaction.
function memoryFirestore(seed = {}) {
  const docs = new Map(Object.entries(seed).map(([k, v]) => [k, structuredClone(v)]));
  const value = v => (v === SERVER_TIME ? NOW : v);
  function apply(w) {
    if (w.kind === 'delete') { docs.delete(w.path); return; }
    const exists = docs.has(w.path);
    if (w.kind === 'create' && exists) throw Object.assign(new Error('ALREADY_EXISTS'), {precondition: true});
    if (w.kind === 'update' && !exists) throw Object.assign(new Error('NOT_FOUND'), {precondition: true});
    const target = w.kind === 'set' || w.kind === 'create' ? {} : structuredClone(docs.get(w.path) || {});
    for (const [key, v] of Object.entries(w.data)) {
      const parts = key.split('.');
      let o = target;
      for (const p of parts.slice(0, -1)) o = (o[p] ||= {});
      const last = parts.at(-1);
      if (v === DELETE) delete o[last];
      else if (v && typeof v === 'object' && '$arrayUnion' in v) o[last] = [...(o[last] || []), ...v.$arrayUnion];
      else if (v && typeof v === 'object' && '$increment' in v) o[last] = (o[last] || 0) + v.$increment;
      else o[last] = value(v);
    }
    docs.set(w.path, target);
  }
  const doc = path => (docs.has(path) ? {id: path.split('/').pop(), path, data: structuredClone(docs.get(path))} : null);
  async function query(collection, {where = [], limit = 0} = {}) {
    let out = [...docs.keys()].filter(p => p.split('/').length === 2 && p.startsWith(`${collection}/`)).map(doc);
    for (const [field, op, v] of where) out = out.filter(d => (op === 'in' ? v.includes(d.data[field]) : d.data[field] === v));
    return limit ? out.slice(0, limit) : out;
  }
  const write = (kind, path, data) => ({kind, path, data});
  const fs = {
    docs, write, query, get: async path => doc(path),
    commit: async writes => { for (const w of writes) apply(w); },
    async transaction(fn) {
      const queued = [];
      const tx = {get: async p => doc(p), query, merge: (p, d) => queued.push(write('merge', p, d)), create: (p, d) => queued.push(write('create', p, d)), update: (p, d) => queued.push(write('update', p, d)), set: (p, d) => queued.push(write('set', p, d))};
      const result = await fn(tx);
      for (const w of queued) apply(w);
      return result;
    }
  };
  return fs;
}

const admin = {email: 'jpinto@meridiangroup.co.za', name: 'Jeorge Pinto'};
const seed = () => ({
  'adminUsers/uid-jp': {email: 'jpinto@meridiangroup.co.za', name: 'Jeorge', surname: 'Pinto'},
  'retailers/geo-rep-sales-transactions': {name: 'Geo Rep Transaction Report', extractionProfileId: 'steps-1', webAddress: 'https://meridian.georep.com/portal', executor: 'azure', reportSchedule: {enabled: true, time: '10:00', daysOfWeek: [1, 2, 3], lastRunKey: 'daily:2026-10-24:10:00', lastQueuedRunId: 'old'}},
  'retailers/dataorbis-game-sales': {name: 'Game', salesProcedure: {automationReady: true}},
  'retailers/no-steps': {name: 'Unlinked'},
  'extractionProfiles/steps-1': {name: 'Transaction report steps', workflowMode: 'geo-rep-report'},
  'extractionRuns/live': {retailerId: 'geo-rep-sales-transactions', retailerName: 'Geo Rep Transaction Report', status: 'running', createdAt: '2026-10-25T09:00:00Z', lastActivityAt: '2026-10-25T09:59:30Z', reportIdentity: 'delivery-1', executionTimeline: []},
  'extractionRuns/stuck': {retailerId: 'geo-rep-sales-transactions', status: 'running', createdAt: '2026-10-25T08:00:00Z', lastActivityAt: '2026-10-25T08:30:00Z', executionTimeline: [{at: '2026-10-25T08:30:00Z', event: 'step'}], extractionProfileId: 'steps-1', fileId: 'f-old', workflowMode: 'geo-rep-report'},
  'extractionRuns/broken': {retailerId: 'geo-rep-sales-transactions', retailerName: 'Geo Rep Transaction Report', status: 'failed', currentStep: 4, fileId: 'x', runSummary: {text: 'failed'}, executor: 'azure', createdAt: '2026-10-24T08:00:00Z', executionTimeline: [{event: 'failed', step: 4}]},
  'extractionRuns/done': {retailerId: 'geo-rep-sales-transactions', retailerName: 'Geo Rep Transaction Report', status: 'completed', fileId: 'file1', createdAt: '2026-10-25T07:00:00Z', completedAt: '2026-10-25T07:10:00Z'},
  'files/file1': {source: 'retailer-extraction', extractionRunId: 'done', name: 'Report.xlsx', storagePath: 'uploads/file1/Report.xlsx'},
  'automationPrompts/p-live': {runId: 'live', status: 'waiting', ownerUid: 'uid-jp', inputRequired: true, retailerName: 'Geo Rep Transaction Report'},
  'automationPrompts/p-other': {runId: 'live', status: 'waiting', ownerUid: 'someone-else', inputRequired: true},
  'automationPrompts/p-app': {runId: 'live', status: 'waiting', inputRequired: false}
});
const make = (fs = memoryFirestore(seed())) => ({fs, service: automationService({fs, storage: {download: async path => (path === 'uploads/file1/Report.xlsx' ? {body: new Blob(['x']).stream(), type: 'application/vnd.ms-excel', size: 1} : null)}, now: () => new Date(NOW)})});
const audits = fs => [...fs.docs].filter(([k]) => k.startsWith('accessAuditLogs/')).map(([, v]) => v);

test('report periods follow the Firebase defaults', () => {
  const now = new Date('2026-10-25T08:00:00Z');
  assert.deepEqual(reportDates('geo-rep-attendance-for-reps', '', '', now), {start: '2026-10-01', end: '2026-10-24'});
  assert.deepEqual(reportDates('geo-rep-attendance-for-reps', '2026-09-03', '2026-09-20', now), {start: '2026-09-01', end: '2026-09-20'});
  assert.deepEqual(reportDates('geo-rep-sales-transactions', '', '', now), {start: '2026-10-01', end: '2026-10-25'});
  assert.deepEqual(reportDates('other', '2026-10-02', '', now), {start: '2026-10-02', end: '2026-10-02'});
  assert.deepEqual(reportDates('other', '', '', now), {start: '2026-10-25', end: '2026-10-25'});
});

test('start queues the run the trigger expects, under the person\'s Firebase uid, with an audit entry', async () => {
  const {fs, service} = make();
  const {runId, reportStartDate} = await service.start(admin, {retailerId: 'geo-rep-sales-transactions'});
  const run = fs.docs.get(`extractionRuns/${runId}`);
  assert.equal(run.status, 'queued'); assert.equal(run.createdBy, 'uid-jp'); assert.equal(run.createdAt, NOW); assert.equal(reportStartDate, '2026-10-01');
  assert.equal(run.extractionName, 'Transaction report steps'); assert.equal(run.workflowMode, 'geo-rep-report'); assert.equal(run.executionTimeline[0].event, 'queued');
  assert.ok(!('executor' in run), 'the trigger decides Azure or Google');
  assert.equal(audits(fs).at(-1).event, 'run-queued');
  await assert.rejects(service.start(admin, {retailerId: 'dataorbis-game-sales'}), /existing Nexus/);
  await assert.rejects(service.start(admin, {retailerId: 'no-steps'}), /Link extraction steps/);
  await assert.rejects(service.start(admin, {retailerId: 'geo-rep-sales-transactions', reportStartDate: '25/10/2026'}), /YYYY-MM-DD/);
  await assert.rejects(service.start(admin, {retailerId: 'geo-rep-sales-transactions', reportStartDate: '2026-10-20', reportEndDate: '2026-10-01'}), /on or before/);
});

test('abort: only active runs; waiting prompts close; the delivery record is marked; a second abort is refused', async () => {
  const {fs, service} = make();
  await service.abort(admin, 'live');
  const run = fs.docs.get('extractionRuns/live');
  assert.equal(run.status, 'cancelled'); assert.equal(run.cancellationRequestedBy, 'uid-jp'); assert.deepEqual(run.executionTimeline.map(e => e.event), ['abort-requested', 'aborted']);
  assert.equal(fs.docs.get('automationPrompts/p-live').status, 'cancelled');
  assert.equal(fs.docs.get('reportDeliveries/delivery-1').status, 'cancelled');
  await assert.rejects(service.abort(admin, 'live'), /Only a queued or active/);
  await assert.rejects(service.abort(admin, 'missing'), /not found/);
});

test('retry copies the job without its attempt fields, once; restart only for a stalled run', async () => {
  const {fs, service} = make();
  const r = await service.retryStep(admin, 'broken');
  const copy = fs.docs.get(`extractionRuns/${r.retryRunId}`);
  assert.equal(r.retryFromStep, 4); assert.equal(copy.status, 'queued'); assert.equal(copy.retryOfRunId, 'broken'); assert.equal(copy.executor, 'azure');
  assert.ok(!('fileId' in copy) && !('runSummary' in copy) && !('currentStep' in copy));
  assert.equal(fs.docs.get('extractionRuns/broken').retryQueuedRunId, r.retryRunId);
  await assert.rejects(service.retryStep(admin, 'broken'), /already queued/);
  await assert.rejects(service.restart(admin, 'live'), /recent portal activity/);
  const x = await service.restart(admin, 'stuck');
  assert.equal(fs.docs.get('extractionRuns/stuck').status, 'cancelled');
  const fresh = fs.docs.get(`extractionRuns/${x.restartRunId}`);
  assert.equal(fresh.trigger, 'manual-restart'); assert.equal(fresh.status, 'queued'); assert.ok(!('fileId' in fresh));
});

test('schedules: validated, written as leaf fields so the scheduler bookkeeping stays', async () => {
  const {fs, service} = make();
  await assert.rejects(service.saveSchedule(admin, 'geo-rep-sales-transactions', {enabled: true, time: '', daysOfWeek: [1]}), /run time/);
  await assert.rejects(service.saveSchedule(admin, 'geo-rep-sales-transactions', {enabled: true, time: '25:00', daysOfWeek: [1]}), /HH:mm/);
  await assert.rejects(service.saveSchedule(admin, 'geo-rep-sales-transactions', {enabled: true, time: '06:00', daysOfWeek: []}), /at least one day/);
  await assert.rejects(service.saveSchedule(admin, 'geo-rep-sales-transactions', {enabled: true, time: '06:00', daysOfWeek: [9]}), /valid weekdays/);
  const r = await service.saveSchedule(admin, 'geo-rep-sales-transactions', {enabled: true, time: '06:00', daysOfWeek: [5, 1, 2, 3, 4, 1], dateMode: 'daily'});
  const s = fs.docs.get('retailers/geo-rep-sales-transactions').reportSchedule;
  assert.deepEqual(s.daysOfWeek, [1, 2, 3, 4, 5]); assert.equal(s.businessDaysOnly, true); assert.equal(s.time, '06:00'); assert.equal(s.configuredBy, 'uid-jp');
  assert.equal(s.lastRunKey, 'daily:2026-10-24:10:00'); assert.equal(s.lastQueuedRunId, 'old');
  assert.equal(r.missedToday, false); assert.equal(r.nextRunDate, '2026-10-26');   // 25 Oct 2026 is a Sunday
});

test('prompts: owner only, once; codes and Authenticator approvals as the worker expects', async () => {
  const {fs, service} = make();
  await assert.rejects(service.answerPrompt(admin, 'p-other', {action: 'submit', value: '123456'}), /Only the owner/);
  await assert.rejects(service.answerPrompt(admin, 'p-app', {action: 'submit', value: '1'}), /Confirm the Authenticator/);
  await service.answerPrompt(admin, 'p-live', {action: 'submit', value: '123456'});
  assert.equal(fs.docs.get('automationPrompts/p-live').value, '123456');
  await assert.rejects(service.answerPrompt(admin, 'p-live', {action: 'submit', value: '1'}), /already been handled/);
  await service.answerPrompt(admin, 'p-app', {action: 'approve'});
  assert.equal(fs.docs.get('automationPrompts/p-app').value, '__NEXUS_AUTHENTICATOR_APPROVED__');
});

test('workspace: ready profiles, live and recent runs (stall flagged), prompts marked as answerable, reports', async () => {
  const {service} = make();
  const w = await service.workspace(admin);
  assert.deepEqual(w.profiles.map(p => p.id), ['dataorbis-game-sales', 'geo-rep-sales-transactions']);
  assert.equal(w.profiles.find(p => p.id === 'dataorbis-game-sales').startable, false);
  assert.equal(w.runs.find(r => r.id === 'stuck').stalled, true);
  assert.deepEqual(w.prompts.filter(p => p.mine).map(p => p.id).sort(), ['p-app', 'p-live']);
  assert.deepEqual(w.reports.map(r => r.name), ['Report.xlsx']);
});

test('routes: admin only, same-site changes, 503 when Google is not connected, report download', async t => {
  const serve = async ({service, admin: isAdmin = true}) => {
    const app = express();
    automationRoutes({service, allow: () => isAdmin, userOf: () => admin})(app);
    app.use(errorHandler({error() {}}));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
    return (path, init = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, init);
  };
  const {service} = make();
  const get = await serve({service});
  assert.equal((await get('/api/automation')).status, 200);
  const crossSite = await get('/api/automation/runs/live/abort', {method: 'POST', headers: {origin: 'https://evil.example', 'content-type': 'application/json'}, body: '{}'});
  assert.equal(crossSite.status, 403);
  assert.equal((await get('/api/automation/runs/live/explode', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'})).status, 404);
  const started = await get('/api/automation/runs', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({retailerId: 'geo-rep-sales-transactions'})});
  assert.equal(started.status, 201);
  const file = await get('/api/automation/reports/file1');
  assert.equal(file.status, 200); assert.match(file.headers.get('content-disposition'), /Report\.xlsx/);
  assert.equal((await (await serve({service: null}))('/api/automation')).status, 503);
  assert.equal((await (await serve({service, admin: false}))('/api/automation')).status, 403);
});
