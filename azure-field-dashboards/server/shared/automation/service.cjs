'use strict';
// Report automation on Azure: the Firebase-era callables (getOperationsWorkspace, getExtractionRunDetail,
// startExtraction, abortExtraction, endAllActiveExtractionRuns, continueWaitingExtraction, restartExtraction,
// retryFailedExtractionStep, saveRetailerSchedule, submitAutomationPrompt, extraction-report download) re-implemented
// against the same Firestore documents and Storage objects (functions/index.js, read 25 October 2026). The Google-side
// triggers and the Azure workers (processExtraction bundle) keep doing the work: a new `queued` run is picked up on
// create, cancellations are polled, prompts are answered through automationPrompts.
// Differences from Firebase: status checks and writes run in one transaction (no double abort or double answer);
// removed features (Salesforce, Display Compliance, Monthly Attendance, SmartSell) are refused instead of queued;
// DataOrbis monthly runs still start from the existing Nexus.
const crypto = require('node:crypto');
const {AppError} = require('../errors.cjs');
const {SERVER_TIME} = require('../google/firestore.cjs');
const {people} = require('../google/people.cjs');

const ACTIVE = ['queued', 'running', 'waiting_otp', 'waiting_for_otp', 'waiting_approval', 'cancelling'];
const TERMINAL = ['completed', 'completed_no_data', 'failed', 'cancelled', 'skipped_duplicate', 'rebuild_failed'];
const RETRYABLE = ['failed', 'completed_no_data', 'waiting_sharepoint_unlock'];
const AUTHENTICATOR_APPROVED = '__NEXUS_AUTHENTICATOR_APPROVED__';
const STALL_MS = 90 * 1000;
const RUNS_LIMIT = 300;
const GEO_ATTENDANCE = new Set(['geo-rep-attendance-for-reps', 'geo-rep-merch-attendance']);
const GEO_MONTH_TO_DATE = new Set(['geo-rep', 'geo-rep-sales-transactions', 'geo-rep-orders', ...GEO_ATTENDANCE]);
const DATAORBIS = new Set(['dataorbis-game-sales', 'dataorbis-makro-sales']);
// Salesforce profiles and the Geo Rep blueprint ('geo-rep') were retired in October 2026.
const RETIRED = id => /^sales-force-|^salesforce-/.test(id) || id === 'geo-rep';
// The run fields the job list needs (timelines are read only when a job is opened).
const LIST_FIELDS = ['retailerId', 'retailerName', 'extractionName', 'reportStartDate', 'reportEndDate', 'status', 'message', 'createdAt', 'startedAt', 'completedAt', 'lastActivityAt', 'updatedAt',
  'cancellationRequestedAt', 'cancellationRequestedBy', 'createdBy', 'createdByEmail', 'createdByName', 'scheduledBy', 'scheduledByEmail', 'scheduledByName', 'trigger', 'fileName', 'currentStep', 'totalSteps',
  'currentStepAction', 'executor', 'retryQueuedRunId', 'fileId', 'auditFileId', 'artifacts'];
// Fields of a run that describe one attempt; a retry or restart copies everything else (retryableExtractionPayload).
const TRANSIENT = new Set(['status', 'message', 'createdAt', 'startedAt', 'completedAt', 'updatedAt', 'lastActivityAt', 'currentStep', 'totalSteps', 'currentStepAction', 'executionTimeline',
  'reportIdentity', 'fileId', 'fileName', 'originalFileName', 'fileSize', 'fileSha256', 'storagePath', 'sharePoint', 'uploadedAt', 'isDuplicate', 'duplicateOfFileId', 'attendanceBlueprint',
  'attendanceBlueprintUpdateRunId', 'salesDashboardImportId', 'attendanceTrackerUpdateRunId', 'merchandiserTrackerUpdateRunId', 'companionRunId', 'companionRunIds', 'cancellationRequestedAt',
  'cancellationRequestedBy', 'portalWaitAcknowledgedAt', 'portalWaitAcknowledgedBy', 'runSummary', 'failureEvidence', 'promptId', 'failureProvider', 'failureCategory', 'workbookChanged',
  'retryQueuedAt', 'retryQueuedRunId', 'salesforceAutoRetry', 'salesforceAutoRetryQueuedAt', 'salesforceAutoRetryQueuedRunId']);
const ID = /^[\w-]{1,160}$/;

const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const required = (v, name, max) => { const t = String(v ?? '').trim(); if (!t || t.length > max) throw new AppError('invalid-argument', `${name} is required.`); return t; };
const iso = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const millis = v => (v ? new Date(v).getTime() || 0 : 0);
const event = (name, message, details = {}) => ({at: new Date().toISOString(), event: name, message: String(message).slice(0, 500), ...details});

function optionalDate(v, name) {
  const t = String(v ?? '').trim();
  if (!t) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`))) throw new AppError('invalid-argument', `${name} must use YYYY-MM-DD format.`);
  return t;
}
function optionalTime(v, name) {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new AppError('invalid-argument', `${name} must use HH:mm format.`);
  return t;
}

// Africa/Johannesburg calendar (South Africa has no daylight saving).
function local(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(now).map(x => [x.type, x.value]));
  return {date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute)};
}
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekday = date => new Date(`${date}T12:00:00Z`).getUTCDay();

// The report period a run uses when the operator leaves dates blank or partial (defaultReportDatesForRetailer).
function reportDates(retailerId, start, end, now = new Date()) {
  const today = local(now).date;
  if (GEO_ATTENDANCE.has(retailerId)) { const e = end || start || addDays(today, -1); return {start: `${e.slice(0, 8)}01`, end: e}; }
  if (start || end) return {start: start || end, end: end || start};
  if (GEO_MONTH_TO_DATE.has(retailerId)) return {start: `${today.slice(0, 8)}01`, end: today};
  return {start: today, end: today};
}

const lastActivity = run => Math.max(...(run.executionTimeline || []).map(e => millis(e?.at)), millis(run.lastActivityAt), millis(run.updatedAt), millis(run.startedAt), millis(run.createdAt));
const stalled = (run, now = Date.now()) => ['queued', 'running'].includes(run.status) && now - lastActivity(run) >= STALL_MS;

function timeline(entries, keep) {
  return (Array.isArray(entries) ? entries : []).slice(-keep).map(e => ({at: iso(e?.at), event: text(e?.event, 100), message: text(e?.message, 800), step: Number(e?.step) || null, action: text(e?.action, 100), recovery: text(e?.recovery, 100)}));
}
function safeRun(id, d) {
  return {
    id, retailerId: text(d.retailerId, 80), retailerName: text(d.retailerName, 160), extractionName: text(d.extractionName, 160), reportStartDate: text(d.reportStartDate, 10), reportEndDate: text(d.reportEndDate, 10),
    status: text(d.status, 48), message: text(d.message, 500), createdAt: iso(d.createdAt), startedAt: iso(d.startedAt), completedAt: iso(d.completedAt), lastActivityAt: iso(d.lastActivityAt),
    cancellationRequestedAt: iso(d.cancellationRequestedAt), cancellationRequestedBy: text(d.cancellationRequestedBy, 160), createdBy: text(d.createdBy, 160), createdByEmail: text(d.createdByEmail, 320),
    createdByName: text(d.createdByName, 160), scheduledBy: text(d.scheduledBy, 160), scheduledByEmail: text(d.scheduledByEmail, 320), scheduledByName: text(d.scheduledByName, 160), trigger: text(d.trigger, 48),
    fileName: text(d.fileName, 300), currentStep: Number(d.currentStep) || 0, totalSteps: Number(d.totalSteps) || 0, currentStepAction: text(d.currentStepAction, 80), executor: text(d.executor, 24),
    timelineEventCount: Array.isArray(d.executionTimeline) ? d.executionTimeline.length : 0, executionTimeline: timeline(d.executionTimeline, 12),
    runSummary: d.runSummary ? {...d.runSummary, generatedAt: iso(d.runSummary.generatedAt)} : null,
    retryQueuedRunId: text(d.retryQueuedRunId, 160), stalled: stalled(d), lastActivity: lastActivity(d) ? new Date(lastActivity(d)).toISOString() : null, retryable: RETRYABLE.includes(d.status), active: ACTIVE.includes(d.status)
  };
}
const safeRunDetail = (id, d) => ({...safeRun(id, d), actualReportPeriod: text(d.actualReportPeriod, 120), fileId: text(d.fileId, 160), fileSize: Number(d.fileSize) || 0, reportIdentity: text(d.reportIdentity, 240),
  retryOfRunId: text(d.retryOfRunId, 160), parentRunId: text(d.parentRunId, 160), executionTimeline: timeline(d.executionTimeline, 120)});
function safeProfile(id, d) {
  let portal = text(d.webAddress, 200);
  try { portal = new URL(d.webAddress).hostname; } catch { /* keep the raw value */ }
  const s = d.reportSchedule || {};
  return {
    id, name: text(d.name, 120) || id, portal, extractionName: text(d.extractionName, 160), executor: text(d.executor, 24),
    ready: DATAORBIS.has(id) ? d.salesProcedure?.automationReady === true : Boolean(d.extractionProfileId || (Array.isArray(d.steps) && d.steps.length)),
    startable: !DATAORBIS.has(id) && !RETIRED(id), defaultsToMonth: GEO_MONTH_TO_DATE.has(id), attendance: GEO_ATTENDANCE.has(id),
    reportSchedule: {enabled: s.enabled === true, frequency: text(s.frequency, 16) || 'daily', dateMode: s.dateMode === 'fixed' ? 'fixed' : 'daily', time: text(s.time, 5), daysOfWeek: (Array.isArray(s.daysOfWeek) ? s.daysOfWeek : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6),
      businessDaysOnly: s.businessDaysOnly === true, startDate: text(s.startDate, 10), endDate: text(s.endDate, 10), lastQueuedAt: iso(s.lastQueuedAt), lastQueuedRunId: text(s.lastQueuedRunId, 160),
      configuredByName: text(s.configuredByName, 160), configuredByEmail: text(s.configuredByEmail, 320), updatedAt: iso(s.updatedAt)}
  };
}
const safeAudit = d => ({id: d.id, event: text(d.data.event, 80), actorEmail: text(d.data.actorEmail, 320), actorName: text(d.data.actorName, 160), actorRole: text(d.data.actorRole, 24), runId: text(d.data.runId, 160),
  retailerName: text(d.data.retailerName, 160), result: text(d.data.result, 80), message: text(d.data.message, 500), createdAt: iso(d.data.createdAt)});
const safeAlert = d => ({id: d.id, runId: text(d.data.runId, 160), type: text(d.data.type, 60), severity: text(d.data.severity, 20) || 'warning', status: text(d.data.status, 20) || 'open', title: text(d.data.title, 180),
  message: text(d.data.message, 500), retailerName: text(d.data.retailerName, 160), createdAt: iso(d.data.createdAt), lastDetectedAt: iso(d.data.lastDetectedAt), resolvedAt: iso(d.data.resolvedAt)});

function automationService({fs, storage, now = () => new Date()}) {
  const actorOf = people(fs);

  const auditWrite = (actor, name, details = {}) => fs.write('create', `accessAuditLogs/${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`, {
    event: name.slice(0, 80), actorUid: actor.uid.slice(0, 160), actorEmail: actor.email, actorName: actor.name, actorRole: 'admin', runId: details.runId || null, retailerId: details.retailerId || null,
    retailerName: details.retailerName || null, result: details.result ?? null, message: details.message ? String(details.message).slice(0, 500) : null, createdAt: SERVER_TIME, via: 'azure-nexus'});
  const audit = (actor, name, details) => fs.commit([auditWrite(actor, name, details)]);
  const deliveryWrite = (identity, update) => fs.write('merge', `reportDeliveries/${identity}`, {...update, updatedAt: SERVER_TIME});
  const runIdOf = v => { const id = required(v, 'Extraction run', 160); if (!ID.test(id)) throw new AppError('invalid-argument', 'Extraction run is required.'); return id; };
  const notFound = () => new AppError('not-found', 'Extraction run was not found.');

  async function workspace(user) {
    const actor = await actorOf(user);
    const [retailers, recent, active, prompts, alerts, audits] = await Promise.all([
      fs.query('retailers', {max: 500}),
      fs.query('extractionRuns', {orderBy: [['createdAt', 'desc']], limit: RUNS_LIMIT, select: LIST_FIELDS}),
      fs.query('extractionRuns', {where: [['status', 'in', ACTIVE]], limit: 160, select: LIST_FIELDS}),
      fs.query('automationPrompts', {where: [['status', '==', 'waiting']], limit: 50}),
      fs.query('automationAlerts', {orderBy: [['lastDetectedAt', 'desc']], limit: 80}),
      fs.query('accessAuditLogs', {orderBy: [['createdAt', 'desc']], limit: 80})
    ]);
    const runs = [...new Map([...recent, ...active].map(d => [d.id, d])).values()].map(d => safeRun(d.id, d.data))
      .sort((a, b) => millis(b.lastActivity) - millis(a.lastActivity) || millis(b.createdAt) - millis(a.createdAt) || b.id.localeCompare(a.id));
    return {
      account: actor, historyScope: `latest ${RUNS_LIMIT}`,
      profiles: retailers.filter(d => !RETIRED(d.id)).map(d => safeProfile(d.id, d.data)).filter(p => p.ready).sort((a, b) => a.name.localeCompare(b.name)),
      runs, reports: await reports(recent),
      prompts: prompts.map(d => ({id: d.id, runId: text(d.data.runId, 160), retailerName: text(d.data.retailerName, 160), type: text(d.data.type, 40), message: text(d.data.message, 500), inputRequired: d.data.inputRequired !== false,
        createdAt: iso(d.data.createdAt), mine: !d.data.ownerUid || d.data.ownerUid === actor.uid, ownerEmail: text(d.data.ownerEmail || d.data.createdByEmail, 320)})),
      alerts: alerts.map(safeAlert).sort((a, b) => millis(b.lastDetectedAt || b.createdAt) - millis(a.lastDetectedAt || a.createdAt)),
      audit: audits.map(safeAudit)
    };
  }

  // Delivered report files of completed runs (operations-reports.list): newest 24.
  async function reports(runDocs) {
    try {
      const ids = new Map();
      for (const d of runDocs.filter(d => d.data.status === 'completed').sort((a, b) => millis(b.data.completedAt || b.data.createdAt) - millis(a.data.completedAt || a.data.createdAt))) {
        for (const id of [d.data.fileId, d.data.auditFileId, ...(Array.isArray(d.data.artifacts) ? d.data.artifacts.map(a => a?.fileId) : [])]) if (typeof id === 'string' && ID.test(id) && !ids.has(id) && ids.size < 24) ids.set(id, d);
      }
      const files = await Promise.all([...ids.keys()].map(id => fs.get(`files/${id}`)));
      return files.filter(f => f && f.data.source === 'retailer-extraction' && ID.test(f.data.extractionRunId || '')).map(f => {
        const run = ids.get(f.id).data;
        return {id: f.id, name: text(f.data.name || f.data.originalName || 'Report', 300), retailerName: text(run.retailerName, 160), completedAt: iso(f.data.completedAt || f.data.uploadedAt || f.data.createdAt || run.completedAt), artifactKind: text(f.data.artifactKind, 40), extractionRunId: f.data.extractionRunId};
      });
    } catch { return []; }
  }

  async function runDetail(user, runId) {
    const id = runIdOf(runId);
    const doc = await fs.get(`extractionRuns/${id}`);
    if (!doc) throw notFound();
    await audit(await actorOf(user), 'run-log-viewed', {runId: id, retailerId: doc.data.retailerId, retailerName: doc.data.retailerName, result: 'viewed', message: 'The extraction run timeline was opened.'});
    return {run: safeRunDetail(id, doc.data)};
  }

  async function start(user, body) {
    const retailerId = required(body.retailerId, 'Extraction profile', 64);
    const startDate = optionalDate(body.reportStartDate, 'Report start date'), endDate = optionalDate(body.reportEndDate, 'Report end date');
    if (startDate && endDate && startDate > endDate) throw new AppError('invalid-argument', 'The report start date must be on or before the end date.');
    const retailer = await fs.get(`retailers/${retailerId}`);
    if (!retailer) throw new AppError('not-found', 'Extraction profile configuration was not found.');
    if (DATAORBIS.has(retailerId)) throw new AppError('failed-precondition', 'DataOrbis monthly sales runs still start from ETLs › Portal sales in the existing Nexus.');
    if (RETIRED(retailerId)) throw new AppError('failed-precondition', 'This report was retired in October 2026 and can no longer be run.');
    const r = retailer.data;
    if (!r.extractionProfileId && !(Array.isArray(r.steps) && r.steps.length)) throw new AppError('failed-precondition', 'Link extraction steps before running this extraction profile.');
    let profile = null;
    if (r.extractionProfileId) {
      profile = await fs.get(`extractionProfiles/${r.extractionProfileId}`);
      if (!profile) throw new AppError('not-found', 'Extraction step set was not found.');
    }
    const actor = await actorOf(user);
    const dates = reportDates(retailerId, startDate, endDate, now());
    const runId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const extractionName = profile ? text(profile.data.name, 160) || null : r.extractionName || null;
    await fs.commit([
      fs.write('create', `extractionRuns/${runId}`, {
        retailerId, retailerName: r.name || retailerId, extractionProfileId: r.extractionProfileId || null, extractionName, workflowMode: profile ? text(profile.data.workflowMode, 40) || null : null,
        includeSchedulesReport: false, reportStartDate: dates.start || null, reportEndDate: dates.end || null, monthlyActualWeek: null, monthlyReconcileAllWeeks: false, dailySmartSellWeekOverride: null,
        monthlyRefreshNonce: null, monthlyWeekStartDate: null, monthlyWeekEndDate: null, status: 'queued', message: 'Extraction queued', createdAt: SERVER_TIME,
        createdBy: actor.uid, createdByEmail: actor.email || null, createdByName: actor.name || null, requestedVia: 'azure-nexus', executionTimeline: [event('queued', 'Manual extraction queued')]
      }),
      auditWrite(actor, 'run-queued', {runId, retailerId, retailerName: r.name, result: 'queued', message: 'A manual extraction was queued.'})
    ]);
    return {runId, reportStartDate: dates.start, reportEndDate: dates.end};
  }

  // Waiting prompts of a run, closed with it.
  const closePrompts = async (tx, runId, actor, extra = {}) => {
    for (const p of (await tx.query('automationPrompts', {where: [['runId', '==', runId]], limit: 50})).filter(p => p.data.status === 'waiting')) tx.merge(p.path, {status: 'cancelled', handledAt: SERVER_TIME, handledBy: actor.uid, ...extra});
  };

  async function abort(user, runId) {
    const id = runIdOf(runId), actor = await actorOf(user);
    const run = await fs.transaction(async tx => {
      const doc = await tx.get(`extractionRuns/${id}`);
      if (!doc) throw notFound();
      if (!ACTIVE.includes(doc.data.status)) throw new AppError('failed-precondition', 'Only a queued or active extraction can be aborted.');
      await closePrompts(tx, id, actor);
      tx.merge(doc.path, {status: 'cancelled', message: 'Extraction aborted before a new report was delivered.', cancellationRequestedAt: SERVER_TIME, cancellationRequestedBy: actor.uid, completedAt: SERVER_TIME,
        executionTimeline: {$arrayUnion: [event('abort-requested', 'An authorised user requested that this extraction stop.'), event('aborted', 'The extraction was stopped by an authorised user.')]}});
      return doc.data;
    });
    await fs.commit([
      ...(run.reportIdentity ? [deliveryWrite(run.reportIdentity, {status: 'cancelled', runId: id, message: 'Extraction was aborted by an authorised user.'})] : []),
      auditWrite(actor, 'run-aborted', {runId: id, retailerId: run.retailerId, retailerName: run.retailerName, result: 'cancelled', message: 'The extraction was stopped before delivery.'})
    ]);
    return {runId: id, status: 'cancelled'};
  }

  async function endAll(user) {
    const actor = await actorOf(user);
    const [runs, prompts] = await Promise.all([fs.query('extractionRuns', {where: [['status', 'in', ACTIVE]], limit: 150}), fs.query('automationPrompts', {where: [['status', '==', 'waiting']], limit: 150})]);
    const writes = [
      ...runs.map(r => fs.write('merge', r.path, {status: 'cancelled', message: 'Extraction aborted by Admin from the live jobs control centre.', cancellationRequestedAt: SERVER_TIME, completedAt: SERVER_TIME, lastActivityAt: SERVER_TIME,
        cancellationRequestedBy: actor.uid, executionTimeline: {$arrayUnion: [event('admin-bulk-abort-requested', 'Admin ended this active automation job from the live jobs control centre.'), event('aborted', 'The extraction was stopped before a new report was delivered.')]}})),
      ...prompts.map(p => fs.write('merge', p.path, {status: 'cancelled', message: 'Closed because Admin ended active automation jobs.', handledAt: SERVER_TIME, handledBy: actor.uid}))
    ];
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    // Firestore commits hold up to 500 writes.
    for (let i = 0; i < writes.length; i += 450) await fs.commit(writes.slice(i, i + 450));
    await audit(actor, 'all-active-runs-ended', {result: 'cancelled', message: `${plural(runs.length, 'active run')} and ${plural(prompts.length, 'waiting prompt')} were closed by Admin.`});
    return {cancelledRuns: runs.length, closedPrompts: prompts.length};
  }

  async function keepWaiting(user, runId) {
    const id = runIdOf(runId), actor = await actorOf(user);
    const run = await fs.transaction(async tx => {
      const doc = await tx.get(`extractionRuns/${id}`);
      if (!doc) throw notFound();
      if (!stalled(doc.data, now().getTime())) throw new AppError('failed-precondition', 'This run has recent portal activity and does not need a waiting decision.');
      tx.merge(doc.path, {portalWaitAcknowledgedAt: SERVER_TIME, portalWaitAcknowledgedBy: actor.uid, lastActivityAt: SERVER_TIME,
        executionTimeline: {$arrayUnion: [event('portal-wait-continued', 'An authorised user chose to keep the current portal session open after 90 seconds without activity.')]}});
      return doc.data;
    });
    await audit(actor, 'run-wait-continued', {runId: id, retailerId: run.retailerId, retailerName: run.retailerName, result: 'waiting', message: 'The operator elected to continue waiting for the portal.'});
    return {runId: id, status: 'waiting'};
  }

  const retryPayload = data => Object.fromEntries(Object.entries(data).filter(([k]) => !TRANSIENT.has(k)));

  async function restart(user, runId) {
    const id = runIdOf(runId), actor = await actorOf(user);
    const newId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const run = await fs.transaction(async tx => {
      const doc = await tx.get(`extractionRuns/${id}`);
      if (!doc) throw notFound();
      if (!stalled(doc.data, now().getTime())) throw new AppError('failed-precondition', 'This run has recent portal activity and does not need a restart.');
      await closePrompts(tx, id, actor);
      tx.merge(doc.path, {status: 'cancelled', message: 'Extraction session ended after a confirmed portal restart.', cancellationRequestedAt: SERVER_TIME, cancellationRequestedBy: actor.uid, completedAt: SERVER_TIME,
        executionTimeline: {$arrayUnion: [event('restart-confirmed', 'An authorised user ended the unresponsive portal session and queued a fresh retry.')]}});
      tx.create(`extractionRuns/${newId}`, {...retryPayload(doc.data), batchId: null, displayComplianceBatchId: null, retryOfRunId: id, trigger: 'manual-restart', status: 'queued', message: 'Fresh extraction retry queued after the portal stopped responding.',
        createdBy: actor.uid, createdByEmail: actor.email || null, createdByName: actor.name || null, createdAt: SERVER_TIME, requestedVia: 'azure-nexus',
        executionTimeline: [event('restart-queued', 'A fresh retry was queued after the previous portal session stopped responding.')]});
      return doc.data;
    });
    await fs.commit([
      ...(run.reportIdentity ? [deliveryWrite(run.reportIdentity, {status: 'cancelled', runId: id, message: 'The previous portal session was restarted by an authorised user.'})] : []),
      auditWrite(actor, 'run-restarted', {runId: id, retailerId: run.retailerId, retailerName: run.retailerName, result: 'queued', message: `A fresh retry was queued as ${newId}.`})
    ]);
    return {runId: id, restartRunId: newId, status: 'queued'};
  }

  async function retryStep(user, runId) {
    const id = runIdOf(runId), actor = await actorOf(user);
    const newId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const {run, step} = await fs.transaction(async tx => {
      const doc = await tx.get(`extractionRuns/${id}`);
      if (!doc) throw new AppError('not-found', 'The extraction run was not found.');
      if (!RETRYABLE.includes(doc.data.status)) throw new AppError('failed-precondition', 'Only a failed, no-data, or SharePoint-locked job can be retried from its last failed step.');
      if (doc.data.retryQueuedRunId) throw new AppError('already-exists', `A retry of this job was already queued (${doc.data.retryQueuedRunId}).`);
      const failed = [...(doc.data.executionTimeline || [])].reverse().find(e => e?.event === 'failed');
      const n = Math.max(1, Number(doc.data.currentStep || failed?.step || 1));
      tx.create(`extractionRuns/${newId}`, {...retryPayload(doc.data), retryOfRunId: id, retryFromStep: n, recoveryMode: 'failed-step', trigger: 'failed-step-retry', status: 'queued', message: `Retrying failed step ${n} with secure portal preflight.`,
        createdBy: actor.uid, createdByEmail: actor.email || null, createdByName: actor.name || null, createdAt: SERVER_TIME, requestedVia: 'azure-nexus',
        executionTimeline: [event('failed-step-retry-queued', `Retry queued from failed step ${n}; Nexus will rebuild only the required portal state before retrying.`, {step: n})]});
      tx.merge(doc.path, {retryQueuedAt: SERVER_TIME, retryQueuedRunId: newId, executionTimeline: {$arrayUnion: [event('failed-step-retry-requested', `A targeted retry was queued from step ${n}.`, {step: n})]}});
      return {run: doc.data, step: n};
    });
    const alerts = await fs.query('automationAlerts', {where: [['runId', '==', id], ['status', '==', 'open']], limit: 20}).catch(() => []);
    await fs.commit([
      ...alerts.map(a => fs.write('merge', a.path, {status: 'retrying', retryRunId: newId, acknowledgedAt: SERVER_TIME, acknowledgedBy: actor.uid})),
      auditWrite(actor, 'run-failed-step-retry', {runId: id, retailerId: run.retailerId, retailerName: run.retailerName, result: 'queued', message: `Targeted retry queued as ${newId} from step ${step}.`})
    ]);
    return {runId: id, retryRunId: newId, retryFromStep: step, status: 'queued'};
  }

  // Daily schedules (the only kind left after Monthly Attendance was retired). Leaf fields only, so the scheduler's
  // lastRunKey / lastQueuedRunId bookkeeping is kept.
  async function saveSchedule(user, retailerId, body) {
    const id = required(retailerId, 'Extraction profile', 64);
    const enabled = body.enabled === true;
    const dateMode = body.dateMode === 'fixed' ? 'fixed' : 'daily';
    const startDate = optionalDate(body.startDate, 'Report start date'), endDate = optionalDate(body.endDate, 'Report end date');
    const time = optionalTime(body.time, 'Schedule time');
    if (!Array.isArray(body.daysOfWeek)) throw new AppError('invalid-argument', 'Scheduled days must be a list of weekdays.');
    if (!body.daysOfWeek.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) throw new AppError('invalid-argument', 'Scheduled days must be valid weekdays.');
    const days = [...new Set(body.daysOfWeek)].sort();
    if (enabled && !time) throw new AppError('invalid-argument', 'Choose a daily run time.');
    if (enabled && !days.length) throw new AppError('invalid-argument', 'Select at least one day for the automated extraction.');
    if (enabled && dateMode === 'fixed' && (!startDate || !endDate)) throw new AppError('invalid-argument', 'Choose a fixed start and end date, or use the run day.');
    if (dateMode === 'fixed' && startDate && endDate && startDate > endDate) throw new AppError('invalid-argument', 'The report start date must be on or before the end date.');
    const retailer = await fs.get(`retailers/${id}`);
    if (!retailer) throw new AppError('not-found', 'Extraction profile configuration was not found.');
    if (RETIRED(id) || DATAORBIS.has(id)) throw new AppError('failed-precondition', 'This report\'s schedule is managed in the existing Nexus.');
    const actor = await actorOf(user);
    const s = {enabled, frequency: 'daily', dayOfMonth: null, daysOfWeek: days, businessDaysOnly: days.join() === '1,2,3,4,5', monthlyRunCadence: null, dateMode, time, timezone: 'Africa/Johannesburg',
      startDate: dateMode === 'fixed' ? startDate : '', endDate: dateMode === 'fixed' ? endDate || startDate : '', monthlyActualWeek: null, monthlyReconcileAllWeeks: false, dailySmartSellWeekOverride: null,
      monthlyWeekStartDate: '', monthlyWeekEndDate: '', configuredBy: actor.uid, configuredByEmail: actor.email, configuredByName: actor.name, updatedAt: SERVER_TIME, updatedBy: actor.uid};
    await fs.commit([
      fs.write('update', `retailers/${id}`, {...Object.fromEntries(Object.entries(s).map(([k, v]) => [`reportSchedule.${k}`, v])), updatedAt: SERVER_TIME, updatedBy: actor.uid}),
      auditWrite(actor, 'schedule-updated', {retailerId: id, retailerName: retailer.data.name, result: enabled ? 'enabled' : 'disabled', message: enabled ? `Schedule saved for ${time || 'the selected time'}.` : 'Schedule disabled.'})
    ]);
    // Saved after today's time has passed (with the scheduler's 15-minute grace) and not yet run today: it starts next run day.
    const today = local(now());
    const [hh, mm] = time ? time.split(':').map(Number) : [0, 0];
    const runKey = `daily:${today.date}:${time}`;
    const missedToday = enabled && days.includes(weekday(today.date)) && today.minutes >= hh * 60 + mm + 15 && retailer.data.reportSchedule?.lastRunKey !== runKey;
    let next = today.date;
    if (enabled && (missedToday || !days.includes(weekday(today.date)))) { next = addDays(today.date, 1); for (let i = 0; i < 8 && !days.includes(weekday(next)); i++) next = addDays(next, 1); }
    return {retailerId: id, missedToday, nextRunDate: enabled ? next : null};
  }

  async function answerPrompt(user, promptId, body) {
    const id = required(promptId, 'Prompt', 160);
    if (!ID.test(id)) throw new AppError('invalid-argument', 'Prompt is required.');
    const action = text(body.action, 20) || 'submit';
    if (!['submit', 'approve', 'cancel'].includes(action)) throw new AppError('invalid-argument', 'Unsupported prompt action.');
    const value = action === 'submit' ? required(body.value, 'OTP', 80) : null;
    const actor = await actorOf(user);
    const prompt = await fs.transaction(async tx => {
      const doc = await tx.get(`automationPrompts/${id}`);
      if (!doc) throw new AppError('not-found', 'This automation prompt is no longer active.');
      const p = doc.data;
      if (!p.runId || !ID.test(p.runId) || !(await tx.get(`extractionRuns/${p.runId}`))) throw new AppError('failed-precondition', 'The extraction for this prompt is no longer available.');
      if (p.ownerUid && p.ownerUid !== actor.uid) throw new AppError('permission-denied', 'Only the owner of this extraction can respond to its authentication prompt.');
      if (p.status !== 'waiting') throw new AppError('failed-precondition', 'This automation prompt has already been handled.');
      if (action === 'approve' && p.inputRequired !== false) throw new AppError('invalid-argument', 'This prompt requires a code, not an approval confirmation.');
      if (action === 'submit' && p.inputRequired === false) throw new AppError('invalid-argument', 'Confirm the Authenticator approval instead of entering a code.');
      tx.merge(doc.path, action === 'cancel' ? {status: 'cancelled', handledAt: SERVER_TIME, handledBy: actor.uid}
        : action === 'approve' ? {status: 'submitted', value: AUTHENTICATOR_APPROVED, resolution: 'administrator-confirmed-authenticator-app', handledAt: SERVER_TIME, handledBy: actor.uid}
          : {status: 'submitted', value, handledAt: SERVER_TIME, handledBy: actor.uid});
      return p;
    });
    const [name, message] = {cancel: ['prompt-cancelled', 'The operator cancelled a secure portal prompt.'], approve: ['prompt-approved', 'The operator confirmed an Authenticator approval.'], submit: ['prompt-code-submitted', 'The operator supplied the requested portal verification code.']}[action];
    await audit(actor, name, {runId: prompt.runId, retailerName: prompt.retailerName, message});
    return {promptId: id, status: action === 'cancel' ? 'cancelled' : 'submitted'};
  }

  // A delivered report file: checked the way operations-reports.download checks it, then streamed from Storage.
  async function reportFile(user, fileId) {
    if (typeof fileId !== 'string' || !ID.test(fileId)) throw new AppError('invalid-argument', 'A valid report ID is required.');
    const file = await fs.get(`files/${fileId}`);
    if (!file || file.data.source !== 'retailer-extraction' || !ID.test(file.data.extractionRunId || '')) throw new AppError('not-found', 'The completed report was not found.');
    const run = await fs.get(`extractionRuns/${file.data.extractionRunId}`);
    const outputs = run ? [run.data.fileId, run.data.auditFileId, ...(Array.isArray(run.data.artifacts) ? run.data.artifacts.map(a => a?.fileId) : [])] : [];
    if (!run || run.data.status !== 'completed' || !outputs.includes(fileId)) throw new AppError('failed-precondition', 'This file is not a completed report output.');
    const path = String(file.data.storagePath || '');
    const name = path.startsWith(`uploads/${fileId}/`) ? path.slice(`uploads/${fileId}/`.length) : '';
    if (!name || /[/\\\r\n]/.test(name)) throw new AppError('failed-precondition', 'The report file path is invalid.');
    const object = await storage.download(path);
    if (!object) throw new AppError('not-found', 'The completed report was not found.');
    await audit(await actorOf(user), 'report-downloaded', {runId: run.id, retailerId: run.data.retailerId, retailerName: run.data.retailerName, result: 'downloaded', message: `Report ${text(file.data.name || name, 200)} was downloaded.`});
    return {...object, name: text(file.data.name || name, 300)};
  }

  return {workspace, runDetail, start, abort, endAll, keepWaiting, restart, retryStep, saveSchedule, answerPrompt, reportFile};
}

module.exports = {automationService, reportDates, stalled, safeRun, local, ACTIVE, TERMINAL};
