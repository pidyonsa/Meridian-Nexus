'use strict';
// StockFix weekly reporting figures from the rollups and week files the StockFix dashboard-generator publishes
// (source.cjs). Measures and wording follow the StockFix Field Performance dashboard (meridian-group-za/stockfix-dashboard
// index.html, read 29 October 2026): a task is actioned when its status is Completed or Fixed or contains "Actioned",
// pending when it contains "Pending"; capture means the rep left feedback; Action Impact compares feedback tasks with
// the same store and SKU over the four weeks after them.

const FILTERS = ['client', 'banner', 'region'];
const STATUSES = ['actioned', 'pending', 'escalated'];
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 50;
const TREND_WEEKS = 12;
const HEAT_WEEKS = 4;
const IMPACT_SUMS = ['feedbackTasks', 'matchedTasks', 'feedbackStores', 'matchedStores', 'impactedStores', 'overstockTasks', 'overstockReducedTasks', 'overstockSohReduced', 'availabilityRiskTasks',
  'availabilityRestoredTasks', 'availabilitySohRestored', 'salesImprovedTasks', 'salesUnitsGained', 'noSalesTasks', 'noSalesResolvedTasks', 'negativeSohTasks', 'negativeSohResolvedTasks'];

// Whitespace collapsed, as the generator's normalise_rollup_value does (summary.json keeps the raw text).
const clean = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = value => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const numOrNull = value => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const rate = (part, whole) => (whole ? part / whole : 0);
const isActioned = s => s === 'Completed' || s === 'Fixed' || String(s || '').includes('Actioned');
const isPending = s => String(s || '').includes('Pending');
const isEscalated = s => String(s || '').includes('Escalated');
const hasFeedback = value => clean(value) !== '';
const distinct = (rows, field) => new Set(rows.map(r => clean(r[field])).filter(Boolean)).size;

function groupBy(rows, field, fallback = 'Unknown') {
  const groups = new Map();
  for (const row of rows) {
    const key = clean(row[field], 120) || fallback;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

// Only known filters with short text values; anything else is ignored.
function cleanFilters(input = {}) {
  const out = {};
  for (const key of FILTERS) { const v = clean(input[key]); if (v) out[key] = v; }
  return out;
}
const matches = (row, filters) => Object.entries(filters).every(([key, value]) => clean(row[key]) === value);

function cleanRowFilters(input = {}) {
  const status = String(input.status || '').toLowerCase();
  return {classification: clean(input.classification), status: STATUSES.includes(status) ? status : '', q: clean(input.q, 80).toLowerCase()};
}

const weekList = index => [...new Set((index || []).map(w => String(w?.week || '')).filter(w => WEEK.test(w)))].sort();
// The asked week when it was published, else the newest; and the week before it.
function pickWeek(weeks, asked) {
  const week = weeks.includes(asked) ? asked : weeks.at(-1) || null;
  return {week, priorWeek: week ? weeks[weeks.indexOf(week) - 1] || null : null};
}

// Tasks by status, from summary rows (one row per week, client, banner, region, classification and status).
function statusTotals(rows) {
  const t = {tasks: 0, actioned: 0, pending: 0, escalated: 0};
  for (const r of rows) {
    const c = num(r.count);
    t.tasks += c;
    if (isActioned(r.actionStatus)) t.actioned += c;
    if (isPending(r.actionStatus)) t.pending += c;
    if (isEscalated(r.actionStatus)) t.escalated += c;
  }
  return {...t, completion: rate(t.actioned, t.tasks)};
}
const statusBreakdown = (rows, field, limit = 12, fallback = 'Unknown') => [...groupBy(rows, field, fallback)].map(([label, group]) => ({label, ...statusTotals(group)}))
  .sort((a, b) => b.tasks - a.tasks || a.label.localeCompare(b.label)).slice(0, limit);

function overview({summary, weeks, week, priorWeek, rows, filters}) {
  const of = w => summary.filter(r => r.week === w && matches(r, filters));
  const current = of(week);
  const selected = rows ? rows.filter(r => matches(r, filters)) : null;
  return {
    totals: {...statusTotals(current), stores: selected ? distinct(selected, 'store') : null, skus: selected ? distinct(selected, 'barcode') : null, feedback: selected ? selected.filter(r => hasFeedback(r.feedback)).length : null},
    prior: priorWeek ? statusTotals(of(priorWeek)) : null,
    trend: weeks.filter(w => w <= week).slice(-TREND_WEEKS).map(w => ({week: w, ...statusTotals(of(w))})),
    byClassification: statusBreakdown(current, 'classification', 12, 'Unclassified'),
    byStatus: statusBreakdown(current, 'actionStatus'),
    byClient: statusBreakdown(current, 'client'),
    byBanner: statusBreakdown(current, 'banner'),
    byRegion: statusBreakdown(current, 'region')
  };
}

// Capture (feedback left) against tasks assigned, from leaderboard rows (one per week, client, banner, region,
// manager and rep). Stores are summed over those rows, so a store shared by two reps counts twice.
function captureTotals(rows) {
  const t = {assigned: 0, captured: 0, storesAssigned: 0, storesCaptured: 0};
  for (const r of rows) { t.assigned += num(r.tasksAssigned); t.captured += num(r.tasksCaptured); t.storesAssigned += num(r.storesAssigned); t.storesCaptured += num(r.storesCaptured); }
  return {...t, rate: rate(t.captured, t.assigned), storeRate: rate(t.storesCaptured, t.storesAssigned)};
}
const captureBreakdown = (rows, field, fallback = 'Unknown') => [...groupBy(rows, field, fallback)].map(([label, group]) => ({label, ...captureTotals(group)}))
  .sort((a, b) => b.assigned - a.assigned || a.label.localeCompare(b.label));

function leaderboard({rows: all, weeks, week, priorWeek, filters}) {
  const of = w => all.filter(r => r.week === w && matches(r, filters));
  const current = of(week);
  const reps = [...groupBy(current, 'rep', 'Unassigned')].map(([rep, group]) => ({
    rep, manager: [...new Set(group.map(r => clean(r.manager) || 'Unassigned'))].join(', '), resourceType: clean(group.find(r => clean(r.resourceType))?.resourceType) || '',
    regions: [...new Set(group.map(r => clean(r.region)).filter(Boolean))].sort().join(', '), ...captureTotals(group)
  })).sort((a, b) => b.rate - a.rate || b.assigned - a.assigned || a.rep.localeCompare(b.rep));
  const heatWeeks = weeks.filter(w => w <= week).slice(-HEAT_WEEKS);
  const heatRows = all.filter(r => heatWeeks.includes(r.week) && matches(r, filters));
  const regions = [...groupBy(heatRows, 'region')].map(([region, group]) => ({region, cells: heatWeeks.map(w => { const t = captureTotals(group.filter(r => r.week === w)); return t.assigned ? {rate: t.rate, assigned: t.assigned, captured: t.captured} : null; })}))
    .sort((a, b) => a.region.localeCompare(b.region));
  return {
    totals: {...captureTotals(current), reps: reps.length, managers: distinct(current, 'manager')},
    prior: priorWeek ? captureTotals(of(priorWeek)) : null,
    byManager: captureBreakdown(current, 'manager', 'Unassigned'),
    byResourceType: captureBreakdown(current, 'resourceType', 'Not recorded'),
    reps,
    heat: {weeks: heatWeeks, regions}
  };
}

function impactTotals(rows) {
  const t = Object.fromEntries(IMPACT_SUMS.map(k => [k, 0]));
  for (const r of rows) for (const k of IMPACT_SUMS) t[k] += num(r[k]);
  return {...t, matchRate: rate(t.matchedTasks, t.feedbackTasks), salesImprovementRate: rate(t.salesImprovedTasks, t.matchedTasks), overstockReductionRate: rate(t.overstockReducedTasks, t.overstockTasks),
    availabilityRestoreRate: rate(t.availabilityRestoredTasks, t.availabilityRiskTasks), noSalesResolveRate: rate(t.noSalesResolvedTasks, t.noSalesTasks), negativeSohResolveRate: rate(t.negativeSohResolvedTasks, t.negativeSohTasks)};
}

// The comparison that ends on the selected week (or the latest one before it). The generator needs five published
// weeks before it writes any.
function impact({rows: all, week, filters}) {
  const targets = [...new Set(all.map(r => String(r.targetWeek || '')).filter(w => WEEK.test(w)))].sort();
  const target = week ? targets.filter(w => w <= week).at(-1) || null : null;
  if (!target) return {available: false, targets};
  const forTarget = all.filter(r => r.targetWeek === target);
  const current = forTarget.filter(r => matches(r, filters));
  const breakdown = field => [...groupBy(current, field, 'Unassigned')].map(([label, group]) => ({label, ...impactTotals(group)})).sort((a, b) => b.feedbackTasks - a.feedbackTasks || a.label.localeCompare(b.label));
  return {available: true, targets, targetWeek: target, baselineWeek: forTarget[0]?.baselineWeek || null, totals: impactTotals(current), byManager: breakdown('manager'), byClient: breakdown('client')};
}

// The selected week's figures: filter options, Overview, Leaderboard and Action Impact.
function dashboard({data, week: asked, rows = null, filters = {}}) {
  const weeks = weekList(data.weeks);
  const {week, priorWeek} = pickWeek(weeks, asked);
  const base = {weeks: [...weeks].reverse(), week, priorWeek, updatedAt: data.updatedAt || null};
  if (!week) return {...base, filters: {clients: [], banners: [], regions: []}, overview: null, leaderboard: null, impact: {available: false, targets: []}};
  const ofWeek = data.summary.filter(r => r.week === week);
  // Each list narrowed by the other filters, so a choice never leads to an empty selection.
  const options = field => { const others = Object.fromEntries(Object.entries(filters).filter(([k]) => k !== field)); return [...new Set(ofWeek.filter(r => matches(r, others)).map(r => clean(r[field], 120)).filter(Boolean))].sort((a, b) => a.localeCompare(b)); };
  return {
    ...base,
    weekRows: rows ? rows.length : null,
    filters: {clients: options('client'), banners: options('banner'), regions: options('region')},
    overview: overview({summary: data.summary, weeks, week, priorWeek, rows, filters}),
    leaderboard: leaderboard({rows: data.leaderboard, weeks, week, priorWeek, filters}),
    impact: impact({rows: data.impact, week, filters})
  };
}

// One store task as the table and the Excel download show it.
const line = r => ({week: r.week || '', client: clean(r.client), banner: clean(r.banner), region: clean(r.region), store: clean(r.store), rep: clean(r.rep), manager: clean(r.manager), resourceType: clean(r.resourceType),
  category: clean(r.category), barcode: clean(r.barcode, 40), article: clean(r.article), storeSoh: numOrNull(r.storeSoh), dcSoh: numOrNull(r.dcSoh), p4Sales: numOrNull(r.p4Sales), storeWfc: numOrNull(r.storeWfc),
  missedSales: numOrNull(r.missedSales), classification: clean(r.classification), action: clean(r.action), actionStatus: clean(r.actionStatus), actionDate: clean(r.actionDate, 40), reasonCode: clean(r.reasonCode),
  feedback: clean(r.feedback, 500), actionComment: clean(r.actionComment, 500), physicalCount: numOrNull(r.physicalCount), variance: numOrNull(r.variance), systemAdjusted: clean(r.systemAdjusted, 20)});

function selectRows(rows, filters, rowFilters) {
  const {classification, status, q} = rowFilters;
  return rows.filter(r => matches(r, filters)
    && (!classification || clean(r.classification) === classification)
    && (!status || (status === 'actioned' ? isActioned(r.actionStatus) : status === 'pending' ? isPending(r.actionStatus) : isEscalated(r.actionStatus)))
    && (!q || [r.store, r.article, r.barcode, r.rep, r.manager].some(v => clean(v).toLowerCase().includes(q))))
    .map(line).sort((a, b) => a.store.localeCompare(b.store) || a.article.localeCompare(b.article));
}

// Store-level detail: the week's tasks after the filters, PAGE_SIZE a page.
function detail(rows, filters, rowFilters, page = 1) {
  const inScope = rows.filter(r => matches(r, filters));
  const selected = selectRows(rows, filters, rowFilters);
  const pageCount = Math.max(1, Math.ceil(selected.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pageCount);
  return {totalRows: selected.length, page: current, pageCount, pageSize: PAGE_SIZE, records: selected.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    options: {classifications: [...new Set(inScope.map(r => clean(r.classification, 120)).filter(Boolean))].sort((a, b) => a.localeCompare(b))}};
}

module.exports = {FILTERS, STATUSES, WEEK, PAGE_SIZE, cleanFilters, cleanRowFilters, matches, weekList, pickWeek, isActioned, isPending, statusTotals, captureTotals, impactTotals, dashboard, detail, selectRows, line};
