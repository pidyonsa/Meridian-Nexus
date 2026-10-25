import {h, icon, formatNumber, toast} from '../ui.js';
import {api} from '../api.js';
import {OLD_NEXUS} from '../nav.js';

// Report automation (/automation, Nexus admins): run approved reports, schedule them, answer portal verification,
// follow and control jobs, and download delivered reports. Same documents and workers as the Firebase-era
// #automation and Admin › Jobs; refreshes itself while jobs are running or waiting.
const TABS = [['run', '01', 'Run job'], ['schedule', '02', 'Schedule'], ['jobs', '03', 'Jobs'], ['alerts', '04', 'Alerts'], ['reports', '05', 'Reports'], ['audit', '06', 'Audit']];
const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const STATUS = {
  queued: ['Queued', 'blue'], 'azure-reserved': ['Queued for Azure', 'blue'], 'azure-dispatching': ['Starting', 'blue'], running: ['Running', 'orange'],
  waiting_otp: ['Needs a code', 'orange'], waiting_for_otp: ['Needs a code', 'orange'], waiting_approval: ['Needs approval', 'orange'], cancelling: ['Stopping', 'orange'],
  completed: ['Completed', 'green'], completed_no_data: ['No data', 'muted'], failed: ['Failed', 'red'], rebuild_failed: ['Failed', 'red'], cancelled: ['Cancelled', 'muted'], skipped_duplicate: ['Duplicate skipped', 'muted']
};
const FILTERS = [['all', 'All'], ['live', 'Live'], ['attention', 'Needs attention'], ['failed', 'Failed'], ['completed', 'Completed']];
const REFRESH_MS = 20000;
const when = v => (v ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v)) : '–');
const ago = v => {
  if (!v) return '–';
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : when(v);
};
const statusPill = status => { const [label, tone] = STATUS[status] || [status || 'Unknown', 'muted']; return h(`span.run-pill.${tone}`, {}, label); };
const who = run => run.createdByName || run.createdByEmail || run.scheduledByName || (run.trigger === 'scheduled' || run.scheduledBy ? 'Schedule' : '–');

export async function renderAutomation(main, context) {
  const params = new URLSearchParams(location.search);
  const state = {tab: TABS.some(t => t[0] === params.get('tab')) ? params.get('tab') : 'run', profile: params.get('profile') || '', filter: 'all', q: '', data: null};
  const head = h('header.page-head', {},
    h('div', {}, h('p.eyebrow', {}, 'Extraction operations'), h('h1', {}, 'Automation activity'), h('p.lede.compact', {}, 'Run approved reports, set schedules, follow portal verification and review delivery results. The same jobs and workers as the existing Nexus.')),
    h('div.head-actions', {}, h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh')));
  const stats = h('section.stat-grid.automation-stats', {'aria-label': 'Automation summary'});
  const prompts = h('div.prompt-area');
  const tabs = h('nav.view-tabs.numbered', {'aria-label': 'Report automation'});
  const body = h('div.automation-body');
  const dialog = h('dialog.drill', {'aria-label': 'Job detail'});
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  main.replaceChildren(head, stats, prompts, tabs, body, dialog);

  function remember() {
    const q = new URLSearchParams(Object.entries({tab: state.tab === 'run' ? '' : state.tab, profile: state.profile}).filter(([, v]) => v)).toString();
    history.replaceState(null, '', `/automation${q ? `?${q}` : ''}`);
  }

  let timer = null;
  context.signal.addEventListener('abort', () => clearTimeout(timer));
  async function load({quiet = false} = {}) {
    clearTimeout(timer);
    if (!quiet) body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try {
      state.data = await api('/automation', {signal: context.signal});
      if (!state.data.profiles.some(p => p.id === state.profile)) state.profile = (state.data.profiles.find(p => p.startable) || state.data.profiles[0])?.id || '';
      draw();
      // Follow running jobs and verification prompts without a manual refresh (only while this page is open and visible).
      if (state.data.runs.some(r => r.active || ['azure-reserved', 'azure-dispatching'].includes(r.status)) || state.data.prompts.length) timer = setTimeout(() => { if (!document.hidden) load({quiet: true}); else timer = setTimeout(() => load({quiet: true}), REFRESH_MS); }, REFRESH_MS);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (quiet) { timer = setTimeout(() => load({quiet: true}), REFRESH_MS * 3); return; }
      body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, error.status === 503 ? 'Report automation is not connected here yet' : 'Report automation could not load'), h('p', {}, error.message),
        error.status === 503 ? h('a.button', {href: `${OLD_NEXUS}#automation`}, icon('external'), 'Open it in the existing Nexus') : h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Try again')));
    }
  }

  function draw() {
    const d = state.data;
    remember();
    const live = d.runs.filter(r => r.active || ['azure-reserved', 'azure-dispatching'].includes(r.status));
    const scheduled = d.profiles.filter(p => p.reportSchedule.enabled);
    const week = Date.now() - 7 * 86400000;
    const openAlerts = d.alerts.filter(a => a.status === 'open' && new Date(a.lastDetectedAt || a.createdAt).getTime() >= week);
    const today = new Date().toISOString().slice(0, 10);
    const doneToday = d.runs.filter(r => r.status === 'completed' && (r.completedAt || '').slice(0, 10) === today).length;
    stats.replaceChildren(
      h(`div.stat${live.length ? '.warn' : ''}`, {}, h('span.stat-label', {}, 'Active runs'), h('strong.stat-value', {}, formatNumber(live.length)), h('span.stat-hint', {}, live.length ? `${live.filter(r => r.stalled).length} without recent portal activity` : 'No report is running')),
      h('div.stat', {}, h('span.stat-label', {}, 'Scheduled reports'), h('strong.stat-value', {}, formatNumber(scheduled.length)), h('span.stat-hint', {}, scheduled.length ? scheduled.map(p => `${p.name} ${p.reportSchedule.time}`).slice(0, 2).join(' · ') : 'Manual only')),
      h(`div.stat${d.prompts.length ? '.warn' : ''}`, {}, h('span.stat-label', {}, 'Waiting verification'), h('strong.stat-value', {}, formatNumber(d.prompts.length)), h('span.stat-hint', {}, d.prompts.length ? 'A portal is waiting for a code or approval' : 'Nothing to confirm')),
      h(`div.stat${openAlerts.length ? '.bad' : '.ok'}`, {}, h('span.stat-label', {}, 'Open alerts, 7 days'), h('strong.stat-value', {}, formatNumber(openAlerts.length)), h('span.stat-hint', {}, `${formatNumber(doneToday)} report${doneToday === 1 ? '' : 's'} completed today`)));
    prompts.replaceChildren(...(d.prompts.length ? [promptPanel(d.prompts)] : []));
    tabs.replaceChildren(...TABS.map(([id, n, label]) => h('button', {type: 'button', class: state.tab === id ? 'on' : '', 'aria-current': state.tab === id ? 'page' : null, onclick: () => { state.tab = id; draw(); }},
      h('span.tab-num', {}, n), label, id === 'alerts' && openAlerts.length ? h('span.tab-count', {}, String(openAlerts.length)) : id === 'jobs' && live.length ? h('span.tab-count', {}, String(live.length)) : null)));
    body.replaceChildren(...[{run: runPanel, schedule: schedulePanel, jobs: jobsPanel, alerts: alertsPanel, reports: reportsPanel, audit: auditPanel}[state.tab]()].flat());
  }

  // Actions: one at a time, with the button disabled while it runs; the workspace reloads afterwards.
  async function act(button, request, done) {
    button.disabled = true;
    try {
      const result = await request();
      if (done) toast(done(result), 'success');
      await load({quiet: true});
      return result;
    } catch (error) {
      if (error.name !== 'AbortError') toast(error.message, 'error');
      button.disabled = false;
      return null;
    }
  }
  const post = (path, body = {}) => api(path, {method: 'POST', body, signal: context.signal});

  function promptPanel(list) {
    return h('section.panel.prompt-panel', {role: 'alert'},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Action required'), h('h2', {}, 'Portal verification')), h('span.muted', {}, 'The portal is waiting; answer within a few minutes or the job fails.')),
      h('ul.prompt-list', {}, list.map(p => {
        const input = h('input', {type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '80', placeholder: 'Verification code', 'aria-label': `Verification code for ${p.retailerName}`});
        const submit = h('button.button.primary', {type: 'submit'}, 'Submit code');
        const approve = h('button.button.primary', {type: 'button', onclick: e => act(e.currentTarget, () => post(`/automation/prompts/${p.id}`, {action: 'approve'}), () => 'Approval confirmed.')}, icon('check'), 'I approved it in Authenticator');
        const cancel = h('button.button.ghost', {type: 'button', onclick: e => { if (confirm('Cancel this verification? The job will stop.')) act(e.currentTarget, () => post(`/automation/prompts/${p.id}`, {action: 'cancel'}), () => 'Verification cancelled.'); }}, 'Cancel');
        const form = h('form.prompt-form', {onsubmit: e => { e.preventDefault(); if (input.value.trim()) act(submit, () => post(`/automation/prompts/${p.id}`, {action: 'submit', value: input.value.trim()}), () => 'Code sent to the portal.'); }},
          p.inputRequired ? [input, submit] : approve, cancel);
        return h('li', {}, h('div', {}, h('strong', {}, p.retailerName || 'Extraction'), h('p', {}, p.message || (p.inputRequired ? 'Enter the code the portal sent.' : 'Approve the sign-in in Microsoft Authenticator, then confirm here.')), h('span.muted', {}, `Asked ${ago(p.createdAt)}`)),
          p.mine ? form : h('p.muted', {}, `Only ${p.ownerEmail || 'the person who started this job'} can answer this prompt.`));
      })));
  }

  function profilePicker(onchange) {
    return h('label.field.grow', {}, h('span', {}, 'Extraction profile'), h('select', {onchange: e => { state.profile = e.target.value; onchange(); }},
      state.data.profiles.map(p => h('option', {value: p.id, selected: p.id === state.profile}, `${p.name}${p.startable ? '' : ' (existing Nexus)'}`))));
  }
  const current = () => state.data.profiles.find(p => p.id === state.profile);

  function runPanel() {
    const p = current();
    if (!p) return h('section.state-panel', {}, h('h2', {}, 'No approved extraction profiles'), h('p', {}, 'Profiles are set up in the existing Nexus Admin workspace.'));
    const start = h('input', {type: 'date', 'aria-label': 'Report start date'}), end = h('input', {type: 'date', 'aria-label': 'Report end date'});
    const note = p.attendance ? 'Leave blank for yesterday. Attendance always runs from the 1st of the end date\'s month.' : p.defaultsToMonth ? 'Leave blank for month to date.' : 'Leave blank for today, or choose the report period.';
    const run = h('button.button.primary.run-button', {type: 'submit', disabled: !p.startable}, icon('play'), 'Run job now');
    const lastRuns = state.data.runs.filter(r => r.retailerId === p.id).slice(0, 5);
    return h('div.run-grid', {},
      h('form.panel.run-form', {onsubmit: e => { e.preventDefault(); act(run, () => post('/automation/runs', {retailerId: p.id, reportStartDate: start.value, reportEndDate: end.value}), r => `Queued: ${p.name}, ${r.reportStartDate} to ${r.reportEndDate}.`).then(r => { if (r) { state.tab = 'jobs'; state.filter = 'live'; draw(); } }); }},
        h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, '01 · Run'), h('h2', {}, 'Run an approved report')), p.executor === 'azure' ? h('span.pill.small.blue', {}, 'Runs on Azure') : null),
        h('div.toolbar.stack', {}, profilePicker(draw),
          h('dl.facts.compact', {}, h('dt', {}, 'Portal'), h('dd', {}, p.portal || '–'), h('dt', {}, 'Steps'), h('dd', {}, p.extractionName || '–'), h('dt', {}, 'Schedule'), h('dd', {}, p.reportSchedule.enabled ? `${p.reportSchedule.time} · ${dayNames(p.reportSchedule.daysOfWeek)}` : 'Manual only')),
          p.startable ? [h('div.date-pair', {}, h('label.field', {}, h('span', {}, 'Report start date'), start), h('label.field', {}, h('span', {}, 'Report end date'), end)), h('p.muted.small-note', {}, note), run]
            : h('div.notice.warning', {}, icon('alert'), h('span', {}, 'This profile still runs from the existing Nexus. ', h('a', {href: `${OLD_NEXUS}#automation`}, 'Open it there'), '.')))),
      h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'This profile'), h('h2', {}, 'Recent runs'))),
        lastRuns.length ? h('ul.run-list', {}, lastRuns.map(r => h('li', {}, h('button', {type: 'button', onclick: () => detail(r.id)}, h('span', {}, statusPill(r.status), ` ${r.reportStartDate || ''}${r.reportEndDate && r.reportEndDate !== r.reportStartDate ? ` → ${r.reportEndDate}` : ''}`), h('span.muted', {}, `${ago(r.lastActivity || r.createdAt)} · ${who(r)}`))))) : h('p.empty', {}, 'No runs yet.')));
  }

  const dayNames = days => (days.length === 7 ? 'every day' : days.join() === '1,2,3,4,5' ? 'weekdays' : DAYS.filter(([n]) => days.includes(n)).map(([, l]) => l).join(', ') || 'no days');

  function schedulePanel() {
    const p = current();
    if (!p) return h('p.empty', {}, 'No profiles.');
    const s = p.reportSchedule;
    const enabled = h('input', {type: 'checkbox', checked: s.enabled});
    const time = h('input', {type: 'time', value: s.time || '06:00', step: '60'});
    const mode = h('select', {}, h('option', {value: 'daily', selected: s.dateMode !== 'fixed'}, 'Use the run day'), h('option', {value: 'fixed', selected: s.dateMode === 'fixed'}, 'Use the dates below'));
    const start = h('input', {type: 'date', value: s.startDate}), end = h('input', {type: 'date', value: s.endDate});
    const fixed = h('div.date-pair', {}, h('label.field', {}, h('span', {}, 'Fixed start date'), start), h('label.field', {}, h('span', {}, 'Fixed end date'), end));
    const days = new Set(s.daysOfWeek.length ? s.daysOfWeek : [1, 2, 3, 4, 5]);
    const dayBoxes = DAYS.map(([n, label]) => h('label.day-box', {}, h('input', {type: 'checkbox', checked: days.has(n), onchange: e => { if (e.target.checked) days.add(n); else days.delete(n); summary(); }}), h('span', {}, label)));
    const summaryEl = h('p.schedule-summary', {'aria-live': 'polite'});
    const summary = () => { fixed.hidden = mode.value !== 'fixed'; summaryEl.textContent = enabled.checked ? `Runs at ${time.value || '–'} on ${dayNames([...days].sort())}, ${mode.value === 'fixed' ? 'for the fixed dates' : 'for that day\'s default period'} (South African time).` : 'Manual only: this report runs when someone presses Run job.'; };
    for (const el of [enabled, time, mode]) el.addEventListener('change', summary);
    summary();
    const save = h('button.button.primary', {type: 'submit', disabled: !p.startable}, 'Save schedule');
    return h('form.panel', {onsubmit: e => { e.preventDefault(); act(save, () => api(`/automation/schedules/${p.id}`, {method: 'PUT', signal: context.signal, body: {enabled: enabled.checked, time: time.value, dateMode: mode.value, startDate: start.value, endDate: end.value, daysOfWeek: [...days]}}),
      r => (r.nextRunDate ? `Schedule saved. Next run ${r.nextRunDate}${r.missedToday ? ' (today\'s time has passed)' : ''}.` : 'Schedule switched off.')); }},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, '02 · Schedule'), h('h2', {}, 'Schedule this report')), h(`span.pill.small.${s.enabled ? 'green' : 'orange'}`, {}, s.enabled ? `Daily ${s.time}` : 'Manual only')),
      h('div.toolbar.stack', {}, profilePicker(draw),
        p.startable ? [
          h('label.switch', {}, enabled, h('span', {}, 'Run automatically')),
          h('div.date-pair', {}, h('label.field', {}, h('span', {}, 'Run time'), time), h('label.field', {}, h('span', {}, 'Report period'), mode)), fixed,
          h('fieldset.days', {}, h('legend', {}, 'Run on these days'), dayBoxes), summaryEl,
          s.updatedAt ? h('p.muted.small-note', {}, `Last changed ${when(s.updatedAt)} by ${s.configuredByName || s.configuredByEmail || 'Nexus'}${s.lastQueuedAt ? ` · last queued ${when(s.lastQueuedAt)}` : ''}.`) : null, save
        ] : h('div.notice.warning', {}, icon('alert'), h('span', {}, 'This profile\'s schedule is managed in the existing Nexus.'))));
  }

  function jobsPanel() {
    const runs = state.data.runs;
    const live = r => r.active || ['azure-reserved', 'azure-dispatching'].includes(r.status);
    const match = {all: () => true, live, attention: r => r.stalled || ['waiting_otp', 'waiting_for_otp', 'waiting_approval'].includes(r.status) || (r.retryable && !r.retryQueuedRunId), failed: r => ['failed', 'rebuild_failed'].includes(r.status), completed: r => r.status === 'completed'}[state.filter];
    const q = state.q.toLowerCase();
    const shown = runs.filter(r => match(r) && (!q || `${r.retailerName} ${r.extractionName} ${r.id} ${who(r)}`.toLowerCase().includes(q)));
    const tbody = h('tbody', {}, shown.slice(0, 200).map(r => h('tr', {class: r.stalled ? 'attention' : ''},
      h('td', {}, h('button.link', {type: 'button', onclick: () => detail(r.id)}, r.retailerName || r.retailerId), h('div.muted.small-note', {}, r.reportStartDate ? `${r.reportStartDate}${r.reportEndDate && r.reportEndDate !== r.reportStartDate ? ` → ${r.reportEndDate}` : ''}` : '')),
      h('td', {}, statusPill(r.status), r.stalled ? h('div.small-note.warn-text', {}, 'No portal activity for 90 s+') : null),
      h('td.num', {}, r.totalSteps ? `${r.currentStep}/${r.totalSteps}` : '–'),
      h('td.nowrap', {}, when(r.createdAt)), h('td.nowrap', {}, ago(r.lastActivity)), h('td', {}, who(r)),
      h('td.actions', {}, jobActions(r)))));
    const endAll = h('button.button.ghost', {type: 'button', disabled: !runs.some(r => r.active), onclick: e => { if (confirm(`End all ${runs.filter(r => r.active).length} active jobs and close every waiting verification?`)) act(e.currentTarget, () => post('/automation/end-all'), r => `${r.cancelledRuns} job(s) ended, ${r.closedPrompts} prompt(s) closed.`); }}, 'End all active jobs');
    return h('section.panel', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, '03 · Jobs'), h('h2', {}, 'Run activity')), h('span.muted', {}, `${formatNumber(shown.length)} of the latest ${formatNumber(runs.length)} jobs`)),
      h('div.toolbar', {},
        h('div.segmented', {role: 'tablist', 'aria-label': 'Job filter'}, FILTERS.map(([id, label]) => h('button', {type: 'button', role: 'tab', 'aria-selected': String(state.filter === id), class: state.filter === id ? 'on' : '', onclick: () => { state.filter = id; draw(); }}, label))),
        h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', value: state.q, placeholder: 'Profile, person or job id', oninput: e => { state.q = e.target.value; const pos = e.target.selectionStart; draw(); const again = body.querySelector('input[type=search]'); again?.focus(); again?.setSelectionRange(pos, pos); }})),
        endAll),
      h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Profile', 'Status', 'Step', 'Started', 'Last activity', 'Requested by', ''].map((l, i) => h('th', {scope: 'col', class: i === 2 ? 'num' : ''}, l)))),
        shown.length ? tbody : h('tbody', {}, h('tr', {}, h('td.empty', {colspan: '7'}, 'No jobs match.'))))));
  }

  function jobActions(r) {
    const out = [];
    if (r.active) out.push(h('button.button.small.ghost', {type: 'button', onclick: e => { if (confirm(`Stop ${r.retailerName}? No new report will be delivered.`)) act(e.currentTarget, () => post(`/automation/runs/${r.id}/abort`), () => 'Job stopped.'); }}, 'Abort'));
    if (r.stalled) {
      out.push(h('button.button.small.ghost', {type: 'button', onclick: e => act(e.currentTarget, () => post(`/automation/runs/${r.id}/keep-waiting`), () => 'Keeping the portal session open.')}, 'Keep waiting'));
      out.push(h('button.button.small', {type: 'button', onclick: e => { if (confirm('End this portal session and queue a fresh run?')) act(e.currentTarget, () => post(`/automation/runs/${r.id}/restart`), x => `Restarted as ${x.restartRunId}.`); }}, 'Restart'));
    }
    if (r.retryable) out.push(h('button.button.small', {type: 'button', onclick: e => act(e.currentTarget, () => post(`/automation/runs/${r.id}/retry`), x => `Retry queued from step ${x.retryFromStep}.`)}, 'Retry failed step'));
    return out;
  }

  async function detail(id) {
    dialog.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    if (!dialog.open) dialog.showModal();
    try {
      const {run: r} = await api(`/automation/runs/${id}`, {signal: context.signal});
      const facts = [['Status', statusPill(r.status)], ['Report period', r.actualReportPeriod || (r.reportStartDate ? `${r.reportStartDate} → ${r.reportEndDate}` : '–')], ['Started', when(r.createdAt)], ['Completed', when(r.completedAt)],
        ['Requested by', who(r)], ['Trigger', r.trigger || 'manual'], ['Runs on', r.executor === 'azure' ? 'Azure' : 'Google'], ['File', r.fileName || '–'], ['Job id', r.id], r.retryOfRunId ? ['Retry of', r.retryOfRunId] : null, r.retryQueuedRunId ? ['Retried as', r.retryQueuedRunId] : null].filter(Boolean);
      dialog.replaceChildren(
        h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, r.extractionName || 'Extraction'), h('h2', {}, r.retailerName || r.retailerId), h('p.muted', {}, r.message || '')), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
        h('div.detail-actions', {}, jobActions(r)),
        h('section.panel', {}, h('dl.facts', {}, facts.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
        r.runSummary?.text ? h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Summary')), h('p.summary-text', {}, r.runSummary.text), r.runSummary.sharePointUrl ? h('p.summary-text', {}, h('a', {href: r.runSummary.sharePointUrl, target: '_blank', rel: 'noopener'}, 'Open in SharePoint', icon('external'))) : null) : null,
        h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Timeline'), h('span.muted', {}, `${r.timelineEventCount} events`)),
          h('ol.timeline', {}, [...r.executionTimeline].reverse().map(e => h(`li.${/fail|error/.test(e.event) ? 'bad' : /complete|deliver|upload/.test(e.event) ? 'good' : ''}`, {}, h('span.time', {}, when(e.at)), h('div', {}, h('strong', {}, e.event.replace(/[-_]/g, ' ')), e.step ? h('span.muted', {}, ` · step ${e.step}${e.action ? ` (${e.action})` : ''}`) : null, h('p', {}, e.message)))))));
    } catch (error) {
      if (error.name !== 'AbortError') dialog.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This job could not load'), h('p', {}, error.message), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Close')));
    }
  }

  function alertsPanel() {
    const list = state.data.alerts;
    return h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, '04 · Reliability'), h('h2', {}, 'Alerts')), h('span.muted', {}, `${list.filter(a => a.status === 'open').length} open`)),
      list.length ? h('ul.plain-list.alerts', {}, list.map(a => h('li', {class: a.status}, h('span', {}, h('strong', {}, a.title || a.type), h('div.muted.small-note', {}, `${a.retailerName || ''} · ${a.message}`)), h(`span.run-pill.${a.status === 'open' ? (a.severity === 'critical' ? 'red' : 'orange') : 'muted'}`, {}, a.status), h('em', {}, a.runId ? h('button.link', {type: 'button', onclick: () => detail(a.runId)}, when(a.lastDetectedAt || a.createdAt)) : when(a.lastDetectedAt || a.createdAt)))))
        : h('p.empty', {}, 'No alerts.'));
  }

  function reportsPanel() {
    const list = state.data.reports;
    return h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, '05 · Deliveries'), h('h2', {}, 'Delivered reports')), h('span.muted', {}, 'Latest 24 files')),
      list.length ? h('ul.plain-list', {}, list.map(r => h('li', {}, h('span', {}, h('strong', {}, r.name), h('div.muted.small-note', {}, r.retailerName)), h('em', {}, when(r.completedAt)), h('a.button.small', {href: `/api/automation/reports/${encodeURIComponent(r.id)}`, download: ''}, icon('external'), 'Download'))))
        : h('p.empty', {}, 'No delivered reports in the latest jobs.'));
  }

  function auditPanel() {
    const list = state.data.audit;
    return h('section.panel', {}, h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, '06 · Audit'), h('h2', {}, 'Recent access and schedule activity'))),
      list.length ? h('ul.plain-list', {}, list.map(a => h('li', {}, h('span', {}, h('strong', {}, a.event.replace(/-/g, ' ')), h('div.muted.small-note', {}, [a.retailerName, a.message].filter(Boolean).join(' · '))), h('em', {}, a.actorName || a.actorEmail || '–'), h('em', {}, when(a.createdAt)))))
        : h('p.empty', {}, 'No activity recorded.'));
  }

  await load();
}
