import {h, icon, toast} from '../ui.js';
import {api} from '../api.js';

// Extraction profiles (/admin/profiles, Nexus admins): each report's portal, login and linked step set, and the step
// sets themselves (ordered browser actions the extraction engine runs). Passwords are write-only.
const HINT = {
  navigate: ['URL (or blank for the portal address)', ''], fill: ['CSS selector', 'Text to type'], fillUsername: ['Username field selector', ''], fillPassword: ['Password field selector', ''],
  click: ['CSS selector', ''], clickText: ['Visible text', ''], clickInSection: ['Section selector', 'Text inside the section'], waitFor: ['CSS selector', ''], waitText: ['Visible text', ''],
  waitUrlContains: ['Part of the URL', ''], waitNetworkIdle: ['', ''], wait: ['', 'Milliseconds'], select: ['Select element selector', 'Option value or label'], setDateRange: ['Date range control selector', 'Format, e.g. YYYY-MM-DD'],
  fillOtp: ['Code field selector', 'Prompt text for the operator'], export: ['Export button selector', ''], download: ['Download link selector', '']
};
const when = v => (v ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg'}).format(new Date(v)) : '–');

export async function renderProfiles(main, context) {
  const state = {tab: new URLSearchParams(location.search).get('tab') === 'steps' ? 'steps' : 'profiles', data: null};
  const tabs = h('nav.view-tabs', {'aria-label': 'Extraction profiles'});
  const body = h('div.profiles-body');
  const dialog = h('dialog.drill', {'aria-labelledby': 'profileTitle'});
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Admin'), h('h1', {}, 'Extraction profiles'), h('p.lede.compact', {}, 'Portals, logins and the browser steps report automation runs. Passwords are encrypted and never shown again.')),
      h('div.head-actions', {}, h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh'),
        h('button.button.primary', {type: 'button', onclick: () => (state.tab === 'steps' ? editSteps(null) : editProfile(null))}, icon('sparkle'), 'New'))),
    tabs, body, dialog);

  async function load() {
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try { state.data = await api('/profiles', {signal: context.signal}); draw(); } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'Extraction profiles could not load'), h('p', {}, error.message)));
    }
  }

  function draw() {
    history.replaceState(null, '', `/admin/profiles${state.tab === 'steps' ? '?tab=steps' : ''}`);
    tabs.replaceChildren(...[['profiles', `Profiles (${state.data.profiles.length})`], ['steps', `Step sets (${state.data.stepSets.length})`]].map(([id, label]) => h('button', {type: 'button', class: state.tab === id ? 'on' : '', onclick: () => { state.tab = id; draw(); }}, label)));
    body.replaceChildren(state.tab === 'steps' ? stepSetsTable() : profilesTable());
  }

  function profilesTable() {
    const rows = state.data.profiles;
    return h('section.panel', {}, h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Profile', 'Portal', 'Login', 'Step set', 'Schedule', 'Password', ''].map(l => h('th', {scope: 'col'}, l)))),
      h('tbody', {}, rows.map(p => h('tr', {class: p.retired ? 'dim' : ''},
        h('td', {}, h('button.link', {type: 'button', onclick: () => editProfile(p)}, p.name), p.retired ? h('span.pill.small.orange', {}, 'Retired') : p.executor === 'azure' ? h('span.pill.small.blue', {}, 'Azure') : null),
        h('td.problem', {title: p.webAddress}, hostOf(p.webAddress)), h('td.problem', {}, p.username), h('td', {}, p.extractionName || h('span.muted', {}, 'Not linked')),
        h('td', {}, p.scheduleEnabled ? `Daily ${p.scheduleTime}` : h('span.muted', {}, 'Manual')),
        h('td', {}, p.hasPassword ? `Saved ${when(p.credentialsUpdatedAt)}` : h('span.bad', {}, 'Missing')),
        h('td.actions', {}, h('button.button.small.ghost', {type: 'button', onclick: () => editProfile(p)}, 'Edit'))))))));
  }
  const hostOf = url => { try { return new URL(url).hostname; } catch { return url; } };

  function stepSetsTable() {
    return h('section.panel', {}, h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Step set', 'Steps', 'Used by', 'Updated', ''].map((l, i) => h('th', {scope: 'col', class: i === 1 ? 'num' : ''}, l)))),
      h('tbody', {}, state.data.stepSets.map(s => h('tr', {}, h('td', {}, h('button.link', {type: 'button', onclick: () => editSteps(s)}, s.name), s.workflowMode ? h('div.muted.small-note', {}, s.workflowMode) : null),
        h('td.num', {}, String(s.steps.length)), h('td', {}, s.linked.length ? s.linked.join(', ') : h('span.muted', {}, 'Not linked')), h('td.nowrap', {}, when(s.updatedAt)),
        h('td.actions', {}, h('button.button.small.ghost', {type: 'button', onclick: () => editSteps(s)}, 'Edit'))))))));
  }

  async function save(button, request, message) {
    button.disabled = true;
    try { await request(); toast(message, 'success'); dialog.close(); await load(); } catch (error) { if (error.name !== 'AbortError') toast(error.message, 'error'); button.disabled = false; }
  }

  function editProfile(p) {
    const name = h('input', {type: 'text', maxlength: '100', required: true, value: p?.name || ''});
    const url = h('input', {type: 'url', maxlength: '1000', required: true, placeholder: 'https://', value: p?.webAddress || ''});
    const user = h('input', {type: 'text', maxlength: '320', required: true, autocomplete: 'off', value: p?.username || ''});
    const password = h('input', {type: 'password', maxlength: '1000', autocomplete: 'new-password', placeholder: p?.hasPassword ? 'Leave blank to keep the saved password' : 'Required for a new profile', required: !p?.hasPassword});
    const set = h('select', {}, h('option', {value: ''}, 'Not linked'), state.data.stepSets.map(s => h('option', {value: s.id, selected: s.id === p?.extractionProfileId}, `${s.name} (${s.steps.length} steps)`)));
    const submit = h('button.button.primary', {type: 'submit'}, p ? 'Save profile' : 'Add profile');
    const remove = p ? h('button.button.ghost.danger', {type: 'button', onclick: e => { if (confirm(`Delete "${p.name}" and its saved password? Report automation can no longer run it.`)) save(e.currentTarget, () => api(`/profiles/profiles/${encodeURIComponent(p.id)}`, {method: 'DELETE', signal: context.signal}), 'Profile deleted.'); }}, 'Delete') : null;
    dialog.replaceChildren(h('form', {onsubmit: e => { e.preventDefault(); save(submit, () => api('/profiles/profiles', {method: 'PUT', signal: context.signal, body: {id: p?.id, name: name.value, webAddress: url.value, username: user.value, extractionProfileId: set.value, password: password.value}}), p ? 'Profile saved.' : 'Profile added.'); }},
      h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, p ? p.id : 'New extraction profile'), h('h2', {id: 'profileTitle'}, p ? p.name : 'Add a profile')), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
      p?.retired ? h('div.notice.warning', {}, icon('alert'), h('span', {}, 'This profile belongs to a feature retired in October 2026. Report automation no longer runs it.')) : null,
      !state.data.passwordsEnabled ? h('div.notice.warning', {}, icon('alert'), h('span', {}, 'Passwords cannot be saved on this site; other changes can.')) : null,
      h('div.form-grid', {}, h('label.field', {}, h('span', {}, 'Name'), name), h('label.field', {}, h('span', {}, 'Step set'), set), h('label.field.wide', {}, h('span', {}, 'Portal web address'), url),
        h('label.field', {}, h('span', {}, 'Login username'), user), h('label.field', {}, h('span', {}, p?.hasPassword ? 'New password' : 'Password'), password)),
      h('p.muted.small-note', {}, 'Passwords are encrypted with the Nexus credential key before they are stored; nobody can read them back, including administrators.'),
      h('div.form-actions', {}, remove, h('span.spacer'), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Cancel'), submit)));
    dialog.showModal();
    name.focus();
  }

  function editSteps(s) {
    const steps = (s?.steps || [{action: 'navigate', selector: '', value: ''}]).map(x => ({...x}));
    const name = h('input', {type: 'text', maxlength: '120', required: true, value: s?.name || ''});
    const list = h('ol.step-list');
    const actions = state.data.actions;
    function drawSteps() {
      list.replaceChildren(...steps.map((step, i) => {
        const [selHint, valHint] = HINT[step.action] || ['Selector', 'Value'];
        const retired = !actions.includes(step.action);
        return h('li', {},
          h('span.step-num', {}, String(i + 1)),
          h('select', {'aria-label': `Step ${i + 1} action`, onchange: e => { step.action = e.target.value; drawSteps(); }}, (retired ? [step.action, ...actions] : actions).map(a => h('option', {value: a, selected: a === step.action}, retired && a === step.action ? `${a} (retired)` : a))),
          h('input', {type: 'text', value: step.selector || '', maxlength: '500', placeholder: selHint || '—', disabled: !selHint && !step.selector, 'aria-label': `Step ${i + 1} selector`, oninput: e => { step.selector = e.target.value; }}),
          h('input', {type: 'text', value: step.value || '', maxlength: '1000', placeholder: valHint || '—', disabled: !valHint && !step.value, 'aria-label': `Step ${i + 1} value`, oninput: e => { step.value = e.target.value; }}),
          h('span.step-tools', {},
            h('button.button.small.ghost', {type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; drawSteps(); }}, '↑'),
            h('button.button.small.ghost', {type: 'button', 'aria-label': 'Move down', disabled: i === steps.length - 1, onclick: () => { [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; drawSteps(); }}, '↓'),
            h('button.button.small.ghost.danger', {type: 'button', 'aria-label': 'Remove step', disabled: steps.length === 1, onclick: () => { steps.splice(i, 1); drawSteps(); }}, '✕')));
      }));
    }
    drawSteps();
    const add = h('button.button.small', {type: 'button', disabled: steps.length >= 50, onclick: () => { steps.push({action: 'click', selector: '', value: ''}); drawSteps(); add.disabled = steps.length >= 50; }}, '+ Add step');
    const submit = h('button.button.primary', {type: 'submit'}, s ? 'Save step set' : 'Add step set');
    const remove = s ? h('button.button.ghost.danger', {type: 'button', disabled: s.linked.length > 0, title: s.linked.length ? `Used by ${s.linked.join(', ')}` : '', onclick: e => { if (confirm(`Delete step set "${s.name}"?`)) save(e.currentTarget, () => api(`/profiles/step-sets/${encodeURIComponent(s.id)}`, {method: 'DELETE', signal: context.signal}), 'Step set deleted.'); }}, 'Delete') : null;
    dialog.replaceChildren(h('form', {onsubmit: e => { e.preventDefault(); save(submit, () => api('/profiles/step-sets', {method: 'PUT', signal: context.signal, body: {id: s?.id, name: name.value, steps}}), 'Step set saved.'); }},
      h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, s?.linked?.length ? `Used by ${s.linked.join(', ')}` : 'Step set'), h('h2', {id: 'profileTitle'}, s ? s.name : 'Add a step set')), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
      s?.linked?.length ? h('div.notice.warning', {}, icon('alert'), h('span', {}, 'Changes apply to the next run of every profile using this step set. Test with a manual run before the scheduled time.')) : null,
      h('label.field', {}, h('span', {}, 'Name'), name),
      h('div.step-head', {}, h('span', {}, '#'), h('span', {}, 'Action'), h('span', {}, 'Selector / target'), h('span', {}, 'Value'), h('span', {})), list, add,
      h('div.form-actions', {}, remove, h('span.spacer'), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Cancel'), submit)));
    dialog.showModal();
    name.focus();
  }

  await load();
}
