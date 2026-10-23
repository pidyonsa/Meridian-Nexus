import {h, icon, formatNumber, toast} from '../ui.js';
import {api} from '../api.js';

// Distribution gap tracker (first client: Sir Fruit). Dashboard at /insights/<client>, upload at /insights/<client>/upload.
const CLIENT = 'sir-fruit';
const STATUS = [['noGap', 'No gap', 'green'], ['opportunity', 'Opportunity', 'blue'], ['lost', 'Lost', 'orange']];
const TRACKED = [['converted', 'Opportunity → No gap', 'green', 'Opportunities now in stock'], ['recovered', 'Lost → No gap', 'green', 'Lost lines won back'], ['lost', 'No gap → Lost', 'red', 'Lines that dropped out']];
const OTHER = [['newOpportunity', 'No gap → Opportunity'], ['slipped', 'Opportunity → Lost'], ['reopened', 'Lost → Opportunity']];
const dateLabel = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const short = iso => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(`${iso}T00:00:00Z`));
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const signed = n => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));

function head(title, lede, actions) {
  return h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Insights · Sir Fruit'), h('h1', {}, title), h('p.lede.compact', {}, lede)), actions ? h('div.head-actions', {}, actions) : null);
}

function mixBar(w) {
  return h('div.mix', {role: 'img', 'aria-label': STATUS.map(([k, label]) => `${label} ${pct(w[k], w.total)}`).join(', ')},
    STATUS.map(([k, , tone]) => w[k] ? h(`span.mix-part.${tone}`, {style: undefined, dataset: {w: String(w[k] / w.total)}}) : null));
}
// CSP forbids inline style attributes; widths are applied through the CSSOM after rendering.
function sizeBars(root) { for (const el of root.querySelectorAll('[data-w]')) el.style.width = `${(Number(el.dataset.w) * 100).toFixed(2)}%`; }

export async function renderGaps(main, context) {
  const data = await api(`/gaps/${CLIENT}`, {signal: context.signal});
  const withWeeks = data.banners.filter(b => b.weeks.length);
  if (!withWeeks.length) {
    main.replaceChildren(head('Distribution gaps', 'Weekly No gap, Opportunity and Lost per store and product.'),
      h('section.state-panel', {}, h('span.state-icon', {}, icon('chart')), h('h2', {}, 'No gap report yet'), h('p', {}, 'Upload the client\'s weekly gap workbook to start tracking.'),
        data.manage ? h('a.button.primary', {href: `/insights/${CLIENT}/upload`, 'data-link': true}, icon('arrow'), 'Upload report') : null));
    return;
  }
  const allWeeks = [...new Set(withWeeks.flatMap(b => b.weeks.map(w => w.week)))].sort();
  const state = {banner: 'all', from: allWeeks.at(-2) || allWeeks[0], to: allWeeks.at(-1), move: 'tracked', q: '', region: '', page: 1};
  const body = h('div.gap-body');
  const tabs = h('div.segmented', {role: 'tablist', 'aria-label': 'Banner'});
  const fromSel = h('select', {'aria-label': 'Compare from week'}), toSel = h('select', {'aria-label': 'Compare to week'});
  const exportLink = h('a.button', {href: '#', download: ''}, icon('external'), 'Download Excel');

  function weeksFor() { return state.banner === 'all' ? allWeeks : (data.banners.find(b => b.banner === state.banner)?.weeks || []).map(w => w.week); }
  function syncControls() {
    tabs.replaceChildren(...[['all', 'All banners'], ...data.banners.map(b => [b.banner, b.banner])].map(([v, label]) =>
      h('button', {type: 'button', role: 'tab', 'aria-selected': String(state.banner === v), class: state.banner === v ? 'on' : '', disabled: v !== 'all' && !data.banners.find(b => b.banner === v)?.weeks.length, onclick: () => { state.banner = v; const w = weeksFor(); if (!w.includes(state.from) || !w.includes(state.to)) { state.from = w.at(-2) || w[0]; state.to = w.at(-1); } state.page = 1; load(); }}, label)));
    const weeks = weeksFor();
    fromSel.replaceChildren(...weeks.slice(0, -1).map(w => h('option', {value: w, selected: w === state.from}, dateLabel(w))));
    toSel.replaceChildren(...weeks.filter(w => w > state.from).map(w => h('option', {value: w, selected: w === state.to}, dateLabel(w))));
    exportLink.href = `/api/gaps/${CLIENT}/export?${new URLSearchParams({banner: state.banner, from: state.from, to: state.to})}`;
  }
  fromSel.addEventListener('change', () => { state.from = fromSel.value; if (state.to <= state.from) state.to = weeksFor().find(w => w > state.from); state.page = 1; load(); });
  toSel.addEventListener('change', () => { state.to = toSel.value; state.page = 1; load(); });

  async function load() {
    syncControls();
    if (!state.from || !state.to) { body.replaceChildren(h('p.empty', {}, 'This banner has only one week so far; movements appear once a second week is uploaded.')); return; }
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Comparing weeks…'));
    let r;
    try { r = await api(`/gaps/${CLIENT}/compare?${new URLSearchParams({banner: state.banner, from: state.from, to: state.to})}`, {signal: context.signal}); }
    catch (error) { if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'Could not compare these weeks'), h('p', {}, error.message))); return; }
    render(r);
  }

  const tone = n => (n > 0 ? 'good' : n < 0 ? 'bad' : '');
  const table = (headers, rows) => h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, headers.map(t => h('th', {scope: 'col'}, t)))), h('tbody', {}, rows)));

  function statusPanel(banners) {
    const rows = banners.map(b => ({banner: b.banner, w: b.weeks.find(x => x.week === state.to)})).filter(x => x.w);
    const mixRow = ({banner, w}) => h('div.mix-row', {},
      h('div.mix-label', {}, h('strong', {}, banner), h('span.muted', {}, `${formatNumber(w.stores)} stores · ${pct(w.noGap, w.total)} no gap`)),
      mixBar(w),
      h('div.mix-numbers', {}, STATUS.map(([k, label]) => h('span', {}, `${label} ${formatNumber(w[k])}`))));
    const trendWeek = w => h('div.trend-week', {title: `${dateLabel(w.week)}: ${pct(w.noGap, w.total)} no gap, ${formatNumber(w.stores)} stores`},
      h('div.trend-col', {}, h('span.trend-fill', {dataset: {h: String(w.noGapShare)}})), h('span.trend-pct', {}, pct(w.noGap, w.total)), h('span.trend-date', {}, short(w.week)));
    const trendRow = b => h('div.trend-row', {}, h('span.trend-name', {}, b.banner), h('div.trend-weeks', {}, b.weeks.map(trendWeek)));
    return h('section.panel', {'aria-labelledby': 'mixHeading'},
      h('div.panel-head', {}, h('h2', {id: 'mixHeading'}, `Status on ${short(state.to)}`), h('span.legend', {}, STATUS.map(([, label, t]) => h('span', {}, h(`i.swatch.${t}`), label)))),
      h('div.mix-list', {}, rows.map(mixRow)),
      h('div.trend', {}, h('h3', {}, 'No-gap share by week'), banners.map(trendRow)));
  }

  function stepsPanel(banners) {
    const row = (b, s) => h('tr', {class: s.from === state.from && s.to === state.to ? 'current' : ''},
      h('td', {}, b.banner), h('td.nowrap', {}, `${short(s.from)} → ${short(s.to)}`),
      h('td.num.good', {}, formatNumber(s.converted)), h('td.num.good', {}, formatNumber(s.recovered)), h('td.num.bad', {}, formatNumber(s.lost)),
      h(`td.num.${tone(s.net)}`, {}, signed(s.net)));
    return h('section.panel', {'aria-labelledby': 'stepsHeading'},
      h('div.panel-head', {}, h('h2', {id: 'stepsHeading'}, 'Week on week'), h('span.muted', {}, 'Converted: Opp → No gap · Recovered: Lost → No gap · Lost: No gap → Lost')),
      table(['Banner', 'Weeks', 'Converted', 'Recovered', 'Lost', 'Net'], banners.flatMap(b => b.steps.map(s => row(b, s)))));
  }

  function moversPanel(r, key, title) {
    const row = p => h('tr', {}, h('td', {}, p.name), h('td.num', {}, formatNumber(p.converted)), h('td.num', {}, formatNumber(p.recovered)), h('td.num', {}, formatNumber(p.lost)), h(`td.num.${tone(p.net)}`, {}, signed(p.net)));
    const list = r[key].length ? table([title.slice(0, -1), 'Converted', 'Recovered', 'Lost', 'Net'], r[key].slice(0, 12).map(row)) : h('p.empty', {}, 'No movement.');
    if (r[key].length) list.classList.add('short');
    return h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, `${title} that moved most`), h('span.muted', {}, 'Net = converted + recovered − lost')), list);
  }

  function coveragePanel(r) {
    const {newStores, missingStores} = r.coverage;
    if (!newStores.length && !missingStores.length) return null;
    const list = (title, items) => h('div', {}, h('h3', {}, title), h('ul', {}, items.map(s => h('li', {}, s))));
    return h('details.panel.coverage', {},
      h('summary', {}, `Store coverage: ${newStores.length} new on ${short(state.to)}, ${missingStores.length} not in the ${short(state.to)} file (not compared)`),
      h('div.coverage-lists', {}, list('New', newStores), list('Not in the latest file', missingStores)));
  }

  function kpis(r) {
    const tile = ([k, label, t, hint]) => h(`div.stat.${t === 'red' ? 'bad' : 'ok'}`, {}, h('span.stat-label', {}, label), h('strong.stat-value', {}, formatNumber(r.metrics[k])), h('span.stat-hint', {}, hint));
    const net = h(`div.stat.${r.metrics.net > 0 ? 'ok' : r.metrics.net < 0 ? 'bad' : ''}`, {}, h('span.stat-label', {}, 'Net gain'), h('strong.stat-value', {}, signed(r.metrics.net)), h('span.stat-hint', {}, `${formatNumber(r.compared)} store × product lines in both weeks`));
    return h('div.stat-grid.gap-kpis', {}, TRACKED.map(tile), net);
  }

  function render(r) {
    const banners = state.banner === 'all' ? withWeeks : withWeeks.filter(b => b.banner === state.banner);
    const unchanged = r.compared > 0 && r.changesTotal === 0;
    body.replaceChildren(...[
      unchanged ? h('div.notice.warning', {role: 'note'}, icon('alert'), h('span', {}, `Nothing moved between ${short(state.from)} and ${short(state.to)}. The client may have re-sent the previous week's data.`)) : null,
      kpis(r),
      h('div.gap-stack', {}, statusPanel(banners), stepsPanel(banners)),
      h('div.gap-grid', {}, moversPanel(r, 'byProduct', 'Products'), moversPanel(r, 'byRegion', 'Regions')),
      changesPanel(r),
      coveragePanel(r)].filter(Boolean));
    sizeBars(body);
    for (const el of body.querySelectorAll('[data-h]')) el.style.height = `${(Number(el.dataset.h) * 100).toFixed(1)}%`;
  }

  function changesPanel(r) {
    const regions = [...new Set(r.changes.map(c => c.region))].sort();
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
        h('td', {}, h(`span.badge.${c.from === 'No gap' ? 'ok' : c.from === 'Lost' ? 'warn' : 'info'}`, {}, c.from)), h('td', {}, h(`span.badge.${c.to === 'No gap' ? 'ok' : c.to === 'Lost' ? 'warn' : 'info'}`, {}, c.to)),
        h(`td.${['converted', 'recovered', 'reopened'].includes(c.move) ? 'good' : 'bad'}`, {}, LABEL[c.move]))) : [h('tr', {}, h('td.empty', {colspan: '7'}, 'No changes match these filters.'))]));
      pager.replaceChildren(...(pages > 1 ? [h('button.button', {type: 'button', disabled: state.page === 1, onclick: () => { state.page--; draw(); }}, 'Previous'), h('span.muted', {}, `Page ${state.page} of ${pages}`), h('button.button', {type: 'button', disabled: state.page === pages, onclick: () => { state.page++; draw(); }}, 'Next')] : []));
    }
    const chip = (v, label) => h('button.chip-toggle', {type: 'button', 'aria-pressed': String(state.move === v), onclick: e => { state.move = v; state.page = 1; for (const b of e.target.parentElement.children) b.setAttribute('aria-pressed', String(b === e.target)); draw(); }}, label);
    const panel = h('section.panel', {'aria-labelledby': 'changesHeading'},
      h('div.panel-head', {}, h('h2', {id: 'changesHeading'}, `Every change, ${short(state.from)} → ${short(state.to)}`)),
      h('div.toolbar', {},
        h('div.chip-row', {role: 'group', 'aria-label': 'Movement'}, chip('tracked', 'Tracked moves'), chip('converted', 'Opp → No gap'), chip('recovered', 'Lost → No gap'), chip('lost', 'No gap → Lost'), chip('other', 'Other moves')),
        h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', placeholder: 'Store or product', value: state.q, oninput: e => { state.q = e.target.value; state.page = 1; draw(); }})),
        h('label.field', {}, h('span', {}, 'Region'), h('select', {onchange: e => { state.region = e.target.value; state.page = 1; draw(); }}, h('option', {value: ''}, 'All regions'), regions.map(x => h('option', {value: x, selected: x === state.region}, x))))
      ),
      summary,
      h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, [...(state.banner === 'all' ? ['Banner'] : []), 'Store', 'Region', 'Product', short(state.from), short(state.to), 'Movement'].map(t => h('th', {scope: 'col'}, t)))), tbody)),
      pager);
    draw();
    return panel;
  }

  main.replaceChildren(
    head('Distribution gaps', 'Weekly No gap, Opportunity and Lost per store and product, from the client\'s gap report.', [
      data.manage ? h('a.button', {href: `/insights/${CLIENT}/upload`, 'data-link': true}, icon('refresh'), 'Upload report') : null, exportLink]),
    h('div.gap-controls', {}, tabs, h('div.week-pick', {}, h('label.field', {}, h('span', {}, 'From'), fromSel), h('span.arrow', {}, icon('arrow')), h('label.field', {}, h('span', {}, 'To'), toSel))),
    body
  );
  await load();
}

// Back office: upload the client's workbook, check the preview, then save.
export async function renderGapUpload(main, context) {
  const toBase64 = async file => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  const result = h('div.upload-result');
  const input = h('input', {type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', id: 'gapFile', class: 'sr-only'});
  const zone = h('label.dropzone', {for: 'gapFile'}, icon('external'), h('strong', {}, 'Choose the client\'s gap report'), h('span', {}, 'or drop the .xlsx file here · up to 10 MB'));
  let pending = null;

  async function choose(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { toast('Choose an Excel .xlsx file.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('The file is larger than 10 MB.', 'error'); return; }
    result.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), `Checking ${file.name}…`));
    try {
      pending = {fileName: file.name, data: await toBase64(file)};
      showPreview(await api(`/gaps/${CLIENT}/preview`, {method: 'POST', body: pending}));
    } catch (error) { pending = null; result.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This file could not be used'), h('p', {}, error.message))); }
  }

  function weeksTable(summary) {
    return h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Banner', 'Week', 'Stores', 'No gap', 'Opportunity', 'Lost', ''].map(t => h('th', {scope: 'col'}, t)))),
      h('tbody', {}, summary.banners.flatMap(b => b.weeks.map(w => h('tr', {}, h('td', {}, b.banner), h('td', {}, dateLabel(w.week)), h('td.num', {}, formatNumber(w.stores)),
        h('td.num', {}, formatNumber(w.noGap)), h('td.num', {}, formatNumber(w.opportunity)), h('td.num', {}, formatNumber(w.lost)), h('td', {}, h(`span.badge.${w.action === 'new' ? 'ok' : 'info'}`, {}, w.action === 'new' ? 'New week' : 'Replaces'))))))));
  }

  function showPreview(p) {
    const replacing = p.banners.flatMap(b => b.weeks).filter(w => w.action === 'replace').length;
    result.replaceChildren(h('section.panel', {},
      h('div.panel-head', {}, h('h2', {}, `Check before saving: ${p.fileName}`), h('span.muted', {}, `${p.banners.length} banner${p.banners.length === 1 ? '' : 's'} · ${p.banners.map(b => `${b.products} products`).join(', ')}`)),
      p.warnings.length ? h('ul.warning-list', {}, p.warnings.map(w => h('li', {}, icon('alert'), w))) : h('p.ok-line', {}, icon('checkCircle'), 'No problems found.'),
      weeksTable(p),
      h('div.form-actions', {},
        h('button.button.primary', {type: 'button', onclick: save}, icon('check'), replacing ? `Save (replaces ${replacing} week${replacing === 1 ? '' : 's'})` : 'Save to Nexus'),
        h('button.button.ghost', {type: 'button', onclick: () => { pending = null; input.value = ''; result.replaceChildren(); }}, 'Choose another file'))));
  }

  async function save(event) {
    event.target.disabled = true;
    try {
      const saved = await api(`/gaps/${CLIENT}/upload`, {method: 'POST', body: pending});
      result.replaceChildren(h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Saved'), h('span.muted', {}, `${formatNumber(saved.rows)} store × product lines`)),
        h('p.ok-line', {}, icon('checkCircle'), 'The dashboard now includes this report.'), weeksTable(saved),
        h('div.form-actions', {}, h('a.button.primary', {href: `/insights/${CLIENT}`, 'data-link': true}, icon('arrow'), 'Open the dashboard'))));
      toast('Gap report saved.');
      history$();
    } catch (error) { event.target.disabled = false; toast(error.message, 'error'); }
  }

  const historyPanel = h('section.panel');
  async function history$() {
    const {uploads} = await api(`/gaps/${CLIENT}/uploads`, {signal: context.signal});
    const when = v => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v));
    historyPanel.replaceChildren(h('div.panel-head', {}, h('h2', {}, 'Upload history')), uploads.length ? h('div.table-wrap', {}, h('table.table', {},
      h('thead', {}, h('tr', {}, ['When', 'File', 'By', 'Weeks'].map(t => h('th', {scope: 'col'}, t)))),
      h('tbody', {}, uploads.map(u => h('tr', {}, h('td', {}, when(u.uploadedAt)), h('td', {}, u.fileName), h('td.muted', {}, u.uploadedBy),
        h('td', {}, u.summary.banners.map(b => `${b.banner}: ${b.weeks.map(w => short(w.week)).join(', ')}`).join(' · '))))))) : h('p.empty', {}, 'Nothing uploaded yet.'));
  }

  input.addEventListener('change', () => choose(input.files[0]));
  for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, e => { e.preventDefault(); zone.classList.add('over'); });
  for (const type of ['dragleave', 'drop']) zone.addEventListener(type, e => { e.preventDefault(); zone.classList.remove('over'); });
  zone.addEventListener('drop', e => choose(e.dataTransfer.files[0]));

  main.replaceChildren(
    head('Upload gap report', 'Upload the workbook the client sends each week. Nexus checks it and shows what will change before anything is saved; re-uploading the same weeks replaces them.',
      h('a.button', {href: `/insights/${CLIENT}`, 'data-link': true}, 'Back to dashboard')),
    h('section.panel.upload-panel', {}, input, zone, h('ul.upload-help', {}, h('li', {}, 'Sheets for PnP Family, Dis-Chem and Food Lover\'s Market are found by name.'), h('li', {}, 'Each sheet: Date, Store, (Region), then one column per product with No gap, Opportunity or Lost.'))),
    result, historyPanel);
  await history$();
}
