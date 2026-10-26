'use strict';
// Extraction profiles (retailers: portal, login, linked step set) and step sets (extractionProfiles: ordered browser
// steps) on Azure: the Firebase-era saveRetailer / deleteRetailer / saveExtractionProfile / deleteExtractionProfile
// (functions/index.js, read 26 October 2026) on the same documents. Passwords are encrypted into retailerSecrets and
// never returned. Salesforce Connected App certificates were retired with Salesforce in October 2026.
// Additions: a profile with an active run or an enabled schedule cannot be deleted; deletions are audited.
const crypto = require('node:crypto');
const {AppError} = require('../errors.cjs');
const {SERVER_TIME, DELETE} = require('../google/firestore.cjs');
const {people} = require('../google/people.cjs');
const {encryptPassword} = require('./credentials.cjs');

// Step actions the extraction engine runs (validateSteps). Retired Salesforce / Power BI actions stay valid so older
// step sets can still be opened and saved, but the editor does not offer them for new steps.
const ACTIONS = ['navigate', 'fill', 'fillUsername', 'fillPassword', 'click', 'clickText', 'clickInSection', 'waitFor', 'waitText', 'waitUrlContains', 'waitNetworkIdle', 'wait', 'select', 'setDateRange',
  'geoRepResetFormReportFilters', 'fillOtp', 'geoRepDownloadComplianceAuditSummary', 'geoRepDownloadTransactionReport', 'geoRepDownloadRepAttendanceReport', 'geoRepDownloadFormReportViaApi', 'export', 'download'];
const RETIRED_ACTIONS = ['salesforceOpenReport', 'salesforceOpenWorkspace', 'salesforceInspectWorkspace', 'salesforceConfigureDisplayCompliance', 'salesforceOpenDisplayCompliancePriority', 'salesforceDownloadDisplayCompliancePriority',
  'salesforceSetVisitDateFilter', 'salesforceExportReport', 'powerBiLogin', 'powerBiEnterOtp', 'powerBiAcknowledgeSecurity', 'powerBiOpenSosOverview', 'powerBiSetCurrentMonth', 'powerBiExportSosOverview'];
const ALLOWED = new Set([...ACTIONS, ...RETIRED_ACTIONS]);
const ACTIVE = ['queued', 'running', 'waiting_otp', 'waiting_for_otp', 'waiting_approval', 'cancelling', 'azure-reserved', 'azure-dispatching'];
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const text = (v, max) => String(v ?? '').trim().slice(0, max);
const required = (v, name, max) => { const t = String(v ?? '').trim(); if (!t || t.length > max) throw new AppError('invalid-argument', `${name} is required.`); return t; };
const iso = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const slugify = v => String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || crypto.randomUUID();
const idOf = (v, name) => { const id = text(v, 64); if (!ID.test(id)) throw new AppError('invalid-argument', `${name} is required.`); return id; };

function validateSteps(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 50) throw new AppError('invalid-argument', 'Add between 1 and 50 extraction steps.');
  return raw.map((step, i) => {
    const action = required(step?.action, `Step ${i + 1} action`, 40);
    if (!ALLOWED.has(action)) throw new AppError('invalid-argument', `Step ${i + 1} has an unsupported action.`);
    return {id: text(step.id, 80) || crypto.randomUUID(), action, selector: text(step.selector, 500), value: text(step.value, 1000)};
  });
}

function profileService({fs, credentialKey}) {
  const actorOf = people(fs);
  const audit = (actor, event, message, retailer = {}) => fs.write('create', `accessAuditLogs/${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`, {
    event, actorUid: actor.uid, actorEmail: actor.email, actorName: actor.name, actorRole: 'admin', runId: null, retailerId: retailer.id || null, retailerName: retailer.name || null, result: null, message, createdAt: SERVER_TIME, via: 'azure-nexus'});

  async function list() {
    const [retailers, sets, secrets] = await Promise.all([fs.query('retailers', {max: 500}), fs.query('extractionProfiles', {max: 500}), fs.query('retailerSecrets', {max: 500, select: ['updatedAt']})]);
    const hasSecret = new Set(secrets.map(s => s.id));
    return {
      actions: ACTIONS, retiredActions: RETIRED_ACTIONS, passwordsEnabled: Boolean(credentialKey),
      profiles: retailers.map(d => ({id: d.id, name: text(d.data.name, 120) || d.id, webAddress: text(d.data.webAddress, 1000), username: text(d.data.username, 320), extractionProfileId: text(d.data.extractionProfileId, 64),
        extractionName: text(d.data.extractionName, 160), executor: text(d.data.executor, 24), hasPassword: hasSecret.has(d.id), credentialsUpdatedAt: iso(d.data.credentialsUpdatedAt), updatedAt: iso(d.data.updatedAt),
        scheduleEnabled: d.data.reportSchedule?.enabled === true, scheduleTime: text(d.data.reportSchedule?.time, 5), retired: /^sales-force-|^salesforce-/.test(d.id) || d.id === 'geo-rep' || Boolean(d.data.salesforceConnectedApp?.configured)}))
        .sort((a, b) => a.name.localeCompare(b.name)),
      stepSets: sets.map(d => ({id: d.id, name: text(d.data.name, 120) || d.id, workflowMode: text(d.data.workflowMode, 40), steps: Array.isArray(d.data.steps) ? d.data.steps.map(s => ({id: text(s?.id, 80), action: text(s?.action, 40), selector: text(s?.selector, 500), value: text(s?.value, 1000)})) : [],
        updatedAt: iso(d.data.updatedAt), linked: retailers.filter(r => r.data.extractionProfileId === d.id).map(r => text(r.data.name, 120) || r.id)})).sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  async function saveStepSet(user, body) {
    const name = required(body.name, 'Step set name', 120);
    const id = body.id ? idOf(body.id, 'Extraction step set') : slugify(name);
    const steps = validateSteps(body.steps);
    const actor = await actorOf(user);
    await fs.commit([
      fs.write('merge', `extractionProfiles/${id}`, {name, steps, stepCount: steps.length, updatedAt: SERVER_TIME, updatedBy: actor.uid}),
      audit(actor, 'step-set-saved', `Saved step set ${name} (${steps.length} step${steps.length === 1 ? '' : 's'}).`)
    ]);
    return {id};
  }

  async function deleteStepSet(user, id) {
    const setId = idOf(id, 'Extraction step set');
    const linked = await fs.query('retailers', {where: [['extractionProfileId', '==', setId]], limit: 1});
    if (linked.length) throw new AppError('failed-precondition', 'This step set is linked to an extraction profile. Remove the link first.');
    const doc = await fs.get(`extractionProfiles/${setId}`);
    if (!doc) throw new AppError('not-found', 'Extraction step set was not found.');
    const actor = await actorOf(user);
    await fs.commit([fs.write('delete', `extractionProfiles/${setId}`), audit(actor, 'step-set-deleted', `Deleted step set ${text(doc.data.name, 120) || setId}.`)]);
    return {id: setId};
  }

  async function saveProfile(user, body) {
    const name = required(body.name, 'Extraction profile name', 100);
    const webAddress = required(body.webAddress, 'Portal web address', 1000);
    let url;
    try { url = new URL(webAddress); } catch { throw new AppError('invalid-argument', 'Enter a valid portal web address.'); }
    if (url.protocol !== 'https:') throw new AppError('invalid-argument', 'Portal web addresses must use https.');
    const username = required(body.username, 'Login username', 320);
    const id = body.id ? idOf(body.id, 'Extraction profile') : slugify(name);
    const extractionProfileId = text(body.extractionProfileId, 64);
    const password = String(body.password ?? '').slice(0, 1000);
    const existingSecret = await fs.get(`retailerSecrets/${id}`);
    if (!password && !existingSecret) throw new AppError('invalid-argument', 'Add a login password for a new extraction profile.');
    const stepSet = extractionProfileId ? await fs.get(`extractionProfiles/${idOf(extractionProfileId, 'Extraction step set')}`) : null;
    if (extractionProfileId && !stepSet) throw new AppError('not-found', 'Extraction step set was not found.');
    let secret = null;
    if (password) {
      if (!credentialKey) throw new AppError('unavailable', 'Passwords cannot be saved on this site yet.');
      secret = encryptPassword(password, await credentialKey());
    }
    const actor = await actorOf(user);
    await fs.commit([
      fs.write('merge', `retailers/${id}`, {name, webAddress, username, extractionProfileId: extractionProfileId || DELETE, extractionName: stepSet ? text(stepSet.data.name, 160) : DELETE,
        credentialsUpdatedAt: password ? SERVER_TIME : existingSecret?.data?.updatedAt || null, updatedAt: SERVER_TIME, updatedBy: actor.uid}),
      ...(secret ? [fs.write('merge', `retailerSecrets/${id}`, {...secret, updatedAt: SERVER_TIME, updatedBy: actor.uid})] : []),
      audit(actor, password ? 'profile-credentials-updated' : 'profile-saved', password ? `Saved extraction profile ${name} with a new portal password.` : `Saved extraction profile ${name}.`, {id, name})
    ]);
    return {id};
  }

  async function deleteProfile(user, id) {
    const profileId = idOf(id, 'Extraction profile');
    const doc = await fs.get(`retailers/${profileId}`);
    if (!doc) throw new AppError('not-found', 'Extraction profile was not found.');
    if (doc.data.reportSchedule?.enabled) throw new AppError('failed-precondition', 'Switch off this profile\'s schedule in Report automation before deleting it.');
    const active = await fs.query('extractionRuns', {where: [['retailerId', '==', profileId], ['status', 'in', ACTIVE]], limit: 1});
    if (active.length) throw new AppError('failed-precondition', 'This profile has a job running. Wait for it to finish or abort it first.');
    const actor = await actorOf(user);
    await fs.commit([fs.write('delete', `retailers/${profileId}`), fs.write('delete', `retailerSecrets/${profileId}`), audit(actor, 'profile-deleted', `Deleted extraction profile ${text(doc.data.name, 120) || profileId} and its saved password.`, {id: profileId, name: doc.data.name})]);
    return {id: profileId};
  }

  return {list, saveStepSet, deleteStepSet, saveProfile, deleteProfile};
}

module.exports = {profileService, validateSteps, ACTIONS};
