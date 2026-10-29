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

// The StockFix app's adoption API for the preview (server/stockfix/adoption.cjs): invented resources and stores
// across ten weeks, the newest one live.
function stockfixAppSample() {
  const weeks = Array.from({length: 10}, (_, i) => new Date(Date.UTC(2026, 7, 19 + 7 * i)).toISOString().slice(0, 10));
  const regions = [['Gauteng', 'Manager North'], ['Mpumalanga', 'Manager North'], ['Free State', 'Manager Central'], ['Western Cape', 'Manager South'], ['KwaZulu Natal', 'Manager South']];
  const types = ['SYNDICATED REP', 'SYNDICATED MERCHANDISER', 'SYNDICATED MERCHANDISER', 'SYNDICATED MERCHANDISER', 'TEAM LEADER'];
  const week = (w, q = {}) => {
    const byRep = [];
    regions.forEach(([region, manager], r) => types.forEach((resourceType, t) => { for (let k = 0; k < 4; k++) {
      const completed = (w * 3 + r * 5 + t * 7 + k * 11) % 9 < 3 + Math.min(w, 4) ? (r + t + k + w) % 12 : 0;
      byRep.push({rep: `${region} ${resourceType.toLowerCase().includes('merch') ? 'Merchandiser' : 'Rep'} ${t * 4 + k + 1}`, completed, open: 6 - (completed % 6), resourceType, region, manager, banner: k % 2 ? 'Banner Two' : 'Banner One', client: t % 2 ? 'Example Drinks' : 'Sample Foods'});
    } }));
    const reps = byRep.filter(r => (!q.region || r.region.toUpperCase() === q.region.toUpperCase()) && (!q.client || r.client === q.client));
    const byStore = Array.from({length: 40}, (_, s) => ({store: `Sample Store ${String(s + 1).padStart(2, '0')}`, completed: (s * 7 + w) % 5 ? (s + w) % 9 : 0, open: (s + w) % 4}));
    const byRegion = regions.map(([region]) => { const mine = reps.filter(r => r.region === region), active = mine.filter(r => r.completed > 0).length; return {region, completed: mine.reduce((s, r) => s + r.completed, 0), open: mine.reduce((s, r) => s + r.open, 0), totalPeople: mine.length, activePeople: active, adoptionPct: mine.length ? Math.round(active / mine.length * 1000) / 10 : 0}; });
    const byManager = [...new Set(reps.map(r => r.manager))].map(manager => {
      const mine = reps.filter(r => r.manager === manager), role = m => { const c = mine.filter(r => m(r.resourceType)); return {totalPeople: c.length, activePeople: c.filter(r => r.completed > 0).length}; };
      const active = mine.filter(r => r.completed > 0).length;
      return {manager, totalPeople: mine.length, activePeople: active, adoptionPct: Math.round(active / mine.length * 1000) / 10, reps: role(t => !t.includes('MERCH')), merchandisers: role(t => t.includes('MERCH'))};
    });
    return {week: weeks[w], totals: {completed: reps.reduce((s, r) => s + r.completed, 0), open: reps.reduce((s, r) => s + r.open, 0)}, byRep: reps, byStore, byRegion, byManager,
      byClient: [{client: 'Sample Foods'}, {client: 'Example Drinks'}],
      recent: reps.filter(r => r.completed).flatMap((r, i) => Array.from({length: Math.min(r.completed, 2)}, (_, k) => ({weekEnding: weeks[w], actionDate: weeks[w], client: r.client, region: r.region, banner: r.banner, store: `Sample Store ${String((i + k) % 40 + 1).padStart(2, '0')}`,
        rep: r.rep, manager: r.manager, barcode: String(6001000 + i), articleDescription: `Sample item ${(i + k) % 9 + 1}`, stockClassification: ['Overstock', 'Out of Stock', 'Negative SOH'][k % 3], action: 'Check count', actionStatus: 'Completed',
        reasonCode: k ? 'Stock count corrected' : '', storeSoh: 10 + k, feedback: k ? '' : 'Checked and corrected', image1: k ? '' : '/objects/sample-photo'})))};
  };
  const parse = qs => Object.fromEntries(new URLSearchParams(qs || ''));
  const stats = w => { const reps = week(w).byRep, rate = m => { const c = reps.filter(r => m(r.resourceType)); return Math.round(c.filter(r => r.completed > 0).length / c.length * 1000) / 10; }; return {week: weeks[w], repPct: rate(t => !t.includes('MERCH')), merchPct: rate(t => t.includes('MERCH'))}; };
  return {
    weeks: async () => ({weeks: weeks.map((weekEnding, i) => ({weekEnding, live: i === weeks.length - 1})).reverse()}),
    live: async qs => week(weeks.length - 1, parse(qs)),
    snapshot: async (w, qs) => (weeks.includes(w) ? week(weeks.indexOf(w), parse(qs)) : null),
    month: async (m, qs) => { const inMonth = weeks.filter(w => w.startsWith(m)); return inMonth.length ? {...week(weeks.indexOf(inMonth.at(-1)), parse(qs)), week: null, month: m, weeksIncluded: inMonth} : null; },
    period: async (list, qs) => { const known = list.filter(w => weeks.includes(w)); return known.length ? {...week(weeks.indexOf(known.at(-1)), parse(qs)), week: null, weeksIncluded: known} : null; },
    clients: async () => ({clients: ['Example Drinks', 'Sample Foods']}),
    trend: async () => { const trend = weeks.map((_, i) => stats(i)); return {trend, overall: {repPct: trend.reduce((s, r) => s + r.repPct, 0) / trend.length, merchPct: trend.reduce((s, r) => s + r.merchPct, 0) / trend.length}}; }
  };
}

module.exports = {previewRepo, stockfixSample, stockfixAppSample};
