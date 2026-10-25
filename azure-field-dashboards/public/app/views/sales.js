import {h, icon, formatNumber, formatRand, sizeBars, sortable} from '../ui.js';
import {api} from '../api.js';

// Sales dashboard (/sales, Nexus admins): month-to-date Geo Rep Capture orders from Azure SQL, with the Firebase-era
// filters, KPI drilldowns, charts, unmapped stores and import reconciliation. Clicking a bar filters by it; every KPI
// is compared with the previous month over the same days.
const FILTERS = [['region', 'Region', 'regions', 'All regions'], ['rep', 'Rep', 'reps', 'All reps'], ['manager', 'Manager', 'managers', 'All managers'], ['store', 'Store', 'stores', 'All stores'],
  ['sku', 'Product SKU', 'skus', 'All SKUs'], ['product', 'Product', 'products', 'All products'], ['status', 'Order status', 'statuses', 'All statuses']];
// [metric, label, value, note, comparable metric key]
const KPIS = [
  ['sales-value', 'Sales value', m => formatRand(m.salesValue), m => `${formatNumber(m.orderLines)} order lines`, 'salesValue'],
  ['orders', 'Orders', m => formatNumber(m.orders), () => 'Unique order numbers', 'orders'],
  ['units', 'Units', m => formatNumber(m.quantity), m => `${formatNumber(m.averageUnitsPerOrder, 1)} per order`, 'quantity'],
  ['average-order', 'Average order', m => formatRand(m.averageOrderValue), () => 'Value per transaction', 'averageOrderValue'],
  ['stores', 'Active stores', m => formatNumber(m.stores), () => 'Stores with orders', 'stores'],
  ['reps', 'Active reps', m => formatNumber(m.reps), () => 'Reps with orders', 'reps'],
  ['mapped', 'Mapped to region', m => `${formatNumber(m.mappedPercent, 1)}%`, m => `${formatNumber(m.missingRegionRows)} lines without a region`, null],
  ['latest-import', 'Latest import', m => formatNumber(m.latestNewRecords), m => (m.reconciled ? 'New lines · reconciled' : 'New order lines added'), null]
];
// [chart key, eyebrow, title, filter it sets]
const CHARTS = [['byRegion', 'Coverage', 'Sales by region', 'region'], ['byRep', 'Execution', 'Sales by rep', 'rep'], ['byStore', 'Coverage', 'Top stores', 'store'], ['byProduct', 'Products', 'Top products', 'product'],
  ['bySku', 'Products', 'Top product SKUs', 'sku'], ['byManager', 'Leadership', 'Sales by manager', 'manager'], ['byStatus', 'Order quality', 'Order status', 'status']];
const monthName = (period, style = 'long') => new Intl.DateTimeFormat('en-ZA', {month: style, year: 'numeric', timeZone: 'UTC'}).format(new Date(`${period}-01T00:00:00Z`));
const monthShort = period => new Intl.DateTimeFormat('en-US', {month: 'short', timeZone: 'UTC'}).format(new Date(`${period}-01T00:00:00Z`));
const dayLabel = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const when = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(iso));
const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`;
const FORMAT = {currency: v => formatRand(v), number: v => formatNumber(v), number1: v => formatNumber(v, 1), percent: v => `${formatNumber(v, 1)}%`};

export async function renderSales(main, context) {
  const params = new URLSearchParams(location.search);
  const state = {period: /^\d{4}-\d{2}$/.test(params.get('period') || '') ? params.get('period') : '', filters: Object.fromEntries(FILTERS.map(([k]) => [k, params.get(k) || '']).filter(([, v]) => v))};
  const query = (extra = {}) => new URLSearchParams(Object.entries({period: state.period, ...state.filters, ...extra}).filter(([, v]) => v)).toString();

  const monthSel = h('select', {'aria-label': 'Month'});
  const exportLink = h('a.button', {href: '#', download: ''}, icon('external'), 'Download Excel');
  const refresh = h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh');
  const filterBar = h('section.toolbar.sales-filters', {'aria-label': 'Sales dashboard filters'});
  const body = h('div.sales-body');
  const dialog = h('dialog.drill', {'aria-labelledby': 'drillTitle'});
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  main.replaceChildren(
    h('header.page-head', {},
      h('div', {}, h('p.eyebrow', {}, 'Geo Rep Capture orders'), h('h1', {}, 'Sales dashboard'), h('p.lede.compact', {}, 'Month-to-date orders from Geo Rep Capture, grouped by the approved Geo Store Master.')),
      h('div.head-actions', {}, h('label.field', {}, h('span', {}, 'Month'), monthSel), refresh, exportLink)),
    h('section.panel.sales-filter-panel', {}, filterBar), body, dialog);
  monthSel.addEventListener('change', () => { state.period = monthSel.value; state.filters = {}; load(); });

  // The address keeps the month and filters, so a view can be bookmarked or shared with another admin.
  function remember() { history.replaceState(null, '', `/sales${query() ? `?${query()}` : ''}`); }

  async function load() {
    remember();
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try {
      const d = await api(`/sales?${query()}`, {signal: context.signal});
      state.period = d.period;
      remember();
      monthSel.replaceChildren(...(d.periods.some(p => p.period === d.period) ? d.periods : [{period: d.period, lines: 0}, ...d.periods]).map(p => h('option', {value: p.period, selected: p.period === d.period}, monthName(p.period))));
      exportLink.href = `/api/sales/export?${query()}`;
      exportLink.hidden = !d.metrics.orderLines;
      drawFilters(d);
      body.replaceChildren(...render(d));
      sizeBars(body);
    } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'The sales dashboard could not load'), h('p', {}, error.message), h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Try again')));
    }
  }

  function setFilter(key, value) { if (value) state.filters[key] = value; else delete state.filters[key]; load(); }

  function drawFilters(d) {
    filterBar.replaceChildren(
      ...FILTERS.map(([key, label, list, all]) => {
        const values = d.filters[list] || [];
        const current = state.filters[key];
        const options = current && !values.includes(current) ? [current, ...values] : values;
        return h('label.field', {}, h('span', {}, label), h('select', {onchange: e => setFilter(key, e.target.value)}, h('option', {value: ''}, all), options.map(v => h('option', {value: v, selected: v === current}, v))));
      }),
      h('button.button.ghost', {type: 'button', disabled: !Object.keys(state.filters).length, onclick: () => { state.filters = {}; load(); }}, 'Clear filters'));
  }

  function render(d) {
    const m = d.metrics, p = d.priorMetrics;
    const against = d.comparedDays ? `vs 1–${d.comparedDays} ${monthShort(d.priorPeriod)}` : `vs ${monthName(d.priorPeriod, 'short')}`;
    if (!m.orderLines && !Object.keys(state.filters).length) {
      return [h('section.state-panel', {}, h('span.state-icon', {}, icon('bars')), h('h2', {}, `No orders for ${monthName(d.period)} yet`), h('p', {}, 'The Geo Rep Transaction Report import runs every morning; its order lines appear here within the hour.'))];
    }
    const imp = d.latestImport;
    const status = h('div.notice', {role: 'status'}, icon(m.reconciled ? 'checkCircle' : 'clock'), h('span', {},
      imp ? [h('strong', {}, `Latest import ${imp.completedAt ? when(imp.completedAt) : ''}`), imp.message ? ` · ${imp.message}` : ''] : `No import recorded for ${monthName(d.period)}.`,
      d.lastOrderDate ? ` Orders up to ${dayLabel(d.lastOrderDate)}.` : ''));
    const kpis = h('section.stat-grid.sales-kpis', {'aria-label': 'Sales key performance indicators'}, KPIS.map(([metric, label, value, note, key]) => {
      const change = key && p && p[key] ? (m[key] - p[key]) / p[key] : null;
      return h('button.stat.sales-kpi', {type: 'button', 'aria-label': `Open ${label} analysis`, onclick: () => drill(metric)},
        h('span.stat-label', {}, label), h('strong.stat-value', {}, value(m)), h('span.stat-hint', {}, note(m)),
        change == null ? null : h(`span.delta.${change > 0.0005 ? 'good' : change < -0.0005 ? 'bad' : 'flat'}`, {}, `${change > 0 ? '▲' : change < 0 ? '▼' : '■'} ${formatNumber(Math.abs(change) * 100, 1)}% ${against}`),
        h('span.kpi-open', {'aria-hidden': 'true'}, icon('arrow')));
    }));
    return [status, kpis, h('div.sales-grid', {}, dailyPanel(d, against), ...CHARTS.map(c => barPanel(d, ...c)), unmappedPanel(d), qualityPanel(d), recentPanel(d))];
  }

  function dailyPanel(d, against) {
    const days = d.charts.daily;
    const prior = new Map(d.charts.priorDaily.map(x => [x.label.slice(8, 10), x.value]));
    const max = Math.max(1, ...days.map(x => x.value), ...prior.values());
    const total = days.reduce((s, x) => s + x.value, 0), priorTotal = [...prior.values()].reduce((s, x) => s + x, 0);
    return h('section.panel.wide', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Daily movement'), h('h2', {}, 'Order value by day')), h('span.muted', {}, `${formatRand(total)} this month · ${formatRand(priorTotal)} ${against.replace(/^vs /, 'in ')}`)),
      days.length ? h('div.day-cols', {role: 'img', 'aria-label': `Order value by day for ${monthName(d.period)}`}, days.map(x => h('div.day-col', {title: `${dayLabel(x.label)}: ${formatRand(x.value)} · ${formatNumber(x.orders)} orders${prior.has(x.label.slice(8, 10)) ? ` · same day last month ${formatRand(prior.get(x.label.slice(8, 10)))}` : ''}`},
        h('span.day-prior', {dataset: {h: String((prior.get(x.label.slice(8, 10)) || 0) / max)}}), h('span.day-bar', {dataset: {h: String(x.value / max)}}), h('em', {}, x.label.slice(8, 10)))))
        : h('p.empty', {}, 'No orders in this selection.'),
      h('div.legend', {}, h('span', {}, h('i.swatch.cur'), monthName(d.period, 'short')), h('span', {}, h('i.swatch.prev'), `${monthShort(d.priorPeriod)}, same day`)));
  }

  function barPanel(d, key, eyebrow, title, filter) {
    const rows = d.charts[key];
    const max = Math.max(1, ...rows.map(r => r.value));
    const active = state.filters[filter];
    return h('section.panel', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, eyebrow), h('h2', {}, title)), active ? h('button.button.ghost.small', {type: 'button', onclick: () => setFilter(filter, '')}, `Clear ${active}`) : null),
      rows.length ? h('ol.hbars', {}, rows.map(r => h('li', {}, h('button', {type: 'button', class: r.label === active ? 'on' : '', title: `Filter by ${r.label}`, onclick: () => setFilter(filter, r.label === active || r.label === 'Unassigned' ? '' : r.label)},
        h('span.hbar-label', {}, r.label), h('span.hbar-track', {}, h('span.hbar-fill', {dataset: {w: String(r.value / max)}})), h('span.hbar-value', {}, formatRand(r.value)), h('span.hbar-sub', {}, `${plural(r.orders, 'order')} · ${formatNumber(r.quantity)} units`)))))
        : h('p.empty', {}, 'No data in this selection.'));
  }

  function unmappedPanel(d) {
    return h('section.panel', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Data quality'), h('h2', {}, 'Unmapped stores')), h('span.muted', {}, `${formatNumber(d.quality.unmappedStoreCount)} store${d.quality.unmappedStoreCount === 1 ? '' : 's'}`)),
      d.unmapped.length ? h('ul.plain-list', {}, d.unmapped.map(r => h('li', {}, h('span', {}, r.label), h('strong', {}, formatRand(r.value)), h('em', {}, `${plural(r.orders, 'order')}`)))) : h('p.empty', {}, 'Every store in this selection matches the Store Master.'));
  }

  function qualityPanel(d) {
    const q = d.quality, r = q.reconciliation;
    const rows = [['Source rows', q.sourceRows], ['Unique source rows', q.uniqueSourceRows], ['Duplicates removed', q.duplicateSourceRows], ['New lines', q.newRecords], ['Already existed', q.existingRecords], ['Stale rows reconciled', q.staleRowsRemoved],
      ['Lines without a region', q.missingRegionRows], ['Lines without a rep', q.missingRepRows], ['Lines without an order number', q.missingOrderNumberRows]];
    if (q.storeMasterQuality) rows.push(['Store Master rows usable', q.storeMasterQuality.usableRows]);
    return h('section.panel', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Import control'), h('h2', {}, 'Reconciliation')), h(`span.pill.small.${r?.reconciled ? 'green' : 'orange'}`, {}, r ? (r.reconciled ? 'Reconciled' : 'Check') : 'Waiting')),
      h('dl.facts', {}, rows.map(([label, value]) => [h('dt', {}, label), h('dd', {}, formatNumber(value))]),
        r ? [h('dt', {}, 'Month-to-date value'), h('dd', {}, formatRand(r.monthToDateValue))] : null,
        d.config?.storeMasterName ? [h('dt', {}, 'Store Master'), h('dd', {}, d.config.storeMasterName)] : null,
        d.latestImport?.sourceFileName ? [h('dt', {}, 'Source file'), h('dd.wrap', {}, d.latestImport.sourceFileName)] : null));
  }

  function recentPanel(d) {
    return h('section.panel.wide', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Transaction detail'), h('h2', {}, 'Latest order lines')), h('button.button.ghost.small', {type: 'button', onclick: () => drill('sales-value')}, `All ${formatNumber(d.metrics.orderLines)} lines`, icon('arrow'))),
      linesTable(d.recentOrders));
  }

  const linesTable = rows => sortable([
    {label: 'Date', key: 'orderDate', render: r => h('span.nowrap', {}, r.orderDate)}, {label: 'Transaction', key: 'orderNumber'}, {label: 'Store', key: 'storeName'}, {label: 'Region', key: 'region'},
    {label: 'Rep', key: 'rep'}, {label: 'Product', key: 'product'}, {label: 'Status', key: 'status'}, {label: 'Units', key: 'quantity', num: true, render: r => formatNumber(r.quantity)}, {label: 'Value', key: 'value', num: true, render: r => formatRand(r.value)}
  ], rows, {initial: {key: 'orderDate', dir: -1}});

  async function drill(metric, page = 1) {
    if (!dialog.open) { dialog.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…')); dialog.showModal(); }
    try {
      const x = await api(`/sales/drilldown?${query({metric, page: String(page)})}`, {signal: context.signal});
      const max = Math.max(1, ...x.chart.rows.map(r => (x.chart.format === 'number' ? r.quantity : r.value)));
      dialog.replaceChildren(
        h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, monthName(x.period)), h('h2', {id: 'drillTitle'}, x.title), h('p.muted', {}, x.subtitle)), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
        h('div.stat-grid.drill-stats', {}, h('div.stat.warn', {}, h('span.stat-label', {}, x.primary.label), h('strong.stat-value', {}, FORMAT[x.primary.format](x.primary.value)), h('span.stat-hint', {}, x.primary.note)),
          x.insights.map(i => h('div.stat', {}, h('span.stat-label', {}, i.label), h('strong.stat-value', {}, FORMAT[i.format](i.value))))),
        h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, x.chart.eyebrow), h('h2', {}, x.chart.title))),
          h('ol.hbars.static', {}, x.chart.rows.map(r => { const v = x.chart.format === 'number' ? r.quantity : r.value; return h('li', {}, h('div', {}, h('span.hbar-label', {}, r.label), h('span.hbar-track', {}, h('span.hbar-fill', {dataset: {w: String(v / max)}})), h('span.hbar-value', {}, FORMAT[x.chart.format](v)), h('span.hbar-sub', {}, `${plural(r.orders, 'order')} · ${formatNumber(r.quantity)} units`))); }))),
        h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, x.recordTitle), h('span.muted', {}, `${formatNumber(x.totalRows)} lines`)), linesTable(x.records),
          h('div.pager', {}, x.pageCount > 1 ? [h('button.button.small', {type: 'button', disabled: x.page <= 1, onclick: () => drill(metric, x.page - 1)}, 'Previous'), h('span.muted', {}, `Page ${x.page} of ${x.pageCount}`), h('button.button.small', {type: 'button', disabled: x.page >= x.pageCount, onclick: () => drill(metric, x.page + 1)}, 'Next')] : null)));
      sizeBars(dialog);
    } catch (error) {
      if (error.name !== 'AbortError') dialog.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This analysis could not load'), h('p', {}, error.message), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Close')));
    }
  }

  await load();
}
