'use strict';
// Gap tracker reporting: what moved between two weeks. Statuses: N = No gap, O = Opportunity, L = Lost.
// Only store x product pairs present in both weeks are compared; stores that joined or left are reported separately.

const LABEL = {N: 'No gap', O: 'Opportunity', L: 'Lost'};
// The three movements the business tracks, plus the other direction of each for context.
const MOVES = {
  converted: {from: 'O', to: 'N', label: 'Opportunity → No gap', good: true},
  recovered: {from: 'L', to: 'N', label: 'Lost → No gap', good: true},
  lost: {from: 'N', to: 'L', label: 'No gap → Lost', good: false},
  newOpportunity: {from: 'N', to: 'O', label: 'No gap → Opportunity', good: false},
  slipped: {from: 'O', to: 'L', label: 'Opportunity → Lost', good: false},
  reopened: {from: 'L', to: 'O', label: 'Lost → Opportunity', good: true}
};
const moveOf = (from, to) => Object.keys(MOVES).find(k => MOVES[k].from === from && MOVES[k].to === to) || null;

function compare(moves, storeChanges = []) {
  const matrix = {N: {N: 0, O: 0, L: 0}, O: {N: 0, O: 0, L: 0}, L: {N: 0, O: 0, L: 0}};
  const counts = Object.fromEntries(Object.keys(MOVES).map(k => [k, 0]));
  const byProduct = new Map(), byRegion = new Map(), changes = [];
  for (const m of moves) {
    matrix[m.from_status][m.to_status]++;
    const kind = moveOf(m.from_status, m.to_status);
    if (!kind) continue;
    counts[kind]++;
    changes.push({store: m.store, region: m.region || 'Not given', product: m.product, from: LABEL[m.from_status], to: LABEL[m.to_status], move: kind, banner: m.banner});
    for (const [map, k] of [[byProduct, m.product], [byRegion, m.region || 'Not given']]) {
      if (!map.has(k)) map.set(k, {name: k, converted: 0, recovered: 0, lost: 0});
      if (['converted', 'recovered', 'lost'].includes(kind)) map.get(k)[kind]++;
    }
  }
  const rank = map => [...map.values()].map(r => ({...r, net: r.converted + r.recovered - r.lost})).filter(r => r.converted || r.recovered || r.lost).sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
  changes.sort((a, b) => (a.banner || '').localeCompare(b.banner || '') || a.move.localeCompare(b.move) || a.store.localeCompare(b.store) || a.product.localeCompare(b.product));
  return {
    compared: moves.length,
    matrix,
    metrics: {...counts, net: counts.converted + counts.recovered - counts.lost},
    rates: rates(matrix, moves.length),
    byProduct: rank(byProduct),
    byRegion: rank(byRegion),
    coverage: {newStores: storeChanges.filter(s => s.kind === 'new').map(s => s.store).sort(), missingStores: storeChanges.filter(s => s.kind === 'missing').map(s => s.store).sort()},
    changes
  };
}

// Rates over the lines compared: how much of last week's opportunity converted, how much lost was won back, how
// much no-gap slipped to lost, and distribution (share of lines with no gap) before and after.
function rates(matrix, compared) {
  const from = st => matrix[st].N + matrix[st].O + matrix[st].L;
  const toN = matrix.N.N + matrix.O.N + matrix.L.N;
  const ratio = (a, b) => (b ? a / b : null);
  const before = ratio(from('N'), compared), after = ratio(toN, compared);
  return {conversion: ratio(matrix.O.N, from('O')), recovery: ratio(matrix.L.N, from('L')), loss: ratio(matrix.N.L, from('N')),
    distributionBefore: before, distributionAfter: after, distributionChange: before == null ? null : after - before,
    openBefore: from('O') + from('L'), openAfter: compared - toN};
}

// One week in depth: distribution by product / region / store (with change against the previous week), a heatmap,
// persistent gaps (lines open in every recent week they were reported) and how concentrated the gaps are.
function detail({rows, prevRows = [], history = [], weeks = [], byBanner = false}) {
  const tally = () => ({carried: 0, N: 0, O: 0, L: 0});
  const add = (t, st) => { t.carried++; t[st]++; };
  const dist = t => (t && t.carried ? t.N / t.carried : null);
  const group = (list, keyOf) => { const m = new Map(); for (const r of list) { const k = keyOf(r); if (!m.has(k)) m.set(k, tally()); add(m.get(k), r.status); } return m; };
  const regionOf = r => r.region || 'Not given';
  const storeKey = r => `${r.banner}|${r.store_key}`;
  const withChange = (cur, prev, extra = () => ({})) => [...cur].map(([key, t]) => {
    const p = prev.get(key), d = dist(t), pd = dist(p);
    return {key, ...extra(key), ...t, distribution: d, previous: pd, change: pd == null ? null : d - pd};
  });

  const totals = tally(); for (const r of rows) add(totals, r.status);
  const prevTotals = tally(); for (const r of prevRows) add(prevTotals, r.status);
  const products = withChange(group(rows, r => r.product), group(prevRows, r => r.product)).sort((a, b) => b.distribution - a.distribution || a.key.localeCompare(b.key));
  const regions = withChange(group(rows, regionOf), group(prevRows, regionOf)).sort((a, b) => b.distribution - a.distribution || a.key.localeCompare(b.key));
  const names = new Map(rows.map(r => [storeKey(r), {store: r.store, banner: r.banner, region: regionOf(r)}]));
  const stores = withChange(group(rows, storeKey), group(prevRows, storeKey), k => names.get(k)).sort((a, b) => a.distribution - b.distribution || (b.O + b.L) - (a.O + a.L));

  // Heatmap: products x regions (one banner) or products x banners (all banners).
  const colOf = byBanner ? r => r.banner : regionOf;
  const columns = [...group(rows, colOf)].sort((a, b) => b[1].carried - a[1].carried).map(([k]) => k);
  const cells = group(rows, r => JSON.stringify([r.product, colOf(r)]));
  const heatmap = {by: byBanner ? 'banner' : 'region', columns, rows: products.map(p => ({product: p.key, cells: columns.map(c => { const t = cells.get(JSON.stringify([p.key, c])); return t ? {distribution: dist(t), carried: t.carried} : null; })}))};

  // Persistent gaps: open (Opportunity or Lost) in each of the last weeks a store reported, ending in the chosen week.
  const order = new Map(weeks.map((w, i) => [w, i]));
  const lines = new Map();
  for (const r of history) { const k = `${storeKey(r)}|${r.product}`; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(r); }
  const last = weeks.at(-1), persistent = [];
  for (const list of lines.values()) {
    list.sort((a, b) => order.get(a.week) - order.get(b.week));
    const tail = list.at(-1);
    if (!tail || tail.week !== last || tail.status === 'N') continue;
    let streak = 0;
    for (let i = list.length - 1; i >= 0 && list[i].status !== 'N'; i--) streak++;
    if (streak >= 2) persistent.push({banner: tail.banner, store: tail.store, region: regionOf(tail), product: tail.product, status: tail.status === 'L' ? 'Lost' : 'Opportunity', weeks: streak, since: list[list.length - streak].week, always: streak === list.length});
  }
  persistent.sort((a, b) => b.weeks - a.weeks || a.banner.localeCompare(b.banner) || a.store.localeCompare(b.store));

  // Concentration: share of all open gaps held by the 10% of stores with the most gaps.
  const open = stores.map(s => s.O + s.L).sort((a, b) => b - a), openTotal = open.reduce((a, b) => a + b, 0);
  const topN = Math.max(1, Math.ceil(stores.length * 0.1));
  const concentration = {topStores: topN, share: openTotal ? open.slice(0, topN).reduce((a, b) => a + b, 0) / openTotal : null};

  const fully = stores.filter(s => s.carried && s.N === s.carried).length;
  const summary = {stores: stores.length, lines: totals.carried, noGap: totals.N, opportunity: totals.O, lost: totals.L, distribution: dist(totals), previous: dist(prevTotals),
    change: prevTotals.carried ? dist(totals) - dist(prevTotals) : null, fullyRanged: fully, fullyRangedShare: stores.length ? fully / stores.length : null,
    storesWithLost: stores.filter(s => s.L > 0).length, gapsPerStore: stores.length ? (totals.O + totals.L) / stores.length : null,
    productsBelowHalf: products.filter(p => p.distribution < 0.5).length, persistent: persistent.length, concentration};
  return {summary, products, regions, stores, heatmap, persistent};
}

// Combine several banners' comparisons (the "All banners" view).
function combine(parts) {
  const out = compare([]);
  for (const p of parts) {
    out.compared += p.compared;
    for (const f of 'NOL') for (const t of 'NOL') out.matrix[f][t] += p.matrix[f][t];
    for (const k of Object.keys(out.metrics)) out.metrics[k] += p.metrics[k];
    out.changes.push(...p.changes);
    out.coverage.newStores.push(...p.coverage.newStores.map(s => `${p.banner}: ${s}`));
    out.coverage.missingStores.push(...p.coverage.missingStores.map(s => `${p.banner}: ${s}`));
    for (const key of ['byProduct', 'byRegion']) {
      for (const r of p[key]) {
        const row = out[key].find(x => x.name === r.name);
        if (row) { row.converted += r.converted; row.recovered += r.recovered; row.lost += r.lost; row.net += r.net; } else out[key].push({...r});
      }
    }
  }
  for (const key of ['byProduct', 'byRegion']) out[key].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
  out.rates = rates(out.matrix, out.compared);
  return out;
}

// Week totals rows -> per-banner weeks, oldest first, with the status mix.
function weeksByBanner(totals) {
  const banners = new Map();
  for (const t of totals) {
    if (!banners.has(t.banner)) banners.set(t.banner, []);
    const total = t.N + t.O + t.L;
    banners.get(t.banner).push({week: t.week, stores: t.stores, noGap: t.N, opportunity: t.O, lost: t.L, total, noGapShare: total ? t.N / total : 0});
  }
  for (const weeks of banners.values()) weeks.sort((a, b) => a.week.localeCompare(b.week));
  return banners;
}

module.exports = {compare, combine, detail, rates, weeksByBanner, MOVES, LABEL};
