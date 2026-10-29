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

// StockFix reporting for the preview: six weeks of invented clients, stores, reps and tasks, in the shape of the
// SharePoint dashboard-data files (server/stockfix/source.cjs).
function stockfixSample() {
  const weeks = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'];
  const clients = [['Sample Foods', 'Banner One'], ['Example Drinks', 'Banner Two']], regions = ['Central', 'Inland', 'Coastal'];
  const reps = [['Rep Alpha', 'Manager North'], ['Rep Bravo', 'Manager North'], ['Rep Charlie', 'Manager South'], ['Rep Delta', 'Manager South']];
  const classes = [['Overstock', 'Overstock: move to display'], ['Out of Stock', 'Place order'], ['Negative SOH', 'Fix counts: negative SOH'], ['No Sales (Idle Stock)', 'Check count: no sales']];
  const summary = [], leaderboard = [], impact = [], rows = {};
  weeks.forEach((week, w) => {
    rows[week] = [];
    clients.forEach(([client, banner], c) => regions.forEach((region, r) => reps.forEach(([rep, manager], p) => {
      const store = `${banner} ${region} ${p + 1}`;
      classes.forEach(([classification, action], k) => {
        const done = (w + c + r + p + k) % 3 !== 0, actionStatus = done ? 'Completed' : 'Pending';
        rows[week].push({week, client, banner, region, store, rep, manager, resourceType: p % 2 ? 'SYNDICATED MERCHANDISER' : 'SYNDICATED REP', barcode: String(6001000 + c * 100 + k), article: `${client} item ${k + 1}`,
          storeSoh: classification === 'Negative SOH' ? -3 : 10 + k * 7, dcSoh: 120 - k * 10, p4Sales: classification === 'No Sales (Idle Stock)' ? 0 : 4 + k, storeWfc: 2 + k, classification, action, actionStatus, feedback: done ? 'Checked and corrected' : ''});
      });
    })));
    const by = new Map();
    for (const t of rows[week]) {
      const key = [t.client, t.banner, t.region, t.classification, t.actionStatus].join('|');
      by.set(key, (by.get(key) || 0) + 1);
    }
    for (const [key, count] of by) { const [client, banner, region, classification, actionStatus] = key.split('|'); summary.push({week, client, banner, region, classification, actionStatus, count}); }
    clients.forEach(([client, banner]) => regions.forEach(region => reps.forEach(([rep, manager], p) => {
      const mine = rows[week].filter(t => t.client === client && t.region === region && t.rep === rep), captured = mine.filter(t => t.feedback).length;
      leaderboard.push({week, client, banner, region, manager, rep, resourceType: mine[0].resourceType, tasksAssigned: mine.length, tasksCaptured: captured, storesAssigned: 1, storesCaptured: captured ? 1 : 0});
      if (w >= 4) impact.push({baselineWeek: weeks[w - 4], targetWeek: week, client, banner, region, manager, rep, feedbackTasks: captured, matchedTasks: captured, feedbackStores: 1, matchedStores: 1, impactedStores: p % 2,
        overstockTasks: 1, overstockReducedTasks: p % 2, overstockSohReduced: 6 * (p % 2), availabilityRiskTasks: 1, availabilityRestoredTasks: 1, availabilitySohRestored: 8, salesImprovedTasks: Math.min(captured, 1 + (p % 2)), salesUnitsGained: 3,
        noSalesTasks: 1, noSalesResolvedTasks: (p + w) % 2, negativeSohTasks: 1, negativeSohResolvedTasks: 1});
    })));
  });
  return {weeks: weeks.map(week => ({week, rowCount: rows[week].length})), summary, leaderboard, impact, rows, updatedAt: iso(240)};
}

module.exports = {previewRepo, stockfixSample};
