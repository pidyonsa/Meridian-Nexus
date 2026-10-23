'use strict';
// Admin API. Read-only during the migration: the Firebase portal is still where users and settings are changed.
const {requireAdmin} = require('../auth.cjs');
const {SECTIONS} = require('../access.cjs');

const KNOWN_SECTIONS = new Set(SECTIONS);
const iso = value => (value ? new Date(value).toISOString() : null);

// Only fields the directory needs; never anything credential-like.
function directoryEntry(doc, retailerNames) {
  const d = doc.data || {};
  const p = d.permissions || {};
  const sections = Array.isArray(p.allowedNavigationIds) ? p.allowedNavigationIds.filter(id => KNOWN_SECTIONS.has(id)) : [];
  return {
    id: doc.id,
    email: String(d.email || '').toLowerCase(),
    name: [d.name, d.surname].filter(Boolean).join(' ') || String(d.email || '').split('@')[0],
    role: d.role === 'admin' ? 'admin' : d.accountType === 'client' || d.chatAccess?.audience === 'external' ? 'client' : 'staff',
    disabled: d.disabled === true,
    sections: d.role === 'admin' ? ['all'] : sections,
    retailers: (Array.isArray(p.allowedRetailerIds) ? p.allowedRetailerIds : []).map(id => ({id, name: retailerNames.get(id) || id})),
    flags: {runJobs: p.runJobs !== false, manageSchedules: p.manageSchedules === true, viewAllAudit: p.viewAllAudit === true, chatEnabled: p.chatEnabled !== false},
    workRole: d.chatAccess?.workRole || null,
    updatedAt: iso(d.updatedAt || doc.updatedAt)
  };
}

function adminRoutes(repo) {
  return app => {
    app.get('/api/admin/users', requireAdmin, async (req, res, next) => {
      try {
        const [users, retailers] = await Promise.all([repo.collection('adminUsers'), repo.collection('retailers')]);
        const names = new Map(retailers.map(r => [r.id, r.data?.name || r.id]));
        const list = users.filter(u => u.data?.email).map(u => directoryEntry(u, names)).sort((a, b) => a.name.localeCompare(b.name));
        const syncedAt = users.reduce((max, u) => (u.updatedAt && (!max || u.updatedAt > max) ? u.updatedAt : max), null);
        res.json({users: list, syncedAt: iso(syncedAt), sample: Boolean(repo.sample)});
      } catch (error) { next(error); }
    });
    app.get('/api/admin/sync', requireAdmin, async (req, res, next) => {
      try {
        const {runs, collections} = await repo.syncStatus();
        res.json({sample: Boolean(repo.sample), runs: runs.map(r => ({id: Number(r.id), mode: r.mode, status: r.status, startedAt: iso(r.started_at), finishedAt: iso(r.finished_at), read: r.documents_read, written: r.documents_written, deleted: r.documents_deleted, error: r.error})),
          collections: collections.map(c => ({name: c.collection, field: c.field, lastFullAt: iso(c.last_full_at), documents: c.document_count, updatedAt: iso(c.updated_at)}))});
      } catch (error) { next(error); }
    });
  };
}

module.exports = {adminRoutes, directoryEntry};
