'use strict';
// StockFix Adoption (the StockFix app's /adoption/ page, which Nexus used to link to), inside Nexus. The figures come
// from the StockFix app's own API (stock-fix.replit.app: /api/live-dashboard, /api/adoption-snapshot,
// /api/admin/adoption-weeks, /api/admin/adoption-trend), read server-side; the calculations below repeat that page's
// (the page served at stock-fix.replit.app/adoption/, model() and renderVals(), read 29 October 2026; newer than the
// copy in cpillay2404/Stockfix, which counts the role cards differently) so the
// numbers match it: adoption = resources with work this week who captured at least once, Reps and Merchandisers
// separately; store coverage = stores with a capture; dormant = resources with work but no capture.
//   GET /api/stockfix/adoption   ?week=YYYY-MM-DD&client=&region=&manager=&banner=&rtype=
//                                &month=YYYY-MM | &weeks=YYYY-MM-DD,…  a calendar month, or a custom period of saved weeks
//                                &store=
//   GET /api/stockfix/adoption/captures   same query + q=&page=   the captures in scope, 36 a page
//   GET /api/stockfix/adoption/export     same query + kind=<resources|managers|stores|captures>   an Excel workbook
// No week (or the live week): the live figures; an earlier week: its saved snapshot; a month or period: the StockFix
// app's combined totals for those weeks.
const ExcelJS = require('exceljs');
const {AppError} = require('../errors.cjs');

const BASE = 'https://stock-fix.replit.app';
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const FILTERS = ['client', 'store', 'region', 'manager', 'banner', 'rtype'];
const CAPTURE_PAGE = 36;
const HEAVY_AT = 5;            // captures that make a resource "habitual" (the page's heavyUseAt default)
const CACHE_MS = 60 * 1000;    // the StockFix app's live query is a full scan; one answer serves a minute of views
const DIVISION_BY_REGION = {'FREE STATE': 'Central', 'NORTH WEST': 'Central', GAUTENG: 'Inland', LIMPOPO: 'Inland', MPUMALANGA: 'Inland', 'WESTERN CAPE': 'Coastal',
  'KWAZULU NATAL': 'Coastal', 'KWA-ZULU NATAL': 'Coastal', 'EASTERN CAPE': 'Coastal', 'EAST LONDON': 'Coastal', 'EAST LONDON/EASTERN CAPE': 'Coastal', 'PORT ELIZABETH': 'Coastal',
  'PE OPERATIONS': 'Coastal', SWD: 'Coastal', 'SWD OPERATIONS': 'Coastal'};
const DIVISIONS = ['Inland', 'Central', 'Coastal', 'Unmapped'];
const UNKNOWN = /^(unknown|unspecified|n\/?a|none|null|other|—|-)$/i;

const text = (v, max = 120) => String(v ?? '').trim().slice(0, max);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return String(o[k]); return ''; };
const REGION_KEYS = ['region', 'regionName', 'Region'], MANAGER_KEYS = ['manager', 'managerName', 'managerFullName', 'reportsTo', 'Manager'], BANNER_KEYS = ['banner', 'bannerName', 'Banner'];
const titleCase = v => String(v).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
const uniq = list => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function cleanFilters(input = {}) {
  const out = {};
  for (const key of FILTERS) { const v = text(input[key]); if (v) out[key] = v; }
  return out;
}
// The query the StockFix app expects (same names; it upper-cases region, manager, rtype and banner itself).
const appQuery = filters => new URLSearchParams(Object.entries(filters)).toString();

// The StockFix app's API, read server-side and cached briefly per address.
function stockfixAppSource({base = BASE, fetchImpl = fetch, now = () => Date.now(), timeoutMs = 90 * 1000} = {}) {
  const cache = new Map();
  function get(path) {
    const hit = cache.get(path);
    if (hit && hit.expires > now()) return hit.value;
    const value = (async () => {
      let res;
      try { res = await fetchImpl(base + path, {headers: {accept: 'application/json'}, redirect: 'error', signal: AbortSignal.timeout(timeoutMs)}); } catch (error) {
        throw new AppError('unavailable', `The StockFix app could not be reached (${String(error.message || error).slice(0, 120)}).`);
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new AppError('unavailable', `The StockFix app did not answer (${res.status}). Try again in a minute.`);
      return res.json();
    })();
    cache.set(path, {value, expires: now() + CACHE_MS});
    value.catch(() => cache.delete(path));
    while (cache.size > 200) cache.delete(cache.keys().next().value);
    return value;
  }
  const q = qs => (qs ? `?${qs}` : '');
  return {
    weeks: () => get('/api/admin/adoption-weeks'),
    live: qs => get(`/api/live-dashboard${q(qs)}`),
    snapshot: (week, qs) => get(`/api/adoption-snapshot?week=${encodeURIComponent(week)}${qs ? `&${qs}` : ''}`),
    month: (month, qs) => get(`/api/admin/adoption-month?month=${encodeURIComponent(month)}${qs ? `&${qs}` : ''}`),
    period: (weeks, qs) => get(`/api/admin/adoption-period?weeks=${encodeURIComponent(weeks.join(','))}${qs ? `&${qs}` : ''}`),
    trend: qs => get(`/api/admin/adoption-trend${q(qs)}`),
    clients: () => get('/api/roster/all-clients'),
    storesForClient: client => get(`/api/roster/stores-for-client?client=${encodeURIComponent(client)}`)
  };
}
// A list answer from the roster endpoints: a plain array or {clients|stores: [...]}, of strings or {name|client|store}.
const names = answer => uniq((Array.isArray(answer) ? answer : Object.values(answer || {}).find(Array.isArray) || [])
  .map(v => text(typeof v === 'string' ? v : v?.name ?? v?.client ?? v?.store ?? v?.value, 160)));

// One week's Adoption figures. data: the StockFix app's answer for the week and filters; ref: the unfiltered live
// answer (filter lists); trend: the adoption-trend answer.
function adoptionModel({data, ref = data, trend = null, filters = {}}) {
  const d = data || {};
  // "Reports to (Rep)": a merchandiser's direct manager, when that person is a rep (not a line manager).
  const typeByName = new Map((Array.isArray(ref?.byRep) ? ref.byRep : []).map(r => [String(r.rep || '').trim().toUpperCase(), String(r.resourceType || '')]));
  const isRepName = name => { const t = typeByName.get(String(name || '').trim().toUpperCase()); return Boolean(t) && !t.toUpperCase().includes('MERCHANDISER'); };
  const reps = (Array.isArray(d.byRep) ? d.byRep : []).map(r => {
    const resourceType = String(r.resourceType || 'Unspecified'), direct = text(r.directManager);
    return {rep: String(r.rep ?? '—'), completed: num(r.completed), open: num(r.open), resourceType, region: pick(r, REGION_KEYS), manager: pick(r, MANAGER_KEYS), banner: pick(r, BANNER_KEYS),
      reportsToRep: resourceType.toUpperCase().includes('MERCHANDISER') && isRepName(direct) ? direct : '', stores: text(r.stores, 4000)};
  }).filter(r => (!filters.rtype || r.resourceType === filters.rtype) && (!filters.region || r.region === filters.region)
    && (!filters.manager || r.manager === filters.manager) && (!filters.banner || r.banner === filters.banner));

  const recent = (Array.isArray(d.recent) ? d.recent : []).filter(r => (!filters.region || pick(r, REGION_KEYS) === filters.region)
    && (!filters.manager || pick(r, MANAGER_KEYS) === filters.manager) && (!filters.banner || pick(r, BANNER_KEYS) === filters.banner));
  const scoped = Boolean(filters.region || filters.manager || filters.banner);
  const scopedStores = scoped ? new Set(recent.map(r => String(r.store || '')).filter(Boolean)) : null;
  const stores = (Array.isArray(d.byStore) ? d.byStore : []).map(x => ({store: String(x.store ?? '—'), completed: num(x.completed), open: num(x.open)}))
    .filter(x => !scopedStores || scopedStores.size === 0 || scopedStores.has(x.store));

  const refReps = Array.isArray(ref?.byRep) ? ref.byRep : [];
  const fine = Boolean(filters.region || filters.manager || filters.rtype || filters.banner);
  // Cards: without a region, manager, type or banner filter, the StockFix app's own adoptionByRole totals; with one,
  // the resources above, the role matched loosely by name.
  const roles = Array.isArray(d.adoptionByRole) ? d.adoptionByRole : [];
  const role = want => {
    const match = v => { const t = String(v || '').toLowerCase(); return t === want || t.includes(want); };
    const e = !fine && (roles.find(x => match(x.role)) || roles.find(x => match(x.resourceType)));
    if (e) return {active: num(e.activePeople), total: num(e.totalPeople), pct: num(e.adoptionPct)};
    const cohort = reps.filter(r => match(r.resourceType)), active = cohort.filter(r => r.completed > 0).length;
    return {active, total: cohort.length, pct: pct(active, cohort.length)};
  };
  const completed = fine ? reps.reduce((s, r) => s + r.completed, 0) : num(d.totals?.completed);
  const open = fine ? reps.reduce((s, r) => s + r.open, 0) : num(d.totals?.open);
  const touched = stores.filter(x => x.completed > 0).length;

  // Regions: the StockFix app's byRegion (captures, people, adoption and its Reps/Merchandisers split) unless a
  // resource type is chosen; then captures from the resources above, and the role split counted from them.
  const regionAgg = new Map();
  const ensure = k => {
    const key = String(k).trim().toUpperCase();
    if (!key || UNKNOWN.test(key)) return null;
    if (!regionAgg.has(key)) regionAgg.set(key, {label: titleCase(k), completed: 0, open: 0, totalPeople: null, activePeople: null, adoptionPct: null, repsPct: null, merchPct: null, reps: [0, 0], merch: [0, 0]});
    return regionAgg.get(key);
  };
  const addRole = (e, name, active, total) => { const t = String(name || '').toLowerCase(), slot = t.includes('merch') ? e.merch : t.includes('rep') ? e.reps : null; if (slot) { slot[0] += num(active); slot[1] += num(total); } };
  const apiRegions = !filters.rtype && Array.isArray(d.byRegion) ? d.byRegion : null;
  if (apiRegions) {
    for (const x of apiRegions) {
      const k = pick(x, REGION_KEYS) || String(x.name ?? x.label ?? '');
      if (filters.region && k !== filters.region) continue;
      const e = ensure(k);
      if (!e) continue;
      e.completed += num(x.completed); e.open += num(x.open);
      if (x.totalPeople != null) e.totalPeople = (e.totalPeople || 0) + num(x.totalPeople);
      if (x.activePeople != null) e.activePeople = (e.activePeople || 0) + num(x.activePeople);
      if (x.adoptionPct != null) e.adoptionPct = num(x.adoptionPct);
      for (const [slot, r] of [['reps', x.reps], ['merch', x.merchandisers || x.merch]]) {
        if (!r) continue;
        if (r.adoptionPct != null) e[`${slot}Pct`] = num(r.adoptionPct);
        e[slot][0] += num(r.activePeople); e[slot][1] += num(r.totalPeople);
      }
      const nested = x.byRole || x.roles || x.adoptionByRole;
      if (Array.isArray(nested)) for (const r of nested) addRole(e, r.role || r.resourceType, r.activePeople, r.totalPeople);
    }
  } else {
    for (const k of uniq(refReps.map(r => pick(r, REGION_KEYS)))) if (!filters.region || k === filters.region) ensure(k);
    let fromReps = false;
    for (const r of reps) { if (!r.region) continue; fromReps = true; const e = ensure(r.region); if (e) { e.completed += r.completed; e.open += r.open; } }
    if (!fromReps) for (const r of recent) { const k = pick(r, REGION_KEYS), e = k ? ensure(k) : null; if (e) e.completed += 1; }
  }
  if (![...regionAgg.values()].some(e => e.reps[1] || e.merch[1] || e.repsPct != null || e.merchPct != null)) {
    for (const r of reps) { if (!r.region) continue; const e = ensure(r.region); if (e) addRole(e, r.resourceType, r.completed > 0 ? 1 : 0, 1); }
  }
  const share = (a, b) => (b ? pct(a, b) : null);
  const regionCaptures = [...regionAgg.values()].reduce((t, e) => t + e.completed, 0);
  const regions = [...regionAgg.values()].map(e => ({label: e.label, completed: e.completed, open: e.open, people: e.totalPeople != null ? {active: e.activePeople || 0, total: e.totalPeople} : null,
    repsPct: e.repsPct ?? share(e.reps[0], e.reps[1]), merchPct: e.merchPct ?? share(e.merch[0], e.merch[1]),
    adoptionPct: e.adoptionPct ?? (regionCaptures ? pct(e.completed, regionCaptures) : null)}))
    .sort((a, b) => b.completed - a.completed || a.label.localeCompare(b.label)).slice(0, 20);
  const divisionAgg = new Map();
  for (const [key, e] of regionAgg) {
    const label = DIVISION_BY_REGION[key] || 'Unmapped';
    if (!divisionAgg.has(label)) divisionAgg.set(label, {label, completed: 0, open: 0, totalPeople: 0, activePeople: 0, reps: [0, 0], merch: [0, 0]});
    const v = divisionAgg.get(label);
    v.completed += e.completed; v.open += e.open; v.totalPeople += e.totalPeople || 0; v.activePeople += e.activePeople || 0;
    v.reps[0] += e.reps[0]; v.reps[1] += e.reps[1]; v.merch[0] += e.merch[0]; v.merch[1] += e.merch[1];
  }
  const divisions = DIVISIONS.filter(l => divisionAgg.has(l)).map(l => { const v = divisionAgg.get(l); return {label: l, completed: v.completed, open: v.open, people: {active: v.activePeople, total: v.totalPeople},
    repsPct: share(v.reps[0], v.reps[1]), merchPct: share(v.merch[0], v.merch[1]), adoptionPct: share(v.activePeople, v.totalPeople)}; });

  const managers = (Array.isArray(d.byManager) ? d.byManager : []).filter(e => e.manager && e.manager !== 'Unknown').map(e => ({
    manager: String(e.manager), reps: {active: num(e.reps?.activePeople), total: num(e.reps?.totalPeople)}, merch: {active: num(e.merchandisers?.activePeople), total: num(e.merchandisers?.totalPeople)},
    people: {active: num(e.activePeople), total: num(e.totalPeople)}, adoptionPct: num(e.adoptionPct)
  })).sort((a, b) => b.people.total - a.people.total || a.manager.localeCompare(b.manager));

  const byType = new Map();
  for (const r of reps) {
    if (!byType.has(r.resourceType)) byType.set(r.resourceType, {label: r.resourceType, total: 0, active: 0, captures: 0});
    const e = byType.get(r.resourceType); e.total++; e.captures += r.completed; if (r.completed > 0) e.active++;
  }
  const trendRows = (Array.isArray(trend?.trend) ? trend.trend : []).filter(r => WEEK.test(String(r.week))).map(r => ({week: r.week, repPct: r.repPct == null ? null : num(r.repPct), merchPct: r.merchPct == null ? null : num(r.merchPct)}));
  return {
    week: d.week || null,
    filters: {clients: uniq((Array.isArray(ref?.byClient) ? ref.byClient : []).map(c => text(c.client))), regions: uniq(refReps.map(r => pick(r, REGION_KEYS))),
      managers: uniq(refReps.map(r => pick(r, MANAGER_KEYS))), banners: uniq(refReps.map(r => pick(r, BANNER_KEYS))), types: uniq(refReps.map(r => String(r.resourceType || 'Unspecified')))},
    kpis: {reps: role('rep'), merchandisers: role('merchandiser'),
      coverage: {touched, total: stores.length, pct: pct(touched, stores.length)}, dormant: reps.filter(r => r.completed === 0).length, completed, open},
    mix: {heavyAt: HEAVY_AT, habitual: reps.filter(r => r.completed >= HEAVY_AT).length, trialling: reps.filter(r => r.completed > 0 && r.completed < HEAVY_AT).length, dormant: reps.filter(r => r.completed === 0).length},
    trend: {rows: trendRows, overall: trend?.overall ? {repPct: trend.overall.repPct == null ? null : num(trend.overall.repPct), merchPct: trend.overall.merchPct == null ? null : num(trend.overall.merchPct)} : null},
    regions, divisions, managers,
    resources: reps.sort((a, b) => (b.completed + b.open) - (a.completed + a.open) || b.completed - a.completed),
    stores: {total: stores.length, rows: stores.sort((a, b) => b.completed - a.completed || b.open - a.open || a.store.localeCompare(b.store))},
    types: [...byType.values()].sort((a, b) => b.total - a.total),
    recent
  };
}

// One capture as the Captures page and its export show it (the StockFix page's export columns).
const capture = r => ({weekEnding: text(r.weekEnding || r.weekEndingDate, 20), actionDate: text(r.actionDate, 20), client: text(r.client), region: pick(r, REGION_KEYS), user: text(r.rep || r.repName),
  lineManager: text(r.manager || r.lineManager), storeName: text(r.store || r.storeName, 160), barcode: text(r.barcode, 40), articleDescription: text(r.articleDescription, 200),
  classification: text(r.stockClassification), action: text(r.action, 160), status: text(r.actionStatus), reasonCode: text(r.reasonCode, 160), soh: r.storeSoh == null || r.storeSoh === '' ? null : num(r.storeSoh),
  comment: [r.actionTakenComment, r.feedback].map(v => text(v, 600)).filter(Boolean).join(' — '),
  photos: ['image1', 'image2', 'image3', 'image4'].map(k => text(r[k], 600)).filter(Boolean).map(u => (/^https?:\/\//.test(u) ? u : `${BASE}${u.startsWith('/') ? '' : '/'}${u}`))});
function captures(recent, q = '') {
  const query = text(q, 80).toLowerCase();
  const all = recent || [];
  const matching = query ? all.filter(r => [r.store, r.banner, r.rep, r.category, r.action, pick(r, REGION_KEYS)].filter(Boolean).join(' ').toLowerCase().includes(query)) : all;
  const count = test => all.filter(test).length;
  return {matching, stats: {total: all.length, withPhoto: count(r => ['image1', 'image2', 'image3', 'image4'].some(k => r[k])), withFeedback: count(r => r.feedback || r.actionTakenComment), withReason: count(r => r.reasonCode)}};
}

function adoptionRoutes({source, allow}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'StockFix is not open to your account. Ask a Nexus administrator.'));
  // The selection (live week, saved week, month or custom period) and the StockFix app's answer for it.
  async function load(req, {withTrend = false} = {}) {
    const week = String(req.query.week || ''), month = String(req.query.month || ''), period = [...new Set(String(req.query.weeks || '').split(',').map(w => w.trim()).filter(Boolean))].sort();
    if (week && !WEEK.test(week)) throw new AppError('invalid-argument', 'Choose a week as YYYY-MM-DD.');
    if (month && !MONTH.test(month)) throw new AppError('invalid-argument', 'Choose a month as YYYY-MM.');
    if (period.length > 26 || period.some(w => !WEEK.test(w))) throw new AppError('invalid-argument', 'Choose up to 26 weeks as YYYY-MM-DD.');
    const filters = cleanFilters(req.query), qs = appQuery(filters);
    const listed = ((await source.weeks())?.weeks || []).map(w => ({week: String(w.weekEnding || ''), live: w.live === true})).filter(w => WEEK.test(w.week));
    const liveWeek = listed.find(w => w.live)?.week || null;
    const mode = period.length ? 'period' : month ? 'month' : week && week !== liveWeek ? 'week' : 'live';
    if (mode === 'week' && !listed.some(w => w.week === week)) throw new AppError('not-found', `No saved StockFix adoption for the week ending ${week}.`);
    const only = mode === 'period' ? period : mode === 'week' ? [week] : [];
    const [data, ref, trend] = await Promise.all([
      mode === 'period' ? source.period(period, qs) : mode === 'month' ? source.month(month, qs) : mode === 'week' ? source.snapshot(week, qs) : source.live(qs),
      mode !== 'live' || qs ? source.live('').catch(() => null) : null,
      withTrend ? source.trend([qs, only.length ? `onlyWeeks=${encodeURIComponent(only.join(','))}` : ''].filter(Boolean).join('&')).catch(() => null) : null]);
    if (!data) throw new AppError('not-found', mode === 'month' ? `No saved StockFix adoption for ${month}.` : 'No saved StockFix adoption for that selection.');
    return {listed, liveWeek, mode, week: mode === 'week' ? week : mode === 'live' ? data.week || liveWeek : null, month: mode === 'month' ? month : null, period: mode === 'period' ? period : [],
      weeksIncluded: Array.isArray(data.weeksIncluded) ? data.weeksIncluded : [], filters, data, ref: ref || data, trend};
  }

  return app => {
    app.get('/api/stockfix/adoption', guard, wrap(async (req, res) => {
      const s = await load(req, {withTrend: true});
      const {recent, ...model} = adoptionModel({data: s.data, ref: s.ref, trend: s.trend, filters: s.filters});
      const months = [...new Set(s.listed.map(w => w.week.slice(0, 7)))].sort().reverse();
      // Client list from the StockFix roster (the page's own source); stores for the chosen client, else the first 150.
      const [clients, clientStores] = await Promise.all([Promise.resolve(source.clients?.()).then(names).catch(() => []), s.filters.client && source.storesForClient ? source.storesForClient(s.filters.client).then(names).catch(() => null) : null]);
      const stores = clientStores || uniq((Array.isArray(s.ref.byStore) ? s.ref.byStore : []).map(x => text(x.store, 160))).slice(0, 150);
      res.set('Cache-Control', 'no-store').json({weeks: s.listed, months, liveWeek: s.liveWeek, mode: s.mode, live: s.mode === 'live', week: s.week, month: s.month, period: s.period, weeksIncluded: s.weeksIncluded,
        ...model, filters: {...model.filters, clients: clients.length ? clients : model.filters.clients, stores},
        stores: {total: model.stores.total, rows: model.stores.rows.slice(0, 300)}, captures: captures(recent).stats});
    }));

    app.get('/api/stockfix/adoption/captures', guard, wrap(async (req, res) => {
      const s = await load(req);
      const {matching, stats} = captures(adoptionModel({data: s.data, ref: s.ref, filters: s.filters}).recent, req.query.q);
      const pageCount = Math.max(1, Math.ceil(matching.length / CAPTURE_PAGE)), page = Math.min(Math.max(1, Math.floor(Number(req.query.page)) || 1), pageCount);
      res.set('Cache-Control', 'no-store').json({stats, totalRows: matching.length, page, pageCount, pageSize: CAPTURE_PAGE, records: matching.slice((page - 1) * CAPTURE_PAGE, page * CAPTURE_PAGE).map(capture)});
    }));

    app.get('/api/stockfix/adoption/export', guard, wrap(async (req, res) => {
      const kind = String(req.query.kind || '');
      if (!EXPORTS[kind]) throw new AppError('invalid-argument', 'Choose resources, managers, stores or captures to export.');
      const s = await load(req);
      const m = adoptionModel({data: s.data, ref: s.ref, filters: s.filters});
      const rows = kind === 'resources' ? m.resources : kind === 'stores' ? m.stores.rows : kind === 'captures' ? captures(m.recent, req.query.q).matching.map(capture).map(c => ({...c, photo1: c.photos[0] || '', photo2: c.photos[1] || '', photo3: c.photos[2] || '', photo4: c.photos[3] || ''}))
        : m.managers.map(e => ({manager: e.manager, repsActive: e.reps.active, repsTotal: e.reps.total, merchActive: e.merch.active, merchTotal: e.merch.total, rate: Math.round(e.adoptionPct * 10) / 10}));
      const book = new ExcelJS.Workbook();
      book.creator = 'Meridian Nexus';
      const sheet = book.addWorksheet('Data', {views: [{state: 'frozen', ySplit: 1}]});
      sheet.columns = EXPORTS[kind].columns.map(([header, key, width]) => ({header, key, width}));
      for (const r of rows) sheet.addRow(r);
      sheet.getRow(1).font = {bold: true};
      const scope = s.mode === 'month' ? s.month : s.mode === 'period' ? `${s.period[0]} to ${s.period.at(-1)}` : s.week || 'live';
      res.set({'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${EXPORTS[kind].name} ${scope}.xlsx"`, 'Cache-Control': 'no-store'});
      res.send(Buffer.from(await book.xlsx.writeBuffer()));
    }));
  };
}

// The StockFix page's exports: file name and [header, field, width] columns.
const EXPORTS = {
  resources: {name: 'StockFix resource adoption', columns: [['Resource', 'rep', 30], ['Resource type', 'resourceType', 24], ['Region', 'region', 16], ['Manager', 'manager', 24], ['Reports to (Rep)', 'reportsToRep', 24], ['Captures', 'completed', 10], ['Open', 'open', 10], ['Stores', 'stores', 60]]},
  managers: {name: 'StockFix manager adoption', columns: [['Manager', 'manager', 30], ['Reps active', 'repsActive', 12], ['Reps total', 'repsTotal', 12], ['Merch active', 'merchActive', 12], ['Merch total', 'merchTotal', 12], ['Combined adoption %', 'rate', 18]]},
  stores: {name: 'StockFix store coverage', columns: [['Store', 'store', 40], ['Captured', 'completed', 10], ['Open', 'open', 10]]},
  captures: {name: 'StockFix captures', columns: [['Week Ending', 'weekEnding', 12], ['Action Date', 'actionDate', 12], ['Client', 'client', 18], ['Region', 'region', 16], ['User', 'user', 24], ['Line Manager', 'lineManager', 24],
    ['Store Name', 'storeName', 34], ['Barcode', 'barcode', 16], ['Article Description', 'articleDescription', 40], ['Classification', 'classification', 20], ['Action', 'action', 30], ['Status', 'status', 12],
    ['Reason Code', 'reasonCode', 22], ['SOH', 'soh', 8], ['Comment', 'comment', 50], ['Photo 1', 'photo1', 30], ['Photo 2', 'photo2', 30], ['Photo 3', 'photo3', 30], ['Photo 4', 'photo4', 30]]}
};

module.exports = {adoptionRoutes, adoptionModel, stockfixAppSource, cleanFilters, captures, BASE};
