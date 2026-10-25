'use strict';
// Shared resources (masters, templates, reference files) on Azure: the Firebase-era getPortalResources,
// savePortalResource, getPortalResourceDownload and deletePortalResource against the same portalResources documents
// and portal-resources/<id>/ Storage objects, which ETL runs and the Geo Rep worker still read. Files reach Storage
// through the server (the browser never gets Google credentials); the last 12 file versions are kept as before.
const crypto = require('node:crypto');
const {AppError} = require('../errors.cjs');
const {SERVER_TIME} = require('../google/firestore.cjs');
const {people} = require('../google/people.cjs');

const CATEGORIES = ['Meridian Store Master', 'Meridian Product Master', 'Sales Store Master', 'SmartSell Master', 'Attendance Master', 'Stock Fix Source', 'Sales Source', 'Call Cycle Source', 'Training Source', 'Template', 'Reference', 'Other'];
const MAX_BYTES = 100 * 1024 * 1024;
const ID = /^[a-z0-9_-]{1,96}$/i;
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const iso = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const category = v => (CATEGORIES.includes(text(v, 80)) ? text(v, 80) : 'Other');
const tags = v => [...new Set((Array.isArray(v) ? v : []).map(t => text(t, 48)).filter(Boolean))].slice(0, 16);
// File names as the Firebase upload stored them: no slashes or control characters, at most 240 characters.
const safeName = name => (String(name || '').replace(/[\\/]/g, '_').replace(/[\u0000-\u001f]/g, '').trim() || 'unnamed-file').slice(-240);

function safeResource(id, d) {
  const versions = Array.isArray(d.versions) ? d.versions : [];
  return {id, title: text(d.title, 180), category: category(d.category), description: text(d.description, 1200), tags: tags(d.tags), sourceName: text(d.sourceName, 240), size: Number(d.size || 0), type: text(d.type, 160),
    active: d.active !== false, versionCount: Math.max(1, versions.length), versions: versions.slice(-12).reverse().map(v => ({sourceName: text(v?.sourceName, 240), size: Number(v?.size || 0), savedAt: iso(v?.savedAt), savedByEmail: text(v?.savedByEmail, 320)})),
    createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt), createdByEmail: text(d.createdByEmail, 320), updatedByEmail: text(d.updatedByEmail, 320)};
}

function resourceService({fs, storage}) {
  const actorOf = people(fs);
  const audit = (actor, event, details) => fs.write('create', `accessAuditLogs/${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`, {
    event, actorUid: actor.uid, actorEmail: actor.email, actorName: actor.name, actorRole: 'admin', runId: null, retailerId: null, retailerName: null, result: details.result ?? null, message: details.message || null, createdAt: SERVER_TIME, via: 'azure-nexus'});
  const idOf = v => { const id = text(v, 96); if (!ID.test(id)) throw new AppError('invalid-argument', 'The resource identifier is invalid.'); return id; };

  async function list() {
    const docs = await fs.query('portalResources', {orderBy: [['updatedAt', 'desc']], limit: 500});
    return {categories: CATEGORIES, resources: docs.map(d => safeResource(d.id, d.data))};
  }

  // Stores a new file version under portal-resources/<id>/ (a new id when none is given); saving the details follows.
  async function upload(user, {id: requested, name, type, data}) {
    const id = requested ? idOf(requested) : `resource-${crypto.randomUUID()}`;
    if (!data?.length) throw new AppError('invalid-argument', 'Choose a file to upload.');
    if (data.length > MAX_BYTES) throw new AppError('resource-exhausted', 'Resource files must be 100 MB or smaller.');
    const sourceName = safeName(name);
    const storagePath = `portal-resources/${id}/${Date.now()}_${sourceName}`;
    const actor = await actorOf(user);
    const saved = await storage.upload(storagePath, data, {type: text(type, 160) || 'application/octet-stream', contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(sourceName)}`, metadata: {resourceId: id, source: 'nexus-resources', uploadedBy: actor.email}, ifGenerationMatch: 0});
    if (Number(saved.size) !== data.length) throw new AppError('unavailable', 'The resource upload did not pass size verification. Try again.');
    return {id, storagePath, sourceName, size: data.length};
  }

  async function save(user, id, body) {
    const resourceId = idOf(id);
    const actor = await actorOf(user);
    const existing = (await fs.get(`portalResources/${resourceId}`))?.data || {};
    const title = text(body.title, 180);
    if (!title) throw new AppError('invalid-argument', 'Resource name is required.');
    const storagePath = text(body.storagePath || existing.storagePath, 500);
    if (!storagePath.startsWith(`portal-resources/${resourceId}/`) || storagePath === `portal-resources/${resourceId}/`) throw new AppError('invalid-argument', existing.storagePath ? 'The resource upload path is invalid.' : 'Upload the resource file before saving it to the catalogue.');
    const sourceName = text(body.sourceName || existing.sourceName, 240);
    if (!sourceName) throw new AppError('invalid-argument', 'Resource file name is required.');
    const meta = await storage.metadata(storagePath);
    if (!meta) throw new AppError('failed-precondition', 'Upload the resource file before saving it to the catalogue.');
    const size = Number(meta.size || 0);
    if (!(size > 0 && size <= MAX_BYTES)) throw new AppError('invalid-argument', 'A resource file must be between 1 byte and 100 MB.');
    const changedFile = storagePath !== text(existing.storagePath, 500);
    const current = Array.isArray(existing.versions) ? existing.versions : [];
    const next = {storagePath, sourceName, size, type: text(meta.contentType, 160) || 'application/octet-stream', savedAt: new Date().toISOString(), savedByEmail: actor.email || null};
    const versions = changedFile ? [...current.filter(v => v?.storagePath !== storagePath), next].slice(-12) : current.length ? current : [next];
    await fs.commit([
      fs.write('merge', `portalResources/${resourceId}`, {title, category: category(body.category), description: text(body.description, 1200), tags: tags(body.tags), storagePath, sourceName, size, type: next.type, active: body.active !== false, versions,
        ...(existing.createdAt ? {} : {createdAt: SERVER_TIME, createdBy: actor.uid, createdByEmail: actor.email || null}), updatedAt: SERVER_TIME, updatedBy: actor.uid, updatedByEmail: actor.email || null}),
      audit(actor, changedFile ? 'resource-file-replaced' : 'resource-saved', {result: resourceId, message: `${changedFile ? 'Saved a new file version for' : 'Saved'} resource ${title}.`})
    ]);
    // Older versions beyond the kept twelve are removed from Storage.
    const kept = new Set(versions.map(v => v.storagePath));
    await Promise.all(current.map(v => v?.storagePath).filter(p => p && !kept.has(p) && p.startsWith(`portal-resources/${resourceId}/`)).map(p => storage.remove(p).catch(() => {})));
    return {resource: safeResource(resourceId, (await fs.get(`portalResources/${resourceId}`)).data)};
  }

  async function download(user, id) {
    const resourceId = idOf(id);
    const doc = await fs.get(`portalResources/${resourceId}`);
    if (!doc) throw new AppError('not-found', 'The resource was not found.');
    const path = text(doc.data.storagePath, 500);
    if (!path.startsWith(`portal-resources/${resourceId}/`)) throw new AppError('failed-precondition', 'The resource file path is invalid.');
    const object = await storage.download(path);
    if (!object) throw new AppError('not-found', 'The resource file was not found in storage.');
    return {...object, name: text(doc.data.sourceName, 240) || 'resource'};
  }

  async function remove(user, id) {
    const resourceId = idOf(id);
    const actor = await actorOf(user);
    const doc = await fs.get(`portalResources/${resourceId}`);
    if (!doc) throw new AppError('not-found', 'The resource was not found.');
    // A file pinned as a shared ETL reference cannot be deleted from under the next run.
    const refs = await fs.query('etlReferenceSets', {limit: 20});
    const pinned = refs.find(r => Object.values(r.data.resources || {}).includes(resourceId));
    if (pinned) throw new AppError('failed-precondition', 'This file is a shared ETL reference. Choose another file in ETLs › Shared files before deleting it.');
    const paths = [...new Set([text(doc.data.storagePath, 500), ...(Array.isArray(doc.data.versions) ? doc.data.versions.map(v => text(v?.storagePath, 500)) : [])].filter(p => p.startsWith(`portal-resources/${resourceId}/`)))];
    await Promise.all(paths.map(p => storage.remove(p)));
    await fs.commit([fs.write('delete', `portalResources/${resourceId}`, {}), audit(actor, 'resource-deleted', {result: resourceId, message: `Deleted resource ${text(doc.data.title, 180) || resourceId} and its stored file version${paths.length === 1 ? '' : 's'}.`})]);
    return {id: resourceId, deletedFiles: paths.length};
  }

  return {list, upload, save, download, remove};
}

module.exports = {resourceService, CATEGORIES, safeName};
