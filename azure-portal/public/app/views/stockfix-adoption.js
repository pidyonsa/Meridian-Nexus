import {h, icon, formatNumber, sizeBars, sortable} from '../ui.js';
import {api} from '../api.js';

// StockFix › Adoption (the StockFix app's Adoption page, inside Nexus). Overview: the two-line Reps/Merchandisers
// adoption trend, adoption, store coverage and dormant resources, Inland/Central/Coastal, regions, managers, the
// resource leaderboard, store coverage, resource types and usage. Captures: every capture in scope. For the live week, a
// saved week, a month or a custom period of weeks, with Excel exports. Figures from /api/stockfix/adoption.
const FILTERS = [['client', 'Client', 'clients', 'All clients'], ['store', 'Store', 'stores', 'All stores'], ['region', 'Region', 'regions', 'All regions'], ['manager', 'Manager', 'managers', 'All managers'],
  ['banner', 'Banner', 'banners', 'All banners'], ['rtype', 'Resource type', 'types', 'All resource types']];
const PAGES = [['overview', 'Overview'], ['captures', 'Captures']];
const monthLabel = ym => new Intl.DateTimeFormat('en-ZA', {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${ym}-01T00:00:00Z`));
const qs = params => new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
const SEGMENTS = [['active', 'Active'], ['dormant', 'Dormant'], ['all', 'All']];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v)); el.append(...kids.flat().filter(k => k != null)); return el; };
const p1 = v => (v == null ? '—' : v > 0 && v < 0.1 ? '<0.1%' : `${formatNumber(v, 1)}%`);
const weekLabel = (iso, short = false) => new Intl.DateTimeFormat('en-ZA', short ? {day: 'numeric', month: 'short', timeZone: 'UTC'} : {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const of = (a, b) => `${formatNumber(a)} of ${formatNumber(b)}`;

// state: {page, week, month, weeks, filters, seg, storeQuery, managerQuery, captureQuery, capturePage}; week, month and
// weeks (a custom period) exclude each other. remember() keeps the address in step.
export async function renderAdoption(body, {state, signal, remember}) {
  body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading StockFix adoption…'));
  const selection = () => ({week: state.week, month: state.month, weeks: state.weeks.join(','), ...state.filters});
  const exportHref = (kind, extra = {}) => `/api/stockfix/adoption/export?${qs({...selection(), kind, ...extra})}`;
  let d;
  try {
    const q = qs(selection());
    d = await api(`/stockfix/adoption${q ? `?${q}` : ''}`, {signal});
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'StockFix adoption could not load'), h('p', {}, error.message),
      error.requestId ? h('p.muted', {}, `Reference ${error.requestId}`) : null, h('button.button', {type: 'button', onclick: () => renderAdoption(body, {state, signal, remember})}, icon('refresh'), 'Try again')));
    return;
  }
  const reload = () => { state.capturePage = 1; remember(); return renderAdoption(body, {state, signal, remember}); };
  const setFilter = (key, value) => { if (value) state.filters[key] = value; else delete state.filters[key]; if (key === 'client') delete state.filters.store; reload(); };
  const setPeriod = patch => { Object.assign(state, {week: '', month: '', weeks: []}, patch); reload(); };
  const active = Object.keys(state.filters).length;

  const savedWeeks = d.weeks.map(w => w.week);
  const periodPicker = h('details.sf-period', {}, h('summary.button.ghost', {}, state.weeks.length ? `Custom period: ${state.weeks.length} weeks` : 'Custom period'),
    h('div.sf-period-list', {}, savedWeeks.map(w => h('label.sf-check', {}, h('input', {type: 'checkbox', value: w, checked: state.weeks.includes(w)}), `Week ending ${weekLabel(w)}`)),
      h('button.button.small', {type: 'button', onclick: e => setPeriod({weeks: [...e.target.closest('details').querySelectorAll('input:checked')].map(i => i.value).sort()})}, 'Show these weeks')));
  const filterPanel = h('section.panel.sales-filter-panel', {}, h('section.toolbar.sales-filters', {'aria-label': 'Adoption filters'},
    ...FILTERS.map(([key, label, list, all]) => {
      const values = d.filters[list] || [], current = state.filters[key];
      return h('label.field', {}, h('span', {}, label), h('select', {onchange: e => setFilter(key, e.target.value)}, h('option', {value: ''}, key === 'store' && state.filters.client ? 'All stores for this client' : all),
        (current && !values.includes(current) ? [current, ...values] : values).map(v => h('option', {value: v, selected: v === current}, v))));
    }),
    h('label.field', {}, h('span', {}, 'Week'), h('select', {onchange: e => setPeriod({week: e.target.value})},
      d.mode === 'month' || d.mode === 'period' ? h('option', {value: '', selected: true}, '—') : null,
      d.weeks.map(w => h('option', {value: w.live ? '' : w.week, selected: (d.mode === 'live' && w.live) || (d.mode === 'week' && w.week === d.week)}, w.live ? 'Current week (live)' : `Week ending ${weekLabel(w.week)}`)))),
    h('label.field', {}, h('span', {}, 'Month'), h('select', {onchange: e => setPeriod({month: e.target.value})}, h('option', {value: ''}, 'Single week'),
      d.months.map(m => h('option', {value: m, selected: m === d.month}, monthLabel(m))))),
    periodPicker,
    h('button.button.ghost', {type: 'button', disabled: !active && d.mode === 'live', onclick: () => { state.filters = {}; setPeriod({}); }}, 'Reset')));

  const scope = d.mode === 'month' ? [h('strong', {}, monthLabel(d.month)), ` · ${d.weeksIncluded.length} week${d.weeksIncluded.length === 1 ? '' : 's'} combined`]
    : d.mode === 'period' ? [h('strong', {}, `Custom period · ${d.period.length} weeks`), ` · ${weekLabel(d.period[0])} to ${weekLabel(d.period.at(-1))} combined`]
    : [h('strong', {}, d.week ? `Week ending ${weekLabel(d.week)}` : 'This week'), d.live ? ' · live from the StockFix app' : ' · saved snapshot'];
  const status = h('div.notice', {role: 'status'}, icon('clock'), h('span', {}, ...scope, ` · ${active ? `${active} filter${active > 1 ? 's' : ''} applied` : 'full network, no filters'}`));
  const pages = h('div.segmented.sf-pages', {role: 'tablist', 'aria-label': 'Adoption pages'}, PAGES.map(([key, label]) => h('button', {type: 'button', role: 'tab', 'aria-selected': String(state.page === key), class: state.page === key ? 'on' : '',
    onclick: () => { state.page = key; remember(); renderAdoption(body, {state, signal, remember}); }}, key === 'captures' ? `${label} (${formatNumber(d.captures.total)})` : label)));
  if (state.page === 'captures') {
    body.replaceChildren(filterPanel, status, pages, h('div.sf-captures'));
    return capturesPage(body.querySelector('.sf-captures'), {state, signal, selection, exportHref, remember});
  }

  const k = d.kpis;
  const kpis = h('section.stat-grid.sf-kpis', {'aria-label': 'Adoption key figures'},
    tile('Rep adoption', p1(k.reps.total ? k.reps.pct : null), k.reps.total ? `${of(k.reps.active, k.reps.total)} Reps active` : 'no reps in scope', 'orange'),
    tile('Merchandiser adoption', p1(k.merchandisers.total ? k.merchandisers.pct : null), k.merchandisers.total ? `${of(k.merchandisers.active, k.merchandisers.total)} Merchandisers active` : 'no merchandisers in scope', 'orange'),
    tile('Store coverage', p1(k.coverage.total ? k.coverage.pct : null), k.coverage.total ? `${of(k.coverage.touched, k.coverage.total)} stores touched` : 'no stores in scope'),
    tile('Dormant resources', formatNumber(k.dormant), 'no captures this cycle'),
    tile('Captures logged', formatNumber(k.completed), `${formatNumber(k.open)} open · ${p1(k.completed + k.open ? (k.completed / (k.completed + k.open)) * 100 : 0)} of scope`));
  const divisions = d.divisions.filter(x => x.label !== 'Unmapped');
  const divisionCards = divisions.length ? h('section.stat-grid.sf-kpis', {'aria-label': 'Adoption by division'}, divisions.map(x =>
    tile(`${x.label} adoption`, p1(x.adoptionPct), `${of(x.people.active, x.people.total)} active · Reps ${p1(x.repsPct)} · Merch ${p1(x.merchPct)}`))) : null;

  const panels = () => [regionPanel(d), managerPanel(d, state, setFilter, draw, exportHref), typePanel(d), resourcePanel(d, state, draw, exportHref), storePanel(d, state, draw, exportHref), mixPanel(d)];
  body.replaceChildren(filterPanel, status, pages, trendPanel(d), kpis, divisionCards || '', h('div.sales-grid', {}, panels()));
  sizeBars(body);

  // Panels with their own search or segment redraw in place, without asking the StockFix app again.
  function draw() {
    const grid = body.querySelector('.sales-grid');
    grid.replaceChildren(...panels());
    sizeBars(grid);
  }
}

// Captures: every capture in scope, 36 a page, searchable, with its photos as links (they live in the StockFix app).
async function capturesPage(box, {state, signal, selection, exportHref, remember}) {
  box.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading captures…'));
  let c;
  try { c = await api(`/stockfix/adoption/captures?${qs({...selection(), q: state.captureQuery, page: String(state.capturePage)})}`, {signal}); } catch (error) {
    if (error.name === 'AbortError') throw error;
    box.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'The captures could not load'), h('p', {}, error.message)));
    return;
  }
  const again = () => capturesPage(box, {state, signal, selection, exportHref, remember});
  const s = c.stats, share = v => p1(s.total ? (v / s.total) * 100 : 0);
  const search = h('input', {type: 'search', value: state.captureQuery, placeholder: 'Store, banner, rep, category, action or region', 'aria-label': 'Search captures'});
  search.addEventListener('change', () => { state.captureQuery = search.value.trim(); state.capturePage = 1; again(); });
  const go = page => { state.capturePage = page; again(); };
  box.replaceChildren(
    h('section.stat-grid.sf-kpis', {'aria-label': 'Captures'}, tile('Captures in feed', formatNumber(s.total), 'returned by the StockFix app'), tile('With photos', formatNumber(s.withPhoto), `${share(s.withPhoto)} of the feed`),
      tile('With feedback', formatNumber(s.withFeedback), `${share(s.withFeedback)} carry a comment`), tile('With reason code', formatNumber(s.withReason), `${share(s.withReason)} of the feed`)),
    h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Captures'), h('h2', {}, `${formatNumber(c.totalRows)} ${state.captureQuery ? 'matching captures' : 'captures in scope'}`)),
      c.totalRows ? h('a.button.ghost.small', {href: exportHref('captures', {q: state.captureQuery}), download: ''}, icon('external'), `Export ${formatNumber(c.totalRows)}`) : null),
      h('div.toolbar.sf-row-filters', {}, h('label.field.sf-search', {}, h('span', {}, 'Search'), search)),
      sortable([
        {label: 'Date', key: 'actionDate', render: r => h('span.nowrap', {}, r.actionDate || r.weekEnding)}, {label: 'Store', key: 'storeName'}, {label: 'User', key: 'user'}, {label: 'Article', key: 'articleDescription'},
        {label: 'Classification', key: 'classification'}, {label: 'Action', key: 'action'}, {label: 'Status', key: 'status'}, {label: 'Reason', key: 'reasonCode'},
        {label: 'Comment', key: 'comment', render: r => h('span.sf-feedback', {title: r.comment}, r.comment)},
        {label: 'Photos', key: 'photos', render: r => h('span.sf-photos', {}, r.photos.map((u, i) => h('a', {href: u, target: '_blank', rel: 'noopener noreferrer'}, `Photo ${i + 1}`)))}
      ], c.records, {initial: {key: 'actionDate', dir: -1}}),
      h('div.pager', {}, c.pageCount > 1 ? [h('button.button.small', {type: 'button', disabled: c.page <= 1, onclick: () => go(c.page - 1)}, 'Previous'), h('span.muted', {}, `Page ${c.page} of ${c.pageCount}`),
        h('button.button.small', {type: 'button', disabled: c.page >= c.pageCount, onclick: () => go(c.page + 1)}, 'Next')] : null)));
}
const exportButton = (href, count) => (count ? h('a.button.ghost.small', {href, download: ''}, icon('external'), `Export ${formatNumber(count)}`) : null);

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
  const legend = h('div.legend.sf-legend', {}, h('span', {}, h('i.swatch.sf-rep'), 'Reps', h('b.sf-orange', {}, pp(change('repPct')))), h('span', {}, h('i.swatch.sf-merch'), 'Merchandisers', h('b.sf-blue', {}, pp(change('merchPct')))));
  return h('section.panel.wide.sf-trend-panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Trend'), h('h2', {}, 'Adoption trend'),
    h('p.muted.sf-sub', {}, `Week ending ${weekLabel(rows[0].week)} — week ending ${weekLabel(rows.at(-1).week)} · current filters`))), h('div.sf-chart', {}, chart), legend);
}

function regionPanel(d) {
  return panel('Coverage', 'Adoption by region', sortable([
    {label: 'Region', key: 'label'}, {label: 'Captured', key: 'completed', num: true, render: r => formatNumber(r.completed)}, {label: 'Open', key: 'open', num: true, render: r => formatNumber(r.open)},
    {label: 'People active', key: 'active', num: true, render: r => (r.people ? of(r.people.active, r.people.total) : '—')},
    {label: 'Reps', key: 'repsPct', num: true, render: r => p1(r.repsPct)}, {label: 'Merch', key: 'merchPct', num: true, render: r => p1(r.merchPct)},
    {label: 'Adoption', key: 'adoptionPct', num: true, render: r => h(`strong${r.adoptionPct >= 50 ? '.sf-orange' : ''}`, {}, p1(r.adoptionPct))}
  ], d.regions.map(r => ({...r, active: r.people ? r.people.active : -1})), {initial: {key: 'completed', dir: -1}}), null, true);
}

function managerPanel(d, state, setFilter, redraw, exportHref) {
  const q = state.managerQuery.trim().toLowerCase();
  const list = d.managers.filter(m => !q || m.manager.toLowerCase().includes(q));
  const search = h('input', {type: 'search', value: state.managerQuery, placeholder: 'Find a manager', 'aria-label': 'Find a manager'});
  search.addEventListener('change', () => { state.managerQuery = search.value; redraw(); });
  const role = r => (r.total ? `${p1((r.active / r.total) * 100)} · ${formatNumber(r.active)}/${formatNumber(r.total)}` : '—');
  return panel('Leadership', 'Adoption by manager', h('div', {}, h('div.toolbar.sf-row-filters', {}, h('label.field.sf-search', {}, h('span', {}, `${formatNumber(list.length)} managers in scope`), search), exportButton(exportHref('managers'), d.managers.length)),
    sortable([
      {label: 'Manager', key: 'manager', render: r => h('button.sf-link', {type: 'button', title: `Filter by ${r.manager}`, onclick: () => setFilter('manager', r.manager)}, r.manager)},
      {label: 'Reps', key: 'repsRate', num: true, render: r => role(r.reps)}, {label: 'Merch', key: 'merchRate', num: true, render: r => role(r.merch)},
      {label: 'Adoption', key: 'adoptionPct', num: true, render: r => h(`strong${r.adoptionPct >= 50 ? '.sf-orange' : ''}`, {}, r.people.total ? p1(r.adoptionPct) : '—')}
    ], list.map(m => ({...m, repsRate: m.reps.total ? m.reps.active / m.reps.total : -1, merchRate: m.merch.total ? m.merch.active / m.merch.total : -1})), {limit: 12, initial: {key: 'adoptionPct', dir: -1}}),
    list.length > 12 ? h('p.muted.sf-foot', {}, `Showing 12 of ${formatNumber(list.length)}; click a manager to filter the page.`) : h('p.muted.sf-foot', {}, 'Click a manager to filter the page.')));
}

function resourcePanel(d, state, redraw, exportHref) {
  const all = d.resources, act = all.filter(r => r.completed > 0), dormant = all.filter(r => r.completed === 0);
  const seg = state.seg === 'active' && !act.length && all.length ? 'all' : state.seg;
  const pool = seg === 'active' ? act : seg === 'dormant' ? dormant : all;
  const counts = {active: act.length, dormant: dormant.length, all: all.length};
  const tabs = h('div.segmented', {role: 'tablist', 'aria-label': 'Resources'}, SEGMENTS.map(([key, label]) => h('button', {type: 'button', role: 'tab', 'aria-selected': String(seg === key), class: seg === key ? 'on' : '', onclick: () => { state.seg = key; redraw(); }}, `${label} (${formatNumber(counts[key])})`)));
  const dot = r => h(`i.sf-usage.${r.completed >= d.mix.heavyAt ? 'habitual' : r.completed > 0 ? 'trialling' : 'dormant'}`);
  return panel('People', 'Resource leaderboard', h('div', {}, h('div.sf-seg', {}, tabs, exportButton(exportHref('resources'), all.length)), sortable([
    {label: 'Resource', key: 'rep', render: r => h('span.sf-person', {}, dot(r), r.rep)}, {label: 'Type', key: 'resourceType'}, {label: 'Region', key: 'region'}, {label: 'Manager', key: 'manager'},
    {label: 'Captures', key: 'completed', num: true, render: r => h(`strong${r.completed ? '.sf-orange' : '.muted'}`, {}, formatNumber(r.completed))}, {label: 'Open', key: 'open', num: true, render: r => formatNumber(r.open)}
  ], pool, {limit: 25, initial: {key: 'completed', dir: -1}}), h('p.muted.sf-foot', {}, pool.length > 25 ? `Showing the top 25 of ${formatNumber(pool.length)} resources` : `${formatNumber(pool.length)} resources in this view`)), null, true);
}

function storePanel(d, state, redraw, exportHref) {
  const q = state.storeQuery.trim().toLowerCase();
  const list = d.stores.rows.filter(x => !q || x.store.toLowerCase().includes(q));
  const search = h('input', {type: 'search', value: state.storeQuery, placeholder: 'Find a store', 'aria-label': 'Find a store'});
  search.addEventListener('change', () => { state.storeQuery = search.value; redraw(); });
  const stateOf = x => (x.completed === 0 ? h('span.pill.small', {}, 'Untouched') : x.open === 0 ? h('span.pill.small.orange', {}, 'Complete') : h('span.pill.small.blue', {}, 'In progress'));
  return panel('Stores', 'Store coverage', h('div', {}, h('div.toolbar.sf-row-filters', {}, h('label.field.sf-search', {}, h('span', {}, `${formatNumber(d.stores.total)} stores in scope`), search), exportButton(exportHref('stores'), d.stores.total)),
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
