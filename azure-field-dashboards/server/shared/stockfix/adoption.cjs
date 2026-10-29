'use strict';
// StockFix Adoption (the StockFix app's /adoption/ page, which Nexus used to link to), inside Nexus. The figures come
// from the StockFix app's own API (stock-fix.replit.app: /api/live-dashboard, /api/adoption-snapshot,
// /api/admin/adoption-weeks, /api/admin/adoption-trend), read server-side; the calculations below repeat that page's
// (the page served at stock-fix.replit.app/adoption/, model() and renderVals(), read 29 October 2026; newer than the
// copy in cpillay2404/Stockfix, which counts the role cards differently) so the
// numbers match it: adoption = resources with work this week who captured at least once, Reps and Merchandisers
// separately; store coverage = stores with a capture; dormant = resources with work but no capture.
//   GET /api/stockfix/adoption   ?week=YYYY-MM-DD&client=&region=&manager=&banner=&rtype=
// No week (or the live week): the live figures; an earlier week: its saved snapshot.
const {AppError} = require('../errors.cjs');

const BASE = 'https://stock-fix.replit.app';
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const FILTERS = ['client', 'region', 'manager', 'banner', 'rtype'];
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
    trend: qs => get(`/api/admin/adoption-trend${q(qs)}`)
  };
}

// One week's Adoption figures. data: the StockFix app's answer for the week and filters; ref: the unfiltered live
// answer (filter lists); trend: the adoption-trend answer.
function adoptionModel({data, ref = data, trend = null, filters = {}}) {
  const d = data || {};
  const reps = (Array.isArray(d.byRep) ? d.byRep : []).map(r => ({
    rep: String(r.rep ?? '—'), completed: num(r.completed), open: num(r.open), resourceType: String(r.resourceType || 'Unspecified'),
    region: pick(r, REGION_KEYS), manager: pick(r, MANAGER_KEYS), banner: pick(r, BANNER_KEYS)
  })).filter(r => (!filters.rtype || r.resourceType === filters.rtype) && (!filters.region || r.region === filters.region)
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
    stores: {total: stores.length, rows: stores.sort((a, b) => b.completed - a.completed || b.open - a.open || a.store.localeCompare(b.store)).slice(0, 300)},
    types: [...byType.values()].sort((a, b) => b.total - a.total)
  };
}

function adoptionRoutes({source, allow}) {
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const guard = (req, res, next) => next(allow(req) ? undefined : new AppError('permission-denied', 'StockFix is not open to your account. Ask a Nexus administrator.'));
  return app => {
    app.get('/api/stockfix/adoption', guard, wrap(async (req, res) => {
      const asked = String(req.query.week || '');
      if (asked && !WEEK.test(asked)) throw new AppError('invalid-argument', 'Choose a week as YYYY-MM-DD.');
      const filters = cleanFilters(req.query), qs = appQuery(filters);
      const listed = ((await source.weeks())?.weeks || []).map(w => ({week: String(w.weekEnding || ''), live: w.live === true})).filter(w => WEEK.test(w.week));
      const liveWeek = listed.find(w => w.live)?.week || null;
      const saved = asked && asked !== liveWeek;
      if (saved && !listed.some(w => w.week === asked)) throw new AppError('not-found', `No saved StockFix adoption for the week ending ${asked}.`);
      const trendQs = [qs, saved ? `onlyWeeks=${encodeURIComponent(asked)}` : ''].filter(Boolean).join('&');
      const [data, ref, trend] = await Promise.all([saved ? source.snapshot(asked, qs) : source.live(qs), qs ? source.live('') : null, source.trend(trendQs).catch(() => null)]);
      if (!data) throw new AppError('not-found', `No saved StockFix adoption for the week ending ${asked}.`);
      const model = adoptionModel({data, ref: ref || (saved ? await source.live('').catch(() => data) : data), trend, filters});
      res.set('Cache-Control', 'no-store').json({weeks: listed, liveWeek, live: !saved, ...model, week: saved ? asked : model.week || liveWeek});
    }));
  };
}

module.exports = {adoptionRoutes, adoptionModel, stockfixAppSource, cleanFilters, BASE};
