'use strict';
// Sample data for local preview only (NEXUS_PREVIEW with no SQL configured). Invented people; never deployed data.
const now = Date.now();
const iso = minutesAgo => new Date(now - minutesAgo * 60000).toISOString();
const user = (email, name, surname, role, extra = {}) => ({id: email.replace(/\W/g, ''), path: `adminUsers/${email}`, updatedAt: iso(600), data: {
  email, name, surname, role, accountType: 'staff', disabled: false, updatedAt: iso(900),
  permissions: {allowedNavigationIds: role === 'admin' ? [] : ['automation', 'chat'], allowedRetailerIds: [], runJobs: true, manageSchedules: false, viewAllAudit: false, chatEnabled: true},
  chatAccess: {audience: 'internal', workRole: 'Field operations'}, ...extra
}});

const USERS = [
  user('preview@meridiangroup.co.za', 'Local', 'Preview', 'admin'),
  user('sample.admin@example.com', 'Ayanda', 'Sample', 'admin'),
  user('field.lead@example.com', 'Pieter', 'Example', 'normal', {permissions: {allowedNavigationIds: ['attendance', 'franchiseorder', 'automation', 'chat'], allowedRetailerIds: ['geo-rep-attendance-for-reps'], runJobs: true, manageSchedules: true, viewAllAudit: false, chatEnabled: true}}),
  user('analyst@example.com', 'Naledi', 'Placeholder', 'normal', {permissions: {allowedNavigationIds: ['automation'], allowedRetailerIds: [], runJobs: true, manageSchedules: false, viewAllAudit: false, chatEnabled: false}}),
  user('former.staff@example.com', 'Johan', 'Demo', 'normal', {disabled: true})
];
const RETAILERS = [
  {id: 'geo-rep-attendance-for-reps', path: 'retailers/geo-rep-attendance-for-reps', updatedAt: iso(300), data: {name: 'Geo Rep Attendance (reps)'}},
  {id: 'geo-rep-sales-transactions', path: 'retailers/geo-rep-sales-transactions', updatedAt: iso(300), data: {name: 'Geo Rep Sales transactions'}}
];

function previewRepo() {
  return {
    async collection(name) { return name === 'adminUsers' ? USERS : name === 'retailers' ? RETAILERS : []; },
    async findUserByEmail(email) { return USERS.find(u => u.data.email === email) || null; },
    async syncStatus() {
      const run = (id, minutesAgo, mode, status, read, written, error = null) => ({id, mode, status, started_at: iso(minutesAgo), finished_at: iso(minutesAgo - 2), documents_read: read, documents_written: written, documents_deleted: 0, error});
      return {runs: [run(4, 15, 'hourly', 'succeeded', 4120, 37), run(3, 75, 'hourly', 'succeeded', 4098, 52), run(2, 135, 'hourly', 'partial', 3990, 41, 'files: Firestore runQuery 503'), run(1, 600, 'nightly', 'succeeded', 74516, 69458)],
        collections: [{collection: 'adminUsers', field: null, last_value: null, last_full_at: iso(15), document_count: USERS.length, updated_at: iso(15)}, {collection: 'files', field: 'uploadedAt', last_value: iso(30), last_full_at: iso(600), document_count: 14636, updated_at: iso(15)}]};
    },
    sample: true
  };
}

module.exports = {previewRepo};
