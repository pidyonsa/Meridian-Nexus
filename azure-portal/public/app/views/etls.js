import {h, icon, formatNumber, toast} from '../ui.js';
import {api} from '../api.js';
import {OLD_NEXUS} from '../nav.js';

// ETLs (/etls, Nexus admins): retailer sales and inventory pipelines. Pick the raw export from Resources, the worker
// (job-nexus-etl) transforms it against the shared masters, then an admin reviews exceptions and approves the output.
// Same pipelines, runs and approvals as the Firebase-era #etls.
const ROLE = {raw: 'Raw data', dcStock: 'DC stock', periodSales: 'Period sales', gln: 'GLN Master', products: 'Product List', stores: 'Store name clean-up', staffing: 'Store / call-cycle master', dc: 'DC mapping', status: 'PnP status codes',
  inventorySample: 'Inventory transformed sample', salesSample: 'Sales transformed sample', expected: 'Transformed sample', template: 'Historical template'};
const SETUP_ROLES = ['raw', 'expected', 'products', 'stores', 'staffing', 'dc', 'status', 'template'];
const SHARED = ['products', 'stores', 'staffing', 'dc', 'status', 'inventorySample', 'salesSample', 'gln'];
const STATE = {preparing: ['Preparing', 'blue'], running: ['Running', 'orange'], review: ['Review required', 'orange'], ready: ['Ready for approval', 'blue'], approved: ['Approved', 'green'], failed: ['Failed', 'red']};
const TABS = [['pipelines', 'Pipelines'], ['run', 'New run'], ['setup', 'Channel setup'], ['shared', 'Shared files'], ['history', 'History'], ['review', 'Review']];
const RULES = [['salesDays', 'Sales estimate', [[30, '30-day DROS estimate'], [28, '28-day DROS estimate']]], ['openPO', 'Missing open PO', [['unknown', 'Leave unknown'], ['zero-default', 'Default to zero']]],
  ['bannerColumn', 'Banner column', [['D', 'Column D'], ['G', 'Column G']]], ['reportDate', 'Report date', [['as-of', 'As-of date'], ['exported', 'Export date']]]];
const num = v => formatNumber(v || 0, Number.isInteger(v || 0) ? 0 : 2);
const when = v => (v ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v)) : '–');
const pill = s => { const [label, tone] = STATE[s] || [s, 'muted']; return h(`span.run-pill.${tone}`, {}, label); };
const previousMonth = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)).toISOString().slice(0, 7); };

export async function renderEtls(main, context) {
  const params = new URLSearchParams(location.search);
  const state = {tab: TABS.some(t => t[0] === params.get('tab')) ? params.get('tab') : 'pipelines', pipelineId: params.get('pipeline') || 'anchor-pnp-v1', runId: params.get('run') || '', data: null, detail: null,
    filters: {q: '', channel: '', status: ''}, form: {raw: [], dcStock: '', periodSales: '', reportMonth: previousMonth(), rules: null}};
  const tabs = h('nav.view-tabs', {'aria-label': 'ETL views'});
  const body = h('div.etl-body');
  const dialog = h('dialog.drill.narrow', {'aria-labelledby': 'etlAddTitle'});
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Data operations'), h('h1', {}, 'ETLs'), h('p.lede.compact', {}, 'Retailer sales and inventory: transform raw exports against the shared masters, review exceptions, approve and download.')),
      h('div.head-actions', {}, h('a.button.ghost', {href: `${OLD_NEXUS}#etls`}, icon('external'), 'Portal sales (DataOrbis)'), h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh'),
        h('button.button', {type: 'button', onclick: () => addPipeline()}, 'Add pipeline'), h('button.button.primary', {type: 'button', onclick: () => go('run')}, icon('play'), 'New run'))),
    tabs, body, dialog);

  let timer = null;
  context.signal.addEventListener('abort', () => clearTimeout(timer));
  const pipeline = () => state.data?.pipelines.find(p => p.id === state.pipelineId);
  const resource = id => state.data?.resources.find(r => r.id === id);
  const sharedIds = () => new Set(Object.values(state.data?.referenceSet?.resources || {}));
  const go = (tab, extra = {}) => { Object.assign(state, extra, {tab}); draw(); if (tab === 'review' && state.runId) openRun(state.runId); };
  const remember = () => history.replaceState(null, '', `/etls?${new URLSearchParams(Object.entries({tab: state.tab, pipeline: ['run', 'setup'].includes(state.tab) ? state.pipelineId : '', run: state.tab === 'review' ? state.runId : ''}).filter(([, v]) => v))}`);

  async function load() {
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading ETLs…'));
    try {
      state.data = await api('/etls', {signal: context.signal});
      if (!pipeline()) state.pipelineId = state.data.pipelines[0]?.id || '';
      draw();
      if (state.tab === 'review' && state.runId) openRun(state.runId);
    } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, error.status === 503 ? 'ETLs are not connected here yet' : 'ETLs could not load'), h('p', {}, error.message)));
    }
  }

  function draw() {
    if (!state.data) return;
    remember();
    tabs.replaceChildren(...TABS.map(([id, label]) => h('button', {type: 'button', class: state.tab === id ? 'on' : '', 'aria-current': state.tab === id ? 'page' : null, disabled: id === 'review' && !state.runId, onclick: () => go(id)}, label)));
    body.replaceChildren(...[{pipelines: pipelinesView, run: runView, setup: setupView, shared: sharedView, history: historyView, review: reviewView}[state.tab]()].flat().filter(Boolean));
  }

  async function act(button, request, done) {
    button.disabled = true;
    try { const r = await request(); if (done) toast(done(r), 'success'); return r; } catch (error) { if (error.name !== 'AbortError') toast(error.message, 'error'); button.disabled = false; return null; }
  }
  const put = (path, b) => api(path, {method: 'PUT', body: b, signal: context.signal});
  const post = (path, b = {}) => api(path, {method: 'POST', body: b, signal: context.signal});

  function pipelinesView() {
    const {pipelines, channels, runs} = state.data, f = state.filters;
    const q = f.q.toLowerCase();
    const shown = pipelines.filter(p => (!f.channel || p.channelId === f.channel) && (!f.status || p.status === f.status) && (!q || `${p.customer} ${p.channel} ${p.reportName} ${p.kind}`.toLowerCase().includes(q)));
    const lastRun = p => runs.find(r => (r.pipelineId || r.version) === p.id);
    const customers = new Set(pipelines.map(p => p.customer.toUpperCase())).size;
    const search = h('input', {type: 'search', value: f.q, placeholder: 'Customer, channel or report', oninput: e => { f.q = e.target.value; const pos = e.target.selectionStart; draw(); const s = body.querySelector('input[type=search]'); s.focus(); s.setSelectionRange(pos, pos); }});
    return [
      h('section.stat-grid', {}, [['Customers', customers], ['Retail channels', new Set(pipelines.map(p => p.channelId)).size], ['Available pipelines', pipelines.filter(p => p.runnable).length], ['Format validation', pipelines.filter(p => !p.runnable).length]]
        .map(([l, v]) => h('div.stat', {}, h('span.stat-label', {}, l), h('strong.stat-value', {}, formatNumber(v))))),
      h('section.panel', {},
        h('div.toolbar', {}, h('label.field.grow', {}, h('span', {}, 'Search'), search),
          h('label.field', {}, h('span', {}, 'Channel'), h('select', {onchange: e => { f.channel = e.target.value; draw(); }}, h('option', {value: ''}, 'All channels'), channels.map(c => h('option', {value: c.id, selected: c.id === f.channel}, c.name)))),
          h('label.field', {}, h('span', {}, 'Status'), h('select', {onchange: e => { f.status = e.target.value; draw(); }}, [['', 'All'], ['available', 'Available'], ['mapping-required', 'Format validation']].map(([v, l]) => h('option', {value: v, selected: v === f.status}, l))))),
        h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Customer', 'Channel', 'Data', 'Source report', 'Status', 'Last run', ''].map(l => h('th', {scope: 'col'}, l)))),
          h('tbody', {}, shown.map(p => { const last = lastRun(p); return h('tr', {},
            h('td', {}, h('strong', {}, p.customer)), h('td', {}, p.channel), h('td', {}, p.kind), h('td', {}, p.reportName),
            h('td', {}, h(`span.run-pill.${p.runnable ? 'green' : 'muted'}`, {}, p.runnable ? 'Available' : 'Format validation')),
            h('td', {}, last ? h('button.link', {type: 'button', onclick: () => go('review', {runId: last.id})}, pill(last.status), ' ', when(last.createdAt)) : h('span.muted', {}, '–')),
            h('td.actions', {}, p.runnable ? h('button.button.small', {type: 'button', onclick: () => go('run', {pipelineId: p.id})}, 'New run') : null, h('button.button.small.ghost', {type: 'button', onclick: () => go('setup', {pipelineId: p.id})}, 'Setup'))); }))))) ];
  }

  function pipelinePicker(onlyRunnable) {
    return h('label.field.grow', {}, h('span', {}, 'Pipeline'), h('select', {onchange: e => { state.pipelineId = e.target.value; state.form.raw = []; draw(); }},
      state.data.pipelines.filter(p => !onlyRunnable || p.runnable).map(p => h('option', {value: p.id, selected: p.id === state.pipelineId}, `${p.customer} / ${p.channel} / ${p.kind}`))));
  }

  const resourceOptions = (accept, exclude = new Set()) => state.data.resources.filter(r => accept.split(',').some(ext => r.sourceName.toLowerCase().endsWith(ext)) && !exclude.has(r.id));

  function sharedSummary(p) {
    const refs = state.data.referenceSet;
    const roles = p?.referenceRoles || [];
    const missing = roles.filter(role => !refs?.resources?.[role] || !resource(refs.resources[role]));
    return h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Inherited by every run'), h('h2', {}, 'Shared ETL files')), h('button.button.small.ghost', {type: 'button', onclick: () => go('shared')}, 'Change')),
      h('dl.facts', {}, roles.map(role => [h('dt', {}, ROLE[role] || role), h('dd', {class: refs?.resources?.[role] && resource(refs.resources[role]) ? '' : 'bad'}, resource(refs?.resources?.[role])?.sourceName || 'Not configured')])),
      missing.length ? h('div.notice.warning', {}, icon('alert'), h('span', {}, `Missing: ${missing.map(r => ROLE[r] || r).join(', ')}. Set them in Shared files before running.`)) : null);
  }

  function runView() {
    if (!pipeline()?.runnable) state.pipelineId = state.data.pipelines.find(p => p.runnable)?.id || state.pipelineId;
    const p = pipeline();
    if (!p?.runnable) return h('section.state-panel', {}, h('h2', {}, 'No runnable pipeline'), h('p', {}, 'Every pipeline still needs format validation.'));
    const form = state.form;
    const exclude = sharedIds();
    const fields = p.rawInputs.map(spec => {
      const options = resourceOptions(spec.accept, exclude);
      if (spec.multiple) {
        return h('fieldset.raw-multi', {}, h('legend', {}, `${spec.label} (1 to ${spec.maxFiles})`), options.length ? options.map(r => h('label.check-row', {}, h('input', {type: 'checkbox', checked: form.raw.includes(r.id), onchange: e => { form.raw = e.target.checked ? [...form.raw, r.id].slice(0, spec.maxFiles) : form.raw.filter(x => x !== r.id); }}), h('span', {}, r.title || r.sourceName), h('em', {}, r.sourceName))) : h('p.muted', {}, 'Upload the exports in Resources first.'));
      }
      const value = spec.role === 'raw' ? form.raw[0] || '' : form[spec.role];
      return h('label.field.grow', {}, h('span', {}, spec.label), h('select', {required: true, onchange: e => { if (spec.role === 'raw') form.raw = e.target.value ? [e.target.value] : []; else form[spec.role] = e.target.value; }},
        h('option', {value: ''}, `Select a ${spec.accept.replace(/\./g, '').toUpperCase()} resource`), options.map(r => h('option', {value: r.id, selected: r.id === value}, `${r.title || r.sourceName} · ${r.sourceName}`))));
    });
    const inventoryRules = p.kind === 'Inventory' && p.transformerVersion !== 'clicks-inventory-v1';
    form.rules ||= {...p.defaultRules};
    const confirmBox = h('input', {type: 'checkbox', checked: form.rules.confirmed === true, onchange: e => { form.rules.confirmed = e.target.checked; }});
    const month = h('input', {type: 'month', value: form.reportMonth, min: '2000-01', max: '2099-12', onchange: e => { form.reportMonth = e.target.value; }});
    const start = h('button.button.primary.run-button', {type: 'submit'}, icon('play'), 'Start ETL run');
    return h('div.run-grid', {},
      h('form.panel', {onsubmit: e => {
        e.preventDefault();
        if (!form.raw.length) { toast('Choose the raw export.', 'error'); return; }
        const resources = p.rawInputs[0].multiple ? {raw: form.raw} : {raw: form.raw[0], ...(p.transformerVersion === 'clicks-inventory-v1' ? {dcStock: form.dcStock, periodSales: form.periodSales} : {})};
        act(start, () => post('/etls/runs', {pipelineId: p.id, resources, referenceRevision: state.data.referenceSet?.revision || 0, ...(inventoryRules ? {rules: form.rules} : {}), ...(p.reportingMonth ? {reportMonth: form.reportMonth} : {})}),
          r => (r.reused ? 'This exact run already exists; opening it.' : 'ETL run started.')).then(r => { if (r) { load().then(() => go('review', {runId: r.id})); } });
      }},
        h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, p.kind), h('h2', {}, `${p.customer} / ${p.channel}`)), h('span.muted', {}, p.reportName)),
        h('div.toolbar.stack', {}, pipelinePicker(true), p.reportingMonth ? h('label.field', {}, h('span', {}, 'Reporting month'), month) : null, fields,
          inventoryRules ? h('fieldset.rules', {}, h('legend', {}, 'Inventory rules'), h('div.date-pair', {}, RULES.map(([key, label, opts]) => h('label.field', {}, h('span', {}, label), h('select', {onchange: e => { form.rules[key] = typeof opts[0][0] === 'number' ? Number(e.target.value) : e.target.value; }}, opts.map(([v, l]) => h('option', {value: String(v), selected: form.rules[key] === v}, l)))))),
            h('p.muted.small-note', {}, 'Product family alias: PICK N PAY CORPORATE.'), h('label.switch', {}, confirmBox, h('span', {}, 'I confirm these rules for this export'))) : null,
          h('p.muted.small-note', {}, 'Upload raw exports in Resources. Inputs are snapshotted when the run starts, so later Resources changes do not affect it.'), start)),
      sharedSummary(p));
  }

  function setupView() {
    const p = pipeline();
    if (!p) return h('p.empty', {}, 'Choose a pipeline.');
    const reportName = h('input', {type: 'text', value: p.reportName || '', maxlength: '120'});
    const notes = h('textarea', {rows: '4', maxlength: '2000'}, p.notes || '');
    const picks = {};
    const save = h('button.button.primary', {type: 'submit', disabled: p.id === 'anchor-pnp-v1'}, 'Save setup');
    return [
      h('form.panel', {onsubmit: e => { e.preventDefault(); act(save, () => put('/etls/pipelines', {id: p.id, customer: p.customer, channelId: p.channelId, kind: p.kind, reportName: reportName.value, notes: notes.value, revision: p.revision || 0,
        resources: Object.fromEntries(Object.entries(picks).map(([role, el]) => [role, el.value]).filter(([, v]) => v))}), () => 'Channel setup saved.').then(r => { if (r) load(); }); }},
        h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, `${p.kind} · ${p.runnable ? 'Available' : 'Format validation'}`), h('h2', {}, `${p.customer} / ${p.channel}`)), h('span.muted', {}, p.revision ? `Saved setup v${p.revision}` : 'New channel setup')),
        h('div.toolbar.stack', {}, pipelinePicker(false),
          p.id === 'anchor-pnp-v1' ? h('div.notice', {}, icon('alert'), h('span', {}, 'The validated Anchor / Pick n Pay pipeline uses the Shared files.')) : null,
          h('label.field', {}, h('span', {}, 'Source report name'), reportName), h('label.field', {}, h('span', {}, 'Notes for validation'), notes),
          h('div.date-pair', {}, SETUP_ROLES.map(role => { const el = h('select', {}, h('option', {value: ''}, 'Not provided'), resourceOptions(role === 'raw' ? '.xlsx,.txt,.csv' : '.xlsx').map(r => h('option', {value: r.id, selected: p.resources?.[role] === r.id}, `${r.title || r.sourceName}`))); picks[role] = el; return h('label.field', {}, h('span', {}, role === 'raw' ? 'Raw source sample' : ROLE[role]), el); })),
          p.runnable ? null : h('p.muted.small-note', {}, 'A new channel runs once its raw format has been validated and a transformer is released. Samples saved here are what that validation uses.'), save)),
      sharedSummary(p)];
  }

  function sharedView() {
    const refs = state.data.referenceSet || {resources: {}, revision: 0};
    const picks = {};
    const save = h('button.button.primary', {type: 'submit'}, 'Save shared files');
    return h('form.panel', {onsubmit: e => { e.preventDefault(); act(save, () => put('/etls/references', {revision: refs.revision || 0, resources: Object.fromEntries(Object.entries(picks).map(([role, el]) => [role, el.value]).filter(([, v]) => v))}), () => 'Shared files saved. New runs use them.').then(r => { if (r) load(); }); }},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Masters every run inherits'), h('h2', {}, 'Shared ETL files')), h('span.muted', {}, refs.revision ? `Revision ${refs.revision} · ${when(refs.updatedAt)} · ${refs.updatedBy?.email || ''}` : 'Not set yet')),
      h('div.toolbar.stack', {},
        h('p.muted.small-note', {}, 'Each role needs its own XLSX from Resources. Changing a file here affects new runs only; finished runs keep the files they used.'),
        h('div.date-pair', {}, SHARED.map(role => { const el = h('select', {}, h('option', {value: ''}, role === 'gln' ? 'Optional' : 'Choose a workbook'), resourceOptions('.xlsx').map(r => h('option', {value: r.id, selected: refs.resources?.[role] === r.id}, `${r.title || r.sourceName} · ${r.sourceName}`))); picks[role] = el; return h('label.field', {}, h('span', {}, ROLE[role]), el); })),
        save));
  }

  function runsTable(runs) {
    return h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Customer / channel', 'Source', 'Started', 'Status', 'Input rows', 'Ready', 'Exceptions'].map((l, i) => h('th', {scope: 'col', class: i > 3 ? 'num' : ''}, l)))),
      h('tbody', {}, runs.length ? runs.map(r => h('tr', {}, h('td', {}, h('button.link', {type: 'button', onclick: () => go('review', {runId: r.id})}, r.client || 'ANCHOR'), h('div.muted.small-note', {}, r.channel || 'Pick n Pay')),
        h('td.problem', {title: r.sourceName}, r.sourceName), h('td.nowrap', {}, when(r.createdAt), h('div.muted.small-note', {}, r.createdBy?.email || '')), h('td', {}, pill(r.status)),
        h('td.num', {}, num(r.totals?.inputRows)), h('td.num', {}, num(r.totals?.readyRows)), h('td.num', {class: r.totals?.exceptionRows ? 'bad' : ''}, num(r.totals?.exceptionRows))))
        : h('tr', {}, h('td.empty', {colspan: '7'}, 'No ETL runs yet.')))));
  }
  const historyView = () => h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Latest 50'), h('h2', {}, 'ETL runs'))), runsTable(state.data.runs));

  async function openRun(id, quiet = false) {
    clearTimeout(timer);
    if (!quiet) { state.detail = null; if (state.tab === 'review') body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading run…')); }
    try {
      state.detail = await api(`/etls/runs/${id}`, {signal: context.signal});
      if (state.tab === 'review' && state.runId === id) draw();
      if (['preparing', 'running'].includes(state.detail.run.status)) timer = setTimeout(() => openRun(id, true), 6000);
    } catch (error) {
      if (error.name !== 'AbortError' && state.tab === 'review') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This run could not load'), h('p', {}, error.message)));
    }
  }

  function reviewView() {
    const d = state.detail;
    if (!d) return h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading run…');
    const {run, result, progress} = d;
    const pending = ['preparing', 'running'].includes(run.status);
    const t = result?.totals || {};
    const sales = result?.kind === 'Sales';
    const metrics = result ? [['Input rows', t.inputRows], ['Ready rows', t.readyRows], ['Exceptions', t.exceptionRows], ...(sales ? [] : [['DC rows', t.dcRows], ['DC exceptions', t.invalidDcRows]]), ['Warning rows', t.warningRows], ['Excluded rows', t.excludedRows]] : [];
    const approvable = result && run.status === 'ready' && result.status === 'ready' && result.reconciled && !t.exceptionRows && !t.invalidDcRows && t.readyRows;
    const confirmBox = h('input', {type: 'checkbox'});
    const approve = h('button.button.primary', {type: 'button', onclick: e => { if (!confirmBox.checked) { toast('Tick the confirmation first.', 'error'); return; } act(e.currentTarget, () => post(`/etls/runs/${run.id}/approve`, {confirm: true}), () => 'Output approved.').then(r => { if (r) { state.detail = r; draw(); } }); }}, icon('check'), 'Approve output');
    const retry = h('button.button', {type: 'button', onclick: e => act(e.currentTarget, () => post(`/etls/runs/${run.id}/retry`), () => 'Retry started.').then(r => { if (r) load().then(() => go('review', {runId: r.id})); })}, icon('refresh'), 'Retry run');
    const downloads = result ? [['workbook', result.status === 'review' ? 'Draft + exceptions (Excel)' : 'Validated workbook (Excel)'], ['facts', sales ? 'Sales JSONL' : 'Inventory JSONL'], ['exceptions', 'Exceptions JSONL'], ...(sales ? [] : [['dc', 'DC JSONL']]), ['assignments', 'Assignments JSONL']] : [];
    const reconcile = !result ? null : sales
      ? `Units ${num(t.sourceUnits)} = ready ${num(t.validUnits)} + exceptions ${num(t.exceptionUnits)} + excluded ${num(t.excludedUnits)}`
      : `Source store SOH ${num(t.sourceStoreSOH)} = ready ${num(t.validStoreSOH)} + exceptions ${num(t.exceptionStoreSOH)} + excluded ${num(t.excludedStoreSOH)}`;
    return [
      h('section.panel', {},
        h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, `${run.client || 'ANCHOR'} / ${run.channel || 'Pick n Pay'}${run.kind ? ` · ${run.kind}` : ''}`), h('h2', {}, run.sourceName), h('p.muted.small-note', {}, `${run.id} · ${when(run.createdAt)} · ${run.createdBy?.email || ''}`)), pill(run.status)),
        pending ? h('div.etl-progress', {}, h('div', {}, h('span', {}, progress?.stage || 'Preparing background worker'), h('span', {}, `${Math.max(2, Math.min(100, progress?.percent || 2))}%`)), h('progress', {max: '100', value: String(Math.max(2, Math.min(100, progress?.percent || 2))), 'aria-label': 'ETL progress'})) : null,
        run.error ? h('div.notice.warning', {}, icon('alert'), h('span', {}, run.error), run.status === 'failed' ? retry : null) : null,
        result ? h('div.stat-grid.etl-metrics', {}, metrics.map(([l, v]) => h(`div.stat${l.includes('xception') && v ? '.bad' : ''}`, {}, h('span.stat-label', {}, l), h('strong.stat-value', {}, num(v))))) : null,
        result ? h(`div.notice${result.reconciled ? '' : '.warning'}`, {}, icon(result.reconciled ? 'checkCircle' : 'alert'), h('span', {}, h('strong', {}, result.reconciled ? (sales ? 'Row, unit and value reconciliation passed. ' : 'Row and stock reconciliation passed. ') : 'Reconciliation failed. '), reconcile)) : null,
        result ? h('p.muted.small-note.pad', {}, sales ? `${result.periodStart || ''} to ${result.periodEnd || ''} · calendar-month sales, measured units and value` : `Inventory as of ${result.asOf || '–'} · week ending ${result.reportDate || '–'}`) : null,
        downloads.length ? h('div.detail-actions.pad', {}, downloads.map(([file, label]) => h('a.button.small', {href: `/api/etls/runs/${run.id}/outputs/${file}`, download: ''}, icon('external'), label))) : null,
        run.status === 'approved' ? h('div.notice', {}, icon('checkCircle'), h('span', {}, `Approved ${when(run.approval?.at)} by ${run.approval?.by?.email || ''}.`)) : null,
        approvable ? h('div.approve-row', {}, h('label.switch', {}, confirmBox, h('span', {}, 'I reviewed this output and approve it for use')), approve) : null),
      result ? h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Blocking exceptions'), h('span.muted', {}, Object.keys(result.issueCounts || {}).length ? 'Showing up to 100 rows; the workbook has them all.' : '')),
        Object.keys(result.issueCounts || {}).length ? [h('div.issue-row', {}, Object.entries(result.issueCounts).map(([code, count]) => h('span.tag', {}, `${code.replaceAll('_', ' ')} · ${num(count)}`))),
          h('div.table-wrap.short', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Row', 'Site', 'Article', 'Source store', 'Details'].map(l => h('th', {scope: 'col'}, l)))),
            h('tbody', {}, (result.exceptionPreview || []).map(row => h('tr', {}, h('td.num', {}, num(row.line)), h('td', {}, row.siteCode), h('td', {}, row.article), h('td', {}, row.rawName), h('td', {}, (row.errors || []).map(e => h('div', {}, h('strong', {}, e.code), `: ${e.detail}`))))))))]
          : h('p.empty', {}, 'No blocking exceptions.')) : null];
  }

  function addPipeline() {
    const customers = [...new Map(state.data.pipelines.map(p => [p.customer.toUpperCase(), p.customer])).values()].sort((a, b) => a.localeCompare(b));
    const customer = h('input', {type: 'text', list: 'etlCustomers', maxlength: '100', required: true, placeholder: 'Existing or new customer'});
    const channel = h('select', {required: true}, state.data.channels.map(c => h('option', {value: c.id}, c.name)));
    const kind = h('select', {}, h('option', {value: 'Inventory'}, 'Inventory'), h('option', {value: 'Sales'}, 'Sales'));
    const reportName = h('input', {type: 'text', maxlength: '120', required: true, value: 'Inventory export'});
    kind.addEventListener('change', () => { if (/export$/.test(reportName.value)) reportName.value = `${kind.value} export`; });
    const notes = h('textarea', {rows: '3', maxlength: '2000'});
    const save = h('button.button.primary', {type: 'submit'}, 'Add pipeline');
    dialog.replaceChildren(h('form', {onsubmit: e => { e.preventDefault(); act(save, () => put('/etls/pipelines', {customer: customer.value, channelId: channel.value, kind: kind.value, reportName: reportName.value, notes: notes.value, revision: 0, resources: {}}), () => 'Pipeline added.')
      .then(r => { if (r) { dialog.close(); state.pipelineId = r.pipeline.id; load().then(() => go('setup')); } }); }},
      h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, 'File-based ETL'), h('h2', {id: 'etlAddTitle'}, 'Add pipeline')), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
      h('datalist', {id: 'etlCustomers'}, customers.map(c => h('option', {value: c}))),
      h('div.form-grid', {}, h('label.field', {}, h('span', {}, 'Customer'), customer), h('label.field', {}, h('span', {}, 'Retail channel'), channel), h('label.field', {}, h('span', {}, 'Data'), kind), h('label.field', {}, h('span', {}, 'Source report name'), reportName), h('label.field.wide', {}, h('span', {}, 'Notes'), notes)),
      h('div.form-actions', {}, h('span.spacer'), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Cancel'), save)));
    dialog.showModal();
    customer.focus();
  }

  await load();
}
