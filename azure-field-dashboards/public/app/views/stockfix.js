import {h, icon, formatNumber, sizeBars, sortable} from '../ui.js';
import {api} from '../api.js';

// StockFix (/stockfix): the weekly StockFix reporting that used to open the StockFix app, read from the files the
// StockFix backend publishes to SharePoint. Overview, Leaderboard, Action impact and Store detail for one week ending,
// filtered by client, banner and region. Reps keep capturing their store tasks in the StockFix app.
const FIELD_APP = 'https://stock-fix.replit.app/';
const VIEWS = [['overview', 'Overview'], ['leaderboard', 'Leaderboard'], ['impact', 'Action impact'], ['detail', 'Store detail']];
const FILTERS = [['client', 'Client', 'clients', 'All clients'], ['banner', 'Banner', 'banners', 'All banners'], ['region', 'Region', 'regions', 'All regions']];
const STATUSES = [['', 'All statuses'], ['actioned', 'Actioned'], ['pending', 'Pending'], ['escalated', 'Escalated']];
const weekLabel = (iso, style = 'medium') => new Intl.DateTimeFormat('en-ZA', style === 'short' ? {day: 'numeric', month: 'short', timeZone: 'UTC'} : {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const when = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(iso));
const pct = (v, digits = 1) => `${formatNumber((v || 0) * 100, digits)}%`;
const numCell = v => (v == null ? '' : formatNumber(v, Number.isInteger(v) ? 0 : 1));

export async function renderStockFix(main, context) {
  const params = new URLSearchParams(location.search);
  const state = {
    view: VIEWS.some(([v]) => v === params.get('view')) ? params.get('view') : 'overview',
    week: /^\d{4}-\d{2}-\d{2}$/.test(params.get('week') || '') ? params.get('week') : '',
    filters: Object.fromEntries(FILTERS.map(([k]) => [k, params.get(k) || '']).filter(([, v]) => v)),
    rows: {classification: params.get('classification') || '', status: params.get('status') || '', q: params.get('q') || '', page: 1}
  };
  let data = null;
  const query = (extra = {}) => new URLSearchParams(Object.entries({week: state.week, ...state.filters, ...extra}).filter(([, v]) => v)).toString();
  const rowQuery = (extra = {}) => query({classification: state.rows.classification, status: state.rows.status, q: state.rows.q, ...extra});

  const weekSel = h('select', {'aria-label': 'Week ending'});
  const refresh = h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh');
  const fieldApp = h('a.button.ghost', {href: FIELD_APP, target: '_blank', rel: 'noopener'}, icon('external'), 'StockFix app');
  const filterBar = h('section.toolbar.sales-filters', {'aria-label': 'StockFix filters'});
  const tabs = h('nav.view-tabs', {'aria-label': 'StockFix views'});
  const body = h('div.sf-body');
  main.replaceChildren(
    h('header.page-head', {},
      h('div', {}, h('p.eyebrow', {}, 'Weekly store actions'), h('h1', {}, 'StockFix'), h('p.lede.compact', {}, 'Store tasks raised from client stock on hand, what reps actioned, and whether stock and sales recovered.')),
      h('div.head-actions', {}, h('label.field', {}, h('span', {}, 'Week ending'), weekSel), refresh, fieldApp)),
    h('section.panel.sales-filter-panel', {}, filterBar), tabs, body);
  weekSel.addEventListener('change', () => { state.week = weekSel.value; state.rows.page = 1; load(); });

  // The address keeps the view, week and filters, so a view can be bookmarked or shared.
  function remember() {
    const q = state.view === 'detail' ? rowQuery({view: state.view}) : query({view: state.view === 'overview' ? '' : state.view});
    history.replaceState(null, '', `/stockfix${q ? `?${q}` : ''}`);
  }
  const loading = () => h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…');
  const failed = (title, error, retry) => h('section.state-panel.error', {}, icon('alert'), h('h2', {}, title), h('p', {}, error.message), error.requestId ? h('p.muted', {}, `Reference ${error.requestId}`) : null, h('button.button', {type: 'button', onclick: retry}, icon('refresh'), 'Try again'));

  async function load() {
    remember();
    body.replaceChildren(loading());
    try {
      data = await api(`/stockfix?${query()}`, {signal: context.signal});
      if (data.week) state.week = data.week;
      remember();
      weekSel.replaceChildren(...data.weeks.map(w => h('option', {value: w, selected: w === data.week}, weekLabel(w))));
      weekSel.disabled = !data.weeks.length;
      drawFilters();
      drawTabs();
      await draw();
    } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(failed('StockFix could not load', error, () => load()));
    }
  }

  function setFilter(key, value) { if (value) state.filters[key] = value; else delete state.filters[key]; state.rows.page = 1; load(); }
  function drawFilters() {
    filterBar.replaceChildren(
      ...FILTERS.map(([key, label, list, all]) => {
        const values = data.filters[list] || [];
        const current = state.filters[key];
        const options = current && !values.includes(current) ? [current, ...values] : values;
        return h('label.field', {}, h('span', {}, label), h('select', {onchange: e => setFilter(key, e.target.value)}, h('option', {value: ''}, all), options.map(v => h('option', {value: v, selected: v === current}, v))));
      }),
      h('button.button.ghost', {type: 'button', disabled: !Object.keys(state.filters).length, onclick: () => { state.filters = {}; state.rows.page = 1; load(); }}, 'Clear filters'));
  }
  function drawTabs() {
    tabs.replaceChildren(...VIEWS.map(([v, label]) => h('button', {type: 'button', class: state.view === v ? 'on' : '', 'aria-current': state.view === v ? 'page' : null, onclick: () => { state.view = v; drawTabs(); remember(); draw(); }}, label)));
  }

  async function draw() {
    if (!data.week) {
      body.replaceChildren(h('section.state-panel', {}, h('span.state-icon', {}, icon('box')), h('h2', {}, 'No StockFix weeks published yet'),
        h('p', {}, 'Weeks appear here after the StockFix weekly cycle exports its feedback and the dashboard data is rebuilt on SharePoint.')));
      return;
    }
    const status = h('div.notice', {role: 'status'}, icon('clock'), h('span', {}, h('strong', {}, `Week ending ${weekLabel(data.week)}`),
      data.weekRows != null ? ` · ${formatNumber(data.weekRows)} store tasks` : '', data.updatedAt ? ` · StockFix data updated ${when(data.updatedAt)}` : ''));
    if (state.view === 'detail') { body.replaceChildren(status, loading()); body.replaceChildren(status, await detailView()); }
    else body.replaceChildren(status, ...(state.view === 'leaderboard' ? leaderboardView() : state.view === 'impact' ? impactView() : overviewView()));
    sizeBars(body);
  }

  // A KPI tile, with the change against the prior week when there is one.
  function stat(label, value, hint, change = null, unit = '%') {
    return h('div.stat', {}, h('span.stat-label', {}, label), h('strong.stat-value', {}, value), hint ? h('span.stat-hint', {}, hint) : null,
      change == null || !data.priorWeek ? null : h(`span.delta.${change > 0.0005 ? 'good' : change < -0.0005 ? 'bad' : 'flat'}`, {}, `${change > 0 ? '▲' : change < 0 ? '▼' : '■'} ${formatNumber(Math.abs(change) * 100, 1)}${unit} vs ${weekLabel(data.priorWeek, 'short')}`));
  }
  const change = (now, before) => (before ? (now - before) / before : null);
  const panel = (eyebrow, title, content, extra = null, wide = false) => h(`section.panel${wide ? '.wide' : ''}`, {}, h('div.panel-head', {}, h('div', {}, eyebrow ? h('p.eyebrow', {}, eyebrow) : null, h('h2', {}, title)), extra), content);

  // Horizontal bars: rows of {label, …}; value(r) 0..max, shown(r) and sub(r) as text. Clicking filters when `filter` is set.
  function bars(rows, value, shown, sub, filter = null) {
    if (!rows.length) return h('p.empty', {}, 'No data in this selection.');
    const max = Math.max(1e-9, ...rows.map(value));
    const active = filter && state.filters[filter];
    return h('ol.hbars', {class: filter ? '' : 'static'}, rows.map(r => {
      const inner = [h('span.hbar-label', {}, r.label), h('span.hbar-track', {}, h('span.hbar-fill', {dataset: {w: String(value(r) / max)}})), h('span.hbar-value', {}, shown(r)), h('span.hbar-sub', {}, sub(r))];
      return h('li', {}, filter && !['Unknown', 'Unassigned'].includes(r.label)
        ? h('button', {type: 'button', class: r.label === active ? 'on' : '', title: `Filter by ${r.label}`, onclick: () => setFilter(filter, r.label === active ? '' : r.label)}, ...inner)
        : h('div', {}, ...inner));
    }));
  }
  const taskBars = (rows, filter) => bars(rows, r => r.tasks, r => formatNumber(r.tasks), r => `${pct(r.completion)} actioned · ${formatNumber(r.pending)} pending`, filter);

  function overviewView() {
    const o = data.overview, t = o.totals, p = o.prior;
    const kpis = h('section.stat-grid.sales-kpis', {'aria-label': 'StockFix key figures'},
      stat('Store tasks', formatNumber(t.tasks), 'Raised for the week', p ? change(t.tasks, p.tasks) : null),
      stat('Actioned', formatNumber(t.actioned), 'Completed, fixed or actioned', p ? change(t.actioned, p.actioned) : null),
      stat('Completion', pct(t.completion), `${formatNumber(t.escalated)} escalated`, p ? t.completion - p.completion : null, ' pts'),
      stat('Pending', formatNumber(t.pending), 'Still to action'),
      stat('Stores', t.stores == null ? '—' : formatNumber(t.stores), 'With a task this week'),
      stat('SKUs', t.skus == null ? '—' : formatNumber(t.skus), t.feedback == null ? 'Store detail not published' : `${formatNumber(t.feedback)} tasks with feedback`));
    const trendMax = Math.max(1, ...o.trend.map(w => w.tasks));
    const trend = panel('Trend', 'Tasks and completion by week', o.trend.length ? h('div.day-cols.sf-trend', {role: 'img', 'aria-label': 'Store tasks by week ending, with the share actioned'},
      o.trend.map(w => h('div.day-col', {title: `${weekLabel(w.week)}: ${formatNumber(w.tasks)} tasks · ${pct(w.completion)} actioned`, class: w.week === data.week ? 'on' : ''},
        h('span.day-prior', {dataset: {h: String(w.tasks / trendMax)}}), h('span.day-bar', {dataset: {h: String(w.actioned / trendMax)}}), h('em', {}, weekLabel(w.week, 'short')))))
      : h('p.empty', {}, 'No weeks in this selection.'), h('div.legend', {}, h('span', {}, h('i.swatch.prev'), 'Tasks'), h('span', {}, h('i.swatch.cur'), 'Actioned')), true);
    return [kpis, h('div.sales-grid', {},
      trend,
      panel('Stock position', 'By classification', taskBars(o.byClassification)),
      panel('Execution', 'By action status', bars(o.byStatus, r => r.tasks, r => formatNumber(r.tasks), r => pct(t.tasks ? r.tasks / t.tasks : 0))),
      panel('Clients', 'By client', taskBars(o.byClient, 'client')),
      panel('Coverage', 'By region', taskBars(o.byRegion, 'region')),
      panel('Retail', 'By banner', taskBars(o.byBanner, 'banner'), null, true))];
  }

  function leaderboardView() {
    const l = data.leaderboard, t = l.totals, p = l.prior;
    const captureBars = rows => bars(rows, r => r.rate, r => pct(r.rate), r => `${formatNumber(r.captured)} of ${formatNumber(r.assigned)} tasks · ${formatNumber(r.storesCaptured)} of ${formatNumber(r.storesAssigned)} stores`);
    const kpis = h('section.stat-grid.sales-kpis', {'aria-label': 'StockFix capture figures'},
      stat('Capture rate', pct(t.rate), 'Tasks with rep feedback', p ? t.rate - p.rate : null, ' pts'),
      stat('Tasks captured', formatNumber(t.captured), `of ${formatNumber(t.assigned)} assigned`, p ? change(t.captured, p.captured) : null),
      stat('Store capture', pct(t.storeRate), `${formatNumber(t.storesCaptured)} of ${formatNumber(t.storesAssigned)} store assignments`),
      stat('Reps', formatNumber(t.reps), `${formatNumber(t.managers)} managers`));
    const heat = l.heat;
    const cell = c => (c ? h(`td.heat.sf-heat.${c.rate >= 0.8 ? 'good' : c.rate >= 0.5 ? 'mid' : 'low'}`, {dataset: {a: String(c.rate)}, title: `${formatNumber(c.captured)} of ${formatNumber(c.assigned)} tasks captured`}, pct(c.rate, 0)) : h('td.heat.none', {}, '·'));
    const heatPanel = panel('Last four weeks', 'Capture rate by region', heat.regions.length ? h('div.table-wrap.heat-wrap', {}, h('table.table.heat-table', {},
      h('thead', {}, h('tr', {}, h('th', {scope: 'col'}, 'Region'), heat.weeks.map(w => h('th', {scope: 'col'}, weekLabel(w, 'short'))))),
      h('tbody', {}, heat.regions.map(r => h('tr', {}, h('th', {scope: 'row'}, r.region), r.cells.map(cell))))))
      : h('p.empty', {}, 'No capture data in this selection.'), h('span.legend', {}, h('span', {}, h('i.swatch.sf-good'), '80%+'), h('span', {}, h('i.swatch.sf-mid'), '50–79%'), h('span', {}, h('i.swatch.sf-low'), 'under 50%')), true);
    const reps = panel('People', 'Reps', sortable([
      {label: 'Rep', key: 'rep'}, {label: 'Manager', key: 'manager'}, {label: 'Type', key: 'resourceType'}, {label: 'Regions', key: 'regions'},
      {label: 'Assigned', key: 'assigned', num: true, render: r => formatNumber(r.assigned)}, {label: 'Captured', key: 'captured', num: true, render: r => formatNumber(r.captured)},
      {label: 'Capture rate', key: 'rate', num: true, render: r => pct(r.rate)}, {label: 'Stores captured', key: 'storeRate', num: true, render: r => `${formatNumber(r.storesCaptured)} / ${formatNumber(r.storesAssigned)}`}
    ], l.reps, {initial: {key: 'rate', dir: -1}}), h('span.muted', {}, `${formatNumber(l.reps.length)} reps`), true);
    return [kpis, h('div.sales-grid', {}, panel('Leadership', 'Capture by manager', captureBars(l.byManager)), panel('Teams', 'Capture by resource type', captureBars(l.byResourceType)), heatPanel, reps)];
  }

  function impactView() {
    const x = data.impact;
    if (!x.available) {
      return [h('section.state-panel', {}, h('span.state-icon', {}, icon('target')), h('h2', {}, 'No Action Impact for this week yet'),
        h('p', {}, x.targets.length ? `Action Impact starts at ${weekLabel(x.targets[0])}. Choose that week or a later one.` : 'Action Impact needs five published weeks: it compares feedback tasks with the same store and SKU over the four weeks after them.'))];
    }
    const t = x.totals;
    const kpis = h('section.stat-grid.sales-kpis', {'aria-label': 'StockFix action impact'},
      stat('Feedback tasks', formatNumber(t.feedbackTasks), `${pct(t.matchRate)} still ranged and matched`),
      stat('Sales improved', pct(t.salesImprovementRate), `${formatNumber(t.salesImprovedTasks)} tasks · +${formatNumber(t.salesUnitsGained)} P4W units`),
      stat('Availability restored', pct(t.availabilityRestoreRate), `${formatNumber(t.availabilityRestoredTasks)} of ${formatNumber(t.availabilityRiskTasks)} at risk · +${formatNumber(t.availabilitySohRestored)} SOH`),
      stat('Overstock reduced', pct(t.overstockReductionRate), `${formatNumber(t.overstockReducedTasks)} of ${formatNumber(t.overstockTasks)} · −${formatNumber(t.overstockSohReduced)} SOH`),
      stat('Negative SOH fixed', pct(t.negativeSohResolveRate), `${formatNumber(t.negativeSohResolvedTasks)} of ${formatNumber(t.negativeSohTasks)}`),
      stat('No-sales resolved', pct(t.noSalesResolveRate), `${formatNumber(t.noSalesResolvedTasks)} of ${formatNumber(t.noSalesTasks)}`),
      stat('Stores impacted', formatNumber(t.impactedStores), `of ${formatNumber(t.feedbackStores)} with feedback`));
    const columns = first => [{label: first, key: 'label'},
      {label: 'Feedback tasks', key: 'feedbackTasks', num: true, render: r => formatNumber(r.feedbackTasks)}, {label: 'Matched', key: 'matchRate', num: true, render: r => pct(r.matchRate)},
      {label: 'Sales improved', key: 'salesImprovementRate', num: true, render: r => pct(r.salesImprovementRate)}, {label: 'Availability restored', key: 'availabilityRestoreRate', num: true, render: r => (r.availabilityRiskTasks ? pct(r.availabilityRestoreRate) : '—')},
      {label: 'Overstock reduced', key: 'overstockReductionRate', num: true, render: r => (r.overstockTasks ? pct(r.overstockReductionRate) : '—')}, {label: 'Stores impacted', key: 'impactedStores', num: true, render: r => formatNumber(r.impactedStores)}];
    const note = x.targetWeek === data.week ? '' : ` (the latest comparison up to ${weekLabel(data.week)})`;
    return [h('div.notice', {}, icon('target'), h('span', {}, `Feedback captured in the week ending ${x.baselineWeek ? weekLabel(x.baselineWeek) : '—'}, measured over the four weeks to ${weekLabel(x.targetWeek)}${note}.`)), kpis,
      h('div.sales-grid', {}, panel('Leadership', 'Impact by manager', sortable(columns('Manager'), x.byManager, {initial: {key: 'feedbackTasks', dir: -1}}), null, true),
        panel('Clients', 'Impact by client', sortable(columns('Client'), x.byClient, {initial: {key: 'feedbackTasks', dir: -1}}), null, true))];
  }

  async function detailView() {
    try {
      const d = await api(`/stockfix/rows?${rowQuery({page: String(state.rows.page)})}`, {signal: context.signal});
      state.rows.page = d.page;
      const classSel = h('select', {onchange: e => { state.rows.classification = e.target.value; state.rows.page = 1; remember(); draw(); }}, h('option', {value: ''}, 'All classifications'),
        (state.rows.classification && !d.options.classifications.includes(state.rows.classification) ? [state.rows.classification, ...d.options.classifications] : d.options.classifications).map(v => h('option', {value: v, selected: v === state.rows.classification}, v)));
      const statusSel = h('select', {onchange: e => { state.rows.status = e.target.value; state.rows.page = 1; remember(); draw(); }}, STATUSES.map(([v, label]) => h('option', {value: v, selected: v === state.rows.status}, label)));
      const search = h('input', {type: 'search', value: state.rows.q, placeholder: 'Store, article, barcode or rep', 'aria-label': 'Search store tasks'});
      search.addEventListener('keydown', e => { if (e.key === 'Enter') { state.rows.q = search.value.trim(); state.rows.page = 1; remember(); draw(); } });
      const exportLink = h('a.button', {href: `/api/stockfix/export?${rowQuery()}`, download: ''}, icon('external'), 'Download Excel');
      exportLink.hidden = !d.totalRows;
      const go = page => { state.rows.page = page; draw(); };
      return h('section.panel.sf-detail', {},
        h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Store level'), h('h2', {}, 'Store tasks')), h('span.muted', {}, `${formatNumber(d.totalRows)} tasks`)),
        h('div.toolbar.sf-row-filters', {}, h('label.field', {}, h('span', {}, 'Classification'), classSel), h('label.field', {}, h('span', {}, 'Status'), statusSel),
          h('label.field.sf-search', {}, h('span', {}, 'Search'), search), exportLink),
        sortable([
          {label: 'Store', key: 'store'}, {label: 'Region', key: 'region'}, {label: 'Rep', key: 'rep'}, {label: 'Article', key: 'article'}, {label: 'Barcode', key: 'barcode'},
          {label: 'Store SOH', key: 'storeSoh', num: true, render: r => numCell(r.storeSoh)}, {label: 'DC SOH', key: 'dcSoh', num: true, render: r => numCell(r.dcSoh)},
          {label: 'P4W sales', key: 'p4Sales', num: true, render: r => numCell(r.p4Sales)}, {label: 'WFC', key: 'storeWfc', num: true, render: r => numCell(r.storeWfc)},
          {label: 'Classification', key: 'classification'}, {label: 'Action', key: 'action'}, {label: 'Status', key: 'actionStatus'}, {label: 'Feedback', key: 'feedback', render: r => h('span.sf-feedback', {title: [r.reasonCode, r.feedback, r.actionComment].filter(Boolean).join(' · ')}, r.feedback || r.reasonCode || '')}
        ], d.records, {initial: {key: 'store', dir: 1}}),
        h('div.pager', {}, d.pageCount > 1 ? [h('button.button.small', {type: 'button', disabled: d.page <= 1, onclick: () => go(d.page - 1)}, 'Previous'), h('span.muted', {}, `Page ${d.page} of ${d.pageCount}`),
          h('button.button.small', {type: 'button', disabled: d.page >= d.pageCount, onclick: () => go(d.page + 1)}, 'Next')] : null));
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return failed('The store detail could not load', error, () => draw());
    }
  }

  await load();
}
