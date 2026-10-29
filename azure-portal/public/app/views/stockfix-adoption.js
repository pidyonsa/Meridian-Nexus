import {h, icon, formatNumber, sizeBars, sortable} from '../ui.js';
import {api} from '../api.js';

// StockFix › Adoption (the StockFix app's Adoption page, inside Nexus): the two-line Reps/Merchandisers adoption trend,
// adoption, store coverage and dormant resources, Inland/Central/Coastal, regions, managers, the resource leaderboard,
// store coverage and resource types, for the live week or a saved week. Figures from /api/stockfix/adoption.
const FILTERS = [['client', 'Client', 'clients', 'All clients'], ['region', 'Region', 'regions', 'All regions'], ['manager', 'Manager', 'managers', 'All managers'],
  ['banner', 'Banner', 'banners', 'All banners'], ['rtype', 'Resource type', 'types', 'All resource types']];
const SEGMENTS = [['active', 'Active'], ['dormant', 'Dormant'], ['all', 'All']];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v)); el.append(...kids.flat().filter(k => k != null)); return el; };
const p1 = v => (v == null ? '—' : v > 0 && v < 0.1 ? '<0.1%' : `${formatNumber(v, 1)}%`);
const weekLabel = (iso, short = false) => new Intl.DateTimeFormat('en-ZA', short ? {day: 'numeric', month: 'short', timeZone: 'UTC'} : {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const of = (a, b) => `${formatNumber(a)} of ${formatNumber(b)}`;

// state: {week, filters, seg, storeQuery, managerQuery}; remember() keeps the address in step.
export async function renderAdoption(body, {state, signal, remember}) {
  body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading StockFix adoption…'));
  let d;
  try {
    const q = new URLSearchParams(Object.entries({week: state.week, ...state.filters}).filter(([, v]) => v)).toString();
    d = await api(`/stockfix/adoption${q ? `?${q}` : ''}`, {signal});
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'StockFix adoption could not load'), h('p', {}, error.message),
      error.requestId ? h('p.muted', {}, `Reference ${error.requestId}`) : null, h('button.button', {type: 'button', onclick: () => renderAdoption(body, {state, signal, remember})}, icon('refresh'), 'Try again')));
    return;
  }
  const reload = () => { remember(); return renderAdoption(body, {state, signal, remember}); };
  const setFilter = (key, value) => { if (value) state.filters[key] = value; else delete state.filters[key]; reload(); };
  const active = Object.keys(state.filters).length;

  const filterPanel = h('section.panel.sales-filter-panel', {}, h('section.toolbar.sales-filters', {'aria-label': 'Adoption filters'},
    ...FILTERS.map(([key, label, list, all]) => {
      const values = d.filters[list] || [], current = state.filters[key];
      return h('label.field', {}, h('span', {}, label), h('select', {onchange: e => setFilter(key, e.target.value)}, h('option', {value: ''}, all),
        (current && !values.includes(current) ? [current, ...values] : values).map(v => h('option', {value: v, selected: v === current}, v))));
    }),
    h('label.field', {}, h('span', {}, 'Week'), h('select', {onchange: e => { state.week = e.target.value; reload(); }},
      d.weeks.map(w => h('option', {value: w.live ? '' : w.week, selected: w.live ? d.live : w.week === d.week}, w.live ? 'Current week (live)' : `Week ending ${weekLabel(w.week)}`)))),
    h('button.button.ghost', {type: 'button', disabled: !active && !state.week, onclick: () => { state.filters = {}; state.week = ''; reload(); }}, 'Reset')));

  const status = h('div.notice', {role: 'status'}, icon('clock'), h('span', {}, h('strong', {}, d.week ? `Week ending ${weekLabel(d.week)}` : 'This week'),
    d.live ? ' · live from the StockFix app' : ' · saved snapshot', ` · ${active ? `${active} filter${active > 1 ? 's' : ''} applied` : 'full network, no filters'}`));

  const k = d.kpis;
  const kpis = h('section.stat-grid.sf-kpis', {'aria-label': 'Adoption key figures'},
    tile('Rep adoption', p1(k.reps.total ? k.reps.pct : null), k.reps.total ? `${of(k.reps.active, k.reps.total)} reps with work this week active` : 'no reps in scope', 'orange'),
    tile('Merchandiser adoption', p1(k.merchandisers.total ? k.merchandisers.pct : null), k.merchandisers.total ? `${of(k.merchandisers.active, k.merchandisers.total)} merchandisers with work this week active` : 'no merchandisers in scope', 'orange'),
    tile('Store coverage', p1(k.coverage.total ? k.coverage.pct : null), k.coverage.total ? `${of(k.coverage.touched, k.coverage.total)} stores touched` : 'no stores in scope'),
    tile('Dormant resources', formatNumber(k.dormant), 'no captures this cycle'),
    tile('Captures logged', formatNumber(k.completed), `${formatNumber(k.open)} open · ${p1(k.completed + k.open ? (k.completed / (k.completed + k.open)) * 100 : 0)} of scope`));
  const divisions = d.divisions.filter(x => x.label !== 'Unmapped');
  const divisionCards = divisions.length ? h('section.stat-grid.sf-kpis', {'aria-label': 'Adoption by division'}, divisions.map(x =>
    tile(`${x.label} adoption`, p1(x.adoptionPct), `${of(x.people.active, x.people.total)} active · Reps ${p1(x.repsPct)} · Merch ${p1(x.merchPct)}`))) : null;

  body.replaceChildren(filterPanel, status, trendPanel(d), kpis, divisionCards || '', h('div.sales-grid', {},
    regionPanel(d), managerPanel(d, state, setFilter, () => draw()), typePanel(d), resourcePanel(d, state, () => draw()), storePanel(d, state, () => draw()), mixPanel(d)));
  sizeBars(body);

  // Panels with their own search or segment redraw in place, without asking the StockFix app again.
  function draw() {
    const grid = body.querySelector('.sales-grid');
    grid.replaceChildren(regionPanel(d), managerPanel(d, state, setFilter, draw), typePanel(d), resourcePanel(d, state, draw), storePanel(d, state, draw), mixPanel(d));
    sizeBars(grid);
  }
}

function tile(label, value, hint, tone = '') {
  return h('div.stat', {}, h('span.stat-label', {}, label), h(`strong.stat-value${tone ? `.sf-${tone}` : ''}`, {}, value), hint ? h('span.stat-hint', {}, hint) : null);
}
const panel = (eyebrow, title, content, extra = null, wide = false) => h(`section.panel${wide ? '.wide' : ''}`, {}, h('div.panel-head', {}, h('div', {}, eyebrow ? h('p.eyebrow', {}, eyebrow) : null, h('h2', {}, title)), extra), content);

// Two lines, Reps and Merchandisers, one point a week with its value, as on the StockFix Adoption page.
function trendPanel(d) {
  const rows = d.trend.rows;
  if (rows.length < 2) return panel('Trend', 'Adoption trend', h('p.empty', {}, 'The trend appears once two weeks have adoption figures.'), null, true);
  const W = 1040, H = 236, L = 64, R = 36, T = 28, PH = 150, AXIS = T + PH;
  const x = i => L + (i / (rows.length - 1)) * (W - L - R);
  const y = v => T + (100 - Math.max(0, Math.min(100, v))) / 100 * PH;
  const line = key => rows.map((r, i) => (r[key] == null ? null : `${i === 0 || rows[i - 1][key] == null ? 'M' : 'L'}${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`)).filter(Boolean).join(' ');
  const points = (key, cls, dy) => rows.map((r, i) => (r[key] == null ? null : svg('g', {},
    svg('circle', {class: `sf-dot ${cls}`, cx: x(i).toFixed(1), cy: y(r[key]).toFixed(1), r: 4}, svg('title', {}, `Week ending ${weekLabel(r.week)}: ${p1(r[key])}`)),
    svg('text', {class: `sf-val ${cls}`, x: x(i).toFixed(1), y: (y(r[key]) + dy).toFixed(1), 'text-anchor': 'middle'}, p1(r[key])))));
  const change = key => { const v = rows.filter(r => r[key] != null); return v.length > 1 ? v.at(-1)[key] - v[0][key] : null; };
  const pp = v => (v == null ? '' : ` ${v >= 0 ? '+' : '−'}${formatNumber(Math.abs(v), 1)} pp`);
  const chart = svg('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Rep and merchandiser adoption by week'},
    [0, 25, 50, 75, 100].map(v => svg('g', {}, svg('line', {class: 'sf-grid-line', x1: L, x2: W - R, y1: y(v), y2: y(v)}), svg('text', {class: 'sf-axis', x: L - 8, y: y(v) + 4, 'text-anchor': 'end'}, `${v}%`))),
    rows.map((r, i) => svg('text', {class: 'sf-axis', x: x(i), y: AXIS + 34, 'text-anchor': 'middle'}, weekLabel(r.week, true))),
    svg('path', {class: 'sf-line merch', d: line('merchPct')}), svg('path', {class: 'sf-line rep', d: line('repPct')}),
    points('merchPct', 'merch', 18), points('repPct', 'rep', -10));
  const o = d.trend.overall;
  const legend = h('div.legend.sf-legend', {}, h('span', {}, h('i.swatch.sf-rep'), 'Reps', h('b.sf-orange', {}, pp(change('repPct')))), h('span', {}, h('i.swatch.sf-merch'), 'Merchandisers', h('b.sf-blue', {}, pp(change('merchPct')))),
    o ? h('span.muted', {}, `Average weekly rate ${d.live ? 'since the start' : 'for the selected week'}: Reps ${p1(o.repPct)} · Merchandisers ${p1(o.merchPct)}`) : null);
  return h('section.panel.wide.sf-trend-panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Trend'), h('h2', {}, 'Adoption trend'),
    h('p.muted.sf-sub', {}, `Week ending ${weekLabel(rows[0].week)} — week ending ${weekLabel(rows.at(-1).week)} · current filters`))), h('div.sf-chart', {}, chart), legend);
}

function regionPanel(d) {
  return panel('Coverage', 'Adoption by region', sortable([
    {label: 'Region', key: 'label'}, {label: 'Captured', key: 'completed', num: true, render: r => formatNumber(r.completed)}, {label: 'Open', key: 'open', num: true, render: r => formatNumber(r.open)},
    {label: 'People active', key: 'active', num: true, render: r => (r.people.total ? of(r.people.active, r.people.total) : '—')},
    {label: 'Reps', key: 'repsPct', num: true, render: r => p1(r.repsPct)}, {label: 'Merch', key: 'merchPct', num: true, render: r => p1(r.merchPct)},
    {label: 'Adoption', key: 'adoptionPct', num: true, render: r => h(`strong${r.adoptionPct >= 50 ? '.sf-orange' : ''}`, {}, p1(r.adoptionPct))}
  ], d.regions.map(r => ({...r, active: r.people.active})), {initial: {key: 'completed', dir: -1}}), null, true);
}

function managerPanel(d, state, setFilter, redraw) {
  const q = state.managerQuery.trim().toLowerCase();
  const list = d.managers.filter(m => !q || m.manager.toLowerCase().includes(q));
  const search = h('input', {type: 'search', value: state.managerQuery, placeholder: 'Find a manager', 'aria-label': 'Find a manager'});
  search.addEventListener('change', () => { state.managerQuery = search.value; redraw(); });
  const role = r => (r.total ? `${p1((r.active / r.total) * 100)} · ${formatNumber(r.active)}/${formatNumber(r.total)}` : '—');
  return panel('Leadership', 'Adoption by manager', h('div', {}, h('div.toolbar.sf-row-filters', {}, h('label.field.sf-search', {}, h('span', {}, `${formatNumber(list.length)} managers in scope`), search)),
    sortable([
      {label: 'Manager', key: 'manager', render: r => h('button.sf-link', {type: 'button', title: `Filter by ${r.manager}`, onclick: () => setFilter('manager', r.manager)}, r.manager)},
      {label: 'Reps', key: 'repsRate', num: true, render: r => role(r.reps)}, {label: 'Merch', key: 'merchRate', num: true, render: r => role(r.merch)},
      {label: 'Adoption', key: 'adoptionPct', num: true, render: r => h(`strong${r.adoptionPct >= 50 ? '.sf-orange' : ''}`, {}, r.people.total ? p1(r.adoptionPct) : '—')}
    ], list.map(m => ({...m, repsRate: m.reps.total ? m.reps.active / m.reps.total : -1, merchRate: m.merch.total ? m.merch.active / m.merch.total : -1})), {limit: 12, initial: {key: 'adoptionPct', dir: -1}}),
    list.length > 12 ? h('p.muted.sf-foot', {}, `Showing 12 of ${formatNumber(list.length)}; click a manager to filter the page.`) : h('p.muted.sf-foot', {}, 'Click a manager to filter the page.')));
}

function resourcePanel(d, state, redraw) {
  const all = d.resources, act = all.filter(r => r.completed > 0), dormant = all.filter(r => r.completed === 0);
  const seg = state.seg === 'active' && !act.length && all.length ? 'all' : state.seg;
  const pool = seg === 'active' ? act : seg === 'dormant' ? dormant : all;
  const counts = {active: act.length, dormant: dormant.length, all: all.length};
  const tabs = h('div.segmented', {role: 'tablist', 'aria-label': 'Resources'}, SEGMENTS.map(([key, label]) => h('button', {type: 'button', role: 'tab', 'aria-selected': String(seg === key), class: seg === key ? 'on' : '', onclick: () => { state.seg = key; redraw(); }}, `${label} (${formatNumber(counts[key])})`)));
  const dot = r => h(`i.sf-usage.${r.completed >= d.mix.heavyAt ? 'habitual' : r.completed > 0 ? 'trialling' : 'dormant'}`);
  return panel('People', 'Resource leaderboard', h('div', {}, h('div.sf-seg', {}, tabs), sortable([
    {label: 'Resource', key: 'rep', render: r => h('span.sf-person', {}, dot(r), r.rep)}, {label: 'Type', key: 'resourceType'}, {label: 'Region', key: 'region'}, {label: 'Manager', key: 'manager'},
    {label: 'Captures', key: 'completed', num: true, render: r => h(`strong${r.completed ? '.sf-orange' : '.muted'}`, {}, formatNumber(r.completed))}, {label: 'Open', key: 'open', num: true, render: r => formatNumber(r.open)}
  ], pool, {limit: 25, initial: {key: 'completed', dir: -1}}), h('p.muted.sf-foot', {}, pool.length > 25 ? `Showing the top 25 of ${formatNumber(pool.length)} resources` : `${formatNumber(pool.length)} resources in this view`)), null, true);
}

function storePanel(d, state, redraw) {
  const q = state.storeQuery.trim().toLowerCase();
  const list = d.stores.rows.filter(x => !q || x.store.toLowerCase().includes(q));
  const search = h('input', {type: 'search', value: state.storeQuery, placeholder: 'Find a store', 'aria-label': 'Find a store'});
  search.addEventListener('change', () => { state.storeQuery = search.value; redraw(); });
  const stateOf = x => (x.completed === 0 ? h('span.pill.small', {}, 'Untouched') : x.open === 0 ? h('span.pill.small.orange', {}, 'Complete') : h('span.pill.small.blue', {}, 'In progress'));
  return panel('Stores', 'Store coverage', h('div', {}, h('div.toolbar.sf-row-filters', {}, h('label.field.sf-search', {}, h('span', {}, `${formatNumber(d.stores.total)} stores in scope`), search)),
    sortable([{label: 'Store', key: 'store'}, {label: 'Captured', key: 'completed', num: true, render: x => formatNumber(x.completed)}, {label: 'Open', key: 'open', num: true, render: x => formatNumber(x.open)}, {label: 'State', key: 'completed', render: stateOf}],
      list, {limit: 12, initial: {key: 'completed', dir: -1}}), list.length > 12 ? h('p.muted.sf-foot', {}, `Showing the top 12 of ${formatNumber(list.length)}`) : null));
}

function typePanel(d) {
  const max = Math.max(1, ...d.types.map(t => t.total));
  return panel('Teams', 'Adoption by resource type', d.types.length ? h('ol.hbars.static', {}, d.types.map(t => h('li', {}, h('div', {},
    h('span.hbar-label', {}, t.label), h('span.hbar-track', {}, h('span.hbar-fill', {dataset: {w: String(t.total ? t.active / t.total : 0)}})), h('span.hbar-value', {}, p1(t.total ? (t.active / t.total) * 100 : 0)),
    h('span.hbar-sub', {}, `${of(t.active, t.total)} active · ${formatNumber(t.captures)} captures`))))) : h('p.empty', {}, 'No resources in this selection.'));
}

function mixPanel(d) {
  const m = d.mix, total = Math.max(1, m.habitual + m.trialling + m.dormant);
  const rows = [['Habitual', `${m.heavyAt}+ captures`, m.habitual, 'habitual'], ['Trialling', `1–${m.heavyAt - 1} captures`, m.trialling, 'trialling'], ['Dormant', 'no captures', m.dormant, 'dormant']];
  return panel('Usage', 'How resources use StockFix', h('ol.hbars.static.sf-mix', {}, rows.map(([label, sub, value, cls]) => h('li', {}, h('div', {},
    h('span.hbar-label', {}, h('i.sf-usage.' + cls), label), h('span.hbar-track', {}, h(`span.hbar-fill.sf-${cls}`, {dataset: {w: String(value / total)}})), h('span.hbar-value', {}, formatNumber(value)), h('span.hbar-sub', {}, sub))))));
}
