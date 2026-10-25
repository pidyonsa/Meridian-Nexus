import {h, icon, formatNumber, toast, sizeBars, sortable} from '../ui.js';
import {api} from '../api.js';

// Distribution gap tracker for any number of clients. Dashboard at /gap-tracker[/<client>]; upload (admins) at
// /admin/gap-upload. Each client's dashboard uses the status colours from its own workbook.
const STATUS = [['noGap', 'No gap', 'n'], ['opportunity', 'Opportunity', 'o'], ['lost', 'Lost', 'l']];
const TRACKED = [['converted', 'Opportunity → No gap', 'good', 'conversion', 'of last week\'s opportunities'], ['recovered', 'Lost → No gap', 'good', 'recovery', 'of last week\'s lost lines'], ['lost', 'No gap → Lost', 'bad', 'loss', 'of last week\'s no-gap lines']];
const OTHER = [['newOpportunity', 'No gap → Opportunity'], ['slipped', 'Opportunity → Lost'], ['reopened', 'Lost → Opportunity']];
const VIEWS = [['overview', 'Overview'], ['products', 'Products'], ['stores', 'Stores'], ['regions', 'Regions'], ['persistent', 'Persistent gaps'], ['changes', 'Every change']];
const dateLabel = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const short = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const pct = v => (v == null ? '–' : `${Math.round(v * 100)}%`);
const pp = v => (v == null ? '' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`);
const signed = n => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));
const tone = n => (n > 0 ? 'good' : n < 0 ? 'bad' : '');
const STATUS_CLASS = {'No gap': 'n', Opportunity: 'o', Lost: 'l'};

// Client colours become CSS variables on the dashboard (CSSOM, allowed by the page's content security policy).
function applyColors(el, colors) {
  for (const [k, v] of Object.entries({n: colors?.N, o: colors?.O, l: colors?.L})) if (/^#[0-9A-F]{6}$/i.test(v || '')) el.style.setProperty(`--st-${k}`, v);
}
const bar = (value, kind = 'n') => h('div.dist-bar', {}, h(`span.fill.${kind}`, {dataset: {w: String(value || 0)}}), h('em', {}, pct(value)));
const statusBadge = label => h(`span.st-badge.${STATUS_CLASS[label] || ''}`, {}, label);


export async function renderGaps(main, context) {
  const list = await api('/gaps', {signal: context.signal});
  if (!list.clients.length) { main.replaceChildren(h('section.state-panel', {}, h('span.state-icon', {}, icon('target')), h('h2', {}, 'No clients yet'), h('p', {}, 'An administrator adds a client when uploading its first gap report.'))); return; }
  const requested = context.path.split('/')[2];
  const client = list.clients.find(c => c.id === requested) || list.clients.find(c => c.latestWeek) || list.clients[0];
  if (requested !== client.id) history.replaceState(null, '', `/gap-tracker/${client.id}`);
  dispatchEvent(new Event('nexus:location'));   // the menu highlights this client straight away
  const data = await api(`/gaps/${client.id}`, {signal: context.signal});
  const root = h('div.gap-root');
  applyColors(root, data.colors);

  const head = h('header.page-head', {},
    h('div', {}, h('p.eyebrow', {}, 'Gap tracker'), h('h1', {}, `${data.label} distribution gaps`), h('p.lede.compact', {}, 'Weekly No gap, Opportunity and Lost per store and product, from the client\'s gap report.')),
    h('div.head-actions', {},
      list.clients.length > 1 ? h('label.field.client-pick', {}, h('span', {}, 'Client'), h('select', {onchange: e => { location.assign(`/gap-tracker/${e.target.value}`); }}, list.clients.map(c => h('option', {value: c.id, selected: c.id === client.id}, c.label)))) : null,
      data.manage ? h('a.button', {href: `/admin/gap-upload?client=${client.id}`, 'data-link': true}, icon('refresh'), 'Upload report') : null));

  const withWeeks = data.banners.filter(b => b.weeks.length);
  if (!withWeeks.length) {
    root.replaceChildren(head, h('section.state-panel', {}, h('span.state-icon', {}, icon('target')), h('h2', {}, `No ${data.label} report yet`), h('p', {}, 'Upload the client\'s weekly gap workbook to start tracking.')));
    main.replaceChildren(root);
    return;
  }

  const allWeeks = [...new Set(withWeeks.flatMap(b => b.weeks.map(w => w.week)))].sort();
  const state = {banner: 'all', from: allWeeks.at(-2) || null, to: allWeeks.at(-1), view: 'overview', move: 'tracked', q: '', region: '', page: 1, storeFilter: 'gaps', persistQ: ''};
  const cache = new Map();
  const get = path => { if (!cache.has(path)) cache.set(path, api(path, {signal: context.signal}).catch(e => { cache.delete(path); throw e; })); return cache.get(path); };
  const weeksFor = () => (state.banner === 'all' ? allWeeks : (data.banners.find(b => b.banner === state.banner)?.weeks || []).map(w => w.week));

  const tabs = h('div.segmented', {role: 'tablist', 'aria-label': 'Banner'});
  const viewTabs = h('nav.view-tabs', {'aria-label': 'Gap tracker views'});
  const fromSel = h('select', {'aria-label': 'Compare from week'}), toSel = h('select', {'aria-label': 'Week'});
  const exportLink = h('a.button', {href: '#', download: ''}, icon('external'), 'Download Excel');
  const body = h('div.gap-body');

  function syncControls() {
    tabs.replaceChildren(...[['all', 'All banners'], ...data.banners.map(b => [b.banner, b.banner])].map(([v, label]) =>
      h('button', {type: 'button', role: 'tab', 'aria-selected': String(state.banner === v), class: state.banner === v ? 'on' : '', onclick: () => { state.banner = v; const w = weeksFor(); if (!w.includes(state.to)) state.to = w.at(-1); if (!w.includes(state.from) || state.from >= state.to) state.from = w.filter(x => x < state.to).at(-1) || null; state.page = 1; load(); }}, label)));
    viewTabs.replaceChildren(...VIEWS.map(([v, label]) => h('button', {type: 'button', class: state.view === v ? 'on' : '', 'aria-current': state.view === v ? 'page' : null, onclick: () => { state.view = v; state.page = 1; load(); }}, label)));
    const weeks = weeksFor();
    toSel.replaceChildren(...weeks.map(w => h('option', {value: w, selected: w === state.to}, dateLabel(w))));
    fromSel.replaceChildren(...weeks.filter(w => w < state.to).map(w => h('option', {value: w, selected: w === state.from}, dateLabel(w))));
    fromSel.disabled = !state.from;
    exportLink.hidden = !state.from;
    if (state.from) exportLink.href = `/api/gaps/${client.id}/export?${new URLSearchParams({banner: state.banner, from: state.from, to: state.to})}`;
  }
  toSel.addEventListener('change', () => { state.to = toSel.value; if (!state.from || state.from >= state.to) state.from = weeksFor().filter(w => w < state.to).at(-1) || null; state.page = 1; load(); });
  fromSel.addEventListener('change', () => { state.from = fromSel.value; state.page = 1; load(); });

  async function load() {
    syncControls();
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try {
      const detail = get(`/gaps/${client.id}/detail?${new URLSearchParams({banner: state.banner, week: state.to})}`);
      const cmp = state.from ? get(`/gaps/${client.id}/compare?${new URLSearchParams({banner: state.banner, from: state.from, to: state.to})}`) : Promise.resolve(null);
      const [d, c] = await Promise.all([detail, cmp]);
      const render = {overview, products, stores, regions, persistent, changes}[state.view];
      body.replaceChildren(...[render(d, c)].flat().filter(Boolean));
      sizeBars(body);
    } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This view could not load'), h('p', {}, error.message)));
    }
  }

  const noCompare = () => h('p.empty.panel', {}, 'This banner has only one week so far; movements appear once a second week is uploaded.');
  const banners = () => (state.banner === 'all' ? withWeeks : withWeeks.filter(b => b.banner === state.banner));

  function overview(d, c) {
    const s = d.summary;
    const stateTiles = h('div.stat-grid.gap-kpis', {},
      h('div.stat.ok', {}, h('span.stat-label', {}, 'Distribution'), h('strong.stat-value', {}, pct(s.distribution)), h(`span.stat-hint.${tone(s.change)}`, {}, s.change == null ? 'Share of store × product lines with no gap' : `${pp(s.change)} vs ${short(d.previousWeek)}`)),
      h('div.stat.warn', {}, h('span.stat-label', {}, 'Open gaps'), h('strong.stat-value', {}, formatNumber(s.opportunity + s.lost)), h('span.stat-hint', {}, `${formatNumber(s.opportunity)} opportunity · ${formatNumber(s.lost)} lost · ${(s.gapsPerStore || 0).toFixed(1)} per store`)),
      h('div.stat', {}, h('span.stat-label', {}, 'Fully ranged stores'), h('strong.stat-value', {}, formatNumber(s.fullyRanged)), h('span.stat-hint', {}, `${pct(s.fullyRangedShare)} of ${formatNumber(s.stores)} stores have no gap at all`)),
      h(`div.stat${s.persistent ? '.bad' : ''}`, {}, h('span.stat-label', {}, 'Persistent gaps'), h('strong.stat-value', {}, formatNumber(s.persistent)), h('span.stat-hint', {}, 'Lines open in every recent week reported')));
    const moveTiles = c ? h('div.stat-grid.gap-kpis', {},
      TRACKED.map(([k, label, t, rate, of]) => h(`div.stat.${t === 'bad' ? 'bad' : 'ok'}`, {}, h('span.stat-label', {}, label), h('strong.stat-value', {}, formatNumber(c.metrics[k])), h('span.stat-hint', {}, `${pct(c.rates[rate])} ${of}`))),
      h(`div.stat.${c.metrics.net > 0 ? 'ok' : c.metrics.net < 0 ? 'bad' : ''}`, {}, h('span.stat-label', {}, `Net gain, ${short(state.from)} → ${short(state.to)}`), h('strong.stat-value', {}, signed(c.metrics.net)), h('span.stat-hint', {}, `${formatNumber(c.compared)} lines in both weeks`))) : noCompare();
    const repeated = c && c.compared > 0 && c.changesTotal === 0 ? h('div.notice.warning', {role: 'note'}, icon('alert'), h('span', {}, `Nothing moved between ${short(state.from)} and ${short(state.to)}. The client may have re-sent the previous week's data.`)) : null;
    const insights = h('section.panel.insight-list', {}, h('div.panel-head', {}, h('h2', {}, 'At a glance')), h('ul', {},
      d.products.length ? h('li', {}, 'Best distributed product: ', h('strong', {}, d.products[0].key), ` (${pct(d.products[0].distribution)}); weakest: `, h('strong', {}, d.products.at(-1).key), ` (${pct(d.products.at(-1).distribution)}).`) : null,
      s.productsBelowHalf ? h('li', {}, h('strong', {}, formatNumber(s.productsBelowHalf)), ` product${s.productsBelowHalf === 1 ? ' is' : 's are'} in stock in fewer than half the stores that carry ${s.productsBelowHalf === 1 ? 'it' : 'them'}.`) : null,
      s.concentration.share != null ? h('li', {}, `The ${formatNumber(s.concentration.topStores)} stores with the most gaps hold `, h('strong', {}, pct(s.concentration.share)), ' of all open gaps.') : null,
      h('li', {}, h('strong', {}, formatNumber(s.storesWithLost)), ` store${s.storesWithLost === 1 ? '' : 's'} (${pct(s.stores ? s.storesWithLost / s.stores : null)}) have at least one lost line.`),
      d.regions.length > 1 ? h('li', {}, 'Strongest region: ', h('strong', {}, d.regions[0].key), ` (${pct(d.regions[0].distribution)}); weakest: `, h('strong', {}, d.regions.at(-1).key), ` (${pct(d.regions.at(-1).distribution)}).`) : null));
    return [repeated, stateTiles, moveTiles, h('div.gap-grid', {}, statusPanel(), insights), stepsPanel()];
  }

  function statusPanel() {
    const rows = banners().map(b => ({banner: b.banner, w: b.weeks.find(x => x.week === state.to)})).filter(x => x.w);
    const mixRow = ({banner, w}) => h('div.mix-row', {},
      h('div.mix-label', {}, h('strong', {}, banner), h('span.muted', {}, `${formatNumber(w.stores)} stores · ${pct(w.noGapShare)} no gap`)),
      h('div.mix', {}, STATUS.map(([k, , c]) => (w[k] ? h(`span.mix-part.${c}`, {dataset: {w: String(w[k] / w.total)}, title: `${formatNumber(w[k])}`}) : null))),
      h('div.mix-numbers', {}, STATUS.map(([k, label, c]) => h('span', {}, h(`i.swatch.${c}`), `${label} ${formatNumber(w[k])}`))));
    const trendWeek = w => h('div.trend-week', {title: `${dateLabel(w.week)}: ${pct(w.noGapShare)} no gap, ${formatNumber(w.stores)} stores`},
      h('div.trend-col', {}, h('span.trend-fill', {dataset: {h: String(w.noGapShare)}})), h('span.trend-pct', {}, pct(w.noGapShare)), h('span.trend-date', {}, short(w.week)));
    return h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Status on ${short(state.to)}`)),
      h('div.mix-list', {}, rows.map(mixRow)),
      h('div.trend', {}, h('h3', {}, 'Distribution by week'), banners().map(b => h('div.trend-row', {}, h('span.trend-name', {}, b.banner), h('div.trend-weeks', {}, b.weeks.map(trendWeek))))));
  }

  function stepsPanel() {
    const rows = banners().flatMap(b => b.steps.map(s => ({banner: b.banner, weeks: `${short(s.from)} → ${short(s.to)}`, key: s.to, converted: s.converted, recovered: s.recovered, lost: s.lost, net: s.net, conversion: s.rates?.conversion, change: s.rates?.distributionChange})));
    return h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Week on week'), h('span.muted', {}, 'Converted: Opp → No gap · Recovered: Lost → No gap · Lost: No gap → Lost')),
      sortable([{label: 'Banner', key: 'banner'}, {label: 'Weeks', key: 'key', render: r => r.weeks}, {label: 'Converted', key: 'converted', num: true, render: r => h('span.good', {}, formatNumber(r.converted))},
        {label: 'Recovered', key: 'recovered', num: true, render: r => h('span.good', {}, formatNumber(r.recovered))}, {label: 'Lost', key: 'lost', num: true, render: r => h('span.bad', {}, formatNumber(r.lost))},
        {label: 'Net', key: 'net', num: true, render: r => h(`span.${tone(r.net)}`, {}, signed(r.net))}, {label: '% opps converted', key: 'conversion', num: true, render: r => pct(r.conversion)},
        {label: 'Distribution change', key: 'change', num: true, render: r => h(`span.${tone(r.change)}`, {}, pp(r.change) || '–')}], rows, {initial: {key: 'key', dir: -1}}));
  }

  function products(d) {
    const table = sortable([{label: 'Product', key: 'key'}, {label: 'Stores carrying', key: 'carried', num: true, render: r => formatNumber(r.carried)},
      {label: 'Distribution', key: 'distribution', num: true, render: r => bar(r.distribution)}, {label: `vs ${d.previousWeek ? short(d.previousWeek) : 'previous'}`, key: 'change', num: true, render: r => h(`span.${tone(r.change)}`, {}, pp(r.change) || '–')},
      {label: 'Opportunity', key: 'O', num: true, render: r => formatNumber(r.O)}, {label: 'Lost', key: 'L', num: true, render: r => formatNumber(r.L)}], d.products, {initial: {key: 'distribution', dir: 1}});
    return [h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Products on ${short(state.to)}`), h('span.muted', {}, 'Distribution = stores with no gap ÷ stores carrying the product. Click a column to sort.')), table), heatmap(d)];
  }

  function heatmap(d) {
    const hm = d.heatmap;
    if (!hm.columns.length) return null;
    const cell = c => (c ? h('td.heat', {dataset: {a: String(c.distribution)}, title: `${pct(c.distribution)} of ${formatNumber(c.carried)} stores`, class: c.distribution >= 0.8 ? 'n' : c.distribution >= 0.5 ? 'o' : 'l'}, pct(c.distribution)) : h('td.heat.none', {}, '·'));
    return h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Distribution heatmap: product × ${hm.by}`), h('span.legend', {}, h('span', {}, h('i.swatch.n'), '80%+'), h('span', {}, h('i.swatch.o'), '50–79%'), h('span', {}, h('i.swatch.l'), 'under 50%'))),
      h('div.table-wrap.heat-wrap', {}, h('table.table.heat-table', {}, h('thead', {}, h('tr', {}, h('th', {scope: 'col'}, 'Product'), hm.columns.map(c => h('th', {scope: 'col'}, c)))),
        h('tbody', {}, hm.rows.map(r => h('tr', {}, h('th', {scope: 'row'}, r.product), r.cells.map(cell)))))));
  }

  function stores(d) {
    const filters = {all: () => true, gaps: s => s.O + s.L > 0, full: s => s.carried && s.N === s.carried, improved: s => s.change > 0, declined: s => s.change < 0};
    const labels = [['gaps', 'With gaps'], ['full', 'Fully ranged'], ['improved', 'Improved'], ['declined', 'Declined'], ['all', 'All stores']];
    const holder = h('div');
    const draw = () => {
      const q = state.q.toLowerCase();
      const rows = d.stores.filter(filters[state.storeFilter]).filter(s => !q || `${s.store} ${s.region} ${s.banner}`.toLowerCase().includes(q));
      holder.replaceChildren(...[h('p.table-summary', {}, `${formatNumber(rows.length)} store${rows.length === 1 ? '' : 's'}`), sortable([
        ...(state.banner === 'all' ? [{label: 'Banner', key: 'banner'}] : []), {label: 'Store', key: 'store'}, {label: 'Region', key: 'region'},
        {label: 'Distribution', key: 'distribution', num: true, render: r => bar(r.distribution)}, {label: 'Change', key: 'change', num: true, render: r => h(`span.${tone(r.change)}`, {}, pp(r.change) || 'new')},
        {label: 'Products', key: 'carried', num: true}, {label: 'Opportunity', key: 'O', num: true}, {label: 'Lost', key: 'L', num: true}], rows, {initial: {key: 'distribution', dir: 1}, limit: 300}),
        rows.length > 300 ? h('p.table-summary', {}, 'Showing the first 300; narrow with search or download Excel.') : null].filter(Boolean));
    };
    const chips = h('div.chip-row', {role: 'group', 'aria-label': 'Show'}, labels.map(([v, label]) => h('button.chip-toggle', {type: 'button', 'aria-pressed': String(state.storeFilter === v), onclick: e => { state.storeFilter = v; for (const b of e.target.parentElement.children) b.setAttribute('aria-pressed', String(b === e.target)); draw(); }}, label)));
    draw();
    return h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Store scorecard, ${short(state.to)}`), h('span.muted', {}, `${formatNumber(d.summary.fullyRanged)} fully ranged · ${formatNumber(d.summary.storesWithLost)} with a lost line`)),
      h('div.toolbar', {}, chips, h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', placeholder: 'Store, region or banner', value: state.q, oninput: e => { state.q = e.target.value; draw(); }}))), holder);
  }

  function regions(d) {
    const s = d.summary;
    return [h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Regions on ${short(state.to)}`), h('span.muted', {}, s.concentration.share != null ? `Top ${formatNumber(s.concentration.topStores)} stores hold ${pct(s.concentration.share)} of open gaps` : '')),
      h('div.region-bars', {}, d.regions.map(r => h('div.region-row', {}, h('div.region-name', {}, h('strong', {}, r.key), h('span.muted', {}, `${formatNumber(r.carried)} lines`)), bar(r.distribution),
        h(`span.region-change.${tone(r.change)}`, {}, pp(r.change) || ''), h('span.region-gaps', {}, `${formatNumber(r.O)} opp · ${formatNumber(r.L)} lost`))))),
    state.banner === 'all' ? null : heatmap(d)];
  }

  function persistent(d) {
    const holder = h('div');
    const byWeeks = new Map(); for (const p of d.persistent) byWeeks.set(p.weeks, (byWeeks.get(p.weeks) || 0) + 1);
    const draw = () => {
      const q = state.persistQ.toLowerCase();
      const rows = d.persistent.filter(p => !q || `${p.store} ${p.product} ${p.region} ${p.banner}`.toLowerCase().includes(q));
      holder.replaceChildren(sortable([...(state.banner === 'all' ? [{label: 'Banner', key: 'banner'}] : []), {label: 'Store', key: 'store'}, {label: 'Region', key: 'region'}, {label: 'Product', key: 'product'},
        {label: 'Now', key: 'status', render: r => statusBadge(r.status)}, {label: 'Weeks open', key: 'weeks', num: true, render: r => `${r.weeks}${r.always ? ' (every week)' : ''}`}, {label: 'Open since', key: 'since', render: r => short(r.since)}], rows, {initial: {key: 'weeks', dir: -1}, limit: 500}));
    };
    draw();
    return h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Persistent gaps up to ${short(state.to)}`), h('span.muted', {}, `${formatNumber(d.persistentTotal)} lines still open: ${[...byWeeks.keys()].sort((a, b) => a - b).map(w => `${w} weeks ${formatNumber(byWeeks.get(w))}`).join(' · ') || 'none'}`)),
      h('div.toolbar', {}, h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', placeholder: 'Store, product or region', value: state.persistQ, oninput: e => { state.persistQ = e.target.value; draw(); }}))), holder);
  }

  function changes(d, r) {
    if (!r) return noCompare();
    const regionsList = [...new Set(r.changes.map(c => c.region))].sort();
    const tbody = h('tbody'), summary = h('p.table-summary', {'aria-live': 'polite'}), pager = h('div.pager');
    const kinds = {tracked: ['converted', 'recovered', 'lost'], converted: ['converted'], recovered: ['recovered'], lost: ['lost'], other: OTHER.map(o => o[0])};
    const LABEL = Object.fromEntries([...TRACKED, ...OTHER].map(([k, l]) => [k, l]));
    function draw() {
      const q = state.q.toLowerCase();
      const rows = r.changes.filter(c => kinds[state.move].includes(c.move) && (!state.region || c.region === state.region) && (!q || `${c.store} ${c.product} ${c.banner || ''}`.toLowerCase().includes(q)));
      const pages = Math.max(1, Math.ceil(rows.length / 50)); state.page = Math.min(state.page, pages);
      summary.textContent = `${formatNumber(rows.length)} change${rows.length === 1 ? '' : 's'}${r.truncated ? ` (first ${formatNumber(r.changes.length)} of ${formatNumber(r.changesTotal)}; download Excel for all)` : ''}`;
      tbody.replaceChildren(...(rows.length ? rows.slice((state.page - 1) * 50, state.page * 50).map(c => h('tr', {},
        state.banner === 'all' ? h('td', {}, c.banner) : null, h('td', {}, c.store), h('td.muted', {}, c.region), h('td', {}, c.product),
        h('td', {}, statusBadge(c.from)), h('td', {}, statusBadge(c.to)), h(`td.${['converted', 'recovered', 'reopened'].includes(c.move) ? 'good' : 'bad'}`, {}, LABEL[c.move]))) : [h('tr', {}, h('td.empty', {colspan: '7'}, 'No changes match these filters.'))]));
      pager.replaceChildren(...(pages > 1 ? [h('button.button', {type: 'button', disabled: state.page === 1, onclick: () => { state.page--; draw(); }}, 'Previous'), h('span.muted', {}, `Page ${state.page} of ${pages}`), h('button.button', {type: 'button', disabled: state.page === pages, onclick: () => { state.page++; draw(); }}, 'Next')] : []));
    }
    const chip = (v, label) => h('button.chip-toggle', {type: 'button', 'aria-pressed': String(state.move === v), onclick: e => { state.move = v; state.page = 1; for (const b of e.target.parentElement.children) b.setAttribute('aria-pressed', String(b === e.target)); draw(); }}, label);
    draw();
    const cov = r.coverage, list = (title, items) => h('div', {}, h('h3', {}, title), h('ul', {}, items.map(s => h('li', {}, s))));
    return [h('section.panel', {},
      h('div.panel-head', {}, h('h2', {}, `Every change, ${short(state.from)} → ${short(state.to)}`)),
      h('div.toolbar', {},
        h('div.chip-row', {role: 'group', 'aria-label': 'Movement'}, chip('tracked', 'Tracked moves'), chip('converted', 'Opp → No gap'), chip('recovered', 'Lost → No gap'), chip('lost', 'No gap → Lost'), chip('other', 'Other moves')),
        h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', placeholder: 'Store or product', value: state.q, oninput: e => { state.q = e.target.value; state.page = 1; draw(); }})),
        h('label.field', {}, h('span', {}, 'Region'), h('select', {onchange: e => { state.region = e.target.value; state.page = 1; draw(); }}, h('option', {value: ''}, 'All regions'), regionsList.map(x => h('option', {value: x, selected: x === state.region}, x))))),
      summary, h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, [...(state.banner === 'all' ? ['Banner'] : []), 'Store', 'Region', 'Product', short(state.from), short(state.to), 'Movement'].map(t => h('th', {scope: 'col'}, t)))), tbody)), pager),
    cov.newStores.length || cov.missingStores.length ? h('details.panel.coverage', {}, h('summary', {}, `Store coverage: ${cov.newStores.length} new on ${short(state.to)}, ${cov.missingStores.length} not in the ${short(state.to)} file (not compared)`),
      h('div.coverage-lists', {}, list('New', cov.newStores), list('Not in the latest file', cov.missingStores))) : null];
  }

  root.replaceChildren(head,
    h('div.gap-controls', {}, tabs, h('div.week-pick', {}, h('label.field', {}, h('span', {}, 'Compare from'), fromSel), h('span.arrow', {}, icon('arrow')), h('label.field', {}, h('span', {}, 'Week'), toSel), exportLink)),
    viewTabs, body);
  main.replaceChildren(root);
  await load();
}

// Back office (admins): pick or add a client, upload its workbook, check the preview, then save.
export async function renderGapUpload(main, context) {
  const toBase64 = async file => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  let {clients} = await api('/gaps', {signal: context.signal});
  let client = new URLSearchParams(location.search).get('client') || clients.find(c => c.latestWeek)?.id || clients[0]?.id || '';
  const clientSel = h('select', {'aria-label': 'Client'});
  const newName = h('input', {type: 'text', placeholder: 'New client name, e.g. Acme Juice', maxlength: '120'});
  const result = h('div.upload-result'), historyPanel = h('section.panel');
  const input = h('input', {type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', id: 'gapFile', class: 'sr-only'});
  const zone = h('label.dropzone', {for: 'gapFile'}, icon('external'), h('strong', {}, 'Choose the client\'s gap report'), h('span', {}, 'or drop the .xlsx file here · up to 10 MB'));
  let pending = null;
  const label = () => clients.find(c => c.id === client)?.label || client;

  async function addClient() {
    try {
      const made = await api('/gaps/clients', {method: 'POST', body: {label: newName.value}});
      clients = [...clients, made].sort((a, b) => a.label.localeCompare(b.label)); client = made.id; addRow.hidden = true; newName.value = ''; fillClients(); history$();
      toast(`${made.label} added.`);
    } catch (error) { toast(error.message, 'error'); }
  }
  const addRow = h('div.add-client', {hidden: true}, h('label.field.grow', {}, h('span', {}, 'New client'), newName), h('button.button', {type: 'button', onclick: addClient}, 'Add client'));
  function fillClients() {
    clientSel.replaceChildren(...clients.map(c => h('option', {value: c.id, selected: c.id === client}, c.label)), h('option', {value: '__new'}, '+ Add a new client…'));
  }
  clientSel.addEventListener('change', () => { if (clientSel.value === '__new') { addRow.hidden = false; newName.focus(); } else { addRow.hidden = true; client = clientSel.value; pending = null; result.replaceChildren(); history$(); } });

  async function choose(file) {
    if (!file) return;
    if (!client) { toast('Choose or add the client first.', 'error'); return; }
    if (!/\.xlsx$/i.test(file.name)) { toast('Choose an Excel .xlsx file.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('The file is larger than 10 MB.', 'error'); return; }
    result.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), `Checking ${file.name}…`));
    try { pending = {fileName: file.name, data: await toBase64(file)}; showPreview(await api(`/gaps/${client}/preview`, {method: 'POST', body: pending})); }
    catch (error) { pending = null; result.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This file could not be used'), h('p', {}, error.message))); }
  }
  const weeksTable = summary => h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Banner', 'Week', 'Stores', 'No gap', 'Opportunity', 'Lost', ''].map(t => h('th', {scope: 'col'}, t)))),
    h('tbody', {}, summary.banners.flatMap(b => b.weeks.map(w => h('tr', {}, h('td', {}, b.banner), h('td', {}, dateLabel(w.week)), h('td.num', {}, formatNumber(w.stores)),
      h('td.num', {}, formatNumber(w.noGap)), h('td.num', {}, formatNumber(w.opportunity)), h('td.num', {}, formatNumber(w.lost)), h('td', {}, h(`span.badge.${w.action === 'new' ? 'ok' : 'info'}`, {}, w.action === 'new' ? 'New week' : 'Replaces'))))))));
  function swatches(colors) {
    if (!colors || !Object.values(colors).some(Boolean)) return null;
    const chips = [['N', 'No gap'], ['O', 'Opportunity'], ['L', 'Lost']].filter(([k]) => colors[k]).map(([k, l]) => { const s = h('span.swatch-chip', {}, l); s.style.setProperty('--c', colors[k]); return s; });
    return h('p.color-line', {}, 'Colours from the workbook: ', chips);
  }
  function showPreview(p) {
    const replacing = p.banners.flatMap(b => b.weeks).filter(w => w.action === 'replace').length;
    result.replaceChildren(h('section.panel', {},
      h('div.panel-head', {}, h('h2', {}, `Check before saving: ${p.fileName} → ${p.label}`), h('span.muted', {}, `${p.banners.length} banner${p.banners.length === 1 ? '' : 's'}: ${p.banners.map(b => `${b.banner} (${b.products} products)`).join(', ')}`)),
      p.warnings.length ? h('ul.warning-list', {}, p.warnings.map(w => h('li', {}, icon('alert'), w))) : h('p.ok-line', {}, icon('checkCircle'), 'No problems found.'),
      swatches(p.colors), weeksTable(p),
      h('div.form-actions', {},
        h('button.button.primary', {type: 'button', onclick: save}, icon('check'), replacing ? `Save (replaces ${replacing} week${replacing === 1 ? '' : 's'})` : `Save to ${p.label}`),
        h('button.button.ghost', {type: 'button', onclick: () => { pending = null; input.value = ''; result.replaceChildren(); }}, 'Choose another file'))));
  }
  async function save(event) {
    event.target.disabled = true;
    try {
      const saved = await api(`/gaps/${client}/upload`, {method: 'POST', body: pending});
      result.replaceChildren(h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `Saved to ${label()}`), h('span.muted', {}, `${formatNumber(saved.rows)} store × product lines`)),
        h('p.ok-line', {}, icon('checkCircle'), 'The dashboard now includes this report.'), weeksTable(saved),
        h('div.form-actions', {}, h('a.button.primary', {href: `/gap-tracker/${client}`, 'data-link': true}, icon('arrow'), 'Open the dashboard'))));
      toast('Gap report saved.'); history$();
    } catch (error) { event.target.disabled = false; toast(error.message, 'error'); }
  }
  async function history$() {
    if (!client) { historyPanel.replaceChildren(); return; }
    const {uploads} = await api(`/gaps/${client}/uploads`, {signal: context.signal});
    const when = v => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v));
    historyPanel.replaceChildren(h('div.panel-head', {}, h('h2', {}, `${label()} upload history`)), uploads.length ? h('div.table-wrap', {}, h('table.table', {},
      h('thead', {}, h('tr', {}, ['When', 'File', 'By', 'Weeks'].map(t => h('th', {scope: 'col'}, t)))),
      h('tbody', {}, uploads.map(u => h('tr', {}, h('td', {}, when(u.uploadedAt)), h('td', {}, u.fileName), h('td.muted', {}, u.uploadedBy),
        h('td', {}, u.summary.banners.map(b => `${b.banner}: ${b.weeks.map(w => short(w.week)).join(', ')}`).join(' · '))))))) : h('p.empty', {}, 'Nothing uploaded yet.'));
  }

  input.addEventListener('change', () => choose(input.files[0]));
  for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, e => { e.preventDefault(); zone.classList.add('over'); });
  for (const type of ['dragleave', 'drop']) zone.addEventListener(type, e => { e.preventDefault(); zone.classList.remove('over'); });
  zone.addEventListener('drop', e => choose(e.dataTransfer.files[0]));
  fillClients();
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Admin · Gap tracker'), h('h1', {}, 'Upload gap report'), h('p.lede.compact', {}, 'Upload the workbook a client sends each week. Nexus checks it and shows what will change before anything is saved; re-uploading the same weeks replaces them.'))),
    h('section.panel.upload-panel', {}, h('div.toolbar.flat', {}, h('label.field', {}, h('span', {}, 'Client'), clientSel), addRow), input, zone,
      h('ul.upload-help', {}, h('li', {}, 'Each sheet is a banner: Date, Store, (Region), then one column per product with No gap, Opportunity or Lost.'), h('li', {}, 'The client\'s cell colours for each status are kept and used on its dashboard.'))),
    result, historyPanel);
  await history$();
}
