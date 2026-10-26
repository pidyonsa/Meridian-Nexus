import {h, icon, formatNumber, toast} from '../ui.js';
import {api, ApiError} from '../api.js';

// Geo attendance admin (/admin/geo-attendance, Nexus admins): the Rep TNA tracker the daily attendance job writes to,
// the current Geo Rep operational week, the daily schedule, the Attendance Store Master used to enrich visits, and the
// people or teams excluded from the Syndicated Attendance dashboards.
const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const when = v => (v ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v)) : '–');

function postFile(path, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.setRequestHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.onload = () => { let body = null; try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ } if (xhr.status < 300) resolve(body); else reject(new ApiError(xhr.status, body)); };
    xhr.onerror = () => reject(new Error('The upload was interrupted. Try again.'));
    xhr.send(file);
  });
}
const toBase64 = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = () => reject(new Error('The file could not be read.')); r.readAsDataURL(file); });

export async function renderGeoAttendance(main, context) {
  const body = h('div.geo-body');
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Admin'), h('h1', {}, 'Geo attendance'), h('p.lede.compact', {}, 'The Rep TNA tracker, operational week, daily schedule, store enrichment and dashboard exclusions behind Syndicated Attendance.')),
      h('div.head-actions', {}, h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh'))),
    body);
  let data = null, previewed = null;

  async function load() {
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try { data = await api('/geo-attendance', {signal: context.signal}); draw(); } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'Geo attendance could not load'), h('p', {}, error.message)));
    }
  }
  async function act(button, request, done) {
    button.disabled = true;
    try { const r = await request(); toast(done(r), 'success'); await load(); } catch (error) { if (error.name !== 'AbortError') toast(error.message, 'error'); button.disabled = false; }
  }

  function draw() {
    body.replaceChildren(h('div.run-grid.geo-grid', {}, trackerPanel(), weekPanel(), schedulePanel(), masterPanel()), exclusionsPanel());
  }

  function trackerPanel() {
    const t = data.tracker;
    const url = h('input', {type: 'url', value: t?.sourceUrl || data.defaultTrackerUrl, maxlength: '2000', 'aria-label': 'Rep TNA tracker SharePoint link'});
    const save = h('button.button.primary', {type: 'submit', disabled: !data.graphEnabled}, 'Validate and save tracker');
    return h('form.panel', {onsubmit: e => { e.preventDefault(); act(save, () => api('/geo-attendance/tracker', {method: 'PUT', signal: context.signal, body: {sharePointUrl: url.value}}), r => `Tracker validated: ${r.tracker.name}.`); }},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'SharePoint workbook'), h('h2', {}, 'Rep TNA tracker')), h(`span.pill.small.${t?.status === 'configured' ? 'green' : 'orange'}`, {}, t?.status === 'configured' ? 'Validated' : 'Not configured')),
      h('div.toolbar.stack', {}, h('label.field', {}, h('span', {}, 'Workbook link'), url),
        t ? h('dl.facts.compact', {}, h('dt', {}, 'Workbook'), h('dd', {}, t.webUrl || t.sourceUrl ? h('a', {href: t.webUrl || t.sourceUrl, target: '_blank', rel: 'noopener'}, t.name || 'Open in SharePoint', icon('external')) : t.name || '–'),
          Object.entries(t.tabs || {}).map(([tab, v]) => [h('dt', {}, tab), h('dd', {}, `${formatNumber(v.existingRows)} rows below header row ${v.headerRow}`)]), h('dt', {}, 'Modified'), h('dd', {}, when(t.lastModifiedDateTime))) : null,
        h('p.muted.small-note', {}, 'Nexus checks the Strike rate and Schedules tabs have every column the daily job writes before saving. The merchandiser tracker is managed by its own job.'),
        !data.graphEnabled ? h('div.notice.warning', {}, icon('alert'), h('span', {}, 'SharePoint is not connected on this site.')) : null, save));
  }

  function weekPanel() {
    const week = h('select', {'aria-label': 'Operational week'}, [1, 2, 3, 4].map(n => h('option', {value: String(n), selected: n === data.operationalWeek}, `Week ${n}`)));
    const save = h('button.button.primary', {type: 'submit'}, 'Save current week');
    return h('form.panel', {onsubmit: e => { e.preventDefault(); act(save, () => api('/geo-attendance/week', {method: 'PUT', signal: context.signal, body: {operationalWeek: Number(week.value)}}), r => `Operational week ${r.operationalWeek} saved.`); }},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Geo Rep cycle'), h('h2', {}, 'Operational week')), h('span.muted', {}, data.operationalWeekUpdatedAt ? `Saved ${when(data.operationalWeekUpdatedAt)}` : '')),
      h('div.toolbar.stack', {}, h('label.field', {}, h('span', {}, 'Current week'), week), h('p.muted.small-note', {}, 'Stamped on each tracker update and shown on the attendance dashboards.'), save));
  }

  function schedulePanel() {
    const s = data.schedule || {enabled: false, time: '01:00', daysOfWeek: [1, 2, 3, 4, 5]};
    const enabled = h('input', {type: 'checkbox', checked: s.enabled});
    const time = h('input', {type: 'time', value: s.time || '01:00'});
    const days = new Set(s.daysOfWeek?.length ? s.daysOfWeek : [1, 2, 3, 4, 5]);
    const save = h('button.button.primary', {type: 'submit'}, 'Save schedule');
    return h('form.panel', {onsubmit: e => { e.preventDefault(); act(save, () => api('/automation/schedules/geo-rep-attendance-for-reps', {method: 'PUT', signal: context.signal, body: {enabled: enabled.checked, time: time.value || '01:00', dateMode: 'daily', daysOfWeek: [...days], startDate: '', endDate: ''}}), r => (r.nextRunDate ? `Schedule saved. Next run ${r.nextRunDate}.` : 'Schedule switched off.')); }},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Report automation'), h('h2', {}, 'Daily attendance run')), h(`span.pill.small.${s.enabled ? 'green' : 'orange'}`, {}, s.enabled ? `Daily ${s.time}` : 'Off')),
      h('div.toolbar.stack', {}, h('label.switch', {}, enabled, h('span', {}, 'Run automatically')), h('label.field', {}, h('span', {}, 'Run time'), time),
        h('fieldset.days', {}, h('legend', {}, 'Run on these days'), DAYS.map(([n, label]) => h('label.day-box', {}, h('input', {type: 'checkbox', checked: days.has(n), onchange: e => { if (e.target.checked) days.add(n); else days.delete(n); }}), h('span', {}, label)))),
        h('p.muted.small-note', {}, 'Runs Geo Rep Capture Attendance for Reps; the tracker update follows automatically.'), save));
  }

  function masterPanel() {
    const master = data.storeMasters.find(m => m.id === data.storeMasterId) || data.storeMasters[0];
    const name = h('input', {type: 'text', maxlength: '120', value: master?.name || 'Attendance Store Master'});
    const file = h('input', {type: 'file', accept: '.xlsx'});
    const save = h('button.button.primary', {type: 'submit'}, 'Upload and save');
    return h('form.panel', {onsubmit: e => {
      e.preventDefault();
      const f = file.files[0];
      if (!f || !/\.xlsx$/i.test(f.name)) { toast('Choose the .xlsx store master.', 'error'); return; }
      if (f.size > 25 * 1024 * 1024) { toast('The store master must be 25 MB or smaller.', 'error'); return; }
      act(save, () => postFile(`/api/geo-attendance/store-master?${new URLSearchParams({id: master?.id || data.storeMasterId, name: name.value, fileName: f.name})}`, f), r => `Saved: ${formatNumber(r.storeCount)} stores in ${formatNumber(r.regionCount)} regions (sheet ${r.sheetName}).`);
    }},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Visit enrichment'), h('h2', {}, 'Attendance Store Master')), master ? h('span.muted', {}, `${formatNumber(master.storeCount)} stores · ${formatNumber(master.regionCount)} regions`) : null),
      h('div.toolbar.stack', {},
        master ? h('dl.facts.compact', {}, h('dt', {}, 'Current file'), h('dd', {}, master.sourceName || '–'), h('dt', {}, 'Sheet'), h('dd', {}, master.sheetName || '–'), h('dt', {}, 'Updated'), h('dd', {}, when(master.updatedAt))) : null,
        h('label.field', {}, h('span', {}, 'Name'), name), h('label.field', {}, h('span', {}, 'New workbook (.xlsx, 25 MB)'), file),
        h('p.muted.small-note', {}, 'Needs a Region column and a Store Name or Store Code column. The file is checked before it replaces the current one.'), save));
  }

  function exclusionsPanel() {
    const x = data.exclusions;
    const name = h('input', {type: 'text', maxlength: '160', placeholder: 'Person or manager name'});
    const code = h('input', {type: 'text', maxlength: '80', placeholder: 'Staff code (people only, optional)'});
    const reason = h('input', {type: 'text', maxlength: '300', placeholder: 'Reason (optional)'});
    const type = h('select', {}, h('option', {value: 'person'}, 'Person'), h('option', {value: 'manager'}, 'Manager and team'));
    const audience = h('select', {}, h('option', {value: 'both'}, 'Reps and merchandisers'), h('option', {value: 'rep'}, 'Reps'), h('option', {value: 'merchandiser'}, 'Merchandisers'));
    const file = h('input', {type: 'file', accept: '.xlsx'});
    const previewBox = h('div.exclusion-preview');
    const runPreview = async (button, payload) => {
      button.disabled = true;
      try { previewed = await api('/geo-attendance/exclusions/preview', {method: 'POST', signal: context.signal, body: payload}); drawPreview(); } catch (error) { toast(error.message, 'error'); }
      button.disabled = false;
    };
    const addBtn = h('button.button', {type: 'button', onclick: e => { if (!name.value.trim()) { toast('Enter a name.', 'error'); return; } runPreview(e.currentTarget, {entries: [{name: name.value, type: type.value, audience: audience.value, userCode: code.value || undefined, reason: reason.value || undefined}]}); }}, 'Preview');
    const importBtn = h('button.button', {type: 'button', onclick: async e => { const f = file.files[0]; if (!f) { toast('Choose a workbook.', 'error'); return; } if (f.size > 1024 * 1024) { toast('Choose an XLSX workbook under 1 MB.', 'error'); return; } runPreview(e.currentTarget, {workbook: await toBase64(f), type: type.value, audience: audience.value}); }}, 'Preview import');
    function drawPreview() {
      if (!previewed) { previewBox.replaceChildren(); return; }
      const confirmBox = h('input', {type: 'checkbox'});
      const save = h('button.button.primary', {type: 'button', disabled: !previewed.adding, onclick: e => { if (!confirmBox.checked) { toast('Tick the confirmation first.', 'error'); return; } act(e.currentTarget, () => api('/geo-attendance/exclusions/commit', {method: 'POST', signal: context.signal, body: {entries: previewed.entries, reviewId: previewed.reviewId, revision: previewed.revision}}), r => { previewed = null; return `${r.changed} exclusion(s) saved.`; }); }}, 'Save exclusions');
      previewBox.replaceChildren(h('div.notice', {}, icon('alert'), h('span', {}, `${previewed.adding} to add, ${previewed.duplicates} already listed, ${previewed.unmatched} not found on the current dashboards.`)),
        h('ul.plain-list', {}, previewed.review.map(r => h('li', {}, h('span', {}, h('strong', {}, r.name), ` · ${r.type === 'manager' ? 'manager and team' : 'person'} · ${r.audience}${r.userCode ? ` · ${r.userCode}` : ''}`, r.sample.length ? h('div.muted.small-note', {}, r.sample.join(', ')) : null),
          h('em', {}, r.duplicate ? 'Already listed' : `${r.matchedPeople} matched`)))),
        h('div.approve-row', {}, h('label.switch', {}, confirmBox, h('span', {}, 'Remove these from the attendance dashboards')), save));
    }
    const toggle = (r, enabled) => e => act(e.currentTarget, () => api('/geo-attendance/exclusions/setEnabled', {method: 'POST', signal: context.signal, body: {id: r.id, enabled, revision: x.revision}}), () => (enabled ? 'Exclusion switched on.' : 'Exclusion paused.'));
    const remove = r => e => { if (confirm(`Remove the exclusion for ${r.name}? They will appear on the dashboards again.`)) act(e.currentTarget, () => api('/geo-attendance/exclusions/remove', {method: 'POST', signal: context.signal, body: {id: r.id, revision: x.revision}}), () => 'Exclusion removed.'); };
    return h('section.panel.exclusions', {},
      h('div.panel-head', {}, h('div', {}, h('p.eyebrow', {}, 'Syndicated Attendance'), h('h2', {}, 'Dashboard exclusions')), h('span.muted', {}, `${x.entries.length} rule${x.entries.length === 1 ? '' : 's'} · revision ${x.revision}${x.updatedBy?.email ? ` · ${x.updatedBy.email}` : ''}`)),
      h('div.toolbar', {}, h('label.field', {}, h('span', {}, 'Type'), type), h('label.field', {}, h('span', {}, 'Applies to'), audience), h('label.field.grow', {}, h('span', {}, 'Name'), name), h('label.field', {}, h('span', {}, 'Staff code'), code), h('label.field.grow', {}, h('span', {}, 'Reason'), reason), addBtn),
      h('div.toolbar', {}, h('label.field.grow', {}, h('span', {}, 'Or import a list (.xlsx, 1 MB)'), file), importBtn, h('a.button.ghost', {href: '/api/geo-attendance/exclusions/template', download: ''}, 'Template')),
      previewBox,
      h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Name', 'Type', 'Applies to', 'Staff code', 'Reason', 'Status', ''].map(l => h('th', {scope: 'col'}, l)))),
        h('tbody', {}, x.entries.length ? x.entries.map(r => h('tr', {class: r.enabled ? '' : 'dim'}, h('td', {}, h('strong', {}, r.name)), h('td', {}, r.type === 'manager' ? 'Manager and team' : 'Person'), h('td', {}, r.audience), h('td', {}, r.userCode || '–'), h('td.problem', {title: r.reason}, r.reason || '–'),
          h('td', {}, h(`span.run-pill.${r.enabled ? 'green' : 'muted'}`, {}, r.enabled ? 'Excluded' : 'Paused')),
          h('td.actions', {}, h('button.button.small.ghost', {type: 'button', onclick: toggle(r, !r.enabled)}, r.enabled ? 'Pause' : 'Switch on'), h('button.button.small.ghost.danger', {type: 'button', onclick: remove(r)}, 'Remove'))))
          : h('tr', {}, h('td.empty', {colspan: '7'}, 'Nobody is excluded.'))))),
      x.history?.length ? h('details.versions', {}, h('summary', {}, 'Recent changes'), h('ul.plain-list', {}, x.history.map(a => h('li', {}, h('span', {}, `${a.action} · ${(a.entries || []).map(e => e.name).join(', ')}`), h('em', {}, a.actor?.email || ''), h('em', {}, when(a.at)))))) : null);
  }

  await load();
}
