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
    byProduct: rank(byProduct),
    byRegion: rank(byRegion),
    coverage: {newStores: storeChanges.filter(s => s.kind === 'new').map(s => s.store).sort(), missingStores: storeChanges.filter(s => s.kind === 'missing').map(s => s.store).sort()},
    changes
  };
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

module.exports = {compare, combine, weeksByBanner, MOVES, LABEL};
